# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-02-27（review 後）

---

## Review 結論（剩餘待辦）

### 🔴 P0 — 必須先修（穩定性回歸）

#### P0-2：Idle 請求風暴（每 60 秒 `models/session/tools/quota/context/scan-all`）— **🟡 IN PROGRESS**

- **症狀**：proxy log 顯示每 ~60 秒出現一批 6 個請求
- **目前已完成**：server 端 scan-all 節流、連線廣播與 alarm 防重複保護
- **仍需完成**：
  1. 加入 trigger source 追蹤（`cold-start` / `reconnect` / `alarm` / `manual`）
  2. 將初始化流程改為「只在 cold-start 執行完整 init」
  3. 10 分鐘 idle 觀測驗收（只允許健康檢查，禁止每分鐘 init 批次）

#### P0 驗收標準

- [ ] Idle 10 分鐘內不再出現每分鐘 `models/session/tools/quota/context/scan-all` 批次請求
- [ ] sidepanel 重新開關不會觸發完整 init storm

---

### 🟠 P1 — 高優先度改善

#### P1-2：單元測試覆蓋率不足 — **🟡 IN PROGRESS**

- **已完成**：`achievement-engine`、`utils`、`routes` 基礎測試已建立
- **剩餘缺口**：
  1. `proxy.ts`：`readBody` / `readJsonBody` / body-size guard 測試
  2. `routes/foundry.ts`：錯誤路徑與 schema 驗證測試
  3. `routes/session.ts`：SSE 流程（error / done / disconnect）測試
- **目標**：核心邏輯覆蓋率達 60%+

#### P1 驗收標準

- [ ] `tests/unit` 補齊 proxy 與 foundry/session 主要路徑
- [ ] `npm run test:unit` 穩定通過，且覆蓋率報告達標

---

### 🟡 P2 — 中優先度改善

#### P2 後續優化（未開始）

| ID | 問題 | 狀態 | 下一步 |
|----|------|------|------|
| P2-7 | UI render 全量重繪 | TODO | 改為最小更新策略（避免整段 `innerHTML` 重建） |
| P2-8 | Cache invalidation 規則分散 | TODO | 統一 cache policy 與事件驅動失效 |
| P2-9 | 部分 state mutation 非 immutable | TODO | 統一改為 immutable 更新風格 |
| P2-10 | Storage 細粒度頻繁寫入 | TODO | 合併批次寫入與 debounce |

---

### 🔵 P3 — 低優先度 / 長期改善

| ID | 問題 | 狀態 | 下一步 |
|----|------|------|------|
| P3-6 | RPC transport 分散請求 | TODO | 研究 batched endpoint |
| P3-7 | 首屏啟動同步初始化過多 | TODO | 採 lazy init（非首屏 panel 延後） |

---

## 目前執行順序（review 後）

```
P0-2（idle storm 驗收封板）
→ P1-2（補 proxy/foundry/session 單測）
→ P2-7/P2-8（render + cache policy）
→ P2-9/P2-10（immutable + storage batching）
→ P3-6/P3-7（batch RPC + lazy init）
```

---

## 備註

- 本文件僅保留「剩餘待辦」；已完成項目不另外維護 changelog。
