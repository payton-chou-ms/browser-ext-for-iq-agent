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

  // ── Core REST call ──
  async function apiCall(path, body = {}) {
    const url = `${_baseUrl}${path}`;
    console.log(`[RPC] → POST ${path}`, body);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[RPC] ← ${path} HTTP ${res.status}`, errText);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      console.log(`[RPC] ← ${path} OK:`, json);
      _connected = true;

      if (json.ok === false && json.error) {
        throw new Error(json.error);
      }
      return json;
    } catch (err) {
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

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

  async function sendAndWait(sessionId, prompt, attachments) {
    return await apiCall("/api/session/sendAndWait", { sessionId, prompt, attachments });
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

  return {
    setBaseUrl,
    getBaseUrl,
    isConnected,
    apiCall,
    ping,
    listModels,
    listTools,
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
    checkConnection,
  };
})();

// Export for use in background.js (service worker)
if (typeof globalThis !== "undefined") {
  globalThis.COPILOT_RPC = COPILOT_RPC;
}
