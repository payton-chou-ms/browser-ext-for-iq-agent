(function initIQPanelProactiveState(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  root.panels.proactiveStateFactory = function createProactiveStateFactory() {
    const utils = root.utils || {};
    const i18n = root.i18n || {};

    function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
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

      const urgentTask = proactiveState.briefing?.tasks?.find((task) => task.status === "overdue" || /today|今天/i.test(task.due || ""));
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

    return {
      proactiveState,
      localizeRuntimeMessage,
      t,
      tp,
      toNotificationKey,
      getAllNotificationKeys,
      normalizeProactiveReadState,
      isNotificationRead,
      markNotificationAsRead,
      markAllProactiveAsRead,
      updateNotificationBadge,
      getTopPriorityAction,
    };
  };
})(window);
