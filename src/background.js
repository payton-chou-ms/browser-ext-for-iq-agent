// ===== IQ Copilot Background Service Worker =====
// Acts as REST proxy bridge between sidebar and Copilot SDK Proxy (proxy.js)

importScripts("copilot-rpc.js");

// ── State ──
let cliPort = 8321;
let cliHost = "127.0.0.1";
let connectionState = "disconnected"; // disconnected | connecting | connected | error
let _lastBroadcastState = "disconnected"; // Track last broadcast to prevent spurious notifications
let _currentSessionId = null;
let _stateRestoreComplete = false; // Guard against race condition with async restore
const CONNECTION_ALARM_NAME = "connection-health-check";
const CONNECTION_CHECK_PERIOD_CONNECTED_MIN = 5;
const CONNECTION_CHECK_PERIOD_DISCONNECTED_MIN = 1;
const LAST_BROADCAST_STATE_KEY = "iq_lastBroadcastState";

// ── Session Storage for Sensitive Keys ──
// chrome.storage.session is memory-only — cleared when browser closes.
// Used for user-provided secrets (Foundry API key) that should NOT persist to disk.
chrome.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });

// ── Init ──
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  console.log("IQ Copilot v3.0.0 installed (SDK mode)");
  chrome.storage.local.get(["cliHost", "cliPort"], (data) => {
    if (data.cliHost) cliHost = data.cliHost;
    if (data.cliPort) cliPort = data.cliPort;
    COPILOT_RPC.setBaseUrl(`http://${cliHost}:${cliPort}`);
  });
});

// Load settings on startup
chrome.storage.local.get(["cliHost", "cliPort"], (data) => {
  if (data.cliHost) cliHost = data.cliHost;
  if (data.cliPort) cliPort = data.cliPort;
  COPILOT_RPC.setBaseUrl(`http://${cliHost}:${cliPort}`);
});

// Restore last broadcast state from session storage (survives service worker restart)
// CRITICAL: This must complete BEFORE any alarm/message handlers compare state
(async () => {
  try {
    const data = await chrome.storage.session.get([LAST_BROADCAST_STATE_KEY]);
    const restored = data?.[LAST_BROADCAST_STATE_KEY];
    if (restored && typeof restored === "string") {
      _lastBroadcastState = restored;
      connectionState = restored; // Keep in sync to prevent false transitions
      console.log(`[BG] Restored last broadcast state: ${restored}`);
    }
  } catch (err) {
    console.error(`[BG] Failed to restore state:`, err);
  } finally {
    _stateRestoreComplete = true;
    console.log(`[BG] State restore complete. _lastBroadcastState=${_lastBroadcastState}`);
  }
})();

// ── Message Router ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    sendResponse({ error: err.message });
  });
  return true; // async response
});

