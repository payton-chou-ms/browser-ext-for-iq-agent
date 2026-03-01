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
const PROACTIVE_SCHEDULES_KEY = "proactiveScheduleCards";
const PROACTIVE_SCHEDULE_ALARM_PREFIX = "proactive-schedule-";
const LEGACY_PROACTIVE_ALARMS = [
  "proactive-briefing",
  "proactive-deadlines",
  "proactive-ghosts",
  "proactive-meeting-prep",
];

let proactiveScheduleCards = [];

function createDefaultProactiveScheduleCards() {
  return [
    {
      id: "default-briefing",
      name: "每日晨報",
      agent: "briefing",
      prompt: "",
      lastSummary: "",
      lastResult: null,
      enabled: true,
      schedule: { mode: "daily", hour: 8, minute: 0, intervalMinutes: 60, weekdays: [1, 2, 3, 4, 5] },
      lastRun: null,
      lastStatus: "idle",
    },
    {
      id: "default-deadlines",
      name: "截止日追蹤",
      agent: "deadlines",
      prompt: "",
      lastSummary: "",
      lastResult: null,
      enabled: true,
      schedule: { mode: "interval", hour: 9, minute: 0, intervalMinutes: 720, weekdays: [1, 2, 3, 4, 5] },
      lastRun: null,
      lastStatus: "idle",
    },
    {
      id: "default-ghosts",
      name: "未回覆偵測",
      agent: "ghosts",
      prompt: "",
      lastSummary: "",
      lastResult: null,
      enabled: true,
      schedule: { mode: "interval", hour: 9, minute: 0, intervalMinutes: 240, weekdays: [1, 2, 3, 4, 5] },
      lastRun: null,
      lastStatus: "idle",
    },
    {
      id: "default-meeting-prep",
      name: "會議準備",
      agent: "meeting-prep",
      prompt: "",
      lastSummary: "",
      lastResult: null,
      enabled: true,
      schedule: { mode: "interval", hour: 9, minute: 0, intervalMinutes: 30, weekdays: [1, 2, 3, 4, 5] },
      lastRun: null,
      lastStatus: "idle",
    },
  ];
}

function normalizeWeekdays(weekdays) {
  if (!Array.isArray(weekdays)) return [1, 2, 3, 4, 5];
  const values = weekdays
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
  return [...new Set(values)].sort((a, b) => a - b);
}

function normalizeProactiveScheduleCard(raw) {
  const id = typeof raw?.id === "string" && raw.id.trim() ? raw.id.trim() : `card-${Date.now()}`;
  const agent = ["briefing", "deadlines", "ghosts", "meeting-prep"].includes(raw?.agent)
    ? raw.agent
    : "briefing";
  const mode = ["interval", "daily", "weekly"].includes(raw?.schedule?.mode)
    ? raw.schedule.mode
    : "interval";
  const hour = Math.min(23, Math.max(0, Number(raw?.schedule?.hour ?? 9) || 9));
  const minute = Math.min(59, Math.max(0, Number(raw?.schedule?.minute ?? 0) || 0));
  const intervalMinutes = Math.min(24 * 60, Math.max(1, Number(raw?.schedule?.intervalMinutes ?? 60) || 60));
  const weekdays = normalizeWeekdays(raw?.schedule?.weekdays);

  return {
    id,
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : "新查詢卡",
    agent,
    prompt: typeof raw?.prompt === "string" ? raw.prompt : "",
    lastSummary: typeof raw?.lastSummary === "string" ? raw.lastSummary : "",
    lastResult: raw?.lastResult != null ? raw.lastResult : null,
    enabled: raw?.enabled !== false,
    schedule: {
      mode,
      hour,
      minute,
      intervalMinutes,
      weekdays: weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5],
    },
    lastRun: typeof raw?.lastRun === "string" ? raw.lastRun : null,
    lastStatus: typeof raw?.lastStatus === "string" ? raw.lastStatus : "idle",
  };
}

function alarmNameForScheduleCard(cardId) {
  return `${PROACTIVE_SCHEDULE_ALARM_PREFIX}${cardId}`;
}

function isProactiveScheduleAlarm(name) {
  return typeof name === "string" && name.startsWith(PROACTIVE_SCHEDULE_ALARM_PREFIX);
}

function minutesUntilTime(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(1, Math.round((target - now) / 60000));
}

function getAlarmOptionsForSchedule(card) {
  const schedule = card.schedule || {};
  if (schedule.mode === "interval") {
    return {
      delayInMinutes: 1,
      periodInMinutes: Math.min(24 * 60, Math.max(1, Number(schedule.intervalMinutes || 60))),
    };
  }
  return {
    delayInMinutes: minutesUntilTime(Number(schedule.hour || 9), Number(schedule.minute || 0)),
    periodInMinutes: 24 * 60,
  };
}

function shouldRunScheduleCardNow(card, now = new Date()) {
  const schedule = card.schedule || {};
  if (schedule.mode !== "weekly") return true;
  const weekdays = normalizeWeekdays(schedule.weekdays);
  return weekdays.includes(now.getDay());
}

