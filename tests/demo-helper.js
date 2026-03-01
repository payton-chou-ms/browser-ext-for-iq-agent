/**
 * IQ Copilot — Demo E2E 測試共用 helper
 *
 * 每個 demo spec 檔案 import 這裡的工具函式，
 * 各自建立獨立的 browser context 以支援平行執行。
 */
import { expect, chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── Constants ───────────────────────────────────────────────────────── */

export const PROXY_URL = "http://127.0.0.1:8321";
export const STREAM_TIMEOUT = 60_000;
export const AGENT_TIMEOUT = 120_000;
export const CONNECTION_TIMEOUT = 45_000; // Increased from 30s to 45s for slower environments

/* ── Browser bootstrap ───────────────────────────────────────────────── */

/**
 * Launch a fresh Chrome instance with the extension loaded,
 * navigate to the sidebar, and wait until it's fully initialised.
 *
 * Returns `{ context, page, extensionId }`.
 */
export async function launchExtension() {
  const isCi = Boolean(process.env.CI);
  const extensionPath = path.resolve(__dirname, "..");

  const context = await chromium.launchPersistentContext("", {
    headless: isCi,
    args: [
      ...(isCi ? ["--headless=new"] : []),
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [background] = context.serviceWorkers();
  if (!background) background = await context.waitForEvent("serviceworker");

  const extensionId = background.url().split("/")[2];
  console.log(`[demo-helper] Extension ID: ${extensionId}`);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/sidebar.html`);

  // Wait for basic UI readiness
  await expect(page.locator("#chat-input")).toBeVisible({ timeout: CONNECTION_TIMEOUT });

  // Wait for either welcome message OR chat-messages container to be ready
  // (persistent context may not show welcome if session was already initialized)
  try {
    await expect(page.locator("#chat-messages .message.bot").first()).toContainText(
      /IQ Copilot|✦|你好/,
      { timeout: 15000 },
    );
  } catch {
    // No welcome message, just wait for chat container to be stable
    await expect(page.locator("#chat-messages")).toBeVisible({ timeout: 5000 });
  }

  // Buffer for background init (session, tools cache)
  await page.waitForTimeout(2000);

  return { context, page, extensionId };
}

/* ── Chat helpers ────────────────────────────────────────────────────── */

/**
 * Send a chat message and wait for the bot's streaming response to complete.
 * Returns the locator for the **last** `.message.bot` element.
 */
export async function sendAndWaitForReply(page, text, timeout = STREAM_TIMEOUT) {
  const usersBefore = await page.locator("#chat-messages .message.user").count();
  const botsBefore = await page.locator("#chat-messages .message.bot").count();

  await page.locator("#chat-input").fill(text);
  await page.locator("#btn-send").click();

  // Wait for user message to appear
  await expect(page.locator("#chat-messages .message.user")).toHaveCount(usersBefore + 1, {
    timeout: 10_000,
  });

  // Wait for EITHER streaming to start OR a new bot message to appear (for local handlers like /help)
  try {
    await Promise.race([
      expect(page.locator("#streaming-msg")).toHaveCount(1, { timeout: 10_000 }),
      expect(page.locator("#typing-msg")).toHaveCount(1, { timeout: 10_000 }),
      expect(page.locator("#chat-messages .message.bot")).toHaveCount(botsBefore + 1, { timeout: 10_000 }),
    ]);
  } catch {
    // Streaming may not start for locally handled commands - continue anyway
  }

  // Wait for streaming to finish (both markers removed when done)
  await expect(page.locator("#streaming-msg")).toHaveCount(0, { timeout });
  await expect(page.locator("#typing-msg")).toHaveCount(0, { timeout: 10_000 });

  // Wait for a NEW bot message (not just any visible bot message)
  await expect(page.locator("#chat-messages .message.bot")).toHaveCount(botsBefore + 1, { timeout: 30_000 });

  const lastBot = page.locator("#chat-messages .message.bot").last();
  await expect(lastBot).toBeVisible({ timeout: 10_000 });

  return lastBot;
}

/**
 * Reset to a fresh chat tab.
 */
export async function resetChat(page) {
  if ((await page.locator("#btn-new-chat").count()) > 0) {
    await page.locator("#btn-new-chat").click();
  } else if ((await page.locator("#btn-add-tab").count()) > 0) {
    await page.locator("#btn-add-tab").click();
  }
  await expect(page.locator("#chat-messages .message.user")).toHaveCount(0, { timeout: 5000 }).catch(() => {});
  // Wait for welcome message in the new tab
  await expect(page.locator("#chat-messages .message.bot").first()).toBeVisible({ timeout: 5000 }).catch(() => {});
}

/**
 * Switch to the Chat panel.
 */
export async function goToChat(page) {
  await page.locator('.nav-btn[data-panel="chat"]').click();
  await expect(page.locator("#panel-chat")).toHaveClass(/active/);
}
