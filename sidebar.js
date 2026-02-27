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
let selectedAgentId = "general";
let customAgents = [];

const BUILTIN_AGENTS = [
  { id: "general", name: "General Assistant", description: "通用型助手，適合大部分任務", systemPrompt: "" },
  { id: "coder", name: "Code Expert", description: "程式碼分析、除錯、最佳化", systemPrompt: "Focus on software engineering tasks. Prioritize code quality, debugging rigor, and concrete implementation details." },
  { id: "writer", name: "Writer", description: "文章撰寫、摘要、翻譯", systemPrompt: "Focus on writing quality, clarity, translation accuracy, and concise summaries tailored to user intent." },
  { id: "researcher", name: "Researcher", description: "深度研究、資料分析", systemPrompt: "Focus on research workflows: gather context, compare evidence, and present structured conclusions with clear assumptions." },
];
let currentTheme = "dark";
let currentLanguage = "zh-TW";

const I18N = {
  "zh-TW": {
    panelTitles: {
      chat: "IQ Copilot",
      context: "內容",
      agent: "代理",
      history: "歷史",
      usage: "使用量",
      tasks: "任務",
      skills: "技能",
      mcp: "MCP",
      notifications: "通知",
      version: "版本",
      config: "設定",
      achievements: "成就",
    },
    connection: {
      disconnected: "未連接 Copilot CLI",
      connecting: "正在連線...",
      connected: "已連接 Copilot CLI",
    },
    messages: {
      welcome: "你好！我是 **IQ Copilot** ✦\n\n我可以幫你分析當前頁面、摘要內容、翻譯文字等等。有什麼我能幫你的？",
      themeChanged: "已切換主題",
      languageChanged: "語言已切換為繁體中文",
      foundryConfigured: "已設定",
      foundryNotConfigured: "未設定",
      processing: "處理中...",
      browserPage: "瀏覽器頁面",
      webPage: "網頁",
      pdfDoc: "PDF 文件",
    },
  },
  en: {
    panelTitles: {
      chat: "IQ Copilot",
      context: "Context",
      agent: "Agent",
      history: "History",
      usage: "Usage",
      tasks: "Tasks",
      skills: "Skills",
      mcp: "MCP",
      notifications: "Notifications",
      version: "Version",
      config: "Settings",
      achievements: "Achievements",
    },
    connection: {
      disconnected: "Copilot CLI disconnected",
      connecting: "Connecting...",
      connected: "Connected to Copilot CLI",
    },
    messages: {
      welcome: "Hi! I’m **IQ Copilot** ✦\n\nI can help analyze the current page, summarize content, and translate text. What can I help you with?",
      themeChanged: "Theme switched",
      languageChanged: "Language switched to English",
      foundryConfigured: "Configured",
      foundryNotConfigured: "Not configured",
      processing: "Processing...",
      browserPage: "Browser Page",
      webPage: "Web Page",
      pdfDoc: "PDF Document",
    },
  },
};

const STATIC_ZH_EN = {
  "設定": "Settings",
  "主題": "Theme",
  "外觀與語言": "Appearance & Language",
  "語言": "Language",
  "深色": "Dark",
  "明亮": "Light",
  "繁體中文": "Traditional Chinese",
  "English": "English",
  "來源:": "Source:",
  "未連接": "Disconnected",
  "錯誤": "Error",
  "錯誤: ": "Error: ",
  "已認證": "Authenticated",
  "未認證": "Not authenticated",
  "無可用模型": "No models available",
  "無可用工具": "No tools available",
  "無配額資訊": "No quota information",
  "連線": "Connect",
  "CLI 連線設定": "CLI Connection",
  "Model 選擇": "Model Selection",
  "未連接 Copilot CLI": "Copilot CLI disconnected",
  "已連接": "Connected",
  "已連接 Copilot CLI": "Connected to Copilot CLI",
  "正在連線...": "Connecting...",
  "摘要此頁": "Summarize this page",
  "翻譯此頁": "Translate this page",
  "解釋此頁": "Explain this page",
  "問個問題": "Ask a question",
  "輸入訊息... (Ctrl+Enter 送出)": "Type a message... (Ctrl+Enter to send)",
  "IQ Copilot · 按 <kbd>Enter</kbd> 送出（<kbd>Shift+Enter</kbd> 換行）· 📎 拖放或點擊附加檔案": "IQ Copilot · Press <kbd>Enter</kbd> to send (<kbd>Shift+Enter</kbd> for newline) · 📎 Drag & drop or click to attach files",
  "重新載入": "Refresh",
  "狀態": "Status",
  "版本": "Version",
  "模型": "Models",
  "工具": "Tools",
  "配額": "Quota",
  "認證": "Authentication",
  "使用者": "User",
  "認證方式": "Auth Type",
  "載入中...": "Loading...",
  "使用統計": "Usage Stats",
  "訊息數": "Messages",
  "對話數": "Sessions",
  "分析頁面": "Analyzed Pages",
  "Token 明細": "Token Details",
  "從 Copilot CLI 即時取得": "Live from Copilot CLI",
  "今日活動": "Today Activity",
  "等待 Copilot CLI 任務…": "Waiting for Copilot CLI tasks…",
  "從 Copilot CLI 載入": "Loaded from Copilot CLI",
  "連接 Copilot CLI 後自動載入 Skills": "Skills load automatically after connecting to Copilot CLI",
  "MCP 伺服器": "MCP Servers",
  "從本機設定檔讀取": "Read from local config",
  "載入中…": "Loading…",
  "尚未掃描": "Not scanned yet",
  "每日晨報": "Daily Briefing",
  "需要回覆的信件": "Emails to Reply",
  "今日會議": "Today's Meetings",
  "即將到期待辦": "Upcoming Tasks",
  "尚無晨報資料": "No briefing data",
  "點擊上方刷新按鈕或等待每日自動掃描": "Click refresh above or wait for daily auto-scan",
  "截止日追蹤": "Deadline Tracking",
  "沒有追蹤中的截止日": "No tracked deadlines",
  "未回覆偵測": "Unreplied Detector",
  "沒有需要回覆的信件": "No emails needing reply",
  "會議準備": "Meeting Prep",
  "近期沒有需要準備的會議": "No upcoming meetings to prepare",
  "更新日誌": "Changelog",
  "選填 — 也可透過 .env 設定。API Key 僅存於記憶體，瀏覽器關閉即清除。": "Optional — can also be set via .env. API key is kept in memory only and cleared when browser closes.",
  "儲存": "Save",
  "測試連線": "Test Connection",
  "清除 Key": "Clear Key",
  "輸入自訂 System Message...": "Enter custom system message...",
  "上傳 Agent Config JSON": "Upload Agent Config JSON",
  "上傳 MCP Config JSON": "Upload MCP Config JSON",
  "上傳 Skills Config JSON": "Upload Skills Config JSON",
  "清除": "Clear",
  "搜尋對話紀錄...": "Search conversations...",
  "尚無對話紀錄": "No conversation history",
  "附加檔案": "Attach files",
  "送出": "Send",
  "New Chat": "New Chat",
  "連線失敗": "Connection failed",
  "連線失敗: ": "Connection failed: ",
  "請輸入 Endpoint": "Please enter endpoint",
  "Foundry 設定已儲存": "Foundry settings saved",
  "儲存失敗: ": "Save failed: ",
  "測試連線中...": "Testing connection...",
  "✅ Proxy 連線正常": "✅ Proxy connection OK",
  "⚠ Proxy 未連線": "⚠ Proxy disconnected",
  "API Key 已清除": "API key cleared",
  "清除失敗: ": "Clear failed: ",
  "設定已上傳（模擬）": "Settings uploaded (mock)",
  "等待結果...": "Waiting for result...",
  "Agent 名稱不能為空": "Agent name cannot be empty",
  "輸入 Agent 名稱": "Enter agent name",
  "輸入 Agent 描述": "Enter agent description",
  "自訂 Agent": "Custom Agent",
  "輸入 Agent 系統提示詞": "Enter agent system prompt",
  "已切換至 ": "Switched to ",
  "已新增 Agent: ": "Added Agent: ",
  "預設 Agent 不能刪除": "Default agent cannot be deleted",
  "確定要刪除 Agent「": "Delete agent \"",
  "」嗎？": "\"?",
  "已刪除 Agent: ": "Deleted Agent: ",
  "建立 Session 失敗: ": "Failed to create session: ",
  "Context 重新載入中...": "Refreshing context...",
  "恢復失敗: ": "Resume failed: ",
  "已恢復 Session ": "Resumed session ",
  "已刪除": "Deleted",
  "刪除失敗: ": "Delete failed: ",
  "已切換模型: ": "Model switched: ",
  "已選定模型: ": "Model selected: ",
  "（下次交談使用）": " (used in next chat)",
  "無法載入 MCP 設定": "Unable to load MCP config",
  "尚無 MCP 伺服器設定": "No MCP server configured",
  "讀取失敗: ": "Read failed: ",
  "已格式化 JSON": "JSON formatted",
  "JSON 格式錯誤: ": "Invalid JSON: ",
  "設定必須是 JSON 物件": "Settings must be a JSON object",
  "必須包含 mcpServers 物件": "Must include mcpServers object",
  "MCP 設定已儲存": "MCP settings saved",
  "未知錯誤": "Unknown error",
  "啟用": "Active",
  "Skills 重新載入中...": "Refreshing skills...",
  "CLI 未回傳任何 Skills": "CLI returned no skills",
  "從 Copilot CLI 載入 · ": "Loaded from Copilot CLI · ",
  "載入失敗": "Load failed",
  "正在掃描所有代理...": "Scanning all agents...",
  "請先連接 Copilot CLI": "Please connect to Copilot CLI first",
  "掃描中...": "Scanning...",
  "掃描未取得資料": "Scan returned no data",
  "掃描完成 · 無資料": "Scan complete · no data",
  "掃描失敗: ": "Scan failed: ",
  "Top thing 已更新": "Top action updated",
  "Proactive Prompt 已儲存": "Proactive prompt saved",
  "Proactive Prompt 已清除": "Proactive prompt cleared",
  "✅ 已完成": "✅ Completed",
};

