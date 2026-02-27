# IQ Copilot — Achievement & Gamification System

> **Last Updated:** 2026-02-27
> **Status:** ✅ Core Engine 完成（`achievement-engine.ts` 853L strict TS），UI 整合完成，事件串接進行中

## 🎮 Vision

**像 Xbox 成就系統一樣，讓每次與 Agent 互動都有意義。**

使用者在 IQ Copilot 中的每一個操作（提問、使用 Agent、完成任務、探索功能）
都會累積經驗值（XP）、解鎖成就徽章、提升等級。
目標：透過正向回饋循環，讓使用者養成使用 Agent 的習慣，
同時量化 AI 帶來的生產力提升。

---

## 💎 Business Impact

| 影響面 | 說明 |
|--------|------|
| **使用黏著度** | 成就系統提升日活 40%+（遊戲化設計已驗證的數據） |
| **功能探索率** | 隱藏成就引導使用者發現未使用的功能，提升 Feature Adoption |
| **生產力可視化** | 量化 Agent 節省的時間、處理的任務數，作為 ROI 數據 |
| **團隊競爭力** | 排行榜機制促進團隊內良性競爭，加速 AI 工具普及 |
| **Demo/Showcase** | 成就系統是吸睛的展示元素，適合內外部 presentation |

---

## 🏗️ Architecture

```
┌─────────────┐   事件觸發    ┌──────────────┐   儲存     ┌──────────────┐
│  User Action │ ──────────→ │  Achievement │ ────────→ │  Local Store │
│  (Chat/Agent │             │  Engine      │           │  (chrome.    │
│   /Task/MCP) │             │  (Rules +    │           │   storage)   │
└─────────────┘             │   XP Calc)   │           └──────┬───────┘
                             └──────┬───────┘                  │
                                    │                    同步 (optional)
                               解鎖通知                        │
                                    │                   ┌──────▼───────┐
                             ┌──────▼───────┐          │  Cloud Sync  │
                             │  Toast/Badge │          │  (Foundry)   │
                             │  Animation   │          └──────────────┘
                             └──────────────┘
```

---

## 📊 等級系統 (Level System)

### 經驗值 (XP) 來源

| 行為 | XP | 說明 |
|------|-----|------|
| 發送一則訊息 | +5 | 基礎互動 |
| 使用 Agent 回覆建議 | +15 | 採納 AI 建議 |
| 完成一個 Task | +20 | 任務管理 |
| 使用 MCP 工具 | +10 | 進階功能 |
| 切換 Context 查看 | +3 | 上下文意識 |
| 查看每日晨報 | +10 | Proactive Agent 使用 |
| 處理未回覆提醒 | +25 | 清除待辦項目 |
| 連續登入（每日） | +8 | 養成習慣 |
| 使用 Skill | +12 | 技能探索 |
| 上傳 Config 檔案 | +5 | 個人化設定 |
| 開啟會議準備摘要 | +15 | 會議品質提升 |
| 回覆 Ghost Detector 建議 | +30 | 最高價值行為 |

### 等級階梯

| Level | 稱號 | 累積 XP | 解鎖特權 |
|-------|------|---------|----------|
| 1 | 🌱 Newbie | 0 | 基礎功能 |
| 2 | 💡 Explorer | 50 | 解鎖 Usage 統計面板 |
| 3 | ⚡ Learner | 150 | 解鎖自訂快捷指令 |
| 4 | 🔥 Active User | 350 | 解鎖進階 Agent 模式 |
| 5 | 🚀 Power User | 600 | 解鎖 MCP 自訂工具 |
| 6 | 💎 Expert | 1000 | 解鎖主題色彩自訂 |
| 7 | 🏆 Champion | 1500 | 解鎖排行榜 |
| 8 | 👑 Master | 2200 | 解鎖所有實驗功能 |
| 9 | 🌟 Legend | 3000 | 專屬稱號 + 全功能 |
| 10 | 🎖️ IQ Architect | 5000 | 終極成就，社群認證 |