async function handleMessage(msg) {
  console.log(`[BG] handleMessage: ${msg.type}`, msg);
  switch (msg.type) {
    case "CAPTURE_VISIBLE_TAB":
      return await captureVisibleTabScreenshot();

    // Connection
    case "CHECK_CONNECTION":
      return await checkAndUpdateConnection(msg.source || "manual");

    case "SET_CLI_CONFIG": {
      cliHost = msg.host || "127.0.0.1";
      cliPort = msg.port || 8321;
      console.log(`[BG] SET_CLI_CONFIG → baseUrl=http://${cliHost}:${cliPort}`);
      COPILOT_RPC.setBaseUrl(`http://${cliHost}:${cliPort}`);
      chrome.storage.local.set({ cliHost, cliPort });
      return await checkAndUpdateConnection("manual");
    }

    case "GET_CLI_CONFIG":
      return { host: cliHost, port: cliPort, state: connectionState };

    case "DISCONNECT":
      console.log("[BG] DISCONNECT — clearing connection state");
      connectionState = "disconnected";
      _lastBroadcastState = "disconnected";
      broadcastState("manual");
      return { disconnected: true, state: connectionState };

    // Auth
    case "GET_AUTH_STATUS":
      return await COPILOT_RPC.getAuthStatus();

    case "PING":
      return await COPILOT_RPC.ping();

    // Session management
    case "CREATE_SESSION": {
      const session = await COPILOT_RPC.createSession(msg.config || {});
      _currentSessionId = session.sessionId || session.id;
      return session;
    }

    case "RESUME_SESSION": {
      const resumed = await COPILOT_RPC.resumeSession(msg.sessionId);
      _currentSessionId = msg.sessionId;
      return resumed;
    }

    case "LIST_SESSIONS":
      return await COPILOT_RPC.listSessions();

    case "DELETE_SESSION":
      return await COPILOT_RPC.deleteSession(msg.sessionId);

    // Chat (non-streaming)
    case "SEND_AND_WAIT":
      return await COPILOT_RPC.sendAndWait(msg.sessionId, msg.prompt, msg.attachments);

    // Models
    case "LIST_MODELS":
      return await COPILOT_RPC.listModels();

    // Switch model in session
    case "SWITCH_MODEL":
      return await COPILOT_RPC.switchModel(msg.sessionId, msg.modelId);

    // Tools (Skills)
    case "LIST_TOOLS":
      return await COPILOT_RPC.listTools(msg.model);

    case "LIST_LOCAL_SKILLS":
      return await COPILOT_RPC.listLocalSkills();

    case "EXECUTE_SKILL":
      return await COPILOT_RPC.executeSkill(msg.skillName, msg.command, msg.payload || {});

    // Quota
    case "GET_QUOTA":
      return await COPILOT_RPC.getQuota();

    // Context (aggregated CLI info)
    case "GET_CONTEXT":
      return await COPILOT_RPC.getContext();

    // MCP config from local filesystem
    case "GET_MCP_CONFIG":
      return await COPILOT_RPC.getMcpConfig();

    case "SET_MCP_CONFIG":
      return await COPILOT_RPC.setMcpConfig(msg.config);

    // Proactive Agent
    case "PROACTIVE_BRIEFING":
      return await COPILOT_RPC.proactiveBriefing();

    case "PROACTIVE_DEADLINES":
      return await COPILOT_RPC.proactiveDeadlines();

    case "PROACTIVE_GHOSTS":
      return await COPILOT_RPC.proactiveGhosts();

    case "PROACTIVE_MEETING_PREP":
      return await COPILOT_RPC.proactiveMeetingPrep();

    case "PROACTIVE_SCAN_ALL":
      return await COPILOT_RPC.proactiveScanAll(msg.source || "manual");

    case "GET_PROACTIVE_CONFIG": {
      const local = await new Promise((resolve) => chrome.storage.local.get(["proactiveWorkiqPrompt"], resolve));
      try {
        const remote = await COPILOT_RPC.getProactiveConfig();
        if (remote?.ok) {
          const prompt = typeof remote.config?.workiqPrompt === "string" ? remote.config.workiqPrompt : "";
          if (prompt !== (local.proactiveWorkiqPrompt || "")) {
            chrome.storage.local.set({ proactiveWorkiqPrompt: prompt });
          }
          return { ok: true, config: { workiqPrompt: prompt } };
        }
      } catch {
        // fallback to local storage
      }
      return { ok: true, config: { workiqPrompt: local.proactiveWorkiqPrompt || "" } };
    }

    case "SET_PROACTIVE_CONFIG": {
      const prompt = typeof msg.workiqPrompt === "string" ? msg.workiqPrompt : "";
      chrome.storage.local.set({ proactiveWorkiqPrompt: prompt });
      try {
        return await COPILOT_RPC.setProactiveConfig(prompt);
      } catch {
        return { ok: true, config: { workiqPrompt: prompt }, localOnly: true };
      }
    }

    // Tab info
    case "GET_TAB_INFO":
      return { url: msg.url, tabId: msg.tabId };

    // ── Microsoft Foundry Config (identity-based auth) ──
    case "SET_FOUNDRY_CONFIG": {
      // Endpoint and auth method → chrome.storage.local
      const authMethod = msg.authMethod || "identity";
      chrome.storage.local.set({ 
        foundryEndpoint: msg.endpoint || "",
        foundryAuthMethod: authMethod
      });
      // API key (only for legacy apikey mode) → chrome.storage.session (memory-only)
      if (authMethod === "apikey" && msg.apiKey) {
        chrome.storage.session.set({ foundryApiKey: msg.apiKey });
      } else {
        chrome.storage.session.remove("foundryApiKey");
      }
      try {
        await COPILOT_RPC.setFoundryConfig(msg.endpoint || "", authMethod, msg.apiKey || undefined);
      } catch {
        // Proxy may be disconnected; local/session storage is still updated.
      }
      return { ok: true };
    }

    case "GET_FOUNDRY_CONFIG": {
      const local = await new Promise((r) => chrome.storage.local.get(["foundryEndpoint", "foundryAuthMethod"], r));
      const session = await new Promise((r) => chrome.storage.session.get("foundryApiKey", r));
      let proxyStatus = { configured: false, endpoint: local.foundryEndpoint || "" };
      try {
        const status = await COPILOT_RPC.getFoundryStatus();
        if (status?.ok) proxyStatus = status;
      } catch {
        // keep local fallback
      }
      const authMethod = local.foundryAuthMethod || "identity";
      return {
        endpoint: local.foundryEndpoint || proxyStatus.endpoint || "",
        authMethod,
        hasApiKey: authMethod === "apikey" && (!!(session.foundryApiKey) || !!proxyStatus.configured),
      };
    }

    case "TEST_FOUNDRY_CONNECTION": {
      try {
        const result = await COPILOT_RPC.testFoundryConnection();
        return result;
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    case "CLEAR_FOUNDRY_KEY": {
      chrome.storage.session.remove("foundryApiKey");
      try {
        await COPILOT_RPC.clearFoundryKey();
      } catch {
        // Proxy may be disconnected; key is still cleared from session storage.
      }
      return { ok: true };
    }

    default:
      return { error: `Unknown message type: ${msg.type}` };
  }
}

function isRestrictedCaptureUrl(url) {
  if (typeof url !== "string" || !url) return false;
  return /^(chrome:|chrome-extension:|edge:|about:|devtools:|view-source:)/i.test(url);
}

async function captureVisibleTabScreenshot() {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const activeTab = tabs?.[0];

    if (!activeTab || typeof activeTab.windowId !== "number") {
      return { ok: false, error: "找不到目前瀏覽分頁" };
    }

    if (isRestrictedCaptureUrl(activeTab.url)) {
      return { ok: false, error: "此頁面不支援截圖（受瀏覽器保護）" };
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, { format: "png" });
    if (!dataUrl) {
      return { ok: false, error: "截圖失敗，未取得影像資料" };
    }

    return {
      ok: true,
      dataUrl,
      title: activeTab.title || "",
      url: activeTab.url || "",
      ts: Date.now(),
    };
  } catch (err) {
    return { ok: false, error: `截圖失敗: ${err?.message || "Unknown error"}` };
  }
}

// ── Streaming via long-lived port ──
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "copilot-stream") {
    port.onMessage.addListener(async (msg) => {
      if (msg.type === "STREAM_SEND") {
        try {
          const { stream, cancel } = COPILOT_RPC.sendMessage(msg.sessionId, msg.prompt, msg.attachments);

          port.onDisconnect.addListener(() => cancel());

          for await (const event of stream) {
            try {
              port.postMessage({ type: "STREAM_EVENT", data: event });
            } catch {
              cancel();
              break;
            }
          }
          port.postMessage({ type: "STREAM_DONE" });
        } catch (err) {
          try {
            port.postMessage({ type: "STREAM_ERROR", error: err.message });
          } catch {
            // port already disconnected
          }
        }
      }
    });
  }
});