const STATIC_EN_ZH = Object.fromEntries(
  Object.entries(STATIC_ZH_EN).map(([zh, en]) => [en, zh])
);

function t(path, fallback = "") {
  const source = I18N[currentLanguage] || I18N["zh-TW"];
  const value = path.split(".").reduce((acc, key) => acc?.[key], source);
  return value ?? fallback;
}

function replaceByMap(text, map) {
  if (!text || typeof text !== "string") return text;
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  let result = text;
  for (const [from, to] of entries) {
    result = result.split(from).join(to);
  }
  return result;
}

function translateStaticUi() {
  const map = currentLanguage === "en" ? STATIC_ZH_EN : STATIC_EN_ZH;
  const skipRoots = new Set(["chat-messages", "debug-log", "tasks-timeline", "parallel-task-list"]);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (!parent) {
      node = walker.nextNode();
      continue;
    }
    if ([...skipRoots].some((id) => parent.closest(`#${id}`))) {
      node = walker.nextNode();
      continue;
    }
    const replaced = replaceByMap(node.nodeValue, map);
    if (replaced !== node.nodeValue) node.nodeValue = replaced;
    node = walker.nextNode();
  }

  document.querySelectorAll("[title]").forEach((el) => {
    const translated = replaceByMap(el.getAttribute("title"), map);
    if (translated) el.setAttribute("title", translated);
  });

  document.querySelectorAll("[placeholder]").forEach((el) => {
    const translated = replaceByMap(el.getAttribute("placeholder"), map);
    if (translated) el.setAttribute("placeholder", translated);
  });

  const chips = document.querySelectorAll("#chat-suggestions .suggestion-chip");
  if (chips.length >= 4) {
    if (currentLanguage === "en") {
      chips[0].textContent = "📝 Summarize this page";
      chips[1].textContent = "🌐 Translate this page";
      chips[2].textContent = "💡 Explain this page";
      chips[3].textContent = "❓ Ask a question";
    } else {
      chips[0].textContent = "📝 摘要此頁";
      chips[1].textContent = "🌐 翻譯此頁";
      chips[2].textContent = "💡 解釋此頁";
      chips[3].textContent = "❓ 問個問題";
    }
  }

  const intent = document.getElementById("intent-text");
  if (intent && (!intent.textContent || /Processing|處理中/.test(intent.textContent))) {
    intent.textContent = t("messages.processing", "Processing...");
  }

  const panelTitleMap = t("panelTitles", {});
  const activePanel = document.querySelector(".panel.active")?.id?.replace("panel-", "");
  if (activePanel && panelTitle) {
    panelTitle.textContent = panelTitleMap[activePanel] || "IQ Copilot";
  }

  document.documentElement.lang = currentLanguage === "en" ? "en" : "zh-TW";
}

function localizeRuntimeMessage(message) {
  if (currentLanguage !== "en") return message;
  return replaceByMap(message, STATIC_ZH_EN);
}

function applyTheme(theme, persist = true) {
  currentTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  const themeSel = document.getElementById("config-theme");
  if (themeSel) themeSel.value = currentTheme;
  if (persist) chrome.storage.local.set({ uiTheme: currentTheme });
}

function applyLanguage(language, persist = true) {
  currentLanguage = language === "en" ? "en" : "zh-TW";
  const langSel = document.getElementById("config-language");
  if (langSel) langSel.value = currentLanguage;
  translateStaticUi();
  updateConnectionUI(connectionState);
  if (persist) chrome.storage.local.set({ uiLanguage: currentLanguage });
}

function loadUiPreferences() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["uiTheme", "uiLanguage"], (data) => {
      applyTheme(data.uiTheme || "dark", false);
      applyLanguage(data.uiLanguage || "zh-TW", false);
      resolve();
    });
  });
}

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
function getPanelTitles() {
  return t("panelTitles", {});
}

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
  panelTitle.textContent = getPanelTitles()[id] || "IQ Copilot";

  // Track panel view for achievements
  if (typeof AchievementEngine !== "undefined" && AchievementEngine.getProfile) {
    AchievementEngine.track("panel_viewed", { panel: id });
  }
  // Refresh achievement panel when switching to it
  if (id === "achievements") renderAchievementPanel();

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
  toast.textContent = localizeRuntimeMessage(message);
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
    disconnected: t("connection.disconnected", "未連接 Copilot CLI"),
    connecting: t("connection.connecting", "正在連線..."),
    connected: t("connection.connected", "已連接 Copilot CLI"),
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

  // Run initial proactive scan (non-blocking)
  runFullProactiveScan().catch((err) => {
    debugLog("ERR", "Initial proactive scan error:", err.message);
  });

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

  const getModelId = (m) => {
    if (typeof m === "string") return m;
    return m?.id || m?.name || String(m);
  };
  const getModelLabel = (m) => {
    if (typeof m === "string") return m;
    return m?.name || m?.id || String(m);
  };

  const matched = models.find((m) => {
    const id = getModelId(m);
    const label = getModelLabel(m);
    return currentModel === id || currentModel === label;
  });
  if (matched) {
    const normalized = getModelId(matched);
    if (normalized !== currentModel) {
      currentModel = normalized;
      chrome.storage.local.set({ selectedModel: currentModel });
    }
  }

  sel.innerHTML = "";
  models.forEach((m) => {
    const modelId = getModelId(m);
    const modelLabel = getModelLabel(m);
    const opt = document.createElement("option");
    opt.value = modelId;
    opt.textContent = modelLabel;
    if (modelId === currentModel) opt.selected = true;
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

document.getElementById("config-model")?.addEventListener("change", async (e) => {
  const modelId = e.target.value;
  if (!modelId || modelId === currentModel) return;
  await switchModel(modelId);
});

document.getElementById("config-theme")?.addEventListener("change", (e) => {
  applyTheme(e.target.value);
  showToast(t("messages.themeChanged", "Theme switched"));
});

document.getElementById("config-language")?.addEventListener("change", (e) => {
  applyLanguage(e.target.value);
  showToast(t("messages.languageChanged", "Language switched"));
});

// ── Foundry Config ──
async function loadFoundryConfig() {
  try {
    const res = await sendToBackground({ type: "GET_FOUNDRY_CONFIG" });
    const endpointEl = document.getElementById("config-foundry-endpoint");
    const badge = document.getElementById("foundry-status-badge");
    if (endpointEl && res?.endpoint) endpointEl.value = res.endpoint;
    if (badge) {
      badge.textContent = res?.hasApiKey
        ? t("messages.foundryConfigured", "已設定")
        : t("messages.foundryNotConfigured", "未設定");
      badge.style.color = res?.hasApiKey ? "var(--success)" : "";
    }
  } catch (err) {
    debugLog("ERR", "loadFoundryConfig error:", err.message);
  }
}

document.getElementById("btn-save-foundry")?.addEventListener("click", async () => {
  const endpoint = document.getElementById("config-foundry-endpoint")?.value?.trim();
  const apiKey = document.getElementById("config-foundry-key")?.value?.trim();

  if (!endpoint) {
    showToast("請輸入 Endpoint");
    return;
  }

  try {
    await sendToBackground({ type: "SET_FOUNDRY_CONFIG", endpoint, apiKey: apiKey || undefined });
    document.getElementById("config-foundry-key").value = ""; // Clear from UI immediately
    showToast("Foundry 設定已儲存");
    loadFoundryConfig();
  } catch (err) {
    showToast("儲存失敗: " + err.message);
  }
});

document.getElementById("btn-test-foundry")?.addEventListener("click", async () => {
  showToast("測試連線中...");
  try {
    const res = await sendToBackground({ type: "CHECK_CONNECTION" });
    if (res?.connected) {
      showToast("✅ Proxy 連線正常");
    } else {
      showToast("⚠ Proxy 未連線");
    }
  } catch (err) {
    showToast("連線失敗: " + err.message);
  }
});

document.getElementById("btn-clear-foundry")?.addEventListener("click", async () => {
  try {
    await sendToBackground({ type: "CLEAR_FOUNDRY_KEY" });
    showToast("API Key 已清除");
    loadFoundryConfig();
  } catch (err) {
    showToast("清除失敗: " + err.message);
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
        if (typeof AchievementEngine !== "undefined") {
          AchievementEngine.track("config_updated");
        }
      }
    });
    input.click();
  });
});

// ── Chat Logic ──
function showWelcome() {
  addBotMessage(t("messages.welcome", "你好！我是 **IQ Copilot** ✦"));
}

