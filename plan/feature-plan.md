# IQ Copilot — Proactive Agent Feature Plan

## Vision

**Proactive Agent = 不等你問，主動告訴你該做什麼**

透過 Foundry Agent + WorkIQ 存取 M365 資料（Email、行事曆、Teams、OneDrive、人員），
定時掃描並主動推送洞察與行動建議，讓使用者一開機就掌握最重要的事。

---

## Business Impact

| 影響面 | 說明 |
|--------|------|
| **生產力提升** | 每天節省 30-45 分鐘手動翻閱信箱、行事曆、Teams 的時間 |
| **零遺漏** | 自動偵測未回覆信件、即將到期的 deadline，消除人為疏忽 |
| **會議品質** | 每場會議自動備齊上下文，決策速度加快 |
| **客戶滿意度** | 不讓客戶信件石沉大海，回應時間縮短 50%+ |
| **展示價值** | 作為 Copilot + Foundry Agent 整合的最佳 showcase，適合內外部 demo |

---

## Architecture

```
┌──────────────┐    定時觸發     ┌──────────────┐    查詢      ┌──────────┐
│  Scheduler   │ ────────────→ │  Proactive   │ ─────────→ │ WorkIQ   │
│  (Cron/Timer)│               │  Agent       │            │ M365     │
└──────────────┘               │ (Foundry)    │            │ Data     │
                               └──────┬───────┘            └──────────┘
                                      │
                               推送通知/報告
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
          IQ Copilot Sidebar    Email 摘要         Teams Bot
          (Browser Extension)
```

**Extension 整合方式：**
- Sidebar Chat 中顯示 Proactive Agent 推送的洞察卡片
- 導航列新增 🔔 通知面板，顯示未讀的主動建議
- 每個建議都有「一鍵行動」按鈕（回覆信件、開啟文件、草擬回覆等）

---

## Scope: Idea 1–4（MVP）

### 💡 Idea 1：每日晨報 Agent（Daily Briefing）

**核心價值：一開機就知道今天最重要的事，不用自己翻信箱**

每天早上 8:00 自動執行，推送：

- 📬 需要回覆的信件（標記超過 48 小時的高優先）
- 📅 今天的會議列表（含第一個會議的準備摘要）
- ✅ 即將到期的待辦事項
- ⚠️ Teams 中有人 @mention 你的訊息

**Biz Impact：**
- 🔥🔥🔥 涵蓋面最廣、最容易展示價值
- 減少每日「開機儀式」30 分鐘
- 立即看出一天的優先級排序

**技術要點：**
- Foundry Agent 定時 invoke
- WorkIQ 查詢：emails (unread + need reply)、calendar (today)、tasks (due soon)、Teams (mentions)
- Extension 顯示：Briefing 卡片 UI，可展開各區段

---

### 💡 Idea 2：費用與截止日追蹤 Agent（Deadline Hawk）

**核心價值：再也不會錯過報帳、簽核、提交截止日**

掃描信箱偵測含有 deadline / due date / by XX/XX 的郵件，建立倒數追蹤，
提前 3 天、1 天、當天分別提醒。

範例：`⚠️ Tech Connect 出差費用報銷明天截止，你還沒提交！`

**Biz Impact：**
- 🔥🔥 直接避免財務損失（錯過報帳 = 自己吸收）
- 合規性提升（簽核不延誤）
- 實作難度最低 ⭐，ROI 最高

**技術要點：**
- WorkIQ 掃描 emails，NLP 抽取日期實體
- Foundry Agent 建立 deadline 資料庫
- 倒數計時 + 多級提醒邏輯
- Extension 顯示：Deadline 倒數列表，紅/黃/綠狀態

---

### 💡 Idea 3：會議準備 Agent（Meeting Prep）

**核心價值：每場會議都有備而來**

會議前 15 分鐘自動觸發，推送：

- 📋 會議主題與議程
- 👥 參與者列表（含角色/部門）
- 📎 相關文件（自動從 SharePoint/OneDrive 找到）
- 💬 最近相關 Teams 對話摘要
- 🎯 你上次答應的 action items

**Biz Impact：**
- 🔥🔥🔥 展示效果最好（每個人都開會，每個人都有感）
- 會議效率提升 30%（不需要前 5 分鐘回顧上次討論了什麼）
- 跨系統資訊自動彙整 = 最有「AI 感」的功能

**技術要點：**
- WorkIQ 查詢：calendar event details、attendees、related files、Teams chat
- Foundry Agent 做跨訊號關聯（event title → search files & chats）
- Extension 顯示：會議 Prep 卡片，可展開各區段，一鍵開啟文件

---

### 💡 Idea 4：未回覆偵測 Agent（Ghost Detector）

