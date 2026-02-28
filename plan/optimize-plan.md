# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-02-28

---

## Review 結論（剩餘待辦）

### 🔴 P0 — 必須先修（穩定性回歸）

#### P0-2：Idle 請求風暴（每 60 秒 `models/session/tools/quota/context/scan-all`）— **待驗收封板**

- **症狀**：proxy log 顯示每 ~60 秒出現一批 6 個請求
- **根本原因（2026-02-27 深入診斷）**：
  1. Service Worker 在 MV3 中會被週期性 kill/restart
  2. 重啟後 `_lastBroadcastState` 從 session storage 異步恢復
  3. 但 alarm handler 可能在異步恢復完成 **之前** 就觸發
  4. 此時 `_lastBroadcastState` 仍為初始值 `"disconnected"`
  5. 連線檢查成功 → `connectionState = "connected"`
  6. `broadcastState()` 比較 `"connected" !== "disconnected"` → **誤判為狀態改變**
  7. 發送 `CONNECTION_STATE_CHANGED` → sidebar 執行完整 init storm
- **修復方案（2026-02-27 實作）**：
  - 新增 `_stateRestoreComplete` flag 追蹤異步恢復是否完成
  - `broadcastState()` 增加 guard：恢復未完成時直接 return，防止誤判
  - `chrome.alarms.onAlarm` handler 同樣檢查 `_stateRestoreComplete`
  - 使用 async IIFE + try/finally 確保 flag 一定會被設為 true
- **目前待做**：
  - 10 分鐘 idle 觀測（只允許健康檢查，禁止每分鐘 init 批次）
  - sidepanel 開關/重連情境回歸測試
  - proxy log 取樣與結論紀錄

#### P0 驗收標準

- [ ] Idle 10 分鐘內不再出現每分鐘 `models/session/tools/quota/context/scan-all` 批次請求
- [ ] sidepanel 重新開關不會觸發完整 init storm
- [ ] proxy log 確認只有 `/health` 週期性呼叫（5 min 間隔）

---

### 🟡 P2 — 中優先度改善

#### P2 後續優化（待排程）

| ID | 問題 | 狀態 | 實作位置 |
|----|------|------|----------|
| P2-7 | UI render 全量重繪 | 待觀察 | 觀測 UI 更新頻率與重繪成本 |
| P2-8 | Cache invalidation 規則分散 | 待觀察 | 檢查 cache miss 比例與失效時機 |
| P2-9 | 部分 state mutation 非 immutable | 待觀察 | 針對高風險狀態更新點做 code review |
| P2-10 | Storage 細粒度頻繁寫入 | 待觀察 | 追蹤寫入次數與延遲抖動 |

---

### 🔵 P3 — 低優先度 / 長期改善

| ID | 問題 | 狀態 | 下一步 |
|----|------|------|------|
| P3-6 | RPC transport 分散請求 | TODO | 研究 batched endpoint |
| P3-7 | 首屏啟動同步初始化過多 | TODO | 採 lazy init（非首屏 panel 延後） |

---

## 🚀 新增優化建議（2026-02-28）

### 🟡 P2 — 新增項目

| ID | 問題 | 預估效益 | 實作方案 |
|----|------|----------|----------|
| P2-11 | **Chat Tabs 頻繁寫入** | 減少 80% storage writes | `saveTabs()` 每次 updateTab 都觸發，改用 debounce 500ms |
| P2-12 | **Streaming DOM 全量更新** | 減少 50% reflow | `bubble.innerHTML = formatText(content)` 改用 diff 或 patch |
| P2-13 | **formatText 主線程阻塞** | 減少 UI Jank | Markdown/code parsing 移至 Web Worker |

### 🔵 P3 — 新增項目

| ID | 問題 | 預估效益 | 實作方案 |
|----|------|----------|----------|
| P3-8 | **多 Tab 全量記憶體佔用** | 減少 60% 記憶體 | 非活躍 tab 的 chatHistory lazy load，只保留 metadata |
| P3-9 | **長對話 DOM 效能** | 減少滾動卡頓 | Virtual scrolling（只渲染可視區域訊息） |
| P3-10 | **大 chatHistory 儲存** | 擴充容量 10x | 改用 IndexedDB（chrome.storage.local 限制 5MB） |
| P3-11 | **Skills 重複載入** | 減少 API calls | Skills 加長 cache TTL 至 30 分鐘（少變動） |
| P3-12 | **首屏連線等待** | 感知速度提升 | Preconnect hint + 樂觀 UI（先顯示載入中） |
| P3-13 | **Tab 切換閃爍** | 改善 UX | 使用 `requestAnimationFrame` batch DOM updates |

---

### P2-11：Chat Tabs Storage Debounce

**問題分析**：
```javascript
// 目前：每次 updateTab 都立即呼叫 saveTabs()
function updateTab(tabId, updates) {
  // ...
  saveTabs();  // ← 頻繁觸發（typing 時每秒數十次）
}
```

**修復方案**：
```javascript
let saveTabsTimer = null;
function debouncedSaveTabs() {
  if (saveTabsTimer) clearTimeout(saveTabsTimer);
  saveTabsTimer = setTimeout(() => {
    saveTabs();
    saveTabsTimer = null;
  }, 500);  // 500ms debounce
}
```

**影響範圍**：`lib/chat-tabs.js`

---

### P2-12：Streaming DOM Patch

**問題分析**：
```javascript
// 目前：每次 delta 都重建整個 bubble innerHTML
bubble.innerHTML = formatText(content);  // 觸發 layout thrashing
```

**修復方案**：
1. 使用 `morphdom` 或 `diffDOM` 進行 DOM diff
2. 或採用 text node append 方式處理純文字串流
3. 對 code block 採用 incremental syntax highlighting

---

### P3-8：Tab Lazy Loading

**問題分析**：
10 個 tab，每個 100 條訊息 = 1000 條訊息常駐記憶體

**修復方案**：
```typescript
interface ChatTabCompact {
  id: string;
  sessionId: string | null;
  title: string;
  model: string | null;
  messageCount: number;     // 只存數量
  lastMessage?: string;     // 預覽用
  // chatHistory 不載入，切換時 lazy load
}
```

---

### P3-9：Virtual Scrolling

**問題分析**：
長對話（100+ 訊息）會導致 DOM 節點過多，滾動卡頓

**修復方案**：
- 採用 `@tanstack/virtual` 或手動實作
- 只渲染可視區域 ±2 倍高度的訊息
- 維持滾動位置與動態高度計算

---

## 優化優先順序建議

```
Phase 1（穩定性）
├── P0-2 驗收封板

Phase 2（Quick Wins，1-2 天）
├── P2-11 Chat Tabs Debounce（簡單，高回報）
├── P2-7/P2-8/P2-9/P2-10 觀測

Phase 3（Mid-term，3-5 天）
├── P2-12 Streaming DOM Patch
├── P2-13 Web Worker formatText
├── P3-11 Skills Cache 延長

Phase 4（Long-term）
├── P3-8 Tab Lazy Load
├── P3-9 Virtual Scrolling
├── P3-10 IndexedDB Migration
├── P3-6/P3-7 RPC Batch + Lazy Init
```

---

## 備註

- 本文件僅保留剩餘待辦；已完成內容已移除。
