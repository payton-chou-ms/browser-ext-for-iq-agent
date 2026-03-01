# Hackathon Challenge Requirements

## 📦 Submission Checklist

### Required Deliverables

| Item | Description |
|------|-------------|
| **Project Summary** | 150 words max |
| **Demo Video** | 3 mins max, solution in action |
| **GitHub Repo** | Working code + README + architecture diagram + setup instructions |
| **Presentation Deck** | 1-2 slides with business value proposition + architecture diagram + repo link |

### GitHub Repo Structure

```
/src or /app        → Working code
/docs               → README (problem → solution, prereqs, setup, deployment, architecture, RAI notes)
AGENTS.md           → Custom instructions
mcp.json            → MCP server configuration
/presentations      → Demo deck (YourSolutionName.pptx) or link to public post
/customer           → (Optional) Signed testimonial release
```

---

## 🏆 Scoring Criteria

### Core Scoring (100 pts)

| Criteria | Points |
|----------|--------|
| Enterprise applicability, reusability & business value | 35 |
| Integration with Azure / Microsoft solutions | 25 |
| Operational readiness (deployability, observability, CI/CD) | 15 |
| Security, governance & Responsible AI excellence | 15 |
| Storytelling, clarity & "amplification ready" quality | 15 |

### Bonus Points (+35 pts)

| Criteria | Points |
|----------|--------|
| Use of Work IQ / Fabric IQ / Foundry IQ | 15 |
| Validated with a customer | 10 |
| Copilot SDK product feedback (screenshot in SDK channel) | 10 |

---

## 📋 Analysis & Improvement Plan (改進計畫)

### 現況評估

| 評分項目 | 目前狀態 | 預估得分 | 差距 |
|----------|---------|---------|------|
| 企業適用性 & 商業價值 (35) | ✅ 多 Tab 聊天、模型切換、成就系統 | ~25 | 需補強 reusability 文件 |
| Azure 整合 (25) | ⚠️ 可整合 Foundry | ~10 | 需加入 Azure 服務 |
| 部署準備度 (15) | ⚠️ 有 start.sh、無 CI/CD | ~5 | 需加入 GitHub Actions |
| 安全性 & RAI (15) | ⚠️ 無 RAI notes | ~5 | 需加入 RAI 文件 |
| 簡報品質 (15) | ❌ 尚未製作 | ~0 | 需製作簡報 |
| **Bonus: IQ 整合** (15) | ✅ 使用 Copilot CLI (Work IQ) | ~15 | 已達成 |
| **Bonus: 客戶驗證** (10) | ❌ 無 | 0 | 可爭取 |
| **Bonus: SDK 回饋** (10) | ❌ 無 | 0 | 簡單可做 |

**預估總分: ~60/135** → 目標 **100+**

---

### 優先改進項目

#### P0 - 必做 (影響核心評分)

1. **製作簡報** (15 pts)
   - 1-2 頁 PPT：問題 → 解決方案 → 架構圖 → 商業價值
   - 放入 `/presentations/IQ-Copilot-Extension.pptx`

2. **補 README 文件** (影響多項評分)
   - 問題描述 → 解決方案
   - Prerequisites & Setup
   - 部署步驟
   - 架構圖 (Mermaid)
   - RAI notes

3. **錄製 Demo 影片** (必須)
   - 3 分鐘內展示核心功能
   - 多 Tab、串流聊天、模型切換、成就徽章

#### P1 - 強烈建議 (高 ROI)

4. **加入 Azure 整合** (+15 pts potential)
   - Foundry skill 整合 (已有 feature plan)
   - Azure AD 認證
   - Application Insights 監控

5. **建立 CI/CD** (+5 pts)
   ```yaml
   # .github/workflows/ci.yml
   - npm ci && npm test
   - eslint check
   - build extension zip
   ```

6. **送出 SDK 回饋** (+10 pts bonus)
   - 在 SDK team channel 提交回饋截圖

#### P2 - 錦上添花

7. **客戶驗證** (+10 pts bonus)
   - 內部 stakeholder 試用 + 書面回饋

8. **加入 mcp.json**
   - 展示 MCP server 整合能力

---

### 執行時程建議

| 天 | 任務 |
|----|------|
| Day 1 | README 完善 + RAI notes + 架構圖 |
| Day 2 | 簡報製作 + Demo 影片錄製 |
| Day 3 | CI/CD 設定 + SDK 回饋提交 |
| Day 4 | Azure 整合 (Foundry/AppInsights) |
| Day 5 | 測試 + 客戶驗證 + 最終提交 |
