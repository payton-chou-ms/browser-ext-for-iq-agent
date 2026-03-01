# IQ Copilot Browser Extension

> Chrome 側邊欄 AI 助手 — 整合 GitHub Copilot、Foundry IQ、Work IQ、Fabric IQ

[![CI](https://github.com/payton-chou-ms/browser-ext-for-iq-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/payton-chou-ms/browser-ext-for-iq-agent/actions)

---

## 🎯 What is IQ Copilot?

IQ Copilot 是一款**瀏覽器原生側邊欄 AI 助手**（Chrome MV3），透過本地 HTTP Proxy 橋接 GitHub Copilot CLI，並整合三大企業 IQ 平台：

| IQ 平台 | 能力 |
|---------|------|
| **Foundry IQ** | 企業知識 Agent — 產品手冊查詢、售後排障（um / pkm / fabric agent） |
| **Work IQ** | M365 資料查詢 — 郵件、行事曆、Teams、OneDrive |
| **Fabric IQ** | 結構化規格庫 — 產品規格比對與篩選 |

---

## 📈 Business Impact

| 指標 | 效益 |
|------|------|
| 資訊搜尋時間 | **-50%** |
| 會議準備時間 | **-40%** |
| 漏回郵件風險 | **-80%** |
| 系統切換次數 | **-70%** |
| 報價/諮詢效率 | **3×** |

---

## 🏗️ Architecture

```mermaid
flowchart LR
  A[Chrome Sidebar] -->|runtime msg / stream port| B[background.js]
  B -->|HTTP / SSE| C[proxy.ts :8321]
  C -->|@github/copilot-sdk| D[Copilot CLI :4321]
  C -->|child_process| E[Foundry Agent Skills]
  C -->|via Copilot session| F[Work IQ · M365]
  C <-->|read/write| G[MCP Config]
```

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start proxy + Copilot CLI
./start.sh

# 3. Load extension
#    chrome://extensions → Developer mode → Load unpacked → select this directory

# 4. Open sidebar and start chatting!
```

### Prerequisites

- **Node.js** 20+, **Chrome** 90+
- **Copilot CLI** installed & authenticated (`copilot auth login`)
- **az login** completed (for Foundry Agent skills)

---

## 📦 Project Structure

```
├── src/
│   ├── sidebar.*          # Extension UI (HTML/CSS/JS)
│   ├── background.js      # MV3 Service Worker (message routing)
│   ├── content_script.js   # Page context capture
│   ├── proxy.ts           # Local HTTP Proxy (main entry)
│   ├── lib/               # Frontend modules (chat, state, i18n, utils…)
│   │   └── panels/        # UI panel modules (proactive, achievements…)
│   ├── routes/            # Proxy API routes (core, session, foundry, proactive, workiq)
│   ├── shared/            # Shared types & contracts
│   └── scripts/           # Build & dev scripts
├── docs/                  # Full documentation
├── tests/                 # Unit (Vitest) & E2E (Playwright)
├── .github/skills/        # Extensible skill scripts (foundry_agent, gen-img)
├── AGENTS.md              # AI Agent capabilities description
└── plan/                  # Implementation plans & archive
```

---

## 🧪 Development

| Command | Description |
|---------|-------------|
| `./start.sh` | Start proxy + health check |
| `npm run lint` | ESLint |
| `npm run test:unit` | Vitest unit tests |
| `npm test` | Full test suite |
| `npm run build` | Build proxy bundle |
| `npm run build:watch` | Watch mode |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Features & Business Impact](./docs/FEATURES.md) | 功能亮點、三大 IQ 協同、ROI |
| [Demo Script](./docs/DEMO.md) | Demo 腳本與可直接貼上的 Prompt |
| [Architecture](./docs/architecture.md) | 系統架構深入解析（Mermaid 圖表） |
| [CI/CD Flow](./docs/cicd_flow.md) | CI/CD 流程與打包說明 |
| [E2E Testing](./docs/E2E-TESTING.md) | Playwright E2E 測試指南 |
| [Archive](./docs/archive/) | 歷史文件 |

---

## 🛡️ Security & Responsible AI

- **本地優先**：Proxy 僅監聽 localhost，敏感資料不離開使用者電腦
- **最小權限**：Extension 僅請求 `activeTab`、`sidePanel`、`tabs`、`storage`、`alarms`
- **輸入驗證**：所有 Proxy 路由經 Zod schema 驗證 + body size 限制
- **日誌遮罩**：API key / token 等敏感值自動 redact
- **AI 透明度**：所有工具執行狀態即時顯示、token 消耗可追蹤
- **限制聲明**：AI 回應可能不準確，使用者應驗證重要資訊

---

## 📄 License

MIT
