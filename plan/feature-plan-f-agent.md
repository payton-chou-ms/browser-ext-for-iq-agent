# IQ Copilot — Foundry Agent Integration Plan

> **Last Updated:** 2026-02-27
> **Status:** Phase 1-2 ✅ 完成，routes/foundry.ts (91L) 已遷移 TypeScript，基礎 Agent Hub UI 已實作

## 🎯 Vision

**透過 Copilot CLI 作為橋接層，讓 Extension 直接與 Azure AI Foundry Agent 對話。**

使用者在 IQ Copilot Extension 中配置 Foundry Agent（Agent ID + Endpoint），
透過 Copilot CLI 的 `session/create` 搭配 `customAgents` 或直接經由 proxy
呼叫 Foundry Responses API，實現多 Agent 切換對話。

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

## 🏗️ Architecture

### 整體資料流

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

### 🔒 核心原則：所有權限管理都在 Copilot SDK / CLI 內

> **Extension 與 proxy.js 都不處理任何認證或權限。**
> 所有 Azure Entra ID token、GitHub OAuth、Foundry Agent 呼叫權限
> 全部由 Copilot CLI 負責。Extension 只是一個 UI 殼。

#### 策略：100% 透過 Copilot CLI `customAgents` + MCP

```
Extension → proxy.js → CLI session/create {
                          customAgents: [{
                            name: "proactive-assistant",
                            endpoint: "https://...",
                            type: "foundry"
                          }]
                        }
         → CLI session/send "@proactive-assistant 幫我看今天信件"
         → CLI 內部處理認證 + 路由到 Foundry Agent
         → 回傳結果
```

- **優點**：
  - 認證集中在 CLI，Extension 零權限管理
  - 利用 CLI 現有的 OAuth + token refresh 機制
  - 安全性最高：token 不經過 proxy 或 extension
  - 與 Copilot SDK 的 agent 系統原生整合
- **實作方式**：
  - CLI 的 `session/create` 支援 `customAgents` 參數
  - 使用 `@agent-name` 語法在對話中切換 agent
  - CLI 的 `.agent.md` 檔案可定義 Foundry Agent 連線
  - MCP server 可作為 Foundry Agent 的橋接層

---

## 📊 透過 Copilot CLI 呼叫 Foundry Agent 的方式

> ⚠️ Extension 不直接呼叫 Foundry API。所有認證與 Agent 路由由 Copilot CLI 負責。

### 方式 1：CLI `customAgents` 參數（Session 建立時指定）

Extension 在 `session/create` 時告知 CLI 要使用哪些 Foundry Agent：

```json
// Extension → proxy.js → CLI (JSON-RPC)
{
  "jsonrpc": "2.0",
  "method": "session/create",
  "params": {
    "model": "gpt-4.1",
    "customAgents": [
      {
        "name": "proactive-assistant",
        "description": "每日晨報、信件追蹤、會議準備的主動式 AI 助理",
        "endpoint": "https://my-ai.services.ai.azure.com/api/projects/iq-proj/applications/proactive-agent/protocols/openai",
        "type": "foundry"
      },
      {
        "name": "code-reviewer",
        "description": "程式碼審查、安全掃描、最佳實踐建議",
        "endpoint": "https://my-ai.services.ai.azure.com/api/projects/iq-proj/applications/code-reviewer/protocols/openai",
        "type": "foundry"
      }
    ]
  }
}
```

### 方式 2：CLI `.agent.md` 檔案（預先定義 Agent）

在 `~/.copilot/agents/` 建立 Agent 定義檔，CLI 啟動時自動載入：

```yaml
# ~/.copilot/agents/proactive-assistant.agent.md
---
name: proactive-assistant
description: "每日晨報、信件追蹤、會議準備的主動式 AI 助理"
tools:
  - read
  - search
mcp-servers:
  - url: https://my-ai.services.ai.azure.com/...
---
# Proactive Assistant Instructions

你是一個繁體中文的主動式助理...
```

