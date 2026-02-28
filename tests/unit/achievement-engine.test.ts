import { beforeEach, describe, expect, test } from "vitest";

import "../../src/achievement-engine.ts";

type Engine = {
  init: () => Promise<unknown>;
  resetAll: () => void;
  track: (event: string, data?: Record<string, unknown>) => { xp: number; newUnlocks: unknown[] } | undefined;
  getCounters: () => Record<string, unknown>;
  getProfile: () => { xp: number; level: number };
  getAchievements: () => Array<{ id: string; unlocked: boolean }>;
};

const engine = (globalThis as unknown as { AchievementEngine: Engine }).AchievementEngine;

describe("AchievementEngine", () => {
  beforeEach(async () => {
    localStorage.clear();
    await engine.init();
    engine.resetAll();
  });

  test("tracks chat message counters and xp", () => {
    const result = engine.track("chat_send");
    const counters = engine.getCounters();
    const profile = engine.getProfile();

    expect(result?.xp).toBeGreaterThan(0);
    expect(counters.totalMessages).toBe(1);
    expect(profile.xp).toBeGreaterThan(0);
  });

  test("unlocks first chat achievement on first message", () => {
    engine.track("chat_send");
    const achievements = engine.getAchievements();
    const firstChat = achievements.find((achievement) => achievement.id === "chat-001");

    expect(firstChat?.unlocked).toBe(true);
  });

  test("returns xp bonus in achievement list items", () => {
    engine.track("chat_send");
    const achievements = engine.getAchievements();
    const firstChat = achievements.find((achievement) => achievement.id === "chat-001");

    expect(firstChat?.xpBonus).toBe(20);
  });

  test("levels up after enough tracked events", () => {
    for (let index = 0; index < 20; index += 1) {
      engine.track("chat_send");
    }

    const profile = engine.getProfile();
    expect(profile.level).toBeGreaterThan(1);
  });
});
