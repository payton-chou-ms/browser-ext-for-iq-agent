# IQ Copilot Browser Extension Lab

Chrome Extension（MV3）+ 本機 `proxy.js`，提供側欄 AI 助手、MCP/Skills、任務追蹤與 Proactive Agent。

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
