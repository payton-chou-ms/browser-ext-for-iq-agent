# IQ Copilot — Foundry Agent Integration

> **Last Updated:** 2026-02-27
> **Status:** Phase 1-2 ✅ 完成，基礎 Agent Hub UI 已實作

---

## 📝 Summary

IQ Copilot Extension 現在支援整合 Azure AI Foundry Agent，讓使用者可以：

- **在瀏覽器 sidebar 中直接與企業 AI Agent 對話**
- **切換多個不同領域的 Agent**（如 IT 支援、程式碼審查、業務分析）
- **自動附帶當前網頁/PDF 內容作為對話上下文**
- **追蹤 Agent 使用統計**（呼叫次數、回應時間、Token 使用）

所有認證與安全管理由 Copilot CLI 處理，Extension 本身不接觸任何 token 或密碼。

---

## 📑 Table of Contents

1. [Summary](#-summary)
2. [Vision](#-vision)
3. [Business Impact](#-business-impact)
4. [Key Features](#-key-features)
5. [UI Overview](#-ui-overview)
6. [How To Use](#-how-to-use)
7. [Implementation Status](#-implementation-status)
8. [Future Work](#-future-work)
9. [Appendix](#-appendix)
   - [A. Architecture](#appendix-a-architecture)
   - [B. Technical Design](#appendix-b-technical-design)
   - [C. Data Schema](#appendix-c-data-schema)
   - [D. Security](#appendix-d-security)
   - [E. Test Plan](#appendix-e-test-plan)

---

## 🎯 Vision

**透過 Copilot CLI 作為橋接層，讓 Extension 直接與 Azure AI Foundry Agent 對話。**

使用者在 IQ Copilot Extension 中配置 Foundry Agent（Agent ID + Endpoint），
即可在日常瀏覽器工作流中與企業 AI Agent 互動，實現多 Agent 切換對話。

---

## 💎 Business Impact

| 影響面 | 說明 |
|--------|------|
| **企業 AI 落地** | 讓 Foundry Agent 不只在 Portal 裡跑，直接嵌入員工日常瀏覽器工作流 |
| **上下文串接** | Agent 可同時看到當前網頁/PDF + 使用者歷史，回答更精準 |
| **多 Agent 協作** | 不同 Agent 負責不同領域（如 IT 支援 vs 業務分析），一個 sidebar 搞定 |
| **Demo 價值** | Extension + Foundry Agent = 可立即展示的 AI 助理產品原型 |
| **安全合規** | 透過 Azure Entra ID 認證，資料不離開企業邊界 |

---

## ✨ Key Features

### 對使用者

| 功能 | 說明 |
|------|------|
| **Agent Hub** | 集中管理所有已連接的 Foundry Agent |
| **一鍵新增 Agent** | 填入端點 URL + Agent Name 即可連接 |
| **測試連線** | 新增前可先測試 Agent 是否正常回應 |
| **多 Agent 切換** | 在 Chat Panel 快速切換不同 Agent |
| **附帶網頁上下文** | 對話時自動包含當前網頁標題/URL |
| **對話歷史** | 每個 Agent 獨立保存對話記錄 |
| **使用統計** | 查看呼叫次數、平均回應時間、Token 使用 |

### 技術亮點

| 特點 | 說明 |
|------|------|
| **零認證管理** | Extension 不處理 token，全由 Copilot CLI 管理 |
| **無需修改 proxy** | 所有 Agent 呼叫走現有 JSON-RPC 通道 |
| **Stateless 設計** | 對話歷史在 client 端管理，Foundry Agent 無狀態 |
| **成就系統整合** | Agent 呼叫可獲得 XP |

---

## 🖥️ UI Overview

### Agent Hub Panel

Agent 管理中心，顯示已連接的 Agent 卡片：

- 每張卡片顯示：Agent 名稱、描述、連線狀態、上次呼叫時間
- 操作按鈕：[💬 對話] [⚙️ 設定] [📊 統計]
- 右上角 [+ 新增] 按鈕新增 Agent
- 底部顯示總覽統計（已連接數、本日呼叫、平均回應）

### Agent 設定 Modal

新增/編輯 Agent 的表單：

- Agent 名稱、類型（Project / Application）
- 端點 URL、Agent Name / ID
- 認證方式（Azure CLI Token 自動取得）
- 描述、System Message 覆寫
- 進階設定：Max tokens、Temperature、是否附帶網頁/PDF 上下文
- [🔍 測試連線] 與 [💾 儲存設定] 按鈕

### Agent 對話視圖

專屬對話介面：

- 顯示 Agent 能力標籤（如：每日晨報、截止日、會議準備）
- 對話區支援 Markdown 渲染
- 結構化卡片回覆（信件列表、會議列表）
- 輸入框含 [📎 附加上下文] [🌐 當前頁面] [📤 送出]

### Chat Panel Agent Selector

在主 Chat Panel 中切換對話目標：

- Dropdown 選單列出：Copilot CLI (default) + 所有已連接 Agent
- 切換後自動載入該 Agent 的對話歷史

---

## 📖 How To Use

### 前置需求

1. 確保 Copilot CLI 已安裝並執行 `copilot auth login`
2. 取得 Foundry Agent 的端點 URL 與 Agent Name

### 新增 Agent

1. 點擊 Agent Panel 的 [+ 新增]
2. 填入 Agent 名稱、端點 URL、Agent Name
3. 點擊 [🔍 測試連線] 確認連線成功
4. 點擊 [💾 儲存設定]

### 與 Agent 對話

1. 在 Agent Hub 點擊 Agent 卡片的 [💬 對話]
2. 或在 Chat Panel 使用 Agent Selector 切換
3. 輸入訊息，Agent 會回覆

### 附帶上下文

- 勾選 Agent 設定中的「附帶網頁上下文」
- 對話時會自動包含當前頁面標題與 URL

---

## 📅 Implementation Status

| Phase | 內容 | 狀態 |
|-------|------|------|
| **Phase 1** | CLI Agent 整合 + 基礎對話 | ✅ DONE |
| **Phase 2** | Agent Hub UI + 設定 Modal + Chat 視圖 | ✅ DONE |
| **Phase 3** | Conversation 管理（歷史、上下文注入） | 🔶 進行中（缺 PDF 注入、對話匯出） |
| **Phase 4** | 統計面板 + 結構化回覆 + 多 Agent 並行 | 🔶 進行中 |

---

## 🔮 Future Work

| 功能 | 說明 | 重要性 |
|------|------|--------|
| **PDF 內容注入** | 對話時附帶當前 PDF 內容 | ⭐⭐⭐ 高優先 |
| **對話匯出** | 匯出對話為 Markdown / JSON | ⭐⭐ 中優先 |
| **Agent 統計面板** | 呼叫次數、Token 使用、回應時間圖表 | ⭐⭐ 中優先 |
| **結構化回覆卡片** | 信件卡片、會議卡片、deadline 卡片 | ⭐⭐ 中優先 |
| **多 Agent 並行對話** | 同時與多個 Agent 對話 | ⭐ 低優先 |
| **Agent Marketplace** | 預設 Agent 模板庫，一鍵匯入 | ⭐⭐⭐ 高優先 — Demo 價值高 |
| **Agent-to-Agent (A2A)** | 讓 Agent 呼叫其他 Agent | ⭐ 低優先 |
| **Voice Input** | 語音輸入到 Agent | ⭐ 低優先 |
| **Webhook Push** | Agent 主動推送通知 | ⭐ 低優先 |
| **Agent 模板分享** | 匯出 Agent 設定 JSON，團隊共用 | ⭐⭐ 中優先 |
| **Context-Aware Routing** | 根據當前網頁自動選擇 Agent | ⭐⭐⭐ 高優先 — 智慧化體驗 |

---

## 📎 Appendix

### Appendix A: Architecture

#### 整體資料流

```
┌─────────────┐   HTTP/JSON    ┌──────────┐    TCP/LSP     ┌───────────┐
│  Extension  │ ─────────────→ │  proxy.js │ ────────────→ │ Copilot   │
│  sidebar.js │               │  :8321    │               │ CLI :4321 │
└─────────────┘               └──────────┘               └─────┬─────┘
  (純 UI 層)                   (純轉發層)                       │
  不處理任何認證               不處理任何認證                    │ Copilot CLI 負責：
  不直接呼叫 Foundry           不直接呼叫 Foundry               │ ✅ 認證 (GitHub OAuth)
                                                                │ ✅ Token 管理
                                                                │ ✅ Agent 路由
                                                                │ ✅ Foundry 呼叫
                                                                ▼
                                                          ┌──────────┐
                                                          │ Foundry  │
                                                          │ Agent    │
                                                          │ Service  │
                                                          └──────────┘
```

#### 核心原則

> **Extension 與 proxy.js 都不處理任何認證或權限。**

所有 Azure Entra ID token、GitHub OAuth、Foundry Agent 呼叫權限全部由 Copilot CLI 負責。Extension 只是一個 UI 殼。

#### 呼叫策略

透過 Copilot CLI `customAgents` + `@agent-name` 語法：

1. Extension 在 `session/create` 時傳入 `customAgents` 參數
2. 對話時使用 `@agent-name` 語法切換 Agent
3. CLI 內部處理認證 + 路由到 Foundry Agent

#### 元件職責

| 元件 | 職責 | 不做 |
|------|------|------|
| **Extension** | 純 UI：顯示對話、Agent 卡片、設定表單 | 不處理 token、不直接呼叫 Foundry |
| **proxy.js** | 純轉發：HTTP ↔ TCP 格式轉換 | 不加 Authorization header、不管理認證 |
| **Copilot CLI** | 核心：認證、token 管理、Agent 路由、Foundry 呼叫 | — |

#### 技術限制與因應

| 限制 | 因應方式 |
|------|----------|
| CLI customAgents 支援程度 | 先測試，若不支援則用 MCP 橋接 |
| 認證由 CLI 管理 | 使用者需先 `copilot auth login` |
| Foundry Agent Stateless | Extension 本地維護 history |
| 無 streaming | UI 用 typing 動畫模擬 |

---

### Appendix B: Technical Design

#### copilot-rpc.js 新增方法

| 方法 | 說明 |
|------|------|
| `createAgentSession(config)` | 建立含 customAgents 的 CLI session |
| `sendToAgent(sessionId, agentName, prompt)` | 透過 @agent-name 語法發送到 Agent |
| `streamToAgent(sessionId, agentName, prompt)` | Streaming 版本 |
| `listAgents(sessionId)` | 列出 session 中可用的 Agent |

#### background.js 新增 Handler

| Handler | 說明 |
|---------|------|
| `CREATE_AGENT_SESSION` | 建立含 Foundry Agent 的 session |
| `SEND_TO_AGENT` | 發送訊息到特定 Agent |
| `LIST_AGENTS` | 列出可用 Agent |
| `STREAM_AGENT_SEND` | Streaming 發送 |

#### sidebar 檔案變更

| 檔案 | 變更 |
|------|------|
| sidebar.html | Agent Hub、設定 Modal、Agent Chat 視圖、Agent Selector |
| sidebar.js | Agent state 管理、sendToFoundryAgent()、renderAgentHub() 等函數 |
| sidebar.css | .agent-card、.agent-modal、.agent-chat-view、.agent-selector 等樣式 |

#### 對話流程

**首次設定 Agent：**
1. 使用者點擊 [+ 新增]
2. 填入端點、Agent Name
3. 點擊測試連線 → CLI 建立 session 嘗試連線
4. 儲存到 chrome.storage

**與 Agent 對話：**
1. 使用者輸入訊息
2. Extension 附加網頁上下文（可選）
3. 透過 CLI JSON-RPC session/send 發送
4. CLI 透過 @agent-name 路由到 Foundry
5. 渲染回覆（支援 Markdown）

---

### Appendix C: Data Schema

#### chrome.storage 結構

儲存於 `chrome.storage.local`，僅包含 UI 設定與本地歷史：

| Key | 內容 |
|-----|------|
| `foundry_agents` | Agent 設定（name、endpoint、description、icon、color、stats） |
| `foundry_chat_histories` | 各 Agent 的對話歷史陣列 |

**不儲存：**
- Token / API Key（認證由 CLI 管理）
- conversationId（Session 由 CLI 管理）
- Agent type（CLI 自行判斷）

---

### Appendix D: Security

| 風險 | 因應措施 |
|------|----------|
| Token/認證 | 全部由 Copilot CLI 管理，Extension 與 proxy.js 零接觸 token |
| 端點安全 | Extension 只存 Agent 顯示名稱 + 端點 URL |
| 對話歷史 | 本地 chrome.storage.local，僅 UI 用途，不含 token |
| XSS 攻擊 | Agent 回覆渲染時 sanitize HTML/Markdown |
| 認證失敗 | Extension 顯示「請先執行 copilot auth login」 |
| 最小權限 | Extension 只需 sidePanel + tabs + storage 權限 |

---

### Appendix E: Test Plan

#### 手動測試 Checklist

- [ ] CLI session/create 含 customAgents 成功建立 session
- [ ] CLI session/send "@agent-name msg" 成功路由到 Foundry Agent
- [ ] CLI 認證失敗時回傳明確錯誤訊息
- [ ] Extension Agent Hub 顯示已設定的 Agent 卡片
- [ ] Agent 設定 Modal 正確填入/儲存/讀取
- [ ] 測試連線按鈕正確顯示成功/失敗
- [ ] Agent Chat 視圖正確渲染對話
- [ ] 網頁上下文正確附加到 input
- [ ] Chat Panel Agent Selector 切換正常
- [ ] 斷網/Agent 離線時的錯誤提示

---

*Last updated: 2026-02-27*
*Part of IQ Copilot Extension v3.x roadmap*
