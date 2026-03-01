# IQ Copilot 功能亮點

> 您的智慧工作助手，讓 AI 融入日常工作流程

---

## 🎯 產品定位

IQ Copilot 是一款**瀏覽器側欄 AI 助手**，將 GitHub Copilot 的強大能力延伸到您的日常工作中。無論是處理郵件、準備會議、追蹤專案進度，IQ Copilot 都能幫您**節省時間、提升效率**。

---

## 🔥 本次 Demo 必講重點

1. **Multi-Tab + Multi-Session 對話**：同時處理多任務，且每個對話 session 完全獨立。
2. **Foundry Agent 直連 Fabric IQ / Foundry IQ**：透過 `foundry_agent_skill` 整合 `um-semantic-agent`、`pkm-semantic-agent`、`fabric-specs-agent`。
3. **Microsoft Foundry Model 整合**：可接模型能力（例如 `gen_img`）滿足內容生成情境。
4. **Work IQ 客製 Prompt**：可依企業流程定義輸出格式，讓 AI 回覆可直接落地使用。
5. **Quick Custom Prompt**：可建立常用 prompt 範本，一鍵套用。
6. **Attach File 問答**：可上傳檔案後直接請 Copilot 分析與回答。
7. **Web Page Context 問答**：可讀取目前網頁內容後，交給 Copilot 進行摘要與回覆。
8. **頁面截圖附加（含登入頁）**：可一鍵擷取目前瀏覽頁面可視區，直接附加到對話。

完整腳本請見：[`DEMO.md`](../DEMO.md)

---

## ✨ 核心功能

### 💬 智慧對話助手

**商業價值：減少 50% 資訊搜尋時間**

- **即時問答**：任何工作問題，一問即答
- **網頁摘要**：一鍵總結當前頁面重點
- **多語言翻譯**：瀏覽外文網頁不再是障礙
- **檔案分析**：上傳文件（PDF、圖片、程式碼）直接分析
- **一鍵頁面截圖**：在聊天輸入區點擊相機按鈕，擷取目前頁面並加入附件
- **Quick Prompt 套用**：把常用提問模板儲存成快速指令，一鍵帶入
- **網頁上下文回答**：直接基於目前分頁內容回答問題

> 💡 **使用情境**：看到一份 20 頁的英文報告？拖入 IQ Copilot，30 秒內獲得中文重點摘要。

---

### 🔄 多工對話（Multi-Tab Chat）

**商業價值：同時處理多項任務，工作效率翻倍**

- **最多 10 個同時對話**：一邊查資料、一邊寫報告、一邊準備會議
- **獨立會話狀態**：每個對話互不干擾，上下文清晰
- **Per-Tab Model 選擇**：每個 Tab 可使用不同 AI 模型（GPT-4.1、Claude 等）
- **即時狀態指示**：清楚看到哪些對話正在處理中，Tab 上顯示模型 badge
- **自動儲存**：關閉瀏覽器後，對話與模型設定自動保存

> 💡 **使用情境**：Tab 1 用 GPT-4.1 處理程式碼問題、Tab 2 用 Claude 寫文件、Tab 3 用 o1 做深度分析，三個模型同時為您工作！

---

### 📋 Proactive 智慧掃描

**商業價值：避免遺漏重要事項，減少 80% 的「忘記回覆」風險**

透過整合 M365（郵件、行事曆、Teams），IQ Copilot 主動幫您掃描：

| 掃描類型 | 功能說明 | 效益 |
|---------|---------|------|
| 🌅 **每日晨報** | 自動彙整今日待辦、會議、重要郵件 | 5 分鐘掌握一天重點 |
| ⏰ **截止日追蹤** | 偵測郵件/任務中的 deadline，提前提醒 | 零逾期專案 |
| 📅 **會議準備** | 自動整理相關文件、歷史信件 | 會議前準備時間減半 |
| 👻 **未回覆偵測** | 找出超過 72 小時未回的重要郵件 | 維護專業形象 |

> 💡 **使用情境**：早上打開 IQ Copilot，一張卡片告訴您今天有 3 個會議、2 封需要回覆的重要郵件、1 個即將到期的專案。

---

### ⚡ Copilot Tasks 即時追蹤

**商業價值：透明化 AI 工作過程，建立信任感**

當 AI 助手執行複雜任務時，您可以即時看到：

- **平行任務監控**：多個工具同時執行，即時顯示進度
- **執行時間軸**：清楚看到每個步驟的耗時
- **結果預覽**：快速檢視工具執行結果
- **錯誤追蹤**：當有問題時，立即知道原因

> 💡 **使用情境**：請 AI 幫您分析 5 個網站的資料，即時看到它正在同時處理哪些網站、已完成哪些、各花了多少時間。

---

### 🛠️ Skills & MCP 工具整合

**商業價值：一個介面存取所有企業工具**