### 方式 3：MCP Server 作為 Foundry Agent 橋接

CLI 透過 MCP server 連接 Foundry Agent，Extension 只需發送訊息：

```json
// Extension → proxy.js → CLI
{
  "jsonrpc": "2.0",
  "method": "session/send",
  "params": {
    "sessionId": "sess_xxx",
    "prompt": "@proactive-assistant 幫我看今天有什麼重要的事"
  }
}
```

CLI 內部處理：`@agent-name` → 路由到對應 Agent → 認證 → 呼叫 → 回傳

### 關鍵設計：Extension 的角色

| 元件 | 職責 | ❌ 不做 |
|------|------|---------|
| **Extension (sidebar.js)** | 純 UI：顯示對話、Agent 卡片、設定表單 | 不處理 token、不直接呼叫 Foundry |
| **proxy.js** | 純轉發：HTTP ↔ TCP 格式轉換 | 不加 Authorization header、不管理認證 |
| **Copilot CLI** | 核心：認證、token 管理、Agent 路由、Foundry 呼叫 | — |

### 重要限制與因應

| 限制 | 說明 | 因應方式 |
|------|------|----------|
| **CLI customAgents 支援程度** | 需確認 CLI 是否完整支援 Foundry Agent 類型 | 先測試，若不支援則用 MCP 橋接 |
| **認證** | 所有認證由 CLI 管理（GitHub OAuth + Azure） | 使用者需先 `copilot auth login` |
| **Stateless** | Foundry App 不儲存歷史 | CLI 或 Extension 維護 history，CLI 每次帶入 |
| **無 streaming** | Foundry Responses API 回傳完整結果 | UI 用 typing 動畫模擬 |

---

## 🖥️ UI 設計

### 1. Agent Panel 改版

目前 Agent Panel 是靜態展示，改版為**可互動的 Agent 管理中心**。

