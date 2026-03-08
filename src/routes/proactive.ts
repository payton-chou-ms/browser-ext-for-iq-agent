import type http from "node:http";
import type { ProactiveExecutionResponse, RouteTable, ProactiveRouteDeps } from "../shared/types.js";
import { Schemas, type ProactiveConfigInput } from "./schemas.js";

// ===== Scan-all throttling (A2) =====
// Prevent re-entry within SCAN_ALL_THROTTLE_MS (default 5 minutes)
const SCAN_ALL_THROTTLE_MS = 5 * 60 * 1000;
let lastScanAllTimestamp = 0;
const proactiveInFlightRequests = new Map<string, Promise<ProactiveExecutionResponse | Record<string, unknown>>>();

function normalizeScanSource(value: unknown): "cold-start" | "reconnect" | "alarm" | "manual" {
  if (value === "cold-start" || value === "reconnect" || value === "alarm") {
    return value;
  }
  return "manual";
}

function isTrustedProactiveOrigin(req: http.IncomingMessage): boolean {
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return true;

  return /^(?:chrome-extension|edge-extension|moz-extension):\/\//i.test(origin)
    || /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin);
}

function rejectUntrustedProactiveOrigin(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  jsonRes: ProactiveRouteDeps["jsonRes"],
): boolean {
  if (isTrustedProactiveOrigin(req)) return false;
  jsonRes(res, 403, {
    ok: false,
    error: "Proactive routes only accept extension or local trusted origins.",
  });
  return true;
}

function toPromptKey(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "__default__";
}

async function runDedupedProactiveRequest<T extends ProactiveExecutionResponse | Record<string, unknown>>(
  key: string,
  run: () => Promise<T>,
  log: ProactiveRouteDeps["log"],
): Promise<T> {
  const existing = proactiveInFlightRequests.get(key) as Promise<T> | undefined;
  if (existing) {
    log("PROACTIVE", `Reusing in-flight proactive request: ${key}`);
    return await existing;
  }

  const pending = run().finally(() => {
    if (proactiveInFlightRequests.get(key) === pending) {
      proactiveInFlightRequests.delete(key);
    }
  });

  proactiveInFlightRequests.set(key, pending);
  return await pending;
}

