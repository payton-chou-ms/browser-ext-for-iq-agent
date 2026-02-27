# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-02-27 v3（已將完成項目移至 changelog，待辦聚焦 P0/P1）
> 已完成項目請參考 → [changelog.md](changelog.md)

---

## 目前狀態（Snapshot）

| 項目 | 狀態 |
|------|------|
| Phase 0 — 修復無限迴圈 | ✅ DONE |
| Phase 1 — 網路效率優化 | ✅ DONE |
| Phase 2 — sidebar.js 拆分 | ✅ DONE（`sidebar.js` 391L，12+模組已抽出） |
| Phase 3 — Memory/DOM 優化 | ✅ DONE |
| Phase 4 — proxy 強化 | ✅ DONE（已落地到 TS/route 拆分工作流） |
| Phase 5 — Code Quality | ✅ DONE（基礎完成，持續收斂） |
| P1 TypeScript 遷移 | ✅ 漸進式完成（proxy.ts + routes/*.ts + achievement-engine.ts） |

---

## 全專案掃描結果（2026-02-27）

> 掃描範圍：所有 `.js/.ts` 源碼、`start.sh`、`background.js`、`routes/`、`lib/`、`tests/`

---

### 🔴 P0 — 必須先修（穩定性回歸）

#### P0-1：`start.sh` 語法錯誤導致 proxy 被 kill

- **症狀**：`syntax error near unexpected token '('`（line 190），proxy process 收到 kill signal 137（OOM/kill）
- **根因**：shell 腳本中有不正確的行接續（`\` 斷行），加上 `set -euo pipefail` 下 pipe 失敗直接 abort
- **修法**：
  1. 修正 line 190 附近的括號換行問題
  2. 對 `node proxy.js ... | while ...` 的 pipe 加 `|| true` 保護，避免 proxy crash 後整個 shell exit
  3. 加入 `wait $PROXY_PID` + 重啟邏輯，讓 proxy 意外死亡時能被偵測並告警
- **驗收**：連續啟停 5 次均成功，不出現 syntax error 或孤兒程序

#### P0-2：Idle 請求風暴（每 60 秒 `models/session/tools/quota/context/scan-all`）

- **症狀**：proxy log 顯示每 ~60 秒出現一批 6 個請求：`POST /api/models`、`POST /api/session/list`、`POST /api/tools`、`POST /api/quota`、`POST /api/context`、`POST /api/proactive/scan-all`
- **根因分析**：
  - `background.js:292` 有一個 `setInterval(15000)` 定期 `broadcastState()`
  - `lib/connection.js` 的 `setupRuntimeListener` 在收到 `CONNECTION_STATE_CHANGED` 且 state=connected 時，若距上次超過 `CONNECTION_DEBOUNCE_MS`(15s)，就呼叫 `onConnected()`
  - `onConnected()` 有 `_hasInitialized` 守衛，但**若 sidebar 重新開啟（panel 被銷毀再重建）**，`_hasInitialized` 是 in-memory 狀態，重置為 `false`，導致每次 reconnect 都跑一次完整 init
  - `/api/context` route 本身不呼叫 scan-all；而 `POST /api/proactive/scan-all` 是由 `lib/panels/proactive.js:642` 在 `init()` 後的某個 handler 觸發的（需進一步確認是否為 `restoreProactiveState` 後呼叫）
- **修法**：
  1. 確認 `runFullProactiveScan()` 的觸發點：是否在 sidebar init 時無條件被呼叫
  2. 加入 `lastScan` 時間檢查：若距上次掃描 < 5 分鐘，跳過自動掃描
  3. `broadcastState()` 在 state 沒變化時不廣播（已有 `_lastBroadcastState` 判斷，確認已生效）
  4. `onConnected()` 的 `_hasInitialized` 守衛在 sidebar reload 後需能從 `chrome.storage.session` 恢復
- **驗收**：Idle 10 分鐘不出現 scan-all 或 init 批次請求

---

### 🟠 P1 — 高優先度改善

#### P1-1：`routes/` 遷移至 TypeScript ✅ DONE

- **現況**：所有 routes 已完成 TypeScript 遷移
  - `routes/core.ts` (173L)
  - `routes/session.ts` (219L)
  - `routes/schemas.ts` (67L)
  - `routes/foundry.ts` (91L)
  - `routes/proactive.ts` (123L)
- **總計**：673 行 strict TypeScript
- **驗收**：0 TS errors，route handler 型別完整保護

#### P1-2：單元測試覆蓋率不足

- **現況**：只有 E2E Playwright 測試（5 個 UI 測試），無 unit/integration 測試
- **缺口**：
  - `achievement-engine.ts`：成就邏輯完全無測試
  - `routes/`：HTTP handler 無測試
  - `lib/utils.js`：cache/debounce 無測試
  - `proxy.ts`：readJsonBody、readBody 無測試
- **修法**：加入 `vitest`（或 Node test runner），補充各模組 unit tests
- **目標**：核心邏輯達 60%+ 覆蓋率

---

### 🟡 P2 — 中優先度改善

#### P2-1：`background.js` 缺少 alarm 重複建立保護

- **現況**：`chrome.alarms.create(...)` 在每次 service worker 啟動時都會執行，若 alarm 已存在會靜默覆蓋（Chrome 行為），但未明確處理
- **修法**：改用 `chrome.alarms.get(name, cb)` 先查再建，避免不必要的覆蓋

#### P2-2：`copilot-rpc.js` 缺少 request timeout

- **現況**：`apiCall()` 沒有設定 fetch timeout，若 proxy 無回應會無限 hang
- **修法**：加入 `AbortController` + timeout（如 30s），並統一錯誤格式

#### P2-3：`lib/utils.js` cache 無記憶體上限

- **現況**：`_dataCache` 是 plain object，無 LRU/size limit，若 key 很多會無限增長（擴充後風險增高）
- **修法**：加入最大 entry 數上限（如 50），超過時清除最舊的

#### P2-4：`start.sh` 缺少 proxy 自動重啟

- **現況**：proxy 被 kill 後整個 start.sh 就結束（靠 `wait` 阻塞）
- **修法**：加入 proxy 存活監控 loop，若 proxy 退出但 CLI 仍在則嘗試重啟 proxy（最多 3 次）

#### P2-5：`routes/proactive.js` scan-all 是串行執行

- **現況**：`scan-all` 依序呼叫 briefing → deadlines → ghosts → meetingPrep（4 個 LLM 請求串行）
- **修法**：改為 `Promise.allSettled()` 並行執行，可將延遲從 ~4x 降到 ~1x

#### P2-6：`manifest.json` 版本號未與 package.json 同步

- **現況**：兩個地方各自維護版本號，容易漂移
- **修法**：在 `scripts/build.mjs` 中讀取 package.json 版本並寫入 manifest，或加入 lint check

---

### 🔵 P3 — 低優先度 / 長期改善

#### P3-1：i18n 尚未全收斂

- `[ ]` chat runtime 文案
- `[ ]` tasks runtime 文案
- `[x]` 其餘已完成

#### P3-4：`achievement-engine.ts` 無法與 proxy 端共享型別

- 因 browser/node 編譯目標不同，型別定義有冗餘
- 建議提取 `shared/types.ts`，由兩端分別 import

#### P3-5：Playwright E2E 測試執行環境限制

- 目前 `headless: false`，CI 上無法跑
- 修法：改用 `--headless=new` 模式，並加入 CI workflow（GitHub Actions）

---

## 行動優先序（建議執行順序）

```
P0-1 → P0-2 → P1-1（routes TS）→ P1-2（unit tests）
→ P2-5（scan-all 並行）→ P2-1 → P2-2 → P2-4 → P3-1/P3-4/P3-5
```

## 建議平行處理方式（可分工）

> 原則：同一時間優先平行「低耦合」工作；有依賴的項目以里程碑交會。

### Track A（Runtime 穩定性）
- A1：`start.sh` 穩定化（P0-1）
- A2：連線/輪詢風暴修復（P0-2）
- 關係：A1、A2 可平行開工；合併前一起做 10 分鐘 idle 驗收

### Track B（Proxy/Routes 工程化）
- B1：`routes/*.js` → TypeScript（P1-1）
- B2：`scan-all` 並行與節流（P2-5）
- B3：request timeout / body size guard（P2-2 + P1 區 guard 任務）
- 關係：B1 完成後再收斂 B2/B3 型別與測試最省成本；B2 與 B3 可平行

### Track C（品質與前端維護）
- C1：i18n `tasks` runtime 收斂（P3-1）
- C2：background polling policy（P1/P2 中的 background 調整）
- C3：測試基建與 unit tests（P1-2）
- 關係：C1 可先做；C3 先建立測試框架，再與 A/B 軌並行補測

### 建議三人分工（範例）
- Owner A：Track A（P0 全包）
- Owner B：Track B（proxy/routes/scan）
- Owner C：Track C（i18n + tests + background policy）

### 每日同步節點（避免互卡）
- 同步 1：中午前確認 API 介面變更（A/B/C 共識）
- 同步 2：下班前合併前檢查（lint、idle 10 分鐘、主要流程 smoke test）

---

## 專案概覽（更新後）

| 檔案 | 行數（約） | 職責 |
|------|-----------|------|
| `sidebar.js` | 391 | Bootstrap（初始化/事件綁定/模組 wiring） |
| `sidebar.html` | 856+ | Sidepanel DOM + script 載入順序 |
| `sidebar.css` | 3,300+ | 所有 UI 樣式 |
| `lib/state.js` | 38 | CONFIG 常數 |
| `lib/i18n.js` | 333 | I18N 字典 + `t()` + static 翻譯 |
| `lib/theme.js` | 42 | `applyTheme()` / `applyLanguage()` |
| `lib/utils.js` | 168 | toast/cache/debug/common utils |
| `lib/connection.js` | 226 | 連線狀態、runtime router、onConnected pipeline |
| `lib/chat.js` | 552 | 對話狀態、streaming、session 處理 |
| `lib/agents.js` | 204 | agent 管理與 UI |
| `lib/file-upload.js` | 246 | 附件上傳/預覽/貼上 |
| `lib/panels/*.js` | 8 個面板已拆分 | context/history/usage/mcp/tasks/skills/proactive/achievements |
| `proxy.ts` | 500+ | Proxy TS source（build 輸出 `dist/proxy.js`） |
| `achievement-engine.ts` | 690+ | 成就引擎 TS source |

---

## 風險與待處理（依優先級）

| 優先級 | 問題 | 觀察 | 行動 |
|--------|------|------|------|
| **P0** | Idle 請求風暴回歸 | 日誌顯示約每 60 秒重複 `models/session/tools/quota/context/proactive/scan-all` | 先修復（見「Stabilization Sprint」） |
| **P0** | 啟動流程不穩 | `start.sh` 出現 `syntax error near unexpected token '('`，且曾有 proxy process 被 kill (`137`) | 修復腳本 + 增加自檢 |
| **P1** | 測試覆蓋率不足 | 目前仍以 E2E 為主，缺 unit/integration coverage | 新增測試矩陣 |
| **P2** | i18n 尚未全收斂 | 多數面板已收斂，仍有 runtime 字串 | 依面板逐步收斂 |

### 最新觀測（2026-02-27）

- 已確認仍存在約 60 秒週期的 API 呼叫鏈：`/api/models`、`/api/session/list`、`/api/tools`、`/api/quota`、`/api/context`、`/api/proactive/scan-all`。
- `start.sh` 仍有穩定性問題：
   - `line 190: syntax error near unexpected token '('`
   - `node proxy.js` 曾出現 `Exit Code 137 / killed`。
- P0 優先序維持不變：先完成連線/輪詢穩定化與啟動腳本修復，再繼續擴張性優化。

---

## 全專案掃描結果（新增）

> 本節為本次「全專案掃描」新增的優化待辦，按效益/風險排序。

### P0（立即）

| Area | 檔案 | 問題 | 優化建議 | 預期效益 |
|------|------|------|---------|---------|
| Connection loop | `background.js`, `lib/connection.js` | 目前仍可觀察到接近 60 秒週期的多路 API 呼叫鏈 | 增加「連線事件計數 + 原因標記」(why-trigger)；將 `onConnected()` 執行條件改為「state changed + cold start」雙閘；確保 reconnect 只做最小同步 | 直接降低無效 API 與 LLM 呼叫 |
| Proactive scans | `background.js`, `routes/proactive.js`, `lib/panels/proactive.js` | `scan-all` 成本高，且含 4 個子掃描；若被錯誤觸發會放大成本 | 新增 `scan-all` 伺服器端節流（例如 3-5 分鐘內拒絕重入）；拆分 UI refresh 與 scan trigger；將 `scan-all` 預設改為僅手動 | 避免 token 與延遲暴增 |
| Startup stability | `start.sh` | 出現 syntax error 與 process `137`，目前 lifecycle 脆弱 | 將 pipeline 啟動改為明確函式（避免複雜 `| while` 背景流程）；加上 pidfile、graceful kill、exit code 檢查 | 啟停穩定、降低殭屍/孤兒程序 |

### P1（高價值）

| Area | 檔案 | 問題 | 優化建議 | 預期效益 |
|------|------|------|---------|---------|
| Logging overhead | `copilot-rpc.js`, `routes/session.js`, `lib/utils.js`, `sidebar.js` | 目前大量 log 會序列化大 payload（含 prompt/attachments），且 debug log DOM 可能重複寫入 | 加入 log level 與 payload 截斷（例如 1-2KB）；附件與 prompt 只記 metadata；避免同一事件雙重寫入 debug DOM | 降低 UI 卡頓、記憶體與 I/O 壓力 |
| Temp files lifecycle | `proxy.ts` | `buildPromptWithAttachments()` 會寫入 temp 檔，但缺少清理策略 | 加入 TTL cleanup（啟動清一次 + 每 N 分鐘清一次）；上限總量（檔數/容量）保護 | 降低磁碟膨脹與隱私風險 |
| Body size guard | `proxy.ts`, `routes/foundry.js` | `readBody/readJsonBody` 無 request body 大小上限 | 為 JSON/body 增加最大大小（例如 2-5MB）；Foundry chat 另設上限與明確錯誤碼 | 防止記憶體尖峰與 DoS 風險 |
| Background polling policy | `background.js` | 固定 15s check 在 idle 仍持續 | 以 `chrome.alarms` + adaptive backoff（connected 時低頻、disconnected 時高頻）替代固定 interval | 減少背景 CPU/網路占用 |

### P2（中期）

| Area | 檔案 | 問題 | 優化建議 | 預期效益 |
|------|------|------|---------|---------|
| UI render granularity | `lib/panels/proactive.js`, `lib/panels/tasks.js`, `lib/panels/history.js` | 多處採整段 `innerHTML` 全量重繪 | 改為最小更新策略（keyed update / 分段 render / requestAnimationFrame batching） | 降低重排與 repaint |
| Cache invalidation model | `lib/utils.js`, `lib/connection.js`, 各 panels | 快取失效規則分散，可能造成 stale 或重抓 | 建立統一 cache policy（事件驅動失效：session create/delete/model switch） | 穩定一致、降低重複請求 |
| State mutation consistency | `lib/panels/tasks.js` 等 | 仍有直接 mutation（如 `length = 0`） | 統一改為 immutable 更新 + 單一路徑 state setter | 降低隱性 side effect |
| Config/storage batching | `background.js`, `sidebar.js`, panels | 多次細粒度 storage 讀寫 | 合併批次寫入、節流儲存（debounce） | 降低 storage I/O |

### P3（架構優化）

| Area | 檔案 | 問題 | 優化建議 | 預期效益 |
|------|------|------|---------|---------|
| RPC transport | `copilot-rpc.js`, `background.js` | 多個 endpoint 分散請求，重複 headers/序列化 | 增加 batched endpoint（models/sessions/tools/quota）與條件請求（etag/version） | 進一步減少 RTT |
| Proactive orchestration | `routes/proactive.js`, `proxy.ts` | `scan-all` 目前串行四次 | 可改「並行 + timeout + partial result」並引入結果快取 | 縮短 scan latency |
| Script startup split | `sidebar.js`, `sidebar.html` | 首屏時同步初始化項目較多 | 採「critical path vs lazy init」：非首屏 panel 延後載入/綁定 | 提升 sidepanel 首開速度 |

---

## Stabilization Sprint（下一步計畫）

### Sprint A（P0，先做）— 連線/輪詢穩定化

1. **重現與量測**
   - 以單一 sidepanel session 連續觀察 10 分鐘
   - 記錄 `CONNECTION_STATE_CHANGED` 與 `onConnected()` 觸發次數
2. **根因修復**
   - 檢查 `background.js` 狀態廣播 gate 是否正確
   - 檢查 `lib/connection.js` 的 `_hasInitialized` / debounce / runtime listener
   - 確保 `scan-all` 僅手動或 alarm 觸發，不由 connect flow 自動觸發
   - 為 `CONNECTION_STATE_CHANGED` 與 `onConnected()` 加入觸發來源標記（cold start / reconnect / alarm / manual）
   - 在 `routes/proactive.js` 為 `POST /api/proactive/scan-all` 增加重入節流與最短間隔保護
3. **驗收條件**
   - Idle 狀態 10 分鐘內不得出現週期性 `models/session/tools/quota/context/scan-all`
   - 只允許 health check 與必要的低頻背景訊號

### Sprint B（P0）— `start.sh` 穩定化

1. 修復 shell 語法錯誤（`(` token）
2. 強化 process lifecycle（trap、pid cleanup、pipe fail handling）
3. 加入啟動前/關閉後檢查（port / pid / exit status）
4. 改善 `.env` 載入安全性（避免 `export $(...)` 對空白與特殊字元的風險）
5. 驗收：連續啟停 5 次均成功、無孤兒程序

### Sprint C（P1）— 已完成（詳見 changelog）

- 原子提交拆分與 working tree 整理已完成，細節與 commit hash 移至 `changelog.md`。

### Sprint D（P1）— Logging / Cache / Temp Files

1. Log 減量：payload 截斷、等級控管、敏感資訊遮罩一致化
2. Cache 收斂：集中 invalidation 規則、避免 stale context
3. Temp files：附件目錄加 TTL cleanup + 容量上限
4. 驗收：
   - debug 模式關閉時，log 量顯著下降
   - 長時間運行（>1hr）臨時檔數量受控
   - 無新增 lint error

---

## i18n 收斂（滾動目標）

- [x] chat runtime 文案收斂
- [x] context runtime 文案收斂
- [x] skills runtime 文案收斂
- [x] mcp runtime 文案收斂
- [ ] tasks runtime 文案收斂
- [x] history runtime 文案收斂

> 目前唯一未完成面板項目：`tasks runtime`。

### 本次更新（2026-02-27）

- [x] `sidebar.js` 連線/Foundry 訊息收斂至 `localizeRuntimeMessage()`
- [x] `lib/agents.js`、`lib/file-upload.js` runtime 訊息收斂
- [x] `lib/panels/{context,history,mcp,skills,usage,helpers}.js` runtime 訊息收斂
- [x] `lib/chat.js` runtime 與模擬回覆文案收斂
- [x] `lib/i18n.js` 補齊缺漏 runtime 字典鍵值

### 已移至 changelog（本輪）

- [x] P1-3：ESLint warnings 清理
- [x] P1-4：Working Tree 原子 commit 整理
- [x] P3-2：`proactive` 模組拆分
- [x] P3-3：`chat` 模組拆分
- [x] P3-6：`proxy.js` launcher build skip（`--no-build` + mtime 檢查）

### 驗收
- [ ] 語言切換（zh-TW/en）不需重整即可更新主要文案
- [ ] lint 維持 `0 errors`

### 下一個最小交付（MVP）

1. 完成 `lib/panels/tasks.js` runtime 字串收斂（`t()` / `localizeRuntimeMessage()`）
2. 補齊 `lib/i18n.js` 必要對應字典
3. 驗證 zh-TW/en 即時切換（不重整）
4. 針對 touched files 再跑一次 lint/diagnostics

---

## 里程碑結論

- P2 已完成，不再列為主風險。
- 目前主線任務轉為 **穩定性回歸修復（P0）** + **未提交工作整理（P1）**。
- 後續優化（i18n/測試）在 P0 穩定後再推進。
