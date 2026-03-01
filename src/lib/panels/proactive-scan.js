(function initIQPanelProactiveScan(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  root.panels.proactiveScanFactory = function createProactiveScanFactory({ stateApi, renderApi }) {
    const utils = root.utils || {};
    const i18n = root.i18n || {};

    function isConnected() { return root.connection?.isConnected?.() || false; }
    function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
    function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }

    const AUTO_SCAN_MIN_INTERVAL_MS = 5 * 60 * 1000;
    let proactiveScheduleCards = [];

    const AGENT_OPTIONS = [
      { value: "briefing", label: "每日晨報" },
      { value: "deadlines", label: "截止日追蹤" },
      { value: "ghosts", label: "未回覆偵測" },
      { value: "meeting-prep", label: "會議準備" },
    ];

    const SCHEDULE_MODE_OPTIONS = [
      { value: "interval", label: "每 N 分鐘" },
      { value: "daily", label: "每天固定時間" },
      { value: "weekly", label: "每週固定日 + 時間" },
    ];

    const WEEKDAY_OPTIONS = [
      { value: 0, label: "日" },
      { value: 1, label: "一" },
      { value: 2, label: "二" },
      { value: 3, label: "三" },
      { value: 4, label: "四" },
      { value: 5, label: "五" },
      { value: 6, label: "六" },
    ];

    function normalizeScheduleCard(card) {
      const schedule = card?.schedule || {};
      const weekdaysRaw = Array.isArray(schedule.weekdays) ? schedule.weekdays : [1, 2, 3, 4, 5];
      const weekdays = [...new Set(weekdaysRaw.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v <= 6))];
      return {
        id: typeof card?.id === "string" ? card.id : `card-${Date.now()}`,
        name: typeof card?.name === "string" && card.name.trim() ? card.name.trim() : "新查詢卡",
        agent: AGENT_OPTIONS.some((o) => o.value === card?.agent) ? card.agent : "briefing",
        enabled: card?.enabled !== false,
        schedule: {
          mode: SCHEDULE_MODE_OPTIONS.some((o) => o.value === schedule.mode) ? schedule.mode : "interval",
          intervalMinutes: Math.min(24 * 60, Math.max(1, Number(schedule.intervalMinutes ?? 60) || 60)),
          hour: Math.min(23, Math.max(0, Number(schedule.hour ?? 9) || 9)),
          minute: Math.min(59, Math.max(0, Number(schedule.minute ?? 0) || 0)),
          weekdays: weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5],
        },
        lastRun: typeof card?.lastRun === "string" ? card.lastRun : null,
        lastStatus: typeof card?.lastStatus === "string" ? card.lastStatus : "idle",
      };
    }

    function formatScheduleCardStatus(card) {
      const runTime = card.lastRun
        ? new Date(card.lastRun).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
        : "--";
      const statusMap = {
        idle: "尚未執行",
        ok: "最近成功",
        error: "最近失敗",
      };
      return `${statusMap[card.lastStatus] || "尚未執行"} · ${runTime}`;
    }

    function buildHourOptions(selectedHour) {
      return Array.from({ length: 24 }, (_, idx) => `<option value="${idx}" ${idx === selectedHour ? "selected" : ""}>${String(idx).padStart(2, "0")}</option>`).join("");
    }

    function buildMinuteOptions(selectedMinute) {
      return Array.from({ length: 60 }, (_, idx) => `<option value="${idx}" ${idx === selectedMinute ? "selected" : ""}>${String(idx).padStart(2, "0")}</option>`).join("");
    }

    function renderScheduleCards(cards) {
      proactiveScheduleCards = (Array.isArray(cards) ? cards : []).map(normalizeScheduleCard);
      const listEl = document.getElementById("proactive-schedule-cards-list");
      const emptyEl = document.getElementById("proactive-schedule-cards-empty");
      if (!listEl || !emptyEl) return;

      if (proactiveScheduleCards.length === 0) {
        listEl.innerHTML = "";
        emptyEl.style.display = "block";
        return;
      }

      emptyEl.style.display = "none";
      listEl.innerHTML = proactiveScheduleCards.map((card) => {
        const schedule = card.schedule || {};
        const mode = schedule.mode || "interval";
        const weekdays = new Set(schedule.weekdays || [1, 2, 3, 4, 5]);

        return `<div class="proactive-schedule-card" data-card-id="${escapeHtml(card.id)}">
          <div class="proactive-schedule-card-header">
            <div class="proactive-schedule-card-title">${escapeHtml(card.name)}</div>
            <span class="proactive-schedule-card-status">${escapeHtml(formatScheduleCardStatus(card))}</span>
          </div>

          <div class="proactive-schedule-grid">
            <div class="proactive-schedule-field wide">
              <label>卡片名稱</label>
              <input type="text" data-field="name" value="${escapeHtml(card.name)}" />
            </div>

            <div class="proactive-schedule-field">
              <label>查詢類型</label>
              <select data-field="agent">
                ${AGENT_OPTIONS.map((option) => `<option value="${option.value}" ${card.agent === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
              </select>
            </div>

            <div class="proactive-schedule-field">
              <label>排程模式</label>
              <select data-field="mode">
                ${SCHEDULE_MODE_OPTIONS.map((option) => `<option value="${option.value}" ${mode === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
              </select>
            </div>

            <div class="proactive-schedule-field" data-mode-row="interval" style="display:${mode === "interval" ? "flex" : "none"}">
              <label>每幾分鐘</label>
              <input type="number" min="1" max="1440" data-field="intervalMinutes" value="${Number(schedule.intervalMinutes || 60)}" />
            </div>

            <div class="proactive-schedule-field" data-mode-row="time" style="display:${mode === "interval" ? "none" : "flex"}">
              <label>小時</label>
              <select data-field="hour">${buildHourOptions(Number(schedule.hour || 9))}</select>
            </div>

            <div class="proactive-schedule-field" data-mode-row="time" style="display:${mode === "interval" ? "none" : "flex"}">
              <label>分鐘</label>
              <select data-field="minute">${buildMinuteOptions(Number(schedule.minute || 0))}</select>
            </div>

            <div class="proactive-schedule-field wide" data-mode-row="weekly" style="display:${mode === "weekly" ? "flex" : "none"}">
              <label>星期</label>
              <div class="proactive-weekday-row">
                ${WEEKDAY_OPTIONS.map((day) => `<label class="proactive-weekday-chip"><input type="checkbox" data-weekday="${day.value}" ${weekdays.has(day.value) ? "checked" : ""} />${day.label}</label>`).join("")}
              </div>
            </div>

            <div class="proactive-schedule-field wide">
              <label><input type="checkbox" data-field="enabled" ${card.enabled ? "checked" : ""} /> 啟用此小卡排程</label>
            </div>
          </div>

          <div class="proactive-schedule-actions">
            <button class="action-btn" data-action="save-card">儲存</button>
            <button class="action-btn primary" data-action="refresh-apply-card">Refresh 套用</button>
            <button class="action-btn" data-action="delete-card">刪除</button>
          </div>
        </div>`;
      }).join("");
    }

    function updateScheduleCardModeRows(cardEl) {
      const modeSelect = cardEl.querySelector("select[data-field='mode']");
      const mode = modeSelect?.value || "interval";
      cardEl.querySelectorAll("[data-mode-row='interval']").forEach((el) => {
        el.style.display = mode === "interval" ? "flex" : "none";
      });
      cardEl.querySelectorAll("[data-mode-row='time']").forEach((el) => {
        el.style.display = mode === "interval" ? "none" : "flex";
      });
      cardEl.querySelectorAll("[data-mode-row='weekly']").forEach((el) => {
        el.style.display = mode === "weekly" ? "flex" : "none";
      });
    }

    function readScheduleCardFromElement(cardEl) {
      const cardId = cardEl.dataset.cardId || "";
      const name = cardEl.querySelector("input[data-field='name']")?.value || "新查詢卡";
      const agent = cardEl.querySelector("select[data-field='agent']")?.value || "briefing";
      const mode = cardEl.querySelector("select[data-field='mode']")?.value || "interval";
      const intervalMinutes = Number(cardEl.querySelector("input[data-field='intervalMinutes']")?.value || 60);
      const hour = Number(cardEl.querySelector("select[data-field='hour']")?.value || 9);
      const minute = Number(cardEl.querySelector("select[data-field='minute']")?.value || 0);
      const weekdays = Array.from(cardEl.querySelectorAll("input[data-weekday]:checked"))
        .map((el) => Number(el.getAttribute("data-weekday")))
        .filter((v) => Number.isInteger(v));
      const enabled = Boolean(cardEl.querySelector("input[data-field='enabled']")?.checked);
      const prev = proactiveScheduleCards.find((card) => card.id === cardId) || {};

      return normalizeScheduleCard({
        ...prev,
        id: cardId,
        name,
        agent,
        enabled,
        schedule: {
          mode,
          intervalMinutes,
          hour,
          minute,
          weekdays,
        },
      });
    }

    async function loadProactiveScheduleCards() {
      try {
        const res = await utils.sendToBackground?.({ type: "GET_PROACTIVE_SCHEDULE_CARDS" });
        renderScheduleCards(res?.cards || []);
      } catch (err) {
        utils.debugLog?.("ERR", "loadProactiveScheduleCards error:", err?.message || err);
      }
    }

    async function addProactiveScheduleCard() {
      try {
        const res = await utils.sendToBackground?.({ type: "ADD_PROACTIVE_SCHEDULE_CARD" });
        renderScheduleCards(res?.cards || []);
        utils.showToast?.("已新增查詢排程小卡");
      } catch (err) {
        utils.showToast?.("新增失敗: " + err.message);
      }
    }

    async function saveProactiveScheduleCard(cardEl) {
      const card = readScheduleCardFromElement(cardEl);
      const res = await utils.sendToBackground?.({ type: "UPSERT_PROACTIVE_SCHEDULE_CARD", card });
      renderScheduleCards(res?.cards || []);
      utils.showToast?.("排程已儲存");
      return card;
    }

    async function refreshApplyProactiveScheduleCard(cardEl) {
      const card = await saveProactiveScheduleCard(cardEl);
      const res = await utils.sendToBackground?.({
        type: "APPLY_PROACTIVE_SCHEDULE_CARD",
        cardId: card.id,
        runNow: true,
      });
      renderScheduleCards(res?.cards || []);
      if (res?.ok) {
        utils.showToast?.("已套用排程並立即查詢");
      } else {
        utils.showToast?.("套用失敗: " + (res?.runResult?.error || "unknown"));
      }
    }

    async function deleteProactiveScheduleCard(cardEl) {
      const cardId = cardEl.dataset.cardId || "";
      if (!cardId) return;
      const res = await utils.sendToBackground?.({ type: "DELETE_PROACTIVE_SCHEDULE_CARD", cardId });
      renderScheduleCards(res?.cards || []);
      utils.showToast?.("已刪除排程小卡");
    }

    async function runFullProactiveScan(options = {}) {
      const source = options.source || "manual";
      if (!isConnected()) {
        utils.showToast?.("請先連接 Copilot CLI");
        return;
      }

      const lastScan = stateApi.proactiveState?.lastScan ? new Date(stateApi.proactiveState.lastScan).getTime() : 0;
      const elapsed = Date.now() - lastScan;
      if (source !== "manual" && lastScan > 0 && elapsed < AUTO_SCAN_MIN_INTERVAL_MS) {
        const label = document.getElementById("notif-last-scan");
        if (label) {
          const remainSec = Math.ceil((AUTO_SCAN_MIN_INTERVAL_MS - elapsed) / 1000);
          label.textContent = localizeRuntimeMessage(`略過自動掃描（${remainSec}s 後可再試）`);
        }
        return;
      }

      const label = document.getElementById("notif-last-scan");
      if (label) label.textContent = localizeRuntimeMessage("掃描中...");

      try {
        const res = await utils.sendToBackground?.({ type: "PROACTIVE_SCAN_ALL", source });
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

    async function runAgentProactiveScan(agent) {
      if (!isConnected()) {
        utils.showToast?.("請先連接 Copilot CLI");
        return;
      }

      const messageTypeByAgent = {
        briefing: "PROACTIVE_BRIEFING",
        deadlines: "PROACTIVE_DEADLINES",
        ghosts: "PROACTIVE_GHOSTS",
        "meeting-prep": "PROACTIVE_MEETING_PREP",
      };

      const labelByAgent = {
        briefing: "每日晨報",
        deadlines: "截止日追蹤",
        ghosts: "未回覆偵測",
        "meeting-prep": "會議準備",
      };

      const messageType = messageTypeByAgent[agent];
      if (!messageType) {
        utils.debugLog?.("PROACTIVE", `Unknown proactive agent: ${agent}`);
        return;
      }

      const sectionLabel = labelByAgent[agent] || agent;
      const statusLabel = document.getElementById("notif-last-scan");
      if (statusLabel) statusLabel.textContent = localizeRuntimeMessage(`更新中: ${sectionLabel}`);

      try {
        const res = await utils.sendToBackground?.({ type: messageType });
        if (res?.ok && res.data) {
          handleProactiveUpdate({
            agent,
            data: res.data,
            scannedAt: new Date().toISOString(),
          });
          utils.showToast?.(`${sectionLabel} 已更新`);
          return;
        }
        utils.showToast?.(`${sectionLabel} 更新未取得資料`);
      } catch (err) {
        utils.debugLog?.("ERR", `Proactive agent scan error (${agent}):`, err?.message || err);
        utils.showToast?.(`${sectionLabel} 更新失敗: ${err.message}`);
        if (statusLabel) statusLabel.textContent = localizeRuntimeMessage("載入失敗");
      }
    }

    function processProactiveResults(results, scannedAt) {
      const proactiveState = stateApi.proactiveState;

      // Helper to safely track achievements
      const trackAchievement = (event, meta) => {
        if (typeof AchievementEngine !== "undefined" && AchievementEngine.track) {
          AchievementEngine.track(event, meta);
        }
      };

      if (results.briefing?.ok && results.briefing.data) {
        proactiveState.briefing = results.briefing.data;
        renderApi.renderBriefing(results.briefing.data);
        // Track briefing view achievement
        trackAchievement("briefing_view", { source: "scan" });
      }
      if (results.deadlines?.ok && results.deadlines.data) {
        proactiveState.deadlines = results.deadlines.data;
        renderApi.renderDeadlines(results.deadlines.data);
      }
      if (results.ghosts?.ok && results.ghosts.data) {
        proactiveState.ghosts = results.ghosts.data;
        renderApi.renderGhosts(results.ghosts.data);
      }
      if (results.meetingPrep?.ok && results.meetingPrep.data) {
        proactiveState.meetingPrep = results.meetingPrep.data;
        renderApi.renderMeetingPrep(results.meetingPrep.data);
      }

      proactiveState.lastScan = scannedAt;
      stateApi.normalizeProactiveReadState();
      stateApi.updateNotificationBadge();
      renderApi.renderTopPriority();

      const label = document.getElementById("notif-last-scan");
      if (label) {
        const time = new Date(scannedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
        label.textContent = `上次掃描: ${time}`;
      }
      // P2-10: Use batched storage write
      utils.batchStorageWrite?.("proactiveState", { ...proactiveState }) ??
        chrome.storage.local.set({ proactiveState: { ...proactiveState } });
    }

    function handleProactiveUpdate(msg) {
      const proactiveState = stateApi.proactiveState;
      utils.debugLog?.("PROACTIVE", `Received update for: ${msg.agent}`);
      const data = msg.data;
      const ts = msg.scannedAt || new Date().toISOString();

      // Helper to safely track achievements
      const trackAchievement = (event, meta) => {
        if (typeof AchievementEngine !== "undefined" && AchievementEngine.track) {
          AchievementEngine.track(event, meta);
        }
      };

      switch (msg.agent) {
        case "briefing":
          proactiveState.briefing = data;
          renderApi.renderBriefing(data);
          trackAchievement("briefing_view", { source: "push" });
          break;
        case "deadlines": proactiveState.deadlines = data; renderApi.renderDeadlines(data); break;
        case "ghosts": proactiveState.ghosts = data; renderApi.renderGhosts(data); break;
        case "meeting-prep": proactiveState.meetingPrep = data; renderApi.renderMeetingPrep(data); break;
      }

      proactiveState.lastScan = ts;
      stateApi.normalizeProactiveReadState();
      stateApi.updateNotificationBadge();
      renderApi.renderTopPriority();
      // P2-10: Use batched storage write
      utils.batchStorageWrite?.("proactiveState", { ...proactiveState }) ??
        chrome.storage.local.set({ proactiveState: { ...proactiveState } });
    }

    function updatePromptStatusCard(prompt) {
      const card = document.getElementById("proactive-prompt-status-card");
      const text = document.getElementById("proactive-prompt-status-text");
      const runBtn = document.getElementById("btn-run-proactive-prompt-query");
      if (!card || !text || !runBtn) return;

      const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";
      if (!trimmedPrompt) {
        card.style.display = "none";
        return;
      }

      card.style.display = "block";
      text.textContent = `目前已套用 Prompt：${trimmedPrompt}`;
      runBtn.disabled = false;
    }

    async function loadProactiveConfig() {
      try {
        const res = await utils.sendToBackground?.({ type: "GET_PROACTIVE_CONFIG" });
        const prompt = typeof res?.config?.workiqPrompt === "string" ? res.config.workiqPrompt : "";
        stateApi.proactiveState.workiqPrompt = prompt;
        const promptEl = document.getElementById("proactive-workiq-prompt");
        if (promptEl) promptEl.value = prompt;
        updatePromptStatusCard(prompt);
        await loadProactiveScheduleCards();
      } catch (err) {
        utils.debugLog?.("ERR", "loadProactiveConfig error:", err.message);
      }
    }

    function restoreProactiveState() {
      // Helper to safely track achievements
      const trackAchievement = (event, meta) => {
        if (typeof AchievementEngine !== "undefined" && AchievementEngine.track) {
          AchievementEngine.track(event, meta);
        }
      };

      chrome.storage.local.get("proactiveState", (data) => {
        const proactiveState = stateApi.proactiveState;
        if (data.proactiveState) {
          const s = data.proactiveState;
          if (s.briefing) {
            proactiveState.briefing = s.briefing;
            renderApi.renderBriefing(s.briefing);
            // Track briefing view when restored (user re-opened sidebar)
            trackAchievement("briefing_view", { source: "restore" });
          }
          if (s.deadlines) { proactiveState.deadlines = s.deadlines; renderApi.renderDeadlines(s.deadlines); }
          if (s.ghosts) { proactiveState.ghosts = s.ghosts; renderApi.renderGhosts(s.ghosts); }
          if (s.meetingPrep) { proactiveState.meetingPrep = s.meetingPrep; renderApi.renderMeetingPrep(s.meetingPrep); }
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
          stateApi.normalizeProactiveReadState();
          stateApi.updateNotificationBadge();
          renderApi.renderTopPriority();
        }
      });
    }

    function bindEvents() {
      renderApi.bindInsightSectionToggles();

      document.getElementById("btn-refresh-proactive")?.addEventListener("click", async () => {
        utils.showToast?.("正在掃描所有代理...");
        await runFullProactiveScan();
      });

      document.getElementById("btn-add-schedule-card")?.addEventListener("click", async () => {
        await addProactiveScheduleCard();
      });

      document.getElementById("proactive-schedule-cards-list")?.addEventListener("change", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const cardEl = target.closest(".proactive-schedule-card");
        if (!(cardEl instanceof HTMLElement)) return;

        if (target.matches("select[data-field='mode']")) {
          updateScheduleCardModeRows(cardEl);
        }
      });

      document.getElementById("proactive-schedule-cards-list")?.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const button = target.closest("button[data-action]");
        if (!(button instanceof HTMLElement)) return;
        const action = button.dataset.action;
        const cardEl = button.closest(".proactive-schedule-card");
        if (!(cardEl instanceof HTMLElement)) return;

        try {
          if (action === "save-card") {
            await saveProactiveScheduleCard(cardEl);
            return;
          }
          if (action === "refresh-apply-card") {
            await refreshApplyProactiveScheduleCard(cardEl);
            return;
          }
          if (action === "delete-card") {
            await deleteProactiveScheduleCard(cardEl);
          }
        } catch (err) {
          utils.showToast?.("操作失敗: " + (err?.message || "unknown"));
        }
      });

      document.querySelectorAll(".section-refresh-btn").forEach((btn) => {
        btn.addEventListener("click", async (event) => {
          event.stopPropagation();
          event.preventDefault();
          const agent = btn.dataset.agent;
          if (!agent) return;
          await runAgentProactiveScan(agent);
        });
      });

      document.getElementById("btn-mark-all-read")?.addEventListener("click", () => {
        stateApi.markAllProactiveAsRead();
      });

      document.getElementById("btn-save-proactive-config")?.addEventListener("click", async () => {
        const prompt = document.getElementById("proactive-workiq-prompt")?.value || "";
        try {
          await utils.sendToBackground?.({ type: "SET_PROACTIVE_CONFIG", workiqPrompt: prompt });
          stateApi.proactiveState.workiqPrompt = prompt;
          updatePromptStatusCard(prompt);
          utils.showToast?.("Proactive Prompt 已儲存");
          await runFullProactiveScan({ source: "manual" });
        } catch (err) {
          utils.showToast?.("儲存失敗: " + err.message);
        }
      });

      document.getElementById("btn-clear-proactive-config")?.addEventListener("click", async () => {
        try {
          await utils.sendToBackground?.({ type: "SET_PROACTIVE_CONFIG", workiqPrompt: "" });
          stateApi.proactiveState.workiqPrompt = "";
          const promptEl = document.getElementById("proactive-workiq-prompt");
          if (promptEl) promptEl.value = "";
          updatePromptStatusCard("");
          utils.showToast?.("Proactive Prompt 已清除");
        } catch (err) {
          utils.showToast?.("清除失敗: " + err.message);
        }
      });

      document.getElementById("btn-run-proactive-prompt-query")?.addEventListener("click", async () => {
        await runFullProactiveScan({ source: "manual" });
      });
    }

    return {
      runFullProactiveScan,
      runAgentProactiveScan,
      processProactiveResults,
      handleProactiveUpdate,
      loadProactiveConfig,
      restoreProactiveState,
      bindEvents,
    };
  };
})(window);
