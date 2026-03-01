(function initIQPanelContext(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const i18n = root.i18n || {};

  let cliContext = null;

  function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
  function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
  function isConnected() { return root.connection?.isConnected?.() || false; }

  function mergeContextToolsWithLocalSkills(ctx, localSkills) {
    const mergedCtx = { ...(ctx || {}) };
    const baseTools = Array.isArray(mergedCtx.tools) ? mergedCtx.tools : [];
    const skills = Array.isArray(localSkills) ? localSkills : [];

    const mergedTools = [];
    const seen = new Set();

    for (const tool of baseTools) {
      const name = String(tool?.name || "").trim();
      const key = name.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      mergedTools.push({
        name,
        description: tool?.description,
        source: tool?.source || "cli",
      });
    }

    for (const skill of skills) {
      const name = String(skill?.name || "").trim();
      const key = name.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      mergedTools.push({
        name,
        description: skill?.description,
        source: "local-skill",
      });
    }

    mergedCtx.tools = mergedTools;
    return mergedCtx;
  }

  async function fetchCliContext() {
    if (!isConnected()) {
      renderCliContextDisconnected();
      return;
    }
    try {
      const ctx = await utils.cachedSendToBackground?.("context", { type: "GET_CONTEXT" });
      utils.debugLog?.("CTX", "GET_CONTEXT response:", ctx);
      if (ctx && !ctx.error) {
        let mergedCtx = ctx;
        try {
          const localSkills = await utils.sendToBackground?.({ type: "LIST_LOCAL_SKILLS" });
          mergedCtx = mergeContextToolsWithLocalSkills(ctx, localSkills);
        } catch (err) {
          utils.debugLog?.("WARN", "LIST_LOCAL_SKILLS fallback failed:", err?.message || String(err));
        }

        cliContext = mergedCtx;
        renderCliContext(mergedCtx);
        if (typeof AchievementEngine !== "undefined") {
          AchievementEngine.track("context_viewed");
        }
      } else {
        renderCliContextError(ctx?.error || "Unknown error");
      }
    } catch (err) {
      utils.debugLog?.("ERR", "fetchCliContext error:", err.message);
      renderCliContextError(err.message);
    }
  }

  function renderCliContextDisconnected() {
    const el = (id) => document.getElementById(id);
    const msg = localizeRuntimeMessage("未連接");
    if (el("ctx-sdk-state")) el("ctx-sdk-state").textContent = msg;
    if (el("ctx-version")) el("ctx-version").textContent = "—";
    if (el("ctx-protocol")) el("ctx-protocol").textContent = "—";
    if (el("ctx-auth-login")) el("ctx-auth-login").textContent = "—";
    if (el("ctx-auth-type")) el("ctx-auth-type").textContent = "—";
    if (el("ctx-auth-host")) el("ctx-auth-host").textContent = "—";
    if (el("ctx-models-count")) el("ctx-models-count").textContent = "0";
    if (el("ctx-models-list")) el("ctx-models-list").innerHTML = `<p class="text-muted">${msg}</p>`;
    if (el("ctx-tools-count")) el("ctx-tools-count").textContent = "0";
    if (el("ctx-tools-list")) el("ctx-tools-list").innerHTML = `<p class="text-muted">${msg}</p>`;
    if (el("ctx-quota")) el("ctx-quota").innerHTML = `<p class="text-muted">${msg}</p>`;
  }

  function renderCliContextError(errMsg) {
    const el = (id) => document.getElementById(id);
    if (el("ctx-sdk-state")) el("ctx-sdk-state").textContent = localizeRuntimeMessage("錯誤");
    if (el("ctx-models-list")) el("ctx-models-list").innerHTML = `<p class="text-muted">${localizeRuntimeMessage("錯誤: ")}${escapeHtml(errMsg)}</p>`;
  }

  function renderCliContext(ctx) {
    const el = (id) => document.getElementById(id);
    // P2-7: Use updateText for minimal updates
    const setText = (id, text) => utils.updateText?.(el(id), text) ?? (el(id) && (el(id).textContent = text));
    const setHTML = (id, html) => utils.updateHTML?.(el(id), html) ?? (el(id) && (el(id).innerHTML = html));

    setText("ctx-sdk-state", ctx.sdkState || "connected");
    setText("ctx-version", ctx.status?.version || "—");
    setText("ctx-protocol", ctx.status?.protocolVersion != null ? `v${ctx.status.protocolVersion}` : "—");

    setText("ctx-auth-login", ctx.auth?.login || (ctx.auth?.isAuthenticated ? localizeRuntimeMessage("已認證") : localizeRuntimeMessage("未認證")));
    setText("ctx-auth-type", ctx.auth?.authType || "—");
    setText("ctx-auth-host", ctx.auth?.host || "—");

    const models = ctx.models || [];
    setText("ctx-models-count", String(models.length));
    setHTML("ctx-models-list", models.length === 0
        ? `<p class="text-muted">${localizeRuntimeMessage("無可用模型")}</p>`
        : models.map((m) => `<div class="meta-item"><span class="meta-val">${escapeHtml(m.name || m.id)}</span></div>`).join(""));

    const tools = ctx.tools || [];
    setText("ctx-tools-count", String(tools.length));
    setHTML("ctx-tools-list", tools.length === 0
        ? `<p class="text-muted">${localizeRuntimeMessage("無可用工具")}</p>`
        : tools.map((t) => {
            const isLocalSkill = t.source === "local-skill";
            const icon = isLocalSkill ? "🧩 " : "";
            const rawDesc = String(t.description || "").replace(/\s+/g, " ").trim();
            const shortDesc = rawDesc.length > 56 ? `${rawDesc.slice(0, 56)}…` : rawDesc;
            const desc = rawDesc ? ` title="${escapeHtml(rawDesc)}"` : "";
            return `<div class="meta-item meta-item--two-col"${desc}><span class="meta-key meta-col-name">${icon}${escapeHtml(t.name)}</span><span class="meta-val meta-col-desc">${escapeHtml(shortDesc || "—")}</span></div>`;
          }).join(""));

    const quota = ctx.quota || {};
    const keys = Object.keys(quota);
    setHTML("ctx-quota", keys.length === 0
        ? `<p class="text-muted">${localizeRuntimeMessage("無配額資訊")}</p>`
        : keys.map((k) => {
            const q = quota[k];
            const used = q.usedRequests ?? 0;
            const total = q.entitlementRequests ?? 0;
            const pct = q.remainingPercentage != null ? `${q.remainingPercentage}%` : "—";
            return `<div class="meta-item"><span class="meta-key">${escapeHtml(k)}</span><span class="meta-val">${used}/${total} (${localizeRuntimeMessage("剩餘 ")}${pct})</span></div>`;
          }).join(""));

    renderSessionContext();

    const barText = document.getElementById("context-bar-text");
    if (barText) {
      const login = ctx.auth?.login || "";
      const ver = ctx.status?.version || "";
      utils.updateText?.(barText, login ? `${login} · v${ver}` : `Copilot CLI v${ver}`);
    }
  }

  function renderSessionContext() {
    let card = document.getElementById("session-context-card");
    const scrollEl = document.querySelector("#panel-context .panel-scroll");
    if (!scrollEl) return;

    const sessionData = root.chat?.getState?.()?.sessionData;
    if (!isConnected() || !sessionData) {
      if (card) card.remove();
      return;
    }

    if (!card) {
      card = document.createElement("div");
      card.id = "session-context-card";
      card.className = "glass-card";
      scrollEl.appendChild(card);
    }

    const sd = sessionData;
    const rows = [
      ["cwd", sd.cwd || "—"],
      ["Git Root", sd.gitRoot || "—"],
      ["Repository", sd.repository || "—"],
      ["Branch", sd.branch || "—"],
    ];

    card.innerHTML = `
      <div class="card-header"><span class="card-icon">🖥️</span><h3>Copilot CLI</h3></div>
      ${rows.map(([k, v]) => `<div class="info-group"><label>${escapeHtml(k)}</label><p class="info-value">${escapeHtml(v)}</p></div>`).join("")}
    `;

    if (sd.tools && Array.isArray(sd.tools) && sd.tools.length > 0) {
      const toolsHtml = sd.tools.map((t) => {
        const name = typeof t === "string" ? t : t.name || String(t);
        return `<span class="agent-badge">${escapeHtml(name)}</span>`;
      }).join("");
      card.innerHTML += `<div class="info-group"><label>Available Tools</label><div class="tools-wrap">${toolsHtml}</div></div>`;
    }
  }

  function getCliContext() { return cliContext; }

  function bindEvents() {
    document.getElementById("ctx-refresh")?.addEventListener("click", () => {
      utils.invalidateCache?.("context");
      utils.invalidateCache?.("local-skills");
      fetchCliContext();
      utils.showToast?.(localizeRuntimeMessage("Context 重新載入中..."));
    });
  }

  root.panels.context = {
    fetchCliContext,
    renderCliContext,
    renderSessionContext,
    getCliContext,
    bindEvents,
  };
})(window);
