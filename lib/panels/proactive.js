(function initIQPanelProactive(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const i18n = root.i18n || {};
  const CONFIG = root.state?.CONFIG || {};

  function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
  function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
  function isConnected() { return root.connection?.isConnected?.() || false; }
  function t(path, fallback) { return i18n.t?.(path, fallback) ?? fallback; }
  function tp(path, fallback) { return t(`proactive.${path}`, fallback); }
  function getCurrentLanguage() { return i18n.getLanguage?.() || "zh-TW"; }

  const proactiveState = {
    briefing: null,
    deadlines: null,
    ghosts: null,
    meetingPrep: null,
    workiqPrompt: "",
    lastScan: null,
    unreadCount: 0,
    readKeys: [],
  };

  // ── Notification Key Helpers ──

  function toNotificationKey(type, item) {
    const parts = [
      type, item?.id, item?.messageId, item?.subject, item?.title,
      item?.from, item?.date, item?.receivedAt, item?.time,
    ].filter((v) => v !== undefined && v !== null && String(v).trim() !== "");
    return parts.join("|");
  }

  function getAllNotificationKeys() {
    const keys = [];
    (proactiveState.briefing?.emails || []).forEach((item) => keys.push(toNotificationKey("briefing-email", item)));
    (proactiveState.briefing?.mentions || []).forEach((item) => keys.push(toNotificationKey("briefing-mention", item)));
    (proactiveState.deadlines?.deadlines || [])
      .filter((d) => d.urgency === "critical" || Number(d.daysLeft) <= 1)
      .forEach((item) => keys.push(toNotificationKey("deadline", item)));
    (proactiveState.ghosts?.ghosts || [])
      .filter((g) => g.priority === "critical" || g.priority === "high")
      .forEach((item) => keys.push(toNotificationKey("ghost", item)));
    if (proactiveState.meetingPrep?.meeting) {
      keys.push(toNotificationKey("meeting-prep", proactiveState.meetingPrep.meeting));
    }
    return keys;
  }

  function normalizeProactiveReadState() {
    const currentKeySet = new Set(getAllNotificationKeys());
    proactiveState.readKeys = [...new Set((proactiveState.readKeys || []).filter((key) => currentKeySet.has(key)))];
  }

  function isNotificationRead(readKey) {
    return readKey ? (proactiveState.readKeys || []).includes(readKey) : false;
  }

  function markNotificationAsRead(readKey) {
    if (!readKey) return;
    const current = proactiveState.readKeys || [];
    if (current.includes(readKey)) return;
    proactiveState.readKeys = [...current, readKey];
    normalizeProactiveReadState();
    updateNotificationBadge();
    chrome.storage.local.set({ proactiveState: { ...proactiveState } });
  }

  function markAllProactiveAsRead() {
    proactiveState.readKeys = [...new Set(getAllNotificationKeys())];
    updateNotificationBadge();
    chrome.storage.local.set({ proactiveState: { ...proactiveState } });
    utils.showToast?.(tp("markedAllRead", "已全部標記為已讀"));
  }

  function updateNotificationBadge() {
    const allKeys = getAllNotificationKeys();
    const readSet = new Set(proactiveState.readKeys || []);
    const count = allKeys.filter((key) => !readSet.has(key)).length;
    proactiveState.unreadCount = count;

    const badge = document.getElementById("notification-badge");
    const totalCount = document.getElementById("notif-total-count");
    if (badge) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.style.display = count > 0 ? "flex" : "none";
    }
    if (totalCount) totalCount.textContent = String(count);
  }

  function renderMarkReadButton(readKey, isRead) {
    const helpers = root.panels?.helpers || {};
    return helpers.renderActionButton?.({
      label: isRead ? localizeRuntimeMessage("✅ 已完成") : localizeRuntimeMessage("已讀"),
      action: "mark-read",
      className: "secondary",
      attrs: { "data-read-key": escapeHtml(readKey) },
      disabled: isRead,
    }) || "";
  }

  // ── Top Priority ──

  function getTopPriorityAction() {
    const currentLanguage = getCurrentLanguage();

    const criticalDeadline = proactiveState.deadlines?.deadlines
      ?.filter((d) => d.urgency === "critical" || Number(d.daysLeft) <= 0)
      ?.sort((a, b) => Number(a.daysLeft ?? 999) - Number(b.daysLeft ?? 999))?.[0];
    if (criticalDeadline) {
      return {
        severity: "critical",
        title: `處理截止事項：${criticalDeadline.title || "未命名事項"}`,
        detail: `${criticalDeadline.date || "今天"} · ${criticalDeadline.source || "email"}`,
        action: currentLanguage === "en"
          ? `Help me execute this urgent deadline now: ${criticalDeadline.title}. Due: ${criticalDeadline.date || "today"}. Context: ${criticalDeadline.snippet || criticalDeadline.sourceDetail || ""}`
          : `請幫我現在處理這個最緊急的截止事項：${criticalDeadline.title}。期限：${criticalDeadline.date || "今天"}。背景：${criticalDeadline.snippet || criticalDeadline.sourceDetail || ""}`,
        meta: "Deadline",
      };
    }

    const criticalGhost = proactiveState.ghosts?.ghosts?.find((g) => g.priority === "critical" || g.priority === "high");
    if (criticalGhost) {
      return {
        severity: criticalGhost.priority === "critical" ? "critical" : "warning",
        title: `回覆信件：${criticalGhost.subject || "未命名信件"}`,
        detail: `${criticalGhost.from || "Unknown"} · ${criticalGhost.receivedAt || ""}`,
        action: currentLanguage === "en"
          ? `Draft a response for this email now: subject "${criticalGhost.subject}", from ${criticalGhost.from}. Context: ${criticalGhost.snippet || ""}`
          : `請立即幫我草擬回覆這封信：主旨「${criticalGhost.subject}」，寄件者 ${criticalGhost.from}。內容：${criticalGhost.snippet || ""}`,
        meta: "Email",
      };
    }

    const urgentTask = proactiveState.briefing?.tasks?.find((t) => t.status === "overdue" || /today|今天/i.test(t.due || ""));
    if (urgentTask) {
      return {
        severity: urgentTask.status === "overdue" ? "warning" : "normal",
        title: `完成任務：${urgentTask.title || "未命名任務"}`,
        detail: `${urgentTask.due || "今天"} · ${urgentTask.source || "To-Do"}`,
        action: currentLanguage === "en"
          ? `Help me complete this task now: ${urgentTask.title}. Due: ${urgentTask.due || "today"}.`
          : `請幫我現在完成這個任務：${urgentTask.title}。期限：${urgentTask.due || "今天"}。`,
        meta: "Task",
      };
    }

    const nextMeeting = proactiveState.briefing?.meetings?.[0];
    if (nextMeeting) {
      return {
        severity: "normal",
        title: `準備會議：${nextMeeting.title || "未命名會議"}`,
        detail: `${nextMeeting.time || ""} · ${nextMeeting.location || ""}`,
        action: currentLanguage === "en"
          ? `Prepare me for this meeting: ${nextMeeting.title} at ${nextMeeting.time || ""}.`
          : `請幫我準備這場會議：${nextMeeting.title}（${nextMeeting.time || ""}）。`,
        meta: "Meeting",
      };
    }

    return null;
  }

  function renderTopPriority() {
    const container = document.getElementById("top-priority-content");
    if (!container) return;
    const top = getTopPriorityAction();
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

  // ── Scan ──

  async function runFullProactiveScan() {
    if (!isConnected()) {
      utils.showToast?.("請先連接 Copilot CLI");
      return;
    }
    const label = document.getElementById("notif-last-scan");
    if (label) label.textContent = localizeRuntimeMessage("掃描中...");

    try {
      const res = await utils.sendToBackground?.({ type: "PROACTIVE_SCAN_ALL" });
      utils.debugLog?.("PROACTIVE", "SCAN_ALL response:", res);
      if (res && res.ok && res.results) {
        processProactiveResults(res.results, res.scannedAt);
      } else if (res && res.results) {
        processProactiveResults(res.results, new Date().toISOString());
      } else {
        utils.showToast?.("掃描未取得資料");
        if (label) label.textContent = localizeRuntimeMessage("掃描完成 · 無資料");
      }
    } catch (err) {
      utils.debugLog?.("ERR", "Proactive scan error:", err.message);
      utils.showToast?.("掃描失敗: " + err.message);
      if (label) label.textContent = localizeRuntimeMessage("載入失敗");
    }
  }

  function processProactiveResults(results, scannedAt) {
    if (results.briefing?.ok && results.briefing.data) {
      proactiveState.briefing = results.briefing.data;
      renderBriefing(results.briefing.data);
    }
    if (results.deadlines?.ok && results.deadlines.data) {
      proactiveState.deadlines = results.deadlines.data;
      renderDeadlines(results.deadlines.data);
    }
    if (results.ghosts?.ok && results.ghosts.data) {
      proactiveState.ghosts = results.ghosts.data;
      renderGhosts(results.ghosts.data);
    }
    if (results.meetingPrep?.ok && results.meetingPrep.data) {
      proactiveState.meetingPrep = results.meetingPrep.data;
      renderMeetingPrep(results.meetingPrep.data);
    }

    proactiveState.lastScan = scannedAt;
    normalizeProactiveReadState();
    updateNotificationBadge();
    renderTopPriority();

    const label = document.getElementById("notif-last-scan");
    if (label) {
      const time = new Date(scannedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
      label.textContent = `上次掃描: ${time}`;
    }
    chrome.storage.local.set({ proactiveState: { ...proactiveState } });
  }

  function handleProactiveUpdate(msg) {
    utils.debugLog?.("PROACTIVE", `Received update for: ${msg.agent}`);
    const data = msg.data;
    const ts = msg.scannedAt || new Date().toISOString();

    switch (msg.agent) {
      case "briefing": proactiveState.briefing = data; renderBriefing(data); break;
      case "deadlines": proactiveState.deadlines = data; renderDeadlines(data); break;
      case "ghosts": proactiveState.ghosts = data; renderGhosts(data); break;
      case "meeting-prep": proactiveState.meetingPrep = data; renderMeetingPrep(data); break;
    }

    proactiveState.lastScan = ts;
    normalizeProactiveReadState();
    updateNotificationBadge();
    renderTopPriority();
    chrome.storage.local.set({ proactiveState: { ...proactiveState } });
  }

  // ── Shared Insight Card Helpers ──

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

  // ── Render: Briefing ──

  function renderBriefing(data) {
    const empty = document.getElementById("briefing-empty");
    const hasData = (data.emails?.length || 0) + (data.meetings?.length || 0) + (data.tasks?.length || 0) + (data.mentions?.length || 0) > 0;
    if (empty) empty.style.display = hasData ? "none" : "block";

    renderInsightItems("briefing-emails", data.emails || [], (item) => {
      const readKey = toNotificationKey("briefing-email", item);
      const isRead = isNotificationRead(readKey);
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
      const readKey = toNotificationKey("briefing-mention", item);
      const isRead = isNotificationRead(readKey);
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

  // ── Render: Deadlines ──

  function renderDeadlines(data) {
    const empty = document.getElementById("deadline-empty");
    const items = data.deadlines || [];
    if (empty) empty.style.display = items.length > 0 ? "none" : "block";

    renderInsightItems("deadline-list", items, (item) => {
      const readKey = toNotificationKey("deadline", item);
      const isRead = isNotificationRead(readKey);
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

  // ── Render: Ghosts ──

  function renderGhosts(data) {
    const empty = document.getElementById("ghost-empty");
    const items = data.ghosts || [];
    if (empty) empty.style.display = items.length > 0 ? "none" : "block";

    renderInsightItems("ghost-list", items, (item) => {
      const readKey = toNotificationKey("ghost", item);
      const isRead = isNotificationRead(readKey);
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

  // ── Render: Meeting Prep ──

  function renderMeetingPrep(data) {
    const empty = document.getElementById("meeting-prep-empty");
    const container = document.getElementById("meeting-prep-list");
    const hasMeeting = data.meeting && data.meeting.title;

    if (empty) empty.style.display = hasMeeting ? "none" : "block";
    if (!container || !hasMeeting) { updateSectionCount("meeting-prep-count", 0); return; }

    let html = "";

    const meetingReadKey = toNotificationKey("meeting-prep", data.meeting || {});
    const isMeetingRead = isNotificationRead(meetingReadKey);
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

  // ── Insight Action Handlers ──

  async function handleInsightAction(btn) {
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
          ? `Please draft a reply email to ${from} about \"${subject}\".\n\nEmail summary: ${snippet}\n\nUse a professional but friendly tone.`
          : `請幫我草擬一封回覆信，回覆 ${from} 的信件「${subject}」。\n\n信件內容摘要：${snippet}\n\n請用專業但友善的語氣。`;
        if (chatInput) chatInput.value = prompt;
        root._sendMessage?.();
        break;
      }
      case "reply": {
        root._switchPanel?.("chat");
        if (chatInput) {
          chatInput.value = currentLanguage === "en"
            ? `I need to reply to ${from} about \"${subject}\". Please draft a response.`
            : `我需要回覆 ${from} 關於「${subject}」的信件。請幫我草擬回覆。`;
        }
        chatInput?.focus();
        break;
      }
      case "meetprep": {
        root._switchPanel?.("chat");
        if (chatInput) {
          chatInput.value = currentLanguage === "en"
            ? `Please help me prepare for \"${title}\". Summarize related materials, attendee background, and my action items.`
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
        markNotificationAsRead(readKey);
        btn.textContent = localizeRuntimeMessage("✅ 已完成");
        btn.disabled = true;
        btn.closest(".insight-item")?.classList.add("completed");
        break;
      }
      default:
        utils.debugLog?.("PROACTIVE", `Unknown action: ${action}`);
    }
  }

  // ── Config + Restore ──

  async function loadProactiveConfig() {
    try {
      const res = await utils.sendToBackground?.({ type: "GET_PROACTIVE_CONFIG" });
      const prompt = typeof res?.config?.workiqPrompt === "string" ? res.config.workiqPrompt : "";
      proactiveState.workiqPrompt = prompt;
      const promptEl = document.getElementById("proactive-workiq-prompt");
      if (promptEl) promptEl.value = prompt;
    } catch (err) {
      utils.debugLog?.("ERR", "loadProactiveConfig error:", err.message);
    }
  }

  function restoreProactiveState() {
    chrome.storage.local.get("proactiveState", (data) => {
      if (data.proactiveState) {
        const s = data.proactiveState;
        if (s.briefing) { proactiveState.briefing = s.briefing; renderBriefing(s.briefing); }
        if (s.deadlines) { proactiveState.deadlines = s.deadlines; renderDeadlines(s.deadlines); }
        if (s.ghosts) { proactiveState.ghosts = s.ghosts; renderGhosts(s.ghosts); }
        if (s.meetingPrep) { proactiveState.meetingPrep = s.meetingPrep; renderMeetingPrep(s.meetingPrep); }
        if (s.lastScan) {
          proactiveState.lastScan = s.lastScan;
          const label = document.getElementById("notif-last-scan");
          if (label) {
            const time = new Date(s.lastScan).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
            label.textContent = `上次掃描: ${time}`;
          }
        }
        if (Array.isArray(s.readKeys)) {
          proactiveState.readKeys = [...new Set(s.readKeys.filter((key) => typeof key === "string" && key.trim().length > 0))];
        }
        normalizeProactiveReadState();
        updateNotificationBadge();
        renderTopPriority();
      }
    });
  }

  function bindEvents() {
    document.querySelectorAll(".insight-section-header").forEach((header) => {
      header.addEventListener("click", () => {
        const targetId = header.dataset.toggle;
        const body = document.getElementById(targetId);
        const section = header.closest(".insight-section");
        if (body && section) section.classList.toggle("collapsed");
      });
    });

    document.getElementById("btn-refresh-proactive")?.addEventListener("click", async () => {
      utils.showToast?.("正在掃描所有代理...");
      await runFullProactiveScan();
    });

    document.getElementById("btn-mark-all-read")?.addEventListener("click", () => {
      markAllProactiveAsRead();
    });

    document.getElementById("btn-save-proactive-config")?.addEventListener("click", async () => {
      const prompt = document.getElementById("proactive-workiq-prompt")?.value || "";
      try {
        await utils.sendToBackground?.({ type: "SET_PROACTIVE_CONFIG", workiqPrompt: prompt });
        proactiveState.workiqPrompt = prompt;
        utils.showToast?.("Proactive Prompt 已儲存");
      } catch (err) {
        utils.showToast?.("儲存失敗: " + err.message);
      }
    });

    document.getElementById("btn-clear-proactive-config")?.addEventListener("click", async () => {
      try {
        await utils.sendToBackground?.({ type: "SET_PROACTIVE_CONFIG", workiqPrompt: "" });
        proactiveState.workiqPrompt = "";
        const promptEl = document.getElementById("proactive-workiq-prompt");
        if (promptEl) promptEl.value = "";
        utils.showToast?.("Proactive Prompt 已清除");
      } catch (err) {
        utils.showToast?.("清除失敗: " + err.message);
      }
    });
  }

  root.panels.proactive = {
    handleProactiveUpdate,
    runFullProactiveScan,
    restoreProactiveState,
    loadProactiveConfig,
    renderTopPriority,
    updateNotificationBadge,
    bindEvents,
  };
})(window);
