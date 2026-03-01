/**
 * Demo 1 — Smart Chat Assistant (1-1, 1-5, 1-6)
 */
import { test, expect } from "@playwright/test";
import { launchExtension, sendAndWaitForReply, resetChat, goToChat, skipWithoutProxy, CONNECTION_TIMEOUT } from "./demo-helper.js";

test.describe("Demo 1: Smart Chat", () => {
  test.describe.configure({ mode: "serial" });

  let context, page;

  test.beforeAll(async () => {
    test.setTimeout(CONNECTION_TIMEOUT + 30000); // Extra buffer for browser launch
    await skipWithoutProxy(test);
    ({ context, page } = await launchExtension());
  });
  test.afterAll(async () => { await context?.close(); });

  test("1-1 Page summary prompt receives a bot reply", async () => {
    await goToChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "Summarize this page in 5 bullet points, then suggest 3 next steps.",
    );
    const text = await bot.textContent();
    expect(text.length).toBeGreaterThan(20);
  });

  test("1-5 Basic analysis prompt receives a reply", async () => {
    await resetChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "Based on this page, what are the top 3 key points and 2 potential risks?",
    );
    const text = await bot.textContent();
    expect(text.length).toBeGreaterThan(20);
  });

  test("1-6 Slash commands: /help renders command list", async () => {
    await resetChat(page);
    await page.locator("#chat-input").fill("/help");
    await page.locator("#btn-send").click();

    await expect(
      page.locator("#chat-messages .message.bot").last(),
    ).toContainText(/命令|help|指令|Command|Available/i, { timeout: 10_000 });
  });
});
