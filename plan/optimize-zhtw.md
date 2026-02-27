# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-02-27（P1 TypeScript 漸進遷移完成：proxy → achievement-engine）
> 已完成項目請參考 → [changelog.md](changelog.md)

---

## 專案概覽（最新狀態 2026-02-27）

| 檔案 | 行數 | 職責 |
|------|------|------|
| `sidebar.js` | 391 | Bootstrap（初始化/事件綁定/模組 wiring）✅ 已完成拆分 |
| `sidebar.css` | 3,375 | 所有 UI 樣式 |
| `sidebar.html` | 856+ | DOM 結構 + script 載入順序 |
| `proxy.ts` | 558 | HTTP 代理伺服器來源（strict TS） |
| `proxy.js` | 14 | 啟動器（啟動前自動 build） |
| `routes/core.ts` | 173 | 核心 API 路由（strict TS）✅ |
| `routes/session.ts` | 219 | Session 管理 API（strict TS）✅ |
| `routes/schemas.ts` | 67 | Zod schema 定義（strict TS）✅ |
| `routes/foundry.ts` | 91 | Foundry Agent API（strict TS）✅ |
| `routes/proactive.ts` | 123 | Proactive Agent API（strict TS）✅ |
| `achievement-engine.ts` | 853 | 成就系統引擎（strict TS） |
| `background.js` | 368 | Service Worker |
| `copilot-rpc.js` | 305 | REST 客戶端 |
| `start.sh` | 194 | 啟動腳本 |
| **lib/ 核心模組** | | |
| `lib/state.js` | 38 | CONFIG 常數、全域狀態 |
| `lib/utils.js` | 187 | toast/cache/debug utilities |
| `lib/i18n.js` | 408 | I18N 字典 + `t()` + `translateStaticUi()` |
| `lib/theme.js` | 42 | `applyTheme()` + `applyLanguage()` |
| `lib/connection.js` | 225 | 連線狀態、runtime router |
| `lib/chat.js` | 559 | 對話狀態、streaming |
| `lib/chat-session.js` | 90 | session 管理 |
| `lib/chat-streaming.js` | 272 | SSE streaming 處理 |
| `lib/agents.js` | 203 | agent 管理與 UI |
| `lib/file-upload.js` | 245 | 附件上傳/預覽/貼上 |
| **lib/panels/ 面板模組** | | |
| `lib/panels/helpers.js` | 116 | 共用渲染函數 |
| `lib/panels/usage.js` | 234 | 使用量統計面板 |
| `lib/panels/context.js` | 170 | 上下文面板 |
| `lib/panels/history.js` | 110 | 歷史紀錄面板 |
| `lib/panels/mcp.js` | 223 | MCP 配置面板 |
| `lib/panels/skills.js` | 259 | Skills 面板 |
| `lib/panels/tasks.js` | 235 | 任務面板 |
| `lib/panels/achievements.js` | 292 | 成就面板 |
| `lib/panels/proactive.js` | 27 | Proactive 入口 |
| `lib/panels/proactive-render.js` | 380 | Proactive UI 渲染 |
| `lib/panels/proactive-scan.js` | 175 | Proactive 掃描邏輯 |
| `lib/panels/proactive-state.js` | 165 | Proactive 狀態管理 |

---

## Code Quality 待解決問題（更新 2026-02-27）

| 嚴重度 | 問題 | 說明 | 狀態 |
|--------|------|------|------|
| ~~CRITICAL~~ | ~~sidebar.js 巨型單體~~ | ✅ 已從 ~4,140 行拆分至 391 行，12+ 模組已抽出 | DONE |
| ~~HIGH~~ | ~~缺少 TypeScript~~ | ✅ `proxy.ts` + `routes/*.ts` + `achievement-engine.ts` | DONE |
| ~~HIGH~~ | ~~缺少 Linter~~ | ✅ ESLint v10 + typescript-eslint 已安裝 | DONE |
| **HIGH** | 測試覆蓋率不足 | 僅 5 個 E2E，無 unit test | P1 |
| ~~MEDIUM~~ | ~~大量 inline style~~ | ✅ 已消除：33 → 7 個 | DONE |
| **MEDIUM** | 全域變數污染 | lib/ 已 namespace 化，sidebar.js 仍有少量全域函數 | P2 |
| **LOW** | i18n 不完整 | tasks runtime 字串尚未收斂，其餘已完成 | P3 |
| ~~LOW~~ | ~~README 簡短~~ | ✅ 已擴充含架構圖、安裝步驟 | DONE |

---

## 進度總覽（更新 2026-02-27）

