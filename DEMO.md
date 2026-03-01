# IQ Copilot Demo Script（中英雙語 / Bilingual）

This runbook is a complete demo flow that covers every feature listed in `docs/FEATURES.md`.
本文件為完整 Demo 腳本，覆蓋 `docs/FEATURES.md` 內所有功能。

---

## Demo Objectives

1. Show **Multi-Tab + Multi-Session** productivity.
2. Show **Foundry Agent integration** through `foundry_agent_skill` (Fabric IQ + Foundry IQ).
3. Show **Foundry model integration** (for example, `gen_img`).
4. Show **Work IQ integration** with customizable prompts.
5. Show **Quick Custom Prompt**, **file attachment Q&A**, **screenshot attachment (including auth pages)**, and **webpage context Q&A**.
6. Cover all additional product features: proactive scan, task tracking, skills/MCP, achievements, usage analytics, history, and security/privacy.

### 中文目標對照

1. 展示 **Multi-Tab + Multi-Session** 的並行效率。
2. 展示透過 `foundry_agent_skill` 串接 **Foundry Agent**（Fabric IQ + Foundry IQ）。
3. 展示 **Foundry 模型整合**（例如 `gen_img`）。
4. 展示 **Work IQ 整合** 與可客製化 prompt。
5. 展示 **Quick Custom Prompt**、**附檔問答**、**頁面截圖附加（含登入頁）**、**網頁上下文問答**。
6. 覆蓋其餘功能：主動掃描、任務追蹤、Skills/MCP、成就、用量統計、歷史、安全與隱私。

---

## 1) Intelligent Chat Assistant

（中文：智慧對話助手）

Goal: demonstrate instant Q&A, page summary, translation, file analysis, and context-aware answers.

### Live steps

1. Ask a general work question for instant Q&A.
2. Ask: `Please summarize this page.`
3. Ask a translation question on foreign-language content.
4. Upload a file and ask: `Summarize this document and list action items.`
5. Click the camera button to capture the current page (works for authenticated pages), then ask: `Please summarize key issues from this screenshot.`
6. Ask a context question: `Based on this page, what are the top 3 key points?`

---

## 2) Multi-Tab + Multi-Session Chat (Must-show)

（中文：多分頁 + 多會話對話，必講）

Goal: prove parallel workflows with isolated context and per-tab model selection.

### Live steps

1. Open 3 chat tabs (`Tab A`, `Tab B`, `Tab C`).
2. Assign different tasks in each tab:
   - `Tab A`: product specs Q&A
   - `Tab B`: troubleshooting Q&A
   - `Tab C`: meeting/document drafting
3. Use different models per tab to show per-tab model selection.
4. Show running status indicators on tabs.
5. Close and reopen the sidebar to show session/model persistence.

---

## 3) Proactive Smart Scan

（中文：Proactive 主動掃描）

Goal: show proactive cards for daily briefing, deadlines, meeting prep, and unreplied messages.

### Live steps

1. Open the proactive/notifications panel.
2. Show examples of:
   - Daily briefing
   - Deadline tracking
   - Meeting prep
   - Unreplied message detection
3. Open one card and ask Copilot to convert it into an action list.

---

## 4) Copilot Tasks Real-Time Tracking

（中文：Copilot Tasks 即時任務追蹤）

Goal: show transparent tool execution with progress and error visibility.

### Live steps

1. Trigger a multi-step request (for example, compare several sources).
2. Show task timeline and parallel tool activity.
3. Show result preview and explain where users can spot failures quickly.

---

## 5) Skills & MCP Integration

（中文：Skills 與 MCP 工具整合）

Goal: show a single interface for enterprise tools and local skills.

### Live steps

1. Open the Skills panel.
2. Show available CLI skills and local repo skills.
3. Trigger a skill from the sidebar and show output in chat.
4. Explain MCP-based extensibility for internal tools.

---

## 6) Foundry Agent Integration (Fabric IQ + Foundry IQ)

（中文：Foundry Agent 整合，串接 Fabric IQ / Foundry IQ）

Integrated via `foundry_agent_skill` with these agents:

- `um-semantic-agent`
- `pkm-semantic-agent`
- `fabric-specs-agent`

### 6.1 Environment setup

```bash
cd .github/skills/foundry_agent_skill
cp .env.example .env
# Fill AZURE_EXISTING_AIPROJECT_ENDPOINT, then run:
python scripts/foundry_agent.py health
python scripts/foundry_agent.py list --limit 20
```

### 6.2 UM Agent (`um-semantic-agent`) prompts

- Which projectors support Short Throw?
- Please list WXGA models and their ports.
- What are the key features of EW805ST?
- Compare the port differences between EW805ST and EU610ST.

CLI demo:

