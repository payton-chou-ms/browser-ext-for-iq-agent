(function initIQUtils(global) {
  const root = global.IQ || (global.IQ = {});
  const CONFIG = root.state?.CONFIG || {};
  const i18n = root.i18n || {};

  function pushWithLimitImmutable(array, item, maxSize) {
    const next = [...(Array.isArray(array) ? array : []), item];
    if (!Number.isFinite(maxSize) || maxSize <= 0) return next;
    return next.length > maxSize ? next.slice(next.length - maxSize) : next;
  }

  function trimContainerChildren(container, maxSize) {
    if (!container || !Number.isFinite(maxSize) || maxSize <= 0) return;
    while (container.children.length > maxSize) {
      container.removeChild(container.firstElementChild);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message) {
    const container = document.getElementById("toast-container");
    const localizeRuntimeMessage = i18n.localizeRuntimeMessage || ((m) => m);
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = localizeRuntimeMessage(message);
    container.appendChild(toast);
    setTimeout(() => toast.remove(), CONFIG.TOAST_DURATION_MS || 2200);
  }

  function scrollToBottom() {
    const chatMessages = document.getElementById("chat-messages");
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function formatTokenCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function relativeTime(isoStr) {
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

  // ── Chrome messaging helper ──
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

  // ── Cache + TTL system with LRU eviction ──
  const MAX_CACHE_ENTRIES = CONFIG.MAX_CACHE_ENTRIES || 50;
  const _dataCache = Object.create(null);
  const _cacheOrder = []; // Track insertion order for LRU eviction

  const CACHE_TTL = Object.freeze({
    models:   CONFIG.CACHE_TTL_MODELS_MS || 300000,
    tools:    CONFIG.CACHE_TTL_TOOLS_MS || 300000,
    quota:    CONFIG.CACHE_TTL_QUOTA_MS || 120000,
    sessions: CONFIG.CACHE_TTL_SESSIONS_MS || 30000,
    context:  CONFIG.CACHE_TTL_CONTEXT_MS || 120000,
  });

  function getCached(key) {
    const entry = _dataCache[key];
    if (!entry) return undefined;
    if (Date.now() - entry.ts > (CACHE_TTL[key] || CONFIG.CACHE_TTL_DEFAULT_MS || 60000)) {
      delete _dataCache[key];
      const idx = _cacheOrder.indexOf(key);
      if (idx !== -1) _cacheOrder.splice(idx, 1);
      return undefined;
    }
    return entry.data;
  }

  function setCache(key, data) {
    // Remove existing entry from order if present
    const existingIdx = _cacheOrder.indexOf(key);
    if (existingIdx !== -1) _cacheOrder.splice(existingIdx, 1);

    // Evict oldest entries if at capacity
    while (_cacheOrder.length >= MAX_CACHE_ENTRIES) {
      const oldestKey = _cacheOrder.shift();
      delete _dataCache[oldestKey];
    }

    _dataCache[key] = { data, ts: Date.now() };
    _cacheOrder.push(key);
  }

  function invalidateCache(key) {
    if (key) {
      delete _dataCache[key];
      const idx = _cacheOrder.indexOf(key);
      if (idx !== -1) _cacheOrder.splice(idx, 1);
    } else {
      Object.keys(_dataCache).forEach((k) => delete _dataCache[k]);
      _cacheOrder.length = 0;
    }
  }

  async function cachedSendToBackground(cacheKey, msg) {
    const cached = getCached(cacheKey);
    if (cached !== undefined) {
      debugLog("CACHE", `HIT [${cacheKey}]`);
      return cached;
    }
    debugLog("CACHE", `MISS [${cacheKey}], fetching...`);
    const data = await sendToBackground(msg);
    setCache(cacheKey, data);
    return data;
  }

  // ── Debug Log ──
  function debugLog(tag, ...args) {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
    const line = `[${ts}] [${tag}] ${msg}`;
    console.log(line);
    const debugLogEl = document.getElementById("debug-log");
    if (debugLogEl) {
      const span = document.createElement("div");
      span.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
      span.style.padding = "2px 0";
      const tagColors = { CONN: "#48bb78", RPC: "#63b3ed", ERR: "#fc8181", INFO: "#d6bcfa", CFG: "#fbd38d" };
      span.innerHTML = `<span style="color:#718096">[${ts}]</span> <span style="color:${tagColors[tag] || '#a0aec0'}">[${tag}]</span> ${escapeHtml(msg)}`;
      debugLogEl.appendChild(span);
      trimContainerChildren(debugLogEl, CONFIG.MAX_DEBUG_LOG_ENTRIES || 500);
      debugLogEl.scrollTop = debugLogEl.scrollHeight;
    }
  }

  root.utils = {
    pushWithLimitImmutable,
    trimContainerChildren,
    escapeHtml,
    showToast,
    scrollToBottom,
    formatText,
    formatTokenCount,
    formatFileSize,
    relativeTime,
    sendToBackground,
    getCached,
    setCache,
    invalidateCache,
    cachedSendToBackground,
    debugLog,
  };
})(window);
