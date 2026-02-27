(function initIQPanelTasks(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const CONFIG = root.state?.CONFIG || {};
  const t = () => root.i18n?.t || ((p, f) => f);

  function tTask(path, fallback) {
    return t()(path, fallback);
  }

  let taskStartTime = null;
  let taskTimerInterval = null;

  function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }

  function getTaskElapsed() {
    if (!taskStartTime) return 0;
    return (Date.now() - taskStartTime) / 1000;
  }

  function startTaskTimer() {
    if (taskTimerInterval) return;
    taskStartTime = Date.now();
    taskTimerInterval = setInterval(() => {
      const el = document.getElementById("tasks-elapsed");
      if (el) el.textContent = `⏱ ${getTaskElapsed().toFixed(1)}${tTask("tasks.secondsShort", "s")}`;
    }, CONFIG.TASK_TIMER_INTERVAL_MS || 100);
  }

  function stopTaskTimer() {
    if (taskTimerInterval) {
      clearInterval(taskTimerInterval);
      taskTimerInterval = null;
    }
  }

  const toolIcons = {
    bash: "💻", edit: "✏️", grep: "🔍", view: "📄", create: "📝",
    read: "📄", write: "✏️", search: "🔍", run: "💻", execute: "💻",
    list: "📋", delete: "🗑️", move: "📦", copy: "📋",
    mcp_: "🔌", semantic_search: "🔍", file_search: "📂",
    replace_string_in_file: "✏️", read_file: "📄", create_file: "📝",
    run_in_terminal: "💻", grep_search: "🔍", list_dir: "📂",
  };

  function getToolIcon(name) {
    const lower = (name || "").toLowerCase();
    for (const [key, icon] of Object.entries(toolIcons)) {
      if (lower.includes(key)) return icon;
    }
    return "🔧";
  }

  function renderTasksList() {
    const chatState = root.chat?.getState?.() || {};
    const toolCalls = chatState.toolCalls || [];
    const subAgents = chatState.subAgents || [];

    const list = document.getElementById("parallel-task-list");
    const emptyEl = document.getElementById("parallel-tasks-empty");
    const counterEl = document.getElementById("tasks-counter");
    const fillEl = document.getElementById("tasks-progress-fill");
    const runningEl = document.getElementById("tasks-running");
    const doneEl = document.getElementById("tasks-done");

    if (!list) return;

    const total = toolCalls.length;
    const running = toolCalls.filter((t) => t.status === "running").length;
    const done = toolCalls.filter((t) => t.status !== "running").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    if (counterEl) counterEl.textContent = `${done} / ${total}`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (runningEl) runningEl.textContent = `🔄 ${running} ${tTask("tasks.running", "進行中")}`;
    if (doneEl) doneEl.textContent = `✅ ${done} ${tTask("tasks.done", "完成")}`;
    if (emptyEl) emptyEl.style.display = total === 0 ? "" : "none";

    const existing = list.querySelectorAll(".parallel-task-item");
    existing.forEach((el) => el.remove());

    if (total === 0) return;

    const sorted = [...toolCalls]
      .map((tc, i) => ({ ...tc, _idx: i }))
      .sort((a, b) => {
        if (a.status === "running" && b.status !== "running") return -1;
        if (a.status !== "running" && b.status === "running") return 1;
        return b._idx - a._idx;
      });

    for (const tc of sorted) {
      const item = document.createElement("div");
      item.className = "parallel-task-item";
      item.dataset.index = tc._idx;

      const isRunning = tc.status === "running";
      const isError = tc.status === "error";
      const statusClass = isRunning ? "running" : isError ? "error" : "success";

      const elapsed = tc.startedAt
        ? ((tc.endedAt || Date.now()) - tc.startedAt) / 1000
        : 0;
      const elapsedStr = elapsed > 0 ? elapsed.toFixed(1) + "s" : "";

      const icon = getToolIcon(tc.name);
      const shortName = (tc.name || tTask("tasks.defaultTool", "tool")).replace(/^mcp_[a-z_]+_/, "");

      item.innerHTML = `
        <div class="parallel-task-header ${statusClass}">
          <span class="parallel-task-icon">${icon}</span>
          <span class="parallel-task-name">${escapeHtml(shortName)}</span>
          <span class="parallel-task-time">${elapsedStr}</span>
          <span class="parallel-task-status ${statusClass}">
            ${isRunning ? '<span class="task-spinner"></span>' : isError ? "✕" : "✓"}
          </span>
        </div>
        ${isRunning ? '<div class="parallel-task-progress"><div class="parallel-task-progress-bar running"></div></div>' : ""}
      `;

      item.addEventListener("click", () => {
        item.classList.toggle("expanded");
        let detail = item.querySelector(".parallel-task-detail");
        if (!detail) {
          detail = document.createElement("div");
          detail.className = "parallel-task-detail";
          const argsStr = typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args, null, 2);
          const resultStr = tc.result != null
            ? (typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2))
            : tTask("tasks.notAvailable", "—");
          detail.innerHTML = `
            <div class="task-detail-section">
              <label>${tTask("tasks.args", "參數")}</label>
              <pre>${escapeHtml(argsStr || tTask("tasks.notAvailable", "—"))}</pre>
            </div>
            <div class="task-detail-section">
              <label>${tTask("tasks.result", "結果")}</label>
              <pre>${escapeHtml(resultStr).slice(0, 500)}${resultStr.length > 500 ? "\n…" : ""}</pre>
            </div>
          `;
          item.appendChild(detail);
        }
      });

      list.appendChild(item);
    }

    for (const agent of subAgents) {
      const agentEl = document.createElement("div");
      agentEl.className = `parallel-task-item subagent ${agent.status}`;
      const elapsed = agent.startTime
        ? ((agent.endTime || Date.now()) - agent.startTime) / 1000
        : 0;
      agentEl.innerHTML = `
        <div class="parallel-task-header ${agent.status}">
          <span class="parallel-task-icon">🤖</span>
          <span class="parallel-task-name">${tTask("tasks.subAgentPrefix", "子代理：")}${escapeHtml(agent.name || agent.id)}</span>
          <span class="parallel-task-time">${elapsed.toFixed(1)}${tTask("tasks.secondsShort", "s")}</span>
          <span class="parallel-task-status ${agent.status}">
            ${agent.status === "running" ? '<span class="task-spinner"></span>' : agent.status === "error" ? "✕" : "✓"}
          </span>
        </div>
        ${agent.status === "running" ? '<div class="parallel-task-progress"><div class="parallel-task-progress-bar running"></div></div>' : ""}
      `;
      list.appendChild(agentEl);
    }

    renderTasksTimeline();
  }

  function renderTasksTimeline() {
    const chatState = root.chat?.getState?.() || {};
    const toolCalls = chatState.toolCalls || [];
    const subAgents = chatState.subAgents || [];
    const timeline = document.getElementById("tasks-timeline");
    if (!timeline || toolCalls.length === 0) return;

    const baseTime = taskStartTime || (toolCalls[0]?.startedAt || Date.now());

    const events = toolCalls.map((tc, i) => {
      const offset = tc.startedAt ? ((tc.startedAt - baseTime) / 1000).toFixed(1) : "0.0";
      const elapsed = tc.startedAt && tc.endedAt
        ? ((tc.endedAt - tc.startedAt) / 1000).toFixed(1)
        : tc.status === "running" ? "…" : "—";
      const icon = tc.status === "running" ? "🔄" : tc.status === "error" ? "❌" : "✅";
      return { offset, elapsed, icon, name: tc.name, status: tc.status, _idx: i };
    });

    for (const agent of subAgents) {
      const offset = agent.startTime ? ((agent.startTime - baseTime) / 1000).toFixed(1) : "0.0";
      const elapsed = agent.startTime && agent.endTime
        ? ((agent.endTime - agent.startTime) / 1000).toFixed(1)
        : agent.status === "running" ? "…" : "—";
      const icon = agent.status === "running" ? "🤖" : "✅";
      events.push({ offset, elapsed, icon, name: `${tTask("tasks.subAgentPrefix", "子代理：")}${agent.name || agent.id}`, status: agent.status });
    }

    timeline.innerHTML = events
      .map((e) => `
        <div class="timeline-event ${e.status}">
          <span class="timeline-time">${e.offset}${tTask("tasks.secondsShort", "s")}</span>
          <div class="timeline-dot ${e.status}"></div>
          <div class="timeline-content">
            <span class="timeline-icon">${e.icon}</span>
            <span class="timeline-name">${escapeHtml(e.name)}</span>
            <span class="timeline-duration">${e.elapsed}${tTask("tasks.secondsShort", "s")}</span>
          </div>
        </div>
      `).join("");
  }

  function bindEvents() {
    document.getElementById("btn-clear-tasks")?.addEventListener("click", () => {
      root.chat?.clearTaskActivity?.();
      stopTaskTimer();
      taskStartTime = null;
      const elapsed = document.getElementById("tasks-elapsed");
      if (elapsed) elapsed.textContent = `⏱ 0.0${tTask("tasks.secondsShort", "s")}`;
      renderTasksList();
      const timeline = document.getElementById("tasks-timeline");
      if (timeline) timeline.innerHTML = `<div class="empty-state"><span class="empty-icon">📊</span><p>${tTask("tasks.noEvents", "尚無事件")}</p></div>`;
    });
  }

  root.panels.tasks = {
    startTaskTimer,
    stopTaskTimer,
    getTaskElapsed,
    renderTasksList,
    renderTasksTimeline,
    bindEvents,
  };
})(window);
