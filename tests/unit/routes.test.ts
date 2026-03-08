import { describe, expect, test, vi } from "vitest";

import { registerProactiveRoutes } from "../../src/routes/proactive";
import { registerSessionRoutes } from "../../src/routes/session";
import type { RouteTable } from "../../src/shared/types";

type CapturedResponse = {
  status?: number;
  body?: unknown;
};

function createJsonResponder(captured: CapturedResponse) {
  return vi.fn((_res, status: number, data: unknown) => {
    captured.status = status;
    captured.body = data;
  });
}

function createDeferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("routes", () => {
  test("proactive scan-all throttles non-manual calls but allows manual refresh", async () => {
    const routes: RouteTable = {};
    const captured: CapturedResponse = {};

    const proactive = {
      getConfig: vi.fn(() => ({ workiqPrompt: "", model: "gpt-4.1" })),
      setConfig: vi.fn(),
      runBriefing: vi.fn(async () => ({ ok: true, data: { section: "briefing" } })),
      runDeadlines: vi.fn(async () => ({ ok: true, data: { section: "deadlines" } })),
      runGhosts: vi.fn(async () => ({ ok: true, data: { section: "ghosts" } })),
      runMeetingPrep: vi.fn(async () => ({ ok: true, data: { section: "meeting" } })),
    };

    const readJsonBody = vi.fn(async () => ({ source: "alarm" }));

    registerProactiveRoutes(routes, {
      jsonRes: createJsonResponder(captured),
      readJsonBody,
      log: vi.fn(),
      proactive,
    });

    const handler = routes["POST /api/proactive/scan-all"];
    expect(handler).toBeTypeOf("function");

    await handler!({} as never, {} as never);

    expect(proactive.runBriefing).toHaveBeenCalledTimes(1);
    expect(proactive.runDeadlines).toHaveBeenCalledTimes(1);
    expect(proactive.runGhosts).toHaveBeenCalledTimes(1);
    expect(proactive.runMeetingPrep).toHaveBeenCalledTimes(1);
    expect(captured.status).toBe(200);

    const firstBody = captured.body as { ok: boolean; throttled?: boolean; source?: string };
    expect(firstBody.ok).toBe(true);
    expect(firstBody.throttled).not.toBe(true);
    expect(firstBody.source).toBe("alarm");

    await handler!({} as never, {} as never);

    expect(proactive.runBriefing).toHaveBeenCalledTimes(1);
    expect(proactive.runDeadlines).toHaveBeenCalledTimes(1);
    expect(proactive.runGhosts).toHaveBeenCalledTimes(1);
    expect(proactive.runMeetingPrep).toHaveBeenCalledTimes(1);

    const secondBody = captured.body as { ok: boolean; throttled?: boolean; retryAfterMs?: number };
    expect(secondBody.ok).toBe(true);
    expect(secondBody.throttled).toBe(true);
    expect(typeof secondBody.retryAfterMs).toBe("number");
    expect((secondBody.retryAfterMs ?? 0) > 0).toBe(true);

    readJsonBody.mockResolvedValueOnce({ source: "manual" });
    await handler!({} as never, {} as never);

    expect(proactive.runBriefing).toHaveBeenCalledTimes(2);
    expect(proactive.runDeadlines).toHaveBeenCalledTimes(2);
    expect(proactive.runGhosts).toHaveBeenCalledTimes(2);
    expect(proactive.runMeetingPrep).toHaveBeenCalledTimes(2);

    const manualBody = captured.body as { ok: boolean; throttled?: boolean; source?: string };
    expect(manualBody.ok).toBe(true);
    expect(manualBody.source).toBe("manual");
    expect(manualBody.throttled).not.toBe(true);
  });

  test("session sendAndWait returns 404 when session is missing", async () => {
    const routes: RouteTable = {};
    const captured: CapturedResponse = {};

    registerSessionRoutes(routes, {
      ensureClient: vi.fn(),
      getSessionOrResume: vi.fn(async () => null),
      sessions: new Map(),
      jsonRes: createJsonResponder(captured),
      readJsonBody: vi.fn(async () => ({ sessionId: "missing", prompt: "hello", attachments: [] })),
      log: vi.fn(),
      buildPromptWithAttachments: vi.fn((prompt: string) => prompt),
      cors: vi.fn(),
    });

    const handler = routes["POST /api/session/sendAndWait"];
    expect(handler).toBeTypeOf("function");

    await handler!({} as never, {} as never);

    expect(captured.status).toBe(404);
    expect(captured.body).toEqual({ ok: false, error: "Session missing not found" });
  });

  test("proactive section routes dedupe in-flight requests for the same prompt", async () => {
    const routes: RouteTable = {};
    const responses = [] as Array<{ status: number; body: unknown }>;
    const briefingDeferred = createDeferred();

    const proactive = {
      getConfig: vi.fn(() => ({ workiqPrompt: "", model: "gpt-4.1" })),
      setConfig: vi.fn(),
      runBriefing: vi.fn(() => briefingDeferred.promise),
      runDeadlines: vi.fn(async () => ({ ok: true, data: { section: "deadlines" } })),
      runGhosts: vi.fn(async () => ({ ok: true, data: { section: "ghosts" } })),
      runMeetingPrep: vi.fn(async () => ({ ok: true, data: { section: "meeting" } })),
    };

    registerProactiveRoutes(routes, {
      jsonRes: vi.fn((_res, status: number, data: unknown) => {
        responses.push({ status, body: data });
      }),
      readJsonBody: vi.fn(async () => ({ prompt: "focus on foundry" })),
      log: vi.fn(),
      proactive,
    });

    const handler = routes["POST /api/proactive/briefing"];
    expect(handler).toBeTypeOf("function");

    const first = handler!({} as never, {} as never);
    const second = handler!({} as never, {} as never);

    await Promise.resolve();

    expect(proactive.runBriefing).toHaveBeenCalledTimes(1);

    briefingDeferred.resolve({
      ok: true,
      data: { section: "briefing" },
      meta: { toolUsed: "/workiq:workiq via copilot -p", unavailable: false, liveDataConfirmed: true, liveDataSource: "skill" },
    });

    await Promise.all([first, second]);

    expect(responses).toHaveLength(2);
    expect(responses[0]).toEqual(expect.objectContaining({ status: 200 }));
    expect(responses[1]).toEqual(expect.objectContaining({ status: 200 }));
    expect(responses[0]?.body).toEqual(responses[1]?.body);
  });
});
