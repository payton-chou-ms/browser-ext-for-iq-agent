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

  function formatInlineMarkdown(line) {
    if (!line) return "";

    const codeTokens = [];
    let parsed = line.replace(/`([^`\n]+)`/g, (_m, code) => {
      const token = `@@IQCODE${codeTokens.length}@@`;
      codeTokens.push(`<code>${code}</code>`);
      return token;
    });

    parsed = parsed
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>");

    codeTokens.forEach((tokenHtml, index) => {
      parsed = parsed.replace(`@@IQCODE${index}@@`, tokenHtml);
    });

    return parsed;
  }

  function formatText(text) {
    const safeText = escapeHtml(String(text ?? "")).replace(/\r\n?/g, "\n");
    const lines = safeText.split("\n");
    const html = [];

    let inCodeBlock = false;
    let codeBlockLang = "";
    let codeBlockLines = [];
    let inUnorderedList = false;
    let inOrderedList = false;
    let paragraphLines = [];
    let blockquoteLines = [];

    const flushParagraph = () => {
      if (paragraphLines.length === 0) return;
      html.push(`<p>${paragraphLines.map((line) => formatInlineMarkdown(line)).join("<br>")}</p>`);
      paragraphLines = [];
    };

    const flushBlockquote = () => {
      if (blockquoteLines.length === 0) return;
      html.push(`<blockquote><p>${blockquoteLines.map((line) => formatInlineMarkdown(line)).join("<br>")}</p></blockquote>`);
      blockquoteLines = [];
    };

    const flushCodeBlock = () => {
      const languageClass = codeBlockLang ? ` class="language-${codeBlockLang}"` : "";
      html.push(`<pre><code${languageClass}>${codeBlockLines.join("\n")}</code></pre>`);
      codeBlockLines = [];
      codeBlockLang = "";
    };

    const closeLists = () => {
      if (inUnorderedList) {
        html.push("</ul>");
        inUnorderedList = false;
      }
      if (inOrderedList) {
        html.push("</ol>");
        inOrderedList = false;
      }
    };

    const parseMarkdownTableRow = (row) => {
      const normalized = row.trim().replace(/^\|/, "").replace(/\|$/, "");
      return normalized.split("|").map((cell) => cell.trim());
    };

    const isMarkdownTableSeparator = (row) => {
      const normalized = row.trim().replace(/^\|/, "").replace(/\|$/, "");
      if (!normalized) return false;
      const cols = normalized.split("|").map((cell) => cell.trim());
      if (cols.length === 0) return false;
      return cols.every((cell) => /^:?-{3,}:?$/.test(cell));
    };

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const rawLine = lines[lineIndex];
      const line = rawLine.trim();

      const codeFenceMatch = line.match(/^```(\w+)?\s*$/);
      if (codeFenceMatch) {
        flushParagraph();
        flushBlockquote();
        closeLists();

        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = codeFenceMatch[1] || "";
          codeBlockLines = [];
        } else {
          flushCodeBlock();
          inCodeBlock = false;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(rawLine);
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        flushBlockquote();
        closeLists();
        const level = headingMatch[1].length;
        html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
        flushParagraph();
        flushBlockquote();
        closeLists();
        html.push("<hr>");
        continue;
      }

      const blockquoteMatch = rawLine.match(/^(?:>|&gt;)\s?(.*)$/);
      if (blockquoteMatch) {
        flushParagraph();
        closeLists();
        blockquoteLines.push(blockquoteMatch[1]);
        continue;
      }

      flushBlockquote();

      const nextLine = lines[lineIndex + 1]?.trim() || "";
      const isTableHeader = line.includes("|") && isMarkdownTableSeparator(nextLine);
      if (isTableHeader) {
        flushParagraph();
        closeLists();

        const headerCells = parseMarkdownTableRow(line);
        const bodyRows = [];

        lineIndex += 2;
        while (lineIndex < lines.length) {
          const tableLine = lines[lineIndex];
          const tableLineTrimmed = tableLine.trim();
          if (!tableLineTrimmed || !tableLineTrimmed.includes("|")) {
            lineIndex -= 1;
            break;
          }
          bodyRows.push(parseMarkdownTableRow(tableLineTrimmed));
          lineIndex += 1;
        }

        html.push("<table><thead><tr>");
        headerCells.forEach((cell) => {
          html.push(`<th>${formatInlineMarkdown(cell)}</th>`);
        });
        html.push("</tr></thead>");

        if (bodyRows.length > 0) {
          html.push("<tbody>");
          bodyRows.forEach((rowCells) => {
            html.push("<tr>");
            rowCells.forEach((cell) => {
              html.push(`<td>${formatInlineMarkdown(cell)}</td>`);
            });
            html.push("</tr>");
          });
          html.push("</tbody>");
        }

        html.push("</table>");
        continue;
      }

      const bulletMatch = line.match(/^[-*]\s+(.+)$/);
      const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

      if (bulletMatch) {
        flushParagraph();
        if (inOrderedList) {
          html.push("</ol>");
          inOrderedList = false;
        }
        if (!inUnorderedList) {
          html.push("<ul>");
          inUnorderedList = true;
        }
        html.push(`<li>${formatInlineMarkdown(bulletMatch[1])}</li>`);
        continue;
      }

      if (orderedMatch) {
        flushParagraph();
        if (inUnorderedList) {
          html.push("</ul>");
          inUnorderedList = false;
        }
        if (!inOrderedList) {
          html.push("<ol>");
          inOrderedList = true;
        }
        html.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
        continue;
      }

      closeLists();

      if (!line) {
        flushParagraph();
        continue;
      }

      paragraphLines.push(rawLine);
    }

    if (inCodeBlock) {
      flushCodeBlock();
    }

    flushBlockquote();
    flushParagraph();
    closeLists();

    return html.join("");
  }

  // ── Off-thread formatText via Web Worker (P2-13) ──
  // Lazily creates a Worker. For long content (>500 chars) this avoids
  // blocking the main thread with markdown parsing.
  let _formatWorker = null;
  let _formatCallId = 0;
  const _formatCallbacks = new Map();
  const FORMAT_WORKER_THRESHOLD = 500; // chars

  function getFormatWorker() {
    if (!_formatWorker) {
      try {
        _formatWorker = new Worker("lib/format-worker.js");
        _formatWorker.onmessage = (e) => {
          const { id, html } = e.data;
          const cb = _formatCallbacks.get(id);
          if (cb) { _formatCallbacks.delete(id); cb(html); }
        };
        _formatWorker.onerror = () => {
          // Worker failed to load — disable and fall back to sync
          _formatWorker = null;
        };
      } catch {
        // Worker not supported — stay null, always fall back
        _formatWorker = null;
      }
    }
    return _formatWorker;
  }

  /**
   * Asynchronous formatText — uses Web Worker for content longer than
   * FORMAT_WORKER_THRESHOLD, falls back to synchronous formatText for short
   * content or when Worker is unavailable.
   * @param {string} content
   * @returns {Promise<string>} Formatted HTML string
   */
  function formatTextAsync(content) {
    const text = String(content ?? "");
    // Short content → sync is faster (no message overhead)
    if (text.length < FORMAT_WORKER_THRESHOLD) {
      return Promise.resolve(formatText(text));
    }
    const worker = getFormatWorker();
    if (!worker) return Promise.resolve(formatText(text));

    return new Promise((resolve) => {
      const id = ++_formatCallId;
      // Timeout fallback — if worker doesn't respond within 200ms, use sync
      const timer = setTimeout(() => {
        _formatCallbacks.delete(id);
        resolve(formatText(text));
      }, 200);

      _formatCallbacks.set(id, (html) => {
        clearTimeout(timer);
        resolve(html);
      });

      worker.postMessage({ id, content: text });
    });
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
      span.className = "debug-log-entry";
      span.innerHTML = `<span class="debug-ts">[${ts}]</span> <span class="debug-tag" data-tag="${tag}">[${tag}]</span> ${escapeHtml(msg)}`;
      debugLogEl.appendChild(span);
      trimContainerChildren(debugLogEl, CONFIG.MAX_DEBUG_LOG_ENTRIES || 500);
      debugLogEl.scrollTop = debugLogEl.scrollHeight;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P2-7: Minimal DOM Updates — avoid full innerHTML rebuilds
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update text content only if changed (avoids unnecessary reflows).
   * @param {HTMLElement|null} el - Target element
   * @param {string} text - New text content
   * @returns {boolean} - Whether the content was updated
   */
  function updateText(el, text) {
    if (!el) return false;
    const newText = String(text ?? "");
    if (el.textContent !== newText) {
      el.textContent = newText;
      return true;
    }
    return false;
  }

  /**
   * Update innerHTML only if changed (avoids unnecessary reflows).
   * @param {HTMLElement|null} el - Target element
   * @param {string} html - New HTML content
   * @returns {boolean} - Whether the content was updated
   */
  function updateHTML(el, html) {
    if (!el) return false;
    const newHTML = String(html ?? "");
    if (el.innerHTML !== newHTML) {
      el.innerHTML = newHTML;
      return true;
    }
    return false;
  }

  /**
   * Efficiently patch a list container by key comparison.
   * Only adds/removes/reorders items that changed.
   * @param {HTMLElement} container - Parent container element
   * @param {Array<Object>} items - Array of data items
   * @param {Function} getKey - Function to extract unique key from item
   * @param {Function} renderItem - Function to render item to HTML element
   * @param {Object} options - { emptyHTML?: string, onUpdate?: (el, item) => void }
   */
  function patchList(container, items, getKey, renderItem, options = {}) {
    if (!container) return;

    const safeItems = Array.isArray(items) ? items : [];

    // Handle empty state
    if (safeItems.length === 0) {
      if (options.emptyHTML) {
        updateHTML(container, options.emptyHTML);
      } else {
        container.innerHTML = "";
      }
      return;
    }

    // Build map of existing elements by key
    const existingByKey = new Map();
    for (const child of Array.from(container.children)) {
      const key = child.dataset.patchKey;
      if (key) existingByKey.set(key, child);
    }

    // Track which keys we want to keep
    const desiredKeys = new Set(safeItems.map(getKey));

    // Remove elements that are no longer in the list (only data-patch-key managed)
    for (const [key, el] of existingByKey) {
      if (!desiredKeys.has(key)) {
        el.remove();
        existingByKey.delete(key);
      }
    }

    // Add or reorder elements
    let prevEl = null;
    for (const item of safeItems) {
      const key = String(getKey(item));
      let el = existingByKey.get(key);

      if (!el) {
        // Create new element
        el = renderItem(item);
        if (el instanceof HTMLElement) {
          el.dataset.patchKey = key;
        }
      } else if (options.onUpdate) {
        // Update existing element
        options.onUpdate(el, item);
      }

      // Ensure correct order
      if (el) {
        if (prevEl) {
          if (prevEl.nextSibling !== el) {
            prevEl.after(el);
          }
        } else if (container.firstChild !== el) {
          container.prepend(el);
        }
        prevEl = el;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P2-8: Unified Cache Policy with Event-Driven Invalidation
  // ═══════════════════════════════════════════════════════════════════════════

  const _cacheEventListeners = new Map();

  /**
   * Subscribe to cache invalidation events.
   * @param {string} key - Cache key to listen for ("*" for all)
   * @param {Function} callback - Function to call on invalidation
   * @returns {Function} - Unsubscribe function
   */
  function onCacheInvalidate(key, callback) {
    if (!_cacheEventListeners.has(key)) {
      _cacheEventListeners.set(key, new Set());
    }
    _cacheEventListeners.get(key).add(callback);
    return () => _cacheEventListeners.get(key)?.delete(callback);
  }

  /**
   * Invalidate cache with event notification.
   * @param {string|null} key - Key to invalidate (null for all)
   * @param {string} reason - Reason for invalidation (for debugging)
   */
  function invalidateCacheWithEvent(key, reason = "manual") {
    debugLog("CACHE", `Invalidate [${key || "ALL"}] reason=${reason}`);

    // Perform the actual invalidation
    invalidateCache(key);

    // Notify listeners
    if (key) {
      _cacheEventListeners.get(key)?.forEach((cb) => cb(key, reason));
    }
    // Also notify wildcard listeners
    _cacheEventListeners.get("*")?.forEach((cb) => cb(key, reason));
  }

  // Cache invalidation policy map: action → keys to invalidate
  const CACHE_INVALIDATION_POLICY = Object.freeze({
    "session-create":  ["sessions"],
    "session-delete":  ["sessions"],
    "model-switch":    ["sessions"],
    "quota-update":    ["quota"],
    "tools-refresh":   ["tools"],
    "context-refresh": ["context", "models", "tools", "quota", "sessions"],
    "disconnect":      null, // null = invalidate all
  });

  /**
   * Trigger cache invalidation based on action type.
   * @param {string} action - Action that occurred
   */
  function triggerCachePolicy(action) {
    const keys = CACHE_INVALIDATION_POLICY[action];
    if (keys === null) {
      invalidateCacheWithEvent(null, action);
    } else if (Array.isArray(keys)) {
      keys.forEach((k) => invalidateCacheWithEvent(k, action));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P2-9: Immutable State Update Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a shallow copy of an object or array.
   * @param {Object|Array} obj - Object to copy
   * @returns {Object|Array} - Shallow copy
   */
  function shallowCopy(obj) {
    if (Array.isArray(obj)) return [...obj];
    if (obj && typeof obj === "object") return { ...obj };
    return obj;
  }

  /**
   * Immutably update a nested property in an object.
   * @param {Object} obj - Original object
   * @param {string|string[]} path - Dot-separated path or array of keys
   * @param {*} value - New value
   * @returns {Object} - New object with updated property
   */
  function immutableSet(obj, path, value) {
    const keys = Array.isArray(path) ? path : String(path).split(".");
    if (keys.length === 0) return value;

    const result = shallowCopy(obj) || {};
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      current[key] = shallowCopy(current[key]) || {};
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    return result;
  }

  /**
   * Immutably update multiple properties in an object.
   * @param {Object} obj - Original object
   * @param {Object} updates - Object with updates to merge
   * @returns {Object} - New object with merged updates
   */
  function immutableMerge(obj, updates) {
    if (!updates || typeof updates !== "object") return obj;
    return { ...obj, ...updates };
  }

  /**
   * Immutably add an item to an array with optional max size.
   * @param {Array} arr - Original array
   * @param {*} item - Item to add
   * @param {number} maxSize - Maximum array size (0 = unlimited)
   * @returns {Array} - New array with item added
   */
  function immutablePush(arr, item, maxSize = 0) {
    const next = [...(Array.isArray(arr) ? arr : []), item];
    if (maxSize > 0 && next.length > maxSize) {
      return next.slice(next.length - maxSize);
    }
    return next;
  }

  /**
   * Immutably remove an item from an array by predicate.
   * @param {Array} arr - Original array
   * @param {Function} predicate - Function to match item to remove
   * @returns {Array} - New array without matched items
   */
  function immutableRemove(arr, predicate) {
    if (!Array.isArray(arr)) return [];
    return arr.filter((item, idx) => !predicate(item, idx));
  }

  /**
   * Immutably update an item in an array by predicate.
   * @param {Array} arr - Original array
   * @param {Function} predicate - Function to match item
   * @param {Function|Object} updater - Update function or object to merge
   * @returns {Array} - New array with updated item
   */
  function immutableUpdateItem(arr, predicate, updater) {
    if (!Array.isArray(arr)) return [];
    return arr.map((item, idx) => {
      if (predicate(item, idx)) {
        if (typeof updater === "function") return updater(item);
        return { ...item, ...updater };
      }
      return item;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P2-10: Batched Storage Writes with Debounce
  // ═══════════════════════════════════════════════════════════════════════════

  const STORAGE_BATCH_DELAY_MS = CONFIG.STORAGE_BATCH_DELAY_MS || 500;
  const _pendingStorageWrites = new Map();
  let _storageFlushTimer = null;

  /**
   * Schedule a batched write to chrome.storage.local.
   * Multiple writes to the same key within the delay window are merged.
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   */
  function batchStorageWrite(key, value) {
    _pendingStorageWrites.set(key, value);

    if (_storageFlushTimer) clearTimeout(_storageFlushTimer);
    _storageFlushTimer = setTimeout(_flushStorageWrites, STORAGE_BATCH_DELAY_MS);
  }

  /**
   * Flush all pending storage writes immediately.
   */
  function _flushStorageWrites() {
    _storageFlushTimer = null;
    if (_pendingStorageWrites.size === 0) return;

    const batch = Object.fromEntries(_pendingStorageWrites);
    _pendingStorageWrites.clear();

    debugLog("STORAGE", `Batch write: ${Object.keys(batch).join(", ")}`);
    chrome.storage.local.set(batch);
  }

  /**
   * Force flush pending writes (e.g., before page unload).
   */
  function flushStorageNow() {
    if (_storageFlushTimer) {
      clearTimeout(_storageFlushTimer);
      _flushStorageWrites();
    }
  }

  // Flush storage on page unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flushStorageNow);
  }

  root.utils = {
    // Existing utilities
    pushWithLimitImmutable,
    trimContainerChildren,
    escapeHtml,
    showToast,
    scrollToBottom,
    formatText,
    formatTextAsync,
    formatTokenCount,
    formatFileSize,
    relativeTime,
    sendToBackground,
    getCached,
    setCache,
    invalidateCache,
    cachedSendToBackground,
    debugLog,
    // P2-7: Minimal DOM Updates
    updateText,
    updateHTML,
    patchList,
    // P2-8: Unified Cache Policy
    onCacheInvalidate,
    invalidateCacheWithEvent,
    triggerCachePolicy,
    CACHE_INVALIDATION_POLICY,
    // P2-9: Immutable State Helpers
    shallowCopy,
    immutableSet,
    immutableMerge,
    immutablePush,
    immutableRemove,
    immutableUpdateItem,
    // P2-10: Batched Storage Writes
    batchStorageWrite,
    flushStorageNow,
  };
})(window);