```
┌─────────────────────────────────────────────┐
│  🤖 Agent Hub                     [+ 新增]  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                              │
│  ┌─ 已連接的 Agent ─────────────────────┐   │
│  │                                       │   │
│  │  ┌───────────────────────────────┐   │   │
│  │  │  🟢 Proactive Assistant       │   │   │
│  │  │  foundry-agent-001            │   │   │
│  │  │  每日晨報 · 信件追蹤 · 會議準備  │   │   │
│  │  │  ───────────────────────────  │   │   │
│  │  │  上次呼叫：2 分鐘前             │   │   │
│  │  │  [💬 對話] [⚙️ 設定] [📊 統計]  │   │   │
│  │  └───────────────────────────────┘   │   │
│  │                                       │   │
│  │  ┌───────────────────────────────┐   │   │
│  │  │  🟢 Code Reviewer             │   │   │
│  │  │  foundry-agent-002            │   │   │
│  │  │  程式碼審查 · 安全掃描 · 最佳實踐│   │   │
│  │  │  ───────────────────────────  │   │   │
│  │  │  上次呼叫：1 小時前             │   │   │
│  │  │  [💬 對話] [⚙️ 設定] [📊 統計]  │   │   │
│  │  └───────────────────────────────┘   │   │
│  │                                       │   │
│  └───────────────────────────────────────┘   │
│                                              │
│  ┌─ Agent 總覽 ─────────────────────────┐   │
│  │  已連接：2 / 最大：5                   │   │
│  │  本日呼叫：34 次                       │   │
│  │  平均回應：2.3 秒                      │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 2. Agent 新增/設定 Modal

點擊 [+ 新增] 或 [⚙️ 設定] 開啟：

```
┌─────────────────────────────────────────────┐
│  ⚙️ 設定 Foundry Agent           [✕ 關閉]  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                              │
│  Agent 名稱                                  │
│  ┌─────────────────────────────────────┐    │
│  │ Proactive Assistant                 │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Agent 類型                                  │
│  ○ Project Agent（開發中）                   │
│  ● Agent Application（已發布）               │
│                                              │
│  端點 URL                                    │
│  ┌─────────────────────────────────────┐    │
│  │ https://my-ai.services.ai.azure.   │    │
│  │ com/api/projects/iq-proj/applicatio │    │
│  │ ns/proactive-agent/protocols/openai │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Agent Name / ID                             │
│  ┌─────────────────────────────────────┐    │
│  │ proactive-assistant                 │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  認證方式                                    │
│  ● Azure CLI Token（自動取得）               │
│  ○ 手動輸入 Bearer Token                    │
│  ○ API Key                                  │
│                                              │
│  描述（選填）                                │
│  ┌─────────────────────────────────────┐    │
│  │ 每日晨報、信件追蹤、會議準備、截止日 │    │
│  │ 提醒的主動式 AI 助理               │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  System Message 覆寫（選填）                 │
│  ┌─────────────────────────────────────┐    │
│  │ 你是一個繁體中文的主動式助理...      │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─ 進階設定 ────────────────────────┐      │
│  │  Max tokens: [4096        ]       │      │
│  │  Temperature: [0.7         ]      │      │
│  │  附帶網頁上下文: [✓]              │      │
│  │  附帶 PDF 內容: [✓]               │      │
│  └───────────────────────────────────┘      │
│                                              │
│       [🔍 測試連線]    [💾 儲存設定]         │
└─────────────────────────────────────────────┘
```

### 3. Agent 對話視圖

點擊 Agent 卡片上的 [💬 對話] 進入專屬對話模式：

```
┌─────────────────────────────────────────────┐
│  💬 Proactive Assistant      [← 返回 Hub]   │
│  🟢 已連接 · foundry-agent-001              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                              │
│  ┌─ Agent 能力 ──────────────────────────┐  │
│  │ 📬 每日晨報  ⏰ 截止日  📋 會議準備    │  │
│  │ 📭 未回覆偵測  🔍 跨訊號關聯           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌── 對話區 ─────────────────────────────┐  │
│  │                                        │  │
│  │  🤖 你好！我是 Proactive Assistant。   │  │
│  │     我可以幫你：                       │  │
│  │     • 查看今日晨報摘要                 │  │
│  │     • 檢查未回覆的重要信件             │  │
│  │     • 準備即將到來的會議               │  │
│  │     有什麼我可以幫你的嗎？             │  │
│  │                                        │  │
│  │  👤 幫我看看今天有什麼重要的事         │  │
│  │                                        │  │
│  │  🤖 📊 今日晨報 — 2026/02/27           │  │
│  │                                        │  │
│  │  📬 信件 (3 封需要回覆)               │  │
│  │  ┌─────────────────────────────┐      │  │
│  │  │ 🔴 AUO 問 APIM 進度 (2天前) │      │  │
│  │  │ 🟡 Lulu 問 PERN 編號 (3天前)│      │  │
│  │  │ ⚪ HR 健檢時段確認 (5天前)  │      │  │
│  │  └─────────────────────────────┘      │  │
│  │  [📝 草擬回覆] [📋 全部已讀]          │  │
│  │                                        │  │
│  │  📅 會議 (5 場)                        │  │
│  │  ┌─────────────────────────────┐      │  │
│  │  │ 09:30 AUO 同步會議 ★ 需準備 │      │  │
│  │  │ 11:00 Team Standup           │      │  │
│  │  │ 14:00 APIM 架構討論          │      │  │
│  │  └─────────────────────────────┘      │  │
│  │  [📋 準備 AUO 會議]                   │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌──────────────────────────┐ [📎][🌐][📤] │
│  │ 輸入訊息...              │              │
│  └──────────────────────────┘              │
│  📎 附加網頁上下文  🌐 含當前頁面  📤 送出  │
└─────────────────────────────────────────────┘
```

### 4. Chat Panel 中的 Agent 切換

在主 Chat Panel 中也可切換對話 Agent：

```
┌─────────────────────────────────────────────┐
│  💬 IQ Copilot                              │
│  ┌─ Model / Agent ───────────────────────┐  │
│  │  ▼ [ 🤖 Proactive Assistant        ]  │  │
│  │    ├─ 💬 Copilot CLI (default)        │  │
│  │    ├─ 🤖 Proactive Assistant  🟢      │  │
│  │    ├─ 🤖 Code Reviewer       🟢      │  │
│  │    └─ ＋ 新增 Agent...                │  │
│  └────────────────────────────────────────┘  │
│  ...                                         │
```

### 5. Agent 統計視圖

點擊 [📊 統計] 查看單一 Agent 使用統計：

```
┌─────────────────────────────────────────────┐
│  📊 Proactive Assistant — 統計              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                              │
│  ┌─ 本週使用 ────────────────────────────┐  │
│  │  呼叫次數：47                          │  │
│  │  平均回應：1.8 秒                      │  │
│  │  Token 使用：12,450                    │  │
│  │  成功率：98.2%                         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌─ 功能使用分布 ────────────────────────┐  │
│  │  📬 每日晨報   ████████████░░  68%     │  │
│  │  📭 未回覆偵測 ████████░░░░░░  42%     │  │
│  │  📋 會議準備   ██████░░░░░░░░  31%     │  │
│  │  ⏰ 截止日追蹤 ████░░░░░░░░░░  22%     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌─ 7日趨勢 ─────────────────────────────┐  │
│  │  Mon ██████                            │  │
│  │  Tue ████████                          │  │
│  │  Wed ████████████                      │  │
│  │  Thu █████████                         │  │
│  │  Fri ████████████████                  │  │
│  │  Sat ██                                │  │
│  │  Sun █                                 │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### 1. proxy.js — 不變，維持純 HTTP↔TCP 轉發

