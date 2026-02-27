// ===== IQ Copilot Sidebar v3.0.0 =====

// ── State ──
let connectionState = "disconnected"; // disconnected | connecting | connected
let currentSessionId = null;
let currentModel = "gpt-4.1";
let chatHistory = [];
let stats = { messages: 0, tokens: 0, sessions: 0, pages: 0 };
let tokenDetails = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0, apiCalls: 0 };
let currentTitle = "", currentUrl = "", currentType = "webpage";
let availableModels = [];
let toolCalls = [];
let sessionData = null;
let pendingFiles = []; // { name, type, size, dataUrl }

// ── DOM refs ──
const navBtns = document.querySelectorAll(".nav-btn[data-panel]");
const panels = document.querySelectorAll(".panel");
const panelTitle = document.getElementById("panel-title");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");
const btnNewChat = document.getElementById("btn-new-chat");
const suggestions = document.getElementById("chat-suggestions");

// ── Panel Navigation ──
const panelTitles = {
  chat: "IQ Copilot",
  context: "Context",
  agent: "Agent",
  history: "History",
  usage: "Usage",
  tasks: "Tasks",
  skills: "Skills",
  mcp: "MCP",
  version: "Version",
  config: "Config",
};

navBtns.forEach((btn) => {
  btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
});

function switchPanel(id) {
  navBtns.forEach((b) => b.classList.remove("active"));
  panels.forEach((p) => p.classList.remove("active"));
  const btn = document.querySelector(`.nav-btn[data-panel="${id}"]`);
  const panel = document.getElementById(`panel-${id}`);
  if (btn) btn.classList.add("active");
  if (panel) panel.classList.add("active");
  panelTitle.textContent = panelTitles[id] || "IQ Copilot";

  // Auto-refresh CLI context when switching to context panel
  if (id === "context") fetchCliContext();
}

// ── Helpers ──
function sendToBackground(msg) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function isConnected() {
  return connectionState === "connected";
}

// ── Connection Management ──
function updateConnectionUI(state) {
  connectionState = state;
  const statusEl = document.getElementById("connection-status");
  const textEl = document.getElementById("connection-text");
  const btnEl = document.getElementById("btn-connection-settings");
  const userEl = document.getElementById("connection-user");

  if (statusEl) {
    statusEl.className = "connection-status " + state;
  }

  const labels = {
    disconnected: "未連接 Copilot CLI",
    connecting: "正在連線...",
    connected: "已連接 Copilot CLI",
  };
  if (textEl) textEl.textContent = labels[state] || labels.disconnected;

  if (btnEl) btnEl.style.display = state === "connected" ? "none" : "";
  if (userEl) userEl.style.display = state === "connected" ? "flex" : "none";
}

async function checkConnection() {
  debugLog("CONN", "checkConnection() called");
  try {
    const res = await sendToBackground({ type: "CHECK_CONNECTION" });
    debugLog("CONN", "CHECK_CONNECTION response:", res);
    if (res) {
      const state = res.state || (res.connected ? "connected" : "disconnected");
      debugLog("CONN", "State resolved to:", state);
      updateConnectionUI(state);
      // NOTE: onConnected() is triggered by CONNECTION_STATE_CHANGED listener
      // to avoid duplicate calls, only call it here if the listener hasn't fired
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

// Listen for connection state changes from background
let _onConnectedRunning = false;

async function onConnected() {
  if (_onConnectedRunning) return; // prevent duplicate calls
  _onConnectedRunning = true;
  debugLog("CONN", "onConnected() — fetching models...");
  try {
    const modelsRes = await sendToBackground({ type: "LIST_MODELS" });
    debugLog("RPC", "LIST_MODELS response:", modelsRes);
    if (Array.isArray(modelsRes)) {
      availableModels = modelsRes;
      populateModelSelect(modelsRes);
    }
  } catch (err) {
    debugLog("ERR", "LIST_MODELS error:", err.message);
  }

  try {
    await loadHistorySessions();
  } catch (err) {
    debugLog("ERR", "loadHistorySessions error:", err.message);
  }

  // Load skills from CLI
  try {
    await loadSkillsFromCli();
  } catch (err) {
    debugLog("ERR", "loadSkillsFromCli error:", err.message);
  }

  // Load quota from CLI
  try {
    await loadQuotaFromCli();
  } catch (err) {
    debugLog("ERR", "loadQuotaFromCli error:", err.message);
  }

  // Load CLI context for Context panel
  try {
    await fetchCliContext();
  } catch (err) {
    debugLog("ERR", "fetchCliContext error:", err.message);
  }

  _onConnectedRunning = false;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CONNECTION_STATE_CHANGED") {
    updateConnectionUI(msg.state);
    if (msg.state === "connected") onConnected();
  }
});

document.getElementById("btn-connection-settings")?.addEventListener("click", () => {
  switchPanel("config");
});

// ── Debug Log ──
const debugLogEl = document.getElementById("debug-log");
function debugLog(tag, ...args) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
  const line = `[${ts}] [${tag}] ${msg}`;
  console.log(line);
  if (debugLogEl) {
    const span = document.createElement("div");
    span.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    span.style.padding = "2px 0";
    const tagColors = { CONN: "#48bb78", RPC: "#63b3ed", ERR: "#fc8181", INFO: "#d6bcfa", CFG: "#fbd38d" };
    span.innerHTML = `<span style="color:#718096">[${ts}]</span> <span style="color:${tagColors[tag] || '#a0aec0'}">[${tag}]</span> ${escapeHtml(msg)}`;
    debugLogEl.appendChild(span);
    debugLogEl.scrollTop = debugLogEl.scrollHeight;
  }
}
document.getElementById("btn-clear-debug")?.addEventListener("click", () => {
  if (debugLogEl) debugLogEl.innerHTML = "";
});
debugLog("INFO", "Sidebar loaded, debug log initialized");

// ── Config Panel ──
async function loadCliConfig() {
  debugLog("CFG", "loadCliConfig() called");
  try {
    const res = await sendToBackground({ type: "GET_CLI_CONFIG" });
    debugLog("CFG", "GET_CLI_CONFIG response:", res);
    if (res) {
      const hostEl = document.getElementById("config-host");
      const portEl = document.getElementById("config-port");
      if (hostEl && res.host) hostEl.value = res.host;
      if (portEl && res.port) portEl.value = res.port;
      if (res.state) updateConnectionUI(res.state);
    }
  } catch (err) {
    debugLog("ERR", "loadCliConfig error:", err.message);
  }
}

function populateModelSelect(models) {
  const sel = document.getElementById("config-model");
  if (!sel) return;
  sel.innerHTML = "";
  models.forEach((m) => {
    const name = typeof m === "string" ? m : m.name || m.id || String(m);
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === currentModel) opt.selected = true;
    sel.appendChild(opt);
  });
}

document.getElementById("btn-connect")?.addEventListener("click", async () => {
  const host = document.getElementById("config-host")?.value?.trim() || "127.0.0.1";
  const port = parseInt(document.getElementById("config-port")?.value, 10) || 19836;
  debugLog("CFG", `Connect clicked → host=${host}, port=${port}`);
  debugLog("CFG", `Will call proxy at http://${host}:${port}`);
  updateConnectionUI("connecting");
  try {
    const res = await sendToBackground({ type: "SET_CLI_CONFIG", host, port });
    debugLog("CONN", "SET_CLI_CONFIG response:", res);
    if (res && (res.connected || res.state === "connected")) {
      updateConnectionUI("connected");
      showToast("已連接 Copilot CLI");
      debugLog("CONN", "Connected successfully!");
      await onConnected();
    } else {
      updateConnectionUI("disconnected");
      debugLog("ERR", "Connection failed, response:", res);
      showToast("連線失敗");
    }
  } catch (err) {
    debugLog("ERR", "Connect error:", err.message, err.stack);
    updateConnectionUI("disconnected");
    showToast("連線失敗: " + err.message);
  }
});

document.getElementById("config-model")?.addEventListener("change", (e) => {
  currentModel = e.target.value;
  chrome.storage.local.set({ selectedModel: currentModel });
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

// File upload zones (fake but working UI)
document.querySelectorAll(".upload-dropzone").forEach((zone) => {
  zone.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", () => {
      if (input.files.length > 0) {
        const fileName = input.files[0].name;
        zone.querySelector("span").textContent = `✅ ${fileName}`;
        showToast("設定已上傳（模擬）");
      }
    });
    input.click();
  });
});

// ── Chat Logic ──
function showWelcome() {
  addBotMessage("你好！我是 **IQ Copilot** ✦\n\n我可以幫你分析當前頁面、摘要內容、翻譯文字等等。有什麼我能幫你的？");
}

