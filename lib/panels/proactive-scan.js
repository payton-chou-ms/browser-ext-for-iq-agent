(function initIQPanelProactiveScan(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  root.panels.proactiveScanFactory = function createProactiveScanFactory({ stateApi, renderApi }) {
    const utils = root.utils || {};
    const i18n = root.i18n || {};

    function isConnected() { return root.connection?.isConnected?.() || false; }
    function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }

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
      const proactiveState = stateApi.proactiveState;

      if (results.briefing?.ok && results.briefing.data) {
        proactiveState.briefing = results.briefing.data;
        renderApi.renderBriefing(results.briefing.data);
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
      chrome.storage.local.set({ proactiveState: { ...proactiveState } });
    }

    function handleProactiveUpdate(msg) {
      const proactiveState = stateApi.proactiveState;
      utils.debugLog?.("PROACTIVE", `Received update for: ${msg.agent}`);
      const data = msg.data;
      const ts = msg.scannedAt || new Date().toISOString();

      switch (msg.agent) {
        case "briefing": proactiveState.briefing = data; renderApi.renderBriefing(data); break;
        case "deadlines": proactiveState.deadlines = data; renderApi.renderDeadlines(data); break;
        case "ghosts": proactiveState.ghosts = data; renderApi.renderGhosts(data); break;
        case "meeting-prep": proactiveState.meetingPrep = data; renderApi.renderMeetingPrep(data); break;
      }

      proactiveState.lastScan = ts;
      stateApi.normalizeProactiveReadState();
      stateApi.updateNotificationBadge();
      renderApi.renderTopPriority();
      chrome.storage.local.set({ proactiveState: { ...proactiveState } });
    }

    async function loadProactiveConfig() {
      try {
        const res = await utils.sendToBackground?.({ type: "GET_PROACTIVE_CONFIG" });
        const prompt = typeof res?.config?.workiqPrompt === "string" ? res.config.workiqPrompt : "";
        stateApi.proactiveState.workiqPrompt = prompt;
        const promptEl = document.getElementById("proactive-workiq-prompt");
        if (promptEl) promptEl.value = prompt;
      } catch (err) {
        utils.debugLog?.("ERR", "loadProactiveConfig error:", err.message);
      }
    }

    function restoreProactiveState() {
      chrome.storage.local.get("proactiveState", (data) => {
        const proactiveState = stateApi.proactiveState;
        if (data.proactiveState) {
          const s = data.proactiveState;
          if (s.briefing) { proactiveState.briefing = s.briefing; renderApi.renderBriefing(s.briefing); }
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

      document.getElementById("btn-mark-all-read")?.addEventListener("click", () => {
        stateApi.markAllProactiveAsRead();
      });

      document.getElementById("btn-save-proactive-config")?.addEventListener("click", async () => {
        const prompt = document.getElementById("proactive-workiq-prompt")?.value || "";
        try {
          await utils.sendToBackground?.({ type: "SET_PROACTIVE_CONFIG", workiqPrompt: prompt });
          stateApi.proactiveState.workiqPrompt = prompt;
          utils.showToast?.("Proactive Prompt 已儲存");
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
          utils.showToast?.("Proactive Prompt 已清除");
        } catch (err) {
          utils.showToast?.("清除失敗: " + err.message);
        }
      });
    }

    return {
      runFullProactiveScan,
      processProactiveResults,
      handleProactiveUpdate,
      loadProactiveConfig,
      restoreProactiveState,
      bindEvents,
    };
  };
})(window);
