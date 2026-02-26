# Plan: Agent 工作視覺化 — 在 IQ Copilot Browser Extension 中呈現 Agent 工作狀態

## 問題陳述

目前 IQ Copilot 瀏覽器擴充功能在與 Copilot CLI 對話時，只有基本的 typing indicator（三個跳動的點）和簡單的 tool call 卡片。使用者無法直觀地看到 Agent 真正在「做什麼」：正在思考、呼叫哪些工具、子 Agent 分工、Fleet 模式平行任務等。

## 目標

設計一個視覺化系統，讓使用者在 Browser Extension 的 Chat 面板中，看到 Agent 工作的完整過程，包括：
1. **Thinking 狀態** — Agent 正在推理時的視覺化呈現
2. **Tool Call 即時追蹤** — 更豐富的工具呼叫卡片，帶有動畫和狀態指示
3. **Sub-Agent 視圖** — 當產生子 Agent 時顯示分支
4. **Fleet 模式儀表板** — 平行任務的甘特圖/進度條
5. **Timeline 時間軸** — 整個工作流程的時間軸視圖

## 現有架構分析

### 已有的基礎
- **copilot-rpc.js**: 已有 SSE 串流支援（`rpcStream`），可以接收即時事件
- **sidebar.js**: 已有 `createToolCallCard()` 和 `updateToolCallCard()` 處理 tool call
- **sidebar.css**: 已有 `.tool-call-card` 樣式系統（含 running/success/error 狀態）
- **background.js**: 已有 streaming port 機制（`copilot-stream`）轉發事件

### SSE 事件結構（來自 Copilot CLI JSON-RPC stream）
目前處理的事件類型：
- `msg.data.content` — 文字內容 delta
- `msg.data.tool.call` — 工具呼叫開始（name, args）
- `msg.data.tool.result` — 工具結果返回
- `msg.data.usage` — Token 用量

### 需要額外攔截的事件（從 Copilot SDK stream 取得）
- `thinking` / `reasoning` — Agent 推理內容
- `subagent_spawn` — 子 Agent 啟動
- `subagent_complete` — 子 Agent 完成
- `fleet_task_start` / `fleet_task_complete` — Fleet 任務
- `intent` — Agent 目前意圖/正在做什麼

---

## 實作計劃

### TODO 1: 增強 Thinking 狀態視覺化
**檔案**: `sidebar.js`, `sidebar.css`

在收到 thinking/reasoning 事件時，顯示一個可折疊的「Agent 正在思考」區塊：

```
┌─────────────────────────────┐
│ 🧠 Agent 正在思考...         │
│ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ │
│ │ 分析使用者的問題...       │ │
│ │ 決定需要搜尋程式碼庫     │ │
│ │ 選擇使用 grep 工具       │ │
│ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘ │
└─────────────────────────────┘
```

- 新增 CSS class: `.thinking-card` 帶脈衝動畫邊框
- 思考內容即時串流顯示（打字機效果）
- 折疊/展開切換
- 思考完成後自動收縮

### TODO 2: 增強 Tool Call 卡片（帶動畫和計時器）
**檔案**: `sidebar.js`, `sidebar.css`

改進現有 `.tool-call-card`：

```
┌─────────────────────────────────────┐
│ 🔧 grep("pattern", "src/")  ⏱ 1.2s │
│ ├─ Status: ████████░░ 執行中         │
│ └─ [展開查看詳情]                    │
└─────────────────────────────────────┘
```

- 加入即時計時器（從 tool call 開始到結束的時間）
- 工具圖示對應（bash=💻, edit=✏️, grep=🔍, view=📄, create=📝）
- 執行中的旋轉動畫（spinner）
- 成功/失敗的顏色轉場動畫
- 結果預覽（前 3 行 + 展開全部）

### TODO 3: Intent 即時顯示（Agent 正在做什麼）
**檔案**: `sidebar.js`, `sidebar.css`, `sidebar.html`

在 Chat 訊息區上方加一個浮動狀態列：

```
┌───────────────────────────────────┐
│ 🤖 正在搜尋程式碼...  ●           │
└───────────────────────────────────┘
```

- 攔截 `intent` 事件更新顯示文字
- 脈衝動畫的圓點表示正在活動
- 無活動時自動淡出
- 可以是 position: sticky 在訊息區頂端

### TODO 4: Sub-Agent 視覺化
**檔案**: `sidebar.js`, `sidebar.css`

當偵測到子 Agent 啟動時，在 Chat 中嵌入分支視圖：

```
┌─ 主 Agent ──────────────────────┐
│ 正在分析需求...                   │
│                                  │
│  ┌─ 子 Agent: explore ──────┐   │
│  │ 🔍 搜尋 auth 相關檔案...  │   │
│  │ 找到 3 個檔案             │   │
│  │ ✅ 完成 (2.1s)           │   │
│  └───────────────────────────┘   │
│                                  │
│ 根據分析結果...                   │
└──────────────────────────────────┘
```

- 縮排 + 左側邊框的巢狀卡片
- 子 Agent 類型標示（explore / task / general-purpose）
- 即時狀態更新
- 完成時顯示耗時

