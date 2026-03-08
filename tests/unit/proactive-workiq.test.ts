import { describe, expect, test, vi } from "vitest";

import { resolveProactiveWorkIqResult } from "../../src/lib/proactive-workiq";

describe("proactive Work IQ fallback", () => {
  test("falls back to direct CLI when headless response reports unavailable skill registry", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, JSON.stringify({ deadlines: [{ title: "Submit expense report", date: "2026-03-09", daysLeft: 1 }] }), "");
      return {} as never;
    }) as never;

    const result = await resolveProactiveWorkIqResult({
      kind: "deadlines",
      prompt: "/workiq:workiq test proactive",
      sendPrompt: async () => ({
        data: {
          content: "WORKIQ_UNAVAILABLE: Work IQ skill is not listed in the available skills for this session.",
        },
      }),
      execFile,
      log: vi.fn(),
    });

    expect(result.usedCliFallback).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        deadlines: [expect.objectContaining({ title: "Submit expense report" })],
        liveDataConfirmed: true,
        liveDataSource: "skill",
      }),
    );
  });

  test("falls back to direct CLI when headless proactive path throws", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(null, JSON.stringify({ ghosts: [{ from: "Alex", subject: "Need approval", receivedAt: "1 day ago" }] }), "");
      return {} as never;
    }) as never;

    const result = await resolveProactiveWorkIqResult({
      kind: "ghosts",
      prompt: "/workiq:workiq test proactive",
      sendPrompt: async () => {
        throw new Error("headless registry failure");
      },
      execFile,
      log: vi.fn(),
    });

    expect(result.usedCliFallback).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        ghosts: [expect.objectContaining({ subject: "Need approval" })],
        liveDataConfirmed: true,
      }),
    );
  });

  test("keeps unavailable state when both headless and direct CLI fallback fail", async () => {
    const execFile = vi.fn((_file, _args, _options, callback) => {
      callback(new Error("cli failed"), "", "cli failed");
      return {} as never;
    }) as never;

    const result = await resolveProactiveWorkIqResult({
      kind: "briefing",
      prompt: "/workiq:workiq test proactive",
      sendPrompt: async () => ({
        data: {
          content: "WORKIQ_UNAVAILABLE: No workiq skill is registered.",
        },
      }),
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