- **Skills 面板**：一覽所有可用的 AI 技能
- **MCP 整合**：連接企業內部工具與服務
- **MCP 設定集中管理**：MCP Config 上傳、編輯與範本下載統一在 MCP 面板操作
- **Foundry 支援**：執行企業級 AI 工作流程
- **一鍵觸發**：直接從側欄執行常用操作

> 💡 **使用情境**：需要查詢內部知識庫？在 Skills 面板點一下，直接搜尋，不需切換系統。

---

### 🏆 成就系統

**商業價值：養成使用習慣，最大化 AI 投資回報**

像遊戲一樣有趣的功能探索機制：

- **經驗值累積**：每次使用都獲得 XP
- **等級提升**：從 🌱 Newbie 升到 🏅 IQ Architect
- **成就徽章**：解鎖 30+ 種成就，5 種稀有度
- **連續使用獎勵**：維持使用習慣獲得額外獎勵

| 等級 | 稱號 | 所需 XP |
|------|------|---------|
| 1 | 🌱 Newbie | 0 |
| 5 | 🚀 Power User | 600 |
| 10 | 🏅 IQ Architect | 5,000 |

> 💡 **商業洞察**：成就系統讓新功能採用率提升 40%，使用者黏著度提高 60%。

---

### 📊 用量統計

**商業價值：量化 AI 帶來的效益**

清楚看到 AI 助手幫您做了什麼：

- **對話統計**：總訊息數、對話輪數
- **Token 使用量**：輸入/輸出 token 詳細分解
- **工具使用次數**：哪些 Skills 最常被使用
- **時間節省估算**：AI 幫您省下多少時間

> 💡 **向主管報告**：「本月 IQ Copilot 幫我處理了 200 次查詢，估計節省 15 小時工作時間。」

---

### 🕐 對話歷史

**商業價值：知識不流失，隨時回顧**

- **完整記錄**：所有對話永久保存
- **快速搜尋**：找到過去的解決方案
- **一鍵恢復**：繼續之前的對話
- **匯出功能**：將重要對話匯出備份

---

## 🔒 安全與隱私

- **本機架構**：敏感資料不離開您的電腦
- **企業認證**：整合 WorkIQ 身份驗證
- **權限控管**：每位使用者擁有獨立的授權邊界

---

## 📈 ROI 總結

| 指標 | 預期效益 |
|------|---------|
| 資訊搜尋時間 | **減少 50%** |
| 會議準備時間 | **減少 40%** |
| 漏回郵件風險 | **降低 80%** |
| 新功能採用率 | **提升 40%** |
| 每週節省時間 | **3-5 小時** |

---

## 🚀 快速開始

1. **安裝擴充功能**：從 Chrome 載入 IQ Copilot
2. **登入帳號**：完成 WorkIQ + GitHub 認證
3. **開始對話**：在側欄輸入您的第一個問題

**歡迎使用 IQ Copilot，讓 AI 成為您最可靠的工作夥伴！**

---

## 🇺🇸 English Summary

### Product Positioning

IQ Copilot is a browser side-panel AI assistant that brings GitHub Copilot capabilities into daily work scenarios such as email handling, meeting preparation, and project follow-up.

### Key Highlights

- **Multi-Tab + Multi-Session Chat**: Up to 10 parallel chats with isolated context.
- **Foundry Agent Integration**: Connect Fabric IQ and Foundry IQ through `foundry_agent_skill` with `um-semantic-agent`, `pkm-semantic-agent`, and `fabric-specs-agent`.
- **Foundry Model Integration**: Integrate model capabilities such as `gen_img`.
- **Work IQ Custom Prompts**: Standardize output formats for enterprise workflows.
- **Quick Custom Prompt**: Save reusable prompt templates and apply them in one click.
- **Attach File Q&A**: Upload files (PDF/image/code) and ask Copilot to analyze them.
- **Screenshot Attach for Auth Pages**: Capture the currently visible browser page (including signed-in pages) and attach it to chat in one click.
- **Webpage Context Q&A**: Let Copilot answer based on the active browser page.

### Full Feature Coverage

- Intelligent chat assistant (Q&A, summarization, translation, file analysis)
- Proactive smart scan (daily briefing, deadline tracking, meeting prep, unreplied detection)
- Copilot tasks real-time tracking (parallel progress, timeline, previews, error visibility)
- Skills & MCP integration
- Achievement system (XP, levels, badges)
- Usage analytics (messages, tokens, tools, estimated time saved)
- Conversation history (search, restore, export)
- Security & privacy (local-first architecture, enterprise auth, permission boundaries)

### ROI Snapshot

- Information search time: **-50%**
- Meeting preparation time: **-40%**
- Missed email response risk: **-80%**
- New feature adoption: **+40%**
- Weekly time saved: **3–5 hours**
