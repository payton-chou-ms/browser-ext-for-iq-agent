(function initIQConnection(global) {
  const root = global.IQ || (global.IQ = {});
  const CONFIG = root.state?.CONFIG || {};
  const utils = root.utils || {};
  const i18n = root.i18n || {};

  // ── State ──
  let connectionState = "disconnected";
  let _onConnectedRunning = false;
  let _hasInitialized = false;
  let _lastConnectionBroadcast = 0;
  let _lastRuntimeState = "disconnected";
  const CONNECTION_DEBOUNCE_MS = CONFIG.CONNECTION_DEBOUNCE_MS || 15000;
  const INIT_MARKER_KEY = CONFIG.CONNECTION_INIT_MARKER_KEY || "iq_connection_initialized";

  function getSessionValue(key) {
    return new Promise((resolve) => {
      if (!chrome?.storage?.session?.get) {
        resolve(undefined);
        return;
      }
      chrome.storage.session.get([key], (data) => resolve(data?.[key]));
    });
  }

  function setSessionValue(key, value) {
    return new Promise((resolve) => {
      if (!chrome?.storage?.session?.set) {
        resolve();
        return;
      }
      chrome.storage.session.set({ [key]: value }, () => resolve());
    });
  }

  function removeSessionValue(key) {
    return new Promise((resolve) => {
      if (!chrome?.storage?.session?.remove) {
        resolve();
        return;
      }
      chrome.storage.session.remove(key, () => resolve());
    });
  }

  function getConnectionState() {
    return connectionState;
  }

  function isConnected() {
    return connectionState === "connected";
  }

  function routeRuntimeMessage(msg, handlers) {
    if (!msg || !handlers) return false;

    if (msg.type === "CONNECTION_STATE_CHANGED" && typeof handlers.onConnectionStateChanged === "function") {
      handlers.onConnectionStateChanged(msg);
      return true;
    }

    if (msg.type === "PROACTIVE_UPDATE" && typeof handlers.onProactiveUpdate === "function") {
      handlers.onProactiveUpdate(msg);
      return true;
    }

    return false;
  }

  function updateConnectionUI(state) {
    connectionState = state;
    const statusEl = document.getElementById("connection-status");
    const textEl = document.getElementById("connection-text");
    const btnEl = document.getElementById("btn-connection-settings");
    const userEl = document.getElementById("connection-user");

    if (statusEl) {
      statusEl.className = "connection-status " + state;
    }

    const t = i18n.t || ((p, f) => f);
    const labels = {
      disconnected: t("connection.disconnected", "未連接 Copilot CLI"),
      connecting: t("connection.connecting", "正在連線..."),
      connected: t("connection.connected", "已連接 Copilot CLI"),
    };
    if (textEl) textEl.textContent = labels[state] || labels.disconnected;

    if (btnEl) btnEl.style.display = state === "connected" ? "none" : "";
    if (userEl) userEl.style.display = state === "connected" ? "flex" : "none";
  }

  // Expose updateConnectionUI via a bridge for theme.js
  root._updateConnectionUI = function () {
    updateConnectionUI(connectionState);
  };

  async function checkConnection() {
    const debugLog = utils.debugLog || console.log;
    const sendToBackground = utils.sendToBackground;
    debugLog("CONN", "checkConnection() called");
    try {
      const res = await sendToBackground({ type: "CHECK_CONNECTION" });
      debugLog("CONN", "CHECK_CONNECTION response:", res);
      if (res) {
        const state = res.state || (res.connected ? "connected" : "disconnected");
        debugLog("CONN", "State resolved to:", state);
        updateConnectionUI(state);
        if (state === "connected") {
          await onConnected();
        }
      } else {
        debugLog("ERR", "CHECK_CONNECTION returned falsy:", res);
      }
    } catch (err) {
      debugLog("ERR", "checkConnection error:", err.message);
      updateConnectionUI("disconnected");
    }
  }

  async function onConnected() {
    const debugLog = utils.debugLog || console.log;
    const cachedSendToBackground = utils.cachedSendToBackground;
    const setCache = utils.setCache;

    if (_onConnectedRunning) return;

    if (!_hasInitialized) {
      const marker = await getSessionValue(INIT_MARKER_KEY);
      if (
        marker
        && marker.state === "connected"
        && Number.isFinite(marker.at)
        && Date.now() - marker.at < CONNECTION_DEBOUNCE_MS
      ) {
        _hasInitialized = true;
      } else if (marker) {
        await removeSessionValue(INIT_MARKER_KEY);
      }
    }

    if (_hasInitialized) {
      debugLog("CONN", "onConnected() skipped — already initialized");
      return;
    }

    _onConnectedRunning = true;
    debugLog("CONN", "onConnected() — first-time init via aggregated API...");

    try {
      const ctxRes = await cachedSendToBackground("context", { type: "GET_CONTEXT" });
      debugLog("CTX", "Aggregated GET_CONTEXT response:", ctxRes);

      if (ctxRes && !ctxRes.error) {
        // Distribute aggregated data to all subsystems via registered handlers
        const handlers = _onConnectedHandlers;
        const results = await Promise.allSettled([
          (async () => {
            const models = ctxRes.models;
            if (Array.isArray(models) && models.length > 0) {
              setCache("models", models);
              if (handlers.onModels) handlers.onModels(models);
            }
          })(),
          (async () => {
            const sessions = ctxRes.sessions;
            if (Array.isArray(sessions)) {
              setCache("sessions", sessions);
              if (handlers.onSessions) handlers.onSessions(sessions);
            }
          })(),
          (async () => {
            const tools = ctxRes.tools;
            if (Array.isArray(tools)) {
              setCache("tools", tools);
              if (handlers.onTools) handlers.onTools(tools);
            }
          })(),
          (async () => {
            const quota = ctxRes.quota;
            if (quota && typeof quota === "object" && Object.keys(quota).length > 0) {
              setCache("quota", quota);
              if (handlers.onQuota) handlers.onQuota(quota);
            }
          })(),
          (async () => {
            if (handlers.onContext) handlers.onContext(ctxRes);
            if (typeof AchievementEngine !== "undefined") {
              AchievementEngine.track("context_viewed");
            }
          })(),
        ]);

        results.forEach((r, idx) => {
          if (r.status === "rejected") {
            const labels = ["models", "sessions", "tools", "quota", "context"];
            debugLog("ERR", `onConnected ${labels[idx]} render failed:`, r.reason?.message || r.reason);
          }
        });
      } else {
        debugLog("ERR", "GET_CONTEXT returned error, falling back to individual calls");
        await _onConnectedFallback();
      }
    } catch (err) {
      debugLog("ERR", "Aggregated GET_CONTEXT failed:", err.message, "— falling back");
      await _onConnectedFallback();
    }

    _hasInitialized = true;
    await setSessionValue(INIT_MARKER_KEY, { state: "connected", at: Date.now() });
    _onConnectedRunning = false;
    debugLog("CONN", "onConnected() — init complete, _hasInitialized = true");
  }

  async function _onConnectedFallback() {
    const debugLog = utils.debugLog || console.log;
    const cachedSendToBackground = utils.cachedSendToBackground;
    const handlers = _onConnectedHandlers;

    const results = await Promise.allSettled([
      (async () => {
        const modelsRes = await cachedSendToBackground("models", { type: "LIST_MODELS" });
        if (Array.isArray(modelsRes) && handlers.onModelsFallback) handlers.onModelsFallback(modelsRes);
      })(),
      handlers.loadHistorySessions ? handlers.loadHistorySessions() : Promise.resolve(),
      handlers.loadSkillsFromCli ? handlers.loadSkillsFromCli() : Promise.resolve(),
      handlers.loadQuotaFromCli ? handlers.loadQuotaFromCli() : Promise.resolve(),
      handlers.fetchCliContext ? handlers.fetchCliContext() : Promise.resolve(),
    ]);
    const labels = ["models", "sessions", "skills", "quota", "context"];
    results.forEach((r, idx) => {
      if (r.status === "rejected") debugLog("ERR", `_onConnectedFallback ${labels[idx]} error:`, r.reason?.message || r.reason);
    });
  }

  // Registry for panel handlers that onConnected distributes data to
  const _onConnectedHandlers = {};

  function registerOnConnectedHandlers(handlers) {
    Object.assign(_onConnectedHandlers, handlers);
  }

  function setupRuntimeListener(handleProactiveUpdate) {
    chrome.runtime.onMessage.addListener((msg) => {
      routeRuntimeMessage(msg, {
        onConnectionStateChanged: (connectionMsg) => {
          const prevState = _lastRuntimeState;
          _lastRuntimeState = connectionMsg.state;
          updateConnectionUI(connectionMsg.state);

          if (connectionMsg.state === "disconnected") {
            _hasInitialized = false;
            removeSessionValue(INIT_MARKER_KEY);
          }

          const now = Date.now();
          if (
            connectionMsg.state === "connected"
            && prevState !== "connected"
            && now - _lastConnectionBroadcast >= CONNECTION_DEBOUNCE_MS
          ) {
            _lastConnectionBroadcast = now;
            onConnected();
          }
        },
        onProactiveUpdate: (proactiveMsg) => {
          if (handleProactiveUpdate) handleProactiveUpdate(proactiveMsg);
        },
      });
    });
  }

  root.connection = {
    routeRuntimeMessage,
    getConnectionState,
    isConnected,
    updateConnectionUI,
    checkConnection,
    onConnected,
    registerOnConnectedHandlers,
    setupRuntimeListener,
  };
})(window);
