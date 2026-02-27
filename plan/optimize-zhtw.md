# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-02-27
> 已完成項目請參考 → [changelog.md](changelog.md)

---

## 專案概覽

| 檔案 | 行數 | 職責 |
|------|------|------|
| `sidebar.js` | ~3,950 | 主 UI 邏輯（巨型單體） |
| `sidebar.css` | 3,284 | 所有樣式 |
| `sidebar.html` | 850 | DOM 結構 |
| `proxy.js` | ~1,005 | HTTP 代理伺服器 |
| `achievement-engine.js` | 695 | 成就系統引擎 |
| `background.js` | 369 | Service Worker |
| `copilot-rpc.js` | 305 | REST 客戶端 |
| `start.sh` | 195 | 啟動腳本 |
| `content_script.js` | 33 | 內容腳本 |

---

## Code Quality 待解決問題

| 嚴重度 | 問題 | 說明 | 對應 Phase |
|--------|------|------|-----------|
| **CRITICAL** | sidebar.js 巨型單體 | ~3,950 行，違反 800 行上限 | Phase 2 |
| **HIGH** | 缺少 TypeScript | 全專案純 JS，無型別安全 | Future |
| **HIGH** | 缺少 Linter / Formatter | 無 ESLint、Prettier | Future |
| **HIGH** | 測試覆蓋率不足 | 僅 5 個 E2E，無 unit test | Future |
| **MEDIUM** | 大量 inline style | template literal 中嵌入 `style="..."` | Phase 5 |
| **MEDIUM** | 全域變數汙染 | 50+ 全域函數 / 變數，無模組化 | Phase 2/5 |
| **MEDIUM** | 部分 mutation 模式 | `arr.length = 0` 直接修改陣列 | Phase 5 |
| **LOW** | i18n 不完整 | 部分 runtime 字串硬編碼中文 | Future |
| **LOW** | README 僅 12 行 | 缺架構圖、安裝說明、開發指南 | Future |

---

## 進度總覽

```
Phase 0 (P0) — 修復無限迴圈          ✅ DONE
Phase 1 (P1) — 網路效率優化          ✅ DONE
Phase 4 (P4) — proxy.js 強化         ✅ DONE
─────────────────────────────────────────────
Phase 2 (P2) — sidebar.js 拆分       ⬜ ~4 hrs
Phase 3 (P3) — Memory & DOM 優化     ⬜ ~1 hr
Phase 5 (P5) — Code Quality          ⬜ ~2 hrs
─────────────────────────────────────────────
                              剩餘合計 ~7 hrs
```

---

## Phase 2 — sidebar.js 拆分 ⬜ ~4 hrs

### 目標架構

```
sidebar.js (~3,950 → ~200 行 bootstrap)
└── lib/
    ├── state.js            全域狀態管理
    ├── utils.js            escapeHtml, showToast, debugLog, switchPanel
    ├── i18n.js             I18N 物件 + t() + translateStaticUi()
    ├── theme.js            applyTheme() + applyLanguage()
    ├── connection.js       checkConnection() + onConnected()
    ├── chat.js             sendMessage, ensureSession, streaming, history
    ├── agents.js           agent 系統, fleet mode
    ├── file-upload.js      drag-drop, paste, processAttachment
    └── panels/
        ├── usage.js        updateStats, renderModelsCard, switchModel
        ├── context.js      fetchCliContext, renderContext
        ├── skills.js       loadSkills, custom skills CRUD
        ├── mcp.js          MCP config panel
        ├── tasks.js        parallel task monitoring
        ├── history.js      session history search
        ├── proactive.js    proactive agent 全套
        └── achievements.js gamification UI
```

### 拆分策略

1. **不使用 bundler**（MV3 限制）— `<script>` tag 順序載入
2. 每個模組 export 到 `window.IQ.*` namespace
3. sidebar.js 瘦身為 bootstrap：init → bindEvents
4. 順序：先拆獨立模組（i18n, utils, theme）→ 再拆 panels

### sidebar.html 載入順序

```html
<!-- 基礎 -->
<script src="lib/state.js"></script>
<script src="lib/utils.js"></script>
<script src="lib/i18n.js"></script>
<script src="lib/theme.js"></script>

<!-- 核心 -->
<script src="lib/connection.js"></script>
<script src="lib/chat.js"></script>
<script src="lib/agents.js"></script>
<script src="lib/file-upload.js"></script>

<!-- Panels -->
<script src="lib/panels/usage.js"></script>
<script src="lib/panels/context.js"></script>
<script src="lib/panels/skills.js"></script>
<script src="lib/panels/mcp.js"></script>
<script src="lib/panels/tasks.js"></script>
<script src="lib/panels/history.js"></script>
<script src="lib/panels/proactive.js"></script>
<script src="lib/panels/achievements.js"></script>

<!-- Bootstrap -->
<script src="sidebar.js"></script>
```

