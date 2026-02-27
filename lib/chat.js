(function initIQChat(global) {
  const root = global.IQ || (global.IQ = {});
  const CONFIG = root.state?.CONFIG || {};
  const localizeRuntimeMessage = root.i18n?.localizeRuntimeMessage || ((m) => m);
  const t = root.i18n?.t || ((p, f) => f);

  const TOOL_ICONS = {
    bash: "💻", edit: "✏️", grep: "🔍", view: "📄", create: "📝",
    read: "📄", write: "✏️", search: "🔍", run: "💻", execute: "💻",
    list: "📋", delete: "🗑️", move: "📦", copy: "📋",
    mcp_: "🔌", semantic_search: "🔍", file_search: "📂",
    replace_string_in_file: "✏️", read_file: "📄", create_file: "📝",
    run_in_terminal: "💻", grep_search: "🔍", list_dir: "📂",
  };

  // ── Chat State ──
  let currentSessionId = null;
  let currentModel = null;
  let chatHistory = [];
  const stats = { messages: 0, tokens: 0, sessions: 0, pages: 0 };
  const tokenDetails = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0, apiCalls: 0 };
  let currentTitle = "";
  let currentUrl = "";
  let currentType = "webpage";
  let availableModels = [];
  let toolCalls = [];
  let sessionData = null;

  function getState() {
    return { currentSessionId, currentModel, chatHistory, stats, tokenDetails, currentTitle, currentUrl, currentType, availableModels, toolCalls, sessionData };
  }

  function setCurrentSessionId(id) { currentSessionId = id; }
  function setCurrentModel(m) { currentModel = m; }
  function setSessionData(d) { sessionData = d; }
  function setAvailableModels(m) { availableModels = m; }
  function escapeHtml(s) {
    return (root.utils?.escapeHtml || ((x) => x))(s);
  }
  function clearTaskActivity() {
    toolCalls = [];
  }

  function pushChatHistory(entry) {
    const utils = root.utils || {};
    chatHistory = (utils.pushWithLimitImmutable || ((a, i) => [...a, i]))(
      chatHistory,
      entry,
      CONFIG.MAX_CHAT_HISTORY_ENTRIES || 200
    );
  }

  function resetChatState() {
    chatHistory = [];
    currentSessionId = null;
    sessionData = null;
    stats.sessions++;
  }

  // ── Browser Context Helper ──
  async function fetchCurrentTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      currentUrl = tab.url || "";
      currentTitle = tab.title || "";
      const t = root.i18n?.t || ((p, f) => f);
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

  // ── DOM Helpers ──
  function createMessage(role, text) {
    const utils = root.utils || {};
    const formatText = utils.formatText || ((s) => s);

    const div = document.createElement("div");
    div.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = role === "bot" ? "✦" : "👤";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.innerHTML = formatText(role === "bot" ? formatNewsResponse(text) : text);

    div.appendChild(avatar);
    div.appendChild(bubble);
    return div;
  }

  function formatNewsResponse(text) {
    if (typeof text !== "string") return text;

    const hasNumberedList = /(^|\n)\d+\.\s/.test(text);
    const hasUrl = /https?:\/\//i.test(text);
    const hasNewsKeyword = /(新聞|news|openai|microsoft|微軟)/i.test(text);
    if (!hasNumberedList || !hasUrl || !hasNewsKeyword) return text;

    const lines = text.split("\n");
    const header = [];
    const items = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      const itemMatch = line.match(/^(\d+)\.\s*(.+)$/);

      if (!itemMatch) {
        if (items.length === 0 && line) header.push(line);
        i += 1;
        continue;
      }

      const rank = itemMatch[1];
      const title = itemMatch[2].trim();
      let url = "";
      let sourceMeta = "";

      let j = i + 1;
      while (j < lines.length) {
        const nextRaw = lines[j];
        const next = nextRaw.trim();
        if (!next) {
          j += 1;
          continue;
        }
        if (/^\d+\.\s/.test(next)) break;

        if (!url) {
          const urlMatch = next.match(/\(?\s*(https?:\/\/[^\s)]+)\s*\)?/i);
          if (urlMatch) {
            url = urlMatch[1];
            const rest = next.replace(urlMatch[0], "").trim();
            const metaMatch = rest.match(/（([^）]+)）/);
            if (metaMatch) sourceMeta = metaMatch[1].trim();
            j += 1;
            continue;
          }
        }

        if (!sourceMeta) {
          const metaMatch = next.match(/（([^）]+)）/);
          if (metaMatch) sourceMeta = metaMatch[1].trim();
        }

        j += 1;
      }

      const row = [
        `${rank}. **${title}**`,
        sourceMeta ? `來源：${sourceMeta}` : null,
        url ? `連結：${url}` : null,
      ].filter(Boolean).join("\n");

      items.push(row);
      i = j;
    }

    if (items.length === 0) return text;

    const intro = header.length > 0 ? `${header.join("\n")}\n\n` : "";
    return `${intro}${items.join("\n\n")}`;
  }

  function createStreamingBotMessage() {
    const utils = root.utils || {};
    const chatMessages = document.getElementById("chat-messages");

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
    if (chatMessages) {
      chatMessages.appendChild(div);
      utils.trimContainerChildren?.(chatMessages, CONFIG.MAX_CHAT_HISTORY_ENTRIES || 200);
      utils.scrollToBottom?.();
    }
    return bubble;
  }

  function showTyping() {
    const chatMessages = document.getElementById("chat-messages");
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
    if (chatMessages) chatMessages.appendChild(div);
    root.utils?.scrollToBottom?.();
  }

  function removeTyping() {
    const t = document.getElementById("typing-msg");
    if (t) t.remove();
  }

  function hideSuggestions() {
    const suggestions = document.getElementById("chat-suggestions");
    if (suggestions) suggestions.style.display = "none";
  }

  function showWelcome() {
    const t = root.i18n?.t || ((p, f) => f);
    addBotMessage(t("messages.welcome", "你好！我是 **IQ Copilot** ✦"));
  }

  function addUserMessage(text) {
    const chatMessages = document.getElementById("chat-messages");
    const utils = root.utils || {};
    const msg = createMessage("user", text);
    if (chatMessages) chatMessages.appendChild(msg);
    pushChatHistory({ role: "user", content: text });
    utils.trimContainerChildren?.(chatMessages, CONFIG.MAX_CHAT_HISTORY_ENTRIES || 200);
    stats.messages++;
    if (typeof AchievementEngine !== "undefined") {
      AchievementEngine.track("chat_send", { messageLength: text.length, sessionTurns: chatHistory.filter((h) => h.role === "user").length });
    }
    root.panels?.usage?.updateStats?.();
    utils.scrollToBottom?.();
    hideSuggestions();
  }

  function addBotMessage(text) {
    const chatMessages = document.getElementById("chat-messages");
    const utils = root.utils || {};
    const msg = createMessage("bot", text);
    if (chatMessages) chatMessages.appendChild(msg);
    pushChatHistory({ role: "bot", content: text });
    utils.trimContainerChildren?.(chatMessages, CONFIG.MAX_CHAT_HISTORY_ENTRIES || 200);
    utils.scrollToBottom?.();
    return msg;
  }

  // ── Tool Call Cards ──
  function createToolCallCard(name, args) {
    const template = document.getElementById("tool-call-template");
    if (!template) return null;
    const card = template.querySelector(".tool-call-card").cloneNode(true);
    const iconEl = card.querySelector(".tool-call-icon");
    if (iconEl) iconEl.textContent = getToolIcon(name);
    card.querySelector(".tool-call-name").textContent = name;
    card.querySelector(".tool-call-status").textContent = t("tasks.statusRunning", "執行中");
    card.querySelector(".tool-call-status").className = "tool-call-status running";
    card.classList.add("running");
    card.querySelector(".tool-call-args").textContent = typeof args === "string" ? args : JSON.stringify(args, null, 2);
    card.querySelector(".tool-call-result").textContent = localizeRuntimeMessage("等待結果...");
    card.dataset.toolName = name;

    const now = Date.now();
    const entry = { name, status: "running", timestamp: new Date().toISOString(), startedAt: now, endedAt: null, args, result: null };
    toolCalls.push(entry);
    card.dataset.toolIndex = toolCalls.length - 1;

    const timerEl = card.querySelector(".tool-call-timer");
    if (timerEl) {
      timerEl.textContent = "0.0s";
      const timerId = setInterval(() => {
        const elapsedSec = (Date.now() - now) / 1000;
        timerEl.textContent = `${elapsedSec.toFixed(1)}s`;
      }, 100);
      card.__timerId = timerId;
    }

    root.panels?.tasks?.startTaskTimer?.();
    root.panels?.tasks?.renderTasksList?.();

    return card;
  }

  function updateToolCallCard(card, status, result) {
    if (!card) return;
    const timerId = card.__timerId;
    if (timerId) {
      clearInterval(timerId);
      card.__timerId = null;
    }

    const statusEl = card.querySelector(".tool-call-status");
    if (statusEl) {
      const statusLabel = status === "success" ? t("tasks.statusSuccess", "成功")
        : status === "error" ? t("tasks.statusError", "錯誤")
        : t("tasks.statusRunning", "執行中");
      statusEl.textContent = statusLabel;
      statusEl.className = "tool-call-status " + (status === "success" ? "success" : status === "error" ? "error" : "running");
    }
    card.classList.remove("running", "success", "error");
    card.classList.add(status === "success" ? "success" : status === "error" ? "error" : "running");

    if (result != null) {
      const resultEl = card.querySelector(".tool-call-result");
      if (resultEl) resultEl.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      const previewEl = card.querySelector(".tool-call-result-preview");
      if (previewEl) {
        const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        const lines = text.split("\n").slice(0, 3).join("\n");
        previewEl.textContent = lines;
        previewEl.classList.toggle("visible", Boolean(lines.trim()));
      }
    }

    const idx = parseInt(card.dataset.toolIndex, 10);
    if (!isNaN(idx) && toolCalls[idx]) {
      toolCalls[idx].status = status;
      toolCalls[idx].result = result;
      toolCalls[idx].endedAt = Date.now();

      const allDone = toolCalls.every((tc) => tc.status !== "running");
      if (allDone) root.panels?.tasks?.stopTaskTimer?.();

      root.panels?.tasks?.renderTasksList?.();
    }
  }

  function getToolIcon(name) {
    const lower = String(name || "").toLowerCase();
    for (const [key, icon] of Object.entries(TOOL_ICONS)) {
      if (lower.includes(key)) return icon;
    }
    return "🔧";
  }

  function getToolEventId(evtData) {
    return evtData?.toolCallId || evtData?.callId || evtData?.tool_use_id || evtData?.executionId || null;
  }

  function showIntentBar(text, icon = "🤖") {
    const barEl = document.getElementById("intent-bar");
    const textEl = document.getElementById("intent-text");
    const iconEl = barEl?.querySelector(".intent-icon");
    if (!barEl || !textEl) return;
    if (iconEl) iconEl.textContent = icon;
    textEl.textContent = text;
    barEl.classList.remove("fading");
    barEl.style.display = "flex";
  }

  function hideIntentBar() {
    const barEl = document.getElementById("intent-bar");
    if (!barEl) return;
    barEl.classList.add("fading");
    setTimeout(() => {
      barEl.style.display = "none";
      barEl.classList.remove("fading");
    }, 350);
  }

  // ── Streaming Chat ──
  async function ensureSession() {
    const utils = root.utils || {};
    const sendToBackground = utils.sendToBackground;

    if (currentSessionId) return currentSessionId;
    try {
      const config = {};
      const sysVal = document.getElementById("config-system-message")?.value;
      const systemParts = [DEFAULT_SYSTEM_MESSAGE];
      if (sysVal) systemParts.push(sysVal);
      config.systemMessage = systemParts.join("\n\n");
      if (currentModel) config.model = currentModel;
      const res = await sendToBackground({ type: "CREATE_SESSION", config });
      if (res && res.sessionId) {
        currentSessionId = res.sessionId;
        sessionData = res;
        utils.invalidateCache?.("sessions");
        stats.sessions++;
        if (typeof AchievementEngine !== "undefined") {
          AchievementEngine.track("chat_session_new");
        }
        root.panels?.usage?.updateStats?.();
        return currentSessionId;
      }
    } catch (err) {
      utils.showToast?.(localizeRuntimeMessage("建立 Session 失敗: ") + err.message);
    }
    return null;
  }

  async function sendMessageStreaming(text, files = []) {
    const utils = root.utils || {};
    const escapeHtml = utils.escapeHtml || ((s) => s);
    const formatText = utils.formatText || ((s) => s);
    const debugLog = utils.debugLog || console.log;

    const sid = await ensureSession();
    if (!sid) {
      await fallbackSend(text, files);
      return;
    }

    showTyping();
    let bubble = null;
    let content = "";
    let currentToolCard = null;
    let streamDone = false;
    let intentHideTimer = null;
    const activeToolCards = new Map();
    const runningToolOrder = [];

    showIntentBar(localizeRuntimeMessage("處理中..."), "🤖");

    const attachments = files.map((f) => ({
      name: f.name, type: f.type, size: f.size,
      dataUrl: f.dataUrl, textContent: f.textContent || null, isImage: f.isImage,
    }));

    let port = null;
    try {
      port = chrome.runtime.connect({ name: "copilot-stream" });

      port.onMessage.addListener((msg) => {
        if (msg.type === "STREAM_EVENT") {
          removeTyping();
          if (!bubble) bubble = createStreamingBotMessage();

            const parentEl = bubble.parentElement;

          const evt = msg.data || {};
          const evtData = evt.data || {};

          if (evt.type === "assistant.message_delta" && (evtData.deltaContent || evtData.content)) {
              showIntentBar(localizeRuntimeMessage("生成回覆中..."), "✍️");
            content += evtData.deltaContent || evtData.content;
            bubble.innerHTML = formatText(content);
            utils.scrollToBottom?.();
          }
          if (evt.type === "assistant.message" && evtData.content) {
              showIntentBar(localizeRuntimeMessage("整理回覆中..."), "✍️");
            content = evtData.content;
            bubble.innerHTML = formatText(content);
            utils.scrollToBottom?.();
          }
          if (evt.type === "tool.execution_start") {
            const toolName = evtData.toolName || evtData.name || "tool";
            const toolArgs = evtData.arguments || evtData.args || "";
              const toolId = getToolEventId(evtData) || `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            if (typeof AchievementEngine !== "undefined") {
              AchievementEngine.track("agent_call", { agentType: toolName });
            }
            currentToolCard = createToolCallCard(toolName, toolArgs);
            if (currentToolCard) {
                currentToolCard.dataset.toolId = toolId;
                activeToolCards.set(toolId, currentToolCard);
                runningToolOrder.push(toolId);
                parentEl?.appendChild(currentToolCard);
                showIntentBar(`${localizeRuntimeMessage("執行工具")} · ${toolName}`, "🔧");
              utils.scrollToBottom?.();
            }
          }
          if (evt.type === "tool.execution_complete") {
              const toolId = getToolEventId(evtData);
              let targetCard = toolId ? activeToolCards.get(toolId) : null;
              if (!targetCard && runningToolOrder.length > 0) {
                const latestId = runningToolOrder.pop();
                targetCard = activeToolCards.get(latestId);
                if (latestId) activeToolCards.delete(latestId);
              } else if (toolId) {
                activeToolCards.delete(toolId);
              }
              updateToolCallCard(targetCard || currentToolCard, "success", evtData.result || evtData.output || t("tasks.done", "完成"));
              currentToolCard = null;
              showIntentBar(localizeRuntimeMessage("工具執行完成"), "✅");
          }
          if (evt.type === "session.error") {
            const errMsg = evtData.message || "Session error";
            content += `\n⚠ ${errMsg}`;
            bubble.innerHTML = formatText(content);
            if (currentToolCard) updateToolCallCard(currentToolCard, "error", errMsg);
              showIntentBar(localizeRuntimeMessage("發生錯誤"), "⚠️");
          }

          // Usage tracking
          if (evt.type === "assistant.usage") {
            tokenDetails.apiCalls++;
            if (evtData.inputTokens) tokenDetails.inputTokens += evtData.inputTokens;
            if (evtData.outputTokens) tokenDetails.outputTokens += evtData.outputTokens;
            if (evtData.cacheReadTokens) tokenDetails.cacheReadTokens += evtData.cacheReadTokens;
            if (evtData.cacheWriteTokens) tokenDetails.cacheWriteTokens += evtData.cacheWriteTokens;
            if (evtData.cost) tokenDetails.cost += evtData.cost;
            stats.tokens = tokenDetails.inputTokens + tokenDetails.outputTokens;
            debugLog("USAGE", `tokens in=${evtData.inputTokens || 0} out=${evtData.outputTokens || 0} model=${evtData.model || "-"}`);
            root.panels?.usage?.updateStats?.();
          }

          if (evt.type === "session.usage_info" && evtData.currentTokens) {
            debugLog("USAGE", `context tokens=${evtData.currentTokens} limit=${evtData.tokenLimit}`);
          }
        }

        if (msg.type === "STREAM_DONE") {
          streamDone = true;
          removeTyping();
          root.panels?.tasks?.stopTaskTimer?.();
          toolCalls.forEach((tc) => { if (tc.status === "running") { tc.status = "success"; tc.endedAt = Date.now(); } });
          activeToolCards.forEach((card) => updateToolCallCard(card, "success", t("tasks.done", "完成")));
          activeToolCards.clear();
          root.panels?.tasks?.renderTasksList?.();
          if (!bubble) bubble = createStreamingBotMessage();
          if (!content) {
            const final = msg.data?.content || msg.data?.text || "";
            if (final) {
              content = formatNewsResponse(final);
              bubble.innerHTML = formatText(content);
            }
          } else {
            content = formatNewsResponse(content);
            bubble.innerHTML = formatText(content);
          }
          const streamEl = document.getElementById("streaming-msg");
          if (streamEl) streamEl.removeAttribute("id");
          pushChatHistory({ role: "bot", content });
          if (intentHideTimer) clearTimeout(intentHideTimer);
          intentHideTimer = setTimeout(() => hideIntentBar(), 600);
          safeDisconnectPort(port);
        }

        if (msg.type === "STREAM_ERROR") {
          streamDone = true;
          removeTyping();
          root.panels?.tasks?.stopTaskTimer?.();
          toolCalls.forEach((tc) => { if (tc.status === "running") { tc.status = "error"; tc.endedAt = Date.now(); } });
          activeToolCards.forEach((card) => updateToolCallCard(card, "error", localizeRuntimeMessage("串流錯誤")));
          activeToolCards.clear();
          root.panels?.tasks?.renderTasksList?.();
          if (!bubble) bubble = createStreamingBotMessage();
          const errText = msg.error || msg.message || localizeRuntimeMessage("串流錯誤");
          bubble.innerHTML = `<span style="color:var(--error)">⚠ ${escapeHtml(errText)}</span>`;
          const streamEl = document.getElementById("streaming-msg");
          if (streamEl) streamEl.removeAttribute("id");
          pushChatHistory({ role: "bot", content: errText });
          if (currentToolCard) updateToolCallCard(currentToolCard, "error", errText);
          if (intentHideTimer) clearTimeout(intentHideTimer);
          showIntentBar(localizeRuntimeMessage("回覆失敗"), "⚠️");
          intentHideTimer = setTimeout(() => hideIntentBar(), 900);
          safeDisconnectPort(port);
        }
      });

      port.onDisconnect.addListener(() => {
        if (!streamDone) {
          removeTyping();
          if (!content) fallbackSend(text);
        }
      });

      const enrichedPrompt = await enrichPromptWithTabContext(text);
      port.postMessage({ type: "STREAM_SEND", sessionId: sid, prompt: enrichedPrompt, attachments });
    } catch {
      safeDisconnectPort(port);
      removeTyping();
      await fallbackSend(text, files);
    }
  }

  async function fallbackSend(text, files = []) {
    const utils = root.utils || {};
    const sendToBackground = utils.sendToBackground;

    showTyping();
    try {
      const sid = currentSessionId || (await ensureSession());
      if (!sid) {
        removeTyping();
        addBotMessage(localizeRuntimeMessage("⚠ 無法建立 Session"));
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
      root.panels?.usage?.updateStats?.();
    } catch (err) {
      removeTyping();
      addBotMessage("⚠ " + err.message);
    }
  }

  async function simulateResponse(userText) {
    await new Promise((r) => setTimeout(r, (CONFIG.SIMULATE_DELAY_BASE_MS || 800) + Math.random() * (CONFIG.SIMULATE_DELAY_RANDOM_MS || 1200)));
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

  function safeDisconnectPort(port) {
    if (!port) return;
    try { port.disconnect(); } catch { /* ignore */ }
  }

  root.chat = {
    safeDisconnectPort,
    getState,
    setCurrentSessionId,
    setCurrentModel,
    setSessionData,
    setAvailableModels,
    clearTaskActivity,
    pushChatHistory,
    resetChatState,
    fetchCurrentTabInfo,
    buildBrowserContext,
    enrichPromptWithTabContext,
    DEFAULT_SYSTEM_MESSAGE,
    createMessage,
    createStreamingBotMessage,
    showTyping,
    removeTyping,
    hideSuggestions,
    showWelcome,
    addUserMessage,
    addBotMessage,
    createToolCallCard,
    updateToolCallCard,
    ensureSession,
    sendMessageStreaming,
    fallbackSend,
    simulateResponse,
  };
})(window);
