# IQ Copilot — End-to-End 測試指南

本文件說明如何執行 IQ Copilot Chrome 擴充功能的 End-to-End (E2E) 測試，以及各測試項目的涵蓋範圍。

## 目錄

- [環境需求](#環境需求)
- [執行測試](#執行測試)
- [測試架構](#測試架構)
- [測試套件清單](#測試套件清單)
- [共用 Helper 函式](#共用-helper-函式)
- [Timeout 設定](#timeout-設定)
- [疑難排解](#疑難排解)

---

## 環境需求

### 必要條件

1. **Node.js** 18+ 
2. **Playwright** 瀏覽器（首次執行會自動安裝）
3. **Proxy 服務運行中**：執行 `./start.sh` 啟動本地 proxy

### 安裝依賴

```bash
npm install
npx playwright install chromium
```

---

## 執行測試

### 啟動 Proxy（必須）

```bash
./start.sh
```

這會啟動：
- Copilot CLI (`copilot --headless`)
- Local proxy (`node dist/proxy.js`) 於 `http://127.0.0.1:8321`

### 執行所有 E2E 測試

```bash
npx playwright test
```

### 執行特定測試檔案

```bash
# 僅執行 extension 基礎測試
npx playwright test tests/extension.spec.js

# 僅執行 chat 相關測試
npx playwright test tests/demo-chat.spec.js

# 僅執行特定測試行號
npx playwright test tests/demo-chat.spec.js:18
```

### 執行 Unit Tests

```bash
npm run test:unit
```

### 常用選項

```bash
# 顯示詳細輸出
npx playwright test --reporter=list

# 指定 timeout（毫秒）
npx playwright test --timeout=180000

# 限制並行 workers
npx playwright test --workers=1

# 顯示瀏覽器視窗（非 headless）
CI= npx playwright test

# 產生 HTML 報告
npx playwright test --reporter=html
npx playwright show-report
```

---

## 測試架構

```
tests/
├── demo-helper.js         # 共用工具函式
├── extension.spec.js      # 擴充功能基礎測試 (6 tests)
├── demo-chat.spec.js      # Demo 1: 智慧聊天 (3 tests)
├── demo-multitab.spec.js  # Demo 2: 多分頁對話 (1 test)
├── demo-panels.spec.js    # Demo 3/7/8: UI 面板 (5 tests)
├── demo-skills.spec.js    # Demo 4: Skills & MCP (3 tests)
├── demo-agents.spec.js    # Demo 5/6: Foundry Agents (4 tests)
└── unit/                  # Unit tests (Vitest)
```

### 測試執行模式

| 設定 | 本地環境 | CI 環境 |
|------|---------|---------|
| Workers | 2 | 1 |
| Headless | No | Yes |
| Retries | 1 | 2 |

---

## 測試套件清單

### 1. Extension Sidebar (`extension.spec.js`)

基礎擴充功能 UI 測試，驗證核心功能運作正常。

| 測試項目 | 說明 |
|----------|------|
| Sidebar UI loads and chat input works | 側邊欄載入、聊天輸入框可用 |
| Navigation switches between panels | 面板切換功能 (Chat ↔ Context) |
| Suggestion chip sends message | 建議晶片點擊發送訊息並收到回覆 |
| Config navigation opens config panel | 設定面板開啟 |
| Config model dropdown triggers switch | 模型切換下拉選單功能 |
| New chat resets conversation | 新對話重置並顯示歡迎訊息 |

---

### 2. Demo 1: Smart Chat (`demo-chat.spec.js`)

智慧聊天助手功能測試。

| 測試項目 | 說明 |
|----------|------|
| 1-1 Page summary prompt | 頁面摘要提示詞收到 AI 回覆 |
| 1-5 Basic analysis prompt | 基本分析提示詞收到回覆 |
| 1-6 /help slash command | `/help` 指令顯示命令清單 |

**測試範例提示詞：**
- `"Summarize this page in 5 bullet points, then suggest 3 next steps."`
- `"Based on this page, what are the top 3 key points and 2 potential risks?"`

---

### 3. Demo 2: Multi-Tab (`demo-multitab.spec.js`)

多分頁獨立對話功能測試。

| 測試項目 | 說明 |
|----------|------|
| Multi-tab independent conversations | 驗證 Tab A/B 對話獨立、切換保留歷史 |

**測試流程：**
1. Tab A 發送 "Who is the CEO of Microsoft?"
2. 新增 Tab B，發送 "What is TypeScript?"
3. 驗證 Tab B 不包含 Tab A 訊息
4. 切回 Tab A，驗證原訊息仍在

---

### 4. Demo 3/7/8: Panels (`demo-panels.spec.js`)

UI 面板功能測試（不需要 AI 串流）。

| 測試項目 | 說明 |
|----------|------|
| 3 Proactive panel | Proactive Agent 面板開啟、顯示結構 |
| 7 Quick Prompts popup | 常用提示彈出視窗開啟、關閉 |
| 8-a Usage panel | 使用統計面板顯示 messages/tokens/sessions |
| 8-b Achievements panel | 成就面板顯示 profile 和 badges |
| 8-c History panel | 歷史面板顯示搜尋和列表 |

---

### 5. Demo 4: Skills & MCP (`demo-skills.spec.js`)

技能與 MCP 整合測試。

| 測試項目 | 說明 |
|----------|------|
| 4-1 /workiq skill | `/workiq` 技能觸發並收到回覆 |
| 4-2 Microsoft Docs query | 使用 Microsoft Docs 工具查詢文件 |
| 4-3 /context7 SDK docs | `/context7` MCP 工具取得最新 SDK 文件 |

**測試範例指令：**
- `/workiq check latest microsoft foundry deck`
- `"Using official Microsoft documentation, outline the setup steps for Azure Functions HTTP triggers."`
- `/context7 Look up the latest OpenAI Python SDK chat completion usage`

---

### 6. Demo 5-6: Foundry Agents & Gen Img (`demo-agents.spec.js`)

Foundry Agent 與圖片生成測試。

| 測試項目 | 說明 |
|----------|------|
| 5-1 Foundry UM agent | UM Semantic Agent 回答產品問題 |
| 5-2 Foundry PKM agent | PKM Semantic Agent 疑難排解 |
| 5-3 Foundry Fabric agent | Fabric Specs Agent 規格查詢 |
| 6 /gen_img | 圖片生成指令 |

**測試範例指令：**
- `/foundry_agent_skills um-semantic-agent to check Which projectors support Short Throw?`
- `/foundry_agent_skills pkm-semantic-agent to check How do I fix projector screen flickering?`
- `/gen_img Generate a cute cat picture`

⚠️ **注意**：圖片生成測試需要較長時間（最多 3 分鐘）。

---

## 共用 Helper 函式

`tests/demo-helper.js` 提供以下工具函式：

### `launchExtension()`

啟動帶有擴充功能的 Chrome 瀏覽器，導航到 sidebar 並等待初始化完成。

```javascript
const { context, page, extensionId } = await launchExtension();
```

### `sendAndWaitForReply(page, text, timeout?)`

發送訊息並等待 bot 回覆完成（串流結束）。

```javascript
const bot = await sendAndWaitForReply(page, "/help", 60000);
const text = await bot.textContent();
```

### `resetChat(page)`

重置為新的聊天分頁。

```javascript
await resetChat(page);
```

### `goToChat(page)`

切換到 Chat 面板。

```javascript
await goToChat(page);
```

---

## Timeout 設定

| 常數 | 值 | 用途 |
|------|------|------|
| `CONNECTION_TIMEOUT` | 45 秒 | 瀏覽器啟動、擴充功能載入 |
| `STREAM_TIMEOUT` | 60 秒 | 一般 AI 串流回覆 |
| `AGENT_TIMEOUT` | 180 秒 | Agent 呼叫、圖片生成 |

如需調整，請編輯 `tests/demo-helper.js`。

---

## 疑難排解

### Proxy 連線失敗

```
Error: net::ERR_CONNECTION_REFUSED
```

**解決方案：**
1. 確認 `./start.sh` 正在執行
2. 檢查 port 8321 是否可用：`curl http://127.0.0.1:8321/api/ping`
3. 重啟 proxy

### 測試超時

```
Error: expect(...).toHaveCount(0) failed
Timeout: 60000ms
```

**解決方案：**
1. 增加 timeout：`npx playwright test --timeout=180000`
2. 減少 workers：`npx playwright test --workers=1`
3. 檢查網路連線（部分測試需要外部 API）

### 擴充功能未載入

```
Error: element(s) not found
```

**解決方案：**
1. 確認 `manifest.json` 語法正確
2. 檢查 Chrome 是否已安裝：`npx playwright install chromium`
3. 確認專案根目錄正確

### Flaky Tests（間歇性失敗）

部分測試在平行執行時可能第一次失敗，但重試後通過。這是因為：
- Proxy 併發處理限制
- 瀏覽器資源競爭

**解決方案：**
- 測試配置已啟用 `retries: 1`（本地）/ `retries: 2`（CI）
- 如需更穩定，使用 `--workers=1`

---

## 測試報告

### 查看 HTML 報告

```bash
npx playwright show-report
```

### 查看失敗測試的 Trace

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

---

## 新增測試

### 建立新的測試檔案

```javascript
import { test, expect } from "@playwright/test";
import { launchExtension, sendAndWaitForReply, goToChat, CONNECTION_TIMEOUT } from "./demo-helper.js";

test.describe("My New Test Suite", () => {
  test.describe.configure({ mode: "serial" });

  let context, page;

  test.beforeAll(async () => {
    test.setTimeout(CONNECTION_TIMEOUT + 30000);
    ({ context, page } = await launchExtension());
  });
  
  test.afterAll(async () => { 
    await context?.close(); 
  });

  test("My test case", async () => {
    await goToChat(page);
    const bot = await sendAndWaitForReply(page, "Hello!");
    expect(await bot.textContent()).toContain("Hello");
  });
});
```

### 測試命名慣例

- 檔案名：`demo-<feature>.spec.js`
- 測試描述：`"<Demo #> <Feature description>"`
- 測試項目：`"<Demo#>-<SubItem> <Description>"`

---

## 相關文件

- [Playwright 官方文件](https://playwright.dev/docs/intro)
- [Chrome Extension Testing](https://playwright.dev/docs/chrome-extensions)
- [IQ Copilot 架構文件](./architecture.md)
- [Demo 功能說明](./DEMO-zhtw.md)
