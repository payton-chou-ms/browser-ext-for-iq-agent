// ===== IQ Copilot Background Service Worker =====
// Acts as RPC proxy between sidebar and Copilot CLI server

importScripts("copilot-rpc.js");

// ── State ──
let cliPort = 8321;
let cliHost = "127.0.0.1";
let connectionState = "disconnected"; // disconnected | connecting | connected | error
let currentSessionId = null;

// ── Init ──
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  console.log("IQ Copilot v3.0.0 installed");
  // Load saved settings
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
  switch (msg.type) {
    // Connection
    case "CHECK_CONNECTION":
      return await checkAndUpdateConnection();

    case "SET_CLI_CONFIG":
      cliHost = msg.host || "localhost";
      cliPort = msg.port || 4321;
      COPILOT_RPC.setBaseUrl(`http://${cliHost}:${cliPort}`);
      chrome.storage.local.set({ cliHost, cliPort });
      return await checkAndUpdateConnection();

    case "GET_CLI_CONFIG":
      return { host: cliHost, port: cliPort, state: connectionState };

    // Auth
    case "GET_AUTH_STATUS":
      return await COPILOT_RPC.getAuthStatus();

    case "PING":
      return await COPILOT_RPC.ping();

    // Session management
    case "CREATE_SESSION":
      const session = await COPILOT_RPC.createSession(msg.config || {});
      currentSessionId = session.sessionId || session.id;
      return session;

    case "RESUME_SESSION":
      const resumed = await COPILOT_RPC.resumeSession(msg.sessionId, msg.config || {});
      currentSessionId = msg.sessionId;
      return resumed;

    case "LIST_SESSIONS":
      return await COPILOT_RPC.listSessions();

    case "DELETE_SESSION":
      return await COPILOT_RPC.deleteSession(msg.sessionId);

    // Chat (non-streaming — streaming handled via port)
    case "SEND_AND_WAIT":
      return await COPILOT_RPC.sendAndWait(msg.sessionId, msg.prompt);

    // Models
    case "LIST_MODELS":
      return await COPILOT_RPC.listModels();

    // Tab info (for content script)
    case "GET_TAB_INFO":
      return { url: msg.url, tabId: msg.tabId };

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
          const { stream, cancel } = COPILOT_RPC.sendMessage(msg.sessionId, msg.prompt);

          port.onDisconnect.addListener(() => cancel());

          for await (const event of stream) {
            try {
              port.postMessage({ type: "STREAM_EVENT", event });
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
async function checkAndUpdateConnection() {
  connectionState = "connecting";
  broadcastState();

  const result = await COPILOT_RPC.checkConnection();
  connectionState = result.connected ? "connected" : "disconnected";
  broadcastState();

  if (result.connected) {
    try {
      await COPILOT_RPC.initialize();
    } catch {
      // Initialize may not be required for all CLI versions
    }
  }

  return { ...result, state: connectionState };
}

function broadcastState() {
  chrome.runtime.sendMessage({
    type: "CONNECTION_STATE_CHANGED",
    state: connectionState,
  }).catch(() => {
    // No listeners
  });
}

// Periodic connection check
setInterval(async () => {
  if (connectionState !== "connecting") {
    const prev = connectionState;
    const result = await COPILOT_RPC.checkConnection();
    connectionState = result.connected ? "connected" : "disconnected";
    if (connectionState !== prev) broadcastState();
  }
}, 15000);
