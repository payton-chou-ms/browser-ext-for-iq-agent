# Foundry Agent Skill (Quick Start)

最短路徑：用本機 `az login` 呼叫 Foundry Agent Service。

完整 Demo 腳本（含 Multi-Tab / Foundry Agents / Foundry Model / Work IQ Prompt）請見：[`DEMO-zhtw.md`](../../../docs/DEMO-zhtw.md)

## ⚠️ 注意事項

### SDK 版本要求

此 skill 需要 `azure-ai-projects>=2.0.0b4`。若使用舊版 SDK（如 1.0.0），會出現以下錯誤：

- `'AgentsClient' object has no attribute 'get'`
- `agents.list() not supported`

### Browser Extension 環境

當透過 Browser Extension 執行此 skill 時：
- 會使用 `.venv` 內的 Python 環境
- Wrapper script (`./scripts/foundry_agent.sh`) 會自動建立 venv 並安裝依賴
- 確保 `start.sh` 或 wrapper script 安裝的是 `azure-ai-projects>=2.0.0b4`

## 1) 安裝

```bash
pip install "azure-ai-projects>=2.0.0b4" azure-identity python-dotenv
```

## 2) 設定環境

```bash
cd .github/skills/foundry_agent_skill
cp .env.example .env
```

在 `.env` 填入：

```dotenv
AZURE_EXISTING_AIPROJECT_ENDPOINT=https://<your-project>.services.ai.azure.com/api/projects/<project-name>
SKILL_REQUEST_TIMEOUT_SECONDS=45
```

## 3) 使用

```bash
# 健康檢查
python scripts/foundry_agent.py health

# 列出 agents
python scripts/foundry_agent.py list --limit 20

# 呼叫指定 agent
python scripts/foundry_agent.py invoke --agent-name um-semantic-agent --message "哪些投影機支援 Short Throw?"
```

## 4) 多輪對話（可選）

```bash
python scripts/foundry_agent.py invoke \
  --agent-name um-semantic-agent \
  --message "再補充 EW805ST" \
  --session-id <previous_response_id>
```

## 5) 測試題庫（可直接貼上的 prompt）

### UM Agent（um-semantic-agent）

- 哪些投影機支援 Short Throw？
- 請列出 WXGA 解析度的機種與連接埠
- EW805ST 有哪些特色功能？
- 請比較 EW805ST 與 EU610ST 的連接埠差異

### PKM Agent（pkm-semantic-agent）

- 投影機螢幕閃爍怎麼處理？
- 如何連接 Mac M1 到投影機？
- 為什麼沒有畫面？請給我排查步驟
- HDR 要怎麼設定？

### Fabric Agent（fabric-specs-agent）

- 4KB257 的解析度是多少？
- 比較 4KB257 和 AH500ST 的主要規格
- 亮度大於 3000 的機種有哪些？
- 請列出 4K UHD 的機種與亮度

### Multi-Agent（驗證路由）

- AH500ST 亮度多少？如果畫面閃爍怎麼辦？
- TH685 支援 4K 嗎？解析度是多少？
- 哪些機種支援 Short Throw？再幫我列出其中亮度最高的三台

### Skill 直測（.github/skills/foundry_agent_skill）建議 message

- 哪些投影機支援 Short Throw？
- 投影機螢幕閃爍怎麼處理？
- 4KB257 的解析度是多少？
- 第二輪續問（帶 session）：請用表格重整剛剛的答案

### Skill CLI 範例（可直接執行）

```bash
# 單輪
python scripts/foundry_agent.py invoke --agent-name um-semantic-agent --message "哪些投影機支援 Short Throw?"
python scripts/foundry_agent.py invoke --agent-name pkm-semantic-agent --message "投影機螢幕閃爍怎麼處理？"
python scripts/foundry_agent.py invoke --agent-name fabric-specs-agent --message "4KB257 的解析度是多少？"

# 多輪（第二輪）
python scripts/foundry_agent.py invoke --agent-name um-semantic-agent --message "請用表格重整剛剛的答案" --session-id <previous_response_id>
```

## 6) English Test Prompt Bank (ready-to-use)

### UM Agent (`um-semantic-agent`)

- Which projectors support Short Throw?
- Please list WXGA models and their ports.
- What are the key features of EW805ST?
- Compare the port differences between EW805ST and EU610ST.

### PKM Agent (`pkm-semantic-agent`)

- How do I fix projector screen flickering?
- How do I connect a Mac M1 to a projector?
- Why is there no image? Please provide step-by-step troubleshooting.
- How should I configure HDR?

### Fabric Agent (`fabric-specs-agent`)

- What is the resolution of 4KB257?
- Compare the key specifications of 4KB257 and AH500ST.
- Which models have brightness above 3000 lumens?
- Please list 4K UHD models and their brightness.

### Multi-Agent (routing validation)

- What is the brightness of AH500ST? Also, what should I do if the image flickers?
- Does TH685 support 4K? What is its resolution?
- Which models support Short Throw? Then list the top three with the highest brightness.

### Direct Skill Test (`.github/skills/foundry_agent_skill`) suggested messages

- Which projectors support Short Throw?
- How do I fix projector screen flickering?
- What is the resolution of 4KB257?
- Follow-up turn (with session): Please reformat the previous answer as a table.

### Skill CLI examples (copy & run)

```bash
# Single-turn
python scripts/foundry_agent.py invoke --agent-name um-semantic-agent --message "Which projectors support Short Throw?"
python scripts/foundry_agent.py invoke --agent-name pkm-semantic-agent --message "How do I fix projector screen flickering?"
python scripts/foundry_agent.py invoke --agent-name fabric-specs-agent --message "What is the resolution of 4KB257?"

# Multi-turn (second turn)
python scripts/foundry_agent.py invoke --agent-name um-semantic-agent --message "Please reformat the previous answer as a table." --session-id <previous_response_id>
```
