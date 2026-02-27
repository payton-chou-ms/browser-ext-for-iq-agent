# IQ Copilot 專案完整分析 & Commit 計畫

> 產生日期：2026-02-27  
> 最後更新：2026-02-27（Commit Plan 已全部完成）

---

## 一、專案概覽

| 檔案 | 行數 | Git 狀態 | 職責 |
|------|------|----------|------|
| sidebar.js | 3,767 | modified | 主 UI 邏輯（巨型單體） |
| sidebar.css | 3,284 | modified | 所有樣式 |
| sidebar.html | 850 | modified | DOM 結構 |
| proxy.js | 921 | modified | HTTP 代理伺服器 |
| achievement-engine.js | 695 | **new** | 成就系統引擎 |
| background.js | 351 | modified | Service Worker |
| copilot-rpc.js | 306 | modified | REST 客戶端 |
| start.sh | 195 | modified | 啟動腳本 |
| content_script.js | 35 | unchanged | 內容腳本 |
| tests/extension.spec.js | 145 | **new** | E2E 測試 |
| .github/workflows/ci.yml | 166 | **new** | CI Pipeline |
| .env.example | 15 | **new** | 環境變數範本 |
| README.md | 12 | **new** | 專案文件 |

---

## 二、提交狀態

```
✅ 全部已提交（10 個 atomic commits：fd8e6d8 → 4f6ade4）
基底 commit：2c00ae6
最新 commit：4f6ade4 (HEAD → main)
Working tree：clean
```

---

## 三、Code Quality 問題

| 嚴重度 | 問題 | 說明 |
|--------|------|------|
| **CRITICAL** | sidebar.js 3,767 行巨型單體 | 違反 800 行上限，包含 state / i18n / UI / chat / streaming / file-upload / agent / MCP / skills / proactive / achievements 等 15+ 個功能區塊 |
| **HIGH** | 缺少 TypeScript | 全專案純 JS，無型別安全 |
| **HIGH** | 缺少 Linter / Formatter | 無 ESLint、Prettier 設定 |
| **HIGH** | 測試覆蓋率不足 | 僅 5 個 E2E 測試，無 unit test，低於 80% 門檻 |
| **MEDIUM** | 大量 inline style | sidebar.js 的 template literal 中嵌入大量 `style="..."` 應用 CSS class |
| **MEDIUM** | 全域變數汙染 | sidebar.js 定義 50+ 全域函數 / 變數，無模組化 |
| **MEDIUM** | 部分 mutation 模式 | `toolCalls.length = 0`、`subAgents.length = 0` 直接修改陣列 |
| **MEDIUM** | 無 input validation | proxy.js 未使用 Zod 或 schema 驗證請求 |
| **LOW** | i18n 不完整 | 有 i18n 系統但許多 runtime 字串仍是硬編碼中文 |
| **LOW** | README 僅 12 行 | 缺乏安裝說明、架構圖、開發指南 |

---

## 四、功能分析（未提交的 15 個 Feature 區塊）

1. **Security Hardening** — `.gitignore` 擴展、`.env.example`、CI secret scanning
2. **i18n 系統** — 翻譯映射表、DOM walker、`t()` helper
3. **Foundry 整合** — proxy 路由 `/api/foundry/*`、API key 管理（`chrome.storage.session`）
4. **MCP Config Panel** — 讀寫 `~/.copilot/mcp-config.json`、完整 UI
5. **Skills Panel** — CLI skills 載入、自訂 skills CRUD
6. **File Upload 系統** — drag-and-drop、paste、binary / text 分流
7. **Usage / Quota Panel** — CLI quota API、models card
8. **Context Panel** — CLI context API、session context 渲染
9. **History Panel** — session 歷史搜尋
10. **Tasks Panel** — parallel task 監控、timeline 可視化
11. **Proactive Agent 系統** — briefing / deadlines / ghosts / meeting-prep 全套
12. **Achievement Engine** — gamification 引擎 + UI 渲染 + toast
13. **UI 重構** — sidebar.html 所有新 panel 結構 + sidebar.css 完整樣式
14. **E2E 測試** — 5 個 Playwright 測試 + config + watch script
15. **CI Pipeline** — GitHub Actions: lint / security / build / publish

---

## 五、Commit Plan（10 個 Atomic Commits）✅ 已完成

