# Agent 工作視覺化 — IQ Copilot Browser Extension

> **Last Updated:** 2026-02-27  
> **Status:** 部分完成（基礎架構已建立，UI 待完善）

---

## 📋 Table of Contents

- [Summary](#summary)
- [What You'll See](#what-youll-see)
- [Key Features](#key-features)
- [Implementation Status](#implementation-status)
- [Future Work](#future-work)
- [Appendix: Technical Details](#appendix-technical-details)

---

## Summary

**Agent 工作視覺化**讓你在 IQ Copilot 中即時看到 AI Agent 正在做什麼。

目前使用 Agent 時，你只能看到「正在輸入中...」的跳動點，但不知道 Agent 實際在做什麼工作。這個功能會讓整個過程變得透明：

- 🧠 看見 Agent 的思考過程
- 🔧 追蹤每個工具呼叫的執行時間
- 🤖 了解子 Agent 的分工狀態
- 📊 掌握平行任務的整體進度

---

## What You'll See

### 思考狀態卡片
當 Agent 在思考時，會顯示一個可折疊的卡片，讓你知道它正在分析什麼、計劃怎麼處理。

### 工具執行追蹤
每個工具呼叫（如搜尋、編輯檔案）都會有專屬卡片，顯示：
- 工具名稱與圖示
- 即時計時器
- 執行狀態（執行中/成功/失敗）
- 結果預覽

### 子 Agent 視圖
當主 Agent 啟動子 Agent 協助時，你會看到巢狀的分支視圖，清楚知道誰在做什麼。

### Fleet 模式儀表板
多個 Agent 同時工作時，會有進度條儀表板，顯示每個 Agent 的完成百分比和預估剩餘時間。

### 時間軸視圖
完整的工作流程時間軸，從收到訊息到回覆完成的每一步都能回顧。

---

## Key Features

| 功能 | 說明 | 使用者價值 |
|------|------|-----------|
| **Thinking Card** | 即時顯示 Agent 思考內容 | 了解 AI 的推理過程 |
| **Tool Timer** | 每個工具呼叫的計時 | 掌握執行效率 |
| **Sub-Agent Tree** | 子 Agent 分支視圖 | 理解複雜任務分工 |
| **Fleet Dashboard** | 平行任務進度條 | 監控多 Agent 協作 |
| **Timeline** | 時間軸回顧 | 事後分析與除錯 |
| **Intent Bar** | 即時狀態顯示 | 一眼掌握當前動作 |

---

## Implementation Status

| 功能 | 狀態 | 備註 |
|------|------|------|
| Thinking Card CSS | ✅ 完成 | 動畫樣式已實作 |
| Sub-Agent 事件處理 | ✅ 完成 | SSE 事件解析已支援 |
| SSE 事件解析增強 | ✅ 完成 | spawn/complete 事件 |
| Tool Call 增強 | ✅ 完成 | 計時器、圖示、結果預覽 |
| Intent 即時顯示 | ✅ 完成 | 浮動狀態列與淡出 |
| Fleet 儀表板 UI | ✅ 完成 | 進度條與 task 列表 |
| Timeline 視圖 | ⬜ 待開發 | 時間軸元件 |

---

## Future Work

| 優先級 | 功能 | 說明 |
|--------|------|------|
| ✅ 已完成 | Tool Call 增強 | 計時器與圖示已上線 |
| ✅ 已完成 | Intent Bar | 即時狀態列已上線 |
| ✅ 已完成 | Sub-Agent UI | 巢狀卡片視覺已上線 |
| ✅ 已完成 | Fleet Dashboard | 進度儀表板已上線 |
| 🟢 P2 | Timeline View | 對 Debug 使用者有價值 |
| 🟢 P2 | 動畫系統統一 | 提升整體視覺一致性 |

### 技術風險
1. **事件格式不確定**：Copilot CLI 的 SSE 事件可能不完全支援所有類型
2. **效能考量**：長對話可能累積大量卡片，需虛擬滾動
3. **向後相容**：新功能不能破壞現有聊天功能

---

## Appendix: Technical Details

### A1. 現有架構基礎

| 模組 | 功能 |
|------|------|
| `copilot-rpc.js` | SSE 串流支援 |
| `lib/chat-streaming.js` | 串流事件處理 |
| `sidebar.css` | Tool Call 卡片樣式系統 |
| `background.js` | streaming port 轉發機制 |

### A2. SSE 事件類型

**已支援：**
- `msg.data.content` — 文字內容
- `msg.data.tool.call` — 工具呼叫開始
- `msg.data.tool.result` — 工具結果
- `subagent.spawn/complete` — 子 Agent 事件

**待攔截：**
- `thinking` / `reasoning` — 推理內容
- `intent` — 目前意圖
- `fleet_task_start/complete` — Fleet 任務

### A3. 實作依賴順序

```
SSE 事件解析 (基礎)
    │
    ├── Thinking Card（獨立）
    ├── Intent Bar（獨立）
    ├── Tool Call 增強（獨立）
    │
    ├── Sub-Agent UI（依賴 Thinking + Tool）
    ├── Fleet Dashboard（依賴 Sub-Agent）
    │
    └── Timeline View（依賴所有上述）
```

### A4. UI Mockups

**Thinking Card:**
```
┌─────────────────────────────┐
│ 🧠 Agent 正在思考...         │
│   分析使用者的問題...         │
│   決定需要搜尋程式碼庫        │
└─────────────────────────────┘
```

**Tool Call Card:**
```
┌─────────────────────────────────────┐
│ 🔍 grep("auth", "src/")   ⏱ 1.2s   │
│    Status: ████████░░ 執行中        │
└─────────────────────────────────────┘
```

**Fleet Dashboard:**
```
┌─ Fleet 任務 (3/5 完成) ─────────┐
│ Agent 1: ████████████████ ✅    │
│ Agent 2: ██████████░░░░ 60%    │
│ Agent 3: ████░░░░░░░░░ 30%     │
│ 總進度: ████████░░░░ 60%        │
└─────────────────────────────────┘
```

### A5. 動畫設計原則

| 狀態 | 動畫類型 |
|------|----------|
| 思考中 | 漸變色脈衝邊框 |
| 執行中 | 旋轉 spinner |
| 完成 | 綠色閃爍確認 |
| 錯誤 | 紅色搖晃 |
| 進度 | 平滑寬度過渡 |

---

*Last updated: 2026-02-27*