function addUserMessage(text) {
  const msg = createMessage("user", text);
  chatMessages.appendChild(msg);
  chatHistory.push({ role: "user", content: text });
  stats.messages++;
  updateStats();
  scrollToBottom();
  hideSuggestions();
}

function addBotMessage(text) {
  const msg = createMessage("bot", text);
  chatMessages.appendChild(msg);
  chatHistory.push({ role: "bot", content: text });
  scrollToBottom();
  return msg;
}

function createMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "bot" ? "✦" : "👤";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = formatText(text);

  div.appendChild(avatar);
  div.appendChild(bubble);
  return div;
}

function createStreamingBotMessage() {
  const div = document.createElement("div");
  div.className = "message bot";
  div.id = "streaming-msg";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "✦";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = "";

  div.appendChild(avatar);
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  scrollToBottom();
  return bubble;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "message bot";
  div.id = "typing-msg";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "✦";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble typing-indicator";
  bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

  div.appendChild(avatar);
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  scrollToBottom();
}

function removeTyping() {
  const t = document.getElementById("typing-msg");
  if (t) t.remove();
}

function hideSuggestions() {
  if (suggestions) suggestions.style.display = "none";
}

function createToolCallCard(name, args) {
  const template = document.getElementById("tool-call-template");
  if (!template) return null;
  const card = template.querySelector(".tool-call-card").cloneNode(true);
  card.querySelector(".tool-call-name").textContent = name;
  card.querySelector(".tool-call-status").textContent = "running";
  card.querySelector(".tool-call-status").className = "tool-call-status running";
  card.querySelector(".tool-call-args").textContent = typeof args === "string" ? args : JSON.stringify(args, null, 2);
  card.querySelector(".tool-call-result").textContent = "等待結果...";
  card.dataset.toolName = name;

  // Track in toolCalls with timing
  const now = Date.now();
  const entry = { name, status: "running", timestamp: new Date().toISOString(), startedAt: now, endedAt: null, args, result: null };
  toolCalls.push(entry);
  card.dataset.toolIndex = toolCalls.length - 1;

  // Start task timer on first tool call
  startTaskTimer();
  renderTasksList();

  return card;
}

function updateToolCallCard(card, status, result) {
  if (!card) return;
  const statusEl = card.querySelector(".tool-call-status");
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = "tool-call-status " + (status === "success" ? "success" : status === "error" ? "error" : "running");
  }
  if (result != null) {
    const resultEl = card.querySelector(".tool-call-result");
    if (resultEl) resultEl.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  }

  const idx = parseInt(card.dataset.toolIndex, 10);
  if (!isNaN(idx) && toolCalls[idx]) {
    toolCalls[idx].status = status;
    toolCalls[idx].result = result;
    toolCalls[idx].endedAt = Date.now();

    // Stop timer if all tasks done
    const allDone = toolCalls.every((t) => t.status !== "running");
    if (allDone) stopTaskTimer();

    renderTasksList();
  }
}

// ── Browser Context Helper ──
async function fetchCurrentTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    currentUrl = tab.url || "";
    currentTitle = tab.title || "";
    if (currentUrl.endsWith(".pdf") || currentUrl.includes("pdf")) {
      currentType = "PDF 文件";
    } else if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("edge://")) {
      currentType = "瀏覽器頁面";
    } else {
      currentType = "網頁";
    }
  } catch { /* ignore */ }
}

function buildBrowserContext() {
  const parts = [];
  if (currentUrl) parts.push(`URL: ${currentUrl}`);
  if (currentTitle) parts.push(`Title: ${currentTitle}`);
  if (currentType) parts.push(`Type: ${currentType}`);
  return parts.length > 0 ? parts.join("\n") : "";
}

async function enrichPromptWithTabContext(prompt) {
  await fetchCurrentTabInfo();
  const ctx = buildBrowserContext();
  if (!ctx) return prompt;
  return `<browser_context>\n${ctx}\n</browser_context>\n\n${prompt}`;
}

// ── Default System Message ──
const DEFAULT_SYSTEM_MESSAGE = [
  "You are IQ Copilot, a browser extension assistant.",
  "You have access to tools including: web_fetch, bash, view, create, edit, grep, glob, and others.",
  "IMPORTANT: When the user asks for web content, weather, news, or anything requiring live data, USE the web_fetch tool to fetch it. Do NOT say you cannot access the internet.",
  "For weather queries: use web_fetch with the Open-Meteo API (free, no key needed). Example: https://api.open-meteo.com/v1/forecast?latitude=25.033&longitude=121.565&current_weather=true for Taipei. Look up coordinates for other cities. Parse the JSON response and present it in a friendly format with temperature, wind, and conditions.",
  "If a web_fetch call fails or times out, try an alternative URL or use the bash tool with curl as a fallback. Do NOT give up after one failed attempt.",
  "When the user says 'summary this page' or 'summarize this page', use web_fetch to fetch the URL from the <browser_context> and summarize the content.",
  "When the user attaches a file, analyze its content directly — it is provided inline in the message.",
  "The user's current browser tab context is provided in <browser_context> tags with each message.",
].join(" ");

// ── Streaming Chat ──
async function ensureSession() {
  if (currentSessionId) return currentSessionId;
  try {
    const config = {};
    const sysVal = document.getElementById("config-system-message")?.value;
    // Merge default system message with user's custom one
    const systemParts = [DEFAULT_SYSTEM_MESSAGE];
    if (sysVal) systemParts.push(sysVal);
    config.systemMessage = systemParts.join("\n\n");
    if (currentModel) config.model = currentModel;
    const res = await sendToBackground({ type: "CREATE_SESSION", config });
    if (res && res.sessionId) {
      currentSessionId = res.sessionId;
      sessionData = res;
      stats.sessions++;
      updateStats();
      return currentSessionId;
    }
  } catch (err) {
    showToast("建立 Session 失敗: " + err.message);
  }
  return null;
}

