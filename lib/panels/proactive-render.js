(function initIQPanelProactiveRender(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  root.panels.proactiveRenderFactory = function createProactiveRenderFactory({ stateApi }) {
    const utils = root.utils || {};
    const i18n = root.i18n || {};
    const CONFIG = root.state?.CONFIG || {};
    const helpers = root.panels?.helpers || {};

    function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
    function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
    function tp(path, fallback) { return stateApi.tp(path, fallback); }
    function getCurrentLanguage() { return i18n.getLanguage?.() || "zh-TW"; }

    function renderMarkReadButton(readKey, isRead) {
      return helpers.renderActionButton?.({
        label: isRead ? localizeRuntimeMessage("✅ 已完成") : localizeRuntimeMessage("已讀"),
        action: "mark-read",
        className: "secondary",
        attrs: { "data-read-key": escapeHtml(readKey) },
        disabled: isRead,
      }) || "";
    }

    function renderTopPriority() {
      const container = document.getElementById("top-priority-content");
      if (!container) return;
      const top = stateApi.getTopPriorityAction();
      if (!top) {
        container.innerHTML = `<div class="empty-state" id="top-priority-empty"><span class="empty-icon">🫧</span><p>${escapeHtml(tp("noTopPriority", "目前沒有高優先事項"))}</p></div>`;
        return;
      }

      const severityClass = top.severity === "critical" ? "" : top.severity === "warning" ? "warning" : "normal";
      container.innerHTML = `
        <div class="top-priority-item ${severityClass}">
          <div class="top-priority-title">${escapeHtml(top.title)}</div>
          <div class="top-priority-detail">${escapeHtml(top.detail)}</div>
          <div class="top-priority-meta">${escapeHtml(top.meta)}</div>
          <div class="top-priority-actions">
            <button class="insight-action-btn" id="btn-do-top-priority">${escapeHtml(tp("handleNow", "立即處理"))}</button>
          </div>
        </div>
      `;

      document.getElementById("btn-do-top-priority")?.addEventListener("click", () => {
        root._switchPanel?.("chat");
        const chatInput = document.getElementById("chat-input");
        if (chatInput) chatInput.value = top.action;
        root._sendMessage?.();
      });
    }

    function renderInsightItems(containerId, items, renderFn) {
      const container = document.getElementById(containerId);
      if (!container) return;
      if (!items || items.length === 0) { container.innerHTML = ""; return; }
      container.innerHTML = items.map(renderFn).join("");
      container.querySelectorAll(".insight-action-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => { e.stopPropagation(); handleInsightAction(btn); });
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

    function renderBriefing(data) {
      const empty = document.getElementById("briefing-empty");
      const hasData = (data.emails?.length || 0) + (data.meetings?.length || 0) + (data.tasks?.length || 0) + (data.mentions?.length || 0) > 0;
      if (empty) empty.style.display = hasData ? "none" : "block";

      renderInsightItems("briefing-emails", data.emails || [], (item) => {
        const readKey = stateApi.toNotificationKey("briefing-email", item);
        const isRead = stateApi.isNotificationRead(readKey);
        const priorityClass = item.priority === "high" ? "priority-high" : item.priority === "medium" ? "priority-medium" : "priority-low";
        return `<div class="insight-item ${priorityClass} ${isRead ? "completed" : ""}">
          <div class="insight-item-header">
            <span class="insight-item-from">${escapeHtml(item.from)}</span>
            <span class="insight-item-age">${escapeHtml(item.age)}</span>
          </div>
          <div class="insight-item-subject">${escapeHtml(item.subject)}</div>
          <div class="insight-item-snippet">${escapeHtml(item.snippet || "")}</div>
          <div class="insight-item-actions">
            <button class="insight-action-btn" data-action="reply" data-from="${escapeHtml(item.from)}" data-subject="${escapeHtml(item.subject)}">${escapeHtml(tp("reply", "💬 回覆"))}</button>
            <button class="insight-action-btn secondary" data-action="draft" data-from="${escapeHtml(item.from)}" data-subject="${escapeHtml(item.subject)}">${escapeHtml(tp("draftReply", "🤖 草擬回覆"))}</button>
            ${renderMarkReadButton(readKey, isRead)}
          </div>
        </div>`;
      });
      updateSubCount("briefing-emails-count", data.emails);

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
            <button class="insight-action-btn" data-action="meetprep" data-title="${escapeHtml(item.title)}">${escapeHtml(tp("prepare", "📋 準備"))}</button>
          </div>
        </div>`;
      });
      updateSubCount("briefing-meetings-count", data.meetings);

      renderInsightItems("briefing-tasks", data.tasks || [], (item) => {
        const statusClass = item.status === "overdue" ? "priority-high" : "priority-medium";
        return `<div class="insight-item ${statusClass}">
          <div class="insight-item-header">
            <span class="insight-item-from">${escapeHtml(item.source || tp("defaultTodoSource", "To-Do"))}</span>
            <span class="insight-item-age">${escapeHtml(item.due)}</span>
          </div>
          <div class="insight-item-subject">${escapeHtml(item.title)}</div>
          <div class="insight-item-actions">
            <button class="insight-action-btn secondary" data-action="complete-task">${escapeHtml(tp("complete", "✅ 完成"))}</button>
          </div>
        </div>`;
      });
      updateSubCount("briefing-tasks-count", data.tasks);

      renderInsightItems("briefing-mentions", data.mentions || [], (item) => {
        const readKey = stateApi.toNotificationKey("briefing-mention", item);
        const isRead = stateApi.isNotificationRead(readKey);
        return `<div class="insight-item priority-medium ${isRead ? "completed" : ""}">
          <div class="insight-item-header">
            <span class="insight-item-from">${escapeHtml(item.from)}</span>
            <span class="insight-item-age">${escapeHtml(item.time || "")}</span>
          </div>
          <div class="insight-item-subject">${escapeHtml(item.channel || "")}</div>
          <div class="insight-item-snippet">${escapeHtml(item.message || "")}</div>
          <div class="insight-item-actions">
            ${renderMarkReadButton(readKey, isRead)}
          </div>
        </div>`;
      });
      updateSubCount("briefing-mentions-count", data.mentions);

      updateSectionCount("briefing-count", (data.emails?.length || 0) + (data.meetings?.length || 0) + (data.tasks?.length || 0) + (data.mentions?.length || 0));
    }

    function renderDeadlines(data) {
      const empty = document.getElementById("deadline-empty");
      const items = data.deadlines || [];
      if (empty) empty.style.display = items.length > 0 ? "none" : "block";

      renderInsightItems("deadline-list", items, (item) => {
        const readKey = stateApi.toNotificationKey("deadline", item);
        const isRead = stateApi.isNotificationRead(readKey);
        const urgencyClass = item.urgency === "critical" ? "priority-high" : item.urgency === "warning" ? "priority-medium" : "priority-low";
        const daysText = item.daysLeft === 0
          ? tp("today", "今天")
          : item.daysLeft === 1
            ? tp("tomorrow", "明天")
            : `${item.daysLeft} ${tp("daysSuffix", "天")}`;
        return `<div class="insight-item ${urgencyClass} ${isRead ? "completed" : ""}">
          <div class="insight-item-header">
            <span class="insight-item-from">${escapeHtml(item.source || tp("defaultEmailSource", "Email"))}</span>
            <span class="deadline-countdown ${urgencyClass}">${escapeHtml(daysText)}</span>
          </div>
          <div class="insight-item-subject">${escapeHtml(item.title)}</div>
          <div class="insight-item-snippet">${escapeHtml(item.snippet || item.sourceDetail || "")}</div>
          <div class="insight-item-meta">📅 ${escapeHtml(item.date || "")}</div>
          <div class="insight-item-actions">
            ${renderMarkReadButton(readKey, isRead)}
          </div>
        </div>`;
      });
      updateSectionCount("deadline-count", items.length);
    }

    function renderGhosts(data) {
      const empty = document.getElementById("ghost-empty");
      const items = data.ghosts || [];
      if (empty) empty.style.display = items.length > 0 ? "none" : "block";

      renderInsightItems("ghost-list", items, (item) => {
        const readKey = stateApi.toNotificationKey("ghost", item);
        const isRead = stateApi.isNotificationRead(readKey);
        const priorityClass = item.priority === "critical" ? "priority-high" : item.priority === "high" ? "priority-high" : item.priority === "medium" ? "priority-medium" : "priority-low";
        return `<div class="insight-item ${priorityClass} ${isRead ? "completed" : ""}">
          <div class="insight-item-header">
            <span class="insight-item-from">${escapeHtml(item.from)}</span>
            <span class="insight-item-age">${escapeHtml(item.receivedAt)}</span>
          </div>
          <div class="insight-item-subject">${escapeHtml(item.subject)}</div>
          <div class="insight-item-snippet">${escapeHtml(item.snippet || "")}</div>
          <div class="insight-item-reason">${escapeHtml(item.reason || "")}</div>
          <div class="insight-item-actions">
            <button class="insight-action-btn" data-action="draft-reply" data-from="${escapeHtml(item.from)}" data-subject="${escapeHtml(item.subject)}" data-snippet="${escapeHtml(item.snippet || "")}">${escapeHtml(tp("draftReply", "🤖 草擬回覆"))}</button>
            <button class="insight-action-btn secondary" data-action="dismiss">${escapeHtml(tp("dismiss", "✕ 忽略"))}</button>
            ${renderMarkReadButton(readKey, isRead)}
          </div>
        </div>`;
      });
      updateSectionCount("ghost-count", items.length);
    }

    function renderMeetingPrep(data) {
      const empty = document.getElementById("meeting-prep-empty");
      const container = document.getElementById("meeting-prep-list");
      const hasMeeting = data.meeting && data.meeting.title;

      if (empty) empty.style.display = hasMeeting ? "none" : "block";
      if (!container || !hasMeeting) { updateSectionCount("meeting-prep-count", 0); return; }

      let html = "";

      const meetingReadKey = stateApi.toNotificationKey("meeting-prep", data.meeting || {});
      const isMeetingRead = stateApi.isNotificationRead(meetingReadKey);
      html += `<div class="insight-item meeting-header-item">
        <div class="insight-item-header">
          <span class="insight-item-time">${escapeHtml(data.meeting.time || "")}</span>
          <span class="insight-item-age">${escapeHtml(data.meeting.duration || "")}</span>
        </div>
        <div class="insight-item-subject">${escapeHtml(data.meeting.title)}</div>
        <div class="insight-item-meta">📍 ${escapeHtml(data.meeting.location || "TBD")}</div>
        <div class="insight-item-actions">
          ${renderMarkReadButton(meetingReadKey, isMeetingRead)}
        </div>
      </div>`;

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
      container.querySelectorAll(".insight-action-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => { e.stopPropagation(); handleInsightAction(btn); });
      });
      updateSectionCount("meeting-prep-count", 1);
    }

    function handleInsightAction(btn) {
      const action = btn.dataset.action;
      const from = btn.dataset.from || "";
      const subject = btn.dataset.subject || "";
      const snippet = btn.dataset.snippet || "";
      const title = btn.dataset.title || "";
      const url = btn.dataset.url || "";
      const readKey = btn.dataset.readKey || "";
      const currentLanguage = getCurrentLanguage();
      const chatInput = document.getElementById("chat-input");

      switch (action) {
        case "draft":
        case "draft-reply": {
          root._switchPanel?.("chat");
          const prompt = currentLanguage === "en"
            ? `Please draft a reply email to ${from} about "${subject}".\n\nEmail summary: ${snippet}\n\nUse a professional but friendly tone.`
            : `請幫我草擬一封回覆信，回覆 ${from} 的信件「${subject}」。\n\n信件內容摘要：${snippet}\n\n請用專業但友善的語氣。`;
          if (chatInput) chatInput.value = prompt;
          root._sendMessage?.();
          break;
        }
        case "reply": {
          root._switchPanel?.("chat");
          if (chatInput) {
            chatInput.value = currentLanguage === "en"
              ? `I need to reply to ${from} about "${subject}". Please draft a response.`
              : `我需要回覆 ${from} 關於「${subject}」的信件。請幫我草擬回覆。`;
          }
          chatInput?.focus();
          break;
        }
        case "meetprep": {
          root._switchPanel?.("chat");
          if (chatInput) {
            chatInput.value = currentLanguage === "en"
              ? `Please help me prepare for "${title}". Summarize related materials, attendee background, and my action items.`
              : `請幫我準備「${title}」這場會議。整理相關資料、參與者背景和我的 action items。`;
          }
          root._sendMessage?.();
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
            setTimeout(() => item.remove(), CONFIG.INSIGHT_REMOVE_DELAY_MS || 300);
          }
          break;
        }
        case "mark-read": {
          stateApi.markNotificationAsRead(readKey);
          btn.textContent = localizeRuntimeMessage("✅ 已完成");
          btn.disabled = true;
          btn.closest(".insight-item")?.classList.add("completed");
          break;
        }
        default:
          utils.debugLog?.("PROACTIVE", `Unknown action: ${action}`);
      }
    }

    function bindInsightSectionToggles() {
      document.querySelectorAll(".insight-section-header").forEach((header) => {
        header.addEventListener("click", () => {
          const targetId = header.dataset.toggle;
          const body = document.getElementById(targetId);
          const section = header.closest(".insight-section");
          if (body && section) section.classList.toggle("collapsed");
        });
      });
    }

    return {
      renderTopPriority,
      renderBriefing,
      renderDeadlines,
      renderGhosts,
      renderMeetingPrep,
      handleInsightAction,
      bindInsightSectionToggles,
    };
  };
})(window);
