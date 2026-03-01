# IQ Copilot 功能亮點

> 最後更新：2026-03-01
> 您的智慧工作助手 — 將 GitHub Copilot、Foundry IQ、Work IQ、Fabric IQ 整合成一個瀏覽器側欄 AI 體驗

---

## 🎯 產品定位

IQ Copilot 是一款**瀏覽器側欄 AI 助手**，以 GitHub Copilot 為核心引擎，透過統一介面串聯三大企業 IQ 平台：

| IQ 平台 | 角色 | IQ Copilot 整合方式 |
|---------|------|---------------------|
| **Foundry IQ** | 企業知識 Agent（產品手冊查詢、售後排障） | `/foundry_agent_skills` 斜線命令 → Foundry Agent Service |
| **Work IQ** | M365 工作資料（郵件、行事曆、Teams、OneDrive） | `/workiq` 斜線命令 + Proactive 智慧掃描 |
| **Fabric IQ** | 產品規格資料庫（結構化規格比較） | `fabric-specs-agent` 透過 Foundry Agent Service 存取 |

> **一句話價值**：員工不需要在多個系統之間切換，只要開啟 IQ Copilot 側欄，就能從「查知識 → 查工作 → 查規格」一站完成，並自動產出可落地的企業格式輸出。

---

## 🔥 Demo 重點一覽

| # | 功能 | Demo 情境 |
|---|------|-----------|
| 1 | 智慧對話 + 網頁上下文 | 打開任意網頁 → 一鍵摘要 / 翻譯 / 截圖分析 |
| 2 | 多分頁 + 多 Session | 同時開 3 個 Tab，各用不同模型處理不同任務 |
| 3 | Proactive + Work IQ | 自動掃描 M365 → 晨報 / 截止日 / 未回覆 / 會議準備 |
| 4 | Work IQ 直查 | `/workiq check latest azure speech deck` |
| 5 | Foundry Agent Skills | `/foundry_agent_skills um-semantic-agent to check Which projectors support Short Throw?` |
| 6 | Fabric Agent (Fabric IQ) | `/foundry_agent_skills fabric-specs-agent to check Please list 4K UHD models and their brightness.` |
| 7 | 圖片生成 (Foundry Model) | `/gen_img Generate a cute cat picture` |
| 8 | MCP / Microsoft Docs / Context7 | 直接呼叫第三方 MCP 工具查官方文件 |
| 9 | Quick Custom Prompt | 常用提示詞一鍵帶入（TLDR / Action Summary） |
| 10 | 用量 / 成就 / 歷史 | 面板查看 token 用量、解鎖成就、回顧對話 |

完整 Demo 腳本請見：[DEMO-zhtw.md](./DEMO-zhtw.md)

---

## ✨ 核心功能

### 💬 智慧對話助手

**Business Impact：減少 50% 資訊搜尋時間，跨語言溝通障礙歸零**

IQ Copilot 的聊天核心基於 GitHub Copilot，支援多種輸入形式與智慧回答：

| 能力 | 說明 | 與 IQ 平台的關聯 |
|------|------|-------------------|
| 即時問答 | 任何工作問題，一問即答 | 可銜接 Foundry IQ 知識庫做深度回答 |
| 網頁摘要 | 自動讀取當前分頁 DOM，擷取重點 | — |
| 多語言翻譯 | 非英文頁面即時翻譯 + 重點整理 | — |
| 檔案分析 | 上傳 PDF / 圖片 / 程式碼，直接分析 | 可搭配 Work IQ 查相關郵件補充背景 |
| 頁面截圖 | 📷 一鍵擷取目前瀏覽頁面可視區，附加至對話 | 含登入頁面也可截圖（非 DOM 方式） |
| 斜線命令 | `/help`、`/foundry_agent_skills`、`/workiq`、`/model`、`/mcp` | 統一入口觸發各 IQ 平台 |
| Quick Prompt | 常用提問模板儲存為快速指令，一鍵帶入 | 企業可預設「Action Summary」「TLDR」等格式 |

> 💡 **使用情境**：收到一份 20 頁英文報告 → 拖入 IQ Copilot → 30 秒取得中文重點摘要 + 行動項目 + 風險提示。

---

### 🔄 多工對話（Multi-Tab Chat）

**Business Impact：同時追蹤多條工作線，單一視窗內完成多模型協作**

每位使用者最多可開啟 **10 個同時對話**，每個 Tab 擁有完全獨立的 session 與設定：