### TODO 5: Fleet 模式儀表板
**檔案**: `sidebar.js`, `sidebar.css`, `sidebar.html`

在 Tasks 面板中加入 Fleet 視圖：

```
┌─ Fleet 任務 (3/5 完成) ─────────┐
│                                  │
│ Agent 1: 修改 auth.ts            │
│ ████████████████████ ✅ 完成     │
│                                  │
│ Agent 2: 更新測試                 │
│ █████████████░░░░░░░ 🔄 65%     │
│                                  │
│ Agent 3: 修改 README              │
│ ████████░░░░░░░░░░░ 🔄 40%     │
│                                  │
│ Agent 4: 檢查 CI                 │
│ ░░░░░░░░░░░░░░░░░░░ ⏳ 等待中   │
│                                  │
│ Agent 5: Code Review             │
│ ░░░░░░░░░░░░░░░░░░░ ⏳ 等待中   │
│                                  │
│ 總進度: ████████░░░░ 60%         │
│ 預估剩餘時間: ~45s               │
└──────────────────────────────────┘
```

- 每個 Agent 一行進度條
- 即時百分比更新
- 色彩區分狀態（完成=綠、執行中=藍、等待=灰）
- 可點擊展開查看個別 Agent 的 tool call 細節
- 總進度條和預估剩餘時間

### TODO 6: Timeline 時間軸視圖
**檔案**: `sidebar.js`, `sidebar.css`, `sidebar.html`

在 Tasks 面板中新增時間軸 tab：

```
時間軸 ──────────────────────────
│
├─ 0.0s  📩 收到使用者訊息
│
├─ 0.1s  🧠 開始思考 (0.8s)
│
├─ 0.9s  🔍 grep: "auth" (1.2s)
│         └─ 找到 3 個檔案
│
├─ 2.1s  📄 view: src/auth.ts (0.3s)
│
├─ 2.4s  🤖 啟動子 Agent: explore
│         ├─ 3.0s  🔍 搜尋測試檔案
│         └─ 4.2s  ✅ 完成
│
├─ 4.5s  ✏️ edit: src/auth.ts (0.5s)
│
└─ 5.0s  💬 回覆完成
```

- 垂直時間軸佈局
- 每個事件有圖示、描述、耗時
- 子 Agent 以縮排顯示
- 可點擊展開查看詳細內容
- 即時更新（新事件動畫插入底部）

### TODO 7: SSE 事件解析增強
**檔案**: `sidebar.js`, `background.js`

增強 streaming 事件處理，攔截更多 Copilot SDK 事件類型：

```javascript
// 新增事件處理：
if (msg.data?.thinking)      → 更新 thinking card
if (msg.data?.intent)        → 更新 intent 狀態列
if (msg.data?.subagent)      → 建立/更新子 Agent 卡片
if (msg.data?.fleet)         → 更新 Fleet 儀表板
if (msg.data?.timeline)      → 新增時間軸條目
```

- 在 `background.js` 的 `STREAM_EVENT` 中透傳所有事件
- 在 `sidebar.js` 中建立事件分發器（event dispatcher）
- 為每種事件建立對應的 UI 更新函數

### TODO 8: 動畫系統
**檔案**: `sidebar.css`

統一的動畫語言：
- **思考中**: 漸變色脈衝邊框 (gradient pulse border)
- **工具執行中**: 旋轉 spinner + 進度條動畫
- **子 Agent 啟動**: 滑入動畫 (slide-in)
- **完成**: 綠色閃爍確認 (flash confirm)
- **錯誤**: 紅色搖晃 (shake + red flash)
- **Fleet 進度**: 平滑寬度動畫 (smooth width transition)

---

## 實作順序與依賴

```
TODO 7 (事件解析) ← 所有其他 TODO 都依賴此項
    │
    ├── TODO 1 (Thinking)     ← 獨立
    ├── TODO 3 (Intent)       ← 獨立
    ├── TODO 2 (Tool Call)    ← 獨立
    │
    ├── TODO 4 (Sub-Agent)    ← 依賴 TODO 1, 2
    ├── TODO 5 (Fleet)        ← 依賴 TODO 4
    │
    ├── TODO 6 (Timeline)     ← 依賴 TODO 1, 2, 4
    │
    └── TODO 8 (動畫)          ← 與所有 TODO 平行, 最後統一

建議實作順序:
Phase 1: TODO 7 → TODO 3 → TODO 1 → TODO 2
Phase 2: TODO 4 → TODO 5
Phase 3: TODO 6 → TODO 8
```

## 技術注意事項

1. **事件格式不確定性**: Copilot CLI headless 模式的 SSE 事件格式可能不完全支援所有上述事件。需先用 debug log 觀察實際收到的事件結構，再調整解析邏輯。
2. **效能**: Tool call 卡片和時間軸條目會隨對話增長，需要虛擬滾動或限制顯示數量。
3. **向後相容**: 新功能必須不破壞現有的 streaming 聊天功能。
4. **CSS 動畫效能**: 使用 `transform` 和 `opacity` 做動畫，避免觸發 layout reflow。
