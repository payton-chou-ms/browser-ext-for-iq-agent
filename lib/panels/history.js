(function initIQPanelHistory(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const i18n = root.i18n || {};

  function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
  function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
  function isConnected() { return root.connection?.isConnected?.() || false; }

  async function loadHistorySessions() {
    const listEl = document.getElementById("history-list");
    if (!listEl) return;

    if (!isConnected()) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">🔌</span><p>${localizeRuntimeMessage("連接 CLI 以查看歷史")}</p></div>`;
      return;
    }
    try {
      const sessions = await utils.cachedSendToBackground?.("sessions", { type: "LIST_SESSIONS" });
      renderHistoryFromData(sessions);
    } catch {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠</span><p>${localizeRuntimeMessage("載入失敗")}</p></div>`;
    }
  }

  function renderHistoryFromData(sessions) {
    const listEl = document.getElementById("history-list");
    if (!listEl) return;

    const safeArr = Array.isArray(sessions) ? sessions : [];

    // P2-7: Use patchList for minimal DOM updates instead of full innerHTML rebuild
    if (utils.patchList) {
      utils.patchList(
        listEl,
        safeArr,
        (s) => s.sessionId || s.id || Math.random().toString(),
        (s) => createHistoryItem(s),
        {
          emptyHTML: `<div class="empty-state"><span class="empty-icon">🕐</span><p>${localizeRuntimeMessage("尚無對話紀錄")}</p></div>`,
          onUpdate: (el, s) => updateHistoryItem(el, s),
        }
      );
      return;
    }

    // Fallback: original implementation
    if (safeArr.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">🕐</span><p>${localizeRuntimeMessage("尚無對話紀錄")}</p></div>`;
      return;
    }

    listEl.innerHTML = "";
    safeArr.forEach((s) => {
      listEl.appendChild(createHistoryItem(s));
    });
  }

  function createHistoryItem(s) {
    const item = document.createElement("div");
    item.className = "history-item";
    const sid = s.sessionId || s.id || "—";
    const rawTitle = s.summary || s.title || "";
    const displayTitle = rawTitle.length > 60 ? rawTitle.slice(0, 57) + "…" : rawTitle;
    const titleText = displayTitle || localizeRuntimeMessage("未命名對話");
    const time = s.startTime ? new Date(s.startTime).toLocaleString() : "";

    item.innerHTML = `
      <div class="history-item-row">
        <span class="history-item-title">${escapeHtml(titleText)}</span>
        <button class="icon-btn history-delete-btn" title="${localizeRuntimeMessage("刪除")}" data-sid="${escapeHtml(sid)}">✕</button>
      </div>
      ${time ? `<span class="history-item-date">${escapeHtml(time)}</span>` : ""}
    `;
    item.dataset.sid = sid;

    item.addEventListener("click", async (e) => {
      if (e.target.closest(".history-delete-btn")) return;
      try {
        const res = await utils.sendToBackground?.({ type: "RESUME_SESSION", sessionId: sid });
        if (res) {
          root.chat?.setCurrentSessionId?.(sid);
          root.chat?.setSessionData?.(res);
          utils.showToast?.(localizeRuntimeMessage("已恢復對話"));
          root._switchPanel?.("chat");
        }
      } catch (err) {
        utils.showToast?.(localizeRuntimeMessage("恢復失敗: ") + err.message);
      }
    });

    const deleteBtn = item.querySelector(".history-delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const delSid = deleteBtn.dataset.sid;
        try {
          await utils.sendToBackground?.({ type: "DELETE_SESSION", sessionId: delSid });
          const chatState = root.chat?.getState?.() || {};
          if (chatState.currentSessionId === delSid) {
            root.chat?.clearSession?.();
          }
          // P2-8: Trigger cache invalidation
          utils.triggerCachePolicy?.("session-delete");
          loadHistorySessions();
        } catch (err) {
          utils.showToast?.(localizeRuntimeMessage("刪除失敗: ") + err.message);
        }
      });
    }

    return item;
  }

  function updateHistoryItem(el, s) {
    const titleEl = el.querySelector(".history-item-title");
    const dateEl = el.querySelector(".history-item-date");

    const rawTitle = s.summary || s.title || "";
    const displayTitle = rawTitle.length > 60 ? rawTitle.slice(0, 57) + "…" : rawTitle;
    const titleText = displayTitle || localizeRuntimeMessage("未命名對話");
    const time = s.startTime ? new Date(s.startTime).toLocaleString() : "";

    // P2-7: Use updateText for minimal updates
    utils.updateText?.(titleEl, titleText);
    utils.updateText?.(dateEl, time);
  }

  function bindEvents() {
    document.getElementById("history-search")?.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const items = document.querySelectorAll("#history-list .history-item");
      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? "" : "none";
      });
    });
  }

  root.panels.history = {
    loadHistorySessions,
    renderHistoryFromData,
    bindEvents,
  };
})(window);