async function sendMessageStreaming(text, files = []) {
  const sid = await ensureSession();
  if (!sid) {
    fallbackSend(text, files);
    return;
  }

  showTyping();
  let bubble = null;
  let content = "";
  let currentToolCard = null;
  let streamDone = false;

  // Build file attachments for transport
  const attachments = files.map((f) => ({
    name: f.name,
    type: f.type,
    size: f.size,
    dataUrl: f.dataUrl,
    textContent: f.textContent || null,
    isImage: f.isImage,
  }));

  try {
    const port = chrome.runtime.connect({ name: "copilot-stream" });

    port.onMessage.addListener((msg) => {
      if (msg.type === "STREAM_EVENT") {
        removeTyping();
        if (!bubble) {
          bubble = createStreamingBotMessage();
        }

        // SDK event is in msg.data: { type, id, timestamp, data: {...} }
        const evt = msg.data || {};
        const evtData = evt.data || {};

        // assistant.message_delta → streaming text chunk
        if (evt.type === "assistant.message_delta" && (evtData.deltaContent || evtData.content)) {
          content += evtData.deltaContent || evtData.content;
          bubble.innerHTML = formatText(content);
          scrollToBottom();
        }

        // assistant.message → final complete message
        if (evt.type === "assistant.message" && evtData.content) {
          content = evtData.content;
          bubble.innerHTML = formatText(content);
          scrollToBottom();
        }

        // tool.execution_start
        if (evt.type === "tool.execution_start") {
          const toolName = evtData.toolName || evtData.name || "tool";
          const toolArgs = evtData.arguments || evtData.args || "";
          currentToolCard = createToolCallCard(toolName, toolArgs);
          if (currentToolCard) {
            bubble.parentElement.appendChild(currentToolCard);
            scrollToBottom();
          }
        }

        // tool.execution_complete
        if (evt.type === "tool.execution_complete") {
          updateToolCallCard(currentToolCard, "success", evtData.result || evtData.output || "done");
          currentToolCard = null;
        }

        // session.error
        if (evt.type === "session.error") {
          const errMsg = evtData.message || "Session error";
          content += `\n⚠ ${errMsg}`;
          bubble.innerHTML = formatText(content);
          if (currentToolCard) updateToolCallCard(currentToolCard, "error", errMsg);
        }

        // Sub-agent events
        if (evt.type === "subagent.spawn" || evt.type === "subagent.start" || evtData.subagent?.spawn) {
          const sa = evtData.subagent || evtData;
          const agent = {
            id: sa.id || sa.agentId || `sub-${subAgents.length}`,
            name: sa.name || sa.type || "explore",
            status: "running",
            startTime: Date.now(),
            endTime: null,
          };
          subAgents.push(agent);
          startTaskTimer();
          renderTasksList();
        }
        if (evt.type === "subagent.complete" || evt.type === "subagent.done" || evtData.subagent?.complete) {
          const sa = evtData.subagent || evtData;
          const id = sa.id || sa.agentId;
          const found = subAgents.find((a) => a.id === id || a.status === "running");
          if (found) {
            found.status = "success";
            found.endTime = Date.now();
            renderTasksList();
          }
        }

        // Fleet events (parallel agent tasks)
        if (evt.type === "fleet.task_start" || evtData.fleet?.task_start) {
          const f = evtData.fleet?.task_start || evtData;
          const agent = {
            id: f.id || `fleet-${subAgents.length}`,
            name: f.description || f.name || "Fleet Task",
            status: "running",
            startTime: Date.now(),
            endTime: null,
          };
          subAgents.push(agent);
          startTaskTimer();
          renderTasksList();
        }
        if (evt.type === "fleet.task_complete" || evtData.fleet?.task_complete) {
          const f = evtData.fleet?.task_complete || evtData;
          const id = f.id;
          const found = subAgents.find((a) => a.id === id);
          if (found) {
            found.status = f.error ? "error" : "success";
            found.endTime = Date.now();
            renderTasksList();
          }
        }

        // assistant.usage → real token usage from CLI
        if (evt.type === "assistant.usage") {
          tokenDetails.apiCalls++;
          if (evtData.inputTokens) tokenDetails.inputTokens += evtData.inputTokens;
          if (evtData.outputTokens) tokenDetails.outputTokens += evtData.outputTokens;
          if (evtData.cacheReadTokens) tokenDetails.cacheReadTokens += evtData.cacheReadTokens;
          if (evtData.cacheWriteTokens) tokenDetails.cacheWriteTokens += evtData.cacheWriteTokens;
          if (evtData.cost) tokenDetails.cost += evtData.cost;
          stats.tokens = tokenDetails.inputTokens + tokenDetails.outputTokens;
          debugLog("USAGE", `tokens in=${evtData.inputTokens || 0} out=${evtData.outputTokens || 0} model=${evtData.model || "-"}`);
          updateStats();
        }

        // session.usage_info
        if (evt.type === "session.usage_info" && evtData.currentTokens) {
          debugLog("USAGE", `context tokens=${evtData.currentTokens} limit=${evtData.tokenLimit}`);
        }
      }

      if (msg.type === "STREAM_DONE") {
        streamDone = true;
        removeTyping();
        stopTaskTimer();
        // Mark any still-running tasks as done
        toolCalls.forEach((tc) => { if (tc.status === "running") { tc.status = "success"; tc.endedAt = Date.now(); } });
        subAgents.forEach((a) => { if (a.status === "running") { a.status = "success"; a.endTime = Date.now(); } });
        renderTasksList();
        if (!bubble) bubble = createStreamingBotMessage();
        if (!content) {
          const final = msg.data?.content || msg.data?.text || "";
          if (final) {
            content = final;
            bubble.innerHTML = formatText(content);
          }
        }
        const streamEl = document.getElementById("streaming-msg");
        if (streamEl) streamEl.removeAttribute("id");
        chatHistory.push({ role: "bot", content });
        port.disconnect();
      }

      if (msg.type === "STREAM_ERROR") {
        streamDone = true;
        removeTyping();
        stopTaskTimer();
        // Mark running tasks as error
        toolCalls.forEach((tc) => { if (tc.status === "running") { tc.status = "error"; tc.endedAt = Date.now(); } });
        subAgents.forEach((a) => { if (a.status === "running") { a.status = "error"; a.endTime = Date.now(); } });
        renderTasksList();
        if (!bubble) bubble = createStreamingBotMessage();
        const errText = msg.error || msg.message || "串流錯誤";
        bubble.innerHTML = `<span style="color:var(--error)">⚠ ${escapeHtml(errText)}</span>`;
        const streamEl = document.getElementById("streaming-msg");
        if (streamEl) streamEl.removeAttribute("id");
        chatHistory.push({ role: "bot", content: errText });
        if (currentToolCard) updateToolCallCard(currentToolCard, "error", errText);
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (!streamDone) {
        // Stream ended unexpectedly — fallback
        removeTyping();
        if (!content) fallbackSend(text);
      }
    });

    const enrichedPrompt = await enrichPromptWithTabContext(text);
    port.postMessage({ type: "STREAM_SEND", sessionId: sid, prompt: enrichedPrompt, attachments });
  } catch {
    // Streaming not available — fallback
    removeTyping();
    fallbackSend(text, files);
  }
}

async function fallbackSend(text, files = []) {
  showTyping();
  try {
    const sid = currentSessionId || (await ensureSession());
    if (!sid) {
      removeTyping();
      addBotMessage("⚠ 無法建立 Session");
      return;
    }
    const attachments = files.map((f) => ({
      name: f.name, type: f.type, size: f.size,
      dataUrl: f.dataUrl, textContent: f.textContent || null, isImage: f.isImage,
    }));
    const enrichedPrompt = await enrichPromptWithTabContext(text);
    const res = await sendToBackground({ type: "SEND_AND_WAIT", sessionId: sid, prompt: enrichedPrompt, attachments });
    removeTyping();
    const reply = res?.content || res?.text || res?.message || JSON.stringify(res);
    addBotMessage(reply);
    if (res?.usage?.totalTokens) stats.tokens = res.usage.totalTokens;
    else stats.tokens += reply.length;
    updateStats();
  } catch (err) {
    removeTyping();
    addBotMessage("⚠ " + err.message);
  }
}

async function simulateResponse(userText) {
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
  const lower = userText.toLowerCase();
  if (lower.includes("摘要") || lower.includes("summary")) {
    stats.pages++;
    const host = currentUrl ? new URL(currentUrl).hostname : "—";
    return `📝 **頁面摘要**\n\n**${currentTitle}**\n\n這是一個位於 ${host} 的頁面。目前為模擬摘要功能 — 實際使用時，IQ Copilot 會呼叫 AI 模型來產生精確的頁面內容摘要。\n\n> 提示：你可以連接 MCP 伺服器來啟用真正的 AI 功能。`;
  }
  if (lower.includes("翻譯") || lower.includes("translate")) {
    return "🌐 **翻譯功能**\n\n請告訴我你要翻譯哪段文字，以及目標語言。你也可以先選取頁面上的文字，我會自動偵測。\n\n支援語言：中文、英文、日文、韓文、法文、德文等。";
  }
  if (lower.includes("解釋") || lower.includes("explain")) {
    return `💡 **頁面解釋**\n\n你正在瀏覽 **${currentTitle}**。\n\n這個頁面的類型偵測為：${currentType}。\n\n需要我更深入地解釋特定內容嗎？`;
  }
  return `收到你的訊息：「${userText}」\n\n這是 IQ Copilot 的模擬回覆。連接 AI 後端（透過 MCP 面板設定）後，你將獲得真正的智慧回覆。\n\n你也可以試試：\n• 「摘要此頁」\n• 「翻譯此頁」\n• 「解釋此頁」`;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text && pendingFiles.length === 0) return;

  chatInput.value = "";
  chatInput.style.height = "auto";

  // Capture and clear pending files
  const attachedFiles = [...pendingFiles];
  clearPendingFiles();

  // Show user message with file badges
  addUserMessageWithFiles(text, attachedFiles);

  if (isConnected()) {
    await sendMessageStreaming(text, attachedFiles);
  } else {
    // Offline mode — simulate
    showTyping();
    const response = await simulateResponse(text);
    removeTyping();
    addBotMessage(response);
    stats.tokens += text.length + response.length;
    updateStats();
  }
}

// Event listeners
btnSend.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
});
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
});

// ── File Upload ──
const fileInput = document.getElementById("file-input");
const btnAttach = document.getElementById("btn-attach");
const filePreviewBar = document.getElementById("file-preview-bar");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
const TEXT_EXTENSIONS = [".txt", ".md", ".json", ".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css", ".csv", ".xml", ".yaml", ".yml", ".toml", ".sh", ".bash", ".log"];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function isImageFile(file) {
  return IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
}

