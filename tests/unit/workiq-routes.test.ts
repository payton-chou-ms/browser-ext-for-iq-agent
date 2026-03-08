import { describe, expect, test, vi } from "vitest";

import { isWorkIqToolUnavailable, registerWorkiqRoutes } from "../../src/routes/workiq";
import type { RouteTable, WorkiqRouteDeps } from "../../src/shared/types";

type Captured = {
  status?: number;
  body?: unknown;
};

function createJsonResponder(captured: Captured) {
  return vi.fn((_res, status: number, data: unknown) => {
    captured.status = status;
    captured.body = data;
  });
}

function createDeps(captured: Captured, sessionResponse: { data?: { content?: string; messageId?: string | null } }) {
  const session = {
    sessionId: "session-1",
    sendAndWait: vi.fn(async () => sessionResponse),
  };

  return {
    ensureClient: vi.fn(),
    getSessionOrResume: vi.fn(async () => session as never),
    sessions: new Map([["session-1", session as never]]),
    jsonRes: createJsonResponder(captured),
    readJsonBody: vi.fn(async () => ({ query: "Find latest AKS deck", sessionId: "session-1" })),
    log: vi.fn(),
  } satisfies WorkiqRouteDeps;
}

describe("workiq routes", () => {
  test("detects unavailable tool wording from model refusal", () => {
    expect(isWorkIqToolUnavailable("workiq-ask_work_iq is not available in this session")).toBe(true);
    expect(isWorkIqToolUnavailable("I won’t fabricate M365 search results.")).toBe(true);
    expect(isWorkIqToolUnavailable("Here are the three latest decks I found.")).toBe(false);
  });

  test("marks refusal response as unavailable", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    registerWorkiqRoutes(
      routes,
      createDeps(captured, {
        data: {
          content: "I can’t complete this exactly as requested because workiq-ask_work_iq is not available in this session.",
          messageId: "msg-1",
        },
      })
    );

    await routes["POST /api/workiq/query"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        unavailable: true,
        toolUsed: "workiq-ask_work_iq",
      })
    );
  });

  test("keeps successful tool response available", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    registerWorkiqRoutes(
      routes,
      createDeps(captured, {
        data: {
          content: "Title: AKS deck\nOwner: Alex\nUpdated: 2026-03-07",
          messageId: "msg-2",
        },
      })
    );

    await routes["POST /api/workiq/query"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        unavailable: false,
        toolUsed: "workiq-ask_work_iq",
      })
    );
  });
});