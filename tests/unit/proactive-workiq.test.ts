import { describe, expect, test, vi } from "vitest";

import { resolveProactiveWorkIqResult } from "../../src/lib/proactive-workiq";
import { WORKIQ_CLI_TIMEOUT_MS } from "../../src/lib/workiq-cli";

describe("proactive Work IQ direct CLI", () => {
  test("always uses direct CLI result for proactive deadlines", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, JSON.stringify({ deadlines: [{ title: "Submit expense report", date: "2026-03-09", daysLeft: 1 }] }), "");
      return {} as never;
    }) as never;

    const result = await resolveProactiveWorkIqResult({
      kind: "deadlines",
      prompt: "/workiq:workiq test proactive",
      execFile,
      log: vi.fn(),
    });

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile).toHaveBeenCalledWith(
      "copilot",
      ["-p", "/workiq:workiq test proactive", "--allow-all-tools", "--silent"],
      expect.objectContaining({
        cwd: process.cwd(),
        timeout: WORKIQ_CLI_TIMEOUT_MS,
        env: process.env,
      }),
      expect.any(Function),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        deadlines: [expect.objectContaining({ title: "Submit expense report" })],
        liveDataConfirmed: true,
        liveDataSource: "skill",
      }),
    );
    expect(result.meta).toEqual(
      expect.objectContaining({
        toolUsed: "/workiq:workiq via copilot -p",
        unavailable: false,
        liveDataConfirmed: true,
        liveDataSource: "skill",
      }),
    );
  });

  test("preserves normalized unavailable state when direct CLI returns unavailable content", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, "WORKIQ_UNAVAILABLE: No workiq skill is registered.", "");
      return {} as never;
    }) as never;

    const result = await resolveProactiveWorkIqResult({
      kind: "briefing",
      prompt: "/workiq:workiq test proactive",
      execFile,
      log: vi.fn(),
    });

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual(
      expect.objectContaining({
        unavailable: true,
        liveDataConfirmed: false,
        liveDataSource: "none",
      }),
    );
    expect(result.meta).toEqual(
      expect.objectContaining({
        unavailable: true,
        liveDataConfirmed: false,
        liveDataSource: "none",
      }),
    );
  });

  test("keeps unavailable state when direct CLI execution fails", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(new Error("cli failed"), "", "cli failed");
      return {} as never;
    }) as never;

    const result = await resolveProactiveWorkIqResult({
      kind: "briefing",
      prompt: "/workiq:workiq test proactive",
      execFile,
      log: vi.fn(),
    });

    expect(result.data).toEqual(
      expect.objectContaining({
        unavailable: true,
        liveDataConfirmed: false,
        liveDataSource: "none",
      }),
    );
    expect(result.meta).toEqual(
      expect.objectContaining({
        unavailable: true,
        liveDataConfirmed: false,
        liveDataSource: "none",
      }),
    );
  });
});