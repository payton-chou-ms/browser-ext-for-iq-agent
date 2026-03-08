import { describe, expect, test } from "vitest";

import { normalizeProactiveResult } from "../../src/lib/proactive-result";

describe("proactive result normalization contracts", () => {
  test("normalizes valid JSON for deadlines", () => {
    const result = normalizeProactiveResult(
      "deadlines",
      JSON.stringify({ deadlines: [{ title: "Expense report", daysLeft: 1 }] }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        deadlines: [expect.objectContaining({ title: "Expense report" })],
      }),
    );
  });

  test("extracts JSON from fenced code blocks", () => {
    const result = normalizeProactiveResult(
      "ghosts",
      '```json\n{"ghosts":[{"from":"Ada","subject":"Need reply"}]}\n```',
    );

    expect(result).toEqual(
      expect.objectContaining({
        ghosts: [expect.objectContaining({ from: "Ada" })],
      }),
    );
  });

  test("returns unavailable envelope when live data is unavailable", () => {
    const result = normalizeProactiveResult(
      "meeting-prep",
      "live M365 data was unavailable in this session.",
    );

    expect(result).toEqual(
      expect.objectContaining({
        unavailable: true,
        attendees: [],
        relatedDocs: [],
      }),
    );
  });

  test("filters briefing content by prompt override tokens", () => {
    const result = normalizeProactiveResult(
      "briefing",
      JSON.stringify({
        emails: [
          { subject: "Foundry design review" },
          { subject: "Budget approval" },
        ],
        meetings: [],
        tasks: [],
        mentions: [],
      }),
      "foundry",
    );

    expect(result).toEqual(
      expect.objectContaining({
        emails: [expect.objectContaining({ subject: "Foundry design review" })],
      }),
    );
  });
});