```
Phase 0 (P0) — 修復無限迴圈          ✅ DONE
Phase 1 (P1) — 網路效率優化          ✅ DONE
Phase 4 (P4) — proxy.js 強化         ✅ DONE
─────────────────────────────────────────
Phase 2 (P2) — sidebar.js 拆分       ✅ DONE（391L + 12模組）
Phase 3 (P3) — Memory & DOM 優化     ✅ DONE
Phase 5 (P5) — Code Quality          ✅ DONE
─────────────────────────────────────────
TypeScript 遷移                       ✅ proxy.ts + routes/*.ts + achievement-engine.ts
─────────────────────────────────────────
剩餘 P0 待修: start.sh 穩定性 + Idle 請求風暴
剩餘 P1 待做: routes/foundry.ts + routes/proactive.ts + unit tests
```

---

## Phase 2 — sidebar.js 拆分 ✅ DONE

### 當前架構（已完成）

```
sidebar.js (391 行 bootstrap) ✅
└── lib/
    ├── state.js            ✅ 全域狀態管理 (38L)
    ├── utils.js            ✅ toast/cache/debug utilities (187L)
    ├── i18n.js             ✅ I18N 字典 + t() (408L)
    ├── theme.js            ✅ applyTheme() + applyLanguage() (42L)
    ├── connection.js       ✅ checkConnection() + onConnected() (225L)
    ├── chat.js             ✅ 對話狀態、streaming (559L)
    ├── chat-session.js     ✅ session 管理 (90L)
    ├── chat-streaming.js   ✅ SSE streaming 處理 (272L)
    ├── agents.js           ✅ agent 管理與 UI (203L)
    ├── file-upload.js      ✅ 附件上傳/預覽/貼上 (245L)
    └── panels/
        ├── helpers.js      ✅ 共用渲染函數 (116L)
        ├── usage.js        ✅ 使用量統計 (234L)
        ├── context.js      ✅ 上下文面板 (170L)
        ├── history.js      ✅ 歷史紀錄 (110L)
        ├── mcp.js          ✅ MCP 配置 (223L)
        ├── skills.js       ✅ Skills CRUD (259L)
        ├── tasks.js        ✅ 任務監控 (235L)
        ├── achievements.js ✅ 成就系統 UI (292L)
        ├── proactive.js    ✅ Proactive 入口 (27L)
        ├── proactive-render.js  ✅ UI 渲染 (380L)
        ├── proactive-scan.js    ✅ 掃描邏輯 (175L)
        └── proactive-state.js   ✅ 狀態管理 (165L)
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

### Checklist（已完成）

- [x] 2.1 建立 `lib/` 目錄結構
- [x] 2.2 抽取 `state.js`（38L）+ `utils.js`（187L）
- [x] 2.3 抽取 `i18n.js`（408L）+ `theme.js`（42L）
- [x] 2.4 抽取 `connection.js`（225L）+ `chat.js`（559L）+ `agents.js`（203L）+ `file-upload.js`（245L）
- [x] 2.4b 抽取 `chat-session.js`（90L）+ `chat-streaming.js`（272L）
- [x] 2.5 抽取 `panels/helpers.js`（116L）
- [x] 2.6 抽取 `panels/*.js`（8/8 完成：usage, context, history, mcp, skills, tasks, proactive, achievements）
- [x] 2.7 sidebar.js 瘦身為 bootstrap（391 行）
- [x] 2.8 更新 sidebar.html script 載入順序

---

## Future Work（優化計畫之外）

| 優先級 | 任務 | 狀態 |
|--------|------|------|
| ~~P0~~ | ~~ESLint + Prettier~~ | ✅ ESLint v10 已安裝（0 errors） |
| ~~P1~~ | ~~遷移至 TypeScript~~ | ✅ proxy.ts + routes/{core,session,schemas}.ts + achievement-engine.ts |
| **P1** | Unit Tests | 待達 80% 覆蓋率 |
| ~~P1~~ | ~~消除 inline styles~~ | ✅ 33 → 7 |
| ~~P2~~ | ~~Zod 驗證~~ | ✅ proxy route handler 完整 schema 驗證 |
| ~~P2~~ | ~~模組化 proxy.js~~ | ✅ 已拆為 `routes/*.ts` |
| ~~P2~~ | ~~完善 README~~ | ✅ 已補架構圖、安裝步驟、開發指南 |
| ~~P3~~ | ~~Bundler~~ | ✅ esbuild 打包（tree-shaking 啟用） |
| **P3** | 完善 i18n | ⬼ tasks runtime 字串待收斂，其餘已完成 |

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