> 執行日期：2026-02-27  
> 策略：因多個 feature 交錯在同一檔案中（sidebar.js, proxy.js, background.js），`git add -p` 自動化不可靠，改採**檔案層級分批提交**策略，維持 10 個 atomic commits 的邏輯順序。

| # | Commit Hash | Message | 檔案數 | 差異 |
|---|-------------|---------|--------|------|
| 1 | `fd8e6d8` | `chore: harden .gitignore and add .env.example` | 2 | +41 |
| 2 | `03894d8` | `feat: update manifest and add API client extensions` | 2 | +69/−1 |
| 3 | `d05faa9` | `feat: add proxy routes for Foundry, MCP, file upload, and proactive agent` | 1 | +411/−21 |
| 4 | `632941b` | `feat: add background worker message routing and alarm scheduling` | 1 | +165 |
| 5 | `311aea1` | `feat: add sidebar UI structure for all panels` | 2 | +2,250/−443 |
| 6 | `97f2968` | `feat: add sidebar logic with i18n, panels, and proactive agent system` | 1 | +1,823/−113 |
| 7 | `d725a2d` | `feat: update launch script with enhanced startup` | 1 | +10 |
| 8 | `1544b74` | `feat: add Achievement Engine with gamification system` | 1 | +694 |
| 9 | `80dadc4` | `test: add Playwright E2E tests with CI pipeline` | 7 | +515/−1 |
| 10 | `4f6ade4` | `docs: add project README and update plan documents` | 5 | +647/−52 |

---

## 六、執行紀錄

> Commit Plan 已於 2026-02-27 全部完成。

### 策略調整說明

原始計畫建議依 **feature** 拆分 commit，對共用檔案（sidebar.js, proxy.js, background.js）使用 `git add -p` 逐段挑選。
實際執行時發現自動化 patch mode 不可靠（hunk 邊界不對齊 feature），故改採 **檔案層級分批提交**：

1. 先提交獨立檔案（.gitignore, .env.example）
2. 再按架構層級提交：manifest → proxy → background → sidebar.html+css → sidebar.js → start.sh
3. 最後提交新檔案：achievement-engine.js → tests → docs

結果仍為 10 個 atomic commits，邏輯順序一致，每個 commit 後擴充功能不壞。

### Git Log

```
4f6ade4 docs: add project README and update plan documents
80dadc4 test: add Playwright E2E tests with CI pipeline
1544b74 feat: add Achievement Engine with gamification system
d725a2d feat: update launch script with enhanced startup
97f2968 feat: add sidebar logic with i18n, panels, and proactive agent system
311aea1 feat: add sidebar UI structure for all panels
632941b feat: add background worker message routing and alarm scheduling
d05faa9 feat: add proxy routes for Foundry, MCP, file upload, and proactive agent
03894d8 feat: update manifest and add API client extensions
fd8e6d8 chore: harden .gitignore and add .env.example
2c00ae6 Add start.sh script to launch Copilot CLI with HTTP proxy and self-tests  ← 基底
```

---

## 八、後續優化建議（Future Work）