---

## 🏅 成就系統 (Achievements)

### 成就分類

#### 🗨️ Chat 類（對話互動）

| ID | 成就名稱 | 圖示 | 條件 | XP 獎勵 | 稀有度 |
|----|---------|------|------|---------|--------|
| chat-001 | 初次對話 | 💬 | 發送第一則訊息 | +20 | ⬜ Common |
| chat-002 | 健談者 | 🗣️ | 累計 50 則訊息 | +50 | 🟦 Uncommon |
| chat-003 | 話題王 | 👑 | 累計 500 則訊息 | +200 | 🟪 Rare |
| chat-004 | 深度對話 | 🧠 | 單次對話超過 20 回合 | +80 | 🟪 Rare |
| chat-005 | 多工大師 | 🔀 | 同時維持 5 個 Session | +100 | 🟧 Epic |
| chat-006 | 千言萬語 | 📖 | 累計 5000 則訊息 | +500 | 🟨 Legendary |

#### 🤖 Agent 類（Agent 互動）

| ID | 成就名稱 | 圖示 | 條件 | XP 獎勵 | 稀有度 |
|----|---------|------|------|---------|--------|
| agent-001 | Agent 初體驗 | 🤖 | 首次呼叫 Agent | +20 | ⬜ Common |
| agent-002 | Agent 愛好者 | 💙 | 使用 Agent 50 次 | +80 | 🟦 Uncommon |
| agent-003 | Agent 達人 | ⭐ | 使用 Agent 200 次 | +200 | 🟪 Rare |
| agent-004 | 全能指揮官 | 🎯 | 使用過所有類型 Agent | +150 | 🟧 Epic |
| agent-005 | AI 共生體 | 🧬 | 單日使用 Agent 50+ 次 | +300 | 🟨 Legendary |

#### 📋 Proactive Agent 類

| ID | 成就名稱 | 圖示 | 條件 | XP 獎勵 | 稀有度 |
|----|---------|------|------|---------|--------|
| proactive-001 | 早安打工人 | ☀️ | 首次查看每日晨報 | +15 | ⬜ Common |
| proactive-002 | 時間守護者 | ⏰ | 透過 Deadline Hawk 避免 3 次逾期 | +100 | 🟦 Uncommon |
| proactive-003 | 有備而來 | 📋 | 使用 Meeting Prep 準備 10 場會議 | +120 | 🟪 Rare |
| proactive-004 | 信件零遺漏 | 📭 | Ghost Detector 清零（無未回覆） | +200 | 🟧 Epic |
| proactive-005 | 連續早起 | 🌅 | 連續 7 天查看晨報 | +150 | 🟪 Rare |
| proactive-006 | 零死角 | 🛡️ | 同時使用全部 4 個 Proactive Agent | +500 | 🟨 Legendary |

#### 🔧 工具與探索類

| ID | 成就名稱 | 圖示 | 條件 | XP 獎勵 | 稀有度 |
|----|---------|------|------|---------|--------|
| tool-001 | 好奇心 | 🔍 | 瀏覽過所有 Panel | +10 | ⬜ Common |
| tool-002 | MCP 入門 | 🔌 | 首次使用 MCP 工具 | +25 | ⬜ Common |
| tool-003 | Skill 收集者 | 🧩 | 使用 5 種不同 Skill | +80 | 🟦 Uncommon |
| tool-004 | 設定狂人 | ⚙️ | 在 Config 中完成所有設定 | +50 | 🟦 Uncommon |
| tool-005 | Context 大師 | 🌐 | 在 50 個不同網站使用 Context | +100 | 🟪 Rare |
| tool-006 | 任務終結者 | ✅ | 透過 Tasks 完成 100 個任務 | +200 | 🟧 Epic |

#### 🔥 連續使用 & 隱藏成就