// ── Connection management ──
// Phase 0.4: track last broadcast state so we only notify on actual changes
// (moved _lastBroadcastState declaration to top State section for persistence)

async function checkAndUpdateConnection(source = "manual") {
  console.log(`[BG] checkAndUpdateConnection — baseUrl=${COPILOT_RPC.getBaseUrl()}`);
  // Set connecting internally but do NOT broadcast the transitional state.
  // Broadcasting "connecting" caused sidebar to receive a spurious state change
  // that flickered the UI and could re-trigger listeners unnecessarily.
  connectionState = "connecting";

  const result = await COPILOT_RPC.checkConnection();
  console.log(`[BG] checkConnection result:`, result);
  connectionState = result.connected ? "connected" : "disconnected";
  scheduleConnectionHealthAlarm(connectionState);
  broadcastState(source); // gated — only fires if state actually changed

  return { ...result, state: connectionState, source };
}

/**
 * Phase 0.4: State-change gate.
 * Only sends CONNECTION_STATE_CHANGED when the connection state
 * actually differs from the last broadcast value.
 * This eliminates redundant broadcasts that were re-triggering
 * sidebar's onConnected() + full API call storm every ~60s.
 * 
 * CRITICAL: If state restore hasn't completed yet, we skip broadcasting
 * to prevent false positives from the default "disconnected" value.
 */
