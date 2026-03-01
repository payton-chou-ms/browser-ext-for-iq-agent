# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-03-01

---

## 優化總覽

| 階段 | 目標 | 狀態 |
|------|------|------|
| Phase 1 — 穩定性 | 消除 idle 請求風暴（P0-2） | ✅ 已實作，待驗收 |
| Phase 2 — Quick Wins | P2-7 ~ P2-12 短期優化 | ✅ 全部已實作 |
| Phase 3 — Mid-term | P2-13 + P3-11 中期優化 | 🔲 待實作 |
| Phase 4 — Long-term | P3-6 ~ P3-13 長期架構改善 | 🔲 待排程 |

---

## ✅ 已完成項目

### P0-2：Idle 請求風暴修復（`background.js`）

**症狀**：proxy log 顯示每 ~60 秒出現一批 6 個請求（`models/session/tools/quota/context/scan-all`）

**根本原因**：
1. Service Worker 在 MV3 中被週期性 kill/restart
2. 重啟後 `_lastBroadcastState` 從 session storage **異步**恢復
3. alarm handler 可能在恢復完成**之前**觸發
4. 此時 `_lastBroadcastState` 仍為初始值 `"disconnected"`
5. 連線檢查成功 → `connectionState = "connected"`
6. `broadcastState()` 比較 `"connected" !== "disconnected"` → **誤判為狀態改變**
7. 發送 `CONNECTION_STATE_CHANGED` → sidebar 執行完整 init storm

**實作（`src/background.js`）**：
- `_stateRestoreComplete` flag：追蹤異步恢復是否完成
- `broadcastState()` guard：恢復未完成時直接 return，防止誤判
- `chrome.alarms.onAlarm` handler：同樣檢查 `_stateRestoreComplete`
- async IIFE + `try/finally`：確保 flag 一定被設為 `true`
- `_lastBroadcastState` 同步至 `connectionState`：重啟後防止 false transition

**驗收標準**（待完成）：
- [ ] Idle 10 分鐘內不再出現每分鐘 `models/session/tools/quota/context/scan-all` 批次請求
- [ ] sidepanel 重新開關不會觸發完整 init storm
- [ ] proxy log 確認只有 `/health` 週期性呼叫（5 min 間隔）

---

### P2-7：Minimal DOM Updates（`src/lib/utils.js`）

**問題**：每次狀態更新都呼叫 `innerHTML =`，導致全量重繪（forced reflow）

**實作**：
```javascript
// 只在內容實際改變時才更新 DOM
updateText(el, text)     // textContent diff
updateHTML(el, html)     // innerHTML diff
patchList(container, items, getKey, renderItem, options)  // key-based list patch
```

- `updateText` / `updateHTML`：比對前後值，無變化時跳過
- `patchList`：依 `data-patch-key` 比對，只新增/移除/重排有差異的節點

---

### P2-8：Unified Cache Invalidation Policy（`src/lib/utils.js`）

**問題**：cache 失效規則散落各處，容易遺漏或過度失效

**實作**：
```javascript
// 集中化失效策略表
const CACHE_INVALIDATION_POLICY = {
  "session-create":  ["sessions"],
  "session-delete":  ["sessions"],
  "model-switch":    ["sessions"],
  "quota-update":    ["quota"],
  "tools-refresh":   ["tools"],
  "context-refresh": ["context", "models", "tools", "quota", "sessions"],
  "disconnect":      null,  // null = 全部失效
};

triggerCachePolicy("session-create");  // 統一入口
onCacheInvalidate("tools", (key, reason) => { /* 重新載入 */ });
```

---

### P2-9：Immutable State Helpers（`src/lib/utils.js`）

**問題**：部分 state mutation 直接修改物件，難以追蹤狀態變化

**實作**：
```javascript
immutableSet(obj, "a.b.c", value)       // 深層不可變更新
immutableMerge(obj, updates)             // shallow merge
immutablePush(arr, item, maxSize)        // 限長不可變 push
immutableRemove(arr, predicate)          // filter 不可變移除
immutableUpdateItem(arr, predicate, fn)  // map 不可變更新
```

---

