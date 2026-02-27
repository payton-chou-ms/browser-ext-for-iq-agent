# IQ Copilot — Changelog

> 自 2026-02-27 起的所有變更紀錄，按時間倒序排列。

---

## Commit Plan — 10 個 Atomic Commits ✅

> 執行日期：2026-02-27
> 基底 commit：`2c00ae6`

將原始開發中的 working tree 整理為 10 個有序的 atomic commits，涵蓋 15 個 feature 區塊。

### 策略

因多個 feature 交錯在同一檔案（sidebar.js, proxy.js, background.js），
`git add -p` 自動化不可靠（hunk 邊界不對齊 feature），
改採 **檔案層級分批提交**，維持邏輯順序。

### Commits

| # | Hash | Message | 檔案 | 差異 |
|---|------|---------|------|------|
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

### Feature 區塊對照

| Feature | 說明 |
|---------|------|
| Security Hardening | `.gitignore` 擴展、`.env.example`、CI secret scanning |
| i18n 系統 | 翻譯映射表、DOM walker、`t()` helper |
| Foundry 整合 | proxy `/api/foundry/*` 路由、API key 管理（`chrome.storage.session`） |
| MCP Config Panel | 讀寫 `~/.copilot/mcp-config.json`、完整 UI |
| Skills Panel | CLI skills 載入、自訂 skills CRUD |
| File Upload 系統 | drag-and-drop、paste、binary / text 分流 |
| Usage / Quota Panel | CLI quota API、models card |
| Context Panel | CLI context API、session context 渲染 |
| History Panel | session 歷史搜尋 |
| Tasks Panel | parallel task 監控、timeline 可視化 |
| Proactive Agent 系統 | briefing / deadlines / ghosts / meeting-prep 全套 |
| Achievement Engine | gamification 引擎 + UI 渲染 + toast |
| UI 重構 | sidebar.html 所有新 panel 結構 + sidebar.css 完整樣式 |
| E2E 測試 | 5 個 Playwright 測試 + config + watch script |
| CI Pipeline | GitHub Actions: lint / security / build / publish |

---

## Phase 0 — 修復無限迴圈 ✅

> Commit: `cff97d0` (Phase 0.4)
> 影響檔案: `sidebar.js`, `background.js`

### 問題

sidebar 在 idle 狀態下每 ~60 秒觸發一輪完整 API 呼叫風暴
（7+ 請求 + 4 次 LLM 呼叫），持續超過 2.5 小時不間斷。

```
background.js setInterval(15s)
  → checkAndUpdateConnection()
    → broadcastState("connected")
      → sidebar.js onMessage → onConnected()
        → LIST_MODELS + loadHistory + loadSkills + loadQuota + fetchContext
        → runFullProactiveScan() (4 次 LLM, ~60s)
          → 完成 → 下一個 broadcast → 無限循環
```

### 修復

| # | 修改 | 說明 |
|---|------|------|
| 0.1 | `_hasInitialized` flag | `onConnected()` 只在首次連線執行完整初始化 |
| 0.2 | 移除 `runFullProactiveScan()` | Proactive scan 改為使用者觸發 / Chrome Alarm |
| 0.3 | debounce listener | `CONNECTION_STATE_CHANGED` 15 秒內只處理第一次 |
| 0.4 | `broadcastState()` gate | 只有 `prev !== current` 時才廣播 |

### 效果

| 指標 | Before | After |
|------|--------|-------|
| Idle API calls/min | ~7 + 4 LLM | 0（僅 health check） |
| LLM tokens/hour | ~240 sendAndWait | 0 |
| scan-all 觸發 | 每 60s 自動 | Chrome Alarm + 手動 |

---

## Phase 1 — 網路效率優化 ✅

> Commits: `cff97d0` (1.1 in proxy.js), `3dded50` (1.2-1.4)
> 影響檔案: `sidebar.js`, `proxy.js`

### 1.1 scan-all 移除 self-loopback

`/api/proactive/scan-all` 原本用 `http.request()` 呼叫自己的 4 個 endpoint，
改為直接呼叫 handler function（`scanBriefing`, `scanDeadlines`, `scanGhosts`, `scanMeetingPrep`）。

### 1.2 onConnected 並行化

`onConnected()` 中 6 個 API 從串行 `await A; await B; ...` 改為 `Promise.allSettled()` 並行。

### 1.3 聚合 API

sidebar 原本分 5 次 HTTP 取 models / tools / quota / sessions / context，
改為單次 `GET_CONTEXT` 聚合呼叫 + 解構分配，搭配 fallback 至個別呼叫。

### 1.4 Cache + TTL

新增完整 cache 層：

| 資料 | TTL |
|------|-----|
| models | 5 min |
| tools | 5 min |
| quota | 2 min |
| sessions | 30 sec |
| context | 2 min |

實作：`_dataCache` 物件 + `getCached()` / `setCache()` / `invalidateCache()` / `cachedSendToBackground()`。
Session mutation（建立、刪除、切換 agent）時自動 invalidate。

### 新增 Helper Functions

- `renderHistoryFromData(sessions)` — 從 `loadHistorySessions` 抽取的 rendering 邏輯
- `renderSkillsFromData(tools)` — 從 `loadSkillsFromCli` 抽取的 rendering 邏輯
- `_onConnectedFallback()` — 聚合 API 失敗時的 graceful degradation

---

## Phase 4 — proxy.js 強化 ✅

> 影響檔案: `proxy.js`（尚未獨立 commit，包含在 working tree 中）

### 4.1 Proactive Session Model 可配置

`ensureProactiveSession()` 從硬編碼 `gpt-4.1` 改為讀取 config / 當前 active model。

### 4.2 Proactive Session Error Recovery

scan 失敗時清除 `proactiveSessionId`，下次自動重建，解決 CLI 重啟後 session stale 問題。

### 4.3 Request Validation

所有 route handler 加入基礎 request body 驗證（輕量手寫 schema check）。

---

## Git Log

```
3dded50 perf: add cache+TTL, aggregated API, and Promise.allSettled (Phase 1.2-1.4)  ← HEAD
cff97d0 fix: add state-change gate to broadcastState (Phase 0.4)
d8f3d2c docs: update optimize-zhtw.md with completed commit plan status
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
