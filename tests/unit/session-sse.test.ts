import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";

import { registerSessionRoutes } from "../../src/routes/session";
import type { RouteTable } from "../../src/shared/types";

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

  test("switch-model returns 404 when session cannot be resumed", async () => {
    const routes: RouteTable = {};
    const jsonRes = vi.fn();

    registerSessionRoutes(routes, {
      ensureClient: vi.fn(),
      getSessionOrResume: vi.fn(async () => null),
      sessions: new Map(),
      jsonRes,
      readJsonBody: vi.fn(async () => ({ sessionId: "missing", modelId: "gpt-5" })),
      log: vi.fn(),
      buildPromptWithAttachments: vi.fn((prompt: string) => prompt),
      cors: vi.fn(),
    });

    await routes["POST /api/session/switch-model"]!({} as never, {} as never);

    expect(jsonRes).toHaveBeenCalledWith(
      expect.anything(),
      404,
      expect.objectContaining({ ok: false, error: expect.stringContaining("not found") })
    );
  });

  test("switch-model returns 200 on successful rpc model switch", async () => {
    const routes: RouteTable = {};
    const jsonRes = vi.fn();
    const switchTo = vi.fn(async () => ({ modelId: "gpt-5" }));

    const session = {
      rpc: {
        model: {
          switchTo,
        },
      },
    };

    registerSessionRoutes(routes, {
      ensureClient: vi.fn(),
      getSessionOrResume: vi.fn(async () => session as never),
      sessions: new Map(),
      jsonRes,
      readJsonBody: vi.fn(async () => ({ sessionId: "s1", modelId: "gpt-5" })),
      log: vi.fn(),
      buildPromptWithAttachments: vi.fn((prompt: string) => prompt),
      cors: vi.fn(),
    });

    await routes["POST /api/session/switch-model"]!({} as never, {} as never);

    expect(switchTo).toHaveBeenCalledWith({ modelId: "gpt-5" });
    expect(jsonRes).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({ ok: true, modelId: "gpt-5" })
    );
  });

  test("messages route returns 404 for missing session", async () => {
    const routes: RouteTable = {};
    const jsonRes = vi.fn();

    registerSessionRoutes(routes, {
      ensureClient: vi.fn(),
      getSessionOrResume: vi.fn(async () => null),
      sessions: new Map(),
      jsonRes,
      readJsonBody: vi.fn(async () => ({ sessionId: "missing" })),
      log: vi.fn(),
      buildPromptWithAttachments: vi.fn((prompt: string) => prompt),
      cors: vi.fn(),
    });

    await routes["POST /api/session/messages"]!({} as never, {} as never);

    expect(jsonRes).toHaveBeenCalledWith(
      expect.anything(),
      404,
      expect.objectContaining({ ok: false, error: expect.stringContaining("not found") })
    );
  });

  test("messages route returns messages for active session", async () => {
    const routes: RouteTable = {};
    const jsonRes = vi.fn();
    const getMessages = vi.fn(async () => [{ role: "user", content: "hi" }]);

    registerSessionRoutes(routes, {
      ensureClient: vi.fn(),
      getSessionOrResume: vi.fn(async () => ({ getMessages }) as never),
      sessions: new Map(),
      jsonRes,
      readJsonBody: vi.fn(async () => ({ sessionId: "s1" })),
      log: vi.fn(),
      buildPromptWithAttachments: vi.fn((prompt: string) => prompt),
      cors: vi.fn(),
    });

    await routes["POST /api/session/messages"]!({} as never, {} as never);

    expect(getMessages).toHaveBeenCalledTimes(1);
    expect(jsonRes).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({ ok: true, messages: [{ role: "user", content: "hi" }] })
    );
  });
});
