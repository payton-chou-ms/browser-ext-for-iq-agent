# IQ Copilot — Runtime 優化計畫

> 建立：2026-02-27
> 最後更新：2026-03-01

---

## Codebase 概況（2026-03-01 掃描）

| 指標 | 數值 |
|------|------|
| 總行數 | ~12,076 行（src/） |
| 最大檔案 | chat.js (1,041)、background.js (835)、sidebar.js (~660) |
| chrome.storage 呼叫點 | 34 處 |
| innerHTML 賦值點 | ~30 處 |
| addEventListener 數量（sidebar） | 34 處 |
| 仍有 splice 突變 | 3 處（utils.js 內部快取管理，可接受） |

---

## ✅ 已完成

| ID | 問題 | 完成日期 | 實作摘要 |
|----|------|----------|----------|
| P2-12b | Streaming DOM diff 完善 | 2026-03-01 | text-node append（plain delta）+ structural markdown 邊界 full rebuild；deferred 150ms rebuild 確保 inline 格式 |
| P2-13 | formatText 主線程阻塞 | 2026-03-01 | `lib/format-worker.js` Web Worker + `formatTextAsync()`（>500 chars 走 Worker，含 200ms 超時 fallback） |
| P2-14 | sidebar.js 過大 | 2026-03-01 | 拆出 `lib/command-menu.js`（~320 行）+ `lib/panels/quick-prompts.js`（~240 行）；sidebar.js 1,241→~660 行 |
| P2-15 | 殘留 mutable splice | 2026-03-01 | sidebar.js（quickPrompts）+ file-upload.js（pendingFiles）改用 immutable filter |
| P2-16 | debugLog 重複實作 | 2026-03-01 | utils.js 統一為 CSS class 版；sidebar.js wrapper 移除 |
| P3-11 | Skills Cache TTL 偏短 | 2026-03-01 | `CACHE_TTL_TOOLS_MS` 5 min → 30 min |
| P3-12 | 首屏連線等待 | 2026-03-01 | `<link rel="preconnect">` + skeleton placeholder UI（CSS pulse 動畫） |
| P3-13 | Tab 切換閃爍 | 2026-03-01 | DocumentFragment off-DOM 組裝 + rAF 單次 DOM mutation |
| P3-16 | achievement-engine 雙版本 | 2026-03-01 | `.gitignore` 加入 build 產出 `achievement-engine.js`；僅維護 `.ts` 原始碼 |

---

## 🔵 P3 — 低優先度 / 長期改善（待辦）

| ID | 問題 | 狀態 | 下一步 | 預估工時 |
|----|------|------|------|----------|
| P3-6 | RPC transport 分散請求 | TODO | 研究 batched endpoint（routes/ 中無 batch 路由） | 2 天 |
| P3-7 | 首屏啟動同步初始化過多 | TODO | sidebar.js init() 同時載入 8 個模組，非首屏 panel 應 lazy init | 1 天 |
| P3-8 | **多 Tab 全量記憶體佔用** | TODO | 非活躍 tab 的 chatHistory lazy load（目前所有 tab 完整載入） | 1.5 天 |
| P3-9 | **長對話 DOM 效能** | TODO | Virtual scrolling（未引入任何虛擬滾動方案） | 2 天 |
| P3-10 | **大 chatHistory 儲存** | TODO | 改用 IndexedDB（目前全用 chrome.storage.local，5MB 限制） | 2 天 |
| P3-14 | **chat.js 過大（1,041 行）** | TODO | 可拆分 session management、message rendering、page context 為獨立模組 | 1 天 |
| P3-15 | **Proactive 模組分散（4 檔共 ~1,500 行）** | TODO | proactive-render / proactive-scan / proactive-state / proactive.js 耦合度高，可整合或重構介面 | 1.5 天 |

---

## 優化優先順序建議

```
Phase 1 + 2 ✅ 已完成（9 項）

Phase 3（Long-term，剩餘 ~11.5 天）
├── P3-7 首屏 Lazy Init（1 天）
├── P3-8 Tab Lazy Load（1.5 天）
├── P3-9 Virtual Scrolling（2 天）
├── P3-10 IndexedDB Migration（2 天）
├── P3-14 chat.js 拆分（1 天）
├── P3-15 Proactive 模組重構（1.5 天）
└── P3-6 RPC Batch Endpoint（2 天）
```

---

## 效能監測建議

建議在開發環境中加入以下監測：

| 指標 | 工具 | 目標 |
|------|------|------|
| Streaming frame drop | `PerformanceObserver` long task | < 50ms per task |
| Storage write 頻率 | `batchStorageWrite` 內部計數器 | < 2 writes/sec avg |
| DOM node 數量 | `document.querySelectorAll('*').length` | < 2000 nodes |
| 記憶體佔用 | `performance.memory` (Chrome) | < 50MB heap |
| Cache hit ratio | `debugLog CACHE HIT/MISS` 計數 | > 80% hit rate |

---

## 備註

- P3-14/P3-15 為長期代碼品質改善
- P3-8/P3-9/P3-10 為長對話效能瓶頸修復
- P3-6 需後端配合，優先度最低
