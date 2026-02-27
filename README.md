# IQ Copilot Browser Extension Lab

Chrome Extension（MV3）+ 本機 `proxy.js`，提供側欄 AI 助手、MCP/Skills、任務追蹤與 Proactive 掃描。

> 目前狀態：Browser UI **暫不支援 Agent 模式**（包含 Agent 面板與 Agent 視覺化）；目前支援的是 Skills/Tools 流程。

## 架構圖

```mermaid
flowchart LR
	A[Chrome Sidebar UI\nsidebar.html + sidebar.js] -->|chrome.runtime| B[background.js]
	B -->|HTTP| C[proxy.js]
	C -->|SDK| D[@github/copilot-sdk]
	D --> E[Copilot CLI]
	C --> F[Foundry API]
	C --> G[Local MCP Config\n~/.copilot/mcp-config.json]
```

## 安裝步驟

1. 安裝依賴

```bash
npm install
```

2. 啟動 CLI + Proxy（建議）

```bash
./start.sh
```

3. 在 Chrome 載入擴充功能
- 開啟 `chrome://extensions`
- 啟用「開發人員模式」
- `Load unpacked` 選擇本專案目錄

## Production 認證流程（重要）

本專案目前是 **本機架構**（Extension → Local Proxy → Copilot CLI），
因此每位使用者都需要完成「雙重登入」後才能正常使用：

1. **WorkIQ 帳號登入（先做）**
	- 先在 WorkIQ 流程中完成使用者登入（你的企業/產品身份驗證）。
2. **Copilot CLI GitHub 登入（再做）**
	- 在本機完成 Copilot CLI 的 GitHub 認證，確保 CLI 已授權可用。
3. **啟動本機服務**
	- 啟動 Copilot CLI server mode + `proxy.js`（可用 `./start.sh`）。

> 不建議使用共用單一 CLI/token 給多人使用；production 應採每位使用者自己的登入與授權邊界。

### 建議啟動順序

```bash
# 1) 先完成 WorkIQ 登入（依你的 WorkIQ 登入流程）

# 2) 完成 Copilot CLI GitHub 登入（依你安裝版本的 login 指令）

# 3) 啟動本機 CLI + Proxy
./start.sh
```

## Foundry 整合與 Browser UI 呈現

若你要把 Foundry 功能加進 Copilot CLI skills（例如 skills 內呼叫 Python script 來執行 Foundry 流程），
建議在 UI 上採用「技能 + 工具執行」可視化，與現有聊天體驗一致：

> Foundry 目前在 Browser UI 中僅支援 Skills/Tools 流程，不支援 Agent mode。

1. **Skills 面板**
	- 顯示 Foundry 相關 skills（名稱、描述、可用狀態）。
	- 可提供 `Refresh` 重新載入 skills 清單。
2. **Chat 串流區**
	- 當模型呼叫該 skill 時，顯示 tool 卡片（running/success/error、耗時、摘要）。
	- Python script 的執行結果可彙整為可讀摘要顯示在 assistant 回覆中。
3. **Context / History 面板**
	- 在 session 歷史中保留該次 Foundry 執行紀錄（哪個 skill、何時執行、結果）。
4. **設定面板（可選）**
	- 若需要切換 endpoint 或 auth method，可沿用既有 Foundry 設定區塊（`/api/foundry/*`）。

這樣可以讓使用者同時看到：
- 「我有哪些 Foundry skills 可用」
- 「這次對話是否真的觸發了 Foundry skill」
- 「執行成功/失敗與輸出摘要」

### MVP（已實作）

目前已先完成最小流程：

1. 在 `Skills` 面板點選名稱包含 `foundry` 的 skill。
2. Browser UI 送出 `EXECUTE_SKILL` 到 background。
3. proxy `POST /api/skills/execute` 先走 **mock handler**（不連真實 Foundry）。
4. mock 結果回到 Browser，顯示在 chat 區（含 summary + JSON output）。

> 注意：這一版是「Foundry 模擬回傳」，目的是先驗證 UI/CLI/proxy 串接。
> 下一步只要把 `/api/skills/execute` 的 mock 邏輯替換成真實 Foundry 呼叫即可。

## 開發指南

### 常用指令

```bash
# Lint
npm run lint

# E2E tests
npm test

# Build proxy bundle (esbuild + tree-shaking)
npm run build

# Watch proxy bundle
npm run build:watch
```

### 專案結構

- `sidebar.*`：Extension UI
- `background.js`：Service Worker / 訊息轉送
- `proxy.js`：本機 API gateway（已模組化 routes）
- `routes/*.js`：Proxy route modules（core/session/foundry/proactive）
- `routes/schemas.js`：Zod request schemas
- `lib/*`：sidebar 拆分中的共用模組

### Proxy 路由模組化

- `routes/core.js`：health/models/tools/quota/context/mcp
- `routes/session.js`：session 生命週期與 chat streaming
- `routes/foundry.js`：Foundry config/chat/status
- `routes/proactive.js`：Proactive config + scans

## 截圖

可將截圖放在 `docs/screenshots/`，並在此區段補上：

- `docs/screenshots/chat-panel.png`
- `docs/screenshots/notifications-panel.png`
- `docs/screenshots/tasks-panel.png`

## 測試文件

- 自動測試注意事項：`tests/README.md`