async function saveProactiveScheduleCards(cards) {
  proactiveScheduleCards = cards.map((card) => ({
    ...card,
    schedule: { ...card.schedule },
    prompt: typeof card?.prompt === "string" ? card.prompt : "",
    lastSummary: typeof card?.lastSummary === "string" ? card.lastSummary : "",
  }));
  await chrome.storage.local.set({ [PROACTIVE_SCHEDULES_KEY]: proactiveScheduleCards });
}

async function loadProactiveScheduleCards() {
  const local = await chrome.storage.local.get([PROACTIVE_SCHEDULES_KEY]);
  const stored = Array.isArray(local?.[PROACTIVE_SCHEDULES_KEY]) ? local[PROACTIVE_SCHEDULES_KEY] : [];
  if (stored.length === 0) {
    const defaults = createDefaultProactiveScheduleCards().map(normalizeProactiveScheduleCard);
    await saveProactiveScheduleCards(defaults);
    return defaults;
  }
  const normalized = stored.map(normalizeProactiveScheduleCard);
  await saveProactiveScheduleCards(normalized);
  return normalized;
}

async function clearLegacyAndScheduleAlarms() {
  const alarms = await chrome.alarms.getAll();
  const removals = alarms
    .filter((alarm) => LEGACY_PROACTIVE_ALARMS.includes(alarm.name) || isProactiveScheduleAlarm(alarm.name))
    .map((alarm) => chrome.alarms.clear(alarm.name));
  await Promise.all(removals);
}

async function applyProactiveScheduleAlarms() {
  await clearLegacyAndScheduleAlarms();
  const creations = proactiveScheduleCards
    .filter((card) => card.enabled)
    .map((card) => {
      const alarmName = alarmNameForScheduleCard(card.id);
      chrome.alarms.create(alarmName, getAlarmOptionsForSchedule(card));
      return alarmName;
    });
  console.log(`[BG] Applied proactive schedule alarms: ${creations.join(", ") || "none"}`);
}

function getProactiveScheduleCardById(cardId) {
  return proactiveScheduleCards.find((card) => card.id === cardId) || null;
}

async function executeProactiveAgent(agent, prompt = "") {
  switch (agent) {
    case "briefing":
      return await COPILOT_RPC.proactiveBriefing(prompt);
    case "deadlines":
      return await COPILOT_RPC.proactiveDeadlines(prompt);
    case "ghosts":
      return await COPILOT_RPC.proactiveGhosts(prompt);
    case "meeting-prep":
      return await COPILOT_RPC.proactiveMeetingPrep(prompt);
    default:
      throw new Error(`Unknown proactive agent: ${agent}`);
  }
}

function summarizeScheduleResult(agent, result) {
  const payload = result?.data || result?.results || {};

  const textSummary = [payload?.text, payload?.summary, payload?.message]
    .find((value) => typeof value === "string" && value.trim());
  if (typeof textSummary === "string" && textSummary.trim()) {
    const trimmed = textSummary.trim();
    return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
  }

  if (agent === "briefing") {
    const emails = Array.isArray(payload.emails) ? payload.emails.length : 0;
    const meetings = Array.isArray(payload.meetings) ? payload.meetings.length : 0;
    const tasks = Array.isArray(payload.tasks) ? payload.tasks.length : 0;
    const mentions = Array.isArray(payload.mentions) ? payload.mentions.length : 0;
    return `晨報：信件 ${emails}、會議 ${meetings}、待辦 ${tasks}、@mention ${mentions}`;
  }

  if (agent === "deadlines") {
    const count = Array.isArray(payload.deadlines) ? payload.deadlines.length : 0;
    return `截止日：共 ${count} 筆`;
  }

  if (agent === "ghosts") {
    const count = Array.isArray(payload.ghosts) ? payload.ghosts.length : 0;
    return `未回覆：共 ${count} 封`;
  }

  if (agent === "meeting-prep") {
    const title = typeof payload?.meeting?.title === "string" ? payload.meeting.title : "未找到近期會議";
    const attendees = Array.isArray(payload.attendees) ? payload.attendees.length : 0;
    return `會議準備：${title}（參與者 ${attendees}）`;
  }

  return "查詢完成";
}

async function updateScheduleCardRunState(cardId, nextStatus, scannedAt, lastSummary = "", lastResult = undefined) {
  const updated = proactiveScheduleCards.map((card) => (
    card.id === cardId
      ? {
        ...card,
        lastStatus: nextStatus,
        lastRun: scannedAt || card.lastRun,
        lastSummary: typeof lastSummary === "string" ? lastSummary : card.lastSummary,
        lastResult: lastResult !== undefined ? lastResult : card.lastResult,
      }
      : card
  ));
  await saveProactiveScheduleCards(updated);
}

