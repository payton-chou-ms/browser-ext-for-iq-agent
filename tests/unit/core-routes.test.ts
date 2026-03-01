import { describe, expect, test, vi } from "vitest";

import { registerCoreRoutes } from "../../src/routes/core";
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
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    } as never,
    path: {
      dirname: vi.fn(() => "/tmp"),
    } as never,
    getFoundrySnapshot: vi.fn(() => ({ configured: false, endpoint: null })),
  } as unknown as CoreRouteDeps;
}

describe("core routes", () => {
  test("skills execute returns mock response for foundry skill", async () => {
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
          command: "status",
          status: "completed",
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
        error: expect.stringContaining("Only foundry mock skill"),
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