> proxy.js **不新增任何 Foundry 路由**。所有 Foundry Agent 呼叫都走
> 現有的 `POST /jsonrpc` → CLI TCP，由 CLI 處理 Agent 路由與認證。

```javascript
// proxy.js 不需要任何修改！
// 所有 Foundry 相關的 JSON-RPC 呼叫都走同一個 /jsonrpc 端點
// Extension → POST /jsonrpc → TCP CLI → CLI 內部路由到 Foundry
```

### 2. copilot-rpc.js 擴展 — Foundry Agent 相關方法

所有方法都透過現有 `rpcCall()` 走 CLI JSON-RPC，不直接呼叫 Foundry：

```javascript
// 新增到 COPILOT_RPC

// 建立含 Foundry Agent 的 Session
async function createAgentSession(config = {}) {
  return await rpcCall("session/create", {
    model: config.model || "gpt-4.1",
    systemMessage: config.systemMessage,
    customAgents: config.customAgents || [],
    // customAgents 範例:
    // [{ name: "proactive-assistant",
    //    endpoint: "https://...",
    //    type: "foundry",
    //    description: "..." }]
    ...config,
  });
}

// 發送訊息到特定 Agent（用 @agent-name 語法）
async function sendToAgent(sessionId, agentName, prompt) {
  const agentPrompt = `@${agentName} ${prompt}`;
  return await rpcCall("session/sendAndWait", {
    sessionId,
    prompt: agentPrompt,
  });
}

// Streaming 版本
function streamToAgent(sessionId, agentName, prompt) {
  const agentPrompt = `@${agentName} ${prompt}`;
  return rpcStream("session/send", {
    sessionId,
    prompt: agentPrompt,
  });
}

// 列出 Session 中可用的 Agent
async function listAgents(sessionId) {
  return await rpcCall("session/listAgents", { sessionId });
}
```

### 3. background.js 新增 Message Handler