function broadcastState(source = "manual") {
  // Guard against race condition: don't broadcast until restore completes
  if (!_stateRestoreComplete) {
    console.log(`[BG] broadcastState deferred — state restore pending`);
    return;
  }
  if (connectionState === _lastBroadcastState) {
    console.log(`[BG] broadcastState skipped — state unchanged (${connectionState})`);
    return;
  }
  const prev = _lastBroadcastState;
  _lastBroadcastState = connectionState;
  // Persist to session storage so service worker restart doesn't cause false broadcasts
  chrome.storage.session.set({ [LAST_BROADCAST_STATE_KEY]: connectionState }).catch(() => {});
  console.log(`[BG] broadcastState: ${prev} → ${connectionState} (source=${source})`);
  chrome.runtime.sendMessage({
    type: "CONNECTION_STATE_CHANGED",
    state: connectionState,
    source,
  }).catch(() => {
    // No listeners — sidebar may not be open
  });
}

async function scheduleConnectionHealthAlarm(state = connectionState) {
  const periodInMinutes = state === "connected"
    ? CONNECTION_CHECK_PERIOD_CONNECTED_MIN
    : CONNECTION_CHECK_PERIOD_DISCONNECTED_MIN;

  const existing = await chrome.alarms.get(CONNECTION_ALARM_NAME);
  if (existing?.periodInMinutes === periodInMinutes) {
    return;
  }

  chrome.alarms.create(CONNECTION_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes,
  });

  console.log(`[BG] Connection polling alarm set: ${periodInMinutes} min (state=${state})`);
}

// ── Proactive Agent Scheduling ──
// Set up alarms for proactive scans (with duplicate-creation guard)
async function ensureAlarm(name, options) {
  const existing = await chrome.alarms.get(name);
  if (!existing) {
    chrome.alarms.create(name, options);
    console.log(`[BG] Alarm created: ${name}`);
  } else {
    console.log(`[BG] Alarm already exists: ${name}`);
  }
}

ensureAlarm("proactive-briefing", {
  periodInMinutes: 24 * 60,
  delayInMinutes: minutesUntilHour(8),
});

ensureAlarm("proactive-deadlines", {
  periodInMinutes: 12 * 60,
  delayInMinutes: 1,
});

ensureAlarm("proactive-ghosts", {
  periodInMinutes: 4 * 60,
  delayInMinutes: 2,
});

ensureAlarm("proactive-meeting-prep", {
  periodInMinutes: 30,
  delayInMinutes: 3,
});

function minutesUntilHour(targetHour) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(targetHour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(1, Math.round((target - now) / 60000));
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CONNECTION_ALARM_NAME) {
    // Wait for state restore to complete before processing
    if (!_stateRestoreComplete) {
      console.log(`[BG] Connection alarm deferred — state restore pending`);
      return;
    }
    if (connectionState === "connecting") return;
    try {
      const result = await COPILOT_RPC.checkConnection();
      connectionState = result.connected ? "connected" : "disconnected";
      scheduleConnectionHealthAlarm(connectionState);
      broadcastState("alarm");
    } catch (err) {
      console.error("[BG] Connection alarm check failed:", err?.message || err);
      connectionState = "disconnected";
      scheduleConnectionHealthAlarm(connectionState);
      broadcastState("alarm");
    }
    return;
  }

  if (connectionState !== "connected") return;
  console.log(`[BG] Alarm fired: ${alarm.name}`);

  let result = null;
  try {
    switch (alarm.name) {
      case "proactive-briefing":
        result = await COPILOT_RPC.proactiveBriefing();
        break;
      case "proactive-deadlines":
        result = await COPILOT_RPC.proactiveDeadlines();
        break;
      case "proactive-ghosts":
        result = await COPILOT_RPC.proactiveGhosts();
        break;
      case "proactive-meeting-prep":
        result = await COPILOT_RPC.proactiveMeetingPrep();
        break;
    }
  } catch (err) {
    console.error(`[BG] Proactive scan error (${alarm.name}):`, err.message);
    return;
  }

  if (result && result.ok) {
    // Broadcast to sidebar
    chrome.runtime.sendMessage({
      type: "PROACTIVE_UPDATE",
      agent: alarm.name.replace("proactive-", ""),
      data: result.data || result.results,
      scannedAt: new Date().toISOString(),
    }).catch(() => {});
  }
});

scheduleConnectionHealthAlarm(connectionState);
