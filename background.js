// ===== IQ Copilot Background Service Worker =====
// Acts as REST proxy bridge between sidebar and Copilot SDK Proxy (proxy.js)

importScripts("copilot-rpc.js");

// ── State ──
let cliPort = 8321;
let cliHost = "127.0.0.1";
let connectionState = "disconnected"; // disconnected | connecting | connected | error
let currentSessionId = null;

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
    // Connection
    case "CHECK_CONNECTION":
      return await checkAndUpdateConnection();

    case "SET_CLI_CONFIG": {
      cliHost = msg.host || "127.0.0.1";
      cliPort = msg.port || 8321;
      console.log(`[BG] SET_CLI_CONFIG → baseUrl=http://${cliHost}:${cliPort}`);
      COPILOT_RPC.setBaseUrl(`http://${cliHost}:${cliPort}`);
      chrome.storage.local.set({ cliHost, cliPort });
      return await checkAndUpdateConnection();
    }

    case "GET_CLI_CONFIG":
      return { host: cliHost, port: cliPort, state: connectionState };

    // Auth
    case "GET_AUTH_STATUS":
      return await COPILOT_RPC.getAuthStatus();

    case "PING":
      return await COPILOT_RPC.ping();

    // Session management
    case "CREATE_SESSION": {
      const session = await COPILOT_RPC.createSession(msg.config || {});
      currentSessionId = session.sessionId || session.id;
      return session;
    }

    case "RESUME_SESSION": {
      const resumed = await COPILOT_RPC.resumeSession(msg.sessionId);
      currentSessionId = msg.sessionId;
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
      return await COPILOT_RPC.proactiveScanAll();

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

    // ── Foundry Config (sensitive key via session storage) ──
    case "SET_FOUNDRY_CONFIG": {
      // Endpoint is non-sensitive → chrome.storage.local
      if (msg.endpoint) {
        chrome.storage.local.set({ foundryEndpoint: msg.endpoint });
      }
      // API key is sensitive → chrome.storage.session (memory-only)
      if (msg.apiKey) {
        chrome.storage.session.set({ foundryApiKey: msg.apiKey });
      }
      try {
        await COPILOT_RPC.setFoundryConfig(msg.endpoint || "", msg.apiKey || undefined);
      } catch {
        // Proxy may be disconnected; local/session storage is still updated.
      }
      return { ok: true };
    }

    case "GET_FOUNDRY_CONFIG": {
      const local = await new Promise((r) => chrome.storage.local.get("foundryEndpoint", r));
      const session = await new Promise((r) => chrome.storage.session.get("foundryApiKey", r));
      let proxyStatus = { configured: false, endpoint: local.foundryEndpoint || "" };
      try {
        const status = await COPILOT_RPC.getFoundryStatus();
        if (status?.ok) proxyStatus = status;
      } catch {
        // keep local fallback
      }
      return {
        endpoint: local.foundryEndpoint || proxyStatus.endpoint || "",
        hasApiKey: !!(session.foundryApiKey) || !!proxyStatus.configured,
      };
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
let _lastBroadcastState = "disconnected";

async function checkAndUpdateConnection() {
  console.log(`[BG] checkAndUpdateConnection — baseUrl=${COPILOT_RPC.getBaseUrl()}`);
  // Set connecting internally but do NOT broadcast the transitional state.
  // Broadcasting "connecting" caused sidebar to receive a spurious state change
  // that flickered the UI and could re-trigger listeners unnecessarily.
  connectionState = "connecting";

  const result = await COPILOT_RPC.checkConnection();
  console.log(`[BG] checkConnection result:`, result);
  connectionState = result.connected ? "connected" : "disconnected";
  broadcastState(); // gated — only fires if state actually changed

  return { ...result, state: connectionState };
}

/**
 * Phase 0.4: State-change gate.
 * Only sends CONNECTION_STATE_CHANGED when the connection state
 * actually differs from the last broadcast value.
 * This eliminates redundant broadcasts that were re-triggering
 * sidebar's onConnected() + full API call storm every ~60s.
 */
function broadcastState() {
  if (connectionState === _lastBroadcastState) {
    console.log(`[BG] broadcastState skipped — state unchanged (${connectionState})`);
    return;
  }
  const prev = _lastBroadcastState;
  _lastBroadcastState = connectionState;
  console.log(`[BG] broadcastState: ${prev} → ${connectionState}`);
  chrome.runtime.sendMessage({
    type: "CONNECTION_STATE_CHANGED",
    state: connectionState,
  }).catch(() => {
    // No listeners — sidebar may not be open
  });
}

// Periodic connection check — broadcastState() gate handles dedup
setInterval(async () => {
  if (connectionState !== "connecting") {
    const result = await COPILOT_RPC.checkConnection();
    connectionState = result.connected ? "connected" : "disconnected";
    broadcastState();
  }
}, 15000);

// ── Proactive Agent Scheduling ──
// Set up alarms for proactive scans
chrome.alarms.create("proactive-briefing", {
  // Fire at next 8:00 AM, then every 24 hours
  periodInMinutes: 24 * 60,
  delayInMinutes: minutesUntilHour(8),
});

chrome.alarms.create("proactive-deadlines", {
  // Every 12 hours
  periodInMinutes: 12 * 60,
  delayInMinutes: 1,
});

chrome.alarms.create("proactive-ghosts", {
  // Every 4 hours
  periodInMinutes: 4 * 60,
  delayInMinutes: 2,
});

chrome.alarms.create("proactive-meeting-prep", {
  // Every 30 minutes (checks if meeting is within 15 min)
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
