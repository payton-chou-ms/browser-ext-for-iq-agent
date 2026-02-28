// ===== IQ Copilot — Multi-Tab Chat Manager =====
// Manages multiple concurrent chat sessions with tab-based UI.
// Max 10 tabs, each with independent session state.

(function initIQChatTabs(global) {
  const root = global.IQ || (global.IQ = {});

  const MAX_TABS = 10;
  const STORAGE_KEY = "iq_chat_tabs";
  const MAX_HISTORY_PER_TAB = 100;

  // ── Default Tab Factory ──
  function createDefaultTab(id) {
    return {
      id: id || `tab-${Date.now()}`,
      sessionId: null,
      title: "新對話",
      status: "idle", // 'idle' | 'running' | 'error'
      model: null, // Per-tab model selection (null = use global default)
      enabledSkills: null, // Per-tab skill filter (null = all skills enabled)
      chatHistory: [],
      toolCalls: [],
      tokenDetails: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cost: 0,
        apiCalls: 0,
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
  }

  // ── State ──
  let tabs = [];
  let activeTabId = null;
  let listeners = [];
  let initialized = false;

  // ── Event System ──
  function emit(event, data) {
    for (const fn of listeners) {
      try {
        fn(event, data);
      } catch (e) {
        console.error("[ChatTabs] listener error:", e);
      }
    }
  }

  function onEvent(fn) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((f) => f !== fn);
    };
  }

  // ── Storage ──
  async function saveTabs() {
    try {
      const data = {
        tabs: tabs.map((t) => ({
          ...t,
          // Limit chatHistory to avoid storage overflow
          chatHistory: t.chatHistory.slice(-MAX_HISTORY_PER_TAB),
          // Don't persist running status
          status: t.status === "running" ? "idle" : t.status,
        })),
        activeTabId,
      };
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: data });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.error("[ChatTabs] saveTabs error:", e);
    }
  }

  async function loadTabs() {
    try {
      let data = null;
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        data = result[STORAGE_KEY];
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        data = raw ? JSON.parse(raw) : null;
      }

      if (data && Array.isArray(data.tabs) && data.tabs.length > 0) {
        tabs = data.tabs.map((t) => ({
          ...createDefaultTab(t.id),
          ...t,
          status: "idle", // Reset status on load
        }));
        activeTabId = data.activeTabId || tabs[0].id;
      } else {
        // No saved tabs, create initial tab
        const initial = createDefaultTab();
        tabs = [initial];
        activeTabId = initial.id;
      }
    } catch (e) {
      console.error("[ChatTabs] loadTabs error:", e);
      const initial = createDefaultTab();
      tabs = [initial];
      activeTabId = initial.id;
    }
    initialized = true;
  }

  // ── Tab CRUD ──
  function createTab() {
    if (tabs.length >= MAX_TABS) {
      emit("error", { message: `已達最大對話數量 (${MAX_TABS})` });
      return null;
    }

    const newTab = createDefaultTab();
    tabs = [...tabs, newTab];
    activeTabId = newTab.id;

    saveTabs();
    emit("tabCreated", { tab: newTab });
    emit("activeTabChanged", { tabId: activeTabId });
    return newTab;
  }

  function getTab(tabId) {
    return tabs.find((t) => t.id === tabId) || null;
  }

  function getActiveTab() {
    return tabs.find((t) => t.id === activeTabId) || null;
  }

  function getAllTabs() {
    return [...tabs];
  }

  function switchTab(tabId) {
    const tab = getTab(tabId);
    if (!tab || activeTabId === tabId) return false;

    activeTabId = tabId;
    tab.lastActiveAt = new Date().toISOString();

    saveTabs();
    emit("activeTabChanged", { tabId });
    return true;
  }

  async function closeTab(tabId, options = {}) {
    const tab = getTab(tabId);
    if (!tab) return false;

    const { force = false, destroySession } = options;

    // Confirm if running and not forced
    if (tab.status === "running" && !force) {
      emit("confirmClose", { tabId, tab });
      return false; // Caller should handle confirmation
    }

    // Destroy server session if callback provided
    if (tab.sessionId && typeof destroySession === "function") {
      try {
        await destroySession(tab.sessionId);
      } catch (e) {
        console.error("[ChatTabs] destroySession error:", e);
      }
    }

    // Remove tab
    tabs = tabs.filter((t) => t.id !== tabId);

    // Handle active tab change
    if (tabs.length === 0) {
      const newTab = createDefaultTab();
      tabs = [newTab];
      activeTabId = newTab.id;
    } else if (activeTabId === tabId) {
      activeTabId = tabs[tabs.length - 1].id;
    }

    saveTabs();
    emit("tabClosed", { tabId });
    emit("activeTabChanged", { tabId: activeTabId });
    return true;
  }

  // ── Tab State Updates ──
  function updateTab(tabId, updates) {
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return null;

    const updatedTab = { ...tabs[idx], ...updates, lastActiveAt: new Date().toISOString() };
    tabs = [...tabs.slice(0, idx), updatedTab, ...tabs.slice(idx + 1)];

    // Auto-title from first user message
    if (updates.chatHistory && updatedTab.title === "新對話") {
      const firstUserMsg = updatedTab.chatHistory.find((m) => m.role === "user");
      if (firstUserMsg) {
        const preview = firstUserMsg.content.slice(0, 30);
        updatedTab.title = preview + (firstUserMsg.content.length > 30 ? "…" : "");
      }
    }

    saveTabs();
    emit("tabUpdated", { tabId, tab: updatedTab });
    return updatedTab;
  }

  function setTabStatus(tabId, status) {
    return updateTab(tabId, { status });
  }

  function setTabSessionId(tabId, sessionId) {
    return updateTab(tabId, { sessionId });
  }

  function pushChatMessage(tabId, message) {
    const tab = getTab(tabId);
    if (!tab) return null;

    const newHistory = [...tab.chatHistory, { ...message, timestamp: new Date().toISOString() }];
    return updateTab(tabId, { chatHistory: newHistory.slice(-MAX_HISTORY_PER_TAB) });
  }

  function pushToolCall(tabId, toolCall) {
    const tab = getTab(tabId);
    if (!tab) return null;

    const entry = {
      ...toolCall,
      startedAt: Date.now(),
      endedAt: null,
      status: "running",
    };
    return updateTab(tabId, { toolCalls: [...tab.toolCalls, entry] });
  }

  function updateToolCall(tabId, toolIndex, updates) {
    const tab = getTab(tabId);
    if (!tab || toolIndex < 0 || toolIndex >= tab.toolCalls.length) return null;

    const updatedToolCalls = tab.toolCalls.map((tc, i) =>
      i === toolIndex ? { ...tc, ...updates } : tc
    );
    return updateTab(tabId, { toolCalls: updatedToolCalls });
  }

  function clearToolCalls(tabId) {
    return updateTab(tabId, { toolCalls: [] });
  }

  function setTabModel(tabId, model) {
    return updateTab(tabId, { model });
  }

  function setTabEnabledSkills(tabId, enabledSkills) {
    return updateTab(tabId, { enabledSkills });
  }

  function updateTokenDetails(tabId, tokenUpdates) {
    const tab = getTab(tabId);
    if (!tab) return null;

    const newTokenDetails = { ...tab.tokenDetails };
    if (tokenUpdates.inputTokens) newTokenDetails.inputTokens += tokenUpdates.inputTokens;
    if (tokenUpdates.outputTokens) newTokenDetails.outputTokens += tokenUpdates.outputTokens;
    if (tokenUpdates.cacheReadTokens) newTokenDetails.cacheReadTokens += tokenUpdates.cacheReadTokens;
    if (tokenUpdates.cacheWriteTokens) newTokenDetails.cacheWriteTokens += tokenUpdates.cacheWriteTokens;
    if (tokenUpdates.cost) newTokenDetails.cost += tokenUpdates.cost;
    if (tokenUpdates.apiCalls) newTokenDetails.apiCalls += tokenUpdates.apiCalls;

    return updateTab(tabId, { tokenDetails: newTokenDetails });
  }

  // ── Aggregate Helpers ──
  function getTotalTokenDetails() {
    const total = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      cost: 0,
      apiCalls: 0,
    };
    for (const tab of tabs) {
      total.inputTokens += tab.tokenDetails.inputTokens;
      total.outputTokens += tab.tokenDetails.outputTokens;
      total.cacheReadTokens += tab.tokenDetails.cacheReadTokens;
      total.cacheWriteTokens += tab.tokenDetails.cacheWriteTokens;
      total.cost += tab.tokenDetails.cost;
      total.apiCalls += tab.tokenDetails.apiCalls;
    }
    return total;
  }

  function getRunningTabs() {
    return tabs.filter((t) => t.status === "running");
  }

  function getTabCount() {
    return tabs.length;
  }

  function getMaxTabs() {
    return MAX_TABS;
  }

  // ── Init ──
  async function init() {
    if (initialized) return;
    await loadTabs();
    emit("initialized", { tabs, activeTabId });
  }

  // ── Export ──
  root.chatTabs = {
    // Lifecycle
    init,
    onEvent,

    // Tab CRUD
    createTab,
    getTab,
    getActiveTab,
    getAllTabs,
    switchTab,
    closeTab,

    // Tab state updates
    updateTab,
    setTabStatus,
    setTabSessionId,
    setTabModel,
    setTabEnabledSkills,
    pushChatMessage,
    pushToolCall,
    updateToolCall,
    clearToolCalls,
    updateTokenDetails,

    // Aggregates
    getTotalTokenDetails,
    getRunningTabs,
    getTabCount,
    getMaxTabs,

    // Constants
    MAX_TABS,
  };
})(window);