### P2-10：Batched Storage Writes（`src/lib/utils.js`、`src/lib/state.js`）

**問題**：高頻狀態更新（如 streaming）導致每次都呼叫 `chrome.storage.local.set`，增加 I/O 壓力

**實作**：
```javascript
// 多個 key 的寫入在 500ms 視窗內合併為單次 set
batchStorageWrite("iq_settings", data);   // 排入佇列
flushStorageNow();                         // 頁面卸載前強制 flush

// CONFIG 中統一管理延遲
STORAGE_BATCH_DELAY_MS: 500
```

---

### P2-11：Chat Tabs Storage Debounce（`src/lib/chat-tabs.js`）

**問題**：streaming 期間每個 delta 都觸發 `saveTabs()`，每秒數十次 storage write

**實作**：
```javascript
let _saveTimeout = null;
const SAVE_DEBOUNCE_MS = 500;

function scheduleSave() {
  if (_saveTimeout) clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(() => {
    _saveTimeout = null;
    saveTabs();
  }, SAVE_DEBOUNCE_MS);
}

// updateTab() 與 switchTab() 呼叫 scheduleSave()（非即時寫入）
// createTab() 與 closeTab() 仍呼叫 saveTabs()（結構性變更，需立即持久化）
```

**效果**：streaming 期間 storage writes 減少約 80%

---

### P2-12：Streaming DOM Batched Render（`src/lib/chat-streaming.js`）

**問題**：每個 `message_delta` 事件都執行 `bubble.innerHTML = formatText(content)`，造成每秒數十次 forced reflow

**實作**：
```javascript
function scheduleRender() {
  if (pendingRender) return;
  pendingRender = requestAnimationFrame(() => {
    pendingRender = null;
    if (bubble) {
      bubble.innerHTML = formatText(content);
      utils.scrollToBottom?.();
    }
  });
}

// delta → scheduleRender()（rAF 批次，跳過重複幀）
// final message → 立即渲染（確保完整內容顯示）
```

**效果**：reflow 次數降至 ≤60 次/秒（螢幕刷新率上限）

---

## 🔲 Phase 3 — 待實作（Mid-term，3-5 天）

### P2-13：formatText 移至 Web Worker（`src/lib/utils.js`）

**問題**：`formatText()` 含完整 Markdown/code 解析邏輯，在主線程執行會造成 UI Jank（長文字尤其明顯）

**方案**：
```javascript
// worker.js
self.onmessage = ({ data: { id, text } }) => {
  const html = formatText(text);
  self.postMessage({ id, html });
};

// 主線程
const worker = new Worker("format-worker.js");
worker.postMessage({ id: msgId, text: content });
worker.onmessage = ({ data: { id, html } }) => {
  if (id === currentMsgId) bubble.innerHTML = html;
};
```

**影響範圍**：`src/lib/utils.js`、`src/lib/chat-streaming.js`、需新增 `src/format-worker.js`
**注意**：Web Worker 無法存取 DOM，`escapeHtml` 需改用 `String.replace` 版本

---

### P3-11：Skills Cache TTL 延長至 30 分鐘（`src/lib/state.js`）

**問題**：Skills/tools 幾乎不會變動，但目前 TTL 僅 5 分鐘，導致頻繁 API calls

**現狀（`state.js`）**：
```javascript
CACHE_TTL_TOOLS_MS: 5 * 60_000,  // 5 min
```

**方案**：
```javascript
CACHE_TTL_TOOLS_MS: 30 * 60_000,  // 30 min — skills 幾乎不變
```

**影響範圍**：`src/lib/state.js` 一行修改
**注意**：新增「手動重新整理 Skills」按鈕，供使用者需要時強制 reload

---

## 🔲 Phase 4 — 待排程（Long-term）

### P3-6：RPC Transport 請求合批

**問題**：sidebar init 時發出 6 個獨立 HTTP 請求（`models/session/tools/quota/context/scan-all`）

**方案**：proxy 新增 `/batch` endpoint，接收多個請求描述符並平行執行
```typescript
POST /batch
[
  { id: "models", path: "/models" },
  { id: "quota",  path: "/quota" },
  { id: "tools",  path: "/tools?model=..." }
]
```

