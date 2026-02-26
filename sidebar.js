// ===== IQ Copilot Sidebar v3.0.0 =====

// ── State ──
let connectionState = "disconnected"; // disconnected | connecting | connected
let currentSessionId = null;
let currentModel = "gpt-4.1";
let chatHistory = [];
let stats = { messages: 0, tokens: 0, sessions: 0, pages: 0 };
let currentTitle = "", currentUrl = "", currentType = "webpage";
let availableModels = [];
let toolCalls = [];
let sessionData = null;

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
  try {
    const res = await sendToBackground({ type: "CHECK_CONNECTION" });
    if (res) {
      updateConnectionUI(res.state || (res.connected ? "connected" : "disconnected"));
      if (res.connected || res.state === "connected") {
        await onConnected();
      }
    }
  } catch {
    updateConnectionUI("disconnected");
  }
}

async function onConnected() {
  try {
    const modelsRes = await sendToBackground({ type: "LIST_MODELS" });
    if (Array.isArray(modelsRes)) {
      availableModels = modelsRes;
      populateModelSelect(modelsRes);
    }
  } catch { /* ignore */ }

  try {
    await loadHistorySessions();
  } catch { /* ignore */ }
}

// Listen for connection state changes from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CONNECTION_STATE_CHANGED") {
    updateConnectionUI(msg.state);
    if (msg.state === "connected") onConnected();
  }
});

document.getElementById("btn-connection-settings")?.addEventListener("click", () => {
  switchPanel("config");
});

// ── Config Panel ──
async function loadCliConfig() {
  try {
    const res = await sendToBackground({ type: "GET_CLI_CONFIG" });
    if (res) {
      const hostEl = document.getElementById("config-host");
      const portEl = document.getElementById("config-port");
      if (hostEl && res.host) hostEl.value = res.host;
      if (portEl && res.port) portEl.value = res.port;
      if (res.state) updateConnectionUI(res.state);
    }
  } catch { /* ignore */ }
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
  updateConnectionUI("connecting");
  try {
    const res = await sendToBackground({ type: "SET_CLI_CONFIG", host, port });
    if (res && (res.connected || res.state === "connected")) {
      updateConnectionUI("connected");
      showToast("已連接 Copilot CLI");
      await onConnected();
    } else {
      updateConnectionUI("disconnected");
      showToast("連線失敗");
    }
  } catch (err) {
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

  // Track in toolCalls
  const entry = { name, status: "running", timestamp: new Date().toISOString(), args, result: null };
  toolCalls.push(entry);
  card.dataset.toolIndex = toolCalls.length - 1;
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
    renderTasksList();
  }
}

