# IQ Copilot Demo Prompt Pack（繁體中文）

目前維護版本為繁體中文（本文件）。

---

## 1) 智慧對話助手（直接貼上）

```text
請用 5 點摘要這個頁面，最後補 3 個建議下一步。
```

Open URL: https://www.msn.com/zh-tw/news/living/%E9%80%8F%E5%A4%A9%E5%8E%9D%E5%B0%87%E6%88%90%E8%BF%BD%E6%86%B6-%E4%BF%A1%E7%BE%A9%E6%88%BF%E5%B1%8B-%E9%9B%BB%E6%A2%AF%E5%A4%A7%E6%A8%93%E6%88%90%E5%85%A8%E5%8F%B0%E8%B6%A8%E5%8B%A2-%E5%B0%8F%E5%AE%85%E5%8C%96%E4%BA%8C%E6%88%BF%E5%B9%B3%E8%BB%8A%E6%88%90%E4%B8%BB%E6%B5%81/ar-AA1WWohT?ocid=msedgntp&pc=U531&cvid=69a378d58e9a40c2bcb8289b4271934d&ei=14
```text
Please summarize this page in English with key risks and action items.
```

Open URL: file:///Users/payton/Downloads/X.pdf
```text
Summarize this document and list action items with owner and ETA.
```

Upload file
```text
Please summarize key issues from this screenshot and propose top 3 fixes.
```

click screenshot button
```text
Based on this page, what are the top 3 key points and 2 potential risks?
```

use slash command to check help, model list, mcp list

---

## 2) Multi-Tab + Multi-Session（直接貼上）

### Tab A（產品規格）

```text
請介紹 Microsoft 的產品，使用 1000 字
```

### Tab B（故障排查）

```text
請介紹 Microsoft 公司，使用 1000 字
```

---

## 3) Proactive + Work IQ

List the features in the panel

---

## 4) Skills / MCP / microsoftdocs / context7（直接貼上）

### skills / MCP
```text
/workiq check latest microsoft foundry deck
```
### microsoftdocs

```text
請用 Microsoft 官方文件整理 Azure Functions HTTP trigger 的設定步驟與注意事項。
```

### context7

```text
/context7 用 context7 幫我查 openai python sdk 最新 chat completion 用法，給最小可跑範例
```
---

## 5) Foundry Agent（直接貼上）

### UM (`um-semantic-agent`)

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

### PKM (`pkm-semantic-agent`)

```text
/foundry_agent_skills pkm-semantic-agent to check
How do I fix projector screen flickering?
```

```text
/foundry_agent_skills pkm-semantic-agent to check
Why is there no image? Please provide step-by-step troubleshooting.
```

### Fabric (`fabric-specs-agent`)

```text
/foundry_agent_skills fabric-specs-agent to check
What is the resolution of 4KB257?
```

```text
/foundry_agent_skills fabric-specs-agent to check
Please list 4K UHD models and their brightness.
```

---

## 6) Foundry 模型（`gen_img`）直接貼上

```text
/gen_img Generate a cute cat picture
```

---

## 7) Quick Custom Prompt（直接貼上）

```text
Action

Please output:
1) 3 key takeaways
2) Action items (owner / ETA)
3) Risks and blockers
```

```text
TLDR

把這段內容改寫成：主管 30 秒可讀完的版本 + 執行者待辦版本。
```

## 8) Usage / Achievement / History（直接貼上）

