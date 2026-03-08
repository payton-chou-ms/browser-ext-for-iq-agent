# v1.1.1 Release / Build 整理計畫

> 範圍：版本號、GitHub Release 資產、extension zip、local_proxy zip、backend 搭配方式  
> 日期：2026-03-08  
> 語言：繁體中文

## Summary Status

- [x] Git tag / GitHub Release 已經是 `v1.1.1`
- [x] 已確認 release asset 檔名目前仍來自 `package.json` / `manifest.json`
- [x] 已確認 browser extension 與 local_proxy 是兩個不同資產
- [x] 已確認 `.github/skills/foundry_agent_skill/` 與 `.github/skills/gen-img/` 存在於 repo
- [x] 已確認這兩個 sample skills 目前沒有被包進 release artifact
- [x] 已決定 artifact 命名採 `tag + commit 前 6 碼`
- [x] 已決定日常 release / build 不要求每次都改 `package.json` / `manifest.json`
- [x] 已決定將 `companion` 命名統一改為 `local_proxy`

## 現況確認

- [x] workflow 目前流程是：
  - `npm run prebuild`
  - `src/scripts/sync-version.mjs` 把 `package.json` 同步到 `manifest.json`
  - workflow 從 `manifest.json` 讀出版本
  - 產出 `iq-copilot-extension-${VERSION}.zip`
  - 產出 `iq-copilot-local_proxy-${VERSION}.zip`
- [x] extension zip 是瀏覽器擴充本體，不包含 `dist/proxy.js`
- [x] local_proxy zip 才是本地 backend / proxy 的可分發包
- [x] local_proxy 目前應被視為 browser extension 的配套執行元件，不是獨立 SaaS backend
- [x] 已發佈的 `v1.1.1` release 應視為 immutable，不建議回頭覆蓋既有資產

## Release Todo

### Phase 1：調整 artifact 命名

- [x] 在 workflow 取得 release tag / ref name
- [x] 在 workflow 取得 `GITHUB_SHA` 前 6 碼
- [x] 將 extension artifact 改名為 `iq-copilot-extension-<tag>-<sha6>.zip`
- [x] 將 local_proxy artifact 改名為 `iq-copilot-local_proxy-<tag>-<sha6>.zip`
- [x] 確認新命名不依賴 `package.json` / `manifest.json` bump

預期範例：

- `iq-copilot-extension-v1.1.1-b83066.zip`
- `iq-copilot-local_proxy-v1.1.1-b83066.zip`

### Phase 2：把 sample skills 包進 local_proxy

- [x] 在 local_proxy zip 內加入 `.github/skills/foundry_agent_skill/`
- [x] 在 local_proxy zip 內加入 `.github/skills/gen-img/`
- [x] 排除 `.env`
- [x] 排除 `.venv/`
- [x] 若排除 `.venv/`，補上對應的 `requirements.txt`
- [x] 排除任何 secrets / local caches
- [x] 確認至少保留以下內容：
  - `SKILL.md`
  - `README.md`
  - `scripts/`
  - `.env.example`
  - `requirements.txt`（若 skill 依賴 Python 環境）

預期 local_proxy zip 內容：

- `dist/proxy.js`
- `start.sh`
- `README.md`
- `package.json`
- `package-lock.json`
- `.github/skills/foundry_agent_skill/`
- `.github/skills/gen-img/`

### Phase 3：補文件與 release note

- [x] 在 README 說明 `extension zip` 是瀏覽器擴充本體
- [x] 在 README 說明 `local_proxy zip` 是本地 backend proxy
- [x] 在 README 說明 `local_proxy zip` 內含 `foundry_agent_skill` 與 `gen-img`
- [x] 在 README 說明完整使用流程：
  - 解壓 `local_proxy`
  - 執行 `./start.sh`
  - 讓 `start.sh` 在需要時自動安裝 runtime dependencies
  - 在瀏覽器載入 extension
  - extension 指向本地 `127.0.0.1:8321`
- [x] 在 release note 說明 `local_proxy zip` 內含 `foundry_agent_skill` 與 `gen-img`
- [x] 在 release note 說明完整使用流程
- [x] 在 release note 強調若只下載 extension，WorkIQ / Foundry / Copilot SDK 路徑不會完整工作

### Phase 4：定義 local_proxy 定位

- [ ] 在文件中明講 `local_proxy` 是本地執行的 proxy / launcher
- [ ] 在文件中明講 `local_proxy` 是 browser extension 的配套執行元件
- [ ] 若未來要提供獨立 backend 版，再另外定義：
  - 部署方式
  - 設定方式
  - 認證模式
  - extension 連線模型

## 建議執行順序

- [ ] 先改 release pipeline 的 artifact 命名
- [ ] 再把 `foundry_agent_skill` 與 `gen-img` 包進 local_proxy zip
- [ ] 最後補 README / release note 的下載與使用說明

## 完成後應解決的問題

- [ ] release 檔名仍顯示舊版號
- [ ] sample GitHub skills 沒有被包出去
- [ ] 使用者不知道哪個 zip 是什麼
- [ ] backend / extension 關係不清楚
