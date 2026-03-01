---
name: foundry_agent_skill
description: '使用 Microsoft Foundry Agent Service 列出 Agent、呼叫指定 Agent、健康檢查。'
---

# Foundry Agent Skill

此技能以獨立腳本封裝 Microsoft Foundry Agent Service 呼叫流程，不依賴專案原始程式碼。

## 功能特色

- ✅ 使用 `az login` + `DefaultAzureCredential` 本機驗證
- ✅ 列出 Foundry project 內可用 agents
- ✅ 呼叫指定 agent 並取得回應
- ✅ 支援多輪對話（`session_id` / `previous_response_id`）

## 使用方式

```bash
# 先進入 skill 目錄
cd .github/skills/foundry_agent_skill

# 健康檢查
./scripts/foundry_agent.sh health

# 列出 agents
./scripts/foundry_agent.sh list --limit 20

# 呼叫指定 agent
./scripts/foundry_agent.sh invoke --agent-name um-semantic-agent --message "哪些投影機支援 Short Throw?"

# 多輪對話（帶前一輪 response id）
./scripts/foundry_agent.sh invoke \
  --agent-name um-semantic-agent \
  --message "再補充一下 EW805ST" \
  --session-id <previous_response_id>
```

## 參數說明

### `health`

| 參數 | 必填 | 預設 | 說明 |
|------|------|------|------|
| `--json` | ❌ | `false` | 以 JSON 輸出檢查結果 |

### `list`

| 參數 | 必填 | 預設 | 說明 |
|------|------|------|------|
| `--limit` | ❌ | `50` | 最多列出幾個 agents |
| `--json` | ❌ | `false` | 以 JSON 輸出結果 |

### `invoke`

| 參數 | 必填 | 預設 | 說明 |
|------|------|------|------|
| `--agent-name` | ✅ | - | 目標 agent 名稱 |
| `--message` | ✅ | - | 輸入訊息 |
| `--session-id` | ❌ | - | 前一輪 response id（多輪對話） |
| `--json` | ❌ | `false` | 以 JSON 輸出結果 |

## 環境設定

| 變數名稱 | 說明 |
|----------|------|
| `AZURE_EXISTING_AIPROJECT_ENDPOINT` | Foundry Project Endpoint |
| `SKILL_REQUEST_TIMEOUT_SECONDS` | request timeout（目前作為設定值保留） |

## 相依套件

Wrapper script 會自動建立 venv 並安裝依賴，無需手動安裝。

如需手動安裝：

```bash
pip install azure-ai-projects azure-identity python-dotenv
```
