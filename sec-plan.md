# Security Plan: Secrets & CI/CD 設計原則

## 涉及的 Secrets

| Secret | 用途 | 生命週期 |
|--------|------|----------|
| **Azure Foundry API Key** | 呼叫 Azure AI model endpoint | 長期，需定期 rotate |
| **Copilot SDK Token** | CLI `copilot` 認證（`GITHUB_TOKEN`） | 短期，per-session |
| **Chrome Web Store API** | 自動發佈 extension | CI 專用 |

---

## 架構原則

```
Extension 本身 ── 零 secrets（純 UI client）
     │
     ▼
Proxy (proxy.js) ── runtime 注入 secrets
     │
     ▼
Copilot CLI / Azure Foundry ── 真正持有 credentials
```

---

## 分層設計

### 1. Extension 端（前端）— 絕對不放 secrets

- Extension 只知道 `localhost:8321`（proxy 位址）
- 用 `chrome.storage.local` 存 host/port
- Foundry key 和 token **永遠不進** manifest 或 JS 檔

### 2. Proxy 端（proxy.js）— 環境變數注入

```javascript
// 從環境變數讀取，不 hardcode
const FOUNDRY_ENDPOINT = process.env.FOUNDRY_ENDPOINT;
const FOUNDRY_KEY = process.env.FOUNDRY_API_KEY;

// Copilot SDK 認證走 CLI 本身的 auth（gh auth）
const client = new CopilotClient({
  cliUrl: `localhost:${cliPort}`
  // token 由 CLI 管理，proxy 不需要直接持有
});
```

### 3. 本機開發 — `.env` 檔

```bash
# .env （必須加入 .gitignore）
FOUNDRY_ENDPOINT=https://xxx.openai.azure.com/
FOUNDRY_API_KEY=sk-xxxxx
```

```bash
# start.sh 裡加一行載入 .env
[[ -f .env ]] && export $(grep -v '^#' .env | xargs)
```

### 4. CI/CD — GitHub Secrets

```yaml
# .github/workflows/ci.yml
env:
  FOUNDRY_API_KEY: ${{ secrets.FOUNDRY_API_KEY }}
  FOUNDRY_ENDPOINT: ${{ secrets.FOUNDRY_ENDPOINT }}

# 發佈用
  CHROME_EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
  CHROME_CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
  CHROME_REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}
```

### 5. 使用者端部署 — Config Panel

```
┌─ 設定 ─────────────────────────┐
│ Proxy Host:  [localhost]        │
│ Proxy Port:  [8321]             │
│ ─────────────────────────────── │
│ Azure Foundry (選填)            │
│ Endpoint:    [...............]  │
│ API Key:     [••••••••••••••]  │
│              [儲存] [測試連線]   │
└─────────────────────────────────┘
```

- 存入 `chrome.storage.local`（一般設定）
- 敏感 key 用 `chrome.storage.session`（只存於記憶體，瀏覽器關閉即清除）
- Proxy 啟動時從 extension 接收，或從環境變數讀取

---

## 關鍵安全規則

1. **`.gitignore`** — 確保 `.env`, `*.key`, `*.pem` 被排除
2. **`chrome.storage.session`** — 敏感 key 用 session storage（瀏覽器關閉即清除）
3. **Proxy 只聽 `127.0.0.1`** — 不暴露到外部網路（已實作 ✅）
4. **Secret rotation** — CI 用 GitHub Environments + 審批保護 production secrets
5. **不 log secrets** — proxy 的 `log()` 要過濾包含 key 的字串
6. **CSP 嚴格化** — Manifest V3 不允許 `eval`/inline script，CI 掃描違規
7. **權限最小化** — 審核 `permissions` 和 `host_permissions` 是否過度授權