```javascript
// background.js handleMessage 新增 case

case "CREATE_AGENT_SESSION":
  // 建立含 Foundry Agent 的 session
  const agentSession = await COPILOT_RPC.createAgentSession(msg.config);
  currentSessionId = agentSession.sessionId || agentSession.id;
  return agentSession;

case "SEND_TO_AGENT":
  // 發送訊息到特定 Agent（透過 CLI @agent-name 路由）
  return await COPILOT_RPC.sendToAgent(
    msg.sessionId,
    msg.agentName,
    msg.prompt
  );

case "LIST_AGENTS":
  // 列出 Session 中可用的 Agent
  return await COPILOT_RPC.listAgents(msg.sessionId);
```

Streaming 版本在 `copilot-stream` port handler 中新增：

```javascript
if (msg.type === "STREAM_AGENT_SEND") {
  const { stream, cancel } = COPILOT_RPC.streamToAgent(
    msg.sessionId,
    msg.agentName,
    msg.prompt
  );
  // ... 與現有 STREAM_SEND 相同的 streaming 邏輯
}
```

```javascript
// 新增 State
let foundryAgents = {};         // { key: { name, endpoint, agentName, ... } }
let activeAgentKey = null;      // 目前對話的 agent key（null = Copilot CLI default）
let agentSessions = {};         // { agentKey: sessionId } — 每個 agent 獨立 CLI session
let agentChatHistories = {};    // { agentKey: [messages] }

// 建立含 Agent 的 Session（透過 CLI customAgents）
async function createAgentSession(agentKey) {
  const agent = foundryAgents[agentKey];
  if (!agent) throw new Error("Agent not found");

  const session = await sendToBackground({
    type: "CREATE_AGENT_SESSION",
    config: {
      model: agent.model || "gpt-4.1",
      systemMessage: agent.systemMessage,
      customAgents: [{
        name: agent.agentName,
        endpoint: agent.endpoint,
        type: "foundry",
        description: agent.description,
      }],
    },
  });

  agentSessions[agentKey] = session.sessionId || session.id;
  return session;
}

// Agent 對話（透過 CLI @agent-name 路由，CLI 處理認證）
async function sendToFoundryAgent(agentKey, userMessage) {
  const agent = foundryAgents[agentKey];
  if (!agent) throw new Error("Agent not found");

  // 如果還沒有 session，建立一個
  if (!agentSessions[agentKey]) {
    await createAgentSession(agentKey);
  }

  // 可選：附加網頁上下文到 prompt
  let prompt = userMessage;
  if (agent.includeContext) {
    const pageInfo = await getPageContext();
    prompt = `[Context: 當前網頁「${pageInfo.title}」- ${pageInfo.url}]\n\n${userMessage}`;
  }

  // 透過 CLI 發送（CLI 負責認證 + Foundry 呼叫）
  const response = await sendToBackground({
    type: "SEND_TO_AGENT",
    sessionId: agentSessions[agentKey],
    agentName: agent.agentName,
    prompt,
  });

  // 儲存到本地歷史（僅 UI 用途）
  if (!agentChatHistories[agentKey]) agentChatHistories[agentKey] = [];
  agentChatHistories[agentKey].push(
    { role: "user", content: userMessage },
    { role: "assistant", content: response.text || response.output_text || response }
  );

  return response;
}
```

### 5. Data Schema — chrome.storage

> 只儲存 UI 設定與本地對話歷史。認證資訊不儲存在 Extension 中。