// ── Streaming Chat ──
async function ensureSession() {
  if (currentSessionId) return currentSessionId;
  try {
    const config = {};
    const sysVal = document.getElementById("config-system-message")?.value;
    if (sysVal) config.systemMessage = sysVal;
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

async function sendMessageStreaming(text) {
  const sid = await ensureSession();
  if (!sid) {
    fallbackSend(text);
    return;
  }

  showTyping();
  let bubble = null;
  let content = "";
  let currentToolCard = null;
  let streamDone = false;

  try {
    const port = chrome.runtime.connect({ name: "copilot-stream" });

    port.onMessage.addListener((msg) => {
      if (msg.type === "STREAM_EVENT") {
        removeTyping();
        if (!bubble) {
          bubble = createStreamingBotMessage();
        }

        // Text content delta
        if (msg.data?.content) {
          content += msg.data.content;
          bubble.innerHTML = formatText(content);
          scrollToBottom();
        }

        // Tool call start
        if (msg.data?.tool?.call) {
          const tc = msg.data.tool.call;
          currentToolCard = createToolCallCard(tc.name || tc.tool || "tool", tc.args || tc.arguments || "");
          if (currentToolCard) {
            bubble.parentElement.appendChild(currentToolCard);
            scrollToBottom();
          }
        }

        // Tool result
        if (msg.data?.tool?.result != null) {
          updateToolCallCard(currentToolCard, "success", msg.data.tool.result);
          currentToolCard = null;
        }

        // Token counting
        if (msg.data?.usage?.totalTokens) {
          stats.tokens = msg.data.usage.totalTokens;
        } else if (msg.data?.content) {
          stats.tokens += msg.data.content.length;
        }
        updateStats();
      }

      if (msg.type === "STREAM_DONE") {
        streamDone = true;
        removeTyping();
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

    port.postMessage({ type: "STREAM_SEND", sessionId: sid, prompt: text });
  } catch {
    // Streaming not available — fallback
    removeTyping();
    fallbackSend(text);
  }
}

async function fallbackSend(text) {
  showTyping();
  try {
    const sid = currentSessionId || (await ensureSession());
    if (!sid) {
      removeTyping();
      addBotMessage("⚠ 無法建立 Session");
      return;
    }
    const res = await sendToBackground({ type: "SEND_AND_WAIT", sessionId: sid, prompt: text });
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
  if (!text) return;

  chatInput.value = "";
  chatInput.style.height = "auto";
  addUserMessage(text);

  if (isConnected()) {
    await sendMessageStreaming(text);
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

// ── Context Panel ──
async function fetchPageInfo() {
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

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });
      if (response) {
        currentTitle = response.title || currentTitle;
        currentUrl = response.url || currentUrl;
        if (response.isPdf) currentType = "PDF 文件";
        if (response.meta) renderMeta(response.meta);
      }
    } catch { /* content script may not be available */ }

    updateContextUI();
    updateContextBar();
  } catch (err) {
    console.error("fetchPageInfo error:", err);
  }
}

function updateContextUI() {
  const titleEl = document.getElementById("ctx-title");
  const urlEl = document.getElementById("ctx-url");
  const typeEl = document.getElementById("ctx-type");
  if (titleEl) titleEl.textContent = currentTitle || "—";
  if (urlEl) urlEl.textContent = currentUrl || "—";
  if (typeEl) typeEl.textContent = currentType;

  // Session context card (when connected)
  renderSessionContext();
}

function updateContextBar() {
  const bar = document.getElementById("context-bar-text");
  if (bar) {
    const hostname = currentUrl ? new URL(currentUrl).hostname : "";
    bar.textContent = currentTitle || hostname;
  }
  const badge = document.querySelector(".context-badge");
  if (badge) badge.textContent = currentType === "PDF 文件" ? "📕" : "📄";
}

function renderMeta(meta) {
  const container = document.getElementById("ctx-meta");
  if (!container || !meta || Object.keys(meta).length === 0) {
    if (container) container.innerHTML = '<p class="text-muted">無 meta 資訊</p>';
    return;
  }
  container.innerHTML = Object.entries(meta)
    .map(([k, v]) => `<div class="meta-item"><span class="meta-key">${escapeHtml(k)}</span><span class="meta-val" title="${escapeHtml(v)}">${escapeHtml(v)}</span></div>`)
    .join("");
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

// Context copy buttons
document.getElementById("ctx-copy-url")?.addEventListener("click", async () => {
  await navigator.clipboard.writeText(currentUrl);
  showToast("已複製網址");
});
document.getElementById("ctx-copy-title")?.addEventListener("click", async () => {
  await navigator.clipboard.writeText(currentTitle);
  showToast("已複製標題");
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
function updateStats() {
  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };
  el("stat-messages", stats.messages);
  el("stat-tokens", stats.tokens > 1000 ? (stats.tokens / 1000).toFixed(1) + "k" : stats.tokens);
  el("stat-sessions", stats.sessions);
  el("stat-pages", stats.pages);

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
    <div style="display:flex;flex-direction:column;gap:4px">
      ${availableModels.map((m) => {
        const name = typeof m === "string" ? m : m.name || m.id || String(m);
        const active = name === currentModel;
        return `<div style="padding:6px 8px;background:var(--bg-primary);border-radius:6px;font-size:12px;border:1px solid ${active ? "var(--accent-start)" : "var(--border)"};color:${active ? "#c4b5fd" : "var(--text-secondary)"}">${escapeHtml(name)}${active ? " ✦" : ""}</div>`;
      }).join("")}
    </div>
  `;
}

// ── MCP Panel ──
function initMcpPanel() {
  const addBtn = document.querySelector("#panel-mcp .action-btn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      showToast("請在 Config 頁面上傳 MCP 設定");
    });
  }
}

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
    return `<div class="mcp-item"><div class="mcp-status-dot connected"></div><div class="mcp-info"><span class="mcp-name">${escapeHtml(String(name))}</span>${url ? `<span class="mcp-url">${escapeHtml(String(url))}</span>` : ""}</div><span class="mcp-badge connected">CLI</span></div>`;
  });

  card.innerHTML = `
    <div class="card-header"><span class="card-icon">🔗</span><h3>Session MCP Servers</h3></div>
    <div class="mcp-list">${items.join("")}</div>
  `;
}

// ── Tasks Panel ──
function renderTasksList() {
  const list = document.getElementById("task-list");
  if (!list) return;

  // Preserve manual tasks — only update tool-call items
  let manualTasks = list.querySelectorAll(".task-item:not(.tool-call-task)");

  // Build tool-call tasks
  const toolTasksHtml = toolCalls.map((tc, i) => {
    const statusClass = tc.status === "success" ? "success" : tc.status === "error" ? "error" : "running";
    const statusIcon = tc.status === "success" ? "✅" : tc.status === "error" ? "❌" : "⏳";
    const time = tc.timestamp ? new Date(tc.timestamp).toLocaleTimeString() : "";
    return `<div class="task-item tool-call-task" data-index="${i}">
      <span style="flex-shrink:0">${statusIcon}</span>
      <div style="flex:1;min-width:0">
        <div class="task-text" style="font-family:var(--font-mono);font-size:12px">${escapeHtml(tc.name)}</div>
        <div style="font-size:10px;color:var(--text-muted)">${escapeHtml(time)} · ${statusClass}</div>
      </div>
    </div>`;
  }).join("");

  // Remove old tool-call tasks
  list.querySelectorAll(".tool-call-task").forEach((el) => el.remove());

  // Remove empty state if we have items
  if (toolCalls.length > 0 || manualTasks.length > 0) {
    const empty = list.querySelector(".empty-state");
    if (empty) empty.remove();
  }

  // Append tool tasks
  if (toolTasksHtml) {
    list.insertAdjacentHTML("beforeend", toolTasksHtml);
  }
}

document.getElementById("btn-add-task")?.addEventListener("click", () => {
  const text = prompt("輸入新任務：");
  if (!text) return;
  addTask(text);
});

function addTask(text) {
  const list = document.getElementById("task-list");
  const empty = list?.querySelector(".empty-state");
  if (empty) empty.remove();
  if (!list) return;

  const item = document.createElement("div");
  item.className = "task-item";

  const checkbox = document.createElement("button");
  checkbox.className = "task-checkbox";
  checkbox.textContent = "✓";
  checkbox.addEventListener("click", () => {
    checkbox.classList.toggle("done");
    taskText.classList.toggle("done");
  });

  const taskText = document.createElement("span");
  taskText.className = "task-text";
  taskText.textContent = text;

  item.appendChild(checkbox);
  item.appendChild(taskText);
  list.appendChild(item);
}

// ── Skills Panel ──
function renderCliSkills() {
  const scrollEl = document.querySelector("#panel-skills .panel-scroll, #panel-skills .skills-grid");
  if (!scrollEl) return;

  // Add "從 CLI 載入" badge to existing cards when connected
  document.querySelectorAll(".skill-card").forEach((card) => {
    let badge = card.querySelector(".cli-badge");
    if (isConnected()) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "cli-badge";
        badge.style.cssText = "font-size:9px;padding:1px 6px;border-radius:8px;background:rgba(34,197,94,0.15);color:var(--success);margin-top:2px";
        badge.textContent = "從 CLI 載入";
        card.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  });

  // Show session tools as additional skills
  let cliCard = document.getElementById("cli-skills-card");
  const parent = scrollEl.closest(".panel-scroll") || scrollEl.parentElement;
  if (!parent) return;

  if (!isConnected() || !sessionData?.tools) {
    if (cliCard) cliCard.remove();
    return;
  }

  if (!cliCard) {
    cliCard = document.createElement("div");
    cliCard.id = "cli-skills-card";
    cliCard.className = "glass-card";
    cliCard.style.margin = "14px";
    parent.appendChild(cliCard);
  }

  const tools = sessionData.tools;
  cliCard.innerHTML = `
    <div class="card-header"><span class="card-icon">⚡</span><h3>CLI Tools</h3></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${tools.map((t) => {
        const name = typeof t === "string" ? t : t.name || String(t);
        return `<span style="font-size:11px;padding:4px 10px;border-radius:8px;background:var(--bg-primary);border:1px solid var(--border);color:var(--text-secondary)">${escapeHtml(name)}</span>`;
      }).join("")}
    </div>
  `;
}

// ── Tab Listeners ──
chrome.tabs.onActivated.addListener(fetchPageInfo);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") fetchPageInfo();
});

// ── Init ──
async function init() {
  fetchPageInfo();
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
