import { describe, expect, test, vi } from "vitest";

import { registerFoundryRoutes } from "../../src/routes/foundry";
import type { RouteTable } from "../../src/shared/types";

type Captured = { status?: number; body?: unknown };

function createJsonResponder(captured: Captured) {
  return vi.fn((_res, status: number, data: unknown) => {
    captured.status = status;
    captured.body = data;
  });
}

describe("foundry routes", () => {
  test("chat returns 400 when foundry is not configured", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};

    registerFoundryRoutes(routes, {
      jsonRes: createJsonResponder(captured),
      readJsonBody: vi.fn(),
      readBody: vi.fn(async () => "{}"),
      log: vi.fn(),
      getFoundryState: vi.fn(() => ({ endpoint: "", apiKey: "" })),
      setFoundryState: vi.fn(),
      getFoundrySnapshot: vi.fn(() => ({ configured: false, endpoint: null })),
    });

    await routes["POST /api/foundry/chat"]!({} as never, {} as never);

    expect(captured.status).toBe(400);
    expect(captured.body).toEqual(
      expect.objectContaining({ ok: false, error: expect.stringContaining("Foundry not configured") })
    );
  });

  test("config route handles schema failure via readJsonBody null", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const setFoundryState = vi.fn();

    registerFoundryRoutes(routes, {
      jsonRes: createJsonResponder(captured),
      readJsonBody: vi.fn(async () => null),
      readBody: vi.fn(async () => "{}"),
      log: vi.fn(),
      getFoundryState: vi.fn(() => ({ endpoint: "https://example", apiKey: "secret" })),
      setFoundryState,
      getFoundrySnapshot: vi.fn(() => ({ configured: true, endpoint: "https://example" })),
    });

    await routes["POST /api/foundry/config"]!({} as never, {} as never);

    expect(setFoundryState).not.toHaveBeenCalled();
    expect(captured.status).toBeUndefined();
  });

  test("chat maps upstream non-OK response", async () => {
    const routes: RouteTable = {};
    const captured: Captured = {};
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "rate limit" } }),
    }));

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    registerFoundryRoutes(routes, {
      jsonRes: createJsonResponder(captured),
      readJsonBody: vi.fn(),
      readBody: vi.fn(async () => "{}"),
      log: vi.fn(),
      getFoundryState: vi.fn(() => ({ endpoint: "https://foundry.azure.com", apiKey: "secret" })),
      setFoundryState: vi.fn(),
      getFoundrySnapshot: vi.fn(() => ({ configured: true, endpoint: "https://foundry.azure.com" })),
    });

    await routes["POST /api/foundry/chat"]!({} as never, {} as never);

    expect(captured.status).toBe(429);
    expect(captured.body).toEqual({ ok: false, error: "rate limit" });

    vi.unstubAllGlobals();
  });
});