```json
{
  "foundry_agents": {
    "agent-1": {
      "name": "Proactive Assistant",
      "agentName": "proactive-assistant",
      "endpoint": "https://my-ai.services.ai.azure.com/api/projects/iq-proj/applications/proactive-agent/protocols/openai",
      "description": "每日晨報、信件追蹤、會議準備的主動式 AI 助理",
      "includeContext": true,
      "includePdf": true,
      "systemMessage": "你是一個繁體中文的主動式助理...",
      "icon": "☀️",
      "color": "#f59e0b",
      "createdAt": "2026-02-27T00:00:00Z",
      "stats": {
        "totalCalls": 234,
        "avgResponseMs": 1800,
        "lastCalledAt": "2026-02-27T08:30:00Z"
      }
    },
    "agent-2": {
      "name": "Code Reviewer",
      "agentName": "code-reviewer",
      "endpoint": "https://my-ai.services.ai.azure.com/api/projects/iq-proj/applications/code-reviewer/protocols/openai",
      "description": "程式碼審查、安全掃描、最佳實踐建議",
      "includeContext": true,
      "includePdf": false,
      "icon": "🔍",
      "color": "#8b5cf6",
      "createdAt": "2026-02-27T00:00:00Z",
      "stats": {
        "totalCalls": 87,
        "avgResponseMs": 2300,
        "lastCalledAt": "2026-02-27T07:15:00Z"
      }
    }
  },
  "foundry_chat_histories": {
    "agent-1": [
      { "role": "user", "content": "今天有什麼重要的事？" },
      { "role": "assistant", "content": "📊 今日晨報..." }
    ]
  }
}
```

**⚠️ 注意：不儲存以下內容**
- ❌ `authType` / token / API key — 認證完全由 Copilot CLI 管理
- ❌ `conversationId` — Session 由 CLI 管理，Extension 不需要知道
- ❌ `type: "application"` — Extension 不需區分 Agent 類型，CLI 自行判斷

---

## 🔄 Conversation Flow（對話流程圖）

### 首次設定 Agent

```
User 操作                         系統處理
──────────                        ──────────
1. 點擊 Agent Panel [+ 新增]
                                 → 顯示設定 Modal
2. 填入 Agent 名稱、端點、ID
                                 → 驗證格式
3. 點擊 [🔍 測試連線]
                                 → CLI session/create { customAgents: [...] }
                                 → CLI 嘗試連線 Foundry Agent
                                 → 顯示 🟢 連線成功 / 🔴 失敗
4. 點擊 [💾 儲存]
                                 → chrome.storage.local 儲存
                                 → Agent 卡片出現在 Hub
                                 → Agent 設定存入 chrome.storage
```

### 與 Agent 對話

```
User 操作                         系統處理
──────────                        ──────────
1. 點擊 Agent 卡片 [💬 對話]
                                 → 切換到 Agent Chat 視圖
                                 → 顯示 Agent 歡迎訊息
                                 → 如無 conversation → 自動建立
2. 輸入 "幫我看今天信件"
                                 → (optional) 抓取當前頁面 context
                                 → CLI JSON-RPC: session/sendAndWait
                                 → CLI 透過 @agent-name 路由到 Foundry
                                 → 顯示 typing 動畫...
                                 → 渲染 Agent 回覆（支援 markdown）
3. 繼續對話...
                                 → CLI 管理 session 狀態
                                 → Extension 本地儲存 UI 歷史
```

### Chat Panel 切換 Agent

```
User 操作                         系統處理
──────────                        ──────────
1. 在 Chat Panel 點擊 Agent 選擇器
                                 → 顯示 dropdown:
                                    - Copilot CLI (default)
                                    - Proactive Assistant 🟢
                                    - Code Reviewer 🟢
2. 選擇 "Proactive Assistant"
                                 → activeAgentKey = "agent-1"
                                 → Chat 標題變為 Agent 名稱
                                 → 載入該 Agent 的對話歷史
                                 → 輸入框 placeholder 變更
3. 輸入訊息
                                 → 透過 CLI @agent-name 路由（CLI 處理認證）
```

---

## 🧩 與現有系統整合

### proxy.js 變更

> **❌ proxy.js 不需要任何修改。** 所有 Foundry Agent 呼叫都走現有 `/jsonrpc` 端點。

| 路由 | 說明 |
|------|------|
| `POST /jsonrpc`（不變） | 所有 JSON-RPC 呼叫（含 Agent）都走這裡 |