### Checklist

- [ ] 2.1 建立 `lib/` 目錄結構
- [ ] 2.2 抽取 `state.js` + `utils.js`
- [ ] 2.3 抽取 `i18n.js` + `theme.js`
- [ ] 2.4 抽取 `connection.js` + `chat.js`
- [ ] 2.5 抽取 `panels/*.js`（8 個面板）
- [ ] 2.6 sidebar.js 瘦身為 bootstrap（< 200 行）
- [ ] 2.7 更新 sidebar.html script 載入順序

---

## Phase 3 — Memory & DOM 優化 ⬜ ~1 hr

### 3.1 debugLog 無限增長

**現狀**：`debugLog` 陣列無上限，每次 API 呼叫都 push
**改為**：Ring buffer（max 500）

```javascript
const MAX_DEBUG_LOG = 500;
function addDebugLog(entry) {
  debugLog.push(entry);
  if (debugLog.length > MAX_DEBUG_LOG) debugLog.shift();
}
```

### 3.2 chatHistory 無限增長

**現狀**：所有 session 的 message 都留在記憶體
**改為**：僅保留當前 session，切換時清空或 LRU 限制

### 3.3 DOM 節點過多

**現狀**：長對話所有 messages 都在 DOM 中
**改為**：上限 200 筆，超過則移除最舊的 DOM 節點（或虛擬卷軸）

### 3.4 SSE Port 未正確清理

**現狀**：streaming 中斷時 port 可能未 disconnect
**改為**：加入 `finally` block 確保 `port.disconnect()`

### Checklist

- [ ] 3.1 debugLog ring buffer（max 500）
- [ ] 3.2 chatHistory 限制（僅當前 session 或 LRU）
- [ ] 3.3 DOM 節點上限（200 筆 messages）
- [ ] 3.4 SSE Port cleanup（finally block）

---

## Phase 5 — Code Quality ⬜ ~2 hrs

### 5.1 合併重複 onMessage listener

**現狀**：sidebar.js 有多個 `chrome.runtime.onMessage.addListener()` 分散各處
**改為**：單一 listener + switch/case router

### 5.2 抽取 HTML Template

**現狀**：大量 template literal 散落各處
**改為**：每個 panel 統一使用 `renderXxx()` helper

### 5.3 抽取 Magic Numbers

**現狀**：`15000`、`500`、`200` 等硬編碼數值
**改為**：統一定義為 `CONFIG` 常數

```javascript
const CONFIG = Object.freeze({
  HEALTH_CHECK_INTERVAL_MS: 15_000,
  DEBOUNCE_MS: 500,
  MAX_CHAT_MESSAGES: 200,
  MAX_DEBUG_LOG: 500,
  CACHE_TTL_MODELS_MS: 5 * 60_000,
  CACHE_TTL_TOOLS_MS: 5 * 60_000,
  CACHE_TTL_QUOTA_MS: 2 * 60_000,
});
```

### 5.4 消除全域變數汙染

**現狀**：50+ 全域函數 / 變數
**改為**：Phase 2 拆分後，各模組使用 `window.IQ.moduleName = { ... }` namespace

### Checklist

- [ ] 5.1 合併重複 onMessage listener
- [ ] 5.2 抽取 HTML template helpers
- [ ] 5.3 抽取 magic numbers 為 `CONFIG` 常數
- [ ] 5.4 全域變數改為 namespace pattern

---

## Future Work（優化計畫之外）

| 優先級 | 任務 | 說明 |
|--------|------|------|
| P0 | ESLint + Prettier | 統一程式碼風格，CI 自動檢查 |
| P1 | 遷移至 TypeScript | 漸進式：先 proxy.js → achievement-engine.js |
| P1 | Unit Tests | 達 80% 覆蓋率（achievement-engine, copilot-rpc） |
| P1 | 消除 inline styles | template literal 中 `style="..."` → CSS class |
| P2 | Zod 驗證 | proxy.js route handler 完整 schema 驗證 |
| P2 | 模組化 proxy.js | 拆為 `routes/*.js` |
| P2 | 完善 README | 架構圖、安裝步驟、開發指南、截圖 |
| P3 | Bundler | esbuild / rollup 打包 + tree-shaking |
| P3 | 完善 i18n | 所有 runtime 字串走 `t()` |