function addUserMessage(text) {
  const msg = createMessage("user", text);
  chatMessages.appendChild(msg);
  chatHistory.push({ role: "user", content: text });
  stats.messages++;
  // Track for achievements
  if (typeof AchievementEngine !== "undefined") {
    AchievementEngine.track("chat_send", { messageLength: text.length, sessionTurns: chatHistory.filter(h => h.role === "user").length });
  }
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
      currentType = t("messages.pdfDoc", "PDF 文件");
    } else if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("edge://")) {
      currentType = t("messages.browserPage", "瀏覽器頁面");
    } else {
      currentType = t("messages.webPage", "網頁");
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

function getAllAgents() {
  return [...BUILTIN_AGENTS, ...customAgents];
}

function isBuiltInAgent(agentId) {
  return BUILTIN_AGENTS.some((agent) => agent.id === agentId);
}

function findAgentById(agentId) {
  return getAllAgents().find((agent) => agent.id === agentId) || null;
}

function normalizeAgentId(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `agent-${Date.now()}`;
}

function renderAgentPanel() {
  const listEl = document.getElementById("agent-list");
  if (!listEl) return;

  const agents = getAllAgents();
  if (!findAgentById(selectedAgentId)) selectedAgentId = "general";

  listEl.innerHTML = agents.map((agent) => {
    const isSelected = agent.id === selectedAgentId;
    const badgeText = isConnected() ? (isBuiltInAgent(agent.id) ? "預設" : "自訂") : "local";
    return `
      <label class="agent-option${isSelected ? " selected" : ""}" data-agent-id="${escapeHtml(agent.id)}">
        <input type="radio" name="agent" value="${escapeHtml(agent.id)}" ${isSelected ? "checked" : ""}>
        <div class="agent-info">
          <span class="agent-name">${escapeHtml(agent.name)}</span>
          <span class="agent-desc">${escapeHtml(agent.description || "")}</span>
        </div>
        <span class="agent-badge">${badgeText}</span>
      </label>
    `;
  }).join("");

  const deleteBtn = document.getElementById("btn-agent-delete");
  if (deleteBtn) {
    const canDelete = !isBuiltInAgent(selectedAgentId);
    deleteBtn.disabled = !canDelete;
    deleteBtn.title = canDelete ? "刪除此自訂 Agent" : "預設 Agent 不可刪除";
  }
}

async function resetSessionForAgentChange() {
  if (!isConnected() || !currentSessionId) return;
  try {
    await sendToBackground({ type: "DELETE_SESSION", sessionId: currentSessionId });
  } catch {
  }
  currentSessionId = null;
  sessionData = null;
}

async function selectAgent(agentId, options = {}) {
  const selected = findAgentById(agentId);
  if (!selected) return;

  selectedAgentId = selected.id;
  chrome.storage.local.set({ selectedAgentId });
  renderAgentPanel();

  if (options.showToast !== false) {
    showToast(`已切換至 ${selected.name}`);
  }

  await resetSessionForAgentChange();
}

function loadAgentConfig() {
  chrome.storage.local.get(["customAgents", "selectedAgentId"], (data) => {
    const storedAgents = Array.isArray(data.customAgents) ? data.customAgents : [];
    customAgents = storedAgents
      .map((agent) => ({
        id: String(agent.id || "").trim(),
        name: String(agent.name || "").trim(),
        description: String(agent.description || "").trim(),
        systemPrompt: String(agent.systemPrompt || ""),
      }))
      .filter((agent) => agent.id && agent.name && !isBuiltInAgent(agent.id));

    if (typeof data.selectedAgentId === "string" && data.selectedAgentId.trim()) {
      selectedAgentId = data.selectedAgentId.trim();
    }
    if (!findAgentById(selectedAgentId)) selectedAgentId = "general";
    renderAgentPanel();
  });
}

async function addCustomAgent() {
  const nameInput = window.prompt(localizeRuntimeMessage("輸入 Agent 名稱"));
  if (nameInput === null) return;
  const name = nameInput.trim();
  if (!name) {
    showToast("Agent 名稱不能為空");
    return;
  }

  const descriptionInput = window.prompt(localizeRuntimeMessage("輸入 Agent 描述"), localizeRuntimeMessage("自訂 Agent")) || "";
  const systemPromptInput = window.prompt(localizeRuntimeMessage("輸入 Agent 系統提示詞"), "") || "";

  const baseId = normalizeAgentId(name);
  let nextId = baseId;
  let suffix = 2;
  while (findAgentById(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const newAgent = {
    id: nextId,
    name,
    description: descriptionInput.trim() || localizeRuntimeMessage("自訂 Agent"),
    systemPrompt: systemPromptInput.trim(),
  };

  customAgents = [...customAgents, newAgent];
  chrome.storage.local.set({ customAgents, selectedAgentId: newAgent.id });
  await selectAgent(newAgent.id, { showToast: false });
  showToast(`已新增 Agent: ${newAgent.name}`);
}

async function deleteSelectedAgent() {
  const selected = findAgentById(selectedAgentId);
  if (!selected || isBuiltInAgent(selected.id)) {
    showToast("預設 Agent 不能刪除");
    return;
  }

  const confirmed = window.confirm(`${localizeRuntimeMessage("確定要刪除 Agent「")}${selected.name}${localizeRuntimeMessage("」嗎？")}`);
  if (!confirmed) return;

  customAgents = customAgents.filter((agent) => agent.id !== selected.id);
  selectedAgentId = "general";
  chrome.storage.local.set({ customAgents, selectedAgentId });
  renderAgentPanel();
  await resetSessionForAgentChange();
  showToast(`已刪除 Agent: ${selected.name}`);
}

// ── Streaming Chat ──
async function ensureSession() {
  if (currentSessionId) return currentSessionId;
  try {
    const config = {};
    const sysVal = document.getElementById("config-system-message")?.value;
    const systemParts = [DEFAULT_SYSTEM_MESSAGE];
    const selectedAgent = findAgentById(selectedAgentId);
    if (selectedAgent?.systemPrompt) systemParts.push(selectedAgent.systemPrompt);
    if (sysVal) systemParts.push(sysVal);
    config.systemMessage = systemParts.join("\n\n");
    if (currentModel) config.model = currentModel;
    const res = await sendToBackground({ type: "CREATE_SESSION", config });
    if (res && res.sessionId) {
      currentSessionId = res.sessionId;
      sessionData = res;
      stats.sessions++;
      // Track new session for achievements
      if (typeof AchievementEngine !== "undefined") {
        AchievementEngine.track("chat_session_new");
      }
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
          // Track agent/tool call for achievements
          if (typeof AchievementEngine !== "undefined") {
            AchievementEngine.track("agent_call", { agentType: toolName });
          }
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
      addBotMessage(currentLanguage === "en" ? "⚠ Unable to create session" : "⚠ 無法建立 Session");
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

  // Easter egg achievement check
  if (typeof AchievementEngine !== "undefined" && text.toLowerCase() === "iq easter egg") {
    AchievementEngine.forceUnlock("hidden-004");
  }

  // Capture and clear pending files
  const attachedFiles = [...pendingFiles];
  clearPendingFiles();

  // Track file uploads for achievements
  if (typeof AchievementEngine !== "undefined" && attachedFiles.length > 0) {
    for (const _f of attachedFiles) {
      AchievementEngine.track("file_uploaded");
    }
  }

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
let isChatInputComposing = false;
chatInput.addEventListener("compositionstart", () => {
  isChatInputComposing = true;
});
chatInput.addEventListener("compositionend", () => {
  isChatInputComposing = false;
});
chatInput.addEventListener("keydown", (e) => {
  const isComposing = isChatInputComposing || e.isComposing || e.keyCode === 229;
  if (isComposing) return;

  const isEnter = e.key === "Enter";
  const isSendShortcut = isEnter && (e.ctrlKey || e.metaKey);
  const isPlainEnter = isEnter && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
  if (isSendShortcut || isPlainEnter) {
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
btnNewChat?.addEventListener("click", async () => {
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
      // Track context view for achievements
      if (typeof AchievementEngine !== "undefined") {
        AchievementEngine.track("context_viewed");
      }
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
  if (el("ctx-sdk-state")) el("ctx-sdk-state").textContent = localizeRuntimeMessage("未連接");
  if (el("ctx-version")) el("ctx-version").textContent = "—";
  if (el("ctx-protocol")) el("ctx-protocol").textContent = "—";
  if (el("ctx-auth-login")) el("ctx-auth-login").textContent = "—";
  if (el("ctx-auth-type")) el("ctx-auth-type").textContent = "—";
  if (el("ctx-auth-host")) el("ctx-auth-host").textContent = "—";
  if (el("ctx-models-count")) el("ctx-models-count").textContent = "0";
  if (el("ctx-models-list")) el("ctx-models-list").innerHTML = `<p class="text-muted">${localizeRuntimeMessage("未連接")}</p>`;
  if (el("ctx-tools-count")) el("ctx-tools-count").textContent = "0";
  if (el("ctx-tools-list")) el("ctx-tools-list").innerHTML = `<p class="text-muted">${localizeRuntimeMessage("未連接")}</p>`;
  if (el("ctx-quota")) el("ctx-quota").innerHTML = `<p class="text-muted">${localizeRuntimeMessage("未連接")}</p>`;
}

function renderCliContextError(errMsg) {
  const el = (id) => document.getElementById(id);
  if (el("ctx-sdk-state")) el("ctx-sdk-state").textContent = localizeRuntimeMessage("錯誤");
  if (el("ctx-models-list")) el("ctx-models-list").innerHTML = `<p class="text-muted">${localizeRuntimeMessage("錯誤: ")}${escapeHtml(errMsg)}</p>`;
}

function renderCliContext(ctx) {
  const el = (id) => document.getElementById(id);

  // SDK state
  if (el("ctx-sdk-state")) el("ctx-sdk-state").textContent = ctx.sdkState || "connected";

  // Version
  if (el("ctx-version")) el("ctx-version").textContent = ctx.status?.version || "—";
  if (el("ctx-protocol")) el("ctx-protocol").textContent = ctx.status?.protocolVersion != null ? `v${ctx.status.protocolVersion}` : "—";

  // Auth
  if (el("ctx-auth-login")) el("ctx-auth-login").textContent = ctx.auth?.login || (ctx.auth?.isAuthenticated ? localizeRuntimeMessage("已認證") : localizeRuntimeMessage("未認證"));
  if (el("ctx-auth-type")) el("ctx-auth-type").textContent = ctx.auth?.authType || "—";
  if (el("ctx-auth-host")) el("ctx-auth-host").textContent = ctx.auth?.host || "—";

  // Models
  const models = ctx.models || [];
  if (el("ctx-models-count")) el("ctx-models-count").textContent = String(models.length);
  if (el("ctx-models-list")) {
    if (models.length === 0) {
      el("ctx-models-list").innerHTML = `<p class="text-muted">${localizeRuntimeMessage("無可用模型")}</p>`;
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
      el("ctx-tools-list").innerHTML = `<p class="text-muted">${localizeRuntimeMessage("無可用工具")}</p>`;
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
      el("ctx-quota").innerHTML = `<p class="text-muted">${localizeRuntimeMessage("無配額資訊")}</p>`;
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
document.getElementById("agent-list")?.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.name !== "agent") return;
  await selectAgent(target.value);
});

document.getElementById("btn-agent-add")?.addEventListener("click", async () => {
  await addCustomAgent();
});

document.getElementById("btn-agent-delete")?.addEventListener("click", async () => {
  await deleteSelectedAgent();
});

function updateAgentBadges() {
  renderAgentPanel();
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
        const modelId = typeof m === "string" ? m : m.id || m.name || String(m);
        const modelLabel = typeof m === "string" ? m : m.name || m.id || String(m);
        const active = modelId === currentModel;
        return `<div class="model-item${active ? " active" : ""}" data-model="${escapeHtml(modelId)}" style="padding:8px 10px;background:var(--bg-primary);border-radius:6px;font-size:12px;border:1px solid ${active ? "var(--accent-start)" : "var(--border)"};color:${active ? "#c4b5fd" : "var(--text-secondary)"};cursor:pointer;transition:all 0.15s;display:flex;justify-content:space-between;align-items:center">
          <span>${escapeHtml(modelLabel)}</span>
          ${active ? '<span style="font-size:10px">✦ 使用中</span>' : ""}
        </div>`;
      }).join("")}
    </div>
  `;

  // Add click handlers for model switching
  card.querySelectorAll(".model-item").forEach((item) => {
    item.addEventListener("click", () => {
      const modelId = item.dataset.model;
      if (modelId === currentModel) return;
      switchModel(modelId);
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
  const saveBtn = document.getElementById("btn-save-mcp");
  const formatBtn = document.getElementById("btn-format-mcp");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadMcpConfig());
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", () => saveMcpConfig());
  }
  if (formatBtn) {
    formatBtn.addEventListener("click", () => formatMcpConfigEditor());
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
      if (sourceEl) sourceEl.textContent = `${localizeRuntimeMessage("來源:")} ${source.replace(/^\/Users\/[^/]+/, "~")}`;
      const editorEl = document.getElementById("mcp-config-editor");
      if (editorEl) editorEl.value = JSON.stringify(mcpConfigData, null, 2);
      renderMcpServers();
    } else {
      listEl.innerHTML = `<div class="mcp-empty">${localizeRuntimeMessage("無法載入 MCP 設定")}</div>`;
      if (sourceEl) sourceEl.textContent = localizeRuntimeMessage(res?.error || "載入失敗");
    }
  } catch (err) {
    debugLog("ERR", "loadMcpConfig error:", err.message);
    listEl.innerHTML = `<div class="mcp-empty">${localizeRuntimeMessage("讀取失敗: ")}${escapeHtml(err.message)}</div>`;
  }
}

function formatMcpConfigEditor() {
  const editorEl = document.getElementById("mcp-config-editor");
  if (!editorEl) return;

  try {
    const parsed = JSON.parse(editorEl.value || "{}");
    editorEl.value = JSON.stringify(parsed, null, 2);
    showToast("已格式化 JSON");
  } catch (err) {
    showToast("JSON 格式錯誤: " + err.message);
  }
}

async function saveMcpConfig() {
  const editorEl = document.getElementById("mcp-config-editor");
  if (!editorEl) return;

  let parsed;
  try {
    parsed = JSON.parse(editorEl.value || "{}");
  } catch (err) {
    showToast("JSON 格式錯誤: " + err.message);
    return;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    showToast("設定必須是 JSON 物件");
    return;
  }

  if (!parsed.mcpServers || typeof parsed.mcpServers !== "object" || Array.isArray(parsed.mcpServers)) {
    showToast("必須包含 mcpServers 物件");
    return;
  }

  try {
    const res = await sendToBackground({ type: "SET_MCP_CONFIG", config: parsed });
    if (res && res.ok) {
      mcpConfigData = parsed;
      const sourceEl = document.getElementById("mcp-source-label");
      const source = res.source || "~/.copilot/mcp-config.json";
      if (sourceEl) sourceEl.textContent = `${localizeRuntimeMessage("來源:")} ${String(source).replace(/^\/Users\/[^/]+/, "~")}`;
      renderMcpServers();
      showToast("MCP 設定已儲存");
    } else {
      showToast("儲存失敗: " + (res?.error || "未知錯誤"));
    }
  } catch (err) {
    showToast("儲存失敗: " + err.message);
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
    listEl.innerHTML = `<div class="mcp-empty">${localizeRuntimeMessage("尚無 MCP 伺服器設定")}</div>`;
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
let customSkills = []; // user-created local skills

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

function toCustomToolShape(skill) {
  return {
    name: skill.name,
    description: skill.description,
    namespacedName: `custom/${skill.name}`,
    isCustom: true,
  };
}

function getAllSkillsForRender(cliTools = []) {
  const customTools = customSkills.map(toCustomToolShape);
  return [...cliTools, ...customTools];
}

function loadCustomSkillsFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["customSkills"], (data) => {
      const list = Array.isArray(data.customSkills) ? data.customSkills : [];
      customSkills = list
        .map((item) => ({
          name: String(item.name || "").trim(),
          description: String(item.description || "").trim(),
        }))
        .filter((item) => item.name.length > 0);
      resolve(customSkills);
    });
  });
}

function saveCustomSkillsToStorage() {
  chrome.storage.local.set({ customSkills });
}

function syncSkillsSourceLabel() {
  const label = document.getElementById("skills-source-label");
  if (label) label.textContent = `CLI ${cachedSkills.length} + 自訂 ${customSkills.length} items`;
}

function setSkillCreateFormVisible(visible) {
  const form = document.getElementById("skill-create-list");
  if (!form) return;
  form.style.display = visible ? "flex" : "none";
}

function clearSkillCreateForm() {
  const nameInput = document.getElementById("skill-name-input");
  const descInput = document.getElementById("skill-description-input");
  if (nameInput) nameInput.value = "";
  if (descInput) descInput.value = "";
}

function addCustomSkill(nameInput, descriptionInput = "") {
  const name = String(nameInput || "").trim();
  if (!name) {
    showToast("Skill 名稱不能為空");
    return false;
  }

  const duplicated = customSkills.some((item) => item.name.toLowerCase() === name.toLowerCase());
  if (duplicated) {
    showToast("已有同名自訂 skill");
    return false;
  }

  customSkills = [...customSkills, { name, description: String(descriptionInput || "").trim() }];
  saveCustomSkillsToStorage();

  const merged = getAllSkillsForRender(cachedSkills);
  renderSkillsGrid(merged);
  syncSkillsSourceLabel();

  showToast(`已新增 skill: ${name}`);
  return true;
}

function deleteCustomSkill(nameInput) {
  const name = String(nameInput || "").trim();
  if (!name) return;

  const exists = customSkills.some((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!exists) return;

  customSkills = customSkills.filter((item) => item.name.toLowerCase() !== name.toLowerCase());
  saveCustomSkillsToStorage();

  const merged = getAllSkillsForRender(cachedSkills);
  renderSkillsGrid(merged);
  syncSkillsSourceLabel();

  showToast(`已刪除 skill: ${name}`);
}

function submitSkillCreateForm() {
  const nameInput = document.getElementById("skill-name-input");
  const descInput = document.getElementById("skill-description-input");
  const name = nameInput?.value || "";
  const description = descInput?.value || "";
  const created = addCustomSkill(name, description);
  if (!created) return;
  clearSkillCreateForm();
  setSkillCreateFormVisible(false);
}

async function loadSkillsFromCli() {
  const grid = document.getElementById("skills-grid");
  const label = document.getElementById("skills-source-label");

  if (!isConnected()) {
    const merged = getAllSkillsForRender([]);
    if (merged.length > 0) {
      renderSkillsGrid(merged);
      if (label) label.textContent = `離線 · 自訂 ${customSkills.length} items`;
    } else {
      if (grid) grid.innerHTML = `<div class="empty-state" id="skills-empty"><span class="empty-icon">⏳</span><p>${localizeRuntimeMessage("連接 Copilot CLI 後自動載入 Skills")}</p></div>`;
      if (label) label.textContent = localizeRuntimeMessage("未連接");
    }
    return;
  }

  if (label) label.textContent = localizeRuntimeMessage("正在載入...");

  try {
    const tools = await sendToBackground({ type: "LIST_TOOLS", model: currentModel });
    debugLog("SKILL", `Loaded ${Array.isArray(tools) ? tools.length : 0} tools from CLI`);

    if (!Array.isArray(tools) || tools.length === 0) {
      cachedSkills = [];
      const merged = getAllSkillsForRender([]);
      if (merged.length > 0) {
        renderSkillsGrid(merged);
      } else if (grid) {
        grid.innerHTML = `<div class="empty-state"><span class="empty-icon">🔧</span><p>${localizeRuntimeMessage("CLI 未回傳任何 Skills")}</p></div>`;
      }
      if (label) label.textContent = `CLI 0 + 自訂 ${customSkills.length} items`;
      return;
    }

    cachedSkills = tools;
    const merged = getAllSkillsForRender(tools);
    renderSkillsGrid(merged);
    if (label) label.textContent = `CLI ${tools.length} + 自訂 ${customSkills.length} items`;
  } catch (err) {
    debugLog("ERR", "loadSkillsFromCli error:", err.message);
    if (grid) grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>${localizeRuntimeMessage("載入失敗")}: ${escapeHtml(err.message)}</p></div>`;
    if (label) label.textContent = localizeRuntimeMessage("載入失敗");
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
    html += `<div class="skill-group">🔌 ${escapeHtml(ns)} (${nsTools.length})</div>`;
    for (const tool of nsTools) {
      html += renderSkillCard(tool);
    }
  }

  grid.innerHTML = html;
}

function renderSkillCard(tool) {
  const name = tool.name || "unknown";
  const desc = tool.description || "";
  const lineDesc = desc.trim() || "—";
  const deleteButton = tool.isCustom
    ? `<button class="skill-delete-btn" data-skill-name="${escapeHtml(name)}" title="刪除自訂 Skill">刪除</button>`
    : "";

  return `<div class="skill-card" title="${escapeHtml(desc)}" data-tool-name="${escapeHtml(name)}">
    <div class="skill-line">
      <span class="skill-name">${escapeHtml(name)}</span>
      <span class="skill-sep">:</span>
      <span class="skill-desc-inline">${escapeHtml(lineDesc)}</span>
    </div>
    ${deleteButton}
  </div>`;
}

// Refresh button
document.getElementById("btn-refresh-skills")?.addEventListener("click", () => {
  loadSkillsFromCli();
  showToast("Skills 重新載入中...");
});

document.getElementById("btn-add-skill")?.addEventListener("click", () => {
  setSkillCreateFormVisible(true);
  document.getElementById("skill-name-input")?.focus();
});

document.getElementById("btn-skill-create-save")?.addEventListener("click", () => {
  submitSkillCreateForm();
});

document.getElementById("btn-skill-create-cancel")?.addEventListener("click", () => {
  clearSkillCreateForm();
  setSkillCreateFormVisible(false);
});

document.getElementById("skill-name-input")?.addEventListener("keydown", (e) => {
  const isEnter = e.key === "Enter";
  if (!isEnter || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  submitSkillCreateForm();
});

document.getElementById("skills-grid")?.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest(".skill-delete-btn");
  if (!button) return;

  e.preventDefault();
  e.stopPropagation();

  const skillName = button.getAttribute("data-skill-name") || "";
  if (!skillName) return;

  const confirmed = window.confirm(`確定要刪除自訂 Skill「${skillName}」嗎？`);
  if (!confirmed) return;
  deleteCustomSkill(skillName);
});

// No tab listeners needed — context comes from CLI, not browser tabs

// ── Proactive Agent System ──
const proactiveState = {
  briefing: null,    // { emails, meetings, tasks, mentions }
  deadlines: null,   // { deadlines }
  ghosts: null,      // { ghosts }
  meetingPrep: null,  // { meeting, attendees, relatedDocs, recentChats, actionItems }
  workiqPrompt: "",
  lastScan: null,
  unreadCount: 0,
};

// Section toggle (collapse/expand)
document.querySelectorAll(".insight-section-header").forEach((header) => {
  header.addEventListener("click", () => {
    const targetId = header.dataset.toggle;
    const body = document.getElementById(targetId);
    const section = header.closest(".insight-section");
    if (body && section) {
      section.classList.toggle("collapsed");
    }
  });
});

// Refresh button
document.getElementById("btn-refresh-proactive")?.addEventListener("click", async () => {
  showToast("正在掃描所有代理...");
  await runFullProactiveScan();
});

document.getElementById("btn-save-proactive-config")?.addEventListener("click", async () => {
  const prompt = document.getElementById("proactive-workiq-prompt")?.value || "";
  try {
    await sendToBackground({ type: "SET_PROACTIVE_CONFIG", workiqPrompt: prompt });
    proactiveState.workiqPrompt = prompt;
    showToast("Proactive Prompt 已儲存");
  } catch (err) {
    showToast("儲存失敗: " + err.message);
  }
});

document.getElementById("btn-clear-proactive-config")?.addEventListener("click", async () => {
  try {
    await sendToBackground({ type: "SET_PROACTIVE_CONFIG", workiqPrompt: "" });
    proactiveState.workiqPrompt = "";
    const promptEl = document.getElementById("proactive-workiq-prompt");
    if (promptEl) promptEl.value = "";
    showToast("Proactive Prompt 已清除");
  } catch (err) {
    showToast("清除失敗: " + err.message);
  }
});

async function loadProactiveConfig() {
  try {
    const res = await sendToBackground({ type: "GET_PROACTIVE_CONFIG" });
    const prompt = typeof res?.config?.workiqPrompt === "string" ? res.config.workiqPrompt : "";
    proactiveState.workiqPrompt = prompt;
    const promptEl = document.getElementById("proactive-workiq-prompt");
    if (promptEl) promptEl.value = prompt;
  } catch (err) {
    debugLog("ERR", "loadProactiveConfig error:", err.message);
  }
}

async function runFullProactiveScan() {
  if (!isConnected()) {
    showToast("請先連接 Copilot CLI");
    return;
  }

  const label = document.getElementById("notif-last-scan");
  if (label) label.textContent = localizeRuntimeMessage("掃描中...");

  try {
    const res = await sendToBackground({ type: "PROACTIVE_SCAN_ALL" });
    debugLog("PROACTIVE", "SCAN_ALL response:", res);

    if (res && res.ok && res.results) {
      processProactiveResults(res.results, res.scannedAt);
    } else if (res && res.results) {
      processProactiveResults(res.results, new Date().toISOString());
    } else {
      showToast("掃描未取得資料");
      if (label) label.textContent = localizeRuntimeMessage("掃描完成 · 無資料");
    }
  } catch (err) {
    debugLog("ERR", "Proactive scan error:", err.message);
    showToast("掃描失敗: " + err.message);
    if (label) label.textContent = localizeRuntimeMessage("載入失敗");
  }
}

function processProactiveResults(results, scannedAt) {
  if (results.briefing?.ok && results.briefing.data) {
    proactiveState.briefing = results.briefing.data;
    renderBriefing(results.briefing.data);
  }
  if (results.deadlines?.ok && results.deadlines.data) {
    proactiveState.deadlines = results.deadlines.data;
    renderDeadlines(results.deadlines.data);
  }
  if (results.ghosts?.ok && results.ghosts.data) {
    proactiveState.ghosts = results.ghosts.data;
    renderGhosts(results.ghosts.data);
  }
  if (results.meetingPrep?.ok && results.meetingPrep.data) {
    proactiveState.meetingPrep = results.meetingPrep.data;
    renderMeetingPrep(results.meetingPrep.data);
  }

  proactiveState.lastScan = scannedAt;
  updateNotificationBadge();
  renderTopPriority();

  const label = document.getElementById("notif-last-scan");
  if (label) {
    const time = new Date(scannedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
    label.textContent = `上次掃描: ${time}`;
  }

  // Store in chrome.storage for persistence
  chrome.storage.local.set({ proactiveState: { ...proactiveState } });
}

// Listen for background proactive pushes
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PROACTIVE_UPDATE") {
    debugLog("PROACTIVE", `Received update for: ${msg.agent}`);
    const data = msg.data;
    const ts = msg.scannedAt || new Date().toISOString();

    switch (msg.agent) {
      case "briefing":
        proactiveState.briefing = data;
        renderBriefing(data);
        break;
      case "deadlines":
        proactiveState.deadlines = data;
        renderDeadlines(data);
        break;
      case "ghosts":
        proactiveState.ghosts = data;
        renderGhosts(data);
        break;
      case "meeting-prep":
        proactiveState.meetingPrep = data;
        renderMeetingPrep(data);
        break;
    }

    proactiveState.lastScan = ts;
    updateNotificationBadge();
    renderTopPriority();
    chrome.storage.local.set({ proactiveState: { ...proactiveState } });
  }
});

function getTopPriorityAction() {
  const criticalDeadline = proactiveState.deadlines?.deadlines
    ?.filter((d) => d.urgency === "critical" || Number(d.daysLeft) <= 0)
    ?.sort((a, b) => Number(a.daysLeft ?? 999) - Number(b.daysLeft ?? 999))?.[0];
  if (criticalDeadline) {
    return {
      severity: "critical",
      title: `處理截止事項：${criticalDeadline.title || "未命名事項"}`,
      detail: `${criticalDeadline.date || "今天"} · ${criticalDeadline.source || "email"}`,
      action: currentLanguage === "en"
        ? `Help me execute this urgent deadline now: ${criticalDeadline.title}. Due: ${criticalDeadline.date || "today"}. Context: ${criticalDeadline.snippet || criticalDeadline.sourceDetail || ""}`
        : `請幫我現在處理這個最緊急的截止事項：${criticalDeadline.title}。期限：${criticalDeadline.date || "今天"}。背景：${criticalDeadline.snippet || criticalDeadline.sourceDetail || ""}`,
      meta: "Deadline",
    };
  }

  const criticalGhost = proactiveState.ghosts?.ghosts
    ?.find((g) => g.priority === "critical" || g.priority === "high");
  if (criticalGhost) {
    return {
      severity: criticalGhost.priority === "critical" ? "critical" : "warning",
      title: `回覆信件：${criticalGhost.subject || "未命名信件"}`,
      detail: `${criticalGhost.from || "Unknown"} · ${criticalGhost.receivedAt || ""}`,
      action: currentLanguage === "en"
        ? `Draft a response for this email now: subject "${criticalGhost.subject}", from ${criticalGhost.from}. Context: ${criticalGhost.snippet || ""}`
        : `請立即幫我草擬回覆這封信：主旨「${criticalGhost.subject}」，寄件者 ${criticalGhost.from}。內容：${criticalGhost.snippet || ""}`,
      meta: "Email",
    };
  }

  const urgentTask = proactiveState.briefing?.tasks?.find((t) => t.status === "overdue" || /today|今天/i.test(t.due || ""));
  if (urgentTask) {
    return {
      severity: urgentTask.status === "overdue" ? "warning" : "normal",
      title: `完成任務：${urgentTask.title || "未命名任務"}`,
      detail: `${urgentTask.due || "今天"} · ${urgentTask.source || "To-Do"}`,
      action: currentLanguage === "en"
        ? `Help me complete this task now: ${urgentTask.title}. Due: ${urgentTask.due || "today"}.`
        : `請幫我現在完成這個任務：${urgentTask.title}。期限：${urgentTask.due || "今天"}。`,
      meta: "Task",
    };
  }

  const nextMeeting = proactiveState.briefing?.meetings?.[0];
  if (nextMeeting) {
    return {
      severity: "normal",
      title: `準備會議：${nextMeeting.title || "未命名會議"}`,
      detail: `${nextMeeting.time || ""} · ${nextMeeting.location || ""}`,
      action: currentLanguage === "en"
        ? `Prepare me for this meeting: ${nextMeeting.title} at ${nextMeeting.time || ""}.`
        : `請幫我準備這場會議：${nextMeeting.title}（${nextMeeting.time || ""}）。`,
      meta: "Meeting",
    };
  }

  return null;
}

function renderTopPriority() {
  const container = document.getElementById("top-priority-content");
  if (!container) return;
  const top = getTopPriorityAction();
  if (!top) {
    container.innerHTML = `<div class="empty-state" id="top-priority-empty"><span class="empty-icon">🫧</span><p>目前沒有高優先事項</p></div>`;
    return;
  }

  const severityClass = top.severity === "critical" ? "" : top.severity === "warning" ? "warning" : "normal";
  container.innerHTML = `
    <div class="top-priority-item ${severityClass}">
      <div class="top-priority-title">${escapeHtml(top.title)}</div>
      <div class="top-priority-detail">${escapeHtml(top.detail)}</div>
      <div class="top-priority-meta">${escapeHtml(top.meta)}</div>
      <div class="top-priority-actions">
        <button class="insight-action-btn" id="btn-do-top-priority">立即處理</button>
      </div>
    </div>
  `;

  document.getElementById("btn-do-top-priority")?.addEventListener("click", () => {
    switchPanel("chat");
    chatInput.value = top.action;
    sendMessage();
  });
}

function updateNotificationBadge() {
  let count = 0;
  if (proactiveState.briefing) {
    count += (proactiveState.briefing.emails?.length || 0);
    count += (proactiveState.briefing.mentions?.length || 0);
  }
  if (proactiveState.deadlines) {
    count += (proactiveState.deadlines.deadlines?.filter((d) => d.urgency === "critical" || d.daysLeft <= 1).length || 0);
  }
  if (proactiveState.ghosts) {
    count += (proactiveState.ghosts.ghosts?.filter((g) => g.priority === "critical" || g.priority === "high").length || 0);
  }
  if (proactiveState.meetingPrep?.meeting) {
    count += 1;
  }

  proactiveState.unreadCount = count;

  const badge = document.getElementById("notification-badge");
  const totalCount = document.getElementById("notif-total-count");
  if (badge) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = count > 0 ? "flex" : "none";
  }
  if (totalCount) totalCount.textContent = String(count);
}

// ── Render: Daily Briefing (Idea 1) ──
function renderBriefing(data) {
  const empty = document.getElementById("briefing-empty");
  const hasData = (data.emails?.length || 0) + (data.meetings?.length || 0) + (data.tasks?.length || 0) + (data.mentions?.length || 0) > 0;

  if (empty) empty.style.display = hasData ? "none" : "block";

  // Emails
  renderInsightItems("briefing-emails", data.emails || [], (item) => {
    const priorityClass = item.priority === "high" ? "priority-high" : item.priority === "medium" ? "priority-medium" : "priority-low";
    return `<div class="insight-item ${priorityClass}">
      <div class="insight-item-header">
        <span class="insight-item-from">${escapeHtml(item.from)}</span>
        <span class="insight-item-age">${escapeHtml(item.age)}</span>
      </div>
      <div class="insight-item-subject">${escapeHtml(item.subject)}</div>
      <div class="insight-item-snippet">${escapeHtml(item.snippet || "")}</div>
      <div class="insight-item-actions">
        <button class="insight-action-btn" data-action="reply" data-from="${escapeHtml(item.from)}" data-subject="${escapeHtml(item.subject)}">💬 回覆</button>
        <button class="insight-action-btn secondary" data-action="draft" data-from="${escapeHtml(item.from)}" data-subject="${escapeHtml(item.subject)}">🤖 草擬回覆</button>
      </div>
    </div>`;
  });
  updateSubCount("briefing-emails-count", data.emails);

  // Meetings
  renderInsightItems("briefing-meetings", data.meetings || [], (item) => {
    const attendeeStr = Array.isArray(item.attendees) ? item.attendees.join(", ") : "";
    return `<div class="insight-item">
      <div class="insight-item-header">
        <span class="insight-item-time">${escapeHtml(item.time)}</span>
        <span class="insight-item-location">${escapeHtml(item.location || "")}</span>
      </div>
      <div class="insight-item-subject">${escapeHtml(item.title)}</div>
      ${attendeeStr ? `<div class="insight-item-snippet">👥 ${escapeHtml(attendeeStr)}</div>` : ""}
      <div class="insight-item-actions">
        <button class="insight-action-btn" data-action="meetprep" data-title="${escapeHtml(item.title)}">📋 準備</button>
      </div>
    </div>`;
  });
  updateSubCount("briefing-meetings-count", data.meetings);

  // Tasks
  renderInsightItems("briefing-tasks", data.tasks || [], (item) => {
    const statusClass = item.status === "overdue" ? "priority-high" : "priority-medium";
    return `<div class="insight-item ${statusClass}">
      <div class="insight-item-header">
        <span class="insight-item-from">${escapeHtml(item.source || "To-Do")}</span>
        <span class="insight-item-age">${escapeHtml(item.due)}</span>
      </div>
      <div class="insight-item-subject">${escapeHtml(item.title)}</div>
      <div class="insight-item-actions">
        <button class="insight-action-btn secondary" data-action="complete-task">✅ 完成</button>
      </div>
    </div>`;
  });
  updateSubCount("briefing-tasks-count", data.tasks);

  // Mentions
  renderInsightItems("briefing-mentions", data.mentions || [], (item) => {
    return `<div class="insight-item priority-medium">
      <div class="insight-item-header">
        <span class="insight-item-from">${escapeHtml(item.from)}</span>
        <span class="insight-item-age">${escapeHtml(item.time || "")}</span>
      </div>
      <div class="insight-item-subject">${escapeHtml(item.channel || "")}</div>
      <div class="insight-item-snippet">${escapeHtml(item.message || "")}</div>
    </div>`;
  });
  updateSubCount("briefing-mentions-count", data.mentions);

  updateSectionCount("briefing-count", (data.emails?.length || 0) + (data.meetings?.length || 0) + (data.tasks?.length || 0) + (data.mentions?.length || 0));
}

// ── Render: Deadline Hawk (Idea 2) ──
function renderDeadlines(data) {
  const empty = document.getElementById("deadline-empty");
  const items = data.deadlines || [];
  if (empty) empty.style.display = items.length > 0 ? "none" : "block";

  renderInsightItems("deadline-list", items, (item) => {
    const urgencyClass = item.urgency === "critical" ? "priority-high" : item.urgency === "warning" ? "priority-medium" : "priority-low";
    const daysText = item.daysLeft === 0 ? "今天" : item.daysLeft === 1 ? "明天" : `${item.daysLeft} 天`;
    return `<div class="insight-item ${urgencyClass}">
      <div class="insight-item-header">
        <span class="insight-item-from">${escapeHtml(item.source || "Email")}</span>
        <span class="deadline-countdown ${urgencyClass}">${escapeHtml(daysText)}</span>
      </div>
      <div class="insight-item-subject">${escapeHtml(item.title)}</div>
      <div class="insight-item-snippet">${escapeHtml(item.snippet || item.sourceDetail || "")}</div>
      <div class="insight-item-meta">📅 ${escapeHtml(item.date || "")}</div>
    </div>`;
  });

  updateSectionCount("deadline-count", items.length);
}

// ── Render: Ghost Detector (Idea 4) ──
function renderGhosts(data) {
  const empty = document.getElementById("ghost-empty");
  const items = data.ghosts || [];
  if (empty) empty.style.display = items.length > 0 ? "none" : "block";

  renderInsightItems("ghost-list", items, (item) => {
    const priorityClass = item.priority === "critical" ? "priority-high" : item.priority === "high" ? "priority-high" : item.priority === "medium" ? "priority-medium" : "priority-low";
    return `<div class="insight-item ${priorityClass}">
      <div class="insight-item-header">
        <span class="insight-item-from">${escapeHtml(item.from)}</span>
        <span class="insight-item-age">${escapeHtml(item.receivedAt)}</span>
      </div>
      <div class="insight-item-subject">${escapeHtml(item.subject)}</div>
      <div class="insight-item-snippet">${escapeHtml(item.snippet || "")}</div>
      <div class="insight-item-reason">${escapeHtml(item.reason || "")}</div>
      <div class="insight-item-actions">
        <button class="insight-action-btn" data-action="draft-reply" data-from="${escapeHtml(item.from)}" data-subject="${escapeHtml(item.subject)}" data-snippet="${escapeHtml(item.snippet || "")}">🤖 草擬回覆</button>
        <button class="insight-action-btn secondary" data-action="dismiss">✕ 忽略</button>
      </div>
    </div>`;
  });

  updateSectionCount("ghost-count", items.length);
}

// ── Render: Meeting Prep (Idea 3) ──
function renderMeetingPrep(data) {
  const empty = document.getElementById("meeting-prep-empty");
  const container = document.getElementById("meeting-prep-list");
  const hasMeeting = data.meeting && data.meeting.title;

  if (empty) empty.style.display = hasMeeting ? "none" : "block";
  if (!container || !hasMeeting) {
    updateSectionCount("meeting-prep-count", 0);
    return;
  }

  let html = "";

  // Meeting info header
  html += `<div class="insight-item meeting-header-item">
    <div class="insight-item-header">
      <span class="insight-item-time">${escapeHtml(data.meeting.time || "")}</span>
      <span class="insight-item-age">${escapeHtml(data.meeting.duration || "")}</span>
    </div>
    <div class="insight-item-subject">${escapeHtml(data.meeting.title)}</div>
    <div class="insight-item-meta">📍 ${escapeHtml(data.meeting.location || "TBD")}</div>
  </div>`;

  // Attendees
  if (Array.isArray(data.attendees) && data.attendees.length > 0) {
    html += `<div class="meeting-prep-subsection">
      <div class="meeting-prep-subtitle">👥 參與者 (${data.attendees.length})</div>
      ${data.attendees.map((a) => `<div class="meeting-prep-attendee">
        <span class="attendee-name">${escapeHtml(a.name)}</span>
        <span class="attendee-role">${escapeHtml(a.role || "")}</span>
        ${a.notes ? `<span class="attendee-notes">${escapeHtml(a.notes)}</span>` : ""}
      </div>`).join("")}
    </div>`;
  }

  // Related docs
  if (Array.isArray(data.relatedDocs) && data.relatedDocs.length > 0) {
    html += `<div class="meeting-prep-subsection">
      <div class="meeting-prep-subtitle">📎 相關文件 (${data.relatedDocs.length})</div>
      ${data.relatedDocs.map((d) => `<div class="insight-item">
        <div class="insight-item-subject">${escapeHtml(d.name)}</div>
        <div class="insight-item-snippet">${escapeHtml(d.relevance || "")}</div>
        <div class="insight-item-actions">
          <button class="insight-action-btn secondary" data-action="open-doc" data-url="${escapeHtml(d.url || "")}">📄 開啟</button>
        </div>
      </div>`).join("")}
    </div>`;
  }

  // Recent chats
  if (Array.isArray(data.recentChats) && data.recentChats.length > 0) {
    html += `<div class="meeting-prep-subsection">
      <div class="meeting-prep-subtitle">💬 相關對話</div>
      ${data.recentChats.map((c) => `<div class="insight-item">
        <div class="insight-item-header">
          <span class="insight-item-from">${escapeHtml(c.channel || "")}</span>
          <span class="insight-item-age">${escapeHtml(c.time || "")}</span>
        </div>
        <div class="insight-item-snippet">${escapeHtml(c.summary || "")}</div>
      </div>`).join("")}
    </div>`;
  }

  // Action items
  if (Array.isArray(data.actionItems) && data.actionItems.length > 0) {
    html += `<div class="meeting-prep-subsection">
      <div class="meeting-prep-subtitle">🎯 你的 Action Items</div>
      ${data.actionItems.map((a) => `<div class="insight-item priority-medium">
        <div class="insight-item-subject">${escapeHtml(a.item)}</div>
        <div class="insight-item-snippet">來自: ${escapeHtml(a.from || "")} · ${escapeHtml(a.date || "")}</div>
      </div>`).join("")}
    </div>`;
  }

  container.innerHTML = html;
  updateSectionCount("meeting-prep-count", 1);
}

// ── Shared Insight Card Helpers ──
function renderInsightItems(containerId, items, renderFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = items.map(renderFn).join("");

  // Attach action button handlers
  container.querySelectorAll(".insight-action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleInsightAction(btn);
    });
  });
}

