import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";

import { registerSessionRoutes } from "../../routes/session";
import type { RouteTable } from "../../shared/types";

function createReq() {
  const req = new EventEmitter() as any;
  req.on = req.on.bind(req);
  return req;
}

function createSseRes() {
  const chunks: string[] = [];
  const res = {
    headersSent: false,
    writeHead: vi.fn(function writeHead() {
      res.headersSent = true;
    }),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
    }),
    end: vi.fn(),
  } as any;

  return { res, chunks };
}

async function waitFor(predicate: () => boolean, timeoutMs = 50) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

describe("session SSE routes", () => {
  test("send route emits done on session.idle", async () => {
    const routes: RouteTable = {};
    let onEvent: ((event: { type: string }) => void) | null = null;
    const unsubscribe = vi.fn();

    const session = {
      on: vi.fn((cb: (event: { type: string }) => void) => {
        onEvent = cb;
        return unsubscribe;
      }),
      send: vi.fn(async () => "msg-1"),
    };

    registerSessionRoutes(routes, {
      ensureClient: vi.fn(),
      getSessionOrResume: vi.fn(async () => session as never),
      sessions: new Map(),
      jsonRes: vi.fn(),
      readJsonBody: vi.fn(async () => ({ sessionId: "s1", prompt: "hello", attachments: [] })),
      log: vi.fn(),
      buildPromptWithAttachments: vi.fn((prompt: string) => prompt),
      cors: vi.fn(),
    });

    const req = createReq();
    const { res, chunks } = createSseRes();

    const handlerPromise = routes["POST /api/session/send"]!(req as never, res as never);
    await waitFor(() => typeof onEvent === "function");
    if (!onEvent) {
      throw new Error("Expected SSE listener to be registered");
    }
    (onEvent as (event: { type: string }) => void)({ type: "session.idle" });
    await handlerPromise;

    expect(res.writeHead).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalled();
    expect(chunks.join("\n")).toContain("event: done");
  });

  test("send route emits error event when session.send fails", async () => {
    const routes: RouteTable = {};
    const unsubscribe = vi.fn();

    const session = {
      on: vi.fn(() => unsubscribe),
      send: vi.fn(async () => {
        throw new Error("send failed");
      }),
    };

    registerSessionRoutes(routes, {
      ensureClient: vi.fn(),
      getSessionOrResume: vi.fn(async () => session as never),
      sessions: new Map(),
      jsonRes: vi.fn(),
      readJsonBody: vi.fn(async () => ({ sessionId: "s1", prompt: "hello", attachments: [] })),
      log: vi.fn(),
      buildPromptWithAttachments: vi.fn((prompt: string) => prompt),
      cors: vi.fn(),
    });

    const req = createReq();
    const { res, chunks } = createSseRes();

    await routes["POST /api/session/send"]!(req as never, res as never);

    expect(res.end).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalled();
    expect(chunks.join("\n")).toContain("event: error");
    expect(chunks.join("\n")).toContain("send failed");
  });

  test("send route unsubscribes on client disconnect", async () => {
    const routes: RouteTable = {};
    const unsubscribe = vi.fn();

    const session = {
      on: vi.fn(() => unsubscribe),
      send: vi.fn(async () => "msg-1"),
    };

    registerSessionRoutes(routes, {
      ensureClient: vi.fn(),
      getSessionOrResume: vi.fn(async () => session as never),
      sessions: new Map(),
      jsonRes: vi.fn(),
      readJsonBody: vi.fn(async () => ({ sessionId: "s1", prompt: "hello", attachments: [] })),
      log: vi.fn(),
      buildPromptWithAttachments: vi.fn((prompt: string) => prompt),
      cors: vi.fn(),
    });

    const req = createReq();
    const { res } = createSseRes();

    await routes["POST /api/session/send"]!(req as never, res as never);
    req.emit("close");

    expect(unsubscribe).toHaveBeenCalled();
  });
});
