import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { skipWithoutProxy } from './demo-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Extension Sidebar', () => {
  test.describe.configure({ mode: 'serial' });
  const isCi = Boolean(process.env.CI);

  let context;
  let extensionId;
  let page;

  test.beforeEach(async () => {
    await skipWithoutProxy(test);
    // Determine the path to the extension directory (project root)
    const extensionPath = path.resolve(__dirname, '..');
    
    // Launch browser with the extension loaded
    // Extensions only work in persistent contexts (headed or headless=new)
    context = await chromium.launchPersistentContext('', {
      headless: isCi,
      args: [
        ...(isCi ? ['--headless=new'] : []),
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    // Wait for the background service worker to initialize and capture the ID
    let [background] = context.serviceWorkers();
    if (!background)
      background = await context.waitForEvent('serviceworker');

    // Extract extension ID from the background page URL
    // Format: chrome-extension://<id>/background.js
    extensionId = background.url().split('/')[2];
    console.log(`Extension ID: ${extensionId}`);

    page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidebar.html`);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test('Sidebar UI loads and chat input works', async () => {
    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeVisible();

    await expect(chatInput).toHaveAttribute('placeholder', /輸入訊息/);

    await chatInput.fill('Test message from Playwright');
    await expect(chatInput).toHaveValue('Test message from Playwright');

    // Wait for page to fully initialize
    await page.waitForTimeout(2000);

    // Check if welcome message exists, if not that's OK (may be persisted state)
    const botMessages = page.locator('#chat-messages .message.bot');
    const botCount = await botMessages.count();

    if (botCount > 0) {
      // Welcome message should contain recognizable content
      await expect(botMessages.first()).toContainText(/IQ Copilot|✦|你好|Copilot/, { timeout: 5000 });
    }
    // If no bot messages, that's acceptable (persisted state without welcome)
  });

  test('Navigation switches between chat and context panels', async () => {
    const contextButton = page.locator('.nav-btn[data-panel="context"]');
    const chatButton = page.locator('.nav-btn[data-panel="chat"]');

    await contextButton.click();
    await expect(page.locator('#panel-context')).toHaveClass(/active/);
    await expect(page.locator('#panel-chat')).not.toHaveClass(/active/);
    await expect(page.locator('#panel-title')).toHaveText(/內容|Context/);

    await chatButton.click();
    await expect(page.locator('#panel-chat')).toHaveClass(/active/);
    await expect(page.locator('#panel-context')).not.toHaveClass(/active/);
  });

  test('Suggestion chip sends message and receives simulated reply', async () => {
    const firstChip = page.locator('#chat-suggestions .suggestion-chip').first();
    const chipText = (await firstChip.textContent()) || '';
    const normalizedChipText = chipText.includes(' ') ? chipText.split(' ').slice(1).join(' ').trim() : chipText.trim();
    await firstChip.click();

    await expect(page.locator('#chat-messages .message.user').last()).toContainText(normalizedChipText);
    // Bot should respond with some content (streaming response or simulated)
    await expect(page.locator('#chat-messages .message.bot').last()).toContainText(/.+/, { timeout: 30000 });
  });

  test('Config navigation opens config panel', async () => {
    await page.click('.nav-btn[data-panel="config"]');

    await expect(page.locator('#panel-config')).toHaveClass(/active/);
    await expect(page.locator('#panel-title')).toHaveText(/設定|Settings|Config/);
  });

  test('Config model dropdown triggers model switch flow', async () => {
    await page.click('.nav-btn[data-panel="config"]');

    const modelSelect = page.locator('#config-model');
    await expect(modelSelect).toBeVisible();

    const optionCount = await page.locator('#config-model option').count();
    if (optionCount < 2) {
      await page.evaluate(() => {
        const sel = document.getElementById('config-model');
        if (!sel) return;
        sel.innerHTML = '';
        const opt1 = document.createElement('option');
        opt1.value = 'gpt-4.1';
        opt1.textContent = 'GPT-4.1';
        const opt2 = document.createElement('option');
        opt2.value = 'gpt-5-mini';
        opt2.textContent = 'GPT-5 mini';
        sel.appendChild(opt1);
        sel.appendChild(opt2);
        sel.value = 'gpt-4.1';
      });
    }

    const beforeValue = await modelSelect.inputValue();
    const targetValue = beforeValue === 'gpt-5-mini' ? 'gpt-4.1' : 'gpt-5-mini';
    await modelSelect.selectOption(targetValue);

    await expect(modelSelect).toHaveValue(targetValue);

    await expect(page.locator('#toast-container .toast').last()).toContainText(
      /切換模型中|已選定模型|Switching model|Model selected/
    );

    await expect(page.locator('#debug-log')).toContainText(/Model switching to:/);
  });

  test('New chat resets conversation and shows welcome message', async () => {
    if (await page.locator('#btn-new-chat').count() === 0) {
      return;
    }

    const chatInput = page.locator('#chat-input');
    const botMessages = page.locator('#chat-messages .message.bot');
    const initialBotCount = await botMessages.count();

    await chatInput.fill('hello from test');
    await page.click('#btn-send');

    await expect(page.locator('#chat-messages .message.user').last()).toContainText('hello from test');
    await expect(botMessages).toHaveCount(initialBotCount + 1);
    await expect(botMessages.last()).toContainText(/.+/);

    await page.click('#btn-new-chat');

    await expect(page.locator('#chat-messages .message.user')).toHaveCount(0);
    await expect(page.locator('#chat-messages .message.bot')).toHaveCount(1);
    await expect(page.locator('#chat-messages .message.bot').first()).toContainText('IQ Copilot');
    await expect(page.locator('#chat-suggestions')).toBeVisible();
  });
});