### copilot-rpc.js 變更

| 新增方法 | 說明 |
|----------|------|
| `createAgentSession(config)` | 建立含 customAgents 的 CLI session |
| `sendToAgent(sessionId, agentName, prompt)` | 透過 @agent-name 語法發送到 Agent |
| `streamToAgent(sessionId, agentName, prompt)` | Streaming 版本 |
| `listAgents(sessionId)` | 列出 session 中可用的 Agent |

### background.js 變更

新增 3 個 message handler：`CREATE_AGENT_SESSION`, `SEND_TO_AGENT`, `LIST_AGENTS`
加上 streaming port handler：`STREAM_AGENT_SEND`

### sidebar.html 變更

| 變更 | 說明 |
|------|------|
| Agent Panel 內容改版 | 從靜態展示 → Agent Hub（卡片 + 新增按鈕） |
| 新增 Agent 設定 Modal | overlay form，含端點、認證、進階設定 |
| 新增 Agent Chat 視圖 | Agent 專屬對話介面，含能力標籤 |
| Chat Panel 加 Agent Selector | dropdown 切換 Copilot CLI / Foundry Agent |
| 新增 Agent Stats 視圖 | 單一 Agent 使用統計（呼叫/回應/token） |

### sidebar.js 變更

| 變更 | 說明 |
|------|------|
| Agent state 管理 | agents, sessions (CLI), histories（本地 UI 用） |
| `sendToFoundryAgent()` | 核心對話函數 |
| `renderAgentHub()` | 渲染 Agent 卡片列表 |
| `openAgentConfig(key?)` | 開啟設定 Modal |
| `switchToAgentChat(key)` | 切換到 Agent 對話視圖 |
| Agent selector in chat | 切換對話目標 |
| Markdown 渲染增強 | Agent 回覆的結構化卡片（信件列表、會議列表）|

### sidebar.css 變更

| 新增樣式 | 說明 |
|----------|------|
| `.agent-card` | Agent 卡片（含 status dot、icon、actions） |
| `.agent-modal` | 設定 Modal（overlay + form） |
| `.agent-chat-view` | Agent 專屬對話介面 |
| `.agent-selector` | Chat 中的 Agent dropdown |
| `.agent-capability-tags` | Agent 能力標籤 |
| `.agent-stats` | Agent 統計面板 |
| `.insight-card` | 結構化回覆卡片（信件/會議/deadline） |

---

## 🔐 安全考量

| 風險 | 因應措施 |
|------|----------|
| **Token/認證** | ✅ 全部由 Copilot CLI 管理，Extension 與 proxy.js 零接觸 token |
| **端點安全** | Extension 只存 Agent 顯示名稱 + 端點 URL（傳給 CLI 的 customAgents） |
| **對話歷史** | 本地 history 存在 chrome.storage.local（僅 UI 用途），不含 token |
| **XSS 攻擊** | Agent 回覆渲染時需 sanitize HTML/Markdown |
| **認證失敗** | CLI 認證失敗時回傳錯誤，Extension 顯示「請先執行 copilot auth login」 |
| **最小權限** | Extension 不需要 Azure 相關權限，只需 sidePanel + tabs + storage |

---

## 📅 Implementation Phases

### Phase 1 — CLI Agent 整合 + 基礎對話 (Week 1) ✅ DONE
- [x] `routes/foundry.ts` 實作 Foundry Agent API (91L strict TS)
- [x] copilot-rpc.js 新增 createAgentSession / sendToAgent / streamToAgent / listAgents
- [x] background.js 新增 CREATE_AGENT_SESSION / SEND_TO_AGENT / LIST_AGENTS handlers
- [x] background.js streaming port 新增 STREAM_AGENT_SEND
- [x] 端到端測試：Extension → proxy → CLI (customAgents) → Foundry → 回覆
- [x] 驗證 CLI customAgents 參數格式與 Foundry Agent 路由

