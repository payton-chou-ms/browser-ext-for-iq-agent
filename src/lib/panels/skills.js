(function initIQPanelSkills(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const i18n = root.i18n || {};

  function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
  function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
  function isConnected() { return root.connection?.isConnected?.() || false; }

  async function loadSkillsFromCli(forceFresh = false) {
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
      const tools = forceFresh
        ? await utils.sendToBackground?.({ type: "LIST_TOOLS", model: currentModel })
        : await utils.cachedSendToBackground?.("tools", { type: "LIST_TOOLS", model: currentModel });
      const localSkills = forceFresh
        ? await utils.sendToBackground?.({ type: "LIST_LOCAL_SKILLS" })
        : await utils.cachedSendToBackground?.("local-skills", { type: "LIST_LOCAL_SKILLS" });
      const mergedSkills = mergeSkills(tools, localSkills);
      utils.debugLog?.(
        "SKILL",
        `Loaded ${Array.isArray(tools) ? tools.length : 0} tools from CLI + ${Array.isArray(localSkills) ? localSkills.length : 0} local skills`
      );
      renderSkillsFromData(mergedSkills, {
        cliCount: Array.isArray(tools) ? tools.length : 0,
        localCount: Array.isArray(localSkills) ? localSkills.length : 0,
      });
    } catch (err) {
      utils.debugLog?.("ERR", "loadSkillsFromCli error:", err.message);
      if (grid) grid.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>${localizeRuntimeMessage("載入失敗")}: ${escapeHtml(err.message)}</p></div>`;
      if (label) label.textContent = localizeRuntimeMessage("載入失敗");
    }
  }

  function mergeSkills(cliTools, localSkills) {
    const merged = [];
    const seen = new Set();

    if (Array.isArray(cliTools)) {
      for (const tool of cliTools) {
        const key = String(tool?.name || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...tool, source: tool?.source || "cli" });
      }
    }

    if (Array.isArray(localSkills)) {
      for (const skill of localSkills) {
        const name = String(skill?.name || "").trim();
        const key = name.toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push({
          name,
          description: String(skill?.description || "Local repo skill"),
          source: "local-skill",
          namespacedName: skill?.path ? `local/${skill.path}` : `local/${name}`,
        });
      }
    }

    return merged;
  }

  function renderSkillsFromData(tools, stats = null) {
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
    if (label) {
      if (stats && typeof stats.cliCount === "number" && typeof stats.localCount === "number") {
        label.textContent = `CLI ${stats.cliCount} + Local ${stats.localCount} = ${tools.length} items`;
      } else {
        label.textContent = `${tools.length} items`;
      }
    }
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
    const sourceRaw = String(tool.source || "cli").toLowerCase();
    const sourceLabel = sourceRaw === "local-skill" ? "Local" : "CLI";
    const sourceClass = sourceRaw === "local-skill" ? "source-local" : "source-cli";

    return `<div class="skill-card" title="${escapeHtml(desc)}" data-tool-name="${escapeHtml(name)}">
      <div class="skill-line">
        <span class="skill-name">${escapeHtml(name)}</span>
        <span class="skill-sep">:</span>
        <span class="skill-desc-inline">${escapeHtml(lineDesc)}</span>
      </div>
      <span class="skill-source-badge ${sourceClass}">${escapeHtml(sourceLabel)}</span>
    </div>`;
  }

  function bindEvents() {
    document.getElementById("btn-refresh-skills")?.addEventListener("click", () => {
      loadSkillsFromCli(true);
      utils.showToast?.(localizeRuntimeMessage("Skills 重新載入中..."));
    });

    const grid = document.getElementById("skills-grid");
    grid?.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const card = target.closest(".skill-card");
      if (!(card instanceof HTMLElement)) return;

      const skillName = String(card.dataset.toolName || "").trim();
      if (!skillName) return;

      if (!skillName.toLowerCase().includes("foundry")) {
        utils.showToast?.(localizeRuntimeMessage("MVP 目前僅支援 foundry skill"));
        return;
      }

      const chat = root.chat || {};
      chat.addUserMessage?.(`/skill run ${skillName}`);
      chat.showTyping?.();

      try {
        const response = await utils.sendToBackground?.({
          type: "EXECUTE_SKILL",
          skillName,
          command: "status",
          payload: { source: "skills-panel", mode: "mock" },
        });

        chat.removeTyping?.();

        if (!response?.ok) {
          chat.addBotMessage?.(`⚠ ${localizeRuntimeMessage("Skill 執行失敗")}: ${escapeHtml(response?.error || "Unknown error")}`);
          return;
        }

        const result = response.result || {};
        const summary = result.summary || localizeRuntimeMessage("Skill 執行完成");
        const output = result.output || {};
        const outputText = typeof output === "string" ? output : JSON.stringify(output, null, 2);

        chat.addBotMessage?.([
          `✅ **${escapeHtml(skillName)}**`,
          "",
          escapeHtml(summary),
          "",
          "```json",
          escapeHtml(outputText),
          "```",
        ].join("\n"));
      } catch (err) {
        chat.removeTyping?.();
        chat.addBotMessage?.(`⚠ ${localizeRuntimeMessage("Skill 執行失敗")}: ${escapeHtml(err?.message || String(err))}`);
      }
    });
  }

  root.panels.skills = {
    loadSkillsFromCli,
    renderSkillsFromData,
    bindEvents,
  };
})(window);

