import { beforeEach, describe, expect, test, vi } from "vitest";

import { isWorkIqToolUnavailable, registerWorkiqRoutes, resetWorkIqStatusCacheForTests } from "../../src/routes/workiq";
import type { RouteTable, WorkiqRouteDeps } from "../../src/shared/types";
import { WORKIQ_CLI_TIMEOUT_MS } from "../../src/lib/workiq-cli";

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
    destroy: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  };
  const client = {
    createSession: vi.fn(async () => session),
    resumeSession: vi.fn(async (sessionId: string) => ({ ...session, sessionId })),
    listSessions: vi.fn(async () => [{ sessionId: "session-listed-1" }]),
    rpc: {
      tools: {
        list: vi.fn(async () => ({ tools: [{ name: "skill", description: "Invoke a skill" }] })),
      },
    },
  };

  return {
    ensureClient: vi.fn(async () => client as never),
    getSessionOrResume: vi.fn(async () => session as never),
    sessions: new Map([["session-1", session as never]]),
    jsonRes: createJsonResponder(captured),
    readJsonBody: vi.fn(async () => ({ query: "Find latest AKS deck", sessionId: "session-1" })),
    log: vi.fn(),
    execFile: vi.fn((_file, _args, _options, callback) => callback(null, "", "")) as never,
    loadMcpConfigFromDisk: vi.fn(() => ({ source: null, config: { mcpServers: {} } })),
  } satisfies WorkiqRouteDeps;
}

