(function initIQPanelMcp(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const utils = root.utils || {};
  const i18n = root.i18n || {};

  let mcpConfigData = null;

  function escapeHtml(s) { return (utils.escapeHtml || ((x) => x))(s); }
  function localizeRuntimeMessage(m) { return (i18n.localizeRuntimeMessage || ((x) => x))(m); }
  function isConnected() { return root.connection?.isConnected?.() || false; }

  function initMcpPanel() {
    const refreshBtn = document.getElementById("btn-refresh-mcp");
    const saveBtn = document.getElementById("btn-save-mcp");
    const formatBtn = document.getElementById("btn-format-mcp");
    if (refreshBtn) refreshBtn.addEventListener("click", () => loadMcpConfig());
    if (saveBtn) saveBtn.addEventListener("click", () => saveMcpConfig());
    if (formatBtn) formatBtn.addEventListener("click", () => formatMcpConfigEditor());
    loadMcpConfig();
  }

  async function loadMcpConfig() {
    const listEl = document.getElementById("mcp-server-list");
    const sourceEl = document.getElementById("mcp-source-label");
    if (!listEl) return;

    listEl.innerHTML = `<div class="mcp-loading"><span class="task-spinner"></span> ${localizeRuntimeMessage("載入中…")}</div>`;

    try {
      const res = await utils.sendToBackground?.({ type: "GET_MCP_CONFIG" });
      utils.debugLog?.("MCP", "getMcpConfig response:", res);

      if (res && res.ok && res.config) {
        mcpConfigData = res.config;
        const source = res.source || "~/.copilot/mcp-config.json";
        if (sourceEl) sourceEl.textContent = `${localizeRuntimeMessage("來源:")} ${source.replace(/^\/Users\/[^/]+/, "~")}`;
        const editorEl = document.getElementById("mcp-config-editor");
        if (editorEl) editorEl.value = JSON.stringify(mcpConfigData, null, 2);
        renderMcpServers();
      } else {
        listEl.innerHTML = `<div class="mcp-empty">${localizeRuntimeMessage("無法載入 MCP 設定")}</div>`;
        if (sourceEl) sourceEl.textContent = localizeRuntimeMessage(res?.error || "載入失敗");
      }
    } catch (err) {
      utils.debugLog?.("ERR", "loadMcpConfig error:", err.message);
      listEl.innerHTML = `<div class="mcp-empty">${localizeRuntimeMessage("讀取失敗: ")}${escapeHtml(err.message)}</div>`;
    }
  }

  function formatMcpConfigEditor() {
    const editorEl = document.getElementById("mcp-config-editor");
    if (!editorEl) return;
    try {
      const parsed = JSON.parse(editorEl.value || "{}");
      editorEl.value = JSON.stringify(parsed, null, 2);
      utils.showToast?.(localizeRuntimeMessage("已格式化 JSON"));
    } catch (err) {
      utils.showToast?.(localizeRuntimeMessage("JSON 格式錯誤: ") + err.message);
    }
  }

  async function saveMcpConfig() {
    const editorEl = document.getElementById("mcp-config-editor");
    if (!editorEl) return;

    let parsed;
    try {
      parsed = JSON.parse(editorEl.value || "{}");
    } catch (err) {
      utils.showToast?.(localizeRuntimeMessage("JSON 格式錯誤: ") + err.message);
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      utils.showToast?.(localizeRuntimeMessage("設定必須是 JSON 物件"));
      return;
    }
    if (!parsed.mcpServers || typeof parsed.mcpServers !== "object" || Array.isArray(parsed.mcpServers)) {
      utils.showToast?.(localizeRuntimeMessage("必須包含 mcpServers 物件"));
      return;
    }

    try {
      const res = await utils.sendToBackground?.({ type: "SET_MCP_CONFIG", config: parsed });
      if (res && res.ok) {
        mcpConfigData = parsed;
        const sourceEl = document.getElementById("mcp-source-label");
        const source = res.source || "~/.copilot/mcp-config.json";
        if (sourceEl) sourceEl.textContent = `${localizeRuntimeMessage("來源:")} ${String(source).replace(/^\/Users\/[^/]+/, "~")}`;
        renderMcpServers();
        utils.showToast?.(localizeRuntimeMessage("MCP 設定已儲存"));
      } else {
        utils.showToast?.(localizeRuntimeMessage("儲存失敗: ") + localizeRuntimeMessage(res?.error || "未知錯誤"));
      }
    } catch (err) {
      utils.showToast?.(localizeRuntimeMessage("儲存失敗: ") + err.message);
    }
  }

  function getMcpServerIcon(name, config) {
    const n = name.toLowerCase();
    if (n.includes("playwright")) return "🎭";
    if (n.includes("github")) return "🐙";
    if (n.includes("azure")) return "☁️";
    if (n.includes("context7") || n.includes("upstash")) return "📚";
    if (n.includes("microsoft") || n.includes("docs")) return "📖";
    if (n.includes("foundry")) return "🤖";
    if (config?.type === "http") return "🌐";
    return "⚡";
  }

  function getMcpServerUrl(config) {
    if (config?.url) return config.url;
    if (config?.command && config?.args) {
      const pkg = config.args.find((a) => a.startsWith("@") || (!a.startsWith("-") && a !== "server" && a !== "start"));
      if (pkg) return `${config.command} ${pkg}`;
      return `${config.command} ${config.args.join(" ")}`;
    }
    if (config?.command) return config.command;
    return "";
  }

  function renderMcpServers() {
    const listEl = document.getElementById("mcp-server-list");
    if (!listEl || !mcpConfigData) return;

    const servers = mcpConfigData.mcpServers || {};
    const entries = Object.entries(servers);

    if (entries.length === 0) {
      listEl.innerHTML = `<div class="mcp-empty">${localizeRuntimeMessage("尚無 MCP 伺服器設定")}</div>`;
      return;
    }

    const items = entries.map(([name, config]) => {
      const icon = getMcpServerIcon(name, config);
      const url = getMcpServerUrl(config);
      const type = config?.type || "local";
      const typeBadge = type === "http"
        ? '<span class="mcp-badge mcp-badge-http">HTTP</span>'
        : '<span class="mcp-badge mcp-badge-local">Local</span>';

      const toolsCount = Array.isArray(config?.tools)
        ? (config.tools.includes("*") ? "all" : config.tools.length)
        : "—";

      const hasEnv = config?.env && Object.keys(config.env).length > 0;
      const envKeys = hasEnv ? Object.keys(config.env) : [];

      return `
        <div class="mcp-item" data-mcp-name="${escapeHtml(name)}">
          <div class="mcp-item-icon">${icon}</div>
          <div class="mcp-info">
            <span class="mcp-name">${escapeHtml(name)}</span>
            <span class="mcp-url">${escapeHtml(url)}</span>
          </div>
          <div class="mcp-meta">
            ${typeBadge}
            <span class="mcp-tools-count" title="Tools: ${toolsCount}">🔧 ${toolsCount}</span>
          </div>
        </div>
        <div class="mcp-detail" id="mcp-detail-${escapeHtml(name)}">
          <div class="mcp-detail-row"><span class="mcp-detail-label">Type</span><span>${type}</span></div>
          ${config?.command ? `<div class="mcp-detail-row"><span class="mcp-detail-label">Command</span><code>${escapeHtml(config.command)} ${escapeHtml((config.args || []).join(" "))}</code></div>` : ""}
          ${config?.url ? `<div class="mcp-detail-row"><span class="mcp-detail-label">URL</span><code>${escapeHtml(config.url)}</code></div>` : ""}
          ${hasEnv ? `<div class="mcp-detail-row"><span class="mcp-detail-label">Env</span><span>${envKeys.map((k) => `<code>${escapeHtml(k)}</code>`).join(", ")}</span></div>` : ""}
        </div>`;
    });

    listEl.innerHTML = items.join("");

    listEl.querySelectorAll(".mcp-item").forEach((el) => {
      el.addEventListener("click", () => {
        const name = el.dataset.mcpName;
        const detail = document.getElementById(`mcp-detail-${name}`);
        if (detail) {
          detail.classList.toggle("open");
          el.classList.toggle("expanded", detail.classList.contains("open"));
        }
      });
    });
  }

  function renderSessionMcpServers() {
    let card = document.getElementById("session-mcp-card");
    const scrollEl = document.querySelector("#panel-mcp .panel-scroll");
    if (!scrollEl) return;

    const sessionData = root.chat?.getState?.()?.sessionData;
    if (!isConnected() || !sessionData?.mcpServers) {
      if (card) card.remove();
      return;
    }

    if (!card) {
      card = document.createElement("div");
      card.id = "session-mcp-card";
      card.className = "glass-card";
      scrollEl.appendChild(card);
    }

    const servers = sessionData.mcpServers;
    const items = (Array.isArray(servers) ? servers : Object.entries(servers)).map((s) => {
      const name = Array.isArray(s) ? s[0] : (s.name || s.id || "MCP Server");
      const url = Array.isArray(s) ? (s[1]?.url || "") : (s.url || "");
      return `<div class="mcp-item"><div class="mcp-item-icon">🔗</div><div class="mcp-info"><span class="mcp-name">${escapeHtml(String(name))}</span>${url ? `<span class="mcp-url">${escapeHtml(String(url))}</span>` : ""}</div><span class="mcp-badge mcp-badge-local">CLI</span></div>`;
    });

    card.innerHTML = `
      <div class="card-header"><span class="card-icon">🔗</span><h3>Session MCP Servers</h3></div>
      <div class="mcp-list">${items.join("")}</div>
    `;
  }

  root.panels.mcp = {
    initMcpPanel,
    loadMcpConfig,
    renderMcpServers,
    renderSessionMcpServers,
  };
})(window);
