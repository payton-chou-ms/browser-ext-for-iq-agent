# Multi-Tab Chat Feature

> Last Updated: 2026-02-28  
> Status: In Progress

## 概述

類似 Copilot CLI 可以開啟多個 terminal 同時問答，Browser Extension 支援多個 Chat Tab 同時進行對話。

## 設計規格

| 規格 | 說明 |
|------|------|
| 最大 Tab 數 | 10 個 |
| 關閉方式 | 手動點擊 ✕ |
| 持久化 | 儲存到 `chrome.storage.local` |
| Session 管理 | 每個 Tab 獨立 sessionId |

## UI 設計

```
┌─────────────────────────────────────────────────────┐
│ [Chat 1 ✕] [Chat 2 4.1 🔄✕] [Chat 3 claude ✕] [+]  │
│      ↑          ↑    ↑                    ↑         │
│    idle      model  running              新增       │
├─────────────────────────────────────────────────────┤
│ Active chat content...                              │
└─────────────────────────────────────────────────────┘
```

### Tab 狀態指示

- **idle**: 無特殊圖示，可安全關閉
- **running**: 🔄 旋轉動畫，關閉需確認
- **error**: ⚠ 警告圖示
- **model badge**: 顯示當前 tab 使用的 model (簡稱)

## 狀態結構

```typescript
interface ChatTab {
  id: string;                    // tab-{timestamp}
  sessionId: string | null;      // Copilot SDK session ID
  title: string;                 // 自動從第一則訊息擷取
  status: 'idle' | 'running' | 'error';
  model: string | null;          // Per-tab model selection (null = inherit global)
  enabledSkills: string[] | null; // Per-tab skill filter (null = all skills)
  chatHistory: ChatMessage[];
  toolCalls: ToolCall[];
  tokenDetails: TokenDetails;
  createdAt: string;
  lastActiveAt: string;
}

interface ChatTabsState {
  tabs: ChatTab[];               // max 10
  activeTabId: string | null;
}

interface ChatMessage {
  role: 'user' | 'bot' | 'system';
  content: string;
  timestamp?: string;
}

interface ToolCall {
  name: string;
  status: 'running' | 'success' | 'error';
  args: unknown;
  result: unknown;
  startedAt: number;
  endedAt: number | null;
}

interface TokenDetails {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  apiCalls: number;
}
```

## 操作流程

### 新增 Tab

```javascript
function createTab() {
  if (tabs.length >= MAX_TABS) {
    showToast('已達最大對話數量 (10)');
    return;
  }
  
  const newTab = {
    id: `tab-${Date.now()}`,
    sessionId: null,  // 首次發訊息時建立
    title: '新對話',
    status: 'idle',
    chatHistory: [],
    toolCalls: [],
    tokenDetails: { inputTokens: 0, outputTokens: 0, ... },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  
  tabs.push(newTab);
  activeTabId = newTab.id;
  renderTabs();
  renderChat();
}
```

### 關閉 Tab

```javascript
async function closeTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  
  // 1. 如果 session 正在運行，先確認
  if (tab.status === 'running') {
    if (!confirm('對話進行中，確定關閉？')) return;
  }
  
  // 2. 銷毀 server session
  if (tab.sessionId) {
    await destroySession(tab.sessionId);
  }
  
  // 3. 移除 tab
  tabs = tabs.filter(t => t.id !== tabId);
  
  // 4. 切換到相鄰 tab 或創建新的
  if (tabs.length === 0) {
    createTab();
  } else if (activeTabId === tabId) {
    activeTabId = tabs[tabs.length - 1].id;
  }
  
  saveTabs();
  renderTabs();
  renderChat();
}
```

### 切換 Tab

```javascript
function switchTab(tabId) {
  if (activeTabId === tabId) return;
  
  activeTabId = tabId;
  getActiveTab().lastActiveAt = new Date().toISOString();
  
  saveTabs();
  renderTabs();
  renderChat();
  renderTasksPanel();  // 更新 tasks 顯示
}
```

## 檔案變更清單

| 檔案 | 變更類型 | 說明 |
|------|----------|------|
| `lib/chat-tabs.js` | **新增** | Tab 管理核心邏輯 |
| `lib/chat.js` | 修改 | 改用 `ChatTabsState`，移除單一 session 邏輯 |
| `sidebar.html` | 修改 | 新增 tab bar HTML |
| `sidebar.css` | 修改 | Tab bar 樣式 |
| `sidebar.js` | 修改 | 綁定 tab 事件 |
| `lib/panels/tasks.js` | 修改 | 支援顯示當前 tab 的 toolCalls |
| `lib/chat-streaming.js` | 修改 | 使用 tab-specific state |

## 實作階段

### Phase 1: Core Logic
- [x] 設計文件
- [x] `chat-tabs.js` 核心邏輯
- [x] 狀態管理與持久化

### Phase 2: UI
- [x] Tab bar HTML 結構
- [x] Tab bar CSS 樣式
- [x] 點擊/關閉/新增事件

### Phase 3: Integration
- [x] `chat.js` 改用多 tab 狀態
- [x] `chat-streaming.js` 整合 (via chat.js sync helpers)
- [x] `tasks.js` 顯示當前 tab 的 toolCalls
- [ ] History 面板整合

### Phase 4: Per-Tab Model & Skills
- [x] ChatTab 增加 `model` 和 `enabledSkills` 欄位
- [x] Tab 切換時同步 model 到 CHAT 模組
- [x] 切換 model 時自動儲存到 active tab
- [x] Tab 上顯示 model badge
- [x] 新 tab 繼承當前 model
- [ ] Skills 面板整合 (per-tab filter)

## 持久化策略

```javascript
const STORAGE_KEY = 'iq_chat_tabs';

async function saveTabs() {
  const data = {
    tabs: tabs.map(t => ({
      ...t,
      // 限制 chatHistory 數量避免超過 storage 限制
      chatHistory: t.chatHistory.slice(-100),
    })),
    activeTabId,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function loadTabs() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  if (data[STORAGE_KEY]) {
    tabs = data[STORAGE_KEY].tabs || [];
    activeTabId = data[STORAGE_KEY].activeTabId;
  }
  if (tabs.length === 0) {
    createTab();  // 確保至少有一個 tab
  }
}
```

## 與現有功能整合

### Tasks Panel
- 顯示 **當前活躍 Tab** 的 toolCalls
- Tab bar 上的 🔄 指示器同步 running 狀態

### History Panel
- 保持原有功能：列出所有已儲存的 sessions
- 點擊 history item 會在 **新 tab** 中恢復

### Usage Panel
- 可顯示 **所有 tabs** 的累計 token 使用量
- 或切換顯示 **當前 tab** 的使用量

## 測試要點

1. 建立 10 個 tabs，第 11 個應顯示錯誤
2. 關閉正在運行的 tab，應顯示確認對話框
3. 刷新頁面後，tabs 應正確恢復
4. 切換 tab 後，chat 內容應正確顯示
5. 多個 tab 同時發送訊息，應獨立運行

## 參考

- [chat.js](../lib/chat.js): 現有單一 session 實作
- [session.ts](../routes/session.ts): Server 端已支援多 session
- [tasks.js](../lib/panels/tasks.js): toolCalls 顯示邏輯