| ID | 成就名稱 | 圖示 | 條件 | XP 獎勵 | 稀有度 |
|----|---------|------|------|---------|--------|
| streak-001 | 三日不斷 | 🔥 | 連續 3 天使用 | +30 | ⬜ Common |
| streak-002 | 周周不缺 | 📅 | 連續 7 天使用 | +80 | 🟦 Uncommon |
| streak-003 | 月度常客 | 🌙 | 連續 30 天使用 | +300 | 🟧 Epic |
| streak-004 | 百日傳說 | 💯 | 連續 100 天使用 | +1000 | 🟨 Legendary |
| hidden-001 | 夜貓子 | 🦉 | 凌晨 2-5 點使用 Agent | +50 | 🟪 Rare (Hidden) |
| hidden-002 | 週末戰士 | ⚔️ | 週六日都使用 | +40 | 🟦 Uncommon (Hidden) |
| hidden-003 | 速度之星 | ⚡ | 30 秒內完成 3 個操作 | +60 | 🟪 Rare (Hidden) |
| hidden-004 | 彩蛋獵人 | 🥚 | 在 Chat 中輸入 "iq easter egg" | +100 | 🟧 Epic (Hidden) |

---

## 🎨 UI 設計

### 1. 成就 Panel（新增 nav 按鈕：🏆）

```
┌─────────────────────────────────────────┐
│  🏆 Achievements           Lv.5 🚀      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                          │
│  ┌─ XP Progress ─────────────────────┐   │
│  │  ████████████████░░░░  600/1000   │   │
│  │  Level 5 → Level 6               │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌─ Recent Unlocks ─────────────────┐   │
│  │  🏅 Agent 達人        +200 XP    │   │
│  │     just now                      │   │
│  │  🔥 周周不缺          +80 XP     │   │
│  │     2 hours ago                   │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌─ Categories ─────────────────────┐   │
│  │  🗨️ Chat       ██████░░  4/6     │   │
│  │  🤖 Agent      ████░░░░  3/5     │   │
│  │  📋 Proactive  ██░░░░░░  2/6     │   │
│  │  🔧 Tools      ███░░░░░  3/6     │   │
│  │  🔥 Streaks    ██░░░░░░  2/4     │   │
│  │  🥚 Hidden     █░░░░░░░  1/4     │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌─ All Achievements ───────────────┐   │
│  │                                   │   │
│  │  💬 初次對話     ✅ Unlocked      │   │
│  │  🗣️ 健談者       ✅ Unlocked      │   │
│  │  👑 話題王       38/500 ░░░░░░░░  │   │
│  │  🧠 深度對話     🔒 Locked        │   │
│  │  🔀 多工大師     🔒 Locked        │   │
│  │  📖 千言萬語     🔒 Locked        │   │
│  │  ...                              │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 2. 成就解鎖 Toast 動畫

```
┌───────────────────────────────┐
│  🏅 Achievement Unlocked!     │  ← 從右下角滑入
│  ─────────────────────────    │
│  ⭐ Agent 達人                │  ← 圖示 + 名稱
│  使用 Agent 200 次            │  ← 描述
│  +200 XP                      │  ← XP 獎勵（數字跳動動畫）
│  ████████████░░░ Lv.5 → Lv.6 │  ← 進度條（如果升級）
└───────────────────────────────┘
```

### 3. 個人檔案 Profile Card

```
┌─────────────────────────────────┐
│        🚀                        │
│     Power User                   │
│     Level 5                      │
│                                  │
│  ┌────┬────┬────┬────┐          │
│  │ 💬 │ 🤖 │ 📋 │ 🔧 │  ← 精選徽章 │
│  │ 4/6│ 3/5│ 2/6│ 3/6│          │
│  └────┴────┴────┴────┘          │
│                                  │
│  Total XP: 2,847                 │
│  Achievements: 15/31             │
│  Streak: 🔥 12 days             │
│  Agent Calls: 234                │
│  Tasks Done: 87                  │
│  Time Saved: ~18.5 hrs          │
└─────────────────────────────────┘
```

---

## 📐 Data Schema

### chrome.storage.local

```json
{
  "iq_score": {
    "version": "1.0.0",
    "profile": {
      "level": 5,
      "xp": 600,
      "title": "🚀 Power User",
      "createdAt": "2026-01-15T08:00:00Z"
    },
    "achievements": {
      "chat-001": { "unlocked": true, "unlockedAt": "2026-01-15T08:05:00Z" },
      "chat-002": { "unlocked": true, "unlockedAt": "2026-01-20T14:30:00Z" },
      "agent-003": { "unlocked": false, "progress": 142, "target": 200 }
    },
    "counters": {
      "totalMessages": 538,
      "totalAgentCalls": 142,
      "totalTasks": 87,
      "totalMcpCalls": 23,
      "totalSkillsUsed": ["search", "summarize", "translate", "code", "analyze"],
      "totalContextSites": 34,
      "totalSessions": 45,
      "totalProactiveBriefings": 18,
      "totalDeadlinesAvoided": 5,
      "totalMeetingsPrepped": 12,
      "totalGhostReplies": 8
    },
    "streaks": {
      "currentDays": 12,
      "longestDays": 15,
      "lastActiveDate": "2026-02-26"
    },
    "history": [
      { "type": "achievement", "id": "agent-002", "xp": 80, "at": "2026-02-25T10:00:00Z" },
      { "type": "levelup", "from": 4, "to": 5, "at": "2026-02-25T10:00:00Z" },
      { "type": "xp", "source": "chat", "amount": 5, "at": "2026-02-26T09:15:00Z" }
    ],
    "settings": {
      "notifications": true,
      "showToast": true,
      "showOnProfile": true,
      "soundEnabled": false
    }
  }
}
```

---

## 🔧 Technical Implementation

### Core Module: `achievement-engine.js`

```
AchievementEngine
├── init()                    // 載入 storage, 初始化 counters
├── track(event, data)        // 追蹤行為事件
├── checkAchievements()       // 檢查所有成就條件
├── unlockAchievement(id)     // 解鎖 + 通知 + 儲存
├── addXP(amount, source)     // 加 XP + 檢查升級
├── checkLevelUp()            // 計算等級
├── getProgress(achievementId) // 取得進度百分比
├── getProfile()              // 取得個人檔案
├── resetAll()                // 重置（開發用）
└── exportData()              // 匯出成就資料
```

### Event Flow

```
User Action
    │
    ▼