export function registerProactiveRoutes(routes: RouteTable, deps: ProactiveRouteDeps): void {
  const { jsonRes, readJsonBody, log, proactive } = deps;

  const getPromptOverride = (value: unknown): string => (typeof value === "string" ? value : "");

  routes["GET /api/proactive/config"] = async (_req, res) => {
    jsonRes(res, 200, { ok: true, config: proactive.getConfig() });
  };

  routes["POST /api/proactive/config"] = async (req, res) => {
    const body = await readJsonBody(req, res, {
      schema: Schemas.proactiveConfig,
      allowEmpty: true,
    }) as ProactiveConfigInput | null;
    if (!body) return;

    const current = proactive.getConfig();
    const nextPrompt =
      typeof body.workiqPrompt === "string" ? body.workiqPrompt : current.workiqPrompt;
    const nextModel =
      typeof body.model === "string" && body.model.trim() ? body.model.trim() : current.model;

    proactive.setConfig({ workiqPrompt: nextPrompt, model: nextModel });

    jsonRes(res, 200, { ok: true, config: proactive.getConfig() });
  };

  routes["POST /api/proactive/briefing"] = async (req, res) => {
    if (rejectUntrustedProactiveOrigin(req, res, jsonRes)) return;

    const body = await readJsonBody(req, res, { allowEmpty: true }) as { prompt?: unknown } | null;
    if (!body) return;
    log("PROACTIVE", "Generating daily briefing...");
    try {
      const promptOverride = getPromptOverride(body.prompt);
      const result = await runDedupedProactiveRequest(`briefing:${toPromptKey(promptOverride)}`, () => proactive.runBriefing(promptOverride), log);
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Briefing error:", (err as Error).message);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/proactive/deadlines"] = async (req, res) => {
    if (rejectUntrustedProactiveOrigin(req, res, jsonRes)) return;

    const body = await readJsonBody(req, res, { allowEmpty: true }) as { prompt?: unknown } | null;
    if (!body) return;
    log("PROACTIVE", "Scanning for deadlines...");
    try {
      const promptOverride = getPromptOverride(body.prompt);
      const result = await runDedupedProactiveRequest(`deadlines:${toPromptKey(promptOverride)}`, () => proactive.runDeadlines(promptOverride), log);
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Deadlines error:", (err as Error).message);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/proactive/ghosts"] = async (req, res) => {
    if (rejectUntrustedProactiveOrigin(req, res, jsonRes)) return;

    const body = await readJsonBody(req, res, { allowEmpty: true }) as { prompt?: unknown } | null;
    if (!body) return;
    log("PROACTIVE", "Detecting unreplied emails...");
    try {
      const promptOverride = getPromptOverride(body.prompt);
      const result = await runDedupedProactiveRequest(`ghosts:${toPromptKey(promptOverride)}`, () => proactive.runGhosts(promptOverride), log);
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Ghosts error:", (err as Error).message);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/proactive/meeting-prep"] = async (req, res) => {
    if (rejectUntrustedProactiveOrigin(req, res, jsonRes)) return;

    const body = await readJsonBody(req, res, { allowEmpty: true }) as { prompt?: unknown } | null;
    if (!body) return;
    log("PROACTIVE", "Preparing meeting context...");
    try {
      const promptOverride = getPromptOverride(body.prompt);
      const result = await runDedupedProactiveRequest(`meeting-prep:${toPromptKey(promptOverride)}`, () => proactive.runMeetingPrep(promptOverride), log);
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Meeting prep error:", (err as Error).message);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/proactive/scan-all"] = async (req, res) => {
    if (rejectUntrustedProactiveOrigin(req, res, jsonRes)) return;

    const body = await readJsonBody(req, res, { allowEmpty: true }) as { source?: unknown } | null;
    if (!body) return;

    const source = normalizeScanSource(body.source);
    const now = Date.now();
    const elapsed = now - lastScanAllTimestamp;

    // Throttle: skip if called too frequently for non-manual triggers.
    // Manual refresh from notification panel should always run immediately.
    if (source !== "manual" && elapsed < SCAN_ALL_THROTTLE_MS) {
      const retryAfterMs = SCAN_ALL_THROTTLE_MS - elapsed;
      const remainingSec = Math.ceil(retryAfterMs / 1000);
      log("PROACTIVE", `scan-all throttled — skip (${remainingSec}s remaining, source=${source})`);
      jsonRes(res, 200, {
        ok: true,
        throttled: true,
        source,
        retryAfterMs,
        scannedAt: new Date(lastScanAllTimestamp).toISOString(),
        results: {},
      });
      return;
    }

    lastScanAllTimestamp = now;
    log("PROACTIVE", `Running full proactive scan (parallel, source=${source})...`);

    const response = await runDedupedProactiveRequest("scan-all", async () => {
      const [briefing, deadlines, ghosts, meetingPrep] = await Promise.allSettled([
        proactive.runBriefing(),
        proactive.runDeadlines(),
        proactive.runGhosts(),
        proactive.runMeetingPrep(),
      ]);

      const unwrap = (
        result: PromiseSettledResult<ProactiveExecutionResponse>
      ) =>
        result.status === "fulfilled"
          ? result.value
          : { ok: false, error: result.reason?.message || "Unknown error" };

      return {
        ok: true,
        source,
        results: {
          briefing: unwrap(briefing),
          deadlines: unwrap(deadlines),
          ghosts: unwrap(ghosts),
          meetingPrep: unwrap(meetingPrep),
        },
        scannedAt: new Date().toISOString(),
      };
    }, log);

    jsonRes(res, 200, response);
  };
}