| 特性 | 效益 |
|------|------|
| **Per-Tab Model** | 每個 Tab 可選擇不同 AI 模型（GPT-4.1、Claude、o1 等） |
| **Per-Tab Skills** | 每個 Tab 可啟用/停用特定技能 |
| **獨立串流通道** | 各 Tab 各自擁有 Chrome port，互不干擾 |
| **Token 統計** | 每 Tab 獨立記錄 input/output/cache token 與成本 |
| **自動持久化** | 關閉瀏覽器後對話、模型設定、歷史自動保存 |
| **Tab 狀態指示** | idle / running / error 即時顯示在 Tab 標籤上 |

> 💡 **使用情境**：Tab 1 用 GPT-4.1 問 Foundry IQ 投影機規格、Tab 2 用 `/workiq` 查本週未回覆郵件、Tab 3 用 Claude 草擬回覆信件 — 三條工作線同時進行，零切換成本。

---

### 🤖 Foundry IQ — 企業知識 Agent

**Business Impact：將散落在多系統的企業知識統一到單一對話入口，客服/業務/工程師即時查詢**

透過 `/foundry_agent_skills` 斜線命令，IQ Copilot 直連 Microsoft Foundry Agent Service，呼叫企業自建的 AI Agent：

| Agent | 覆蓋範圍 | 典型查詢 |
|-------|----------|----------|
| **um-semantic-agent** | 產品手冊（UM）：型號特色、連接埠、解析度 | 「哪些投影機支援 Short Throw？」「比較 EW805ST 與 EU610ST 的連接埠差異」 |
| **pkm-semantic-agent** | 售後知識庫（PKM）：故障排除、設定指引 | 「投影機螢幕閃爍怎麼處理？」「如何連接 Mac M1 到投影機？」 |
| **fabric-specs-agent** | **Fabric IQ** 規格庫：結構化規格比對 | 「4KB257 的解析度是多少？」「請列出 4K UHD 機種與亮度」 |

**運作方式**：
1. 使用者在聊天輸入 `/foundry_agent_skills <agent-name> to check <query>`
2. 背景層發送 `EXECUTE_SKILL` 訊息
3. Proxy 以 `child_process.execFile` 呼叫 shell wrapper → Python SDK → Azure AI Foundry Agent Service
4. Foundry Agent 依據 RAG 索引查找對應知識，返回結構化回答
5. 支援多輪對話（帶 session_id 續問）

**跨 Agent 協作情境**：
> 「AH500ST 亮度多少？如果畫面閃爍怎麼辦？」
> → Copilot 自動路由：**fabric-specs-agent**（規格）+ **pkm-semantic-agent**（排障），合併回覆。

---

### 📋 Work IQ — M365 工作資料智慧查詢

**Business Impact：零切換存取 Outlook / Teams / OneDrive / Calendar，避免 80% 的「忘記回覆」風險**

Work IQ 透過 MCP tool（`workiq-ask_work_iq`）查詢使用者的 M365 資料，IQ Copilot 提供兩種觸發路徑：

#### 路徑 A：直接查詢（`/workiq`）
直接在聊天輸入 `/workiq <query>`，例如：
- `/workiq check latest azure speech deck` — 找到 OneDrive 上最新的簡報檔
- `/workiq 本週有哪些會議？` — 彙整 Calendar 行程
- `/workiq 誰寄了關於 Q3 預算的郵件？` — 搜尋 Outlook 郵件

#### 路徑 B：Proactive 智慧掃描
IQ Copilot 會透過排程（alarm）或手動觸發，自動以 Work IQ 掃描 M365 資料，產生 Smart Notifications：

| 掃描類型 | 功能說明 | 效益 |
|---------|---------|------|
| 🌅 **每日晨報** | 自動彙整今日待辦、會議、重要郵件 | 5 分鐘掌握一天重點 |
| ⏰ **截止日追蹤** | 偵測郵件/任務中的 deadline，提前提醒 | 零逾期專案 |
| 📅 **會議準備** | 自動整理相關文件、歷史信件 | 會議前準備時間減半 |
| 👻 **未回覆偵測** | 找出超過 72 小時未回的重要郵件 | 維護專業形象 |

**進階能力**：
- **客製 Prompt**：企業可自訂 Work IQ Prompt，讓掃描結果自動輸出「摘要 / 風險 / 下一步 / Teams 更新」等固定格式
- **排程卡片**：可建立多張排程卡，每張設定不同 agent、不同 prompt、不同觸發時間（每 N 分鐘 / 每天 / 每週）
- **已讀/未讀模型**：Smart Notifications 具備 badge + 已讀追蹤，重要通知不會被埋沒
- **平行 scan-all**：一次觸發四種掃描同時執行，附帶節流防護避免重複觸發

> 💡 **使用情境**：早上打開 IQ Copilot，Smart Notification 面板自動顯示：今天有 3 個會議（含準備材料）、2 封需要回覆的重要郵件、1 個即將到期的專案。點擊任一卡片可直接展開細節或跳轉處理。

