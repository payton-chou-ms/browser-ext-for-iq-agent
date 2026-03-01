/**
 * Demo 3, 7, 8 — Panels (Proactive, Quick Prompts, Usage, Achievements, History)
 *
 * UI-only tests — no live proxy streaming needed.
 */
import { test, expect } from "@playwright/test";
import { launchExtension, goToChat, skipWithoutProxy, CONNECTION_TIMEOUT } from "./demo-helper.js";

test.describe("Demo Panels", () => {
  test.describe.configure({ mode: "serial" });

  let context, page;

  test.beforeAll(async () => {
    test.setTimeout(CONNECTION_TIMEOUT + 30000); // Extra buffer for browser launch
    await skipWithoutProxy(test);
    ({ context, page } = await launchExtension());
  });
  test.afterAll(async () => { await context?.close(); });

  /* ── 3. Proactive Panel ──────────────────────────────────────────── */

  test("3 Proactive panel opens and shows structure", async () => {
    await page.locator('.nav-btn[data-panel="notifications"]').click();
    await expect(page.locator("#panel-notifications")).toHaveClass(/active/);

    await expect(page.locator("#panel-notifications h3").first()).toContainText(
      /Proactive Agent/,
    );
    await expect(page.locator("#btn-refresh-proactive")).toBeVisible();
    await expect(page.locator("#proactive-schedule-cards-card")).toBeVisible();
  });

  /* ── 7. Quick Prompts ────────────────────────────────────────────── */

  test("7 Quick Prompts popup opens and lists prompts", async () => {
    await goToChat(page);
    await page.locator("#btn-quick-prompts").click();

    await expect(page.locator("#quick-prompts-popup")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".quick-prompts-header")).toContainText(/常用提示|Prompts/);
    await expect(page.locator("#btn-add-prompt")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#quick-prompts-popup")).toBeHidden({ timeout: 2000 }).catch(() => {});
  });

  /* ── 8. Usage / Achievements / History ───────────────────────────── */

  test("8-a Usage panel shows stats", async () => {
    await page.locator('.nav-btn[data-panel="usage"]').click();
    await expect(page.locator("#panel-usage")).toHaveClass(/active/);

    await expect(page.locator("#stat-messages")).toBeVisible();
    await expect(page.locator("#stat-tokens")).toBeVisible();
    await expect(page.locator("#stat-sessions")).toBeVisible();
  });

  test("8-b Achievements panel shows profile and badges", async () => {
    await page.locator('.nav-btn[data-panel="achievements"]').click();
    await expect(page.locator("#panel-achievements")).toHaveClass(/active/);

    await expect(page.locator("#ach-profile-card")).toBeVisible();
    await expect(page.locator("#ach-profile-title")).toBeVisible();
    await expect(page.locator("#ach-xp-text")).toBeVisible();

    await expect(page.locator('.ach-filter-btn[data-filter="all"]')).toBeVisible();
    await expect(page.locator('.ach-filter-btn[data-filter="unlocked"]')).toBeVisible();
  });

  test("8-c History panel shows past conversations", async () => {
    await page.locator('.nav-btn[data-panel="history"]').click();
    await expect(page.locator("#panel-history")).toHaveClass(/active/);

    await expect(page.locator("#history-search")).toBeVisible();
    await expect(page.locator("#history-list")).toBeVisible();
  });
});