function isTextFile(file) {
  const ext = "." + file.name.split(".").pop().toLowerCase();
  return TEXT_EXTENSIONS.includes(ext) || file.type.startsWith("text/");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(file) {
  if (isImageFile(file)) return "🖼️";
  const ext = file.name.split(".").pop().toLowerCase();
  const icons = {
    pdf: "📕", json: "📋", md: "📝", txt: "📄", csv: "📊",
    js: "💛", ts: "💙", jsx: "⚛️", tsx: "⚛️", py: "🐍",
    html: "🌐", css: "🎨", xml: "📰", yaml: "⚙️", yml: "⚙️",
    sh: "💻", bash: "💻", log: "📋", toml: "⚙️",
  };
  return icons[ext] || "📎";
}

async function addFiles(fileList) {
  for (const file of fileList) {
    if (file.size > MAX_FILE_SIZE) {
      showToast(`${file.name} 超過 10MB 限制`);
      continue;
    }
    if (pendingFiles.some((f) => f.name === file.name && f.size === file.size)) {
      continue; // duplicate
    }

    try {
      let dataUrl = null;
      let textContent = null;

      if (isImageFile(file)) {
        dataUrl = await readFileAsDataUrl(file);
      } else if (isTextFile(file) || file.type === "application/json") {
        textContent = await readFileAsText(file);
        // Also get dataUrl for transport
        dataUrl = await readFileAsDataUrl(file);
      } else {
        // Binary/PDF — send as base64 dataUrl
        dataUrl = await readFileAsDataUrl(file);
      }

      pendingFiles.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
        textContent,
        isImage: isImageFile(file),
      });
    } catch (err) {
      showToast(`讀取 ${file.name} 失敗: ${err.message}`);
    }
  }
  renderFilePreview();
}

function removePendingFile(index) {
  pendingFiles.splice(index, 1);
  renderFilePreview();
}

function clearPendingFiles() {
  pendingFiles.length = 0;
  renderFilePreview();
}

function renderFilePreview() {
  if (!filePreviewBar) return;
  if (pendingFiles.length === 0) {
    filePreviewBar.style.display = "none";
    filePreviewBar.innerHTML = "";
    return;
  }

  filePreviewBar.style.display = "flex";
  filePreviewBar.innerHTML = pendingFiles.map((f, i) => {
    const icon = getFileIcon(f);
    const preview = f.isImage && f.dataUrl
      ? `<img src="${f.dataUrl}" class="file-chip-thumb" alt="${escapeHtml(f.name)}">`
      : `<span class="file-chip-icon">${icon}</span>`;
    return `<div class="file-chip" data-index="${i}">
      ${preview}
      <span class="file-chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
      <span class="file-chip-size">${formatFileSize(f.size)}</span>
      <button class="file-chip-remove" data-index="${i}" title="移除">✕</button>
    </div>`;
  }).join("");

  // Remove buttons
  filePreviewBar.querySelectorAll(".file-chip-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removePendingFile(parseInt(btn.dataset.index, 10));
    });
  });
}

// Attach button click
btnAttach?.addEventListener("click", () => fileInput?.click());

// File input change
fileInput?.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    addFiles(fileInput.files);
    fileInput.value = ""; // reset so same file can be selected again
  }
});

// Drag and drop on chat input area
const chatInputArea = document.querySelector(".chat-input-area");
if (chatInputArea) {
  chatInputArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatInputArea.classList.add("drag-over");
  });
  chatInputArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatInputArea.classList.remove("drag-over");
  });
  chatInputArea.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatInputArea.classList.remove("drag-over");
    if (e.dataTransfer?.files?.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  });
}

// Also support paste images
chatInput.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const files = [];
  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (files.length > 0) {
    e.preventDefault();
    addFiles(files);
  }
});

// User message with file badges
function addUserMessageWithFiles(text, files) {
  const msg = createMessage("user", text || "");
  const bubble = msg.querySelector(".msg-bubble");

  if (files.length > 0) {
    const filesDiv = document.createElement("div");
    filesDiv.className = "msg-files";
    filesDiv.innerHTML = files.map((f) => {
      if (f.isImage && f.dataUrl) {
        return `<div class="msg-file-item msg-file-image">
          <img src="${f.dataUrl}" alt="${escapeHtml(f.name)}" class="msg-file-img">
          <span class="msg-file-name">${escapeHtml(f.name)}</span>
        </div>`;
      }
      const icon = getFileIcon(f);
      return `<div class="msg-file-item">
        <span class="msg-file-icon">${icon}</span>
        <span class="msg-file-name">${escapeHtml(f.name)}</span>
        <span class="msg-file-size">${formatFileSize(f.size)}</span>
      </div>`;
    }).join("");
    bubble.prepend(filesDiv);
  }

  chatMessages.appendChild(msg);
  chatHistory.push({ role: "user", content: text, files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })) });
  stats.messages++;
  updateStats();
  scrollToBottom();
  hideSuggestions();
}

// New chat
btnNewChat.addEventListener("click", async () => {
  chatMessages.innerHTML = "";
  chatHistory = [];
  if (suggestions) suggestions.style.display = "flex";
  currentSessionId = null;
  sessionData = null;
  stats.sessions++;
  updateStats();
  showWelcome();
});

// Suggestion chips
document.querySelectorAll(".suggestion-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    chatInput.value = chip.textContent.replace(/^[^\s]+\s/, "");
    sendMessage();
  });
});

// ── Context Panel (Copilot CLI Context) ──
let cliContext = null;

async function fetchCliContext() {
  if (!isConnected()) {
    renderCliContextDisconnected();
    return;
  }
  try {
    const ctx = await sendToBackground({ type: "GET_CONTEXT" });
    debugLog("CTX", "GET_CONTEXT response:", ctx);
    if (ctx && !ctx.error) {
      cliContext = ctx;
      renderCliContext(ctx);
    } else {
      renderCliContextError(ctx?.error || "Unknown error");
    }
  } catch (err) {
    debugLog("ERR", "fetchCliContext error:", err.message);
    renderCliContextError(err.message);
  }
}

function renderCliContextDisconnected() {
  const el = (id) => document.getElementById(id);
  if (el("ctx-sdk-state")) el("ctx-sdk-state").textContent = "未連接";
  if (el("ctx-version")) el("ctx-version").textContent = "—";
  if (el("ctx-protocol")) el("ctx-protocol").textContent = "—";
  if (el("ctx-auth-login")) el("ctx-auth-login").textContent = "—";
  if (el("ctx-auth-type")) el("ctx-auth-type").textContent = "—";
  if (el("ctx-auth-host")) el("ctx-auth-host").textContent = "—";
  if (el("ctx-models-count")) el("ctx-models-count").textContent = "0";
  if (el("ctx-models-list")) el("ctx-models-list").innerHTML = '<p class="text-muted">未連接</p>';
  if (el("ctx-tools-count")) el("ctx-tools-count").textContent = "0";
  if (el("ctx-tools-list")) el("ctx-tools-list").innerHTML = '<p class="text-muted">未連接</p>';
  if (el("ctx-quota")) el("ctx-quota").innerHTML = '<p class="text-muted">未連接</p>';
}

function renderCliContextError(errMsg) {
  const el = (id) => document.getElementById(id);
  if (el("ctx-sdk-state")) el("ctx-sdk-state").textContent = "錯誤";
  if (el("ctx-models-list")) el("ctx-models-list").innerHTML = `<p class="text-muted">錯誤: ${escapeHtml(errMsg)}</p>`;
}

function renderCliContext(ctx) {
  const el = (id) => document.getElementById(id);

  // SDK state
  if (el("ctx-sdk-state")) el("ctx-sdk-state").textContent = ctx.sdkState || "connected";

  // Version
  if (el("ctx-version")) el("ctx-version").textContent = ctx.status?.version || "—";
  if (el("ctx-protocol")) el("ctx-protocol").textContent = ctx.status?.protocolVersion != null ? `v${ctx.status.protocolVersion}` : "—";

  // Auth
  if (el("ctx-auth-login")) el("ctx-auth-login").textContent = ctx.auth?.login || (ctx.auth?.isAuthenticated ? "已認證" : "未認證");
  if (el("ctx-auth-type")) el("ctx-auth-type").textContent = ctx.auth?.authType || "—";
  if (el("ctx-auth-host")) el("ctx-auth-host").textContent = ctx.auth?.host || "—";

  // Models
  const models = ctx.models || [];
  if (el("ctx-models-count")) el("ctx-models-count").textContent = String(models.length);
  if (el("ctx-models-list")) {
    if (models.length === 0) {
      el("ctx-models-list").innerHTML = '<p class="text-muted">無可用模型</p>';
    } else {
      el("ctx-models-list").innerHTML = models
        .map((m) => `<div class="meta-item"><span class="meta-val">${escapeHtml(m.name || m.id)}</span></div>`)
        .join("");
    }
  }

  // Tools
  const tools = ctx.tools || [];
  if (el("ctx-tools-count")) el("ctx-tools-count").textContent = String(tools.length);
  if (el("ctx-tools-list")) {
    if (tools.length === 0) {
      el("ctx-tools-list").innerHTML = '<p class="text-muted">無可用工具</p>';
    } else {
      el("ctx-tools-list").innerHTML = tools
        .map((t) => {
          const desc = t.description ? ` title="${escapeHtml(t.description)}"` : "";
          return `<div class="meta-item"${desc}><span class="meta-key">${escapeHtml(t.name)}</span></div>`;
        })
        .join("");
    }
  }

  // Quota
  if (el("ctx-quota")) {
    const quota = ctx.quota || {};
    const keys = Object.keys(quota);
    if (keys.length === 0) {
      el("ctx-quota").innerHTML = '<p class="text-muted">無配額資訊</p>';
    } else {
      el("ctx-quota").innerHTML = keys
        .map((k) => {
          const q = quota[k];
          const used = q.usedRequests ?? 0;
          const total = q.entitlementRequests ?? 0;
          const pct = q.remainingPercentage != null ? `${q.remainingPercentage}%` : "—";
          return `<div class="meta-item"><span class="meta-key">${escapeHtml(k)}</span><span class="meta-val">${used}/${total} (剩餘 ${pct})</span></div>`;
        })
        .join("");
    }
  }

  // Session context card
  renderSessionContext();

  // Update chat context bar
  const barText = document.getElementById("context-bar-text");
  if (barText) {
    const login = ctx.auth?.login || "";
    const ver = ctx.status?.version || "";
    barText.textContent = login ? `${login} · v${ver}` : `Copilot CLI v${ver}`;
  }
}