---

### 🧩 Fabric IQ — 產品規格資料庫

**Business Impact：結構化規格即時比對，業務報價與售前諮詢效率提升 3 倍**

Fabric IQ 透過 `fabric-specs-agent` 提供結構化的產品規格查詢，與 UM/PKM Agent 的「非結構化文本」知識庫不同，Fabric IQ 專注在：

- **精確規格比對**：解析度、亮度、連接埠、重量等欄位化查詢
- **跨型號比較**：「比較 4KB257 和 AH500ST 的主要規格」
- **篩選查詢**：「亮度大於 3000 的機種有哪些？」「請列出 4K UHD 機種」

> 💡 **與 Foundry IQ 的差異**：Foundry IQ 的 UM/PKM Agent 處理「非結構化」知識（手冊文本、排障步驟），Fabric IQ 則處理「結構化」規格資料。三者在 IQ Copilot 中透過同一斜線命令入口 `/foundry_agent_skills` 統一存取。

---

### 🔗 三大 IQ 平台協同合作

IQ Copilot 的獨特價值在於將三大 IQ 平台整合成**無縫工作流**：

```
使用者提問
    │
    ├─ 「這台投影機有什麼特色？」
    │   └→ Foundry IQ（um-semantic-agent）：產品手冊查詢
    │
    ├─ 「它的 4K 解析度是多少？亮度呢？」
    │   └→ Fabric IQ（fabric-specs-agent）：結構化規格比對
    │
    ├─ 「如果畫面閃爍怎麼辦？」
    │   └→ Foundry IQ（pkm-semantic-agent）：售後排障知識
    │
    ├─ 「上次客戶問這台的 email 找得到嗎？」
    │   └→ Work IQ（workiq-ask_work_iq）：M365 郵件搜尋
    │
    └─ 「幫我產出一份 TLDR 給老闆」
        └→ GitHub Copilot：文案重整 + Quick Prompt 格式化
```

**端到端情境：業務人員處理客戶詢問**
1. 客戶來信問「4KB257 支援哪些連接介面？HDR 怎麼設定？」
2. 在 Tab 1 用 `/foundry_agent_skills fabric-specs-agent` 查規格 → 取得連接埠清單
3. 在 Tab 2 用 `/foundry_agent_skills pkm-semantic-agent` 查 HDR 設定步驟
4. 用 `/workiq` 查看過去與該客戶的往來郵件
5. 用 Quick Prompt「Action Summary」格式，一鍵產出回覆郵件草稿
6. 整個流程在同一個 IQ Copilot 側欄內完成，**零系統切換**

---

### 🎨 圖片生成（Foundry Model 整合）

**Business Impact：行銷與提案所需的視覺素材，對話中即時產出**

透過 `/gen_img` 斜線命令，呼叫 Azure OpenAI DALL-E 模型生成圖片：

- 固定輸出 1536×1024 高品質橫幅
- Azure RBAC 驗證（`DefaultAzureCredential`），無需另外管理 API key
- 輸出自動命名（含時間戳記）

> 💡 **使用情境**：準備提案簡報時，輸入 `/gen_img A modern office with AI assistants on screen` → 直接取得可用的簡報插圖。

---

### 🛠️ Skills & MCP 工具生態系

**Business Impact：一個介面存取所有企業內外部工具，零碎工具切換成本降為零**

IQ Copilot 支援兩種工具擴充機制：

#### Skills（本機技能）
- 放置於 `.github/skills/` 目錄，每個 skill 包含 `SKILL.md` + 執行腳本
- Proxy 自動探索並列出可用 skills（`/api/skills/local`）
- 透過 `child_process.execFile` 安全執行（非 shell，避免注入）
- 目前已註冊：`foundry_agent_skill`（Foundry Agent 呼叫）、`gen-img`（圖片生成）
- **可擴充**：新增 skill 只需放入目錄 + SKILL.md，無需修改核心程式碼

#### MCP（Model Context Protocol）
- 讀寫 `~/.copilot/mcp-config.json` 設定檔
- MCP 面板提供 GUI 管理（新增 / 編輯 / 移除 MCP server）
- 已驗證整合：**Microsoft Docs**（官方文件查詢）、**Context7**（最新 SDK 文件與範例）、**Playwright**（瀏覽器自動化）

> 💡 **使用情境**：
> - 「用 Microsoft 官方文件，列出 Azure Functions HTTP trigger 的設定步驟」→ MCP Microsoft Docs
> - 「查 OpenAI Python SDK 最新的 chat completion 用法並給一個可執行範例」→ MCP Context7

---

### ⚡ Quick Custom Prompt

