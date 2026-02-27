# IQ Copilot — 成就與遊戲化系統

> **Last Updated:** 2026-02-27  
> **Status:** ✅ 核心引擎完成，UI 整合完成，事件串接進行中

---

## 📋 Table of Contents

- [IQ Copilot — 成就與遊戲化系統](#iq-copilot--成就與遊戲化系統)
  - [📋 Table of Contents](#-table-of-contents)
  - [Summary](#summary)
  - [What You'll Experience](#what-youll-experience)
    - [經驗值與等級](#經驗值與等級)
    - [成就徽章](#成就徽章)
    - [解鎖通知](#解鎖通知)
    - [個人檔案](#個人檔案)
  - [Level System](#level-system)
    - [經驗值 (XP) 來源](#經驗值-xp-來源)
    - [等級階梯](#等級階梯)
  - [Achievement Categories](#achievement-categories)
    - [🗨️ Chat 類（對話互動）](#️-chat-類對話互動)
    - [🛠️ Skills/Tools 類](#️-skillstools-類)
    - [📋 Proactive 掃描類](#-proactive-掃描類)
    - [🔥 連續使用 \& 隱藏成就](#-連續使用--隱藏成就)
  - [UI Overview](#ui-overview)
    - [成就面板](#成就面板)
    - [解鎖通知](#解鎖通知-1)
    - [個人檔案卡](#個人檔案卡)
  - [ROI Metrics](#roi-metrics)
  - [Implementation Status](#implementation-status)
  - [Future Work](#future-work)
    - [延伸構想](#延伸構想)
  - [Appendix: Technical Details](#appendix-technical-details)
    - [A1. Architecture](#a1-architecture)
    - [A2. Data Schema](#a2-data-schema)
    - [A3. 模組結構](#a3-模組結構)
    - [A4. 成就規則類型](#a4-成就規則類型)
    - [A5. Business Impact](#a5-business-impact)

---

## Summary

**像 Xbox 成就系統一樣，讓每次與 Skills/Tools 互動都有意義。**

IQ Copilot 的成就系統會追蹤你的每一個操作——提問、使用 Skills/Tools、完成任務、探索功能——並給予經驗值（XP）、解鎖徽章、提升等級。

**核心價值：**
- 🎯 **正向回饋循環**：養成使用 Skills/Tools 的習慣
- 📊 **生產力可視化**：量化 AI 帶來的效益（節省時間、處理任務數）
- 🏆 **功能探索**：透過隱藏成就發現未使用的功能

---

## What You'll Experience

### 經驗值與等級
每個操作都會累積 XP，達到門檻即升級。等級越高，解鎖越多功能。

### 成就徽章
完成特定條件解鎖徽章，有 5 種稀有度：
- ⬜ Common（常見）
- 🟦 Uncommon（不常見）
- 🟪 Rare（稀有）
- 🟧 Epic（史詩）
- 🟨 Legendary（傳奇）

### 解鎖通知
每次解鎖成就，都有精美的 Toast 動畫通知，顯示獎勵 XP 和升級進度。

### 個人檔案
查看你的等級、累積 XP、已解鎖成就數、連續使用天數，以及 AI 為你節省的時間。

---

## Level System

### 經驗值 (XP) 來源

| 行為 | XP | 說明 |
|------|-----|------|
| 發送訊息 | +5 | 基礎互動 |
| 使用 Skills/Tools | +15 | 採納 AI 建議 |
| 完成任務 | +20 | 任務管理 |
| 使用 MCP 工具 | +10 | 進階功能 |
| 查看每日晨報 | +10 | Proactive 掃描 |
| 處理未回覆提醒 | +25 | 最高價值行為 |
| 連續登入 | +8/天 | 養成習慣 |

### 等級階梯

| Level | 稱號 | 累積 XP | 解鎖特權 |
|-------|------|---------|----------|
| 1 | 🌱 Newbie | 0 | 基礎功能 |
| 2 | 💡 Explorer | 50 | 解鎖 Usage 統計 |
| 3 | ⚡ Learner | 150 | 解鎖快捷指令 |
| 4 | 🔥 Active User | 350 | 進階 Skills/Tools 模式 |
| 5 | 🚀 Power User | 600 | MCP 自訂工具 |
| 6 | 💎 Expert | 1000 | 主題色彩自訂 |
| 7 | 🏆 Champion | 1500 | 排行榜功能 |
| 8 | 👑 Master | 2200 | 實驗功能 |
| 9 | 🌟 Legend | 3000 | 專屬稱號 |
| 10 | 🎖️ IQ Architect | 5000 | 終極成就 |

---

## Achievement Categories

### 🗨️ Chat 類（對話互動）

| 成就 | 條件 | 稀有度 |
|------|------|--------|
| 💬 初次對話 | 發送第一則訊息 | ⬜ |
| 🗣️ 健談者 | 累計 50 則訊息 | 🟦 |
| 👑 話題王 | 累計 500 則訊息 | 🟪 |
| 🧠 深度對話 | 單次對話超過 20 回合 | 🟪 |
| 📖 千言萬語 | 累計 5000 則訊息 | 🟨 |

### 🛠️ Skills/Tools 類

| 成就 | 條件 | 稀有度 |
|------|------|--------|
| 🛠️ Skills 初體驗 | 首次呼叫 Skill/Tool | ⬜ |
| 💙 Skills 愛好者 | 使用 Skills/Tools 50 次 | 🟦 |
| ⭐ Tools 達人 | 使用 Skills/Tools 200 次 | 🟪 |
| 🎯 全能指揮官 | 使用過所有類型 Skills/Tools | 🟧 |
| 🧬 AI 共生體 | 單日使用 Skills/Tools 50+ 次 | 🟨 |

### 📋 Proactive 掃描類

| 成就 | 條件 | 稀有度 |
|------|------|--------|
| ☀️ 早安打工人 | 首次查看每日晨報 | ⬜ |
| ⏰ 時間守護者 | 透過 Deadline Hawk 避免 3 次逾期 | 🟦 |
| 📋 有備而來 | 使用 Meeting Prep 準備 10 場會議 | 🟪 |
| 📭 信件零遺漏 | Ghost Detector 清零 | 🟧 |
| 🌅 連續早起 | 連續 7 天查看晨報 | 🟪 |
| 🛡️ 零死角 | 同時使用全部 4 個 Proactive 掃描項目 | 🟨 |

### 🔥 連續使用 & 隱藏成就

| 成就 | 條件 | 稀有度 |
|------|------|--------|
| 🔥 三日不斷 | 連續 3 天使用 | ⬜ |
| 📅 周周不缺 | 連續 7 天使用 | 🟦 |
| 🌙 月度常客 | 連續 30 天使用 | 🟧 |
| 💯 百日傳說 | 連續 100 天使用 | 🟨 |
| 🦉 夜貓子 | 凌晨 2-5 點使用 | 🟪 (Hidden) |
| 🥚 彩蛋獵人 | 發現 Easter Egg | 🟧 (Hidden) |

---

## UI Overview

### 成就面板
導覽列新增 🏆 按鈕，點擊開啟成就面板：
- **XP 進度條**：顯示當前等級與下一等級的距離
- **最近解鎖**：最新獲得的成就
- **分類進度**：每個類別的完成比例
- **完整清單**：所有成就的狀態（已解鎖/進行中/鎖定）

### 解鎖通知
成就解鎖時，從右下角滑入 Toast 通知：
- 成就圖示與名稱
- 獲得的 XP 獎勵
- 升級進度條（如果升級）

### 個人檔案卡
顯示你的整體統計：
- 當前等級與稱號
- 累積 XP
- 已解鎖成就數
- 連續使用天數
- AI 節省的時間

---

## ROI Metrics

成就系統會自動計算並展示你的生產力提升：

| 指標 | 說明 | 範例 |
|------|------|------|
| 節省時間 | Skills/Tools 呼叫 × 平均每次省 5 分鐘 | "本月已節省 18.5 小時" |
| 處理信件 | Ghost Detector 回覆數 | "已處理 32 封遺漏信件" |
| 會議準備 | Meeting Prep 使用數 | "準備了 15 場會議" |
| 避免逾期 | Deadline Hawk 成功數 | "避免了 8 次逾期" |
| AI 互動量 | 總訊息 + Skills/Tools 呼叫 | "累計 1,234 次 AI 互動" |

---

## Implementation Status

| 階段 | 狀態 | 內容 |
|------|------|------|
| Phase 1 — Core Engine | ✅ 完成 | XP 計算、Level 系統、成就判定邏輯 |
| Phase 2 — UI 整合 | ✅ 完成 | 成就面板、Toast 通知、Profile Card |
| Phase 3 — 事件串接 | 🔶 進行中 | Chat/Skills-Tools/Panel 事件已串接 |

**待完成：**
- Proactive 掃描事件串接（briefing_view, deadline_avoided 等）

---

## Future Work

| 優先級 | 功能 | 說明 |
|--------|------|------|
| 🔴 **P0** | Proactive 事件串接 | 完整追蹤晨報、提醒、會議準備等行為 |
| 🟡 P1 | 季節性成就 | 每月限定成就增加新鮮感 |
| 🟡 P1 | AI Coach | 推薦「下一個最容易達成的成就」 |
| 🟢 P2 | 團隊排行榜 | 促進團隊內良性競爭 |
| 🟢 P2 | 自訂成就 | 讓使用者定義自己的里程碑 |
| 🟢 P2 | Cloud Sync | 透過 Foundry 同步成就到雲端 |

### 延伸構想
1. **團隊挑戰**：全隊累計達標解鎖團隊徽章
2. **成就展示**：Profile Card 分享功能
3. **通知設定**：可關閉 Toast、調整音效

---

## Appendix: Technical Details

### A1. Architecture

```
User Action → Achievement Engine → Local Store
      │              │                  │
      └── 事件觸發  ──┼── XP 計算        ├── chrome.storage
                      ├── 成就檢查       │
                      └── 升級判定       └── Cloud Sync (optional)
                             │
                             ▼
                      Toast/Badge Animation
```

### A2. Data Schema

**儲存位置：** `chrome.storage.local`

**主要結構：**
- `profile`: level, xp, title, createdAt
- `achievements`: 每個成就的解鎖狀態與進度
- `counters`: 各類行為的累計數量
- `streaks`: 連續使用記錄
- `history`: XP/成就/升級事件 log
- `settings`: 通知偏好設定

### A3. 模組結構

**Core:**
- `achievement-engine.ts` (853L): 核心引擎，strict TypeScript

**UI:**
- `lib/panels/achievements.js` (292L): 成就面板 UI

**Integration Points:**
- `sidebar.js`: chat 事件 → track("chat_send")
- `lib/chat.js`: skills/tools 呼叫 → 事件追蹤
- `background.js`: RPC 回應追蹤

### A4. 成就規則類型

1. **Threshold-based**: 計數器達到門檻（如：訊息數 >= 50）
2. **Custom Logic**: 特殊條件（如：凌晨使用、同時使用所有功能）

### A5. Business Impact

| 影響面 | 預期效果 |
|--------|----------|
| 日活提升 | +40%（遊戲化設計驗證數據）|
| 功能探索率 | 隱藏成就引導發現未使用功能 |
| 生產力證據 | 量化 ROI 作為續約/推廣依據 |
| Demo 價值 | 吸睛展示元素 |

---

*Last updated: 2026-02-27*
*Part of IQ Copilot Extension v3.x roadmap*
