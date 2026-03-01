# IQ Copilot — Documentation Index

> 回到專案入口：[README.md](../README.md)

---

## 📚 Documents

| Document | Description |
|----------|-------------|
| [FEATURES.md](./FEATURES.md) | 功能亮點、三大 IQ 平台協同、Business Impact 與 ROI |
| [DEMO.md](./DEMO.md) | Demo 腳本與可直接貼上的 Prompt Pack |
| [architecture.md](./architecture.md) | 系統架構深入解析（分層、路由、資料流、Mermaid 圖表） |
| [cicd_flow.md](./cicd_flow.md) | CI/CD 流程與打包說明 |
| [E2E-TESTING.md](./E2E-TESTING.md) | Playwright E2E 測試指南與 Demo 情境對照 |

---

## 🗂️ Archive

| Document | Description |
|----------|-------------|
| [archive/challenge-analysis.md](./archive/challenge-analysis.md) | 早期 Hackathon 差距分析（歷史參考） |
| [archive/README.md](./archive/README.md) | Archive 索引 |

---

## 🛡️ Responsible AI (RAI) Notes

### 資料處理
- **本地優先**：所有對話處理在使用者本機進行，對話歷史僅存於 Chrome local storage
- **最小權限**：僅請求 `activeTab`、`sidePanel`、`tabs`、`storage`、`alarms`

### 隱私保護
- 頁面內容擷取需使用者明確觸發
- 不自動收集或傳送瀏覽歷史
- Token 用量統計僅保存於本地

### 透明度
- 所有工具執行狀態即時顯示
- API 呼叫次數與 token 消耗可追蹤
- 模型選擇與能力限制清楚標示

### 限制聲明
- AI 回應可能不準確，使用者應驗證重要資訊
- 不應用於處理機密或敏感個人資料
- 企業環境應配合組織 AI 使用政策
