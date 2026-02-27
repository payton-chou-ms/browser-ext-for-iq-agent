(function initIQPanelSkills(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const i18n = root.i18n || {};

  let cachedSkills = [];
  let customSkills = [];

  function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
  function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
  function isConnected() { return root.connection?.isConnected?.() || false; }

  function toCustomToolShape(skill) {
    return {
      name: skill.name,
      description: skill.description,
      namespacedName: `custom/${skill.name}`,
      isCustom: true,
    };
  }

  function getAllSkillsForRender(cliTools = []) {
    const customTools = customSkills.map(toCustomToolShape);
    return [...cliTools, ...customTools];
  }

  function loadCustomSkillsFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["customSkills"], (data) => {
        const list = Array.isArray(data.customSkills) ? data.customSkills : [];
        customSkills = list
          .map((item) => ({
            name: String(item.name || "").trim(),
            description: String(item.description || "").trim(),
          }))
          .filter((item) => item.name.length > 0);
        resolve(customSkills);
      });
    });
  }

  function saveCustomSkillsToStorage() {
    chrome.storage.local.set({ customSkills });
  }

  function syncSkillsSourceLabel() {
    const label = document.getElementById("skills-source-label");
    if (label) label.textContent = `CLI ${cachedSkills.length} + ${localizeRuntimeMessage("自訂 ")}${customSkills.length} items`;
  }

  function setSkillCreateFormVisible(visible) {
    const form = document.getElementById("skill-create-list");
    if (form) form.style.display = visible ? "flex" : "none";
  }

  function clearSkillCreateForm() {
    const nameInput = document.getElementById("skill-name-input");
    const descInput = document.getElementById("skill-description-input");
    if (nameInput) nameInput.value = "";
    if (descInput) descInput.value = "";
  }

  function addCustomSkill(nameInput, descriptionInput = "") {
    const name = String(nameInput || "").trim();
    if (!name) {
      utils.showToast?.(localizeRuntimeMessage("Skill 名稱不能為空"));
      return false;
    }
    const duplicated = customSkills.some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (duplicated) {
      utils.showToast?.(localizeRuntimeMessage("已有同名自訂 skill"));
      return false;
    }
    customSkills = [...customSkills, { name, description: String(descriptionInput || "").trim() }];
    saveCustomSkillsToStorage();
    const merged = getAllSkillsForRender(cachedSkills);
    renderSkillsGrid(merged);
    syncSkillsSourceLabel();
    utils.showToast?.(`${localizeRuntimeMessage("已新增 skill: ")}${name}`);
    return true;
  }

  function deleteCustomSkill(nameInput) {
    const name = String(nameInput || "").trim();
    if (!name) return;
    const exists = customSkills.some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!exists) return;
    customSkills = customSkills.filter((item) => item.name.toLowerCase() !== name.toLowerCase());
    saveCustomSkillsToStorage();
    const merged = getAllSkillsForRender(cachedSkills);
    renderSkillsGrid(merged);
    syncSkillsSourceLabel();
    utils.showToast?.(`${localizeRuntimeMessage("已刪除 skill: ")}${name}`);
  }

  function submitSkillCreateForm() {
    const nameInput = document.getElementById("skill-name-input");
    const descInput = document.getElementById("skill-description-input");
    const name = nameInput?.value || "";
    const description = descInput?.value || "";
    const created = addCustomSkill(name, description);
    if (!created) return;
    clearSkillCreateForm();
    setSkillCreateFormVisible(false);
  }

  async function loadSkillsFromCli() {
    const grid = document.getElementById("skills-grid");
    const label = document.getElementById("skills-source-label");
    const chatState = root.chat?.getState?.() || {};
    const currentModel = chatState.currentModel;

    if (!isConnected()) {
      const merged = getAllSkillsForRender([]);
      if (merged.length > 0) {
        renderSkillsGrid(merged);
        if (label) label.textContent = `${localizeRuntimeMessage("離線 · 自訂 ")}${customSkills.length} items`;
      } else {
        if (grid) grid.innerHTML = `<div class="empty-state" id="skills-empty"><span class="empty-icon">⏳</span><p>${localizeRuntimeMessage("連接 Copilot CLI 後自動載入 Skills")}</p></div>`;
        if (label) label.textContent = localizeRuntimeMessage("未連接");
      }
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
      cachedSkills = [];
      const merged = getAllSkillsForRender([]);
      if (merged.length > 0) {
        renderSkillsGrid(merged);
      } else if (grid) {
        grid.innerHTML = `<div class="empty-state"><span class="empty-icon">🔧</span><p>${localizeRuntimeMessage("CLI 未回傳任何 Skills")}</p></div>`;
      }
      if (label) label.textContent = `CLI 0 + ${localizeRuntimeMessage("自訂 ")}${customSkills.length} items`;
      return;
    }

    cachedSkills = tools;
    const merged = getAllSkillsForRender(tools);
    renderSkillsGrid(merged);
    if (label) label.textContent = `CLI ${tools.length} + ${localizeRuntimeMessage("自訂 ")}${customSkills.length} items`;
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
    const deleteButton = tool.isCustom
      ? `<button class="skill-delete-btn" data-skill-name="${escapeHtml(name)}" title="${localizeRuntimeMessage("刪除自訂 Skill")}">${localizeRuntimeMessage("刪除")}</button>`
      : "";

    return `<div class="skill-card" title="${escapeHtml(desc)}" data-tool-name="${escapeHtml(name)}">
      <div class="skill-line">
        <span class="skill-name">${escapeHtml(name)}</span>
        <span class="skill-sep">:</span>
        <span class="skill-desc-inline">${escapeHtml(lineDesc)}</span>
      </div>
      ${deleteButton}
    </div>`;
  }

  function bindEvents() {
    document.getElementById("btn-refresh-skills")?.addEventListener("click", () => {
      loadSkillsFromCli();
      utils.showToast?.(localizeRuntimeMessage("Skills 重新載入中..."));
    });

    document.getElementById("btn-add-skill")?.addEventListener("click", () => {
      setSkillCreateFormVisible(true);
      document.getElementById("skill-name-input")?.focus();
    });

    document.getElementById("btn-skill-create-save")?.addEventListener("click", () => {
      submitSkillCreateForm();
    });

    document.getElementById("btn-skill-create-cancel")?.addEventListener("click", () => {
      clearSkillCreateForm();
      setSkillCreateFormVisible(false);
    });

    document.getElementById("skill-name-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        submitSkillCreateForm();
      }
    });

    document.getElementById("skills-grid")?.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest(".skill-delete-btn");
      if (!button) return;
      e.preventDefault();
      e.stopPropagation();
      const skillName = button.getAttribute("data-skill-name") || "";
      if (!skillName) return;
      const confirmed = window.confirm(`${localizeRuntimeMessage("確定要刪除自訂 Skill「")}${skillName}${localizeRuntimeMessage("」嗎？")}`);
      if (!confirmed) return;
      deleteCustomSkill(skillName);
    });
  }

  root.panels.skills = {
    loadSkillsFromCli,
    renderSkillsFromData,
    loadCustomSkillsFromStorage,
    bindEvents,
  };
})(window);
