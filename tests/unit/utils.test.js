import { beforeAll, beforeEach, describe, expect, test } from "vitest";

beforeAll(async () => {
  window.IQ = {};
  await import("../../src/lib/state.js");
  await import("../../src/lib/i18n.js");
  await import("../../src/lib/utils.js");
});

describe("utils", () => {
  beforeEach(() => {
    window.IQ.utils.invalidateCache();
  });

  test("pushWithLimitImmutable returns new array without mutating original", () => {
    const original = [1, 2];
    const next = window.IQ.utils.pushWithLimitImmutable(original, 3, 2);

    expect(original).toEqual([1, 2]);
    expect(next).toEqual([2, 3]);
    expect(next).not.toBe(original);
  });

  test("setCache evicts oldest entry when capacity is exceeded", () => {
    for (let index = 0; index < 51; index += 1) {
      window.IQ.utils.setCache(`key-${index}`, index);
    }

    expect(window.IQ.utils.getCached("key-0")).toBeUndefined();
    expect(window.IQ.utils.getCached("key-50")).toBe(50);
  });
});