function renderSessionContext() {
  let card = document.getElementById("session-context-card");
  const scrollEl = document.querySelector("#panel-context .panel-scroll");
  if (!scrollEl) return;

  if (!isConnected() || !sessionData) {
    if (card) card.remove();
    return;
  }

  if (!card) {
    card = document.createElement("div");
    card.id = "session-context-card";
    card.className = "glass-card";
    scrollEl.appendChild(card);
  }

  const sd = sessionData;
  const rows = [
    ["cwd", sd.cwd || "—"],
    ["Git Root", sd.gitRoot || "—"],
    ["Repository", sd.repository || "—"],
    ["Branch", sd.branch || "—"],
  ];

  card.innerHTML = `
    <div class="card-header"><span class="card-icon">🖥️</span><h3>Session Context</h3></div>
    ${rows.map(([k, v]) => `<div class="info-group"><label>${escapeHtml(k)}</label><p class="info-value">${escapeHtml(v)}</p></div>`).join("")}
  `;

  // Available tools
  if (sd.tools && Array.isArray(sd.tools) && sd.tools.length > 0) {
    const toolsHtml = sd.tools.map((t) => {
      const name = typeof t === "string" ? t : t.name || String(t);
      return `<span class="agent-badge" style="margin:2px">${escapeHtml(name)}</span>`;
    }).join("");
    card.innerHTML += `<div class="info-group"><label>Available Tools</label><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${toolsHtml}</div></div>`;
  }
}

// Context refresh button
document.getElementById("ctx-refresh")?.addEventListener("click", () => {
  fetchCliContext();
  showToast("Context 重新載入中...");
});

// ── Agent Panel ──
document.querySelectorAll(".agent-option").forEach((opt) => {
  opt.addEventListener("click", async () => {
    document.querySelectorAll(".agent-option").forEach((o) => o.classList.remove("selected"));
    opt.classList.add("selected");
    opt.querySelector("input").checked = true;
    const agentName = opt.querySelector(".agent-name").textContent;
    showToast(`已切換至 ${agentName}`);

    if (isConnected() && currentSessionId) {
      // Destroy current session, create new one with agent's config
      try {
        await sendToBackground({ type: "DELETE_SESSION", sessionId: currentSessionId });
      } catch { /* ignore */ }
      currentSessionId = null;
      sessionData = null;
      // Will auto-create on next message
    }
  });
});

function updateAgentBadges() {
  document.querySelectorAll(".agent-option").forEach((opt) => {
    let badge = opt.querySelector(".agent-badge");
    if (!isConnected()) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "agent-badge";
        opt.appendChild(badge);
      }
      badge.textContent = "local";
      badge.style.background = "var(--bg-secondary)";
      badge.style.color = "var(--text-muted)";
    } else if (badge && badge.textContent === "local") {
      badge.remove();
    }
  });
}

