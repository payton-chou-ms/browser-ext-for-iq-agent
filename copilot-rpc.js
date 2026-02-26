// ===== Copilot CLI JSON-RPC Client =====
// Communicates with `copilot --headless --port <port>` via JSON-RPC over HTTP

const COPILOT_RPC = (() => {
  let _baseUrl = "http://127.0.0.1:8321";
  let _connected = false;
  let _requestId = 0;

  function setBaseUrl(url) {
    _baseUrl = url.startsWith("http") ? url : `http://${url}`;
  }

  function getBaseUrl() { return _baseUrl; }
  function isConnected() { return _connected; }

  // ── Core JSON-RPC call ──
  async function rpcCall(method, params = {}) {
    const id = ++_requestId;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });

    try {
      const res = await fetch(`${_baseUrl}/jsonrpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const json = await res.json();
      _connected = true;

      if (json.error) {
        throw new Error(`RPC Error [${json.error.code}]: ${json.error.message}`);
      }
      return json.result;
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        _connected = false;
      }
      throw err;
    }
  }

  // ── Streaming RPC call (SSE) ──
  // Returns an object with { stream, cancel } where stream is an async generator
  function rpcStream(method, params = {}) {
    const id = ++_requestId;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    let controller = new AbortController();

    async function* stream() {
      try {
        const res = await fetch(`${_baseUrl}/jsonrpc/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body,
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
                // skip malformed data
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
    return await rpcCall("ping", { message: "iq-copilot" });
  }

  async function initialize() {
    return await rpcCall("initialize", {
      clientInfo: { name: "iq-copilot-extension", version: "3.0.0" },
    });
  }

  async function createSession(config = {}) {
    return await rpcCall("session/create", {
      model: config.model || "gpt-4.1",
      systemMessage: config.systemMessage,
      customAgents: config.customAgents,
      mcpServers: config.mcpServers,
      tools: config.tools,
      ...config,
    });
  }

  async function resumeSession(sessionId, config = {}) {
    return await rpcCall("session/resume", { sessionId, ...config });
  }

  function sendMessage(sessionId, prompt) {
    return rpcStream("session/send", { sessionId, prompt });
  }

  async function sendAndWait(sessionId, prompt) {
    return await rpcCall("session/sendAndWait", { sessionId, prompt });
  }

  async function listSessions() {
    return await rpcCall("session/list", {});
  }

  async function deleteSession(sessionId) {
    return await rpcCall("session/delete", { sessionId });
  }

  async function destroySession(sessionId) {
    return await rpcCall("session/destroy", { sessionId });
  }

  async function listModels() {
    return await rpcCall("models/list", {});
  }

  async function getAuthStatus() {
    try {
      const result = await ping();
      return { authenticated: true, ...result };
    } catch {
      return { authenticated: false };
    }
  }

  // ── Connection check ──
  async function checkConnection() {
    try {
      await ping();
      _connected = true;
      return { connected: true };
    } catch (err) {
      _connected = false;
      return { connected: false, error: err.message };
    }
  }

  return {
    setBaseUrl,
    getBaseUrl,
    isConnected,
    rpcCall,
    rpcStream,
    ping,
    initialize,
    createSession,
    resumeSession,
    sendMessage,
    sendAndWait,
    listSessions,
    deleteSession,
    destroySession,
    listModels,
    getAuthStatus,
    checkConnection,
  };
})();

// Export for use in background.js (service worker)
if (typeof globalThis !== "undefined") {
  globalThis.COPILOT_RPC = COPILOT_RPC;
}
