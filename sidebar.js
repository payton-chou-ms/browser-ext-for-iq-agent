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
  const btnCommandMenu = document.getElementById("btn-command-menu");
  const commandMenu  = document.getElementById("command-menu");
  const btnNewChat   = document.getElementById("btn-new-chat");
  const suggestions  = document.getElementById("chat-suggestions");

  const escapeHtml = UTILS.escapeHtml || ((s) => s);
  const commandState = {
    open: false,
    activeIndex: -1,
    items: [],
  };

  const COMMAND_GROUP_LABEL = {
    general: "General",
    skills: "Skills",
    mcp: "MCP",
  };

  function getCommandItems() {
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
          "- `/skills list` 讀取技能",
          "- `/skills refresh` 刷新技能",
          "- `/mcp status` 檢視 MCP 狀態",
          "- `/mcp reload` 重新載入 MCP 設定",
        ].join("\n"),
      },
      {
        id: "skills-list",
        group: "skills",
        title: "列出技能",
        description: "從 CLI 讀取目前技能清單",
        command: "/skills list",
        run: async () => {
          if (!CONN.isConnected?.()) return "目前未連線 Copilot CLI，請先連線後再查詢 skills。";
          const currentModel = CHAT.getState?.().currentModel;
          const tools = await UTILS.cachedSendToBackground?.("tools", { type: "LIST_TOOLS", model: currentModel });
          if (!Array.isArray(tools) || tools.length === 0) return "CLI 未回傳任何技能。";
          return [
            `**Skills (${tools.length})**`,
            ...tools.slice(0, 20).map((tool) => `- ${tool.name || "unknown"}`),
            ...(tools.length > 20 ? [`- ... 還有 ${tools.length - 20} 個`] : []),
          ].join("\n");
        },
      },
      {
        id: "skills-refresh",
        group: "skills",
        title: "刷新技能",
        description: "重新載入 skills 面板資料",
        command: "/skills refresh",
        run: async () => {
          switchPanel("skills");
          await PANELS.skills?.loadSkillsFromCli?.();
          return "已刷新 Skills。";
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
          return [
            "**MCP Status**",
            `- Source: ${res.source || "~/.copilot/mcp-config.json"}`,
            `- Servers: ${servers.length}`,
            ...servers.slice(0, 10).map((name) => `- ${name}`),
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

    return baseItems;
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
    if (id === "achievements") PANELS.achievements?.renderAchievementPanel?.();
    if (id === "context")      PANELS.context?.fetchCliContext?.();
  }

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
  });

  // ── Bridge functions (modules call back into bootstrap) ──
  const root = global.IQ || (global.IQ = {});
  root._switchPanel = switchPanel;

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

  async function loadFoundryConfig() {
    try {
      const res = await UTILS.sendToBackground?.({ type: "GET_FOUNDRY_CONFIG" });
      const endpointEl = document.getElementById("config-foundry-endpoint");
      const badge = document.getElementById("foundry-status-badge");
      const t = I18N_MOD.t || ((k, d) => d);
      if (endpointEl && res?.endpoint) endpointEl.value = res.endpoint;
      
      // Set auth method radio based on stored config
      const authMethod = res?.authMethod || "identity";
      const identityRadio = document.querySelector('input[name="foundry-auth-method"][value="identity"]');
      const apikeyRadio = document.querySelector('input[name="foundry-auth-method"][value="apikey"]');
      if (identityRadio) identityRadio.checked = authMethod === "identity";
      if (apikeyRadio) apikeyRadio.checked = authMethod === "apikey";
      toggleFoundryAuthUI(authMethod);
      
      if (badge) {
        const isConfigured = res?.endpoint && (authMethod === "identity" || res?.hasApiKey);
        badge.textContent = isConfigured
          ? t("messages.foundryConfigured", "已設定")
          : t("messages.foundryNotConfigured", "未設定");
        badge.style.color = isConfigured ? "var(--success)" : "";
      }
    } catch (err) {
      UTILS.debugLog?.("ERR", "loadFoundryConfig error:", err.message);
    }
  }

  // Toggle Foundry auth UI based on selected method
  function toggleFoundryAuthUI(method) {
    const apikeyGroup = document.getElementById("foundry-apikey-group");
    const identityInfo = document.getElementById("foundry-identity-info");
    if (apikeyGroup) apikeyGroup.style.display = method === "apikey" ? "block" : "none";
    if (identityInfo) identityInfo.style.display = method === "identity" ? "block" : "none";
  }

  // Auth method radio change handler
  document.querySelectorAll('input[name="foundry-auth-method"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      toggleFoundryAuthUI(e.target.value);
    });
  });

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

  // Foundry config buttons
  document.getElementById("btn-save-foundry")?.addEventListener("click", async () => {
    const endpoint = document.getElementById("config-foundry-endpoint")?.value?.trim();
    const authMethod = document.querySelector('input[name="foundry-auth-method"]:checked')?.value || "identity";
    const apiKey = authMethod === "apikey" ? document.getElementById("config-foundry-key")?.value?.trim() : undefined;
    
    if (!endpoint) { UTILS.showToast?.(localizeRuntimeMessage("請輸入 Endpoint")); return; }
    try {
      await UTILS.sendToBackground?.({ type: "SET_FOUNDRY_CONFIG", endpoint, authMethod, apiKey });
      if (authMethod === "apikey") document.getElementById("config-foundry-key").value = "";
      UTILS.showToast?.(localizeRuntimeMessage("Microsoft Foundry 設定已儲存"));
      loadFoundryConfig();
    } catch (err) {
      UTILS.showToast?.(localizeRuntimeMessage("儲存失敗: ") + err.message);
    }
  });

  document.getElementById("btn-test-foundry")?.addEventListener("click", async () => {
    UTILS.showToast?.(localizeRuntimeMessage("測試連線中..."));
    try {
      const res = await UTILS.sendToBackground?.({ type: "TEST_FOUNDRY_CONNECTION" });
      if (res?.ok) {
        UTILS.showToast?.(localizeRuntimeMessage("✅ Foundry 連線成功"));
      } else {
        UTILS.showToast?.(localizeRuntimeMessage("⚠ 連線失敗: ") + (res?.error || "Unknown"));
      }
    } catch (err) {
      UTILS.showToast?.(localizeRuntimeMessage("連線失敗: ") + err.message);
    }
  });

  // System message persistence
  const sysMsg = document.getElementById("config-system-message");
  if (sysMsg) {
    chrome.storage.local.get("systemMessage", (data) => {
      if (data.systemMessage) sysMsg.value = data.systemMessage;
    });
    sysMsg.addEventListener("input", () => {
      chrome.storage.local.set({ systemMessage: sysMsg.value });
    });
  }

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

  // Expose sendMessage bridge for panels (proactive, etc.)
  root._sendMessage = sendMessage;

  // ── Chat Event Listeners ──
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
    onTools: (tools) => {
      PANELS.skills?.renderSkillsFromData?.(tools);
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
    loadSkillsFromCli: () => PANELS.skills?.loadSkillsFromCli?.(),
    loadQuotaFromCli: () => PANELS.usage?.loadQuotaFromCli?.(),
    fetchCliContext: () => PANELS.context?.fetchCliContext?.(),
  });

  // ── Init ──
  async function init() {
    await THEME_MOD.loadUiPreferences?.();
    loadFoundryConfig();
    CHAT.showWelcome?.();
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
    PANELS.tasks?.bindEvents?.();
    PANELS.skills?.bindEvents?.();
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
