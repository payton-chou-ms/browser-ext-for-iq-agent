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

  test("formatText renders markdown-style lists", () => {
    const html = window.IQ.utils.formatText([
      "**MCP Status**",
      "- Source: /tmp/mcp.json",
      "- Servers: 2",
      "1. playwright",
      "2. github",
    ].join("\n"));

    expect(html).toContain("<strong>MCP Status</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Source: /tmp/mcp.json</li>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>playwright</li>");
  });

  test("formatText escapes html before markdown formatting", () => {
    const html = window.IQ.utils.formatText("- <img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });

  test("formatText renders markdown images as img tags", () => {
    const html = window.IQ.utils.formatText("Here is the result: ![generated banner](https://example.com/banner.png)");
    expect(html).toContain('<img src="https://example.com/banner.png" alt="generated banner"');
    expect(html).not.toContain("![generated banner]");
  });

  test("formatText renders link after image without confusion", () => {
    const html = window.IQ.utils.formatText("![img](https://example.com/a.png) and [link](https://example.com/b)");
    expect(html).toContain('<img src="https://example.com/a.png"');
    expect(html).toContain('<a href="https://example.com/b"');
  });

  test("formatText renders headings, blockquotes, links and fenced code", () => {
    const html = window.IQ.utils.formatText([
      "# Release Notes",
      "",
      "> Important update",
      "",
      "Please check [docs](https://example.com/docs)",
      "",
      "```js",
      "const x = 1;",
      "```",
    ].join("\n"));

    expect(html).toContain("<h1>Release Notes</h1>");
    expect(html).toContain("<blockquote><p>Important update</p></blockquote>");
    expect(html).toContain('<a href="https://example.com/docs" target="_blank" rel="noopener noreferrer">docs</a>');
    expect(html).toContain('<pre><code class="language-js">const x = 1;</code></pre>');
  });
});