function updateSubCount(id, items) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(items?.length || 0);
}

function updateSectionCount(id, count) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(count || 0);
}

// ── Insight Action Handlers ──
async function handleInsightAction(btn) {
  const action = btn.dataset.action;
  const from = btn.dataset.from || "";
  const subject = btn.dataset.subject || "";
  const snippet = btn.dataset.snippet || "";
  const title = btn.dataset.title || "";
  const url = btn.dataset.url || "";

  switch (action) {
    case "draft":
    case "draft-reply": {
      // Switch to chat and draft a reply
      switchPanel("chat");
      const prompt = currentLanguage === "en"
        ? `Please draft a reply email to ${from} about \"${subject}\".\n\nEmail summary: ${snippet}\n\nUse a professional but friendly tone.`
        : `請幫我草擬一封回覆信，回覆 ${from} 的信件「${subject}」。\n\n信件內容摘要：${snippet}\n\n請用專業但友善的語氣。`;
      chatInput.value = prompt;
      sendMessage();
      break;
    }
    case "reply": {
      switchPanel("chat");
      chatInput.value = currentLanguage === "en"
        ? `I need to reply to ${from} about \"${subject}\". Please draft a response.`
        : `我需要回覆 ${from} 關於「${subject}」的信件。請幫我草擬回覆。`;
      chatInput.focus();
      break;
    }
    case "meetprep": {
      // Trigger meeting prep for specific meeting
      switchPanel("chat");
      chatInput.value = currentLanguage === "en"
        ? `Please help me prepare for \"${title}\". Summarize related materials, attendee background, and my action items.`
        : `請幫我準備「${title}」這場會議。整理相關資料、參與者背景和我的 action items。`;
      sendMessage();
      break;
    }
    case "open-doc": {
      if (url) window.open(url, "_blank");
      break;
    }
    case "complete-task": {
      btn.textContent = localizeRuntimeMessage("✅ 已完成");
      btn.disabled = true;
      btn.closest(".insight-item")?.classList.add("completed");
      break;
    }
    case "dismiss": {
      const item = btn.closest(".insight-item");
      if (item) {
        item.style.opacity = "0";
        item.style.transform = "translateX(100%)";
        setTimeout(() => item.remove(), 300);
      }
      break;
    }
    default:
      debugLog("PROACTIVE", `Unknown action: ${action}`);
  }
}

