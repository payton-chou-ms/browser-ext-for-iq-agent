import { describe, expect, test, vi } from "vitest";

import { registerCoreRoutes, parseInvokePayload, buildFoundryArgs, execFileAsync } from "../../src/routes/core";
import type { CoreRouteDeps, RouteTable } from "../../src/shared/types";

type Captured = { status?: number; body?: unknown };

function createJsonResponder(captured: Captured) {
  return vi.fn((_res, status: number, data: unknown) => {
    captured.status = status;
    captured.body = data;
  });
}

function createCoreDeps(captured: Captured, readJsonBodyImpl: () => Promise<unknown>) {
  return {
    ensureClient: vi.fn(async () => ({
      ping: vi.fn(),
      listModels: vi.fn(async () => []),
      listSessions: vi.fn(async () => []),
      getState: vi.fn(() => "connected"),
      getAuthStatus: vi.fn(async () => ({ isAuthenticated: true })),
      rpc: {
        tools: { list: vi.fn(async () => ({ tools: [] })) },
        account: { getQuota: vi.fn(async () => ({ quotaSnapshots: {} })) },
      },
    })) as never,
    getClientState: vi.fn(() => "connected"),
    cliPort: 4321,
    httpPort: 8321,
    jsonRes: createJsonResponder(captured),
    readJsonBody: vi.fn(readJsonBodyImpl),
    log: vi.fn(),
    loadMcpConfigFromDisk: vi.fn(() => ({ source: null, config: { mcpServers: {} } })),
    getWritableMcpConfigPath: vi.fn(() => "/tmp/mcp-config.json"),
    fs: {
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    } as never,
    path: {
      join: vi.fn((...parts: string[]) => parts.join("/")),
      dirname: vi.fn(() => "/tmp"),
    } as never,
    execFile: vi.fn() as never,
    getFoundrySnapshot: vi.fn(() => ({ configured: false, endpoint: null })),
  } as unknown as CoreRouteDeps;
}

