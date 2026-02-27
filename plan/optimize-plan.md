# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-02-27（P1 TypeScript 漸進遷移完成：proxy → achievement-engine）
> 已完成項目請參考 → [changelog.md](changelog.md)

---

## 專案概覽

| 檔案 | 行數 | 職責 |
|------|------|------|
| `sidebar.js` | ~4,140 | 主 UI 邏輯（巨型單體，待 P2 拆分） |
| `sidebar.css` | 3,375 | 所有樣式 |
| `sidebar.html` | 856 | DOM 結構 |
| `proxy.ts` | 526 | HTTP 代理伺服器來源（esbuild → `dist/proxy.js`） |
| `proxy.js` | 14 | 啟動器（啟動前自動 build，再載入 `dist/proxy.js`） |
| `achievement-engine.ts` | 694 | 成就系統引擎來源（build 輸出 `achievement-engine.js`） |
| `background.js` | 368 | Service Worker |
| `copilot-rpc.js` | 305 | REST 客戶端 |
| `start.sh` | 194 | 啟動腳本 |
| `content_script.js` | 33 | 內容腳本 |
| `lib/state.js` | 38 | CONFIG 常數、全域狀態 |
| `lib/utils.js` | 168 | showToast, debugLog, switchPanel |
| `lib/i18n.js` | 332 | I18N 物件 + `t()` + `translateStaticUi()` |
| `lib/theme.js` | 42 | `applyTheme()` + `applyLanguage()` |
| `lib/connection.js` | 225 | `checkConnection()` + runtime message router |
| `lib/chat.js` | 552 | sendMessage, ensureSession, streaming |
| `lib/agents.js` | 204 | agent 系統, fleet mode |
| `lib/file-upload.js` | 246 | drag-drop, paste, processAttachment |
| `lib/panels/helpers.js` | 114 | renderProgressBar, renderQuotaBar, renderModelItem |
| `lib/panels/usage.js` | 236 | updateStats, renderModelsCard, switchModel |
| `lib/panels/context.js` | 169 | fetchCliContext, renderContext |
| `lib/panels/history.js` | 108 | session history search |
| `lib/panels/mcp.js` | 223 | MCP config panel |

---

## Code Quality 待解決問題

| 嚴重度 | 問題 | 說明 | 對應 Phase |
|--------|------|------|-----------|
| **CRITICAL** | sidebar.js 巨型單體 | ~4,140 行，違反 800 行上限（已抽出 12 個 lib/ 模組，含 4 個 panel） | Phase 2 |
| **HIGH** | 缺少 TypeScript | 全專案純 JS，無型別安全 | Future |
| **HIGH** | 缺少 Linter / Formatter | ESLint v10 ✅ 已安裝；Prettier 待定 | Future |
| **HIGH** | 測試覆蓋率不足 | 僅 5 個 E2E，無 unit test | Future |
| **MEDIUM** | ~~大量 inline style~~ | ✅ 已消除：33 → 7 個（剩餘皆為動態 width/CSS var） | ~~Phase 5~~ DONE |
| **MEDIUM** | 全域變數汙染 | lib/ 已 namespace 化；sidebar.js 內仍有全域函數 | Phase 2/5 |
| **MEDIUM** | 部分 mutation 模式 | `arr.length = 0` 直接修改陣列 | Future |
| **LOW** | i18n 不完整 | ✅ Proactive 區塊已改走 `t()`；其餘 runtime 字串持續收斂中 | Future |
| **LOW** | README 已擴充 | 80 行，含架構圖、安裝步驟（Future Work ✅） | — |

---

## 進度總覽

```
Phase 0 (P0) — 修復無限迴圈          ✅ DONE
Phase 1 (P1) — 網路效率優化          ✅ DONE
Phase 4 (P4) — proxy.js 強化         ✅ DONE
─────────────────────────────────────────────
Phase 2 (P2) — sidebar.js 拆分       🔶 ~2 hrs remaining（核心模組已抽出）
Phase 3 (P3) — Memory & DOM 優化     ✅ DONE
Phase 5 (P5) — Code Quality          ✅ DONE (5.4 awaits P2)
─────────────────────────────────────────────
                              剩餘合計 ~2 hrs
```

---

## Phase 2 — sidebar.js 拆分 🔶 ~2 hrs remaining

### 目標架構

```
sidebar.js (~4,140 → ~200 行 bootstrap)
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
        ├── helpers.js      ✅ renderProgressBar, renderQuotaBar, renderModelItem
        ├── usage.js        ✅ updateStats, renderModelsCard, switchModel (236L)
        ├── context.js      ✅ fetchCliContext, renderContext (169L)
        ├── history.js      ✅ session history search (108L)
        ├── mcp.js          ✅ MCP config panel (223L)
        ├── skills.js       ⬜ loadSkills, custom skills CRUD
        ├── tasks.js        ⬜ parallel task monitoring
        ├── proactive.js    ⬜ proactive agent 全套
        └── achievements.js ⬜ gamification UI
```

### 拆分策略

1. **不使用 bundler**（MV3 限制）— `<script>` tag 順序載入
2. 每個模組 export 到 `window.IQ.*` namespace
3. sidebar.js 瘦身為 bootstrap：init → bindEvents
4. 順序：先拆獨立模組（i18n, utils, theme）→ 再拆 panels

### sidebar.html 載入順序