// ── Restore persisted proactive state ──
function restoreProactiveState() {
  chrome.storage.local.get("proactiveState", (data) => {
    if (data.proactiveState) {
      const s = data.proactiveState;
      if (s.briefing) { proactiveState.briefing = s.briefing; renderBriefing(s.briefing); }
      if (s.deadlines) { proactiveState.deadlines = s.deadlines; renderDeadlines(s.deadlines); }
      if (s.ghosts) { proactiveState.ghosts = s.ghosts; renderGhosts(s.ghosts); }
      if (s.meetingPrep) { proactiveState.meetingPrep = s.meetingPrep; renderMeetingPrep(s.meetingPrep); }
      if (s.lastScan) {
        proactiveState.lastScan = s.lastScan;
        const label = document.getElementById("notif-last-scan");
        if (label) {
          const time = new Date(s.lastScan).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
          label.textContent = `上次掃描: ${time}`;
        }
      }
      updateNotificationBadge();
      renderTopPriority();
    }
  });
}

// ══════════════════════════════════════════════════════════════
// ── Achievement Panel Rendering ──
// ══════════════════════════════════════════════════════════════

function renderAchievementPanel() {
  if (typeof AchievementEngine === "undefined") return;
  renderAchProfileCard();
  renderAchRecentUnlocks();
  renderAchCategories();
  renderAchAllList();
}