**影響範圍**：`src/proxy.ts`、`src/routes/`、`src/copilot-rpc.js`

---

### P3-7：首屏啟動 Lazy Init

**問題**：sidebar 開啟時同步初始化所有 panel（proactive、achievements、MCP 等），造成 TTI 增加

**方案**：
- 只初始化當前可見 panel
- 其他 panel 在首次切換時才 init（`IntersectionObserver` 或 tab click 觸發）

**影響範圍**：`src/sidebar.js` panel 初始化邏輯

---

### P3-8：Tab Lazy Loading（非活躍 Tab）

**問題**：10 個 tab × 100 條訊息 = 1000 條訊息常駐記憶體

**方案**：
```typescript
interface ChatTabCompact {
  id: string;
  sessionId: string | null;
  title: string;
  model: string | null;
  messageCount: number;   // 只存數量
  lastMessage?: string;   // 預覽用最後一條
  // chatHistory 不預載，切換 tab 時 lazy load
}
```

**影響範圍**：`src/lib/chat-tabs.js`、`src/sidebar.js`

---

### P3-9：Virtual Scrolling（長對話）

**問題**：100+ 訊息的對話導致 DOM 節點過多，滾動卡頓

**方案**：
- 只渲染可視區域 ±2 倍高度的訊息節點
- 維持捲軸高度、動態高度計算、滾動位置還原
- 可採用 `@tanstack/virtual`（輕量，無框架依賴）或手動實作

**影響範圍**：`src/sidebar.js`、`src/sidebar.html`（需改動訊息渲染迴圈）

---

### P3-10：IndexedDB 遷移（大 chatHistory）

**問題**：`chrome.storage.local` 限制 5 MB，長對話多 tab 情境下容易超出

**方案**：
- 將 `chatHistory` 改存 IndexedDB（透過 `idb-keyval` 或原生 API）
- `chrome.storage.local` 僅存 tab metadata（`id`、`title`、`model` 等輕量欄位）

**影響範圍**：`src/lib/chat-tabs.js` storage layer

---

### P3-12：首屏連線等待優化

**問題**：sidebar 開啟時需等待 proxy 健康檢查，才能顯示聊天介面，感知速度慢

**方案**：
- 樂觀 UI：先顯示「正在連線...」狀態，不阻擋 UI 渲染
- Link preconnect hint 至 proxy 位址（`127.0.0.1:8321`）

---

### P3-13：Tab 切換閃爍優化

**問題**：切換 tab 時 DOM 大量更新，導致短暫白畫面或閃爍

**方案**：
```javascript
function switchTabDOM(oldTabId, newTabId) {
  requestAnimationFrame(() => {
    hideTab(oldTabId);
    showTab(newTabId);
  });
}
```

---

## 優化優先順序建議

```
Phase 1（穩定性）── 已完成，待驗收
└── P0-2 驗收封板（proxy log 觀測 10 min）

Phase 2（Quick Wins）── 已完成
├── P2-7  Minimal DOM Updates        ✅
├── P2-8  Cache Invalidation Policy  ✅
├── P2-9  Immutable State Helpers    ✅
├── P2-10 Batched Storage Writes     ✅
├── P2-11 Chat Tabs Debounce         ✅
└── P2-12 Streaming rAF Render       ✅

Phase 3（Mid-term，3-5 天）── 待實作
├── P2-13 Web Worker formatText      🔲
└── P3-11 Skills Cache TTL 30 min   🔲

Phase 4（Long-term）── 待排程
├── P3-6  RPC Batch Endpoint         🔲
├── P3-7  Lazy Init                  🔲
├── P3-8  Tab Lazy Load              🔲
├── P3-9  Virtual Scrolling          🔲
├── P3-10 IndexedDB Migration        🔲
├── P3-12 Preconnect + Optimistic UI 🔲
└── P3-13 Tab Switch rAF             🔲
```

---

## 備註

- 所有 ✅ 項目均已驗證於原始碼中存在（截至 2026-03-01）
- P0-2 修復已實作，但驗收需手動 proxy log 觀測
- Phase 3 優先從最小改動開始（P3-11 僅需修改一行常數）