```html
<!-- 基礎 -->
<script src="lib/state.js"></script>         ✅ 已載入
<script src="lib/utils.js"></script>         ✅ 已載入
<script src="lib/i18n.js"></script>          ⬜ 待載入（code 已就緒）
<script src="lib/theme.js"></script>         ⬜ 待載入（code 已就緒）

<!-- 核心 -->
<script src="lib/connection.js"></script>    ✅ 已載入
<script src="lib/chat.js"></script>          ✅ 已載入
<script src="lib/agents.js"></script>        ⬜ 待載入（code 已就緒）
<script src="lib/file-upload.js"></script>   ⬜ 待載入（code 已就緒）

<!-- Helpers -->
<script src="lib/panels/helpers.js"></script> ✅ 已載入

<!-- Panels（4/8 已建立，尚未載入） -->
<script src="lib/panels/usage.js"></script>        ✅ code 已就緒（236L）
<script src="lib/panels/context.js"></script>      ✅ code 已就緒（169L）
<script src="lib/panels/history.js"></script>      ✅ code 已就緒（108L）
<script src="lib/panels/mcp.js"></script>          ✅ code 已就緒（223L）
<script src="lib/panels/skills.js"></script>       ⬜ 尚未建立
<script src="lib/panels/tasks.js"></script>        ⬜ 尚未建立
<script src="lib/panels/proactive.js"></script>    ⬜ 尚未建立
<script src="lib/panels/achievements.js"></script> ⬜ 尚未建立

<!-- 成就引擎 + Bootstrap -->
<script src="achievement-engine.js"></script> ✅ 已載入
<script src="sidebar.js"></script>            ✅ 已載入
```

### Checklist

- [x] 2.1 建立 `lib/` 目錄結構
- [x] 2.2 抽取 `state.js`（38L）+ `utils.js`（168L）
- [x] 2.3 抽取 `i18n.js`（332L）+ `theme.js`（42L）— code 就緒，sidebar.html 尚未載入
- [x] 2.4 抽取 `connection.js`（225L）+ `chat.js`（552L）+ `agents.js`（204L）+ `file-upload.js`（246L）
- [x] 2.4b 抽取 `panels/helpers.js`（114L）
- [ ] 2.5 抽取 `panels/*.js`（4/8 完成：✅ usage, context, history, mcp；⬜ skills, tasks, proactive, achievements）
- [ ] 2.6 sidebar.js 瘦身為 bootstrap（目前 ~4,140 行 → 目標 < 200 行）
- [ ] 2.7 更新 sidebar.html script 載入順序（目前載入 7 個 lib/；待加 i18n, theme, agents, file-upload + 8 panels）

---

## Future Work（優化計畫之外）

| 優先級 | 任務 | 說明 |
|--------|------|------|
| P0 | ESLint + Prettier | ✅ ESLint v10 已安裝（0 errors, 31 warnings）；Prettier 待定 |
| P1 | 遷移至 TypeScript | ✅ 漸進式完成：`proxy.ts` → `achievement-engine.ts`，`proxy.js` 改為 build launcher |
| P1 | Unit Tests | 達 80% 覆蓋率（achievement-engine, copilot-rpc） |
| P1 | ~~消除 inline styles~~ | ✅ 33 → 7（剩餘為動態 width% / CSS custom property） |
| P2 | Zod 驗證 | ✅ proxy.js route handler 完整 schema 驗證 |
| P2 | 模組化 proxy.js | ✅ 已拆為 `routes/*.js` |
| P2 | 完善 README | ✅ 已補架構圖、安裝步驟、開發指南、截圖章節 |
| P3 | Bundler | ✅ 已加入 esbuild 打包（tree-shaking 啟用） |
| P3 | 完善 i18n | ⏳ 進行中：Proactive 區塊 runtime 字串已收斂至 `t()`；其餘面板持續收斂至 `t()` / `localizeRuntimeMessage()` |

### P3 完善 i18n — 可執行子項（面板拆解）

> 目標：將 runtime UI 文案從硬編碼改為 `t()` / `localizeRuntimeMessage()`，並確保中英文切換可即時反映。

#### 6 個面板子項

- [ ] **chat**
    - 範圍：chat 輸入提示、送出/錯誤提示、streaming 狀態、快捷操作文案
    - 完成定義：`sidebar.js` chat 區塊 runtime 字串改走 `t()`；語言切換後不需重整即可更新

- [ ] **context**
    - 範圍：Context 卡片標題、欄位標籤、空狀態與錯誤提示
    - 完成定義：context panel runtime 文案 0 硬編碼（僅保留資料值）；fallback 文案皆可翻譯

- [ ] **skills**
    - 範圍：Skills 載入中/空狀態/錯誤、按鈕與提示訊息
    - 完成定義：skills panel 文字統一走 `t()` 或 `localizeRuntimeMessage()`；載入/失敗訊息雙語一致

- [ ] **mcp**
    - 範圍：MCP 設定讀寫提示、JSON 驗證訊息、按鈕與狀態文案
    - 完成定義：mcp panel runtime 字串收斂，錯誤訊息前綴與成功 toast 可翻譯

- [ ] **tasks**
    - 範圍：Task timeline 標題、進度狀態、結果摘要與操作按鈕
    - 完成定義：tasks panel 主要互動文案改走 i18n；執行中/完成/失敗狀態雙語一致

- [ ] **history**
    - 範圍：搜尋 placeholder、空清單文案、刪除/恢復相關提示
    - 完成定義：history panel runtime 字串收斂，搜尋與操作回饋可翻譯

#### 驗收標準（P3 i18n）

- [ ] 六個面板 runtime 文案完成上述收斂
- [ ] 語言切換（zh-TW/en）不需重整即可更新主要 UI 文案
- [ ] `npm run lint -- sidebar.js` 結果維持 **0 errors**