function renderAchProfileCard() {
  const profile = AchievementEngine.getProfile();
  const stats = AchievementEngine.getStats();
  if (!profile) return;

  const iconEl = document.getElementById("ach-profile-icon");
  const titleEl = document.getElementById("ach-profile-title");
  const levelEl = document.getElementById("ach-profile-level");
  const xpFillEl = document.getElementById("ach-xp-fill");
  const xpTextEl = document.getElementById("ach-xp-text");
  const streakEl = document.getElementById("ach-stat-streak");
  const unlockedEl = document.getElementById("ach-stat-unlocked");
  const timeEl = document.getElementById("ach-stat-time");

  if (!iconEl) return;

  // Extract emoji from title (e.g. "🚀 Power User" → "🚀")
  const titleParts = (profile.title || "🌱 Newbie").split(" ");
  const icon = titleParts[0];
  const titleText = titleParts.slice(1).join(" ");

  iconEl.textContent = icon;
  titleEl.textContent = titleText;
  levelEl.textContent = `Level ${profile.level}`;

  // XP progress bar
  const currentXP = profile.xp || 0;
  const currentLevelXP = profile.currentLevelXP || 0;
  const nextLevelXP = profile.nextLevelXP;
  let pct = 100;
  let xpLabel = `${currentXP.toLocaleString()} XP (MAX)`;

  if (nextLevelXP) {
    const rangeXP = nextLevelXP - currentLevelXP;
    const progressXP = currentXP - currentLevelXP;
    pct = rangeXP > 0 ? Math.min(100, Math.round((progressXP / rangeXP) * 100)) : 100;
    xpLabel = `${currentXP.toLocaleString()} / ${nextLevelXP.toLocaleString()} XP`;
  }
  xpFillEl.style.width = `${pct}%`;
  xpTextEl.textContent = xpLabel;

  // Stats row
  streakEl.textContent = stats.streak || 0;
  unlockedEl.textContent = `${stats.achievementsUnlocked}/${stats.achievementsTotal}`;
  const hrs = ((stats.timeSavedMinutes || 0) / 60).toFixed(1);
  timeEl.textContent = `${hrs}h`;
}

