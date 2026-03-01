(function initIQPanelUsage(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const i18n = root.i18n || {};

  let quotaData = null;

  function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
  function isConnected() { return root.connection?.isConnected?.() || false; }

  function formatTokenCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }

  function updateStats() {
    const chatState = root.chat?.getState?.() || {};
    const stats = chatState.stats || { messages: 0, tokens: 0, sessions: 0, pages: 0 };
    const tokenDetails = chatState.tokenDetails || { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0, apiCalls: 0 };
    const toolCalls = chatState.toolCalls || [];

    const el = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = val;
    };
    el("stat-messages", stats.messages);
    el("stat-tokens", formatTokenCount(stats.tokens));
    el("stat-sessions", stats.sessions);
    el("stat-pages", stats.pages);

    el("td-input", formatTokenCount(tokenDetails.inputTokens));
    el("td-output", formatTokenCount(tokenDetails.outputTokens));
    el("td-cache-read", formatTokenCount(tokenDetails.cacheReadTokens));
    el("td-cache-write", formatTokenCount(tokenDetails.cacheWriteTokens));
    el("td-cost", tokenDetails.cost > 0 ? `$${tokenDetails.cost.toFixed(4)}` : "$0.00");
    el("td-api-calls", tokenDetails.apiCalls);

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

  }

  function renderModelsCard() {
    const card = document.getElementById("models-card");
    if (card) card.remove();
  }

  async function switchModel(modelName) {
    const chatState = root.chat?.getState?.() || {};
    const prevModel = chatState.currentModel;
    root.chat?.setCurrentModel?.(modelName);
    chrome.storage.local.set({ selectedModel: modelName });

    // Save to active tab (per-tab model support)
    const CHAT_TABS = root.chatTabs || {};
    const activeTab = CHAT_TABS.getActiveTab?.();
    if (activeTab) {
      CHAT_TABS.setTabModel?.(activeTab.id, modelName);
    }

    const sel = document.getElementById("config-model");
    if (sel) sel.value = modelName;

    utils.showToast?.(`${localizeRuntimeMessage("切換模型中: ")}${modelName}…`);
    utils.debugLog?.("CFG", `Model switching to: ${modelName}`);

    const currentSessionId = chatState.currentSessionId;
    if (currentSessionId && isConnected()) {
      try {
        const res = await utils.sendToBackground?.({ type: "SWITCH_MODEL", sessionId: currentSessionId, modelId: modelName });
        if (res && res.ok) {
          utils.showToast?.(`${localizeRuntimeMessage("已切換模型: ")}${modelName}`);
          utils.debugLog?.("CFG", `Model switched successfully: ${res.modelId || modelName}`);
        } else {
          utils.showToast?.(`${localizeRuntimeMessage("模型切換失敗: ")}${localizeRuntimeMessage(res?.error || "unknown")}`, "error");
          utils.debugLog?.("ERR", "Model switch failed:", res);
          root.chat?.setCurrentModel?.(prevModel);
          chrome.storage.local.set({ selectedModel: prevModel });
          if (sel) sel.value = prevModel;
        }
      } catch (err) {
        utils.showToast?.(`${localizeRuntimeMessage("模型切換失敗: ")}${err.message}`, "error");
        utils.debugLog?.("ERR", "Model switch error:", err);
        root.chat?.setCurrentModel?.(prevModel);
        chrome.storage.local.set({ selectedModel: prevModel });
        if (sel) sel.value = prevModel;
      }
    } else {
      utils.showToast?.(`${localizeRuntimeMessage("已選定模型: ")}${modelName}${localizeRuntimeMessage("（下次交談使用）")}`);
    }
  }

  async function loadQuotaFromCli() {
    if (!isConnected()) return;
    try {
      const quota = await utils.sendToBackground?.({ type: "GET_QUOTA" });
      utils.debugLog?.("QUOTA", "GET_QUOTA response:", quota);
      if (quota && typeof quota === "object" && Object.keys(quota).length > 0) {
        quotaData = quota;
        renderQuotaCard();
      }
    } catch (err) {
      utils.debugLog?.("ERR", "loadQuotaFromCli error:", err.message);
    }
  }

  function renderQuotaCard() {
    if (!quotaData || Object.keys(quotaData).length === 0) return;

    let card = document.getElementById("quota-card");
    const scrollEl = document.querySelector("#panel-usage .panel-scroll");
    if (!scrollEl) return;

    const helpers = root.panels?.helpers || {};

    if (!card) {
      card = document.createElement("div");
      card.id = "quota-card";
      card.className = "glass-card";
      const firstCard = scrollEl.querySelector(".glass-card");
      if (firstCard && firstCard.nextSibling) {
        scrollEl.insertBefore(card, firstCard.nextSibling);
      } else {
        scrollEl.appendChild(card);
      }
    }

    let html = `<div class="card-header"><span class="card-icon">📦</span><h3>${localizeRuntimeMessage("Quota 額度")}</h3></div>`;
    html += '<div class="token-detail-grid">';

    for (const [type, snap] of Object.entries(quotaData)) {
      const used = snap.usedRequests || 0;
      const total = snap.entitlementRequests || 0;
      const remaining = snap.remainingPercentage ?? 100;
      const overage = snap.overage || 0;
      const resetDate = snap.resetDate ? new Date(snap.resetDate).toLocaleDateString("zh-TW") : "—";
      html += helpers.renderQuotaBar?.({ type, used, total, remaining, overage, resetDate }) || "";
    }

    html += '</div>';
    html += `<p class="text-muted quota-source-note">${localizeRuntimeMessage("從 Copilot CLI 取得")}</p>`;
    card.innerHTML = html;
  }

  function populateModelSelect(models) {
    const sel = document.getElementById("config-model");
    if (!sel) return;

    const chatState = root.chat?.getState?.() || {};
    const currentModel = chatState.currentModel;

    const getModelId = (m) => typeof m === "string" ? m : m?.id || m?.name || String(m);
    const getModelLabel = (m) => typeof m === "string" ? m : m?.name || m?.id || String(m);

    const matched = models.find((m) => {
      const id = getModelId(m);
      const label = getModelLabel(m);
      return currentModel === id || currentModel === label;
    });
    if (matched) {
      const normalized = getModelId(matched);
      if (normalized !== currentModel) {
        root.chat?.setCurrentModel?.(normalized);
        chrome.storage.local.set({ selectedModel: normalized });
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

  root.panels.usage = {
    updateStats,
    switchModel,
    loadQuotaFromCli,
    populateModelSelect,
    renderModelsCard,
    formatTokenCount,
  };
})(window);
