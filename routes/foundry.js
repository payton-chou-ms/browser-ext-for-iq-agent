import { Schemas } from "./schemas.js";

export function registerFoundryRoutes(routes, deps) {
  const {
    jsonRes,
    readJsonBody,
    readBody,
    log,
    getFoundryState,
    setFoundryState,
    getFoundrySnapshot,
  } = deps;

  routes["POST /api/foundry/config"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.foundryConfig, allowEmpty: true });
    if (!body) return;

    const current = getFoundryState();
    const next = {
      endpoint: typeof body.endpoint === "string" ? body.endpoint.trim() : current.endpoint,
      apiKey: typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : current.apiKey,
    };

    if (body.clearApiKey === true) {
      next.apiKey = "";
    }

    setFoundryState(next);
    jsonRes(res, 200, {
      ok: true,
      ...getFoundrySnapshot(),
    });
  };

  routes["POST /api/foundry/chat"] = async (req, res) => {
    const { endpoint, apiKey } = getFoundryState();
    if (!endpoint || !apiKey) {
      jsonRes(res, 400, { ok: false, error: "Foundry not configured. Set FOUNDRY_ENDPOINT and FOUNDRY_API_KEY env vars." });
      return;
    }

    const body = await readBody(req);
    const url = `${endpoint.replace(/\/$/, "")}/chat/completions?api-version=2024-12-01-preview`;
    log("FOUNDRY", `→ POST ${url.split("?")[0]}`);

    try {
      const upstream = await globalThis.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body,
      });

      const result = await upstream.json();
      if (!upstream.ok) {
        log("FOUNDRY", `← HTTP ${upstream.status}:`, JSON.stringify(result));
        jsonRes(res, upstream.status, { ok: false, error: result?.error?.message || `HTTP ${upstream.status}` });
        return;
      }

      log("FOUNDRY", `← OK (model: ${result?.model || "unknown"})`);
      jsonRes(res, 200, { ok: true, ...result });
    } catch (err) {
      log("FOUNDRY", "Error:", err.message);
      jsonRes(res, 502, { ok: false, error: err.message });
    }
  };

  routes["GET /api/foundry/status"] = async (_req, res) => {
    jsonRes(res, 200, {
      ok: true,
      ...getFoundrySnapshot(),
    });
  };
}
