// ===== IQ Copilot — Quick Prompts Panel =====
// Extracted from sidebar.js (P2-14) for file size reduction.

(function initIQQuickPrompts(global) {
  "use strict";

  const root = global.IQ || (global.IQ = {});
  const panels = root.panels || (root.panels = {});
  const utils = root.utils || {};
  const i18n = root.i18n || {};
  const localizeRuntimeMessage = i18n.localizeRuntimeMessage || ((m) => m);
  const escapeHtml = utils.escapeHtml || ((s) => s);

  const QUICK_PROMPTS_STORAGE_KEY = "iq_quick_prompts";

  // ── State ──
  let quickPromptsOpen = false;
  let quickPrompts = [];

  // ── DOM refs (resolved lazily) ──
  let _btnQuickPrompts = null;
  let _quickPromptsPopup = null;
  let _quickPromptsList = null;
  let _quickPromptsEmpty = null;
  let _btnAddPrompt = null;
  let _chatInput = null;

  function resolveDOM() {
    _btnQuickPrompts = document.getElementById("btn-quick-prompts");
    _quickPromptsPopup = document.getElementById("quick-prompts-popup");
    _quickPromptsList = document.getElementById("quick-prompts-list");
    _quickPromptsEmpty = document.getElementById("quick-prompts-empty");
    _btnAddPrompt = document.getElementById("btn-add-prompt");
    _chatInput = document.getElementById("chat-input");
  }

  // ── Storage ──
  async function loadQuickPrompts() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const data = await chrome.storage.local.get(QUICK_PROMPTS_STORAGE_KEY);
        quickPrompts = data[QUICK_PROMPTS_STORAGE_KEY] || [];
      } else {
        const raw = localStorage.getItem(QUICK_PROMPTS_STORAGE_KEY);
        quickPrompts = raw ? JSON.parse(raw) : [];
      }
    } catch (e) {
      console.error("[QuickPrompts] loadQuickPrompts error:", e);
      quickPrompts = [];
    }
  }

  async function saveQuickPrompts() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [QUICK_PROMPTS_STORAGE_KEY]: quickPrompts });
      } else {
        localStorage.setItem(QUICK_PROMPTS_STORAGE_KEY, JSON.stringify(quickPrompts));
      }
    } catch (e) {
      console.error("[QuickPrompts] saveQuickPrompts error:", e);
    }
  }

  // ── Render ──
  function renderQuickPrompts() {
    if (!_quickPromptsList || !_quickPromptsEmpty) return;

    if (quickPrompts.length === 0) {
      _quickPromptsList.style.display = "none";
      _quickPromptsEmpty.style.display = "flex";
      return;
    }

    _quickPromptsEmpty.style.display = "none";
    _quickPromptsList.style.display = "block";

    _quickPromptsList.innerHTML = quickPrompts.map((p, index) => `
      <div class="quick-prompt-item" data-index="${index}">
        <span class="prompt-icon">${escapeHtml(p.icon || "📝")}</span>
        <div class="prompt-content">
          <div class="prompt-title">${escapeHtml(p.title)}</div>
          <div class="prompt-preview">${escapeHtml(p.prompt.slice(0, 50))}${p.prompt.length > 50 ? "..." : ""}</div>
        </div>
        <button class="prompt-delete" data-index="${index}" title="刪除">✕</button>
      </div>
    `).join("");
  }

  // ── Open / Close ──
  function openQuickPromptsPopup() {
    if (!_quickPromptsPopup || !_btnQuickPrompts) return;
    renderQuickPrompts();

    const btnRect = _btnQuickPrompts.getBoundingClientRect();
    _quickPromptsPopup.style.left = `${btnRect.left}px`;
    _quickPromptsPopup.style.bottom = `${window.innerHeight - btnRect.top + 8}px`;

    _quickPromptsPopup.style.display = "flex";
    quickPromptsOpen = true;
  }

  function closeQuickPromptsPopup() {
    if (!_quickPromptsPopup) return;
    _quickPromptsPopup.style.display = "none";
    quickPromptsOpen = false;
  }

  function isOpen() {
    return quickPromptsOpen;
  }

  // ── Add Prompt Modal ──
  function showAddPromptModal() {
    const modal = document.createElement("div");
    modal.className = "quick-prompt-modal";
    modal.innerHTML = `
      <div class="quick-prompt-modal-content">
        <h3>⭐ 新增常用提示</h3>
        <input type="text" id="prompt-title-input" placeholder="標題 (例如：翻譯成中文)" maxlength="50">
        <textarea id="prompt-content-input" placeholder="提示內容 (例如：請將以下內容翻譯成繁體中文...)"></textarea>
        <div class="quick-prompt-modal-actions">
          <button class="btn-cancel">取消</button>
          <button class="btn-save">儲存</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const titleInput = modal.querySelector("#prompt-title-input");
    const contentInput = modal.querySelector("#prompt-content-input");
    const cancelBtn = modal.querySelector(".btn-cancel");
    const saveBtn = modal.querySelector(".btn-save");

    if (_chatInput?.value?.trim()) {
      contentInput.value = _chatInput.value.trim();
    }

    titleInput?.focus();

    cancelBtn?.addEventListener("click", () => modal.remove());

    saveBtn?.addEventListener("click", () => {
      const title = titleInput?.value?.trim();
      const prompt = contentInput?.value?.trim();

      if (!title) {
        utils.showToast?.(localizeRuntimeMessage("請輸入標題"), "error");
        titleInput?.focus();
        return;
      }
      if (!prompt) {
        utils.showToast?.(localizeRuntimeMessage("請輸入提示內容"), "error");
        contentInput?.focus();
        return;
      }

      quickPrompts = [...quickPrompts, {
        id: `qp-${Date.now()}`,
        title,
        prompt,
        icon: "📝",
        createdAt: new Date().toISOString(),
      }];

      saveQuickPrompts();
      renderQuickPrompts();
      modal.remove();
      utils.showToast?.(localizeRuntimeMessage("提示已儲存"));
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }

  // ── Event Binding ──
  function bindEvents() {
    resolveDOM();

    _btnQuickPrompts?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (quickPromptsOpen) {
        closeQuickPromptsPopup();
      } else {
        openQuickPromptsPopup();
      }
    });

    _quickPromptsList?.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".prompt-delete");
      if (deleteBtn) {
        e.stopPropagation();
        const index = parseInt(deleteBtn.dataset.index, 10);
        if (!isNaN(index) && index >= 0 && index < quickPrompts.length) {
          quickPrompts = quickPrompts.filter((_, i) => i !== index);
          saveQuickPrompts();
          renderQuickPrompts();
          utils.showToast?.(localizeRuntimeMessage("提示已刪除"));
        }
        return;
      }

      const item = e.target.closest(".quick-prompt-item");
      if (item) {
        const index = parseInt(item.dataset.index, 10);
        if (!isNaN(index) && index >= 0 && index < quickPrompts.length) {
          const prompt = quickPrompts[index];
          if (_chatInput) {
            _chatInput.value = prompt.prompt;
            _chatInput.focus();
            _chatInput.style.height = "auto";
            _chatInput.style.height = Math.min(_chatInput.scrollHeight, 120) + "px";
          }
          closeQuickPromptsPopup();
        }
      }
    });

    _btnAddPrompt?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showAddPromptModal();
    });

    document.addEventListener("click", (event) => {
      if (!quickPromptsOpen) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (_quickPromptsPopup?.contains(target) || _btnQuickPrompts?.contains(target)) return;
      closeQuickPromptsPopup();
    });
  }

  // ── Init ──
  async function init() {
    resolveDOM();
    await loadQuickPrompts();
  }

  panels.quickPrompts = {
    init,
    bindEvents,
    isOpen,
    openQuickPromptsPopup,
    closeQuickPromptsPopup,
  };
})(window);
