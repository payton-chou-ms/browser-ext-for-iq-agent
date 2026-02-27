import { describe, expect, test, vi } from "vitest";

import { registerCoreRoutes } from "../../routes/core";
import type { CoreRouteDeps, RouteTable } from "../../shared/types";

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
});
