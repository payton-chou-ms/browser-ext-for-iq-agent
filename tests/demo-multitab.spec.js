/**
 * Demo 2 — Multi-Tab & Multi-Session
 */
import { test, expect } from "@playwright/test";
import { launchExtension, sendAndWaitForReply, resetChat, goToChat, CONNECTION_TIMEOUT } from "./demo-helper.js";

test.describe("Demo 2: Multi-Tab", () => {
  let context, page;

  test.beforeAll(async () => {
    test.setTimeout(CONNECTION_TIMEOUT + 30000); // Extra buffer for browser launch
    ({ context, page } = await launchExtension());
  });
  test.afterAll(async () => { await context?.close(); });

  test("Multi-tab: independent conversations", async () => {
    await goToChat(page);

    // — Tab A —
    const tabAReply = await sendAndWaitForReply(
      page,
      "Who is the CEO of Microsoft? Answer in one sentence.",
    );
    const tabAText = await tabAReply.textContent();
    expect(tabAText.length).toBeGreaterThan(10);

    // — Tab B —
    await page.locator("#btn-add-tab").click();
    // Wait for new tab to become active
    await page.waitForTimeout(800);

    const tabBReply = await sendAndWaitForReply(
      page,
      "What is TypeScript? Answer in one sentence.",
    );
    const tabBText = await tabBReply.textContent();
    expect(tabBText.length).toBeGreaterThan(10);

    // Verify Tab B does NOT contain Tab A's user message
    const tabBUsers = page.locator("#chat-messages .message.user");
    const tabBCount = await tabBUsers.count();
    for (let i = 0; i < tabBCount; i++) {
      await expect(tabBUsers.nth(i)).not.toContainText("CEO of Microsoft");
    }

    // Switch back to Tab A
    const tabs = page.locator("#chat-tabs .chat-tab");
    if ((await tabs.count()) >= 2) {
      await tabs.first().click();
      await page.waitForTimeout(500);
      await expect(
        page.locator("#chat-messages .message.user").first(),
      ).toContainText("CEO of Microsoft");
    }
  });
});
