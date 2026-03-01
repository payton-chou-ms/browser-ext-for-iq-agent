// ===== Copilot SDK REST Client =====
// Communicates with the SDK proxy (proxy.js) via REST API over HTTP.
// All Copilot SDK calls are handled server-side; this client is a thin HTTP wrapper.

const COPILOT_RPC = (() => {
  let _baseUrl = "http://127.0.0.1:8321";
  let _connected = false;

  function setBaseUrl(url) {
    _baseUrl = url.startsWith("http") ? url : `http://${url}`;
  }

  function getBaseUrl() { return _baseUrl; }
  function isConnected() { return _connected; }

  const MAX_LOG_CHARS = 2048;

  function redactSensitive(value) {
    try {
      if (value === null || typeof value !== "object") {
        return value;
      }
      const SENSITIVE_KEYS = new Set([
        "apikey",
        "api_key",
        "authorization",
        "auth",
        "password",
        "token",
        "secret",
      ]);
      const redactObject = (obj) => {
        if (obj === null || typeof obj !== "object") {
          return obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(redactObject);
        }
        const clone = {};
        for (const [k, v] of Object.entries(obj)) {
          if (SENSITIVE_KEYS.has(k.toLowerCase())) {
            clone[k] = "[REDACTED]";
          } else if (v && typeof v === "object") {
            clone[k] = redactObject(v);
          } else {
            clone[k] = v;
          }
        }
        return clone;
      };
      return redactObject(value);
    } catch {
      return value;
    }
  }

  function truncateForLog(value) {
    try {
      const serialized = typeof value === "string" ? value : JSON.stringify(value);
      if (!serialized) return value;
      if (serialized.length <= MAX_LOG_CHARS) return value;
      return `${serialized.slice(0, MAX_LOG_CHARS)}... [truncated ${serialized.length - MAX_LOG_CHARS} chars]`;
    } catch {
      return "[unserializable payload]";
    }
  }

  // ── Core REST call with timeout ──
  const DEFAULT_TIMEOUT_MS = 30000;

  async function apiCall(path, body = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const url = `${_baseUrl}${path}`;
    console.log(`[RPC] → POST ${path}`, truncateForLog(redactSensitive(body)));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[RPC] ← ${path} HTTP ${res.status}`, errText);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      console.log(`[RPC] ← ${path} OK:`, truncateForLog(json));
      _connected = true;

      if (json.ok === false && json.error) {
        throw new Error(json.error);
      }
      return json;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        console.error(`[RPC] ✗ ${path} timeout after ${timeoutMs}ms`);
        _connected = false;
        throw new Error(`Request timeout after ${timeoutMs}ms`, { cause: err });
      }
      console.error(`[RPC] ✗ ${path} error:`, err.message);
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        _connected = false;
      }
      throw err;
    }
  }

  // ── Streaming via SSE (POST /api/session/send) ──
  // Returns { stream (async generator), cancel }
  function sendMessageStream(sessionId, prompt, attachments) {
    const controller = new AbortController();

    async function* stream() {
      try {
        const res = await fetch(`${_baseUrl}/api/session/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ sessionId, prompt, attachments }),
          signal: controller.signal,
        });

        if (!res.ok) {
          let errDetail = "";
          try {
            const errBody = await res.text();
            errDetail = `: ${errBody.slice(0, 200)}`;
          } catch { /* ignore */ }
          throw new Error(`HTTP ${res.status}${errDetail}`);
        }
        _connected = true;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") return;
              try {
                yield JSON.parse(data);
              } catch {
                // skip malformed SSE data
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          _connected = false;
          throw err;
        }
      }
    }

    return {
      stream: stream(),
      cancel: () => controller.abort(),
    };
  }

  // ── High-level API ──

  async function ping() {
    const res = await apiCall("/api/ping");
    return res.result;
  }

  async function listModels() {
    const res = await apiCall("/api/models");
    return res.models || [];
  }

  async function listTools(model) {
    const body = model ? { model } : {};
    const res = await apiCall("/api/tools", body);
    return res.tools || [];
  }

  // Skill execution can take a while (e.g., image generation, external API calls)
  const SKILL_EXECUTE_TIMEOUT_MS = 180000; // 3 minutes

  async function executeSkill(skillName, command = "status", payload = {}) {
    return await apiCall("/api/skills/execute", { skillName, command, payload }, SKILL_EXECUTE_TIMEOUT_MS);
  }

  async function listLocalSkills() {
    const res = await apiCall("/api/skills/local", {});
    return res.skills || [];
  }

  // WorkIQ queries can be slow due to M365 data access
  const WORKIQ_TIMEOUT_MS = 180000; // 3 minutes

  async function workiqQuery(query, sessionId) {
    return await apiCall("/api/workiq/query", { query, sessionId }, WORKIQ_TIMEOUT_MS);
  }

  async function getQuota() {
    const res = await apiCall("/api/quota");
    return res.quota || {};
  }

  async function switchModel(sessionId, modelId) {
    return await apiCall("/api/session/switch-model", { sessionId, modelId });
  }

  async function createSession(config = {}) {
    return await apiCall("/api/session/create", config);
  }

  async function resumeSession(sessionId) {
    return await apiCall("/api/session/resume", { sessionId });
  }

  function sendMessage(sessionId, prompt, attachments) {
    return sendMessageStream(sessionId, prompt, attachments);
  }

  // Longer timeout for sendAndWait since tool executions can take a while (e.g., image generation)
  const SEND_AND_WAIT_TIMEOUT_MS = 180000; // 3 minutes

  async function sendAndWait(sessionId, prompt, attachments) {
    return await apiCall("/api/session/sendAndWait", { sessionId, prompt, attachments }, SEND_AND_WAIT_TIMEOUT_MS);
  }

  async function listSessions() {
    const res = await apiCall("/api/session/list");
    return res.sessions || [];
  }

  async function deleteSession(sessionId) {
    return await apiCall("/api/session/delete", { sessionId });
  }

  async function destroySession(sessionId) {
    return await apiCall("/api/session/destroy", { sessionId });
  }

  async function getAuthStatus() {
    try {
      await ping();
      return { authenticated: true };
    } catch {
      return { authenticated: false };
    }
  }

  async function getContext() {
    const res = await apiCall("/api/context");
    return res.context || {};
  }

  async function getMcpConfig() {
    try {
      const res = await fetch(`${_baseUrl}/api/mcp/config`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { ok: false, error: err.message, config: { mcpServers: {} } };
    }
  }

  async function setMcpConfig(config) {
    return await apiCall("/api/mcp/config", { config });
  }

  async function setFoundryConfig(endpoint, authMethod, apiKey) {
    return await apiCall("/api/foundry/config", { endpoint, authMethod, apiKey });
  }

  async function clearFoundryKey() {
    return await apiCall("/api/foundry/config", { clearApiKey: true });
  }

  async function testFoundryConnection() {
    return await getFoundryStatus();
  }

  async function getFoundryStatus() {
    try {
      const res = await fetch(`${_baseUrl}/api/foundry/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { ok: false, configured: false, endpoint: null, error: err.message };
    }
  }

  // ── Connection check (uses /health, falls back to /api/ping) ──
  async function checkConnection() {
    try {
      const res = await fetch(`${_baseUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      _connected = json.status === "ok";
      return { connected: _connected, sdkState: json.sdkState };
    } catch {
      // fallback: try ping
      try {
        await ping();
        _connected = true;
        return { connected: true };
      } catch (err) {
        _connected = false;
        return { connected: false, error: err.message };
      }
    }
  }

  // ── Proactive Agent APIs ──
  async function proactiveBriefing(prompt = "") {
    return await apiCall("/api/proactive/briefing", { prompt });
  }

  async function proactiveDeadlines(prompt = "") {
    return await apiCall("/api/proactive/deadlines", { prompt });
  }

  async function proactiveGhosts(prompt = "") {
    return await apiCall("/api/proactive/ghosts", { prompt });
  }

  async function proactiveMeetingPrep(prompt = "") {
    return await apiCall("/api/proactive/meeting-prep", { prompt });
  }

  async function proactiveScanAll(source = "manual") {
    return await apiCall("/api/proactive/scan-all", { source });
  }

  async function getProactiveConfig() {
    try {
      const res = await fetch(`${_baseUrl}/api/proactive/config`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { ok: false, config: { workiqPrompt: "" }, error: err.message };
    }
  }

  async function setProactiveConfig(workiqPrompt) {
    return await apiCall("/api/proactive/config", { workiqPrompt: workiqPrompt || "" });
  }

  return {
    setBaseUrl,
    getBaseUrl,
    isConnected,
    apiCall,
    ping,
    listModels,
    listTools,
    listLocalSkills,
    executeSkill,
    workiqQuery,
    getQuota,
    switchModel,
    createSession,
    resumeSession,
    sendMessage,
    sendAndWait,
    listSessions,
    deleteSession,
    destroySession,
    getAuthStatus,
    getContext,
    getMcpConfig,
    setMcpConfig,
    setFoundryConfig,
    clearFoundryKey,
    testFoundryConnection,
    getFoundryStatus,
    checkConnection,
    proactiveBriefing,
    proactiveDeadlines,
    proactiveGhosts,
    proactiveMeetingPrep,
    proactiveScanAll,
    getProactiveConfig,
    setProactiveConfig,
  };
})();

// Export for use in background.js (service worker)
if (typeof globalThis !== "undefined") {
  globalThis.COPILOT_RPC = COPILOT_RPC;
}
