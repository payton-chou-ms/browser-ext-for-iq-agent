import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PROACTIVE_ROUTE_TIMEOUT_MS, WORKIQ_QUERY_TIMEOUT_MS } from "../../src/shared/runtime-constants.js";

const fetchMock = vi.fn();

async function loadRpc() {
  vi.resetModules();
  globalThis.fetch = fetchMock;
  await import("../../src/copilot-rpc.js");
  return globalThis.COPILOT_RPC;
}

function okJsonResponse(payload) {
  return {
    ok: true,
    json: vi.fn(async () => payload),
    text: vi.fn(async () => JSON.stringify(payload)),
    status: 200,
    statusText: "OK",
  };
}

describe("COPILOT_RPC proactive timeouts", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    delete globalThis.COPILOT_RPC;
    delete globalThis.fetch;
  });

  test("uses extended timeout for proactive scan-all requests", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    fetchMock.mockResolvedValueOnce(okJsonResponse({ ok: true, results: {} }));

    const rpc = await loadRpc();
    await rpc.proactiveScanAll("manual");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8321/api/proactive/scan-all",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ source: "manual" }),
      }),
    );
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), PROACTIVE_ROUTE_TIMEOUT_MS);

    setTimeoutSpy.mockRestore();
  });

  test("uses extended timeout for section-level proactive refresh", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    fetchMock.mockResolvedValueOnce(okJsonResponse({ ok: true, data: {} }));

    const rpc = await loadRpc();
    await rpc.proactiveBriefing("focus on foundry");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8321/api/proactive/briefing",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "focus on foundry" }),
      }),
    );
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), PROACTIVE_ROUTE_TIMEOUT_MS);

    setTimeoutSpy.mockRestore();
  });

  test("uses centralized timeout for WorkIQ status requests", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    fetchMock.mockResolvedValueOnce(okJsonResponse({ ok: true, available: true }));

    const rpc = await loadRpc();
    await rpc.getWorkiqStatus();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8321/api/workiq/status",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), WORKIQ_QUERY_TIMEOUT_MS);

    setTimeoutSpy.mockRestore();
  });
});