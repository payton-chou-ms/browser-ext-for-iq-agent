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
  let customAgents = [];

  function getSelectedAgentId() { return selectedAgentId; }

  function getAllAgents() {
    return [...BUILTIN_AGENTS, ...customAgents];
  }

  function isBuiltInAgent(agentId) {
    return BUILTIN_AGENTS.some((agent) => agent.id === agentId);
  }

  function findAgentById(agentId) {
    return getAllAgents().find((agent) => agent.id === agentId) || null;
  }

  function normalizeAgentId(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `agent-${Date.now()}`;
  }

  function renderAgentPanel() {
    const escapeHtml = utils.escapeHtml || ((s) => s);
    const listEl = document.getElementById("agent-list");
    if (!listEl) return;

    const agents = getAllAgents();
    if (!findAgentById(selectedAgentId)) selectedAgentId = "general";

    listEl.innerHTML = agents.map((agent) => {
      const isSelected = agent.id === selectedAgentId;
      const badgeText = connection.isConnected?.() ? (isBuiltInAgent(agent.id) ? localizeRuntimeMessage("預設") : localizeRuntimeMessage("自訂")) : "local";
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

    const deleteBtn = document.getElementById("btn-agent-delete");
    if (deleteBtn) {
      const canDelete = !isBuiltInAgent(selectedAgentId);
      deleteBtn.disabled = !canDelete;
      deleteBtn.title = canDelete ? localizeRuntimeMessage("刪除此自訂 Agent") : localizeRuntimeMessage("預設 Agent 不可刪除");
    }
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
    chrome.storage.local.get(["customAgents", "selectedAgentId"], (data) => {
      const storedAgents = Array.isArray(data.customAgents) ? data.customAgents : [];
      customAgents = storedAgents
        .map((agent) => ({
          id: String(agent.id || "").trim(),
          name: String(agent.name || "").trim(),
          description: String(agent.description || "").trim(),
          systemPrompt: String(agent.systemPrompt || ""),
        }))
        .filter((agent) => agent.id && agent.name && !isBuiltInAgent(agent.id));

      if (typeof data.selectedAgentId === "string" && data.selectedAgentId.trim()) {
        selectedAgentId = data.selectedAgentId.trim();
      }
      if (!findAgentById(selectedAgentId)) selectedAgentId = "general";
      renderAgentPanel();
    });
  }

  async function addCustomAgent() {
    const nameInput = window.prompt(localizeRuntimeMessage("輸入 Agent 名稱"));
    if (nameInput === null) return;
    const name = nameInput.trim();
    if (!name) {
      utils.showToast?.(localizeRuntimeMessage("Agent 名稱不能為空"));
      return;
    }

    const descriptionInput = window.prompt(localizeRuntimeMessage("輸入 Agent 描述"), localizeRuntimeMessage("自訂 Agent")) || "";
    const systemPromptInput = window.prompt(localizeRuntimeMessage("輸入 Agent 系統提示詞"), "") || "";

    const baseId = normalizeAgentId(name);
    let nextId = baseId;
    let suffix = 2;
    while (findAgentById(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const newAgent = {
      id: nextId,
      name,
      description: descriptionInput.trim() || localizeRuntimeMessage("自訂 Agent"),
      systemPrompt: systemPromptInput.trim(),
    };

    customAgents = [...customAgents, newAgent];
    chrome.storage.local.set({ customAgents, selectedAgentId: newAgent.id });
    await selectAgent(newAgent.id, { showToast: false });
    utils.showToast?.(`${localizeRuntimeMessage("已新增 Agent: ")}${newAgent.name}`);
  }

  async function deleteSelectedAgent() {
    const selected = findAgentById(selectedAgentId);
    if (!selected || isBuiltInAgent(selected.id)) {
      utils.showToast?.(localizeRuntimeMessage("預設 Agent 不能刪除"));
      return;
    }

    const confirmed = window.confirm(`${localizeRuntimeMessage("確定要刪除 Agent「")}${selected.name}${localizeRuntimeMessage("」嗎？")}`);
    if (!confirmed) return;

    customAgents = customAgents.filter((agent) => agent.id !== selected.id);
    selectedAgentId = "general";
    chrome.storage.local.set({ customAgents, selectedAgentId });
    renderAgentPanel();
    await resetSessionForAgentChange();
    utils.showToast?.(`${localizeRuntimeMessage("已刪除 Agent: ")}${selected.name}`);
  }

  function bindEvents() {
    document.getElementById("agent-list")?.addEventListener("change", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.name !== "agent") return;
      await selectAgent(target.value);
    });

    document.getElementById("btn-agent-add")?.addEventListener("click", async () => {
      await addCustomAgent();
    });

    document.getElementById("btn-agent-delete")?.addEventListener("click", async () => {
      await deleteSelectedAgent();
    });
  }

  root.agents = {
    BUILTIN_AGENTS,
    getSelectedAgentId,
    getAllAgents,
    isBuiltInAgent,
    findAgentById,
    renderAgentPanel,
    selectAgent,
    loadAgentConfig,
    addCustomAgent,
    deleteSelectedAgent,
    bindEvents,
  };
})(window);