sidebar.js → track("chat_send", { messageLength: 120 })
    │
    ▼
AchievementEngine.track()
    ├── 更新 counter (totalMessages++)
    ├── 加 XP (+5)
    ├── checkAchievements()
    │   ├── chat-001: totalMessages >= 1 → ✅ unlock!
    │   ├── chat-002: totalMessages >= 50 → ❌ not yet
    │   └── ...
    ├── checkLevelUp()
    │   └── xp >= nextLevelThreshold → 🎉 level up!
    └── save to chrome.storage.local
         │
         ▼
    Toast notification (if new unlock)
```

### 事件類型定義

```javascript
const TRACKABLE_EVENTS = {
  // Chat
  "chat_send":         { xp: 5,  counters: ["totalMessages"] },
  "chat_session_new":  { xp: 3,  counters: ["totalSessions"] },
  
  // Agent
  "agent_call":        { xp: 15, counters: ["totalAgentCalls"] },
  "agent_suggestion":  { xp: 10, counters: [] },
  
  // Proactive
  "briefing_view":     { xp: 10, counters: ["totalProactiveBriefings"] },
  "deadline_avoided":  { xp: 25, counters: ["totalDeadlinesAvoided"] },
  "meeting_prepped":   { xp: 15, counters: ["totalMeetingsPrepped"] },
  "ghost_replied":     { xp: 30, counters: ["totalGhostReplies"] },
  
  // Tools
  "mcp_call":          { xp: 10, counters: ["totalMcpCalls"] },
  "skill_used":        { xp: 12, counters: [] },  // track unique skills separately
  "task_completed":    { xp: 20, counters: ["totalTasks"] },
  "context_viewed":    { xp: 3,  counters: ["totalContextSites"] },
  "config_updated":    { xp: 5,  counters: [] },
  
  // Streaks
  "daily_login":       { xp: 8,  counters: [] },  // streak logic handled separately
};
```

---

## 🎯 Achievement Rules DSL

```javascript
const ACHIEVEMENT_RULES = [
  // Chat
  { id: "chat-001", counter: "totalMessages",      threshold: 1,    xpBonus: 20  },
  { id: "chat-002", counter: "totalMessages",      threshold: 50,   xpBonus: 50  },
  { id: "chat-003", counter: "totalMessages",      threshold: 500,  xpBonus: 200 },
  { id: "chat-006", counter: "totalMessages",      threshold: 5000, xpBonus: 500 },
  
  // Agent
  { id: "agent-001", counter: "totalAgentCalls",   threshold: 1,    xpBonus: 20  },
  { id: "agent-002", counter: "totalAgentCalls",   threshold: 50,   xpBonus: 80  },
  { id: "agent-003", counter: "totalAgentCalls",   threshold: 200,  xpBonus: 200 },
  
  // Proactive
  { id: "proactive-001", counter: "totalProactiveBriefings", threshold: 1, xpBonus: 15 },
  { id: "proactive-002", counter: "totalDeadlinesAvoided",   threshold: 3, xpBonus: 100 },
  { id: "proactive-003", counter: "totalMeetingsPrepped",    threshold: 10, xpBonus: 120 },
  
  // Streaks
  { id: "streak-001", counter: "currentStreak", threshold: 3,   xpBonus: 30  },
  { id: "streak-002", counter: "currentStreak", threshold: 7,   xpBonus: 80  },
  { id: "streak-003", counter: "currentStreak", threshold: 30,  xpBonus: 300 },
  { id: "streak-004", counter: "currentStreak", threshold: 100, xpBonus: 1000 },
  
  // Special (custom logic)
  { id: "agent-004", type: "custom", check: "allAgentTypesUsed",  xpBonus: 150 },
  { id: "chat-004", type: "custom", check: "singleSessionTurns20", xpBonus: 80 },
  { id: "chat-005", type: "custom", check: "concurrentSessions5",  xpBonus: 100 },
  { id: "proactive-004", type: "custom", check: "ghostDetectorZero", xpBonus: 200 },
  { id: "proactive-005", type: "custom", check: "consecutiveBriefing7", xpBonus: 150 },
  { id: "proactive-006", type: "custom", check: "allProactiveAgentsActive", xpBonus: 500 },
  { id: "tool-001", type: "custom", check: "allPanelsVisited", xpBonus: 10 },
  { id: "hidden-001", type: "custom", check: "usedBetween2and5am", xpBonus: 50 },
  { id: "hidden-004", type: "custom", check: "easterEggInput",     xpBonus: 100 },
];
```

---

## 🎨 CSS 動畫設計

### Toast 滑入動畫
```css
@keyframes achievement-slide-in {
  0%   { transform: translateX(120%); opacity: 0; }
  60%  { transform: translateX(-8%); opacity: 1; }
  80%  { transform: translateX(3%); }
  100% { transform: translateX(0); }
}

