# WorkIQ Direct CLI 收尾分析與優化計畫

> 範圍：Chat、Notification / Proactive、Background、Proxy、Route、Test  
> 日期：2026-03-08  
> 語言：繁體中文

## Summary Status

### 整體狀態

- 狀態：Phase 1、Phase 2、Phase 3 已完成；Phase 4 主要項目已完成
- 目前重點：僅剩選做的 telemetry / debug markers 類優化
- 收尾判定：WorkIQ direct CLI 主路線與主要維護性優化已完成

### 已完成

- Chat 已統一走 direct CLI `/workiq:workiq`
- Proactive / Notification 已統一走 direct CLI `/workiq:workiq`
- WorkIQ status probe 與 query 已統一為 CLI probe / CLI query
- 共用 `src/lib/workiq-cli.ts` 已落地
- `usedCliFallback` 已移除
- proactive session 過渡期 contract 已移除
- notification / proactive refresh 與 schedule card refresh E2E 已補齊
- background alarms mock 噪音已清掉
- WorkIQ response envelope 已統一為共用 execution meta
- proactive prompt builder 已抽出
- timeout constants 已集中
- WorkIQ status probe 已加短 TTL cache
- proactive section refresh / scan-all 已加 in-flight dedupe
- prompt / result normalization contract tests 已補齊

### 尚未完成

- 更完整的 telemetry / debug markers

---

## 1. 目的

本文件只保留兩類資訊：

1. 目前已完成到哪裡
2. 接下來仍值得做的優化項目與建議順序

不再保留已完成項目的完整分析過程，避免文件繼續混入過渡期資訊。

---

## 2. 現況

### 2.1 執行路徑

- Chat：`/workiq <query>` → background → copilot-rpc → `/api/workiq/query` → direct CLI
- Proactive / Notification：background proactive message → copilot-rpc → `/api/proactive/*` → proxy prompt builder → direct CLI
- 雖然 Chat 與 Proactive 仍是不同 endpoint，但底層執行核心已一致為 direct CLI `/workiq:workiq`

### 2.2 目前已成立的結果

- WorkIQ 執行參數已有單一來源
- proactive 不再保留 headless session 路徑語意
- timeout 已拉齊到 180000ms
- notification 與 schedule card 已有 focused E2E 保護
- 單元測試輸出已去除不必要的 alarm mock 噪音

---

## 3. 已完成優化與剩餘 backlog

## 3.1 已完成

### A. 統一 WorkIQ response envelope

狀態：已完成

結果：Chat、Config、Notification、Schedule Card 現在都可使用同一組 execution metadata。

建議保留的欄位：

```ts
interface WorkIqExecutionMeta {
  toolUsed: string;
  unavailable: boolean;
  liveDataConfirmed: boolean;
  liveDataSource: "skill" | "none";
}
```

完成內容：

- 前端顯示規則更一致
- debug 時不需要區分 Chat 與 Proactive 的回傳語意

### B. 抽出 proactive prompt builder

狀態：已完成

結果：prompt 組字串邏輯已從 `src/proxy.ts` 拆到 `src/lib/proactive-prompts.ts`。

建議拆分：

- `buildBriefingPrompt(...)`
- `buildDeadlinesPrompt(...)`
- `buildGhostsPrompt(...)`
- `buildMeetingPrepPrompt(...)`

完成內容：

- `src/proxy.ts` 職責變單純
- prompt diff 更容易 review
- 可直接為 prompt builder 寫純函式測試

### C. 集中 timeout constants

狀態：已完成

結果：WorkIQ / Proactive / RPC 層 timeout 常數已集中到共用 runtime constants。

完成內容：

- 調整 timeout 時不會漏改
- route、client、helper 的 timeout 策略更一致

## 3.2 已完成

### D. WorkIQ status probe 加短 TTL cache

狀態：已完成

結果：`/api/workiq/status` 現在有短 TTL cache，`/api/workiq/probe` 保持強制 refresh。

建議：

- TTL 約 10 到 30 秒
- unavailable 不應快取太久
- 保留手動強制刷新能力

### E. section refresh / scan-all 加 in-flight dedupe

狀態：已完成

結果：同 key 的 proactive section refresh 與 `scan-all` 已加入 in-flight dedupe。

建議 key：

- `briefing`
- `deadlines`
- `ghosts`
- `meeting-prep`
- `scan-all`

完成內容：

- 降低資源浪費
- 降低舊結果覆蓋新結果的風險

## 3.3 已完成

### F. 補 prompt / result normalization contract tests

狀態：已完成

結果：已補 prompt builder 與 result normalization 的 contract tests。

建議新增：

- `tests/unit/proactive-prompts.test.ts`
- `tests/unit/proactive-result-contract.test.ts`

測試重點：

- 每個 proactive prompt 的 schema 契約
- 正常 JSON
- 非 JSON
- 半結構文字
- unavailable / malformed output 的 normalize 行為

## 4. 剩餘 backlog

### 可選後續

1. 補更完整的 telemetry / debug markers
2. 視需要再擴大 E2E 覆蓋面

---

## 5. 成功指標

目前已達成下列條件：

- Chat 與 Proactive 共用同一組 WorkIQ execution meta
- proactive prompt 與 orchestration 已拆分
- timeout 常數只有單一來源
- status probe 不會因高頻操作造成明顯多餘的 CLI 開銷
- section refresh / scan-all 不會互相競態覆蓋
- prompt 與 normalize 行為有 contract tests 保護

---

## 6. 備註

目前 direct CLI 統一路線本身已可視為完成；這份文件接下來應視為「維護性優化 backlog」，而不是「主流程仍未完成的設計文件」。
