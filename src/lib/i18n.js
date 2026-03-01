(function initIQI18n(global) {
  const root = global.IQ || (global.IQ = {});

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
      tasks: {
        running: "進行中",
        done: "完成",
        noEvents: "尚無事件",
        subAgentPrefix: "子代理：",
        args: "參數",
        result: "結果",
        defaultTool: "工具",
        notAvailable: "—",
        secondsShort: "s",
        statusRunning: "執行中",
        statusSuccess: "成功",
        statusError: "錯誤",
      },
    },
    en: {
      panelTitles: {
        chat: "IQ Copilot",
        context: "Context",
        agent: "Agent",
        history: "History",
        usage: "Usage",
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
        welcome: "Hi! I'm **IQ Copilot** ✦\n\nI can help analyze the current page, summarize content, and translate text. What can I help you with?",
        themeChanged: "Theme switched",
        languageChanged: "Language switched to English",
        foundryConfigured: "Configured",
        foundryNotConfigured: "Not configured",
        processing: "Processing...",
        browserPage: "Browser Page",
        webPage: "Web Page",
        pdfDoc: "PDF Document",
      },
      tasks: {
        running: "running",
        done: "done",
        noEvents: "No events yet",
        subAgentPrefix: "Sub-Agent: ",
        args: "Args",
        result: "Result",
        defaultTool: "tool",
        notAvailable: "—",
        secondsShort: "s",
        statusRunning: "running",
        statusSuccess: "success",
        statusError: "error",
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
    "翻譯此頁": "Translate this page",
    "解釋此頁": "Explain this page",
    "問個問題": "Ask a question",
    "最近微軟新聞": "Latest Microsoft news",
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
    "已下載範本檔案": "Sample config downloaded",
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
    "全部已讀": "Mark all read",
    "已全部標記為已讀": "All notifications marked as read",
    "已讀": "Mark read",
    "Proactive Prompt 已儲存": "Proactive prompt saved",
    "Proactive Prompt 已清除": "Proactive prompt cleared",
    "✅ 已完成": "✅ Completed",
    "預設": "Default",
    "自訂": "Custom",
    "刪除此自訂 Agent": "Delete this custom agent",
    "預設 Agent 不可刪除": "Default agent cannot be deleted",
    "通用型助手，適合大部分任務": "General-purpose assistant for most tasks",
    "程式碼分析、除錯、最佳化": "Code analysis, debugging, and optimization",
    "文章撰寫、摘要、翻譯": "Writing, summarization, and translation",
    "深度研究、資料分析": "Deep research and data analysis",
    "超過 10MB 限制": "exceeds 10MB limit",
    "讀取 ": "Read ",
    " 失敗: ": " failed: ",
    "移除": "Remove",
    "連接 CLI 以查看歷史": "Connect CLI to view history",
    "未命名對話": "Untitled conversation",
    "刪除": "Delete",
    "已恢復對話": "Conversation resumed",
    "剩餘 ": "Remaining ",
    "重置: ": "Reset: ",
    "超額: ": "Overage: ",
    "✦ 使用中": "✦ Active",
    "自訂 ": "Custom ",
    "Skill 名稱不能為空": "Skill name cannot be empty",
    "已有同名自訂 skill": "A custom skill with this name already exists",
    "已新增 skill: ": "Added skill: ",
    "已刪除 skill: ": "Deleted skill: ",
    "離線 · 自訂 ": "Offline · Custom ",
    "刪除自訂 Skill": "Delete custom skill",
    "確定要刪除自訂 Skill「": "Delete custom skill \"",
    "切換模型中: ": "Switching model: ",
    "模型切換失敗: ": "Model switch failed: ",
    "Quota 額度": "Quota",
    "從 Copilot CLI 取得": "Fetched from Copilot CLI",
    "串流錯誤": "Stream error",
    "⚠ 無法建立 Session": "⚠ Unable to create session",
    "頁面摘要": "Page Summary",
    "這是一個位於 ": "This is a page on ",
    " 的頁面。目前為模擬摘要功能 — 實際使用時，IQ Copilot 會呼叫 AI 模型來產生精確的頁面內容摘要。": " . This is a simulated summary feature — in real use, IQ Copilot calls AI models to produce accurate page summaries.",
    "> 提示：你可以連接 MCP 伺服器來啟用真正的 AI 功能。": "> Tip: You can connect an MCP server to enable real AI features.",
    "翻譯功能": "Translation",
    "請告訴我你要翻譯哪段文字，以及目標語言。你也可以先選取頁面上的文字，我會自動偵測。": "Tell me what text you want translated and the target language. You can also select text on the page and I will auto-detect it.",
    "支援語言：中文、英文、日文、韓文、法文、德文等。": "Supported languages: Chinese, English, Japanese, Korean, French, German, etc.",
    "頁面解釋": "Page Explanation",
    "你正在瀏覽 **": "You are viewing **",
    "**。\n\n這個頁面的類型偵測為：": "**.\n\nDetected page type: ",
    "。\n\n需要我更深入地解釋特定內容嗎？": ".\n\nNeed a deeper explanation of specific content?",
    "收到你的訊息：「": "Received your message: \"",
    "這是 IQ Copilot 的模擬回覆。連接 AI 後端（透過 MCP 面板設定）後，你將獲得真正的智慧回覆。": "This is a simulated IQ Copilot reply. After connecting an AI backend (via the MCP panel), you will get real intelligent responses.",
    "你也可以試試：": "You can also try:",
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
    const skipRoots = new Set(["chat-messages", "debug-log"]);

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
    if (chips.length >= 3) {
      if (currentLanguage === "en") {
        chips[0].textContent = "🌐 Translate this page";
        chips[1].textContent = "💡 Explain this page";
        chips[2].textContent = "📰 Latest Microsoft news";
      } else {
        chips[0].textContent = "🌐 翻譯此頁";
        chips[1].textContent = "💡 解釋此頁";
        chips[2].textContent = "📰 最近微軟新聞";
      }
    }

    const intent = document.getElementById("intent-text");
    if (intent && (!intent.textContent || /Processing|處理中/.test(intent.textContent))) {
      intent.textContent = t("messages.processing", "Processing...");
    }

    const panelTitleMap = t("panelTitles", {});
    const panelTitleEl = document.getElementById("panel-title");
    const activePanel = document.querySelector(".panel.active")?.id?.replace("panel-", "");
    if (activePanel && panelTitleEl) {
      panelTitleEl.textContent = panelTitleMap[activePanel] || "IQ Copilot";
    }

    document.documentElement.lang = currentLanguage === "en" ? "en" : "zh-TW";
  }

  function localizeRuntimeMessage(message) {
    if (currentLanguage !== "en") return message;
    return replaceByMap(message, STATIC_ZH_EN);
  }

  function getLanguage() {
    return currentLanguage;
  }

  function setLanguage(lang) {
    currentLanguage = lang === "en" ? "en" : "zh-TW";
  }

  function getTheme() {
    return currentTheme;
  }

  function setTheme(theme) {
    currentTheme = theme === "light" ? "light" : "dark";
  }

  root.i18n = {
    I18N,
    STATIC_ZH_EN,
    STATIC_EN_ZH,
    t,
    replaceByMap,
    translateStaticUi,
    localizeRuntimeMessage,
    getLanguage,
    setLanguage,
    getTheme,
    setTheme,
  };
})(window);
