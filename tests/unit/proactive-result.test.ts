import { describe, expect, test } from "vitest";

import { isProactiveLiveDataUnavailable, normalizeProactiveResult } from "../../src/lib/proactive-result";

describe("proactive result normalization", () => {
  test("detects unavailable live M365 responses", () => {
    expect(isProactiveLiveDataUnavailable("I can’t complete this because workiq-ask_work_iq is not available in this session.")).toBe(true);
    expect(isProactiveLiveDataUnavailable("I won’t fabricate M365 search results.")).toBe(true);
    expect(isProactiveLiveDataUnavailable("The workiq skill is not listed among available skills in the current skill registry.")).toBe(true);
    expect(isProactiveLiveDataUnavailable('{"emails":[]}')).toBe(false);
  });

  test("returns empty briefing payload when live data is unavailable", () => {
    const result = normalizeProactiveResult(
      "briefing",
      "I can’t complete this exactly as requested because workiq-ask_work_iq is not available in this session, and I won’t fabricate M365 search results."
    );

    expect(result).toEqual(
      expect.objectContaining({
        emails: [],
        meetings: [],
        tasks: [],
        mentions: [],
        unavailable: true,
      })
    );
  });

  test("filters briefing results by schedule-card prompt without inventing data", () => {
    const result = normalizeProactiveResult(
      "briefing",
      JSON.stringify({
        emails: [
          { from: "Alex", subject: "AKS weekly deck", age: "1h ago", priority: "high" },
          { from: "Jamie", subject: "Expense approval", age: "2h ago", priority: "medium" },
        ],
        meetings: [],
        tasks: [],
        mentions: [],
      }),
      "AKS deck"
    );

    expect(result).toEqual(
      expect.objectContaining({
        emails: [expect.objectContaining({ subject: "AKS weekly deck" })],
        meetings: [],
        tasks: [],
        mentions: [],
      })
    );
  });

  test("normalizes meeting prep payload to empty collections when fields are missing", () => {
    const result = normalizeProactiveResult("meeting-prep", JSON.stringify({ text: "No meeting found" }));

    expect(result).toEqual(
      expect.objectContaining({
        meeting: {},
        attendees: [],
        relatedDocs: [],
        recentChats: [],
        actionItems: [],
      })
    );
  });
});