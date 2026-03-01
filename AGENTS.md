# IQ Copilot — Agent Instructions

> 本文件描述 IQ Copilot 的 AI 能力與開發指引，供 AI Agent 與開發者參考。

## Product Overview

IQ Copilot 是一個 **Edge 瀏覽器擴充功能**（MV3），透過側欄提供企業級 AI 助手體驗。整合 GitHub Copilot CLI、Microsoft Foundry Agent Service 與 Work IQ（M365），形成三大 IQ 平台協同：

| Platform | 能力 | 後端 |
|----------|------|------|
| **Foundry IQ** | 企業知識庫語意搜尋（UM / PKM / Fabric Agent） | Microsoft Foundry Agent Service |
| **Work IQ** | M365 行事曆、郵件、Teams 整合 + Proactive Scan | Work IQ API (M365 Graph) |
| **Copilot IQ** | 通用 AI 對話、程式碼分析、頁面摘要 | GitHub Copilot CLI + @github/copilot-sdk |

## Agent Capabilities

### Foundry Agent Skills

透過 `/foundry_agent_skills <query>` 呼叫 Foundry Agent：

- **um-semantic-agent** — 產品語意搜尋（投影機規格、功能比較）
- **pkm-semantic-agent** — 內部知識庫（SOP、FAQ、技術文件）
- **fabric-semantic-agent** — 數據分析（銷售報表、庫存趨勢）

技能腳本：`.github/skills/foundry_agent_skill/scripts/foundry_agent.sh`

### Image Generation

透過 `/gen-img <prompt>` 使用 Azure OpenAI 生成圖片（gpt-image-1.5, 1536×1024）。

技能腳本：`.github/skills/gen-img/scripts/generate_image.py`

### Proactive Scan

自動掃描當前頁面內容，提供上下文感知建議：
- 偵測頁面類型（產品頁、文件、程式碼）
- 產出結構化建議卡片
- 支援一鍵深入對話

### MCP Tools

`mcp.json` 定義 MCP 協定工具：

| Tool | Description |
|------|-------------|
| `proactive_scan` | 掃描頁面內容提供 AI 建議 |
| `foundry_execute` | 執行 Foundry Skill |

Prompts：`summarize_page`、`analyze_code`

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | 顯示所有可用命令 |
| `/foundry_agent_skills <query>` | 呼叫 Foundry Agent 執行語意搜尋 |
| `/model list` | 列出可用模型 |
| `/model refresh` | 重新載入模型清單 |
| `/model use <model-id>` | 切換當前 Tab 模型 |

---

## Architecture

```
Edge Extension (MV3)
├── sidebar.html/js + lib/*   → UI 層
├── background.js             → Service Worker (訊息路由)
└── content_script.js         → 頁面上下文擷取
      ↓ HTTP/SSE
Local Proxy (proxy.ts + routes/*)
      ↓
@github/copilot-sdk → Copilot CLI
Microsoft Foundry Agent Service
```

### Key Files

| Path | Purpose |
|------|---------|
| `src/sidebar.js` | UI controller（聊天、面板、命令選單） |
| `src/background.js` | Service Worker（訊息路由、SSE 橋接） |
| `src/proxy.ts` | API gateway + route registration |
| `src/routes/*.ts` | 5 大路由模組：core / session / foundry / proactive / workiq |
| `src/lib/*.js` | 共用工具（chat-streaming, chat-tabs, i18n, state...） |
| `src/lib/panels/*.js` | UI 面板模組 |

### Route Domains

| Domain | 路由前綴 | 職責 |
|--------|---------|------|
| **core** | `/api/chat`, `/api/models` | 聊天串流、模型管理 |
| **session** | `/api/session` | SSE 會話管理 |
| **foundry** | `/api/skills/*` | Foundry Agent 執行 |
| **proactive** | `/api/proactive/*` | Proactive Scan |
| **workiq** | `/api/workiq/*` | M365 整合 |

## Development

```bash
./start.sh          # 啟動 Copilot CLI + Proxy
npm test            # E2E tests (Playwright)
npm run test:unit   # Unit tests (Vitest)
npm run lint        # ESLint
npm run build       # TypeScript build
```

### Adding a New Route

1. Create handler in `src/routes/`
2. Register in `src/proxy.ts` router
3. Add Zod schema in `src/routes/schemas.ts`
4. Add unit tests in `tests/unit/`

### Modifying Chat Behavior

- Streaming: `src/lib/chat-streaming.js`
- Tab management: `src/lib/chat-tabs.js`
- Session history: `src/lib/chat-session.js`

## Security

- Zod schemas 驗證所有輸入
- CSP 定義於 `manifest.json`
- CORS 限制為擴充功能 origin
- 認證 token 不持久化於客戶端
- 所有 secrets 透過環境變數注入
