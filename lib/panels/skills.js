(function initIQPanelSkills(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const i18n = root.i18n || {};

  function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
  function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
  function isConnected() { return root.connection?.isConnected?.() || false; }

  async function loadSkillsFromCli() {
    const grid = document.getElementById("skills-grid");
    const label = document.getElementById("skills-source-label");
    const chatState = root.chat?.getState?.() || {};
    const currentModel = chatState.currentModel;

    if (!isConnected()) {
      if (grid) grid.innerHTML = `<div class="empty-state" id="skills-empty"><span class="empty-icon">⏳</span><p>${localizeRuntimeMessage("連接 Copilot CLI 後自動載入 Skills")}</p></div>`;
      if (label) label.textContent = localizeRuntimeMessage("未連接");
      return;
    }

    if (label) label.textContent = localizeRuntimeMessage("正在載入...");

    try {
      const tools = await utils.cachedSendToBackground?.("tools", { type: "LIST_TOOLS", model: currentModel });
      utils.debugLog?.("SKILL", `Loaded ${Array.isArray(tools) ? tools.length : 0} tools from CLI`);
      renderSkillsFromData(tools);
    } catch (err) {
      utils.debugLog?.("ERR", "loadSkillsFromCli error:", err.message);
      if (grid) grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>${localizeRuntimeMessage("載入失敗")}: ${escapeHtml(err.message)}</p></div>`;
      if (label) label.textContent = localizeRuntimeMessage("載入失敗");
    }
  }

  function renderSkillsFromData(tools) {
    const grid = document.getElementById("skills-grid");
    const label = document.getElementById("skills-source-label");

    if (!Array.isArray(tools) || tools.length === 0) {
      if (grid) {
        grid.innerHTML = `<div class="empty-state"><span class="empty-icon">🔧</span><p>${localizeRuntimeMessage("CLI 未回傳任何 Skills")}</p></div>`;
      }
      if (label) label.textContent = `CLI 0 items`;
      return;
    }

    renderSkillsGrid(tools);
    if (label) label.textContent = `CLI ${tools.length} items`;
  }

  function renderSkillsGrid(tools) {
    const grid = document.getElementById("skills-grid");
    if (!grid) return;

    const grouped = {};
    const ungrouped = [];

    for (const tool of tools) {
      const ns = tool.namespacedName;
      if (ns && ns.includes("/")) {
        const prefix = ns.split("/")[0];
        if (!grouped[prefix]) grouped[prefix] = [];
        grouped[prefix].push(tool);
      } else {
        ungrouped.push(tool);
      }
    }

    let html = "";
    for (const tool of ungrouped) {
      html += renderSkillCard(tool);
    }
    for (const [ns, nsTools] of Object.entries(grouped)) {
      html += `<div class="skill-group">🔌 ${escapeHtml(ns)} (${nsTools.length})</div>`;
      for (const tool of nsTools) {
        html += renderSkillCard(tool);
      }
    }
    grid.innerHTML = html;
  }

  function renderSkillCard(tool) {
    const name = tool.name || "unknown";
    const desc = tool.description || "";
    const lineDesc = desc.trim() || "—";

    return `<div class="skill-card" title="${escapeHtml(desc)}" data-tool-name="${escapeHtml(name)}">
      <div class="skill-line">
        <span class="skill-name">${escapeHtml(name)}</span>
        <span class="skill-sep">:</span>
        <span class="skill-desc-inline">${escapeHtml(lineDesc)}</span>
      </div>
    </div>`;
  }

  function bindEvents() {
    document.getElementById("btn-refresh-skills")?.addEventListener("click", () => {
      loadSkillsFromCli();
      utils.showToast?.(localizeRuntimeMessage("Skills 重新載入中..."));
    });
  }

  root.panels.skills = {
    loadSkillsFromCli,
    renderSkillsFromData,
    bindEvents,
  };
})(window);

