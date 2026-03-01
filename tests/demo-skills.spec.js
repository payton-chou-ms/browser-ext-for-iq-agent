/**
 * Demo 4 — Skills / MCP / Microsoft Docs / Context7
 */
import { test, expect } from "@playwright/test";
import { launchExtension, sendAndWaitForReply, resetChat, goToChat, skipWithoutProxy, STREAM_TIMEOUT, CONNECTION_TIMEOUT } from "./demo-helper.js";

test.describe("Demo 4: Skills & MCP", () => {
  test.describe.configure({ mode: "serial" });

  let context, page;

  test.beforeAll(async () => {
    test.setTimeout(CONNECTION_TIMEOUT + 30000); // Extra buffer for browser launch
    await skipWithoutProxy(test);
    ({ context, page } = await launchExtension());
  });
  test.afterAll(async () => { await context?.close(); });

  test("4-1 /workiq skill triggers a response", async () => {
    test.slow();
    await goToChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "/workiq check latest microsoft foundry deck",
      STREAM_TIMEOUT,
    );
    const text = await bot.textContent();
    expect(text.length).toBeGreaterThan(10);
  });

  test("4-2 Microsoft Docs query returns documentation", async () => {
    test.slow();
    await resetChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "Using official Microsoft documentation, outline the setup steps and best practices for Azure Functions HTTP triggers.",
      STREAM_TIMEOUT,
    );
    const text = await bot.textContent();
    expect(text).toMatch(/Azure|Functions|HTTP|trigger/i);
  });

  test("4-3 /context7 fetches latest SDK docs", async () => {
    test.slow();
    await resetChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "/context7 Look up the latest OpenAI Python SDK chat completion usage and provide a minimal runnable example.",
      STREAM_TIMEOUT,
    );
    const text = await bot.textContent();
    expect(text.length).toBeGreaterThan(30);
  });
});