describe("workiq routes", () => {
  beforeEach(() => {
    resetWorkIqStatusCacheForTests();
  });

  test("detects unavailable tool wording from model refusal", () => {
    expect(isWorkIqToolUnavailable("workiq-ask_work_iq is not available in this session")).toBe(true);
    expect(isWorkIqToolUnavailable("I won’t fabricate M365 search results.")).toBe(true);
    expect(isWorkIqToolUnavailable("The workiq skill is no longer available in the current skill registry.")).toBe(true);
    expect(isWorkIqToolUnavailable("Work IQ 技能目前不可用於此會話。可用的技能清單中沒有 `workiq` skill。")).toBe(true);
    expect(isWorkIqToolUnavailable("WORKIQ_UNAVAILABLE: Work IQ skill 未在此 session 的可用技能清單中。目前可用的技能包括 `foundry_agent_skill`、`gen-img`。")).toBe(true);
    expect(isWorkIqToolUnavailable("WorkIQ skill 工具目前無法使用。根據專案架構，WorkIQ 功能需要透過本地 Proxy 服務存取 M365 API。")).toBe(true);
    expect(isWorkIqToolUnavailable("Here are the three latest decks I found.")).toBe(false);
  });

  test("marks refusal response as unavailable", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const deps = createDeps(captured, {
      data: {
        content: "I can’t complete this exactly as requested because workiq-ask_work_iq is not available in this session.",
        messageId: "msg-1",
      },
    });
    deps.execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "Work IQ 技能目前不可用於此會話。可用的技能清單中沒有 `workiq` skill。", "");
      return {} as never;
    }) as never;

    registerWorkiqRoutes(routes, deps);

    await routes["POST /api/workiq/query"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(deps.execFile).toHaveBeenCalledWith(
      "copilot",
      ["-p", "/workiq:workiq Find latest AKS deck", "--allow-all-tools", "--silent"],
      expect.objectContaining({
        cwd: process.cwd(),
        timeout: WORKIQ_CLI_TIMEOUT_MS,
        env: process.env,
      }),
      expect.any(Function),
    );
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        meta: expect.objectContaining({
          toolUsed: "/workiq:workiq via copilot -p",
          unavailable: true,
          liveDataConfirmed: false,
          liveDataSource: "none",
        }),
        unavailable: true,
        toolUsed: "/workiq:workiq via copilot -p",
        liveDataSource: "none",
        messageId: null,
      })
    );
  });

  test("treats explicit WORKIQ_UNAVAILABLE prefix as unavailable query result", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const deps = createDeps(captured, {
      data: {
        content: "WORKIQ_UNAVAILABLE: Work IQ skill 尚未在此專案中配置。",
        messageId: "msg-explicit-unavailable",
      },
    });
    deps.execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "WORKIQ_UNAVAILABLE: Work IQ skill 尚未在此專案中配置。", "");
      return {} as never;
    }) as never;

    registerWorkiqRoutes(routes, deps);

    await routes["POST /api/workiq/query"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        meta: expect.objectContaining({
          unavailable: true,
          liveDataConfirmed: false,
        }),
        unavailable: true,
        liveDataConfirmed: false,
        liveDataSource: "none",
      })
    );
  });

  test("keeps successful skill response available", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const deps = createDeps(captured, {
      data: {
        content: "Title: AKS deck\nOwner: Alex\nUpdated: 2026-03-07",
        messageId: "msg-2",
      },
    });
    deps.execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "Title: AKS deck\nOwner: Alex\nUpdated: 2026-03-07", "");
      return {} as never;
    }) as never;

    registerWorkiqRoutes(routes, deps);

    await routes["POST /api/workiq/query"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        meta: expect.objectContaining({
          toolUsed: "/workiq:workiq via copilot -p",
          unavailable: false,
          liveDataConfirmed: true,
          liveDataSource: "skill",
        }),
        unavailable: false,
        toolUsed: "/workiq:workiq via copilot -p",
        liveDataConfirmed: true,
        liveDataSource: "skill",
        messageId: null,
      })
    );
  });

  test("queries WorkIQ directly through copilot cli even when sdk session lacks skill", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const deps = createDeps(captured, {
      data: {
        content: "Work IQ skill is not available in this session. The available skills are: foundry_agent_skill, gen-img.",
        messageId: "msg-2b",
      },
    });
    deps.execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "Title: Azure AI Speech deck\nOwner: Alex\nUpdated: 2026-03-08", "");
      return {} as never;
    }) as never;

    registerWorkiqRoutes(routes, deps);

    await routes["POST /api/workiq/query"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        meta: expect.objectContaining({
          unavailable: false,
          liveDataConfirmed: true,
        }),
        toolUsed: "/workiq:workiq via copilot -p",
        unavailable: false,
        liveDataConfirmed: true,
        liveDataSource: "skill",
        messageId: null,
        content: expect.stringContaining("Azure AI Speech deck"),
      })
    );
    expect(deps.execFile).toHaveBeenCalledTimes(1);
    expect(deps.ensureClient).not.toHaveBeenCalled();
  });

  test("rejects untrusted origin for workiq routes", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    registerWorkiqRoutes(routes, createDeps(captured, {
      data: {
        content: "unused",
        messageId: "msg-6",
      },
    }));

    await routes["POST /api/workiq/probe"]!({ headers: { origin: "https://evil.example" } } as never, {} as never);

    expect(captured.status).toBe(403);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("trusted origins"),
      })
    );
  });

  test("status uses a real probe and reports unavailable skill registry", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const deps = createDeps(captured, {
      data: {
        content: "The workiq skill is no longer available in the current skill registry.",
        messageId: "msg-3",
      },
    });
    deps.execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "WORKIQ_UNAVAILABLE: The workiq skill is no longer available in the current skill registry.", "");
      return {} as never;
    }) as never;

    registerWorkiqRoutes(routes, deps);

    await routes["GET /api/workiq/status"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        available: false,
        tool: "skill",
        route: "/workiq:workiq via copilot -p",
        probe: expect.objectContaining({
          available: false,
          reason: expect.stringContaining("current skill registry"),
        }),
      })
    );
  });

  test("probe endpoint returns explicit availability marker when skill is live", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const deps = createDeps(captured, {
      data: {
        content: "WORKIQ_AVAILABLE",
        messageId: "msg-4",
      },
    });
    deps.execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "WORKIQ_AVAILABLE", "");
      return {} as never;
    }) as never;

    registerWorkiqRoutes(routes, deps);

    await routes["POST /api/workiq/probe"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        available: true,
        route: "/workiq:workiq via copilot -p",
        ambiguous: false,
      })
    );
  });

  test("status uses direct copilot cli probe when sdk session lacks workiq skill", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const deps = createDeps(captured, {
      data: {
        content: "WORKIQ_UNAVAILABLE: No `workiq` skill is registered in the available skills for this session.",
        messageId: "msg-5",
      },
    });
    deps.execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "WORKIQ_AVAILABLE", "");
      return {} as never;
    }) as never;

    registerWorkiqRoutes(routes, deps);

    await routes["GET /api/workiq/status"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        available: true,
        probe: expect.objectContaining({
          available: true,
          content: "WORKIQ_AVAILABLE",
        }),
        route: "/workiq:workiq via copilot -p",
      })
    );
  });

  test("status uses short ttl cache while probe endpoint forces refresh", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const deps = createDeps(captured, {
      data: {
        content: "WORKIQ_AVAILABLE",
        messageId: "msg-cache",
      },
    });
    deps.execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "WORKIQ_AVAILABLE", "");
      return {} as never;
    }) as never;

    registerWorkiqRoutes(routes, deps);

    await routes["GET /api/workiq/status"]!({ url: "/api/workiq/status" } as never, {} as never);
    await routes["GET /api/workiq/status"]!({ url: "/api/workiq/status" } as never, {} as never);

    expect(deps.execFile).toHaveBeenCalledTimes(1);

    await routes["POST /api/workiq/probe"]!({} as never, {} as never);

    expect(deps.execFile).toHaveBeenCalledTimes(2);
  });
});