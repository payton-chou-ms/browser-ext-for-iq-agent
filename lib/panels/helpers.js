(function initIQPanelHelpers(global) {
  const root = global.IQ || (global.IQ = {});

  function toHtmlAttr(attrs) {
    const entries = Object.entries(attrs || {});
    if (entries.length === 0) return "";
    return entries
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ` ${key}="${String(value).replace(/\"/g, '&quot;')}"`)
      .join("");
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str - Raw string.
   * @returns {string} Safe HTML string.
   */
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
  }

  /**
   * Render a standard action button for insight panels.
   */
  function renderActionButton(options) {
    const {
      label,
      action,
      className = "",
      attrs = {},
      disabled = false,
    } = options || {};

    const finalAttrs = {
      ...attrs,
      "data-action": action,
    };

    return `<button class="insight-action-btn ${className}"${toHtmlAttr(finalAttrs)} ${disabled ? "disabled" : ""}>${label || ""}</button>`;
  }

  /**
   * Render a progress bar with label.
   * @param {object} opts
   * @param {number} opts.percent - 0–100 fill percentage.
   * @param {string} [opts.color] - CSS color for bar fill.
   * @param {string} [opts.label] - Left label text.
   * @param {string} [opts.sublabel] - Right label text.
   * @param {number} [opts.height] - Bar height in px.
   * @returns {string} HTML string.
   */
  function renderProgressBar({ percent = 0, color = "var(--accent-start)", label = "", sublabel = "", height = 6 } = {}) {
    const clamped = Math.max(0, Math.min(100, percent));
    return `<div class="iq-progress-wrap">
      <div class="iq-progress-bar" style="height:${height}px">
        <div class="iq-progress-fill" style="width:${clamped}%;background:${escapeHtml(color)}"></div>
      </div>
      ${(label || sublabel) ? `<div class="iq-progress-labels"><span>${escapeHtml(label)}</span><span>${escapeHtml(sublabel)}</span></div>` : ""}
    </div>`;
  }

  /**
   * Render a quota usage bar (used in Quota panel).
   * @param {object} opts
   * @param {string} opts.type - Quota type name.
   * @param {number} opts.used - Used requests.
   * @param {number} opts.total - Total requests.
   * @param {number} opts.remaining - Remaining percentage (0–100).
   * @param {number} [opts.overage] - Overage count.
   * @param {string} [opts.resetDate] - Reset date string.
   * @returns {string} HTML string.
   */
  function renderQuotaBar({ type = "", used = 0, total = 0, remaining = 100, overage = 0, resetDate = "—" } = {}) {
    const barColor = remaining > 50 ? "var(--success)" : remaining > 20 ? "#f59e0b" : "var(--error)";
    return `<div class="iq-quota-item">
      <div class="iq-quota-header">
        <span class="iq-quota-type">${escapeHtml(type.replace(/_/g, " "))}</span>
        <span class="iq-quota-count">${used} / ${total}</span>
      </div>
      ${renderProgressBar({ percent: Math.min(100 - remaining, 100), color: barColor })}
      <div class="iq-progress-labels">
        <span>剩餘 ${remaining.toFixed(0)}%</span>
        <span>重置: ${escapeHtml(resetDate)}</span>
      </div>
      ${overage > 0 ? `<span class="iq-quota-overage">超額: ${overage}</span>` : ""}
    </div>`;
  }

  /**
   * Render a model list item.
   * @param {object} opts
   * @param {string} opts.modelId - Model identifier.
   * @param {string} opts.label - Display label.
   * @param {boolean} opts.active - Whether currently selected.
   * @returns {string} HTML string.
   */
  function renderModelItem({ modelId = "", label = "", active = false } = {}) {
    return `<div class="model-item${active ? " active" : ""}" data-model="${escapeHtml(modelId)}">
      <span>${escapeHtml(label)}</span>
      ${active ? '<span class="model-active-badge">✦ 使用中</span>' : ""}
    </div>`;
  }

  root.panels = root.panels || {};
  root.panels.helpers = {
    escapeHtml,
    renderActionButton,
    renderProgressBar,
    renderQuotaBar,
    renderModelItem,
    toHtmlAttr,
  };
})(window);