@keyframes xp-counter {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.3); color: #fbbf24; }
  100% { transform: scale(1); }
}

@keyframes level-up-glow {
  0%   { box-shadow: 0 0 0 rgba(124, 58, 237, 0); }
  50%  { box-shadow: 0 0 30px rgba(124, 58, 237, 0.6); }
  100% { box-shadow: 0 0 0 rgba(124, 58, 237, 0); }
}

@keyframes badge-unlock {
  0%   { transform: scale(0) rotate(-180deg); opacity: 0; }
  60%  { transform: scale(1.2) rotate(10deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); }
}
```

### 稀有度色彩系統
```css
:root {
  --rarity-common:    #9ca3af;  /* 灰 */
  --rarity-uncommon:  #3b82f6;  /* 藍 */
  --rarity-rare:      #8b5cf6;  /* 紫 */
  --rarity-epic:      #f97316;  /* 橘 */
  --rarity-legendary: #eab308;  /* 金 */
}
```

---

## 📅 Implementation Phases

### Phase 1 — Core Engine (Week 1) ✅ DONE
- [x] 建立 `achievement-engine.ts` 模組（853L strict TypeScript）
- [x] 實作 XP 計算 + Level 系統
- [x] 實作 counter 追蹤（messages, agents, tasks...）
- [x] Chrome storage read/write
- [x] 基礎成就判定邏輯（threshold-based）
- [x] Custom 成就檢查邏輯（allPanelsVisited, usedBetween2and5am, etc.）

### Phase 2 — UI 整合 (Week 2) ✅ DONE
- [x] 新增 Achievement Panel (🏆 nav button)
- [x] XP 進度條 + Level 顯示
- [x] 成就清單 UI（已解鎖/進行中/未解鎖）
- [x] Toast 解鎖通知元件 + 動畫
- [x] Profile Card 元件
- [x] 抽取為 `lib/panels/achievements.js` (292L)

### Phase 3 — Event 串接 (Week 3) 🔶 進行中
- [x] Chat 發送 → track("chat_send")
- [x] Agent 呼叫 → track("agent_call")
- [x] Panel 切換 → track("panel_viewed")
- [x] Streak 計算邏輯（daily login detection）
- [x] 隱藏成就觸發條件
- [ ] Proactive Agent 事件串接（briefing_view, deadline_avoided等）

---

## 📊 ROI Metrics（生產力視覺化）

成就系統可自動計算並展示：

| 指標 | 計算方式 | 展示 |
|------|----------|------|
| 節省時間 | Agent 呼叫次數 × 平均每次省 5 分鐘 | "本月已節省 18.5 小時" |
| 處理信件 | Ghost Detector 回覆數 | "已處理 32 封遺漏信件" |
| 會議品質 | Meeting Prep 使用數 | "準備了 15 場會議" |
| 截止日守護 | Deadline Hawk 避免逾期數 | "避免了 8 次逾期" |
| AI 互動量 | 總訊息 + Agent 呼叫 | "累計 1,234 次 AI 互動" |

---

## 🔗 與現有系統的整合點

| 現有模組 | 整合方式 |
|----------|----------|
| `sidebar.js` chat | 在 `sendMessage()` 中呼叫 `track("chat_send")` |
| `sidebar.js` nav | 在 panel 切換時呼叫 `track("panel_viewed")` |
| `background.js` | 在 RPC 回應中追蹤 agent/mcp 呼叫 |
| `copilot-rpc.js` | 在 `sendMessage()` 回傳後統計 token 使用 |
| Proactive Agent (future) | 在晨報/提醒互動時觸發對應事件 |
| Config Panel | 設定成就通知偏好（開關、音效） |
| Usage Panel | 整合 XP/Level 到使用統計中 |

---

## 💡 延伸 Ideas

1. **季節性成就** — 每月限定成就（如：二月 "情人節模式：幫同事草擬 5 封感謝信"）
2. **團隊挑戰** — 全隊累計 1000 次 Agent 呼叫解鎖團隊徽章
3. **成就交換** — 成就 NFT 化（展示用，非交易）
4. **自訂成就** — 讓使用者定義自己的里程碑
5. **AI Coach** — 根據使用模式推薦 "下一個最容易達成的成就"
6. **Leaderboard API** — 透過 Foundry Agent 同步，跨組織排行

---

*Last updated: 2026-02-26*
*Part of IQ Copilot Extension v3.x roadmap*
