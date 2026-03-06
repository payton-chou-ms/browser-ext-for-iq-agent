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
  const CMD_MENU  = IQ.commandMenu || {};
  const localizeRuntimeMessage = I18N_MOD.localizeRuntimeMessage || ((m) => m);

  // ── DOM refs ──
  const navBtns      = document.querySelectorAll(".nav-btn[data-panel]");
  const panels       = document.querySelectorAll(".panel");
  const panelTitle   = document.getElementById("panel-title");
  const chatMessages = document.getElementById("chat-messages");
  const chatInput    = document.getElementById("chat-input");
  const btnSend      = document.getElementById("btn-send");
  const btnScreenshot = document.getElementById("btn-screenshot");
  const btnNewChat   = document.getElementById("btn-new-chat");
  const suggestions  = document.getElementById("chat-suggestions");

  const _escapeHtml = UTILS.escapeHtml || ((s) => s);

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

    // Build all messages off-DOM in a DocumentFragment (P3-13)
    const frag = document.createDocumentFragment();
    for (const msg of tab.chatHistory || []) {
      const msgEl = CHAT.createMessage?.(msg.role, msg.content);
      if (msgEl) frag.appendChild(msgEl);
    }

    // Single DOM mutation in rAF to avoid layout thrashing
    requestAnimationFrame(() => {
      chatMessages.innerHTML = "";
      chatMessages.appendChild(frag);

      // If tab is streaming, show the partial content
      const streamingContent = CHAT_TABS.getTabStreamingContent?.(tab.id);
      if (tab.status === "running" && streamingContent) {
        const streamBubble = CHAT.createStreamingBotMessage?.();
        if (streamBubble) {
          const renderSafe = UTILS.renderSafe || ((el, t) => { el.textContent = t; });
          renderSafe(streamBubble, streamingContent);
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
    });
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
  // debugLog in utils.js already writes to both console and DOM;
  // no wrapper needed here — unified in P2-16.
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
      CMD_MENU.closeCommandMenu?.();
      const handled = await CMD_MENU.handleSlashCommand?.(text);
      if (handled) return;
    }

    chatInput.value = "";
    chatInput.style.height = "auto";
    CMD_MENU.closeCommandMenu?.();

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
    if (CMD_MENU.isOpen?.()) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        CMD_MENU.setActiveCommandItem?.(CMD_MENU.getActiveIndex?.() + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        CMD_MENU.setActiveCommandItem?.(CMD_MENU.getActiveIndex?.() - 1);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        CMD_MENU.closeCommandMenu?.();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        CMD_MENU.runActiveCommand?.(sendMessage);
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
      CMD_MENU.openCommandMenu?.(value.slice(1));
    } else {
      CMD_MENU.closeCommandMenu?.();
    }
  });

  // ===== Quick Prompts Feature (delegated to lib/panels/quick-prompts.js) =====

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
    await PANELS.quickPrompts?.init?.();

    // Bind panel events
    FILE_UP.bindEvents?.();
    CMD_MENU.bindEvents?.(sendMessage);
    PANELS.quickPrompts?.bindEvents?.();
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