// ── History Panel ──
async function loadHistorySessions() {
  const listEl = document.getElementById("history-list");
  if (!listEl) return;

  if (!isConnected()) {
    listEl.innerHTML = '<div class="empty-state"><span class="empty-icon">🔌</span><p>連接 CLI 以查看歷史</p></div>';
    return;
  }

  try {
    const sessions = await sendToBackground({ type: "LIST_SESSIONS" });
    if (!Array.isArray(sessions) || sessions.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><span class="empty-icon">🕐</span><p>尚無對話紀錄</p></div>';
      return;
    }

    listEl.innerHTML = "";
    sessions.forEach((s) => {
      const item = document.createElement("div");
      item.className = "history-item";
      const sid = s.sessionId || s.id || "—";
      const truncId = sid.length > 12 ? sid.slice(0, 12) + "…" : sid;
      const time = s.startTime ? new Date(s.startTime).toLocaleString() : "";
      const summary = s.summary || s.title || "";

      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="history-item-title">${escapeHtml(truncId)}</span>
          <button class="icon-btn history-delete-btn" title="刪除" data-sid="${escapeHtml(sid)}" style="color:var(--error);flex-shrink:0">✕</button>
        </div>
        ${time ? `<span class="history-item-date">${escapeHtml(time)}</span>` : ""}
        ${summary ? `<span class="history-item-date">${escapeHtml(summary)}</span>` : ""}
      `;

      item.addEventListener("click", async (e) => {
        if (e.target.closest(".history-delete-btn")) return;
        try {
          const res = await sendToBackground({ type: "RESUME_SESSION", sessionId: sid });
          if (res) {
            currentSessionId = sid;
            sessionData = res;
            showToast(`已恢復 Session ${truncId}`);
            switchPanel("chat");
          }
        } catch (err) {
          showToast("恢復失敗: " + err.message);
        }
      });

      listEl.appendChild(item);
    });

    // Delete buttons
    listEl.querySelectorAll(".history-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const sid = btn.dataset.sid;
        try {
          await sendToBackground({ type: "DELETE_SESSION", sessionId: sid });
          if (currentSessionId === sid) {
            currentSessionId = null;
            sessionData = null;
          }
          await loadHistorySessions();
          showToast("已刪除");
        } catch (err) {
          showToast("刪除失敗: " + err.message);
        }
      });
    });
  } catch {
    listEl.innerHTML = '<div class="empty-state"><span class="empty-icon">⚠</span><p>載入失敗</p></div>';
  }
}

// Search filter
document.getElementById("history-search")?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const items = document.querySelectorAll("#history-list .history-item");
  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(query) ? "" : "none";
  });
});

// ── Usage Panel ──
function formatTokenCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function updateStats() {
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };
  el("stat-messages", stats.messages);
  el("stat-tokens", formatTokenCount(stats.tokens));
  el("stat-sessions", stats.sessions);
  el("stat-pages", stats.pages);

  // Token breakdown detail
  el("td-input", formatTokenCount(tokenDetails.inputTokens));
  el("td-output", formatTokenCount(tokenDetails.outputTokens));
  el("td-cache-read", formatTokenCount(tokenDetails.cacheReadTokens));
  el("td-cache-write", formatTokenCount(tokenDetails.cacheWriteTokens));
  el("td-cost", tokenDetails.cost > 0 ? `$${tokenDetails.cost.toFixed(4)}` : "$0.00");
  el("td-api-calls", tokenDetails.apiCalls);

  // Activity bars (proportional to max)
  const maxAct = Math.max(stats.messages, stats.pages, toolCalls.length, 1);
  const setBar = (id, countId, val) => {
    const bar = document.getElementById(id);
    const cnt = document.getElementById(countId);
    if (bar) bar.style.width = `${Math.min((val / maxAct) * 100, 100)}%`;
    if (cnt) cnt.textContent = val;
  };
  setBar("bar-chat", "bar-chat-count", stats.messages);
  setBar("bar-context", "bar-context-count", stats.pages);
  setBar("bar-tasks", "bar-tasks-count", toolCalls.length);

  renderModelsCard();
}

function renderModelsCard() {
  let card = document.getElementById("models-card");
  const scrollEl = document.querySelector("#panel-usage .panel-scroll");
  if (!scrollEl) return;

  if (availableModels.length === 0) {
    if (card) card.remove();
    return;
  }

  if (!card) {
    card = document.createElement("div");
    card.id = "models-card";
    card.className = "glass-card";
    scrollEl.appendChild(card);
  }

  card.innerHTML = `
    <div class="card-header"><span class="card-icon">🧠</span><h3>Available Models</h3></div>
    <div style="display:flex;flex-direction:column;gap:4px" id="models-list">
      ${availableModels.map((m) => {
        const name = typeof m === "string" ? m : m.name || m.id || String(m);
        const active = name === currentModel;
        return `<div class="model-item${active ? " active" : ""}" data-model="${escapeHtml(name)}" style="padding:8px 10px;background:var(--bg-primary);border-radius:6px;font-size:12px;border:1px solid ${active ? "var(--accent-start)" : "var(--border)"};color:${active ? "#c4b5fd" : "var(--text-secondary)"};cursor:pointer;transition:all 0.15s;display:flex;justify-content:space-between;align-items:center">
          <span>${escapeHtml(name)}</span>
          ${active ? '<span style="font-size:10px">✦ 使用中</span>' : ""}
        </div>`;
      }).join("")}
    </div>
  `;

  // Add click handlers for model switching
  card.querySelectorAll(".model-item").forEach((item) => {
    item.addEventListener("click", () => {
      const modelName = item.dataset.model;
      if (modelName === currentModel) return;
      switchModel(modelName);
    });
  });
}

async function switchModel(modelName) {
  const prevModel = currentModel;
  currentModel = modelName;
  chrome.storage.local.set({ selectedModel: currentModel });

  // Sync config panel select
  const sel = document.getElementById("config-model");
  if (sel) sel.value = modelName;

  // Re-render immediately for snappy UI
  renderModelsCard();
  showToast(`切換模型中: ${modelName}…`);
  debugLog("CFG", `Model switching to: ${modelName}`);

  // If there's an active session, switch via SDK RPC
  if (currentSessionId && isConnected()) {
    try {
      const res = await sendToBackground({ type: "SWITCH_MODEL", sessionId: currentSessionId, modelId: modelName });
      if (res && res.ok) {
        showToast(`已切換模型: ${modelName}`);
        debugLog("CFG", `Model switched successfully: ${res.modelId || modelName}`);
      } else {
        showToast(`模型切換失敗: ${res?.error || "unknown"}`, "error");
        debugLog("ERR", `Model switch failed:`, res);
        // Revert on failure
        currentModel = prevModel;
        chrome.storage.local.set({ selectedModel: prevModel });
        if (sel) sel.value = prevModel;
        renderModelsCard();
      }
    } catch (err) {
      showToast(`模型切換失敗: ${err.message}`, "error");
      debugLog("ERR", `Model switch error:`, err);
      currentModel = prevModel;
      chrome.storage.local.set({ selectedModel: prevModel });
      if (sel) sel.value = prevModel;
      renderModelsCard();
    }
  } else {
    // No active session — just store preference for next session
    showToast(`已選定模型: ${modelName}（下次交談使用）`);
  }
}

// ── Quota from CLI ──
let quotaData = null;

async function loadQuotaFromCli() {
  if (!isConnected()) return;

  try {
    const quota = await sendToBackground({ type: "GET_QUOTA" });
    debugLog("QUOTA", "GET_QUOTA response:", quota);

    if (quota && typeof quota === "object" && Object.keys(quota).length > 0) {
      quotaData = quota;
      renderQuotaCard();
    }
  } catch (err) {
    debugLog("ERR", "loadQuotaFromCli error:", err.message);
  }
}

function renderQuotaCard() {
  if (!quotaData || Object.keys(quotaData).length === 0) return;

  let card = document.getElementById("quota-card");
  const scrollEl = document.querySelector("#panel-usage .panel-scroll");
  if (!scrollEl) return;

  if (!card) {
    card = document.createElement("div");
    card.id = "quota-card";
    card.className = "glass-card";
    // Insert after the first card (使用統計)
    const firstCard = scrollEl.querySelector(".glass-card");
    if (firstCard && firstCard.nextSibling) {
      scrollEl.insertBefore(card, firstCard.nextSibling);
    } else {
      scrollEl.appendChild(card);
    }
  }

  let html = '<div class="card-header"><span class="card-icon">📦</span><h3>Quota 額度</h3></div>';
  html += '<div class="token-detail-grid">';

  for (const [type, snap] of Object.entries(quotaData)) {
    const used = snap.usedRequests || 0;
    const total = snap.entitlementRequests || 0;
    const remaining = snap.remainingPercentage ?? 100;
    const overage = snap.overage || 0;
    const resetDate = snap.resetDate ? new Date(snap.resetDate).toLocaleDateString("zh-TW") : "—";

    const barColor = remaining > 50 ? "var(--success)" : remaining > 20 ? "#f59e0b" : "var(--error)";

    html += `<div style="padding:8px;background:var(--bg-primary);border-radius:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:12px;font-weight:600;color:var(--text-primary);text-transform:capitalize">${escapeHtml(type.replace(/_/g, " "))}</span>
        <span style="font-size:11px;color:var(--text-muted)">${used} / ${total}</span>
      </div>
      <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100 - remaining, 100)}%;background:${barColor};border-radius:3px;transition:width 0.3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span style="font-size:10px;color:var(--text-muted)">剩餘 ${remaining.toFixed(0)}%</span>
        <span style="font-size:10px;color:var(--text-muted)">重置: ${resetDate}</span>
      </div>
      ${overage > 0 ? `<span style="font-size:10px;color:var(--error)">超額: ${overage}</span>` : ""}
    </div>`;
  }

  html += '</div>';
  html += '<p class="text-muted" style="font-size:10px;margin-top:8px">從 Copilot CLI 取得</p>';
  card.innerHTML = html;
}

// ── MCP Panel (reads real config from ~/.copilot/mcp-config.json via proxy) ──
let mcpConfigData = null;

function initMcpPanel() {
  const refreshBtn = document.getElementById("btn-refresh-mcp");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadMcpConfig());
  }
  // Auto-load on panel init
  loadMcpConfig();
}

async function loadMcpConfig() {
  const listEl = document.getElementById("mcp-server-list");
  const sourceEl = document.getElementById("mcp-source-label");
  if (!listEl) return;

  listEl.innerHTML = '<div class="mcp-loading"><span class="task-spinner"></span> 載入中…</div>';

  try {
    const res = await sendToBackground({ type: "GET_MCP_CONFIG" });
    debugLog("MCP", "getMcpConfig response:", res);

    if (res && res.ok && res.config) {
      mcpConfigData = res.config;
      const source = res.source || "~/.copilot/mcp-config.json";
      if (sourceEl) sourceEl.textContent = `來源: ${source.replace(/^\/Users\/[^/]+/, "~")}`;
      renderMcpServers();
    } else {
      listEl.innerHTML = '<div class="mcp-empty">無法載入 MCP 設定</div>';
      if (sourceEl) sourceEl.textContent = res?.error || "載入失敗";
    }
  } catch (err) {
    debugLog("ERR", "loadMcpConfig error:", err.message);
    listEl.innerHTML = `<div class="mcp-empty">讀取失敗: ${escapeHtml(err.message)}</div>`;
  }
}

function getMcpServerIcon(name, config) {
  const n = name.toLowerCase();
  if (n.includes("playwright")) return "🎭";
  if (n.includes("github")) return "🐙";
  if (n.includes("azure")) return "☁️";
  if (n.includes("context7") || n.includes("upstash")) return "📚";
  if (n.includes("microsoft") || n.includes("docs")) return "📖";
  if (n.includes("foundry")) return "🤖";
  if (config?.type === "http") return "🌐";
  return "⚡";
}

function getMcpServerUrl(config) {
  if (config?.url) return config.url;
  if (config?.command && config?.args) {
    // Extract package name from args for npx commands
    const pkg = config.args.find((a) => a.startsWith("@") || (!a.startsWith("-") && a !== "server" && a !== "start"));
    if (pkg) return `${config.command} ${pkg}`;
    return `${config.command} ${config.args.join(" ")}`;
  }
  if (config?.command) return config.command;
  return "";
}

function renderMcpServers() {
  const listEl = document.getElementById("mcp-server-list");
  if (!listEl || !mcpConfigData) return;

  const servers = mcpConfigData.mcpServers || {};
  const entries = Object.entries(servers);

  if (entries.length === 0) {
    listEl.innerHTML = '<div class="mcp-empty">尚無 MCP 伺服器設定</div>';
    return;
  }

  const items = entries.map(([name, config]) => {
    const icon = getMcpServerIcon(name, config);
    const url = getMcpServerUrl(config);
    const type = config?.type || "local";
    const typeBadge = type === "http"
      ? '<span class="mcp-badge mcp-badge-http">HTTP</span>'
      : '<span class="mcp-badge mcp-badge-local">Local</span>';

    const toolsCount = Array.isArray(config?.tools)
      ? (config.tools.includes("*") ? "all" : config.tools.length)
      : "—";

    const hasEnv = config?.env && Object.keys(config.env).length > 0;
    const envKeys = hasEnv ? Object.keys(config.env) : [];

    return `
      <div class="mcp-item" data-mcp-name="${escapeHtml(name)}">
        <div class="mcp-item-icon">${icon}</div>
        <div class="mcp-info">
          <span class="mcp-name">${escapeHtml(name)}</span>
          <span class="mcp-url">${escapeHtml(url)}</span>
        </div>
        <div class="mcp-meta">
          ${typeBadge}
          <span class="mcp-tools-count" title="Tools: ${toolsCount}">🔧 ${toolsCount}</span>
        </div>
      </div>
      <div class="mcp-detail" id="mcp-detail-${escapeHtml(name)}" style="display:none">
        <div class="mcp-detail-row"><span class="mcp-detail-label">Type</span><span>${type}</span></div>
        ${config?.command ? `<div class="mcp-detail-row"><span class="mcp-detail-label">Command</span><code>${escapeHtml(config.command)} ${escapeHtml((config.args || []).join(" "))}</code></div>` : ""}
        ${config?.url ? `<div class="mcp-detail-row"><span class="mcp-detail-label">URL</span><code>${escapeHtml(config.url)}</code></div>` : ""}
        ${hasEnv ? `<div class="mcp-detail-row"><span class="mcp-detail-label">Env</span><span>${envKeys.map((k) => `<code>${escapeHtml(k)}</code>`).join(", ")}</span></div>` : ""}
      </div>`;
  });

  listEl.innerHTML = items.join("");

  // Toggle detail on click
  listEl.querySelectorAll(".mcp-item").forEach((el) => {
    el.addEventListener("click", () => {
      const name = el.dataset.mcpName;
      const detail = document.getElementById(`mcp-detail-${name}`);
      if (detail) {
        const isOpen = detail.style.display !== "none";
        detail.style.display = isOpen ? "none" : "block";
        el.classList.toggle("expanded", !isOpen);
      }
    });
  });
}

// Also render session MCP servers if available from CLI session
function renderSessionMcpServers() {
  let card = document.getElementById("session-mcp-card");
  const scrollEl = document.querySelector("#panel-mcp .panel-scroll");
  if (!scrollEl) return;

  if (!isConnected() || !sessionData?.mcpServers) {
    if (card) card.remove();
    return;
  }

  if (!card) {
    card = document.createElement("div");
    card.id = "session-mcp-card";
    card.className = "glass-card";
    scrollEl.appendChild(card);
  }

  const servers = sessionData.mcpServers;
  const items = (Array.isArray(servers) ? servers : Object.entries(servers)).map((s) => {
    const name = Array.isArray(s) ? s[0] : (s.name || s.id || "MCP Server");
    const url = Array.isArray(s) ? (s[1]?.url || "") : (s.url || "");
    return `<div class="mcp-item"><div class="mcp-item-icon">🔗</div><div class="mcp-info"><span class="mcp-name">${escapeHtml(String(name))}</span>${url ? `<span class="mcp-url">${escapeHtml(String(url))}</span>` : ""}</div><span class="mcp-badge mcp-badge-local">CLI</span></div>`;
  });

  card.innerHTML = `
    <div class="card-header"><span class="card-icon">🔗</span><h3>Session MCP Servers</h3></div>
    <div class="mcp-list">${items.join("")}</div>
  `;
}

// ── Tasks Panel (Copilot CLI Parallel Tasks) ──
let taskStartTime = null;
let taskTimerInterval = null;
let subAgents = []; // { id, name, status, startTime, endTime, toolCalls: [] }

function getTaskElapsed() {
  if (!taskStartTime) return 0;
  return (Date.now() - taskStartTime) / 1000;
}

function startTaskTimer() {
  if (taskTimerInterval) return;
  taskStartTime = Date.now();
  taskTimerInterval = setInterval(() => {
    const el = document.getElementById("tasks-elapsed");
    if (el) el.textContent = `⏱ ${getTaskElapsed().toFixed(1)}s`;
  }, 100);
}

function stopTaskTimer() {
  if (taskTimerInterval) {
    clearInterval(taskTimerInterval);
    taskTimerInterval = null;
  }
}

function renderTasksList() {
  const list = document.getElementById("parallel-task-list");
  const emptyEl = document.getElementById("parallel-tasks-empty");
  const counterEl = document.getElementById("tasks-counter");
  const fillEl = document.getElementById("tasks-progress-fill");
  const runningEl = document.getElementById("tasks-running");
  const doneEl = document.getElementById("tasks-done");

  if (!list) return;

  const total = toolCalls.length;
  const running = toolCalls.filter((t) => t.status === "running").length;
  const done = toolCalls.filter((t) => t.status !== "running").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Update summary
  if (counterEl) counterEl.textContent = `${done} / ${total}`;
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (runningEl) runningEl.textContent = `🔄 ${running} running`;
  if (doneEl) doneEl.textContent = `✅ ${done} done`;

  // Show/hide empty state
  if (emptyEl) emptyEl.style.display = total === 0 ? "" : "none";

  // Build parallel task items
  const existing = list.querySelectorAll(".parallel-task-item");
  existing.forEach((el) => el.remove());

  if (total === 0) return;

  // Group tasks: show running first, then completed (most recent first)
  const sorted = [...toolCalls]
    .map((tc, i) => ({ ...tc, _idx: i }))
    .sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return b._idx - a._idx;
    });

  const toolIcons = {
    bash: "💻", edit: "✏️", grep: "🔍", view: "📄", create: "📝",
    read: "📄", write: "✏️", search: "🔍", run: "💻", execute: "💻",
    list: "📋", delete: "🗑️", move: "📦", copy: "📋",
    mcp_: "🔌", semantic_search: "🔍", file_search: "📂",
    replace_string_in_file: "✏️", read_file: "📄", create_file: "📝",
    run_in_terminal: "💻", grep_search: "🔍", list_dir: "📂",
  };

  function getToolIcon(name) {
    const lower = (name || "").toLowerCase();
    for (const [key, icon] of Object.entries(toolIcons)) {
      if (lower.includes(key)) return icon;
    }
    return "🔧";
  }

  for (const tc of sorted) {
    const item = document.createElement("div");
    item.className = "parallel-task-item";
    item.dataset.index = tc._idx;

    const isRunning = tc.status === "running";
    const isError = tc.status === "error";
    const statusClass = isRunning ? "running" : isError ? "error" : "success";

    const elapsed = tc.startedAt
      ? ((tc.endedAt || Date.now()) - tc.startedAt) / 1000
      : 0;
    const elapsedStr = elapsed > 0 ? elapsed.toFixed(1) + "s" : "";

    const icon = getToolIcon(tc.name);
    const shortName = (tc.name || "tool").replace(/^mcp_[a-z_]+_/, "");

    item.innerHTML = `
      <div class="parallel-task-header ${statusClass}">
        <span class="parallel-task-icon">${icon}</span>
        <span class="parallel-task-name">${escapeHtml(shortName)}</span>
        <span class="parallel-task-time">${elapsedStr}</span>
        <span class="parallel-task-status ${statusClass}">
          ${isRunning ? '<span class="task-spinner"></span>' : isError ? "✕" : "✓"}
        </span>
      </div>
      ${isRunning ? '<div class="parallel-task-progress"><div class="parallel-task-progress-bar running"></div></div>' : ""}
    `;

    // Click to expand args/result
    item.addEventListener("click", () => {
      item.classList.toggle("expanded");
      let detail = item.querySelector(".parallel-task-detail");
      if (!detail) {
        detail = document.createElement("div");
        detail.className = "parallel-task-detail";
        const argsStr = typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args, null, 2);
        const resultStr = tc.result != null ? (typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2)) : "—";
        detail.innerHTML = `
          <div class="task-detail-section">
            <label>Args</label>
            <pre>${escapeHtml(argsStr || "—")}</pre>
          </div>
          <div class="task-detail-section">
            <label>Result</label>
            <pre>${escapeHtml(resultStr).slice(0, 500)}${resultStr.length > 500 ? "\n…" : ""}</pre>
          </div>
        `;
        item.appendChild(detail);
      }
    });

    list.appendChild(item);
  }

  // Render sub-agents if any
  for (const agent of subAgents) {
    const agentEl = document.createElement("div");
    agentEl.className = `parallel-task-item subagent ${agent.status}`;
    const elapsed = agent.startTime
      ? ((agent.endTime || Date.now()) - agent.startTime) / 1000
      : 0;
    agentEl.innerHTML = `
      <div class="parallel-task-header ${agent.status}">
        <span class="parallel-task-icon">🤖</span>
        <span class="parallel-task-name">Sub-Agent: ${escapeHtml(agent.name || agent.id)}</span>
        <span class="parallel-task-time">${elapsed.toFixed(1)}s</span>
        <span class="parallel-task-status ${agent.status}">
          ${agent.status === "running" ? '<span class="task-spinner"></span>' : agent.status === "error" ? "✕" : "✓"}
        </span>
      </div>
      ${agent.status === "running" ? '<div class="parallel-task-progress"><div class="parallel-task-progress-bar running"></div></div>' : ""}
    `;
    list.appendChild(agentEl);
  }

  renderTasksTimeline();
}

function renderTasksTimeline() {
  const timeline = document.getElementById("tasks-timeline");
  if (!timeline || toolCalls.length === 0) return;

  const baseTime = taskStartTime || (toolCalls[0]?.startedAt || Date.now());

  const events = toolCalls.map((tc, i) => {
    const offset = tc.startedAt ? ((tc.startedAt - baseTime) / 1000).toFixed(1) : "0.0";
    const elapsed = tc.startedAt && tc.endedAt
      ? ((tc.endedAt - tc.startedAt) / 1000).toFixed(1)
      : tc.status === "running" ? "…" : "—";
    const icon = tc.status === "running" ? "🔄" : tc.status === "error" ? "❌" : "✅";
    return { offset, elapsed, icon, name: tc.name, status: tc.status, _idx: i };
  });

  // Add sub-agent events
  for (const agent of subAgents) {
    const offset = agent.startTime ? ((agent.startTime - baseTime) / 1000).toFixed(1) : "0.0";
    const elapsed = agent.startTime && agent.endTime
      ? ((agent.endTime - agent.startTime) / 1000).toFixed(1)
      : agent.status === "running" ? "…" : "—";
    const icon = agent.status === "running" ? "🤖" : "✅";
    events.push({ offset, elapsed, icon, name: `Sub-Agent: ${agent.name || agent.id}`, status: agent.status });
  }

  timeline.innerHTML = events
    .map((e) => `
      <div class="timeline-event ${e.status}">
        <span class="timeline-time">${e.offset}s</span>
        <div class="timeline-dot ${e.status}"></div>
        <div class="timeline-content">
          <span class="timeline-icon">${e.icon}</span>
          <span class="timeline-name">${escapeHtml(e.name)}</span>
          <span class="timeline-duration">${e.elapsed}s</span>
        </div>
      </div>
    `).join("");
}

document.getElementById("btn-clear-tasks")?.addEventListener("click", () => {
  toolCalls.length = 0;
  subAgents.length = 0;
  stopTaskTimer();
  taskStartTime = null;
  const elapsed = document.getElementById("tasks-elapsed");
  if (elapsed) elapsed.textContent = "⏱ 0.0s";
  renderTasksList();
  const timeline = document.getElementById("tasks-timeline");
  if (timeline) timeline.innerHTML = '<div class="empty-state"><span class="empty-icon">📊</span><p>No events yet</p></div>';
});

// ── Skills Panel ──
let cachedSkills = []; // cache tools fetched from CLI

// Tool name → icon mapping
const TOOL_ICONS = {
  bash: "💻", shell: "💻", terminal: "💻",
  grep: "🔍", search: "🔍", find: "🔍",
  edit: "✏️", str_replace_editor: "✏️", write: "✏️",
  read: "📄", view: "📄", cat: "📄", read_file: "📄",
  create: "📝", create_file: "📝", touch: "📝",
  browser: "🌐", fetch: "🌐", web: "🌐", navigate: "🌐",
  image: "🖼️", vision: "🖼️", screenshot: "🖼️",
  pdf: "📄",
  translate: "🌐",
  summarize: "📝", summary: "📝",
  code: "💻", analyze: "💻",
  list_dir: "📁", ls: "📁", directory: "📁",
  git: "🔀",
  ask_user: "❓",
  default: "🔧",
};

function getToolIcon(name) {
  const lower = (name || "").toLowerCase();
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (key !== "default" && lower.includes(key)) return icon;
  }
  return TOOL_ICONS.default;
}

async function loadSkillsFromCli() {
  const grid = document.getElementById("skills-grid");
  const label = document.getElementById("skills-source-label");
  const empty = document.getElementById("skills-empty");

  if (!isConnected()) {
    if (grid) grid.innerHTML = '<div class="empty-state" id="skills-empty"><span class="empty-icon">⏳</span><p>連接 Copilot CLI 後自動載入 Skills</p></div>';
    if (label) label.textContent = "未連接";
    return;
  }

  if (label) label.textContent = "正在載入...";

  try {
    const tools = await sendToBackground({ type: "LIST_TOOLS", model: currentModel });
    debugLog("SKILL", `Loaded ${Array.isArray(tools) ? tools.length : 0} tools from CLI`);

    if (!Array.isArray(tools) || tools.length === 0) {
      if (grid) grid.innerHTML = '<div class="empty-state"><span class="empty-icon">🔧</span><p>CLI 未回傳任何 Skills</p></div>';
      if (label) label.textContent = "從 Copilot CLI 載入 · 0 items";
      cachedSkills = [];
      return;
    }

    cachedSkills = tools;
    renderSkillsGrid(tools);
    if (label) label.textContent = `從 Copilot CLI 載入 · ${tools.length} items`;
  } catch (err) {
    debugLog("ERR", "loadSkillsFromCli error:", err.message);
    if (grid) grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>載入失敗: ${escapeHtml(err.message)}</p></div>`;
    if (label) label.textContent = "載入失敗";
  }
}