function renderAchRecentUnlocks() {
  const achievements = AchievementEngine.getAchievements();
  const recent = achievements
    .filter((a) => a.unlocked)
    .sort((a, b) => (b.unlockedAt || "").localeCompare(a.unlockedAt || ""))
    .slice(0, 5);

  const card = document.getElementById("ach-recent-card");
  const list = document.getElementById("ach-recent-list");
  if (!card || !list) return;

  if (recent.length === 0) {
    card.style.display = "none";
    return;
  }
  card.style.display = "";

  list.innerHTML = recent
    .map((a) => {
      const rule = AchievementEngine.ACHIEVEMENT_CATALOG[a.id] ? null : null; // already merged
      const rarityColor = a.rarityInfo?.color || "#9ca3af";
      const timeAgo = _relativeTime(a.unlockedAt);
      return `<div class="ach-recent-item">
        <span class="ach-recent-icon" style="border-color:${rarityColor}">${a.icon}</span>
        <div class="ach-recent-info">
          <span class="ach-recent-name">${a.name}</span>
          <span class="ach-recent-time">${timeAgo}</span>
        </div>
        <span class="ach-recent-xp" style="color:${rarityColor}">+${a.xpBonus || 0} XP</span>
      </div>`;
    })
    .join("");
}

function renderAchCategories() {
  const container = document.getElementById("ach-categories");
  if (!container) return;

  const byCategory = AchievementEngine.getAchievementsByCategory();
  const categoryMeta = {
    chat:      { icon: "🗨️", label: "Chat" },
    agent:     { icon: "🤖", label: "Agent" },
    proactive: { icon: "📋", label: "Proactive" },
    tools:     { icon: "🔧", label: "Tools" },
    streaks:   { icon: "🔥", label: "Streaks" },
    hidden:    { icon: "🥚", label: "Hidden" },
  };

  container.innerHTML = Object.entries(categoryMeta)
    .map(([key, meta]) => {
      const items = byCategory[key] || [];
      const unlocked = items.filter((a) => a.unlocked).length;
      const total = items.length;
      const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
      return `<div class="ach-cat-row">
        <span class="ach-cat-icon">${meta.icon}</span>
        <span class="ach-cat-label">${meta.label}</span>
        <div class="ach-cat-bar"><div class="ach-cat-fill" style="width:${pct}%"></div></div>
        <span class="ach-cat-count">${unlocked}/${total}</span>
      </div>`;
    })
    .join("");
}

