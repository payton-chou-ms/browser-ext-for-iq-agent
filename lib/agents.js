(function initIQAgents(global) {
  const root = global.IQ || (global.IQ = {});
  const utils = root.utils || {};
  const i18n = root.i18n || {};
  const connection = root.connection || {};
  const localizeRuntimeMessage = i18n.localizeRuntimeMessage || ((m) => m);

  const BUILTIN_AGENTS = [
    { id: "general", name: "General Assistant", description: "通用型助手，適合大部分任務", systemPrompt: "" },
    { id: "coder", name: "Code Expert", description: "程式碼分析、除錯、最佳化", systemPrompt: "Focus on software engineering tasks. Prioritize code quality, debugging rigor, and concrete implementation details." },
    { id: "writer", name: "Writer", description: "文章撰寫、摘要、翻譯", systemPrompt: "Focus on writing quality, clarity, translation accuracy, and concise summaries tailored to user intent." },
    { id: "researcher", name: "Researcher", description: "深度研究、資料分析", systemPrompt: "Focus on research workflows: gather context, compare evidence, and present structured conclusions with clear assumptions." },
  ];

  let selectedAgentId = "general";

  function getSelectedAgentId() { return selectedAgentId; }

  function getAllAgents() {
    return [...BUILTIN_AGENTS];
  }

  function findAgentById(agentId) {
    return getAllAgents().find((agent) => agent.id === agentId) || null;
  }

  function renderAgentPanel() {
    const escapeHtml = utils.escapeHtml || ((s) => s);
    const listEl = document.getElementById("agent-list");
    if (!listEl) return;

    const agents = getAllAgents();
    if (!findAgentById(selectedAgentId)) selectedAgentId = "general";

    listEl.innerHTML = agents.map((agent) => {
      const isSelected = agent.id === selectedAgentId;
      const badgeText = connection.isConnected?.() ? localizeRuntimeMessage("預設") : "local";
      return `
        <label class="agent-option${isSelected ? " selected" : ""}" data-agent-id="${escapeHtml(agent.id)}">
          <input type="radio" name="agent" value="${escapeHtml(agent.id)}" ${isSelected ? "checked" : ""}>
          <div class="agent-info">
            <span class="agent-name">${escapeHtml(agent.name)}</span>
            <span class="agent-desc">${escapeHtml(localizeRuntimeMessage(agent.description || ""))}</span>
          </div>
          <span class="agent-badge">${badgeText}</span>
        </label>
      `;
    }).join("");
  }

  async function resetSessionForAgentChange() {
    const chat = root.chat || {};
    const sendToBackground = utils.sendToBackground;
    const state = chat.getState?.() || {};

    if (!connection.isConnected?.() || !state.currentSessionId) return;
    try {
      await sendToBackground({ type: "DELETE_SESSION", sessionId: state.currentSessionId });
      utils.invalidateCache?.("sessions");
    } catch { /* ignore */ }
    chat.setCurrentSessionId?.(null);
    chat.setSessionData?.(null);
  }

  async function selectAgent(agentId, options = {}) {
    const selected = findAgentById(agentId);
    if (!selected) return;

    selectedAgentId = selected.id;
    chrome.storage.local.set({ selectedAgentId });
    renderAgentPanel();

    if (options.showToast !== false) {
      utils.showToast?.(`${localizeRuntimeMessage("已切換至 ")}${selected.name}`);
    }

    await resetSessionForAgentChange();
  }

  function loadAgentConfig() {
    chrome.storage.local.get(["selectedAgentId"], (data) => {
      if (typeof data.selectedAgentId === "string" && data.selectedAgentId.trim()) {
        selectedAgentId = data.selectedAgentId.trim();
      }
      if (!findAgentById(selectedAgentId)) selectedAgentId = "general";
      renderAgentPanel();
    });
  }

  function bindEvents() {
    document.getElementById("agent-list")?.addEventListener("change", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.name !== "agent") return;
      await selectAgent(target.value);
    });
  }

  root.agents = {
    BUILTIN_AGENTS,
    getSelectedAgentId,
    getAllAgents,
    findAgentById,
    renderAgentPanel,
    selectAgent,
    loadAgentConfig,
    bindEvents,
  };
})(window);