function renderSkillsGrid(tools) {
  const grid = document.getElementById("skills-grid");
  if (!grid) return;

  // Group tools by namespace (e.g., "playwright/navigate" → "playwright")
  const grouped = {};
  const ungrouped = [];

  for (const tool of tools) {
    const ns = tool.namespacedName;
    if (ns && ns.includes("/")) {
      const prefix = ns.split("/")[0];
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push(tool);
    } else {
      ungrouped.push(tool);
    }
  }

  let html = "";

  // Render ungrouped tools (built-in)
  for (const tool of ungrouped) {
    html += renderSkillCard(tool);
  }

  // Render grouped tools (MCP namespaces etc.)
  for (const [ns, nsTools] of Object.entries(grouped)) {
    html += `<div class="skill-group" style="grid-column:1/-1;margin-top:8px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;padding:0 4px;text-transform:uppercase;letter-spacing:0.5px">🔌 ${escapeHtml(ns)} (${nsTools.length})</div>
    </div>`;
    for (const tool of nsTools) {
      html += renderSkillCard(tool);
    }
  }

  grid.innerHTML = html;

  // Add click handlers for description tooltips
  grid.querySelectorAll(".skill-card").forEach((card) => {
    card.addEventListener("click", () => {
      card.classList.toggle("expanded");
    });
  });
}

