# IQ Copilot Demo Prompt Pack（繁體中文）

英文版本請見 [`DEMO.md`](./DEMO.md)。

---

## 1) 智慧對話助手（直接貼上）

```text
請用 5 點摘要這個頁面，最後補 3 個建議下一步。
```

```text
Please summarize this page in Traditional Chinese with key risks and action items.
```

```text
請把這段內容翻成英文，語氣專業、可直接寄給客戶。
```

```text
Summarize this document and list action items with owner and ETA.
```

```text
Please summarize key issues from this screenshot and propose top 3 fixes.
```

```text
Based on this page, what are the top 3 key points and 2 potential risks?
```

```text
請列出可用快速指令，並示範：切換 model、刷新 skills、切換到 MCP 面板。
```

---

## 2) Multi-Tab + Multi-Session（直接貼上）

### Tab A（產品規格）

```text
請比較 EW805ST 與 EU610ST：解析度、亮度、連接埠、適用情境，最後給採購建議。
```

### Tab B（故障排查）

```text
投影機畫面閃爍，請給我 10 分鐘內可執行的排查流程（由易到難）。
```

### Tab C（會議草稿）

```text
請依據目前討論，產出會議紀錄：摘要、決策、Action items（owner/ETA）、風險。
```

---

## 3) Proactive + Work IQ（直接貼上）

```text
請把這張 proactive 卡片整理成：
1) Executive summary（3 點）
2) Risks / blockers（沒有就寫 None）
3) Next actions（owner + ETA）
4) 5 行 Teams update
```

```text
You are a Work IQ assistant. Format output as:
1) Executive summary (3 bullets)
2) Risks / blockers (write "None" if no blocker)
3) Next actions (with owner and ETA)
4) 5-line Teams-ready update
```

---

## 4) Skills / MCP / microsoftdocs / context7（直接貼上）

### skills / MCP

```text
請列出目前可用 skills，並推薦 3 個最適合「文件整理」的技能。
```

```text
請引導我完成 MCP Config：上傳、驗證、修正、再匯出一份可分享範本。
```

### microsoftdocs

```text
請用 Microsoft 官方文件整理 Azure Functions HTTP trigger 的設定步驟與注意事項。
```

```text
幫我找 Microsoft Learn 上 Azure OpenAI Python SDK 的最新可執行範例。
```

```text
比較 Azure AI Search 的 vector search 與 hybrid search（請以官方文件為準）。
```

```text
請提供 App Service 部署失敗時的官方 troubleshooting 連結與步驟。
```

### context7

```text
用 context7 幫我查 openai python sdk 最新 chat completion 用法，給最小可跑範例。
```

```text
查 express 最新版 middleware 錯誤處理寫法，並給 TypeScript 範例。
```

```text
查 vite 最新環境變數設定方式，說明 dev/prod 差異。
```

```text
查 react hooks 最佳實務（useEffect 依賴）並給簡短範例。
```

---

## 5) Foundry Agent（直接貼上）

### UM (`um-semantic-agent`)

```text
Which projectors support Short Throw?
```

```text
Please list WXGA models and their ports.
```

```text
Compare the port differences between EW805ST and EU610ST.
```

### PKM (`pkm-semantic-agent`)

```text
How do I fix projector screen flickering?
```

```text
Why is there no image? Please provide step-by-step troubleshooting.
```

### Fabric (`fabric-specs-agent`)

```text
What is the resolution of 4KB257?
```

```text
Please list 4K UHD models and their brightness.
```

### 多 Agent（可選）

```text
Which models support Short Throw? Then list the top three with the highest brightness.
```

```text
What is the brightness of AH500ST? Also, what should I do if the image flickers?
```

---

## 6) Foundry 模型（`gen_img`）直接貼上

```text
Generate a modern marketing banner for a short-throw projector launch event, 16:9, clean enterprise style.
```

```text
產生一張「會議室投影解決方案」簡報封面圖，風格簡潔、科技感、藍白色系。
```

---

## 7) Quick Custom Prompt（直接貼上）

```text
Please output:
1) 3 key takeaways
2) Action items (owner / ETA)
3) Risks and blockers
```

```text
把這段內容改寫成：主管 30 秒可讀完的版本 + 執行者待辦版本。
```

---

## 8) Usage / Achievement / History（直接貼上）

```text
請根據目前對話，整理 usage 重點：訊息數、估計 token、工具使用次數、預估節省時間。
```

```text
請幫我總結這個 session 的成果，並轉成可貼 Jira/Planner 的任務列表。
```

```text
請從歷史對話中整理：本週重複出現的 3 個主題與建議標準作法。
```

---

## 9) 安全與隱私（直接貼上）

```text
請用 5 點說明這個方案的資料邊界、權限模型、以及企業環境落地時的注意事項。
```

```text
請列出「不應該貼給 AI 的資料類型」清單，並給替代做法。
```

---

## 15 分鐘順序（最短版）

1. 智慧對話（2 分）
2. Multi-Tab（3 分）
3. Proactive + Work IQ（3 分）
4. Skills/MCP + microsoftdocs + context7 + Foundry Agent（4 分）
5. Foundry 模型 + Quick Prompt（1 分）
6. Usage/History/Security（2 分）
