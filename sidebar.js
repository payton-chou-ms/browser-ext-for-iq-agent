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
  const AGENTS    = IQ.agents || {};
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
  const btnNewChat   = document.getElementById("btn-new-chat");
  const suggestions  = document.getElementById("chat-suggestions");

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
      if (badge) {
        badge.textContent = res?.hasApiKey
          ? t("messages.foundryConfigured", "已設定")
          : t("messages.foundryNotConfigured", "未設定");
        badge.style.color = res?.hasApiKey ? "var(--success)" : "";
      }
    } catch (err) {
      UTILS.debugLog?.("ERR", "loadFoundryConfig error:", err.message);
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
        await CONN.onConnected?.();
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
    const apiKey   = document.getElementById("config-foundry-key")?.value?.trim();
    if (!endpoint) { UTILS.showToast?.(localizeRuntimeMessage("請輸入 Endpoint")); return; }
    try {
      await UTILS.sendToBackground?.({ type: "SET_FOUNDRY_CONFIG", endpoint, apiKey: apiKey || undefined });
      document.getElementById("config-foundry-key").value = "";
      UTILS.showToast?.(localizeRuntimeMessage("Foundry 設定已儲存"));
      loadFoundryConfig();
    } catch (err) {
      UTILS.showToast?.(localizeRuntimeMessage("儲存失敗: ") + err.message);
    }
  });

  document.getElementById("btn-test-foundry")?.addEventListener("click", async () => {
    UTILS.showToast?.(localizeRuntimeMessage("測試連線中..."));
    try {
      const res = await UTILS.sendToBackground?.({ type: "CHECK_CONNECTION" });
      UTILS.showToast?.(localizeRuntimeMessage(res?.connected ? "✅ Proxy 連線正常" : "⚠ Proxy 未連線"));
    } catch (err) {
      UTILS.showToast?.(localizeRuntimeMessage("連線失敗: ") + err.message);
    }
  });

  document.getElementById("btn-clear-foundry")?.addEventListener("click", async () => {
    try {
      await UTILS.sendToBackground?.({ type: "CLEAR_FOUNDRY_KEY" });
      UTILS.showToast?.(localizeRuntimeMessage("API Key 已清除"));
      loadFoundryConfig();
    } catch (err) {
      UTILS.showToast?.(localizeRuntimeMessage("清除失敗: ") + err.message);
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

  // Config upload dropzones
  document.querySelectorAll(".upload-dropzone").forEach((zone) => {
    zone.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.addEventListener("change", () => {
        if (input.files.length > 0) {
          const fileName = input.files[0].name;
          zone.querySelector("span").textContent = `✅ ${fileName}`;
          UTILS.showToast?.(localizeRuntimeMessage("設定已上傳（模擬）"));
          if (typeof AchievementEngine !== "undefined") AchievementEngine.track("config_updated");
        }
      });
      input.click();
    });
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

    chatInput.value = "";
    chatInput.style.height = "auto";

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
  });

  // ── New Chat ──
  btnNewChat?.addEventListener("click", async () => {
    if (chatMessages) chatMessages.innerHTML = "";
    CHAT.resetChatState?.();
    if (suggestions) suggestions.style.display = "flex";
    const chatState = CHAT.getState?.();
    if (chatState) chatState.stats.sessions++;
    PANELS.usage?.updateStats?.();
    CHAT.showWelcome?.();
  });

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
    await PANELS.skills?.loadCustomSkillsFromStorage?.();
    AGENTS.loadAgentConfig?.();
    loadCliConfig();
    CONN.checkConnection?.();
    PANELS.mcp?.initMcpPanel?.();
    AGENTS.renderAgentPanel?.();
    PANELS.proactive?.restoreProactiveState?.();
    PANELS.proactive?.loadProactiveConfig?.();
    PANELS.proactive?.renderTopPriority?.();
    PANELS.achievements?.initAchievements?.();

    // Bind panel events
    AGENTS.bindEvents?.();
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