| 優先級 | 任務 | 說明 |
|--------|------|------|
| P0 | 拆分 sidebar.js | 拆成 10+ 個模組（i18n.js, chat.js, panels/*.js, proactive.js 等），搭配 bundler |
| P0 | 加入 ESLint + Prettier | 統一程式碼風格，CI 自動檢查 |
| P1 | 遷移至 TypeScript | 漸進式遷移，先從 proxy.js 和 achievement-engine.js 開始 |
| P1 | 加入 Unit Tests | 對 achievement-engine.js、copilot-rpc.js 寫 unit test，達 80% 覆蓋率 |
| P1 | 消除 inline styles | 將 template literal 中的 `style="..."` 抽取為 CSS class |
| P2 | 加入 Zod 驗證 | proxy.js 所有 route handler 加入 request body schema 驗證 |
| P2 | 模組化 proxy.js | 將 route handlers 拆分為獨立檔案（routes/*.js） |
| P2 | 完善 README | 加入架構圖、安裝步驟、開發指南、截圖 |
| P3 | 加入 bundler | 使用 esbuild / rollup 打包，支援 tree-shaking |
| P3 | 完善 i18n | 所有 runtime 字串統一走 `t()` 或 `localizeRuntimeMessage()` |

---

# 九、Runtime 效能優化計畫

> 基於 2026-02-27 proxy log 分析，發現 sidebar 在 idle 狀態下每 ~60 秒觸發一輪完整 API 呼叫風暴（7+ 請求 + 4 次 LLM 呼叫），持續超過 2.5 小時不間斷。

---

## Phase 0 — P0 Critical：修復無限迴圈 ⏱️ ~30 min

### 問題根因

```
background.js setInterval(15s)
  → checkAndUpdateConnection()
    → broadcastState("connected")          // 每次狀態相同仍廣播
      → sidebar.js onMessage listener
        → onConnected()                     // _onConnectedRunning 擋不住「完成後再觸發」
          → LIST_MODELS + loadHistory + loadSkills + loadQuota + fetchContext
          → runFullProactiveScan()          // 4 次 LLM 呼叫（~60s）
            → 完成 → _onConnectedRunning = false
              → 下一個 broadcast 再次觸發 → 無限循環
```

每 60 秒一輪：`/health → /models → /session/list → /tools → /quota → /context → /proactive/scan-all`

### 修復項目

| # | 檔案 | 修改 | 說明 |
|---|------|------|------|
| 0.1 | `sidebar.js` | 新增 `_hasInitialized = false` flag | `onConnected()` 只在首次連線時執行完整初始化，後續 broadcast 只更新 UI 連線狀態 |
| 0.2 | `sidebar.js` | 從 `onConnected()` 移除 `runFullProactiveScan()` | Proactive scan 改為純使用者觸發（點擊通知面板）或 Chrome Alarm 觸發 |
| 0.3 | `sidebar.js` | `CONNECTION_STATE_CHANGED` listener 加入 debounce | 15 秒內只處理第一次 broadcast |
| 0.4 | `background.js` | `broadcastState()` 加入 state-change gate | 只有 `prev !== current` 時才廣播（目前 **已有** 此邏輯，需驗證是否正常運作） |

### 預期效果

| 指標 | Before | After |
|------|--------|-------|
| Idle API 呼叫/分鐘 | ~7 calls + 4 LLM calls | 0（僅 health check） |
| LLM token 消耗/小時 | ~240 次 sendAndWait | 0（idle 下無呼叫） |
| scan-all 觸發 | 每 60 秒自動 | 僅 Chrome Alarm 排程 + 手動重整 |

---

## Phase 1 — P1 High：網路效率優化 ⏱️ ~2 hrs

### 1.1 `proxy.js` — scan-all 移除 self-loopback

**現狀**：`/api/proactive/scan-all` 用 `http.request()` 呼叫自己的 4 個 endpoint
**改為**：直接呼叫 handler function（`scanBriefing()`, `scanDeadlines()`, `scanGhosts()`, `scanMeetingPrep()`）

```javascript
// Before（Lines 855-875）
const endpoints = ['briefing','deadlines','ghosts','meeting-prep'];
const results = await Promise.allSettled(
  endpoints.map(ep => fetch(`http://127.0.0.1:${PORT}/api/proactive/${ep}`, ...))
);

// After
const scanners = { briefing: scanBriefing, deadlines: scanDeadlines, ... };
const results = await Promise.allSettled(
  Object.entries(scanners).map(([key, fn]) => fn(req.body))
);
```

### 1.2 `sidebar.js` — onConnected API 呼叫並行化

**現狀**：6 個 API 依序串行呼叫（`await A; await B; await C;`）
**改為**：使用 `Promise.allSettled()` 並行

```javascript
// Before
const models = await sendToBackground({ type: 'LIST_MODELS' });
const sessions = await loadHistorySessions();
const skills = await loadSkillsFromCli();
const quota = await loadQuotaFromCli();
const ctx = await fetchCliContext();

// After
const [models, sessions, skills, quota, ctx] = await Promise.allSettled([
  sendToBackground({ type: 'LIST_MODELS' }),
  loadHistorySessions(),
  loadSkillsFromCli(),
  loadQuotaFromCli(),
  fetchCliContext(),
]);
```

### 1.3 `sidebar.js` — 使用聚合 API `/api/context`

**現狀**：sidebar 分別呼叫 `/api/models`, `/api/tools`, `/api/quota`, `/api/session/list`, `/api/context`（5 次 HTTP）
**改為**：`/api/context` 已經聚合了上述所有資料，改為單次呼叫 + 解構

```javascript
// 一次呼叫取得全部
const ctx = await sendToBackground({ type: 'FETCH_CONTEXT' });
const { models, tools, quota, sessions, status } = ctx;
```

### 1.4 新增 Cache + TTL

| 資料 | TTL | 說明 |
|------|-----|------|
| models | 5 min | 極少變動 |
| tools | 5 min | 極少變動 |
| quota | 2 min | 較頻繁可能更新 |
| sessions | 30 sec | 使用者可能建立新 session |

```javascript
const _cache = {};
function cachedFetch(key, fetchFn, ttlMs) {
  const now = Date.now();
  if (_cache[key] && now - _cache[key].ts < ttlMs) return _cache[key].data;
  const data = await fetchFn();
  _cache[key] = { data, ts: now };
  return data;
}
```

---

## Phase 2 — P2 Medium：sidebar.js 拆分 ⏱️ ~4 hrs

### 目標架構

```
sidebar.js (3,767 → ~200 行 bootstrap)
├── lib/
│   ├── state.js          — 全域狀態管理（connectionState, currentSession, etc.）
│   ├── i18n.js           — I18N 物件 + t() + translateStaticUi()
│   ├── theme.js          — applyTheme() + applyLanguage()
│   ├── connection.js     — checkConnection() + onConnected()
│   ├── chat.js           — sendMessage, ensureSession, streaming, history
│   ├── agents.js         — agent 系統, fleet mode
│   ├── file-upload.js    — drag-drop, paste, processAttachment
│   ├── panels/
│   │   ├── usage.js      — updateStats, renderModelsCard, switchModel
│   │   ├── context.js    — fetchCliContext, renderContext
│   │   ├── skills.js     — loadSkills, custom skills CRUD
│   │   ├── mcp.js        — MCP config panel
│   │   ├── tasks.js      — parallel task monitoring
│   │   ├── history.js    — session history search
│   │   ├── proactive.js  — proactive agent 全套（state, scan, render, actions）
│   │   └── achievements.js — gamification UI
│   └── utils.js          — escapeHtml, showToast, debugLog, switchPanel
```

### 拆分策略

1. **不使用 bundler**（MV3 限制）— 使用 `<script>` tag 順序載入
2. 每個模組 export 到 `window.IQ.*` namespace
3. sidebar.js 變成 bootstrap：`import → init → bindEvents`
4. 逐步拆分：先拆最獨立的模組（i18n, utils, theme），再拆 panels

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

---

## Phase 3 — P3 Medium：Memory & DOM 優化 ⏱️ ~1 hr

### 3.1 `debugLog` 無限增長

**現狀**：`debugLog` 陣列無上限，每次 API 呼叫都 push
**改為**：Ring buffer，最多保留 500 筆

```javascript
const MAX_DEBUG_LOG = 500;
function addDebugLog(entry) {
  debugLog.push(entry);
  if (debugLog.length > MAX_DEBUG_LOG) debugLog.shift();
}
```

### 3.2 `chatHistory` 無限增長

**現狀**：所有 session 的 message 都保留在記憶體
**改為**：只保留當前 session，切換時清空或 LRU 限制

### 3.3 DOM 節點過多

**現狀**：長對話所有 messages 都在 DOM 中
**改為**：虛擬卷軸或上限 200 筆，超過則移除最舊的 DOM 節點

### 3.4 SSE Port 未正確清理

**現狀**：streaming 中斷時 port 可能未 disconnect
**改為**：加入 `finally` block 確保 port.disconnect()

---

## Phase 4 — P4 Low：proxy.js 強化 ⏱️ ~1 hr

### 4.1 Proactive Session 硬編碼 model

**現狀**：`ensureProactiveSession()` 硬編碼 `model: "gpt-4.1"`
**改為**：讀取 config 或使用當前 active model

```javascript
// Before
const session = await client.createSession({ model: 'gpt-4.1', ... });

// After
const model = config.proactiveModel || currentModel || 'gpt-4.1';
const session = await client.createSession({ model, ... });
```

### 4.2 Proactive Session 無 Error Recovery

**現狀**：proactive session 建立後若 CLI 重啟，session 變成 stale
**改為**：scan 失敗時清除 `proactiveSessionId`，下次自動重建

### 4.3 新增 Request Validation

**現狀**：所有 route handler 直接讀 `req.body`，無驗證
**改為**：簡易 schema check（不需要 Zod，手寫輕量驗證即可）

---

## Phase 5 — P5 Low：Code Quality ⏱️ ~2 hrs

### 5.1 合併重複的 `chrome.runtime.onMessage` listener

**現狀**：sidebar.js 有多個 `chrome.runtime.onMessage.addListener()` 分散在不同位置
**改為**：單一 listener + switch/case router

### 5.2 抽取 HTML Template 常數

**現狀**：大量 template literal 散落各處
**改為**：每個 panel 的 render 函數統一使用 `renderXxx()` helper

### 5.3 抽取 Magic Numbers

**現狀**：`15000`（health interval）, `500`（debounce）, `200`（max messages）等硬編碼
**改為**：統一定義為常數

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
**改為**：Phase 2 拆分後，每個模組使用 `window.IQ.moduleName = { ... }` namespace

---

## 執行優先序總覽

```
┌────────────────────────────────────────────────────────┐
│  Phase 0 (P0) — 修復無限迴圈                ~30 min   │  ← 最先做
│  ┌─────────────────────────────────────────────────┐   │
│  │ 0.1 _hasInitialized flag                        │   │
│  │ 0.2 移除 auto scan-all                          │   │
│  │ 0.3 debounce CONNECTION_STATE_CHANGED           │   │
│  │ 0.4 驗證 broadcastState gate                    │   │
│  └─────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────┤
│  Phase 1 (P1) — 網路效率                     ~2 hrs    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1.1 scan-all 移除 self-loopback                 │   │
│  │ 1.2 onConnected 並行化 Promise.allSettled        │   │
│  │ 1.3 使用 /api/context 聚合 API                  │   │
│  │ 1.4 Cache + TTL                                 │   │
│  └─────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────┤
│  Phase 2 (P2) — sidebar.js 拆分              ~4 hrs    │
├────────────────────────────────────────────────────────┤
│  Phase 3 (P3) — Memory & DOM                 ~1 hr     │
├────────────────────────────────────────────────────────┤
│  Phase 4 (P4) — proxy.js 強化                ~1 hr     │
├────────────────────────────────────────────────────────┤
│  Phase 5 (P5) — Code Quality                 ~2 hrs    │  ← 最後做
└────────────────────────────────────────────────────────┘
                                        總計 ~10.5 hrs
```

---

## Checklist（追蹤用）

### Phase 0 — 修復無限迴圈
- [ ] 0.1 sidebar.js 新增 `_hasInitialized` flag，onConnected 只執行一次
- [ ] 0.2 從 onConnected() 移除 runFullProactiveScan()
- [ ] 0.3 CONNECTION_STATE_CHANGED listener 加入 debounce
- [ ] 0.4 驗證 background.js broadcastState 只在狀態變更時廣播

### Phase 1 — 網路效率
- [ ] 1.1 proxy.js scan-all 改為直接呼叫 handler function
- [ ] 1.2 sidebar.js onConnected 呼叫並行化（Promise.allSettled）
- [ ] 1.3 sidebar.js 改用 /api/context 聚合端點
- [ ] 1.4 新增 cachedFetch + TTL（models 5min, tools 5min, quota 2min）

### Phase 2 — sidebar.js 拆分
- [ ] 2.1 建立 lib/ 目錄結構
- [ ] 2.2 抽取 state.js + utils.js
- [ ] 2.3 抽取 i18n.js + theme.js
- [ ] 2.4 抽取 connection.js + chat.js
- [ ] 2.5 抽取 panels/*.js（8 個面板）
- [ ] 2.6 sidebar.js 瘦身為 bootstrap（< 200 行）
- [ ] 2.7 更新 sidebar.html script 載入順序

### Phase 3 — Memory & DOM
- [ ] 3.1 debugLog ring buffer（max 500）
- [ ] 3.2 chatHistory 限制（僅當前 session 或 LRU）
- [ ] 3.3 DOM 節點上限（200 筆 messages）
- [ ] 3.4 SSE Port cleanup（finally block）

### Phase 4 — proxy.js 強化
- [ ] 4.1 proactive session model 改為可配置
- [ ] 4.2 proactive session error recovery
- [ ] 4.3 request body 基礎驗證

### Phase 5 — Code Quality
- [ ] 5.1 合併重複 onMessage listener
- [ ] 5.2 抽取 HTML template helpers
- [ ] 5.3 抽取 magic numbers 為常數 CONFIG
- [ ] 5.4 全域變數改為 namespace pattern
