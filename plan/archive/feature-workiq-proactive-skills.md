# WorkIQ Proactive Skills 規劃（取代舊版命名）

> Last Updated: 2026-02-27  
> Status: Active (Terminology Aligned)

## 說明

此文件取代舊版 Proactive 規劃命名，
統一使用目前產品術語：**Proactive 掃描 + Skills/Tools**。

現行方向：

- 不使用舊版模式 / 舊版面板
- Proactive 能力以掃描項目與技能執行方式呈現
- UI 以結果卡片、提醒卡片與可追蹤工具流程為主

## Proactive 掃描主題

1. 每日晨報（Daily Briefing）
2. 費用與截止日追蹤（Deadline Hawk）
3. 會議準備（Meeting Prep）
4. 未回覆偵測（Ghost Detector）

## 流程定位

- Data source: WorkIQ / M365（Email、行事曆、Teams、檔案）
- Processing: Foundry skills 或後端工具鏈
- UI output: Sidebar 卡片 + chat 摘要 + 歷史記錄

## 後續規劃

1. 補齊 proactive 事件串接與追蹤欄位
2. 統一輸出 schema，支援更穩定的卡片渲染
3. 增加錯誤回退策略與 observability 指標

## 參考文件

- `README.md`：現行產品行為與限制
- `plan/archive/feature-achievement.md`：成就系統中的 Proactive 掃描類

## 備註

保留原檔名只為了相容既有連結；
內容已完成 terminology cleanup，不再使用舊版模式設計語彙。