describe("core routes", () => {
  test("skills execute returns mock fallback when script not found", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    registerCoreRoutes(
      routes,
      createCoreDeps(captured, async () => ({
        skillName: "foundry.agent.run",
        command: "status",
        payload: { ticket: "A-101" },
      }))
    );

    await routes["POST /api/skills/execute"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        mode: "mock",
        result: expect.objectContaining({
          skillName: "foundry.agent.run",
          status: "script-not-found",
        }),
      })
    );
  });

  test("skills execute rejects non-foundry skill", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    registerCoreRoutes(
      routes,
      createCoreDeps(captured, async () => ({
        skillName: "browser.search",
        command: "status",
      }))
    );

    await routes["POST /api/skills/execute"]!({} as never, {} as never);

    expect(captured.status).toBe(400);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("Only foundry skill"),
      })
    );
  });

  test("skills execute invokes foundry_agent.sh and returns live result", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    const deps = createCoreDeps(captured, async () => ({
      skillName: "foundry_agent_skill",
      command: "invoke",
      payload: { message: "um-semantic-agent to check List WXGA models" },
    }));

    // Make script discoverable
    deps.fs = {
      ...deps.fs,
      existsSync: vi.fn(() => true),
    } as never;

    // Mock execFile to simulate successful invocation
    const mockResult = {
      agent_name: "um-semantic-agent",
      status: "completed",
      session_id: "resp_abc123",
      response_text: "Here are WXGA models: EW800ST, EW805ST",
    };
    deps.execFile = vi.fn((_file: string, _args: string[], _opts: unknown, cb: (...args: unknown[]) => void) => {
      cb(null, JSON.stringify(mockResult), "");
    }) as never;

    registerCoreRoutes(routes, deps);
    await routes["POST /api/skills/execute"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        mode: "live",
        result: expect.objectContaining({
          response_text: "Here are WXGA models: EW800ST, EW805ST",
          agent_name: "um-semantic-agent",
          status: "completed",
          session_id: "resp_abc123",
          skillName: "foundry_agent_skill",
          command: "invoke",
        }),
      })
    );
  });

  test("skills execute returns 502 on script error", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    const deps = createCoreDeps(captured, async () => ({
      skillName: "foundry_agent_skill",
      command: "invoke",
      payload: { message: "um-semantic-agent to check test" },
    }));

    deps.fs = { ...deps.fs, existsSync: vi.fn(() => true) } as never;
    deps.execFile = vi.fn((_file: string, _args: string[], _opts: unknown, cb: (...args: unknown[]) => void) => {
      const error = Object.assign(new Error("Process exited with code 1"), { stderr: "Auth failed" });
      cb(error, "", "Auth failed");
    }) as never;

    registerCoreRoutes(routes, deps);
    await routes["POST /api/skills/execute"]!({} as never, {} as never);

    expect(captured.status).toBe(502);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: false,
        mode: "live",
        error: expect.stringContaining("Foundry skill error"),
      })
    );
  });

  test("skills execute returns 504 on timeout", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    const deps = createCoreDeps(captured, async () => ({
      skillName: "foundry_agent_skill",
      command: "invoke",
      payload: { message: "um-semantic-agent to check slow query" },
    }));

    deps.fs = { ...deps.fs, existsSync: vi.fn(() => true) } as never;
    deps.execFile = vi.fn((_file: string, _args: string[], _opts: unknown, cb: (...args: unknown[]) => void) => {
      const error = Object.assign(new Error("Timed out"), { killed: true, stderr: "" });
      cb(error, "", "");
    }) as never;

    registerCoreRoutes(routes, deps);
    await routes["POST /api/skills/execute"]!({} as never, {} as never);

    expect(captured.status).toBe(504);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("timed out"),
      })
    );
  });

  test("lists local skills from .github/skills", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    const deps = createCoreDeps(captured, async () => ({}));
    deps.fs = {
      existsSync: vi.fn((targetPath: string) => {
        if (targetPath.endsWith(".github/skills")) return true;
        if (targetPath.endsWith("foundry_agent_skill/SKILL.md")) return true;
        if (targetPath.endsWith("plain_skill/SKILL.md")) return false;
        if (targetPath.endsWith("plain_skill/README.md")) return true;
        return false;
      }),
      readdirSync: vi.fn(() => [
        { name: "foundry_agent_skill", isDirectory: () => true },
        { name: "plain_skill", isDirectory: () => true },
      ]),
      readFileSync: vi.fn((targetPath: string) => {
        if (targetPath.endsWith("foundry_agent_skill/SKILL.md")) {
          return "# Foundry Agent Skill\n\nFoundry local skill description.";
        }
        return "# Plain Skill\n\nSimple local skill.";
      }),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    } as never;
    deps.path = {
      join: vi.fn((...parts: string[]) => parts.join("/")),
      relative: vi.fn((_from: string, to: string) => to.replace(`${process.cwd()}/`, "")),
      dirname: vi.fn(() => "/tmp"),
    } as never;

    registerCoreRoutes(routes, deps);

    await routes["POST /api/skills/local"]!({} as never, {} as never);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual(
      expect.objectContaining({
        ok: true,
        skills: expect.arrayContaining([
          expect.objectContaining({ name: "foundry_agent_skill", source: "local-skill" }),
          expect.objectContaining({ name: "plain_skill", source: "local-skill" }),
        ]),
      })
    );
  });
});

