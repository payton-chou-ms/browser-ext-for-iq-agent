import { beforeEach, describe, expect, test, vi } from "vitest";

let onMessageListener;

function createChromeMock(overrides = {}) {
  const storageSessionData = {};

  const chromeMock = {
    sidePanel: {
      setPanelBehavior: vi.fn(() => Promise.resolve()),
    },
    runtime: {
      onInstalled: {
        addListener: vi.fn(),
      },
      onMessage: {
        addListener: vi.fn((handler) => {
          onMessageListener = handler;
        }),
      },
      onConnect: {
        addListener: vi.fn(),
      },
      sendMessage: vi.fn(() => Promise.resolve()),
    },
    alarms: {
      get: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(),
      onAlarm: {
        addListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn((_keys, callback) => callback?.({})),
        set: vi.fn(),
      },
      session: {
        setAccessLevel: vi.fn(() => Promise.resolve()),
        get: vi.fn((keys, callback) => {
          if (typeof callback === "function") {
            callback(storageSessionData);
            return;
          }
          if (Array.isArray(keys)) {
            const out = {};
            for (const key of keys) out[key] = storageSessionData[key];
            return Promise.resolve(out);
          }
          if (typeof keys === "string") {
            return Promise.resolve({ [keys]: storageSessionData[keys] });
          }
          return Promise.resolve(storageSessionData);
        }),
        set: vi.fn((obj) => {
          Object.assign(storageSessionData, obj || {});
          return Promise.resolve();
        }),
        remove: vi.fn((key) => {
          delete storageSessionData[key];
          return Promise.resolve();
        }),
      },
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([{ windowId: 7, url: "https://example.com", title: "Example" }])),
      captureVisibleTab: vi.fn(() => Promise.resolve("data:image/png;base64,ZmFrZQ==")),
    },
  };

  return {
    ...chromeMock,
    ...overrides,
    tabs: {
      ...chromeMock.tabs,
      ...(overrides.tabs || {}),
    },
  };
}

async function loadBackground(chromeMock) {
  vi.resetModules();
  onMessageListener = undefined;

  globalThis.importScripts = vi.fn();
  globalThis.COPILOT_RPC = {
    setBaseUrl: vi.fn(),
    getBaseUrl: vi.fn(() => "http://127.0.0.1:8321"),
    checkConnection: vi.fn(async () => ({ connected: false })),
  };
  globalThis.chrome = chromeMock;

  await import("../../src/background.js");
}

async function sendBackgroundMessage(message) {
  expect(onMessageListener).toBeTypeOf("function");

  return await new Promise((resolve) => {
    const keepAlive = onMessageListener(message, {}, resolve);
    expect(keepAlive).toBe(true);
  });
}

describe("background screenshot capture", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    onMessageListener = undefined;
  });

  test("returns screenshot payload for active tab", async () => {
    const chromeMock = createChromeMock();
    await loadBackground(chromeMock);

    const res = await sendBackgroundMessage({ type: "CAPTURE_VISIBLE_TAB" });

    expect(res.ok).toBe(true);
    expect(res.dataUrl).toContain("data:image/png;base64,");
    expect(res.url).toBe("https://example.com");
    expect(chromeMock.tabs.captureVisibleTab).toHaveBeenCalledWith(7, { format: "png" });
  });

  test("blocks restricted browser URLs", async () => {
    const chromeMock = createChromeMock({
      tabs: {
        query: vi.fn(() => Promise.resolve([{ windowId: 1, url: "chrome://settings", title: "Settings" }])),
      },
    });
    await loadBackground(chromeMock);

    const res = await sendBackgroundMessage({ type: "CAPTURE_VISIBLE_TAB" });

    expect(res.ok).toBe(false);
    expect(String(res.error || "")).toContain("不支援截圖");
    expect(chromeMock.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });

  test("returns error when active tab is unavailable", async () => {
    const chromeMock = createChromeMock({
      tabs: {
        query: vi.fn(() => Promise.resolve([])),
      },
    });
    await loadBackground(chromeMock);

    const res = await sendBackgroundMessage({ type: "CAPTURE_VISIBLE_TAB" });

    expect(res.ok).toBe(false);
    expect(String(res.error || "")).toContain("找不到目前瀏覽分頁");
  });
});
