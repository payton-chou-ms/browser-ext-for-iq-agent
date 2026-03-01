# IQ Copilot — Demo Prompt Pack

> Copy-paste each prompt into the IQ Copilot sidebar to demo the corresponding feature.

---

## 1. Smart Chat Assistant

### 1-1 Page Summary (navigate to a news article first)

```text
Summarize this page in 5 bullet points, then suggest 3 next steps.
```

### 1-2 Page Summary — English (open any non-English page)

> Example URL: `https://www.msn.com/zh-tw/news/living/...`

```text
Please summarize this page in English with key risks and action items.
```

### 1-3 Document Summary (open a PDF)

> Example: `file:///Users/payton/Downloads/X.pdf`

```text
Summarize this document and list action items with owner and ETA.
```

### 1-4 Screenshot Analysis (click the 📷 screenshot button first)

```text
Please summarize key issues from this screenshot and propose top 3 fixes.
```

### 1-5 Page Analysis (upload a PDF)

```text
Based on this page, what are the top 3 key points and 2 potential risks?
```

### 1-6 Slash Commands

Use `/help`, `/models`, `/mcp` to explore available commands, models, and MCP tools.

---

## 2. Multi-Tab & Multi-Session

### Tab A — Product Overview

```text
Introduce Microsoft's product lineup in approximately 1000 words.
```

### Tab B — Company Overview

```text
Introduce Microsoft as a company in approximately 1000 words.
```

---

## 3. Proactive & Work IQ

Open the **Proactive** panel from the left nav and review the listed features.

---

## 4. Skills / MCP / Microsoft Docs / Context7

### 4-1 Work IQ Skill

```text
/workiq check latest azure speech deck
```

### 4-2 Microsoft Docs

```text
Using official Microsoft documentation, outline the setup steps and best practices for Azure Functions HTTP triggers.
```

### 4-3 Context7

```text
/context7 Look up the latest OpenAI Python SDK chat completion usage and provide a minimal runnable example.
```

---

## 5. Foundry Agents

### 5-1 UM Agent (`um-semantic-agent`)

```text
/foundry_agent_skills um-semantic-agent to check Which projectors support Short Throw?
```

```text
/foundry_agent_skills um-semantic-agent to check
Please list WXGA models and their ports.
```

```text
/foundry_agent_skills um-semantic-agent to check
Compare the port differences between EW805ST and EU610ST.
```

### 5-2 PKM Agent (`pkm-semantic-agent`)

```text
/foundry_agent_skills pkm-semantic-agent to check
How do I fix projector screen flickering?
```

```text
/foundry_agent_skills pkm-semantic-agent to check
Why is there no image? Please provide step-by-step troubleshooting.
```

### 5-3 Fabric Agent (`fabric-specs-agent`)

```text
/foundry_agent_skills fabric-specs-agent to check
What is the resolution of 4KB257?
```

```text
/foundry_agent_skills fabric-specs-agent to check
Please list 4K UHD models and their brightness.
```

---

## 6. Image Generation (`gen_img`)

```text
/gen_img Generate a cute cat picture
```

---

## 7. Quick Custom Prompts

### Action Summary

```text
Action

Please output:
1) 3 key takeaways
2) Action items (owner / ETA)
3) Risks and blockers
```

### TLDR

```text
TLDR

Rewrite this content into two versions:
- Executive brief (readable in 30 seconds)
- Action-item checklist for the team
```

---

## 8. Usage / Achievements / History

Open the **Usage**, **Achievements**, and **History** panels from the left nav to review session stats, unlocked badges, and past conversations.