let _achFilter = "all";

function renderAchAllList(filter) {
  if (filter) _achFilter = filter;
  const container = document.getElementById("ach-all-list");
  if (!container) return;

  let all = AchievementEngine.getAchievements();

  if (_achFilter === "unlocked") all = all.filter((a) => a.unlocked);
  else if (_achFilter === "locked") all = all.filter((a) => !a.unlocked);

  container.innerHTML = all
    .map((a) => {
      const rarityColor = a.rarityInfo?.color || "#9ca3af";
      const isHidden = a.hidden && !a.unlocked;

      if (a.unlocked) {
        return `<div class="ach-item unlocked" style="--rarity:${rarityColor}">
          <span class="ach-item-icon">${a.icon}</span>
          <div class="ach-item-info">
            <span class="ach-item-name">${a.name}</span>
            <span class="ach-item-desc">${a.desc}</span>
          </div>
          <span class="ach-item-badge" style="color:${rarityColor}">✅</span>
        </div>`;
      }

      if (isHidden) {
        return `<div class="ach-item locked hidden-ach">
          <span class="ach-item-icon">❓</span>
          <div class="ach-item-info">
            <span class="ach-item-name">Hidden Achievement</span>
            <span class="ach-item-desc">Keep exploring to discover this…</span>
          </div>
          <span class="ach-item-badge">🔒</span>
        </div>`;
      }

      // Locked with progress
      const progress = a.progress || 0;
      const target = a.target || 1;
      const pct = Math.min(100, Math.round((progress / target) * 100));
      const showBar = target > 1 && progress > 0;

      return `<div class="ach-item locked" style="--rarity:${rarityColor}">
        <span class="ach-item-icon">${a.icon}</span>
        <div class="ach-item-info">
          <span class="ach-item-name">${a.name}</span>
          <span class="ach-item-desc">${a.desc}</span>
          ${showBar ? `<div class="ach-item-progress-bar"><div class="ach-item-progress-fill" style="width:${pct}%"></div></div><span class="ach-item-progress-text">${progress}/${target}</span>` : ""}
        </div>
        <span class="ach-item-badge">🔒</span>
      </div>`;
    })
    .join("");
}

// ── Filter bar click handler ──
document.getElementById("ach-filter-bar")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".ach-filter-btn");
  if (!btn) return;
  document.querySelectorAll("#ach-filter-bar .ach-filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderAchAllList(btn.dataset.filter);
});

// ── Achievement Toast ──
function showAchievementToast(achievement) {
  // Remove any existing toast
  document.querySelectorAll(".ach-toast").forEach((t) => t.remove());

  const profile = AchievementEngine.getProfile();
  const rarityColor = achievement.rarityInfo?.color || "#9ca3af";
  const rarityLabel = achievement.rarityInfo?.label || "Common";

  // XP bar for toast
  let xpBarHTML = "";
  if (profile && profile.nextLevelXP) {
    const range = profile.nextLevelXP - profile.currentLevelXP;
    const prog = profile.xp - profile.currentLevelXP;
    const pct = range > 0 ? Math.min(100, Math.round((prog / range) * 100)) : 100;
    xpBarHTML = `<div class="ach-toast-xp-bar"><div class="ach-toast-xp-fill" style="width:${pct}%"></div></div>
      <span class="ach-toast-level">Lv.${profile.level}</span>`;
  }

  const toast = document.createElement("div");
  toast.className = "ach-toast";
  toast.innerHTML = `
    <div class="ach-toast-header">🏅 Achievement Unlocked!</div>
    <div class="ach-toast-body">
      <span class="ach-toast-icon" style="border-color:${rarityColor}">${achievement.icon}</span>
      <div class="ach-toast-info">
        <span class="ach-toast-name">${achievement.name}</span>
        <span class="ach-toast-desc">${achievement.desc}</span>
        <span class="ach-toast-rarity" style="color:${rarityColor}">${rarityLabel}</span>
      </div>
      <span class="ach-toast-xp">+${achievement.xpBonus} XP</span>
    </div>
    ${xpBarHTML}
  `;

  document.body.appendChild(toast);

  // Auto-dismiss after 4s
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(120%)";
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function showLevelUpToast(from, to, title) {
  document.querySelectorAll(".ach-toast").forEach((t) => t.remove());

  const toast = document.createElement("div");
  toast.className = "ach-toast level-up";
  toast.innerHTML = `
    <div class="ach-toast-header">🎉 Level Up!</div>
    <div class="ach-toast-body">
      <span class="ach-toast-icon" style="font-size:28px">${title.split(" ")[0]}</span>
      <div class="ach-toast-info">
        <span class="ach-toast-name">Level ${from} → Level ${to}</span>
        <span class="ach-toast-desc">${title}</span>
      </div>
    </div>
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(120%)";
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// ── Achievement Event Listener ──
function initAchievements() {
  if (typeof AchievementEngine === "undefined") return;

  AchievementEngine.init().then(() => {
    // Listen for achievement/level events
    AchievementEngine.onEvent((evt) => {
      if (evt.type === "achievement_unlocked" && evt.achievement) {
        showAchievementToast(evt.achievement);
        // Refresh panel if visible
        const panel = document.getElementById("panel-achievements");
        if (panel && !panel.classList.contains("hidden") && panel.offsetParent !== null) {
          renderAchievementPanel();
        }
      }
      if (evt.type === "levelup") {
        showLevelUpToast(evt.from, evt.to, evt.title);
        // Also refresh profile card
        renderAchProfileCard();
      }
    });

    // Render initially if panel is active
    renderAchievementPanel();
  });
}

// ── Relative time helper ──
function _relativeTime(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoStr).toLocaleDateString();
}

// ── Init ──
async function init() {
  await loadUiPreferences();
  loadFoundryConfig();
  showWelcome();
  updateStats();
  await loadCustomSkillsFromStorage();
  loadAgentConfig();
  loadCliConfig();
  checkConnection();
  initMcpPanel();
  updateAgentBadges();
  restoreProactiveState();
  loadProactiveConfig();
  renderTopPriority();
  initAchievements();

  // Load persisted model
  chrome.storage.local.get("selectedModel", (data) => {
    if (data.selectedModel) currentModel = data.selectedModel;
  });
}

init();
