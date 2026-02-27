# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-02-27

---

## Review 結論（剩餘待辦）

### 🔴 P0 — 必須先修（穩定性回歸）

#### P0-2：Idle 請求風暴（每 60 秒 `models/session/tools/quota/context/scan-all`）— **待驗收封板**

- **症狀**：proxy log 顯示每 ~60 秒出現一批 6 個請求
- **根本原因（2026-02-27 診斷）**：
  - Service Worker 在 MV3 中會被週期性 kill/restart
  - 重啟後 `_lastBroadcastState` 重置為 `"disconnected"`
  - Alarm 觸發連線檢查成功 → `connectionState = "connected"`
  - `broadcastState()` 誤判為狀態改變 → 觸發 sidebar 完整 init storm
- **目前待做**：
  - 10 分鐘 idle 觀測（只允許健康檢查，禁止每分鐘 init 批次）
  - sidepanel 開關/重連情境回歸測試
  - proxy log 取樣與結論紀錄

#### P0 驗收標準

- [ ] Idle 10 分鐘內不再出現每分鐘 `models/session/tools/quota/context/scan-all` 批次請求
- [ ] sidepanel 重新開關不會觸發完整 init storm
- [ ] proxy log 確認只有 `/health` 週期性呼叫（5 min 間隔）

---

### 🟡 P2 — 中優先度改善

#### P2 後續優化（待排程）

| ID | 問題 | 狀態 | 實作位置 |
|----|------|------|----------|
| P2-7 | UI render 全量重繪 | 待觀察 | 觀測 UI 更新頻率與重繪成本 |
| P2-8 | Cache invalidation 規則分散 | 待觀察 | 檢查 cache miss 比例與失效時機 |
| P2-9 | 部分 state mutation 非 immutable | 待觀察 | 針對高風險狀態更新點做 code review |
| P2-10 | Storage 細粒度頻繁寫入 | 待觀察 | 追蹤寫入次數與延遲抖動 |

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
→ P2-7/P2-8/P2-9/P2-10（觀測與必要調整）
→ P3-6/P3-7（batch RPC + lazy init）
```

---

## 備註

- 本文件僅保留剩餘待辦；已完成內容已移除。