function renderSkillCard(tool) {
  const name = tool.name || "unknown";
  const icon = getToolIcon(name);
  const desc = tool.description || "";
  const shortDesc = desc.length > 60 ? desc.slice(0, 57) + "..." : desc;

  return `<div class="skill-card" title="${escapeHtml(desc)}" data-tool-name="${escapeHtml(name)}">
    <span class="skill-icon">${icon}</span>
    <span class="skill-name">${escapeHtml(name)}</span>
    <span class="skill-status active">啟用</span>
    ${shortDesc ? `<span class="skill-desc" style="font-size:10px;color:var(--text-muted);grid-column:1/-1;padding:0 8px 6px;display:none">${escapeHtml(shortDesc)}</span>` : ""}
  </div>`;
}

// Refresh button
document.getElementById("btn-refresh-skills")?.addEventListener("click", () => {
  loadSkillsFromCli();
  showToast("Skills 重新載入中...");
});

// No tab listeners needed — context comes from CLI, not browser tabs

// ── Init ──
async function init() {
  showWelcome();
  updateStats();
  loadCliConfig();
  checkConnection();
  initMcpPanel();
  updateAgentBadges();

  // Load persisted model
  chrome.storage.local.get("selectedModel", (data) => {
    if (data.selectedModel) currentModel = data.selectedModel;
  });
}

init();
