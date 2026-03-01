(function initIQPanelProactiveRender(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  root.panels.proactiveRenderFactory = function createProactiveRenderFactory({ stateApi }) {
    const utils = root.utils || {};
    const i18n = root.i18n || {};
    const helpers = root.panels?.helpers || {};

    function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
    function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
    function tp(path, fallback) { return stateApi.tp(path, fallback); }

    // ── Loading / Error state helpers ──
    function showSectionLoading(sectionId) {
      const loading = document.getElementById(`${sectionId}-loading`);
      const error = document.getElementById(`${sectionId}-error`);
      if (loading) loading.style.display = "flex";
      if (error) error.style.display = "none";
    }

    function hideSectionLoading(sectionId) {
      const loading = document.getElementById(`${sectionId}-loading`);
      if (loading) loading.style.display = "none";
    }

    function showSectionError(sectionId) {
      const loading = document.getElementById(`${sectionId}-loading`);
      const error = document.getElementById(`${sectionId}-error`);
      if (loading) loading.style.display = "none";
      if (error) error.style.display = "flex";
    }

    function hideSectionError(sectionId) {
      const error = document.getElementById(`${sectionId}-error`);
      if (error) error.style.display = "none";
    }

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
        </div>
      `;
    }

    // ── Unified item renderer (replaceChildren for safety) ──
    function renderInsightItems(containerId, items, renderFn) {
      const container = document.getElementById(containerId);
      if (!container) return;
      if (!items || items.length === 0) { container.innerHTML = ""; return; }
      container.innerHTML = items.map(renderFn).join("");
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
      hideSectionLoading("briefing");
      hideSectionError("briefing");
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
      hideSectionLoading("deadline");
      hideSectionError("deadline");
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
      hideSectionLoading("ghost");
      hideSectionError("ghost");
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
            ${renderMarkReadButton(readKey, isRead)}
          </div>
        </div>`;
      });
      updateSectionCount("ghost-count", items.length);
    }

    function renderMeetingPrep(data) {
      hideSectionLoading("meeting-prep");
      hideSectionError("meeting-prep");
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
      updateSectionCount("meeting-prep-count", 1);
    }

    // ── Render schedule card query results (Phase 4) ──
    function renderScheduleCardResult(cardEl, agent, resultData) {
      if (!cardEl || !resultData) return;

      // Remove previous result container if any
      const prev = cardEl.querySelector(".proactive-schedule-card-result");
      if (prev) prev.remove();

      const resultContainer = document.createElement("div");
      resultContainer.className = "proactive-schedule-card-result";

      const agentLabel = { briefing: "晨報", deadlines: "截止日", ghosts: "未回覆", "meeting-prep": "會議準備" }[agent] || agent;
      let itemsHtml = "";

      if (agent === "briefing") {
        const emails = resultData.emails || [];
        const meetings = resultData.meetings || [];
        const tasks = resultData.tasks || [];
        const mentions = resultData.mentions || [];
        itemsHtml = [
          ...emails.map((e) => `<div class="insight-item"><div class="insight-item-header"><span class="insight-item-from">${escapeHtml(e.from)}</span><span class="insight-item-age">${escapeHtml(e.age || "")}</span></div><div class="insight-item-subject">${escapeHtml(e.subject)}</div><div class="insight-item-snippet">${escapeHtml(e.snippet || "")}</div></div>`),
          ...meetings.map((m) => `<div class="insight-item"><div class="insight-item-header"><span class="insight-item-time">${escapeHtml(m.time)}</span><span class="insight-item-location">${escapeHtml(m.location || "")}</span></div><div class="insight-item-subject">${escapeHtml(m.title)}</div></div>`),
          ...tasks.map((t) => `<div class="insight-item"><div class="insight-item-header"><span class="insight-item-from">${escapeHtml(t.source || "To-Do")}</span><span class="insight-item-age">${escapeHtml(t.due || "")}</span></div><div class="insight-item-subject">${escapeHtml(t.title)}</div></div>`),
          ...mentions.map((m) => `<div class="insight-item"><div class="insight-item-header"><span class="insight-item-from">${escapeHtml(m.from)}</span></div><div class="insight-item-subject">${escapeHtml(m.channel || "")}</div><div class="insight-item-snippet">${escapeHtml(m.message || "")}</div></div>`),
        ].join("");
      } else if (agent === "deadlines") {
        const deadlines = resultData.deadlines || [];
        itemsHtml = deadlines.map((d) => {
          const urgencyClass = d.urgency === "critical" ? "priority-high" : d.urgency === "warning" ? "priority-medium" : "priority-low";
          return `<div class="insight-item ${urgencyClass}"><div class="insight-item-header"><span class="insight-item-from">${escapeHtml(d.source || "Email")}</span><span class="deadline-countdown ${urgencyClass}">${escapeHtml(String(d.daysLeft ?? ""))} 天</span></div><div class="insight-item-subject">${escapeHtml(d.title)}</div><div class="insight-item-snippet">${escapeHtml(d.snippet || d.sourceDetail || "")}</div></div>`;
        }).join("");
      } else if (agent === "ghosts") {
        const ghosts = resultData.ghosts || [];
        itemsHtml = ghosts.map((g) => {
          const pClass = (g.priority === "critical" || g.priority === "high") ? "priority-high" : g.priority === "medium" ? "priority-medium" : "priority-low";
          return `<div class="insight-item ${pClass}"><div class="insight-item-header"><span class="insight-item-from">${escapeHtml(g.from)}</span><span class="insight-item-age">${escapeHtml(g.receivedAt || "")}</span></div><div class="insight-item-subject">${escapeHtml(g.subject)}</div><div class="insight-item-snippet">${escapeHtml(g.snippet || "")}</div></div>`;
        }).join("");
      } else if (agent === "meeting-prep") {
        const meeting = resultData.meeting;
        if (meeting) {
          itemsHtml = `<div class="insight-item meeting-header-item"><div class="insight-item-header"><span class="insight-item-time">${escapeHtml(meeting.time || "")}</span><span class="insight-item-age">${escapeHtml(meeting.duration || "")}</span></div><div class="insight-item-subject">${escapeHtml(meeting.title)}</div><div class="insight-item-meta">📍 ${escapeHtml(meeting.location || "TBD")}</div></div>`;
          if (Array.isArray(resultData.attendees) && resultData.attendees.length > 0) {
            itemsHtml += resultData.attendees.map((a) => `<div class="insight-item"><div class="insight-item-subject">${escapeHtml(a.name)}</div><div class="insight-item-snippet">${escapeHtml(a.role || "")}</div></div>`).join("");
          }
        }
      }

      if (!itemsHtml) {
        itemsHtml = `<div class="empty-state"><span class="empty-icon">📭</span><p>此次查詢無資料</p></div>`;
      }

      resultContainer.innerHTML = `
        <div class="proactive-schedule-card-result-header">
          <span>📊 查詢結果 (${agentLabel})</span>
          <button class="proactive-schedule-card-result-toggle" data-action="toggle-card-result">收合</button>
        </div>
        <div class="insight-items">${itemsHtml}</div>
      `;

      cardEl.appendChild(resultContainer);
    }

    function handleInsightAction(btn) {
      const action = btn.dataset.action;
      const readKey = btn.dataset.readKey || "";

      switch (action) {
        case "mark-read": {
          stateApi.markNotificationAsRead(readKey);
          btn.textContent = localizeRuntimeMessage("✅ 已完成");
          btn.disabled = true;
          btn.closest(".insight-item")?.classList.add("completed");
          if (readKey && readKey.startsWith("deadline")) {
            stateApi.trackAchievement("deadline_avoided", { readKey });
          }
          break;
        }
        default:
          utils.debugLog?.("PROACTIVE", `Unknown action: ${action}`);
      }
    }

    // ── Delegated event binding (single listener on panel) ──
    function bindDelegatedEvents() {
      const panel = document.getElementById("panel-notifications");
      if (!panel) return;

      panel.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        // Insight action buttons (delegated)
        const actionBtn = target.closest(".insight-action-btn");
        if (actionBtn instanceof HTMLElement) {
          e.stopPropagation();
          handleInsightAction(actionBtn);
          return;
        }

        // Section collapse toggles (delegated)
        const header = target.closest(".insight-section-header");
        if (header instanceof HTMLElement) {
          const targetId = header.dataset.toggle;
          const body = document.getElementById(targetId);
          const section = header.closest(".insight-section");
          if (body && section) section.classList.toggle("collapsed");
          return;
        }

        // Retry buttons
        const retryBtn = target.closest(".section-retry-btn");
        if (retryBtn instanceof HTMLElement) {
          const agent = retryBtn.dataset.agent;
          if (agent) {
            const refreshBtn = document.querySelector(`.section-refresh-btn[data-agent="${agent}"]`);
            if (refreshBtn instanceof HTMLElement) refreshBtn.click();
          }
          return;
        }

        // Schedule card result toggle
        const resultToggle = target.closest("[data-action='toggle-card-result']");
        if (resultToggle instanceof HTMLElement) {
          const resultContainer = resultToggle.closest(".proactive-schedule-card-result");
          if (resultContainer) {
            resultContainer.classList.toggle("collapsed");
            resultToggle.textContent = resultContainer.classList.contains("collapsed") ? "展開" : "收合";
          }
          return;
        }
      });
    }

    function bindInsightSectionToggles() {
      // Now handled by delegated events — this is kept for backward compat
      // bindDelegatedEvents is called once from scanApi.bindEvents
    }

    return {
      renderTopPriority,
      renderBriefing,
      renderDeadlines,
      renderGhosts,
      renderMeetingPrep,
      renderScheduleCardResult,
      handleInsightAction,
      bindInsightSectionToggles,
      bindDelegatedEvents,
      showSectionLoading,
      hideSectionLoading,
      showSectionError,
      hideSectionError,
    };
  };
})(window);