```bash
python scripts/foundry_agent.py invoke --agent-name um-semantic-agent --message "Which projectors support Short Throw?"
python scripts/foundry_agent.py invoke --agent-name um-semantic-agent --message "Please list WXGA models and their ports."
```

### 6.3 PKM Agent (`pkm-semantic-agent`) prompts

- How do I fix projector screen flickering?
- How do I connect a Mac M1 to a projector?
- Why is there no image? Please provide step-by-step troubleshooting.
- How should I configure HDR?

CLI demo:

```bash
python scripts/foundry_agent.py invoke --agent-name pkm-semantic-agent --message "How do I fix projector screen flickering?"
python scripts/foundry_agent.py invoke --agent-name pkm-semantic-agent --message "Why is there no image? Please provide step-by-step troubleshooting."
```

### 6.4 Fabric Agent (`fabric-specs-agent`) prompts

- What is the resolution of 4KB257?
- Compare the key specifications of 4KB257 and AH500ST.
- Which models have brightness above 3000 lumens?
- Please list 4K UHD models and their brightness.

CLI demo:

```bash
python scripts/foundry_agent.py invoke --agent-name fabric-specs-agent --message "What is the resolution of 4KB257?"
python scripts/foundry_agent.py invoke --agent-name fabric-specs-agent --message "Please list 4K UHD models and their brightness."
```

### 6.5 Multi-agent routing validation (optional)

```bash
python scripts/foundry_agent.py invoke --agent-name um-semantic-agent --message "Which models support Short Throw? Then list the top three with the highest brightness."
python scripts/foundry_agent.py invoke --agent-name pkm-semantic-agent --message "What is the brightness of AH500ST? Also, what should I do if the image flickers?"
```

---

## 7) Microsoft Foundry Model Integration (for example, `gen_img`)

（中文：Microsoft Foundry 模型整合，例如 `gen_img`）

Goal: show that IQ Copilot supports not only agent workflows, but also direct model capabilities.

### Talk track

- "The same IQ Copilot experience can connect to Foundry agents and Foundry model capabilities."
- "For example, with `gen_img`, users can generate marketing images or slide draft visuals from natural language prompts."

---

## 8) Work IQ Integration + Custom Prompt Templates

（中文：Work IQ 整合 + 客製 Prompt 模板）

Goal: show standard outputs tailored to enterprise workflows.

### Suggested template

```text
You are a Work IQ assistant. Format output as:
1) Executive summary (3 bullets)
2) Risks / blockers (write "None" if no blocker)
3) Next actions (with owner and ETA)
4) 5-line Teams-ready update
```

### Talk track

- "Teams can enforce a consistent response structure through custom prompts, so outputs are immediately actionable."

---

## 9) Quick Custom Prompt

（中文：快速客製 Prompt）

Goal: show reusable prompt snippets for faster execution.

### Live steps

1. Create a quick custom prompt (for example, `Meeting Note Formatter`).
2. Save this template:

```text
Please output:
1) 3 key takeaways
2) Action items (owner / ETA)
3) Risks and blockers
```

3. Insert it with one click and run it in chat.

---

## 10) Usage Analytics + Achievement System + History

（中文：用量統計 + 成就系統 + 對話歷史）

Goal: show adoption visibility and long-term value.

### Live steps

1. Open usage panel and show:
   - Message/session stats
   - Token breakdown
   - Tool usage counts
   - Time-saved estimate
2. Open achievements panel and show XP, level, and badges.
3. Open history panel and restore a previous conversation.

---

## 11) Security & Privacy

（中文：安全與隱私）

### Talk track

- "Sensitive data processing is designed with local architecture principles."
- "WorkIQ enterprise authentication is supported."
- "Authorization boundaries are controlled per user."

---

## Recommended 15-minute Demo Agenda

1. `2 min` - Intelligent chat (Q&A, summary, translation, file + webpage context)
2. `3 min` - Multi-tab / multi-session + per-tab models
3. `2 min` - Proactive scan + task tracking
4. `4 min` - Skills/MCP + Foundry agents (UM/PKM/Fabric)
5. `1 min` - Foundry model integration (`gen_img`)
6. `1 min` - Work IQ custom prompt + quick custom prompt
7. `2 min` - Usage, achievements, history, security/privacy

### 建議 15 分鐘 Demo 節奏（中文）

1. `2 分鐘` - 智慧對話（即時問答、頁面摘要、翻譯、附檔與網頁上下文）
2. `3 分鐘` - Multi-tab / multi-session + 每個 Tab 不同模型
3. `2 分鐘` - Proactive 掃描 + 任務進度追蹤
4. `4 分鐘` - Skills/MCP + Foundry Agents（UM/PKM/Fabric）
5. `1 分鐘` - Foundry 模型整合（`gen_img`）
6. `1 分鐘` - Work IQ 客製 prompt + Quick Custom Prompt
7. `2 分鐘` - 用量、成就、歷史、安全/隱私