**Business Impact：將企業常用輸出格式標準化，確保 AI 輸出條理一致、可直接採用**

使用者可自訂快速提示詞範本，一鍵帶入聊天框：

| 範本名稱 | 用途 | 輸出格式 |
|----------|------|----------|
| **Action Summary** | 會議紀錄 / 文件摘要 | 3 key takeaways → Action items (owner / ETA) → Risks |
| **TLDR** | 快速彙報 | Executive brief (30 秒可讀) + Team checklist |
| 自訂... | 企業自行定義 | 任意格式 |

- 儲存於 `chrome.storage.local`，跨 session 保留
- 搭配 Proactive Work IQ Prompt，可讓掃描結果自動套用企業格式

---

### 🏆 成就系統

**Business Impact：遊戲化機制驅動功能探索，新功能採用率提升 40%，使用者黏著度提高 60%**

像遊戲一樣有趣的功能探索引擎：

| 面向 | 說明 |
|------|------|
| **經驗值（XP）** | 每次使用都獲得 XP，累積升級 |
| **等級系統** | 🌱 Newbie → ⚡ Explorer → 🚀 Power User → 🎯 Expert → 🏅 IQ Architect |
| **成就徽章** | 30+ 種成就，5 種稀有度（Common → Legendary） |
| **連續使用獎勵** | 維持每日使用習慣獲得額外 XP |
| **功能探索追蹤** | 首次使用 Multi-Tab / Foundry Skill / Work IQ / 截圖等各自觸發成就 |

| 等級 | 稱號 | 所需 XP |
|------|------|---------|
| 1 | 🌱 Newbie | 0 |
| 5 | 🚀 Power User | 600 |
| 10 | 🏅 IQ Architect | 5,000 |

> 💡 **商業洞察**：成就系統引導使用者逐步探索 Foundry IQ、Work IQ、Fabric IQ 等進階功能，而非僅停留在基礎對話。

---

### 📊 用量統計

**Business Impact：量化 AI 投資效益，提供主管可報告的數據**

每個 Tab 獨立追蹤，面板彙總顯示：

| 指標 | 說明 |
|------|------|
| Input / Output Tokens | 詳細分解每次對話的 token 消耗 |
| Cache Read / Write Tokens | 快取命中率分析 |
| API Calls | 累計呼叫次數 |
| Cost Estimate | 基於 token 的成本估算 |
| Tool / Skill 使用次數 | 哪些 Foundry Agent / MCP 工具最常被使用 |

> 💡 **向主管報告**：「本月 IQ Copilot 幫我處理了 200 次查詢、50 次 Foundry Agent 呼叫、30 次 Work IQ 掃描，估計節省 15 小時工作時間。」

---

### 🕐 對話歷史

**Business Impact：組織知識不流失，過去的查詢結果可隨時回溯複用**

- **完整記錄**：所有 Tab 的對話永久保存
- **快速搜尋**：按關鍵字找到過去的 Foundry Agent 回覆或 Work IQ 查詢結果
- **一鍵恢復**：繼續之前的對話上下文
- **跨 Tab 管理**：在歷史面板切換查看各 Tab 的完整對話鏈

---

## 🔒 安全與隱私

| 層面 | 措施 |
|------|------|
| **本機架構** | 所有 Proxy 通訊限定 localhost，敏感資料不離開使用者電腦 |
| **敏感值保護** | API key 存放 `chrome.storage.session`（session scope，瀏覽器關閉即清除） |
| **日誌遮罩** | Proxy 日誌自動遮罩 token、key 等敏感欄位 |
| **輸入驗證** | 所有路由輸入經 Zod schema 驗證 + body 大小限制 |
| **CSP** | `manifest.json` Content Security Policy 限制 |
| **安全執行** | Skills 以 `execFile`（非 shell）呼叫，防止命令注入 |
| **最小權限** | 擴充功能僅請求 `activeTab`、`sidePanel`、`tabs`、`storage`、`alarms` |

---

## 📈 ROI 總結

| 指標 | 預期效益 | 對應功能 |
|------|---------|----------|
| 資訊搜尋時間 | **減少 50%** | 智慧對話 + Foundry IQ 知識 Agent |
| 會議準備時間 | **減少 40%** | Proactive 會議準備 + Work IQ |
| 漏回郵件風險 | **降低 80%** | Proactive 未回覆偵測 + Smart Notifications |
| 系統切換次數 | **降低 70%** | 三大 IQ 統一入口 + MCP 工具整合 |
| 新功能採用率 | **提升 40%** | 成就系統引導功能探索 |
| 每週節省時間 | **3-5 小時** | 全功能綜合效益 |
| 報價/諮詢效率 | **提升 3 倍** | Fabric IQ 結構化規格即時比對 |