**核心價值：防止重要信件被遺忘**

定期掃描未回覆信件，標記優先級：

- ⚠️ 客戶相關 → 最高優先
- ⚠️ 超過 48 小時 → 高優先
- 📌 內部請求 → 中優先

並提供：`🤖 建議：要我幫你草擬回覆嗎？`

**Biz Impact：**
- 🔥🔥🔥 直接解決最大痛點（每個人都有忘回信的經驗）
- 客戶滿意度直接提升
- 「草擬回覆」功能 = Copilot 真正幫你省時間的 killer feature

**技術要點：**
- WorkIQ 查詢：sent items vs received items，diff 出未回覆
- Foundry Agent 分類優先級（客戶/內部/HR/FYI）
- 一鍵草擬回覆 → Copilot SDK chat 生成回覆草稿
- Extension 顯示：未回覆列表，紅黃標記，「草擬回覆」按鈕

---

## Implementation Priority

```
Week 1          Week 2          Week 3          Week 4
┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
│ Idea 1    │   │ Idea 2    │   │ Idea 4    │   │ Idea 3    │
│ 每日晨報  │ → │ 截止日追蹤│ → │ 未回覆偵測│ → │ 會議準備  │
│ (MVP)     │   │ (Quick Win)│  │ (Core)    │   │ (Advanced)│
└───────────┘   └───────────┘   └───────────┘   └───────────┘
```

---

## Todo List

### Idea 1：每日晨報 Agent（Daily Briefing）

- [x] **1.1 Foundry Agent 設定** — 建立 Daily Briefing Agent，設定 system prompt 定義輸出格式
- [x] **1.2 WorkIQ 查詢整合** — 實作 email/calendar/tasks/teams 的查詢邏輯
- [x] **1.3 排程機制** — 每日 8:00 定時觸發（cron / Azure Functions Timer）
- [x] **1.4 Extension Briefing UI** — sidebar 新增「晨報」卡片元件，含 4 個可折疊區段
- [x] **1.5 通知推送** — Extension badge 通知 + 開啟 sidebar 自動顯示當日晨報
- [x] **1.6 一鍵行動** — 每個項目旁加「回覆」「開啟」「標記完成」按鈕

### Idea 2：費用與截止日追蹤 Agent（Deadline Hawk）

- [x] **2.1 日期抽取邏輯** — Foundry Agent prompt 設計：從 email 中抽取 deadline 日期
- [x] **2.2 Deadline 資料庫** — 用 chrome.storage 或後端儲存追蹤中的 deadlines
- [x] **2.3 多級提醒** — 提前 3 天/1 天/當天 的提醒觸發邏輯
- [x] **2.4 Extension Deadline UI** — sidebar 新增「截止日」倒數列表，紅黃綠標記
- [x] **2.5 掃描排程** — 每日掃描一次新信件中的 deadline 關鍵字

### Idea 3：會議準備 Agent（Meeting Prep）

- [x] **3.1 會議偵測** — 監聽行事曆，會議前 15 分鐘觸發 Agent
- [x] **3.2 跨系統資料收集** — WorkIQ 查詢參與者、相關檔案、Teams 對話
- [x] **3.3 Action Items 追蹤** — 從上次會議紀錄中抽取你承諾的事項
- [x] **3.4 Extension Meeting Prep UI** — 會議準備卡片：參與者、文件、對話摘要、action items
- [x] **3.5 一鍵開啟** — 連結到 SharePoint 文件、Teams 對話、日曆事件

### Idea 4：未回覆偵測 Agent（Ghost Detector）

- [x] **4.1 未回覆演算法** — 比對 inbox vs sent，找出需要回覆但尚未回覆的信件
- [x] **4.2 優先級分類** — Foundry Agent 依據寄件者（客戶/主管/內部/HR）自動分級
- [x] **4.3 草擬回覆** — 整合 Copilot SDK chat，一鍵生成回覆草稿
- [x] **4.4 Extension Ghost UI** — 未回覆列表，優先級標記，「草擬回覆」按鈕
- [x] **4.5 定期掃描** — 每 4 小時掃描一次，有新的未回覆時推送通知

### 共用基礎建設

- [x] **0.1 Foundry Agent 連線** — Extension 透過 proxy 連接 Foundry Agent endpoint
- [ ] **0.2 WorkIQ 認證** — M365 OAuth 認證流程整合到 Extension login
- [x] **0.3 通知系統** — Extension 內建通知面板（🔔 nav button）+ badge 計數
- [x] **0.4 排程框架** — 定時觸發各 Agent 的基礎框架（background.js alarm API）
- [x] **0.5 洞察卡片元件** — 可複用的 Insight Card UI 元件（標題/內容/action buttons）
