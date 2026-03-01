// ===== IQ Copilot Sidebar v3.1.0 — Bootstrap =====
// Phase 2: Slim bootstrap that wires all lib/ modules together.
// All logic has been extracted to lib/*.js and lib/panels/*.js.

(function initSidebarBootstrap(global) {
  "use strict";

  const IQ = global.IQ || {};

  // ── Module aliases (with safe fallbacks) ──
  const CONFIG    = IQ.state?.CONFIG || {};
  const UTILS     = IQ.utils  || {};
  const CONN      = IQ.connection || {};
  const CHAT      = IQ.chat   || {};
  const CHAT_TABS = IQ.chatTabs || {};
  const I18N_MOD  = IQ.i18n   || {};
  const THEME_MOD = IQ.theme  || {};
  const FILE_UP   = IQ.fileUpload || {};
  const PANELS    = IQ.panels || {};
  const localizeRuntimeMessage = I18N_MOD.localizeRuntimeMessage || ((m) => m);

  // ── DOM refs ──
  const navBtns      = document.querySelectorAll(".nav-btn[data-panel]");
  const panels       = document.querySelectorAll(".panel");
  const panelTitle   = document.getElementById("panel-title");
  const chatMessages = document.getElementById("chat-messages");
  const chatInput    = document.getElementById("chat-input");
  const btnSend      = document.getElementById("btn-send");
  const btnScreenshot = document.getElementById("btn-screenshot");
  const btnCommandMenu = document.getElementById("btn-command-menu");
  const commandMenu  = document.getElementById("command-menu");
  const btnNewChat   = document.getElementById("btn-new-chat");
  const suggestions  = document.getElementById("chat-suggestions");

  const escapeHtml = UTILS.escapeHtml || ((s) => s);

  // ── Chat Tabs Management ──
  const chatTabsContainer = document.getElementById("chat-tabs");
  const btnAddTab = document.getElementById("btn-add-tab");
  const tabCounterEl = document.getElementById("chat-tab-counter");

  function renderChatTabs() {
    if (!chatTabsContainer || !CHAT_TABS.getAllTabs) return;

    const tabs = CHAT_TABS.getAllTabs();
    const activeTabId = CHAT_TABS.getActiveTab?.()?.id;

    chatTabsContainer.innerHTML = "";

    for (const tab of tabs) {
      const tabEl = document.createElement("div");
      tabEl.className = `chat-tab${tab.id === activeTabId ? " active" : ""}${tab.status === "running" ? " running" : ""}${tab.status === "error" ? " error" : ""}`;
      tabEl.dataset.tabId = tab.id;

      const titleSpan = document.createElement("span");
      titleSpan.className = "chat-tab-title";
      titleSpan.textContent = tab.title || "新對話";
      titleSpan.title = tab.title || "新對話";
      tabEl.appendChild(titleSpan);

      // Model badge (if model is set)
      if (tab.model) {
        const modelBadge = document.createElement("span");
        modelBadge.className = "chat-tab-model";
        // Show abbreviated model name (e.g., "gpt-4.1" -> "4.1", "claude-3.5-sonnet" -> "claude")
        const shortModel = tab.model.replace(/^(gpt-|claude-|o[0-9]+-)/i, "").slice(0, 8);
        modelBadge.textContent = shortModel;
        modelBadge.title = `Model: ${tab.model}`;
        tabEl.appendChild(modelBadge);
      }

      const closeBtn = document.createElement("button");
      closeBtn.className = "chat-tab-close";
      closeBtn.innerHTML = "\u2715";
      closeBtn.title = "關閉";
      closeBtn.dataset.tabId = tab.id;
      tabEl.appendChild(closeBtn);

      chatTabsContainer.appendChild(tabEl);
    }

    // Update counter
    if (tabCounterEl) {
      tabCounterEl.textContent = `${tabs.length}/${CHAT_TABS.MAX_TABS || 10}`;
    }

    // Update add button state
    if (btnAddTab) {
      btnAddTab.disabled = tabs.length >= (CHAT_TABS.MAX_TABS || 10);
    }
  }

  function renderChatForActiveTab() {
    const tab = CHAT_TABS.getActiveTab?.();
    if (!tab || !chatMessages) return;

    // Clear existing messages
    chatMessages.innerHTML = "";

    // Render chat history from active tab
    for (const msg of tab.chatHistory || []) {
      const msgEl = CHAT.createMessage?.(msg.role, msg.content);
      if (msgEl) chatMessages.appendChild(msgEl);
    }

    // If tab is streaming, show the partial content
    const streamingContent = CHAT_TABS.getTabStreamingContent?.(tab.id);
    if (tab.status === "running" && streamingContent) {
      const streamBubble = CHAT.createStreamingBotMessage?.();
      if (streamBubble) {
        const formatText = UTILS.formatText || ((s) => s);
        streamBubble.innerHTML = formatText(streamingContent);
      }
    } else if (tab.status === "running") {
      // Tab is running but no content yet - show typing indicator
      CHAT.showTyping?.();
    }

    // Sync session ID to CHAT module
    CHAT.setCurrentSessionId?.(tab.sessionId);

    // Sync model from tab (per-tab model support)
    if (tab.model) {
      CHAT.setCurrentModel?.(tab.model);
      const modelSel = document.getElementById("config-model");
      if (modelSel) modelSel.value = tab.model;
    }

    // Scroll to bottom
    UTILS.scrollToBottom?.();
  }

  function bindChatTabsEvents() {
    // Add tab button
    btnAddTab?.addEventListener("click", () => {
      const newTab = CHAT_TABS.createTab?.();
      if (newTab) {
        // Inherit current model to new tab
        const chatState = CHAT.getState?.();
        if (chatState?.currentModel) {
          CHAT_TABS.setTabModel?.(newTab.id, chatState.currentModel);
        }
        renderChatTabs();
        renderChatForActiveTab();
        CHAT.showWelcome?.();
      }
    });

    // Tab click delegation
    chatTabsContainer?.addEventListener("click", async (e) => {
      const closeBtn = e.target.closest(".chat-tab-close");
      if (closeBtn) {
        e.stopPropagation();
        const tabId = closeBtn.dataset.tabId;
        const tab = CHAT_TABS.getTab?.(tabId);

        // Confirm if running
        if (tab?.status === "running") {
          if (!confirm(localizeRuntimeMessage("對話進行中，確定關閉？"))) return;
        }

        // Close with session destruction
        await CHAT_TABS.closeTab?.(tabId, {
          force: true,
          destroySession: async (sessionId) => {
            await UTILS.sendToBackground?.({ type: "DELETE_SESSION", sessionId });
          },
        });

        renderChatTabs();
        renderChatForActiveTab();
        return;
      }

      const tabEl = e.target.closest(".chat-tab");
      if (tabEl) {
        const tabId = tabEl.dataset.tabId;
        if (CHAT_TABS.switchTab?.(tabId)) {
          renderChatTabs();
          renderChatForActiveTab();
        }
      }
    });

    // Listen to chat tabs events
    CHAT_TABS.onEvent?.((event, data) => {
      if (event === "error" && data?.message) {
        UTILS.showToast?.(data.message, "error");
      }
    });
  }

  async function initChatTabs() {
    await CHAT_TABS.init?.();
    renderChatTabs();
    renderChatForActiveTab();
    bindChatTabsEvents();
  }

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
    if (!commandMenu) return;
    commandState.open = false;
    commandState.activeIndex = -1;
    commandState.items = [];
    commandMenu.style.display = "none";
    commandMenu.innerHTML = "";
  }

  function setActiveCommandItem(index) {
    if (!commandMenu || commandState.items.length === 0) return;
    commandState.activeIndex = Math.max(0, Math.min(index, commandState.items.length - 1));
    commandMenu.querySelectorAll(".command-menu-item").forEach((itemEl, idx) => {
      itemEl.classList.toggle("active", idx === commandState.activeIndex);
    });
  }

  function renderCommandMenu(filterText = "") {
    if (!commandMenu) return;
    const query = String(filterText || "").trim().toLowerCase();
    const allItems = getCommandItems();
    const filtered = allItems.filter((item) => {
      if (!query) return true;
      return [item.command, item.title, item.description, item.group].join(" ").toLowerCase().includes(query);
    });

    commandState.items = filtered;
    commandState.activeIndex = filtered.length > 0 ? 0 : -1;

    if (filtered.length === 0) {
      commandMenu.innerHTML = `<div class="command-menu-empty">${escapeHtml(localizeRuntimeMessage("沒有符合的命令"))}</div>`;
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
    commandMenu.innerHTML = html;
  }

  function openCommandMenu(filterText = "") {
    if (!commandMenu) return;
    renderCommandMenu(filterText);
    commandState.open = true;
    commandMenu.style.display = "block";
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

  async function runActiveCommand() {
    const item = commandState.items[commandState.activeIndex];
    closeCommandMenu();
    if (!item) return;
    chatInput.value = "";
    chatInput.style.height = "auto";
    await executeCommandItem(item, { addEcho: true });
  }

  // ── Panel Navigation ──
  function switchPanel(id) {
    navBtns.forEach((b) => b.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    const btn   = document.querySelector(`.nav-btn[data-panel="${id}"]`);
    const panel = document.getElementById(`panel-${id}`);
    if (btn) btn.classList.add("active");
    if (panel) panel.classList.add("active");
    const titles = I18N_MOD.t?.("panelTitles", {}) || {};
    panelTitle.textContent = titles[id] || "IQ Copilot";

    // Track panel view for achievements
    if (typeof AchievementEngine !== "undefined" && AchievementEngine.getProfile) {
      AchievementEngine.track("panel_viewed", { panel: id });
    }
    if (id === "notifications") {
      const notificationsPanel = document.getElementById("panel-notifications");
      const notificationsScroll = document.querySelector("#panel-notifications .panel-scroll");
      if (notificationsPanel && notificationsScroll) {
        notificationsScroll.style.overflowY = "auto";
        notificationsScroll.style.overflowX = "hidden";
        notificationsScroll.style.maxHeight = `${notificationsPanel.clientHeight}px`;
      }
    }
    if (id === "achievements") PANELS.achievements?.renderAchievementPanel?.();
    if (id === "context")      PANELS.context?.fetchCliContext?.();
  }

  function bindNotificationsScrollFallback() {
    const notificationsScroll = document.querySelector("#panel-notifications .panel-scroll");
    if (!notificationsScroll) return;

    notificationsScroll.addEventListener("wheel", (event) => {
      const maxScrollTop = notificationsScroll.scrollHeight - notificationsScroll.clientHeight;
      if (maxScrollTop <= 0) return;

      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, notificationsScroll.scrollTop + event.deltaY));
      if (nextScrollTop !== notificationsScroll.scrollTop) {
        notificationsScroll.scrollTop = nextScrollTop;
        event.preventDefault();
      }
    }, { passive: false });
  }

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
  });

  // ── Bridge functions (modules call back into bootstrap) ──
  const root = global.IQ || (global.IQ = {});
  root._switchPanel = switchPanel;
  bindNotificationsScrollFallback();

  // ── Debug Log (DOM-bound) ──
  const debugLogEl = document.getElementById("debug-log");
  // Bind debugLog to DOM element
  if (debugLogEl && UTILS.debugLog) {
    // debugLog in utils already writes to console;
    // here we also append to the DOM element via a wrapper
    const origDebugLog = UTILS.debugLog;
    const escapeHtml = UTILS.escapeHtml || ((s) => s);
    UTILS.debugLog = function domDebugLog(tag, ...args) {
      origDebugLog(tag, ...args);
      const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
      const span = document.createElement("div");
      span.className = "debug-log-entry";
      span.innerHTML = `<span class="debug-ts">[${ts}]</span> <span class="debug-tag" data-tag="${tag}">[${tag}]</span> ${escapeHtml(msg)}`;
      debugLogEl.appendChild(span);
      UTILS.trimContainerChildren?.(debugLogEl, CONFIG.MAX_DEBUG_LOG_ENTRIES || 500);
      debugLogEl.scrollTop = debugLogEl.scrollHeight;
    };
  }
  document.getElementById("btn-clear-debug")?.addEventListener("click", () => {
    if (debugLogEl) debugLogEl.innerHTML = "";
  });
  UTILS.debugLog?.("INFO", "Sidebar loaded, debug log initialized");

  // ── Config Panel ──
  async function loadCliConfig() {
    UTILS.debugLog?.("CFG", "loadCliConfig() called");
    try {
      const res = await UTILS.sendToBackground?.({ type: "GET_CLI_CONFIG" });
      UTILS.debugLog?.("CFG", "GET_CLI_CONFIG response:", res);
      if (res) {
        const hostEl = document.getElementById("config-host");
        const portEl = document.getElementById("config-port");
        if (hostEl && res.host) hostEl.value = res.host;
        if (portEl && res.port) portEl.value = res.port;
        if (res.state) CONN.updateConnectionUI?.(res.state);
      }
    } catch (err) {
      UTILS.debugLog?.("ERR", "loadCliConfig error:", err.message);
    }
  }

  // Connect button
  document.getElementById("btn-connect")?.addEventListener("click", async () => {
    const host = document.getElementById("config-host")?.value?.trim() || "127.0.0.1";
    const port = parseInt(document.getElementById("config-port")?.value, 10) || CONFIG.DEFAULT_CLI_PORT || 19836;
    UTILS.debugLog?.("CFG", `Connect clicked → host=${host}, port=${port}`);
    CONN.updateConnectionUI?.("connecting");
    try {
      const res = await UTILS.sendToBackground?.({ type: "SET_CLI_CONFIG", host, port });
      UTILS.debugLog?.("CONN", "SET_CLI_CONFIG response:", res);
      if (res && (res.connected || res.state === "connected")) {
        CONN.updateConnectionUI?.("connected");
        UTILS.showToast?.(I18N_MOD.t?.("connection.connected", "已連接 Copilot CLI"));
        UTILS.debugLog?.("CONN", "Connected successfully!");
        await CONN.onConnected?.({ source: "manual" });
      } else {
        CONN.updateConnectionUI?.("disconnected");
        UTILS.debugLog?.("ERR", "Connection failed, response:", res);
        UTILS.showToast?.(localizeRuntimeMessage("連線失敗"));
      }
    } catch (err) {
      UTILS.debugLog?.("ERR", "Connect error:", err.message, err.stack);
      CONN.updateConnectionUI?.("disconnected");
      UTILS.showToast?.(localizeRuntimeMessage("連線失敗: ") + err.message);
    }
  });

  // Disconnect button
  document.getElementById("btn-disconnect")?.addEventListener("click", async () => {
    UTILS.debugLog?.("CFG", "Disconnect clicked");
    try {
      const res = await UTILS.sendToBackground?.({ type: "DISCONNECT" });
      UTILS.debugLog?.("CONN", "DISCONNECT response:", res);
      CONN.updateConnectionUI?.("disconnected");
      UTILS.showToast?.(I18N_MOD.t?.("connection.disconnected", "已斷開 Copilot CLI 連線"));
    } catch (err) {
      UTILS.debugLog?.("ERR", "Disconnect error:", err.message, err.stack);
      UTILS.showToast?.(localizeRuntimeMessage("斷開連線失敗: ") + err.message);
    }
  });

  // Model / Theme / Language selectors
  document.getElementById("config-model")?.addEventListener("change", async (e) => {
    const modelId = e.target.value;
    const state = CHAT.getState?.();
    if (!modelId || modelId === state?.currentModel) return;
    await PANELS.usage?.switchModel?.(modelId);
  });

  document.getElementById("config-theme")?.addEventListener("change", (e) => {
    THEME_MOD.applyTheme?.(e.target.value);
    UTILS.showToast?.(I18N_MOD.t?.("messages.themeChanged", "Theme switched"));
  });

  document.getElementById("config-language")?.addEventListener("change", (e) => {
    THEME_MOD.applyLanguage?.(e.target.value);
    UTILS.showToast?.(I18N_MOD.t?.("messages.languageChanged", "Language switched"));
  });

  // Extension reload shortcut
  document.getElementById("btn-reload-extension")?.addEventListener("click", () => {
    UTILS.showToast?.(localizeRuntimeMessage("正在重新載入擴充功能..."));
    setTimeout(() => chrome.runtime.reload(), 150);
  });

  // MCP Config upload handler
  const mcpDropzone = document.getElementById("mcp-dropzone");
  mcpDropzone?.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", async () => {
      if (input.files.length === 0) return;
      const file = input.files[0];
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed.mcpServers || typeof parsed.mcpServers !== "object") {
          UTILS.showToast?.(localizeRuntimeMessage("必須包含 mcpServers 物件"));
          return;
        }
        const res = await UTILS.sendToBackground?.({ type: "SET_MCP_CONFIG", config: parsed });
        if (res?.ok) {
          mcpDropzone.querySelector("span").textContent = `✅ ${file.name}`;
          UTILS.showToast?.(localizeRuntimeMessage("MCP 設定已儲存"));
          if (typeof AchievementEngine !== "undefined") AchievementEngine.track("config_updated");
        } else {
          UTILS.showToast?.(localizeRuntimeMessage("儲存失敗: ") + (res?.error || "Unknown"));
        }
      } catch (err) {
        UTILS.showToast?.(localizeRuntimeMessage("JSON 格式錯誤: ") + err.message);
      }
    });
    input.click();
  });

  // MCP Config sample download
  document.getElementById("btn-download-mcp-sample")?.addEventListener("click", () => {
    const sample = {
      mcpServers: {
        "playwright": {
          "command": "npx",
          "args": ["@anthropic/mcp-playwright"]
        },
        "context7": {
          "command": "npx",
          "args": ["-y", "@upstash/context7-mcp"]
        },
        "github": {
          "command": "docker",
          "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"]
        }
      }
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mcp-config-sample.json";
    a.click();
    URL.revokeObjectURL(url);
    UTILS.showToast?.(localizeRuntimeMessage("已下載範本檔案"));
  });

  // Connection settings button
  document.getElementById("btn-connection-settings")?.addEventListener("click", () => {
    switchPanel("config");
  });

  // ── sendMessage (captures input, delegates to chat module) ──
  async function sendMessage() {
    const text = chatInput.value.trim();
    const pending = FILE_UP.getPendingFiles?.() || [];
    if (!text && pending.length === 0) return;

    if (text.startsWith("/") && pending.length === 0) {
      chatInput.value = "";
      chatInput.style.height = "auto";
      closeCommandMenu();
      const handled = await handleSlashCommand(text);
      if (handled) return;
    }

    chatInput.value = "";
    chatInput.style.height = "auto";
    closeCommandMenu();

    // Easter egg achievement check
    if (typeof AchievementEngine !== "undefined" && text.toLowerCase() === "iq easter egg") {
      AchievementEngine.forceUnlock("hidden-004");
    }

    // Capture and clear pending files
    const attachedFiles = [...pending];
    FILE_UP.clearPendingFiles?.();

    // Track file uploads for achievements
    if (typeof AchievementEngine !== "undefined" && attachedFiles.length > 0) {
      for (const _f of attachedFiles) {
        AchievementEngine.track("file_uploaded");
      }
    }

    // Show user message with file badges
    FILE_UP.addUserMessageWithFiles?.(text, attachedFiles);

    if (CONN.isConnected?.()) {
      await CHAT.sendMessageStreaming?.(text, attachedFiles);
    } else {
      CHAT.showTyping?.();
      const response = await CHAT.simulateResponse?.(text);
      CHAT.removeTyping?.();
      CHAT.addBotMessage?.(response);
      const chatState = CHAT.getState?.();
      if (chatState) {
        chatState.stats.tokens += text.length + (response?.length || 0);
      }
      PANELS.usage?.updateStats?.();
    }
  }

  function dataUrlToFile(dataUrl, fileName) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      throw new Error("Invalid screenshot payload");
    }

    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex < 0) {
      throw new Error("Invalid screenshot payload");
    }

    const header = dataUrl.slice(0, commaIndex);
    const base64 = dataUrl.slice(commaIndex + 1);
    const mimeMatch = header.match(/^data:([^;]+);base64$/i);
    const mimeType = mimeMatch?.[1] || "image/png";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], fileName, { type: mimeType });
  }

  function buildScreenshotName() {
    const now = new Date();
    const pad = (v) => String(v).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `screenshot-${stamp}.png`;
  }

  async function captureCurrentPageScreenshot() {
    try {
      const res = await UTILS.sendToBackground?.({ type: "CAPTURE_VISIBLE_TAB" });
      if (!res || res.ok !== true || !res.dataUrl) {
        const reason = localizeRuntimeMessage(res?.error || "截圖失敗");
        UTILS.showToast?.(reason, "error");
        return;
      }

      const screenshotFile = dataUrlToFile(res.dataUrl, buildScreenshotName());
      await FILE_UP.addFiles?.([screenshotFile]);
      UTILS.showToast?.(localizeRuntimeMessage("已加入目前頁面截圖"), "success");
    } catch (err) {
      UTILS.showToast?.(localizeRuntimeMessage("截圖失敗: ") + (err?.message || "Unknown error"), "error");
    }
  }

  // Expose sendMessage bridge for panels (proactive, etc.)
  root._sendMessage = sendMessage;

  // ── Chat Event Listeners ──
  btnScreenshot?.addEventListener("click", captureCurrentPageScreenshot);
  btnSend?.addEventListener("click", sendMessage);
  let isChatInputComposing = false;
  chatInput?.addEventListener("compositionstart", () => { isChatInputComposing = true; });
  chatInput?.addEventListener("compositionend",   () => { isChatInputComposing = false; });
  chatInput?.addEventListener("keydown", (e) => {
    if (commandState.open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveCommandItem(commandState.activeIndex + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveCommandItem(commandState.activeIndex - 1);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeCommandMenu();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        runActiveCommand();
        return;
      }
    }

    const isComposing = isChatInputComposing || e.isComposing || e.keyCode === 229;
    if (isComposing) return;
    const isEnter = e.key === "Enter";
    const isSendShortcut = isEnter && (e.ctrlKey || e.metaKey);
    const isPlainEnter   = isEnter && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (isSendShortcut || isPlainEnter) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatInput?.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
    const value = String(chatInput.value || "");
    if (value.startsWith("/")) {
      openCommandMenu(value.slice(1));
    } else {
      closeCommandMenu();
    }
  });

  btnCommandMenu?.addEventListener("click", (e) => {
    e.preventDefault();
    if (commandState.open) {
      closeCommandMenu();
      return;
    }
    openCommandMenu("");
    chatInput?.focus();
  });

  commandMenu?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest(".command-menu-item") : null;
    if (!target) return;
    const index = Number(target.getAttribute("data-index"));
    if (!Number.isFinite(index)) return;
    commandState.activeIndex = index;
    runActiveCommand();
  });

  document.addEventListener("click", (event) => {
    if (!commandState.open) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (commandMenu?.contains(target) || btnCommandMenu?.contains(target) || chatInput?.contains(target)) return;
    closeCommandMenu();
  });

  // ===== Quick Prompts Feature =====
  const QUICK_PROMPTS_STORAGE_KEY = "iq_quick_prompts";
  const btnQuickPrompts = document.getElementById("btn-quick-prompts");
  const quickPromptsPopup = document.getElementById("quick-prompts-popup");
  const quickPromptsList = document.getElementById("quick-prompts-list");
  const quickPromptsEmpty = document.getElementById("quick-prompts-empty");
  const btnAddPrompt = document.getElementById("btn-add-prompt");
  let quickPromptsOpen = false;
  let quickPrompts = [];

  // Debug: verify elements found
  console.log("[QuickPrompts] Init:", { 
    btnQuickPrompts: !!btnQuickPrompts, 
    quickPromptsPopup: !!quickPromptsPopup,
    quickPromptsList: !!quickPromptsList,
    btnAddPrompt: !!btnAddPrompt
  });

  // Load quick prompts from storage
  async function loadQuickPrompts() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const data = await chrome.storage.local.get(QUICK_PROMPTS_STORAGE_KEY);
        quickPrompts = data[QUICK_PROMPTS_STORAGE_KEY] || [];
      } else {
        const raw = localStorage.getItem(QUICK_PROMPTS_STORAGE_KEY);
        quickPrompts = raw ? JSON.parse(raw) : [];
      }
    } catch (e) {
      console.error("[QuickPrompts] loadQuickPrompts error:", e);
      quickPrompts = [];
    }
  }

  // Save quick prompts to storage
  async function saveQuickPrompts() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [QUICK_PROMPTS_STORAGE_KEY]: quickPrompts });
      } else {
        localStorage.setItem(QUICK_PROMPTS_STORAGE_KEY, JSON.stringify(quickPrompts));
      }
    } catch (e) {
      console.error("[QuickPrompts] saveQuickPrompts error:", e);
    }
  }

  // Render quick prompts list
  function renderQuickPrompts() {
    if (!quickPromptsList || !quickPromptsEmpty) return;

    if (quickPrompts.length === 0) {
      quickPromptsList.style.display = "none";
      quickPromptsEmpty.style.display = "flex";
      return;
    }

    quickPromptsEmpty.style.display = "none";
    quickPromptsList.style.display = "block";

    quickPromptsList.innerHTML = quickPrompts.map((p, index) => `
      <div class="quick-prompt-item" data-index="${index}">
        <span class="prompt-icon">${escapeHtml(p.icon || "📝")}</span>
        <div class="prompt-content">
          <div class="prompt-title">${escapeHtml(p.title)}</div>
          <div class="prompt-preview">${escapeHtml(p.prompt.slice(0, 50))}${p.prompt.length > 50 ? "..." : ""}</div>
        </div>
        <button class="prompt-delete" data-index="${index}" title="刪除">✕</button>
      </div>
    `).join("");
  }

  // Open quick prompts popup
  function openQuickPromptsPopup() {
    if (!quickPromptsPopup || !btnQuickPrompts) return;
    renderQuickPrompts();

    // Position popup above the button
    const btnRect = btnQuickPrompts.getBoundingClientRect();
    quickPromptsPopup.style.left = `${btnRect.left}px`;
    quickPromptsPopup.style.bottom = `${window.innerHeight - btnRect.top + 8}px`;

    quickPromptsPopup.style.display = "flex";
    quickPromptsOpen = true;
  }

  // Close quick prompts popup
  function closeQuickPromptsPopup() {
    if (!quickPromptsPopup) return;
    quickPromptsPopup.style.display = "none";
    quickPromptsOpen = false;
  }

  // Toggle quick prompts popup
  btnQuickPrompts?.addEventListener("click", (e) => {
    console.log("[QuickPrompts] Button clicked, quickPromptsOpen:", quickPromptsOpen);
    e.preventDefault();
    e.stopPropagation();
    if (quickPromptsOpen) {
      closeQuickPromptsPopup();
    } else {
      openQuickPromptsPopup();
    }
  });

  // Handle quick prompt item click
  quickPromptsList?.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".prompt-delete");
    if (deleteBtn) {
      e.stopPropagation();
      const index = parseInt(deleteBtn.dataset.index, 10);
      if (!isNaN(index) && index >= 0 && index < quickPrompts.length) {
        quickPrompts.splice(index, 1);
        saveQuickPrompts();
        renderQuickPrompts();
        UTILS.showToast?.(localizeRuntimeMessage("提示已刪除"));
      }
      return;
    }

    const item = e.target.closest(".quick-prompt-item");
    if (item) {
      const index = parseInt(item.dataset.index, 10);
      if (!isNaN(index) && index >= 0 && index < quickPrompts.length) {
        const prompt = quickPrompts[index];
        if (chatInput) {
          chatInput.value = prompt.prompt;
          chatInput.focus();
          // Adjust textarea height
          chatInput.style.height = "auto";
          chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
        }
        closeQuickPromptsPopup();
      }
    }
  });

  // Show add prompt modal
  function showAddPromptModal() {
    const modal = document.createElement("div");
    modal.className = "quick-prompt-modal";
    modal.innerHTML = `
      <div class="quick-prompt-modal-content">
        <h3>⭐ 新增常用提示</h3>
        <input type="text" id="prompt-title-input" placeholder="標題 (例如：翻譯成中文)" maxlength="50">
        <textarea id="prompt-content-input" placeholder="提示內容 (例如：請將以下內容翻譯成繁體中文...)"></textarea>
        <div class="quick-prompt-modal-actions">
          <button class="btn-cancel">取消</button>
          <button class="btn-save">儲存</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const titleInput = modal.querySelector("#prompt-title-input");
    const contentInput = modal.querySelector("#prompt-content-input");
    const cancelBtn = modal.querySelector(".btn-cancel");
    const saveBtn = modal.querySelector(".btn-save");

    // If there's text in chat input, use it as default content
    if (chatInput?.value?.trim()) {
      contentInput.value = chatInput.value.trim();
    }

    titleInput?.focus();

    cancelBtn?.addEventListener("click", () => {
      modal.remove();
    });

    saveBtn?.addEventListener("click", () => {
      const title = titleInput?.value?.trim();
      const prompt = contentInput?.value?.trim();

      if (!title) {
        UTILS.showToast?.(localizeRuntimeMessage("請輸入標題"), "error");
        titleInput?.focus();
        return;
      }
      if (!prompt) {
        UTILS.showToast?.(localizeRuntimeMessage("請輸入提示內容"), "error");
        contentInput?.focus();
        return;
      }

      quickPrompts.push({
        id: `qp-${Date.now()}`,
        title,
        prompt,
        icon: "📝",
        createdAt: new Date().toISOString(),
      });

      saveQuickPrompts();
      renderQuickPrompts();
      modal.remove();
      UTILS.showToast?.(localizeRuntimeMessage("提示已儲存"));
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Close on Escape
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }

  btnAddPrompt?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showAddPromptModal();
  });

  // Close popup when clicking outside
  document.addEventListener("click", (event) => {
    if (!quickPromptsOpen) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (quickPromptsPopup?.contains(target) || btnQuickPrompts?.contains(target)) return;
    closeQuickPromptsPopup();
  });

  // Initialize quick prompts
  loadQuickPrompts();

  function startNewChat() {
    switchPanel("chat");
    if (chatMessages) chatMessages.innerHTML = "";
    CHAT.setCurrentSessionId?.(null);
    CHAT.setSessionData?.(null);
    CHAT.resetChatState?.();
    if (suggestions) suggestions.style.display = "flex";
    const chatState = CHAT.getState?.();
    if (chatState) chatState.stats.sessions++;
    PANELS.usage?.updateStats?.();
    CHAT.showWelcome?.();
  }

  // ── New Chat ──
  btnNewChat?.addEventListener("click", startNewChat);

  // ── Suggestion Chips ──
  document.querySelectorAll(".suggestion-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chatInput.value = chip.textContent.replace(/^[^\s]+\s/, "");
      sendMessage();
    });
  });

  // ── Runtime Message Listener ──
  CONN.setupRuntimeListener?.((msg) => {
    PANELS.proactive?.handleProactiveUpdate?.(msg);
  });

  // ── Register connection handlers (called after onConnected aggregated API) ──
  CONN.registerOnConnectedHandlers?.({
    // Aggregated data handlers
    onModels: (models) => {
      CHAT.setAvailableModels?.(models);
      PANELS.usage?.populateModelSelect?.(models);
      PANELS.usage?.renderModelsCard?.();
    },
    onSessions: (sessions) => {
      PANELS.history?.renderHistoryFromData?.(sessions);
    },
    onTools: (_tools) => {
      // Skills panel removed; tools are shown in Context panel.
    },
    onQuota: (_quota) => {
      // quota data is cached by connection; usage panel reads from cache
    },
    onContext: (ctx) => {
      PANELS.context?.renderCliContext?.(ctx);
      if (typeof AchievementEngine !== "undefined") AchievementEngine.track("context_viewed");
    },
    // Fallback individual loaders
    onModelsFallback: (models) => {
      CHAT.setAvailableModels?.(models);
      PANELS.usage?.populateModelSelect?.(models);
    },
    loadHistorySessions: () => PANELS.history?.loadHistorySessions?.(),
    loadSkillsFromCli: () => {},
    loadQuotaFromCli: () => PANELS.usage?.loadQuotaFromCli?.(),
    fetchCliContext: () => PANELS.context?.fetchCliContext?.(),
  });

  // ── Init ──
  async function init() {
    await THEME_MOD.loadUiPreferences?.();
    await initChatTabs();  // Initialize chat tabs first
    if (!CHAT_TABS.getActiveTab?.()?.chatHistory?.length) {
      CHAT.showWelcome?.();  // Show welcome only if no history
    }
    PANELS.usage?.updateStats?.();
    loadCliConfig();
    CONN.checkConnection?.("cold-start");
    PANELS.mcp?.initMcpPanel?.();
    PANELS.proactive?.restoreProactiveState?.();
    PANELS.proactive?.loadProactiveConfig?.();
    PANELS.proactive?.renderTopPriority?.();
    PANELS.achievements?.initAchievements?.();

    // Bind panel events
    FILE_UP.bindEvents?.();
    PANELS.context?.bindEvents?.();
    PANELS.history?.bindEvents?.();
    PANELS.proactive?.bindEvents?.();
    PANELS.achievements?.bindEvents?.();

    // Load persisted model (falls back to CONFIG default)
    chrome.storage.local.get("selectedModel", (data) => {
      if (data.selectedModel) CHAT.setCurrentModel?.(data.selectedModel);
      else CHAT.setCurrentModel?.(CONFIG.DEFAULT_MODEL || "gpt-4.1");
    });
  }

  init();
})(window);
