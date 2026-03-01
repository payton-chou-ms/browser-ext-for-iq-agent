# CI/CD Flow Plan

## 目標
- Extension 發佈包只包含執行期必要檔案（避免把測試、文件、原始碼雜項一起發佈）。
- 本機 Proxy/Companion（`dist/proxy.js`）採分離產物，避免和 extension zip 綁在一起。

## Pipeline 階段

### 1) Validate（PR 與 main 都跑）
1. 安裝依賴：`npm ci`
2. Lint：`npm run lint`
3. Type Check：`npm run typecheck`
4. Unit Test：`npm run test:unit`
5. E2E Test（可依分支策略啟用）：`npm test`

### 2) Build
1. 同步版本：`npm run prebuild`
2. 建置：`npm run build`
   - 產生/更新：
     - `dist/proxy.js`
     - `src/achievement-engine.js`

### 3) Package（核心）

#### A. Extension Artifact（必要）
以 `manifest.json` 為準建立最小化 zip，至少包含：
- `manifest.json`
- `icons/**`
- `src/background.js`
- `src/content_script.js`
- `src/sidebar.html`
- `src/sidebar.css`
- `src/sidebar.js`
- `src/copilot-rpc.js`
- `src/achievement-engine.js`
- `src/lib/**`

> 原則：只打包 manifest 引用與 runtime 直接依賴檔案。

#### B. Companion Artifact（可選）
若要一起交付本機服務：
- `dist/proxy.js`
- `start.sh`
- 必要說明（例如 README 節點）

> 建議與 extension zip 分開發布，方便版本治理與回滾。

### 4) Release Gate
- 僅 `main` tag/release 時上傳 artifact。
- Gate 條件：Validate + Build 全綠。
- 發佈前檢查：
  - `manifest.json` 版本是否正確
  - zip 內容是否只含必要檔案
  - 無敏感資訊（token / secret / `.env`）

## 建議產物命名
- `iq-copilot-extension-${version}.zip`
- `iq-copilot-companion-${version}.zip`（可選）

## 參考打包命令（示意）

```bash
# Extension
zip -r iq-copilot-extension-${VERSION}.zip \
  manifest.json \
  icons \
  src/background.js \
  src/content_script.js \
  src/sidebar.html \
  src/sidebar.css \
  src/sidebar.js \
  src/copilot-rpc.js \
  src/achievement-engine.js \
  src/lib

# Companion (optional)
zip -r iq-copilot-companion-${VERSION}.zip \
  dist/proxy.js \
  start.sh \
  README.md
```

## 實作備註
- 現有 docs 裡舊的 zip 範例路徑可能與現行 `src/*` 結構不一致，後續可同步更新。
- 若未來 `manifest.json` 新增資源（例如新 script 或 web_accessible_resources），需同步更新打包白名單。
