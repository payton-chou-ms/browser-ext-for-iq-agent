import { describe, expect, test, vi } from "vitest";

import { resolveProactiveWorkIqResult } from "../../src/lib/proactive-workiq";

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
    expect(result.usedCliFallback).toBe(false);
    expect(result.data).toEqual(
      expect.objectContaining({
        deadlines: [expect.objectContaining({ title: "Submit expense report" })],
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
    expect(result.usedCliFallback).toBe(false);
    expect(result.data).toEqual(
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

    expect(result.usedCliFallback).toBe(false);
    expect(result.data).toEqual(
      expect.objectContaining({
        unavailable: true,
        liveDataConfirmed: false,
        liveDataSource: "none",
      }),
    );
  });
});