async function runScheduleCardNow(cardId, reason = "manual") {
  const card = getProactiveScheduleCardById(cardId);
  if (!card) return { ok: false, error: "找不到排程卡" };
  if (!card.enabled) return { ok: false, error: "排程卡已停用" };

  try {
    const result = await executeProactiveAgent(card.agent, card.prompt || "");
    const scannedAt = new Date().toISOString();
    const nextSummary = result?.ok
      ? summarizeScheduleResult(card.agent, result)
      : `查詢失敗：${result?.error || "未取得資料"}`;
    const resultData = result?.ok ? (result.data || result.results || null) : null;
    await updateScheduleCardRunState(card.id, result?.ok ? "ok" : "error", scannedAt, nextSummary, resultData);
    if (result?.ok) {
      chrome.runtime.sendMessage({
        type: "PROACTIVE_UPDATE",
        agent: card.agent,
        data: result.data || result.results,
        scannedAt,
        source: reason,
      }).catch(() => {});
    }
    return { ok: !!result?.ok, result, scannedAt };
  } catch (err) {
    await updateScheduleCardRunState(
      card.id,
      "error",
      new Date().toISOString(),
      `查詢失敗：${err?.message || "執行失敗"}`,
    );
    return { ok: false, error: err?.message || "執行失敗" };
  }
}

async function initializeProactiveSchedules() {
  proactiveScheduleCards = await loadProactiveScheduleCards();
  await applyProactiveScheduleAlarms();
}

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
      return await COPILOT_RPC.proactiveBriefing(msg?.prompt || "");

    case "PROACTIVE_DEADLINES":
      return await COPILOT_RPC.proactiveDeadlines(msg?.prompt || "");

    case "PROACTIVE_GHOSTS":
      return await COPILOT_RPC.proactiveGhosts(msg?.prompt || "");

    case "PROACTIVE_MEETING_PREP":
      return await COPILOT_RPC.proactiveMeetingPrep(msg?.prompt || "");

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

    case "GET_PROACTIVE_SCHEDULE_CARDS": {
      if (!Array.isArray(proactiveScheduleCards) || proactiveScheduleCards.length === 0) {
        proactiveScheduleCards = await loadProactiveScheduleCards();
      }
      return { ok: true, cards: proactiveScheduleCards };
    }

    case "ADD_PROACTIVE_SCHEDULE_CARD": {
      const next = normalizeProactiveScheduleCard({
        id: `card-${Date.now()}`,
        name: msg?.name || "新查詢卡",
        agent: msg?.agent || "briefing",
        prompt: typeof msg?.prompt === "string" ? msg.prompt : "",
        enabled: true,
        schedule: {
          mode: "interval",
          intervalMinutes: 60,
          hour: 9,
          minute: 0,
          weekdays: [1, 2, 3, 4, 5],
        },
      });
      const cards = [next, ...proactiveScheduleCards];
      await saveProactiveScheduleCards(cards);
      await applyProactiveScheduleAlarms();
      return { ok: true, card: next, cards: proactiveScheduleCards };
    }

    case "UPSERT_PROACTIVE_SCHEDULE_CARD": {
      const incoming = normalizeProactiveScheduleCard(msg?.card || {});
      const exists = proactiveScheduleCards.some((card) => card.id === incoming.id);
      const cards = exists
        ? proactiveScheduleCards.map((card) => (card.id === incoming.id ? { ...incoming } : card))
        : [...proactiveScheduleCards, incoming];
      await saveProactiveScheduleCards(cards);
      await applyProactiveScheduleAlarms();
      return { ok: true, card: incoming, cards: proactiveScheduleCards };
    }

    case "DELETE_PROACTIVE_SCHEDULE_CARD": {
      const cardId = typeof msg?.cardId === "string" ? msg.cardId : "";
      if (!cardId) return { ok: false, error: "cardId is required" };
      const cards = proactiveScheduleCards.filter((card) => card.id !== cardId);
      await saveProactiveScheduleCards(cards);
      await applyProactiveScheduleAlarms();
      return { ok: true, cards: proactiveScheduleCards };
    }

    case "APPLY_PROACTIVE_SCHEDULE_CARD": {
      const cardId = typeof msg?.cardId === "string" ? msg.cardId : "";
      if (!cardId) return { ok: false, error: "cardId is required" };
      await applyProactiveScheduleAlarms();
      if (msg?.runNow) {
        const runResult = await runScheduleCardNow(cardId, "manual-refresh");
        return { ok: runResult.ok, runResult, cards: proactiveScheduleCards };
      }
      return { ok: true, cards: proactiveScheduleCards };
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
initializeProactiveSchedules().catch((err) => {
  console.error("[BG] initializeProactiveSchedules failed:", err?.message || err);
});

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

  if (isProactiveScheduleAlarm(alarm.name)) {
    const cardId = alarm.name.slice(PROACTIVE_SCHEDULE_ALARM_PREFIX.length);
    const card = getProactiveScheduleCardById(cardId);
    if (!card || !card.enabled) return;
    if (!shouldRunScheduleCardNow(card, new Date())) {
      console.log(`[BG] Skip weekly schedule card ${cardId} on non-selected weekday`);
      return;
    }
    const runResult = await runScheduleCardNow(cardId, "alarm");
    if (!runResult.ok) {
      console.error(`[BG] Proactive schedule card run failed (${cardId}):`, runResult.error || "unknown");
    }
    return;
  }

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
