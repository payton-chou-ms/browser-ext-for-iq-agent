# Browser Extension 自動測試注意事項

這個專案使用 `Playwright` 做 extension E2E 測試，主要測試檔在：

- `tests/extension.spec.js`

## 先決條件

- 先安裝依賴：`npm install`
- 使用 `npm` 指令執行（scripts 已在 `package.json` 設定）

## 常用指令

- 跑全部測試：`npm test`
- UI 模式（推薦開發時使用）：`npm run test:ui`
- 除錯模式：`npm run test:debug`
- 有畫面執行：`npm run test:headed`
- 看報告：`npm run test:report`
- 檔案變更自動重跑（目前針對 extension 測試）：`npm run test:watch`

## Extension 測試重點

- 測試會用 `launchPersistentContext` 啟動瀏覽器，並透過參數載入 extension。
- 每次測試都會重新建立瀏覽器 context，通常不需要手動 reload extension。
- 測試中會抓取 background service worker URL 來取得 extension id。
- 測試頁面會直接開 `chrome-extension://<extension-id>/sidebar.html`。

## 目前已覆蓋的基本功能測試

- Sidebar 主要 UI 載入（輸入框、placeholder、welcome 訊息）
- 左側導覽切換（Chat / Context）
- Suggestion chip 互動（點擊後送出訊息與收到回覆）
- Connection settings 按鈕可切換到 Config 面板
- New Chat 可重置對話並顯示初始 welcome

## 使用 `test:watch` 時要注意

- `test:watch` 啟動後會先跑一次測試，再監看檔案變更自動重跑。
- 按 `Ctrl + C` 可停止監看。
- 已忽略資料夾：`node_modules`、`.git`、`playwright-report`、`test-results`，避免無限觸發。
- 監看副檔名：`.js`、`.mjs`、`.cjs`、`.json`、`.html`、`.css`。

## 常見問題

- 如果測試卡住或瀏覽器殘留，先中止流程後重跑一次 `npm run test:watch`。
- 如果測試失敗，先看 `npm run test:report` 的 trace 與 screenshot。
- 若你同時有其他長時間跑的 `node proxy.js`，建議分開 terminal 執行，避免互相干擾。
