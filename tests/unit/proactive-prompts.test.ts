import { describe, expect, test } from "vitest";

import {
  buildBriefingPrompt,
  buildDeadlinesPrompt,
  buildGhostsPrompt,
  buildMeetingPrepPrompt,
} from "../../src/lib/proactive-prompts";

describe("proactive prompt builders", () => {
  test("briefing prompt includes WorkIQ command, schema, and optional guidance", () => {
    const prompt = buildBriefingPrompt({
      customPrompt: "Prefer urgent customer items first",
      promptOverride: "only foundry-related items",
    });

    expect(prompt).toContain("/workiq:workiq");
    expect(prompt).toContain('"emails"');
    expect(prompt).toContain("Additional user guidance for WorkIQ: Prefer urgent customer items first");
    expect(prompt).toContain("User query focus: only foundry-related items");
  });

  test("all proactive builders emit their expected schema anchors", () => {
    expect(buildDeadlinesPrompt()).toContain('"deadlines"');
    expect(buildGhostsPrompt()).toContain('"ghosts"');
    expect(buildMeetingPrepPrompt()).toContain('"meeting"');
    expect(buildMeetingPrepPrompt()).toContain('"relatedDocs"');
  });
});