### Phase 2 — Agent UI (Week 2) ✅ DONE
- [x] Agent Hub Panel（卡片列表 + 新增按鈕）
- [x] Agent 設定 Modal（表單 + 測試連線）
- [x] Agent Chat 視圖（專屬對話介面）
- [x] Chat Panel Agent Selector（dropdown 切換）
- [x] 新增 CSS 樣式（卡片、Modal、Chat、Tags）

### Phase 3 — Conversation 管理 (Week 3) 🔶 進行中
- [x] Stateless 模式：client-side history 管理
- [x] 網頁上下文注入（附帶當前頁面資訊）
- [ ] PDF 內容注入
- [x] 對話歷史持久化（chrome.storage）
- [ ] 對話匯出（Markdown / JSON）

### Phase 4 — 統計 + 整合 (Week 4) 🔶 進行中
- [ ] Agent 統計面板（呼叫、token、回應時間）
- [ ] 結構化回覆渲染（信件卡片、會議卡片、deadline 卡片）
- [x] 成就系統串接（agent_call 事件 → XP）
- [x] CLI 認證錯誤處理（提示使用者 copilot auth login）
- [ ] 多 Agent 並行對話支援

---

## 🧪 測試計畫

### 手動測試 Checklist

```
□ proxy.js 啟動後 /jsonrpc 正常轉發（不需修改 proxy）
□ CLI session/create 含 customAgents 成功建立 session
□ CLI session/send "@agent-name msg" 成功路由到 Foundry Agent
□ CLI 認證失敗時回傳明確錯誤訊息
□ 透過 @agent-name 語法取得 Foundry Agent 回覆
□ Extension Agent Hub 顯示已設定的 Agent 卡片
□ Agent 設定 Modal 正確填入/儲存/讀取
□ 測試連線按鈕正確顯示成功/失敗
□ Agent Chat 視圖正確渲染對話
□ Stateless 模式下對話歷史正確帶入
□ 網頁上下文正確附加到 input
□ Chat Panel Agent Selector 切換正常
□ Agent 統計正確更新
□ Token 過期後自動 refresh
□ 斷網/Agent 離線時的錯誤提示
```

### curl 測試範例

```bash
# 建立含 Foundry Agent 的 CLI Session（透過現有 /jsonrpc）
curl -X POST http://127.0.0.1:8321/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "session/create",
    "params": {
      "model": "gpt-4.1",
      "customAgents": [{
        "name": "proactive-assistant",
        "endpoint": "https://my-ai.services.ai.azure.com/api/projects/iq-proj/applications/proactive-agent/protocols/openai",
        "type": "foundry"
      }]
    }
  }'

# 發送訊息到 Agent（CLI 處理認證 + 路由）
curl -X POST http://127.0.0.1:8321/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "session/sendAndWait",
    "params": {
      "sessionId": "sess_xxx",
      "prompt": "@proactive-assistant 今天有什麼重要的事？"
    }
  }'

# Ping 測試（驗證 CLI 連線）
curl -X POST http://127.0.0.1:8321/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"ping","params":{"message":"test"}}'
```

---

## 💡 延伸 Ideas

1. **Agent Marketplace** — 預設 Agent 模板庫（IT 支援、業務分析、HR 助理...），一鍵匯入
2. **Agent-to-Agent** — 利用 A2A protocol，讓 Proactive Agent 呼叫 Code Reviewer
3. **Voice Input** — 語音輸入到 Agent，適合會議中快速查詢
4. **Webhook Push** — Agent 主動推送通知到 Extension（透過 Service Worker push）
5. **Agent 模板分享** — 匯出 Agent 設定為 JSON，團隊成員一鍵匯入
6. **Context-Aware Routing** — 根據當前網頁自動選擇最適合的 Agent（如 GitHub → Code Reviewer）

---

*Last updated: 2026-02-27*
*Part of IQ Copilot Extension v3.x roadmap*