describe("parseInvokePayload", () => {
  test("parses '<agent> to check <message>' format", () => {
    const result = parseInvokePayload({
      message: "um-semantic-agent to check Please list WXGA models and their ports.",
    });
    expect(result).toEqual({
      agentName: "um-semantic-agent",
      message: "Please list WXGA models and their ports.",
    });
  });

  test("handles case-insensitive 'to check'", () => {
    const result = parseInvokePayload({
      message: "my-agent To Check what is this?",
    });
    expect(result).toEqual({
      agentName: "my-agent",
      message: "what is this?",
    });
  });

  test("returns null for empty message", () => {
    expect(parseInvokePayload({ message: "" })).toBeNull();
    expect(parseInvokePayload({})).toBeNull();
  });

  test("falls back to agentName field in payload", () => {
    const result = parseInvokePayload({
      message: "Hello world",
      agentName: "custom-agent",
    });
    expect(result).toEqual({
      agentName: "custom-agent",
      message: "Hello world",
    });
  });

  test("falls back to agent_name (snake_case) field in payload", () => {
    const result = parseInvokePayload({
      message: "Hello world",
      agent_name: "snake-agent",
    });
    expect(result).toEqual({
      agentName: "snake-agent",
      message: "Hello world",
    });
  });

  test("returns null when no agent name can be determined", () => {
    const result = parseInvokePayload({ message: "just a plain question" });
    expect(result).toBeNull();
  });
});

describe("buildFoundryArgs", () => {
  test("builds health args", () => {
    expect(buildFoundryArgs("health", {})).toEqual(["health", "--json"]);
  });

  test("builds list args with custom limit", () => {
    expect(buildFoundryArgs("list", { limit: 20 })).toEqual(["list", "--json", "--limit", "20"]);
  });

  test("builds invoke args from parsed message", () => {
    const args = buildFoundryArgs("invoke", {
      message: "um-semantic-agent to check List projectors",
    });
    expect(args).toEqual([
      "invoke",
      "--agent-name", "um-semantic-agent",
      "--message", "List projectors",
      "--json",
    ]);
  });

  test("builds invoke args with session_id", () => {
    const args = buildFoundryArgs("invoke", {
      message: "um-semantic-agent to check follow-up",
      session_id: "resp_abc123",
    });
    expect(args).toEqual([
      "invoke",
      "--agent-name", "um-semantic-agent",
      "--message", "follow-up",
      "--json",
      "--session-id", "resp_abc123",
    ]);
  });

  test("falls back to default agent when no agent name parsed", () => {
    const args = buildFoundryArgs("invoke", { message: "plain question" });
    expect(args).toEqual([
      "invoke",
      "--agent-name", "um-semantic-agent",
      "--message", "plain question",
      "--json",
    ]);
  });

  test("uses custom defaultAgent when provided", () => {
    const args = buildFoundryArgs("invoke", { message: "query", defaultAgent: "my-agent" });
    expect(args).toEqual([
      "invoke",
      "--agent-name", "my-agent",
      "--message", "query",
      "--json",
    ]);
  });

  test("returns null for invoke with empty message", () => {
    expect(buildFoundryArgs("invoke", { message: "" })).toBeNull();
    expect(buildFoundryArgs("invoke", {})).toBeNull();
  });

  test("maps status to health", () => {
    expect(buildFoundryArgs("status", {})).toEqual(["health", "--json"]);
  });

  test("returns null for unknown commands", () => {
    expect(buildFoundryArgs("unknown-cmd", {})).toBeNull();
  });
});

describe("execFileAsync", () => {
  test("resolves with stdout and stderr on success", async () => {
    const mockExecFile = vi.fn((_file: string, _args: string[], _opts: unknown, cb: (...args: unknown[]) => void) => {
      cb(null, '{"ok":true}', "some warning");
    });

    const result = await execFileAsync(mockExecFile as never, "/bin/test", ["--json"], {});
    expect(result).toEqual({ stdout: '{"ok":true}', stderr: "some warning" });
  });

  test("rejects with enriched error on failure", async () => {
    const mockExecFile = vi.fn((_file: string, _args: string[], _opts: unknown, cb: (...args: unknown[]) => void) => {
      cb(new Error("exit code 1"), "", "fatal error");
    });

    await expect(execFileAsync(mockExecFile as never, "/bin/test", [], {})).rejects.toThrow("exit code 1");
  });
});