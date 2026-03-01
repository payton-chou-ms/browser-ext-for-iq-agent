// ===== IQ Copilot — Command Menu Module =====
// Extracted from sidebar.js (P2-14) for file size reduction.

(function initIQCommandMenu(global) {
  "use strict";

  const root = global.IQ || (global.IQ = {});
  const CONFIG = root.state?.CONFIG || {};
  const UTILS = root.utils || {};
  const CONN = root.connection || {};
  const CHAT = root.chat || {};
  const PANELS = root.panels || {};
  const I18N_MOD = root.i18n || {};
  const localizeRuntimeMessage = I18N_MOD.localizeRuntimeMessage || ((m) => m);
  const escapeHtml = UTILS.escapeHtml || ((s) => s);

  // ── DOM refs ──
  let _commandMenu = null;
  let _chatInput = null;
  let _btnCommandMenu = null;

  // ── State ──
  const commandState = {
    open: false,
    activeIndex: -1,
    items: [],
  };

  const COMMAND_GROUP_LABEL = {
    general: "General",
    skills: "Skills",
    models: "Models",
    mcp: "MCP",
  };

  function resolveDOM() {
    _commandMenu = document.getElementById("command-menu");
    _chatInput = document.getElementById("chat-input");
    _btnCommandMenu = document.getElementById("btn-command-menu");
  }

  function switchPanel(id) {
    root._switchPanel?.(id);
  }

  function getCommandItems() {
    const chatState = CHAT.getState?.() || {};
    const availableModels = Array.isArray(chatState.availableModels) ? chatState.availableModels : [];
    const currentModel = chatState.currentModel || CONFIG.DEFAULT_MODEL || "gpt-4.1";

    const getModelId = (m) => (typeof m === "string" ? m : m?.id || m?.name || String(m));
    const getModelLabel = (m) => (typeof m === "string" ? m : m?.name || m?.id || String(m));

    const normalizedModels = availableModels
      .map((m) => ({ id: getModelId(m), label: getModelLabel(m) }))
      .filter((m) => m.id);

    const seen = new Set();
    const modelOptions = normalizedModels.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    const baseItems = [
      {
        id: "help",
        group: "general",
        title: "顯示命令說明",
        description: "列出可用命令與用法",
        command: "/help",
        run: async () => [
          "**可用命令**",
          "- `/help` 顯示命令說明",
          "- `/foundry_agent_skills <query>` 使用 Foundry skill 查詢",
          "- `/model list` 列出模型",
          "- `/model refresh` 刷新模型",
          "- `/model use <model-id>` 切換模型",
          "- `/mcp status` 檢視 MCP 狀態",
          "- `/mcp reload` 重新載入 MCP 設定",
        ].join("\n"),
      },
      {
        id: "foundry-agent-skills",
        group: "skills",
        title: "Foundry Agent Skills 查詢",
        description: "用法：/foundry_agent_skills <query>",
        command: "/foundry_agent_skills",
        run: async () => [
          "**Foundry Agent Skills**",
          "用法：`/foundry_agent_skills <query>`",
          "範例：`/foundry_agent_skills How do I fix projector screen flickering?`",
        ].join("\n"),
      },
      {
        id: "model-list",
        group: "models",
        title: "列出模型",
        description: "顯示目前可用模型與當前模型",
        command: "/model list",
        run: async () => {
          const latest = await UTILS.cachedSendToBackground?.("models", { type: "LIST_MODELS" });
          const models = Array.isArray(latest) ? latest : modelOptions.map((m) => m.id);

          if (Array.isArray(latest) && latest.length > 0) {
            CHAT.setAvailableModels?.(latest);
            PANELS.usage?.populateModelSelect?.(latest);
          }

          if (!Array.isArray(models) || models.length === 0) {
            return "目前查無可用模型。";
          }

          const ids = models.map((m) => (typeof m === "string" ? m : getModelId(m)));
          return [
            `**Models (${ids.length})**`,
            `Current: \`${CHAT.getState?.().currentModel || currentModel}\``,
            ...ids.slice(0, 20).map((id) => `- ${id}`),
            ...(ids.length > 20 ? [`- ... 還有 ${ids.length - 20} 個`] : []),
          ].join("\n");
        },
      },
      {
        id: "model-refresh",
        group: "models",
        title: "刷新模型",
        description: "重新從 CLI 讀取可用模型",
        command: "/model refresh",
        run: async () => {
          if (!CONN.isConnected?.()) return "目前未連線 Copilot CLI，請先連線後再刷新模型。";
          const latest = await UTILS.sendToBackground?.({ type: "LIST_MODELS" });
          if (!Array.isArray(latest) || latest.length === 0) return "CLI 未回傳任何模型。";
          CHAT.setAvailableModels?.(latest);
          PANELS.usage?.populateModelSelect?.(latest);
          PANELS.usage?.renderModelsCard?.();
          return `已刷新模型（${latest.length}）。`;
        },
      },
      {
        id: "mcp-status",
        group: "mcp",
        title: "MCP 狀態",
        description: "顯示 MCP server 設定數量與來源",
        command: "/mcp status",
        run: async () => {
          const res = await UTILS.sendToBackground?.({ type: "GET_MCP_CONFIG" });
          if (!res?.ok || !res.config) return `讀取 MCP 設定失敗：${res?.error || "unknown"}`;
          const servers = Object.keys(res.config.mcpServers || {});
          const source = res.source || "~/.copilot/mcp-config.json";
          return [
            "**MCP Status**",
            `Source: \`${source}\``,
            `Servers: ${servers.length}`,
            ...servers.slice(0, 10).map((name, index) => `${index + 1}. ${name}`),
            ...(servers.length > 10 ? [`... and ${servers.length - 10} more`] : []),
          ].join("\n");
        },
      },
      {
        id: "mcp-reload",
        group: "mcp",
        title: "重載 MCP",
        description: "重新載入 MCP 設定並切到 MCP 面板",
        command: "/mcp reload",
        run: async () => {
          switchPanel("mcp");
          await PANELS.mcp?.loadMcpConfig?.();
          return "已重新載入 MCP 設定。";
        },
      },
    ];

    const modelSwitchItems = modelOptions.slice(0, 20).map((model) => ({
      id: `model-use-${model.id}`,
      group: "models",
      title: `切換到 ${model.label}`,
      description: model.id === currentModel ? "目前使用中" : `切換模型為 ${model.id}`,
      command: `/model use ${model.id}`,
      run: async () => {
        await PANELS.usage?.switchModel?.(model.id);
        return `已切換模型：\`${model.id}\``;
      },
    }));

    return [...baseItems, ...modelSwitchItems];
  }

  function closeCommandMenu() {
    if (!_commandMenu) return;
    commandState.open = false;
    commandState.activeIndex = -1;
    commandState.items = [];
    _commandMenu.style.display = "none";
    _commandMenu.innerHTML = "";
  }

  function setActiveCommandItem(index) {
    if (!_commandMenu || commandState.items.length === 0) return;
    commandState.activeIndex = Math.max(0, Math.min(index, commandState.items.length - 1));
    _commandMenu.querySelectorAll(".command-menu-item").forEach((itemEl, idx) => {
      itemEl.classList.toggle("active", idx === commandState.activeIndex);
    });
  }

  function renderCommandMenu(filterText = "") {
    if (!_commandMenu) return;
    const query = String(filterText || "").trim().toLowerCase();
    const allItems = getCommandItems();
    const filtered = allItems.filter((item) => {
      if (!query) return true;
      return [item.command, item.title, item.description, item.group].join(" ").toLowerCase().includes(query);
    });

    commandState.items = filtered;
    commandState.activeIndex = filtered.length > 0 ? 0 : -1;

    if (filtered.length === 0) {
      _commandMenu.innerHTML = `<div class="command-menu-empty">${escapeHtml(localizeRuntimeMessage("沒有符合的命令"))}</div>`;
      return;
    }

    let html = "";
    let currentGroup = "";
    filtered.forEach((item, index) => {
      if (item.group !== currentGroup) {
        currentGroup = item.group;
        html += `<div class="command-menu-group">${escapeHtml(COMMAND_GROUP_LABEL[currentGroup] || currentGroup)}</div>`;
      }
      html += `
        <button class="command-menu-item${index === 0 ? " active" : ""}" data-index="${index}" role="option" aria-selected="${index === 0 ? "true" : "false"}">
          <span class="command-menu-main">
            <span class="command-menu-title">${escapeHtml(item.title)}</span>
            <span class="command-menu-desc">${escapeHtml(item.description || "")}</span>
          </span>
          <span class="command-menu-cmd">${escapeHtml(item.command)}</span>
        </button>
      `;
    });
    _commandMenu.innerHTML = html;
  }

  function openCommandMenu(filterText = "") {
    if (!_commandMenu) return;
    renderCommandMenu(filterText);
    commandState.open = true;
    _commandMenu.style.display = "block";
  }

  async function executeCommandItem(item, options = {}) {
    const { addEcho = true } = options;
    if (!item) return false;
    if (addEcho) CHAT.addUserMessage?.(item.command);
    try {
      const result = await item.run?.();
      CHAT.addBotMessage?.(result || localizeRuntimeMessage("命令已執行"));
    } catch (err) {
      CHAT.addBotMessage?.(`⚠ ${localizeRuntimeMessage("命令執行失敗")}: ${err.message}`);
    }
    PANELS.usage?.updateStats?.();
    return true;
  }

  async function handleSlashCommand(text) {
    const commandText = String(text || "").trim();
    if (!commandText.startsWith("/")) return false;

    const foundryMatch = commandText.match(/^\/(foundry_agent_skills?|foundryagentskills?|foundry_agent_skill|foundryagentskill)(?:\s+([\s\S]+))?$/i);
    if (foundryMatch) {
      const query = String(foundryMatch[2] || "").trim();
      CHAT.addUserMessage?.(commandText);

      if (!query) {
        CHAT.addBotMessage?.([
          "**Foundry Agent Skills**",
          "用法：`/foundry_agent_skills <query>`",
          "範例：`/foundry_agent_skills How do I fix projector screen flickering?`",
        ].join("\n"));
        PANELS.usage?.updateStats?.();
        return true;
      }

      if (!CONN.isConnected?.()) {
        CHAT.addBotMessage?.("目前未連線 Copilot CLI，請先連線後再使用 `/foundry_agent_skills`。");
        PANELS.usage?.updateStats?.();
        return true;
      }

      try {
        const response = await UTILS.sendToBackground?.({
          type: "EXECUTE_SKILL",
          skillName: "foundry_agent_skill",
          command: "invoke",
          payload: { message: query, source: "slash-command" },
        });

        if (response?.ok && response?.mode !== "mock") {
          const result = response.result || {};
          const textResult = result.response_text || result.output?.response_text || result.output?.message || result.summary;
          CHAT.addBotMessage?.(typeof textResult === "string" && textResult.trim()
            ? textResult
            : `\`\`\`json\n${escapeHtml(JSON.stringify(result.output || result, null, 2))}\n\`\`\``);
        } else {
          if (response?.mode === "mock") {
            UTILS.showToast?.("目前是 MVP mock skill，已改用一般查詢模式");
          }
          await CHAT.sendMessageStreaming?.(query, []);
        }
      } catch (err) {
        CHAT.addBotMessage?.(`⚠ ${localizeRuntimeMessage("命令執行失敗")}: ${err?.message || String(err)}`);
      }

      PANELS.usage?.updateStats?.();
      return true;
    }

    const item = getCommandItems().find((entry) => entry.command === commandText);
    if (!item) return false;
    await executeCommandItem(item, { addEcho: true });
    return true;
  }

  async function runActiveCommand(_sendMessageFn) {
    const item = commandState.items[commandState.activeIndex];
    closeCommandMenu();
    if (!item) return;

    // Fill command into input box for user to edit before sending
    const supportsArgs = /^\/(foundry_agent_skills?|foundryagentskills?|foundry_agent_skill|foundryagentskill|workiq)$/i.test(item.command);
    const commandText = supportsArgs ? `${item.command} ` : item.command;

    _chatInput.value = commandText;
    _chatInput.style.height = "auto";
    _chatInput.focus();

    // Move cursor to end of input
    const len = commandText.length;
    _chatInput.setSelectionRange?.(len, len);
  }

  function isOpen() {
    return commandState.open;
  }

  function getActiveIndex() {
    return commandState.activeIndex;
  }

  function bindEvents(sendMessageFn) {
    resolveDOM();

    _btnCommandMenu?.addEventListener("click", (e) => {
      e.preventDefault();
      if (commandState.open) {
        closeCommandMenu();
        return;
      }
      openCommandMenu("");
      _chatInput?.focus();
    });

    _commandMenu?.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest(".command-menu-item") : null;
      if (!target) return;
      const index = Number(target.getAttribute("data-index"));
      if (!Number.isFinite(index)) return;
      commandState.activeIndex = index;
      runActiveCommand(sendMessageFn);
    });

    document.addEventListener("click", (event) => {
      if (!commandState.open) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (_commandMenu?.contains(target) || _btnCommandMenu?.contains(target) || _chatInput?.contains(target)) return;
      closeCommandMenu();
    });
  }

  root.commandMenu = {
    getCommandItems,
    closeCommandMenu,
    setActiveCommandItem,
    openCommandMenu,
    handleSlashCommand,
    runActiveCommand,
    isOpen,
    getActiveIndex,
    bindEvents,
  };
})(window);
