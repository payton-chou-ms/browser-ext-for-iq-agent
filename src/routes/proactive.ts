import type { RouteTable, ProactiveRouteDeps } from "../shared/types.js";
import { Schemas, type ProactiveConfigInput } from "./schemas.js";

// ===== Scan-all throttling (A2) =====
// Prevent re-entry within SCAN_ALL_THROTTLE_MS (default 5 minutes)
const SCAN_ALL_THROTTLE_MS = 5 * 60 * 1000;
let lastScanAllTimestamp = 0;

function normalizeScanSource(value: unknown): "cold-start" | "reconnect" | "alarm" | "manual" {
  if (value === "cold-start" || value === "reconnect" || value === "alarm") {
    return value;
  }
  return "manual";
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
    proactive.invalidateSession("config updated");

    jsonRes(res, 200, { ok: true, config: proactive.getConfig() });
  };

  routes["POST /api/proactive/briefing"] = async (req, res) => {
    const body = await readJsonBody(req, res, { allowEmpty: true }) as { prompt?: unknown } | null;
    if (!body) return;
    log("PROACTIVE", "Generating daily briefing...");
    try {
      const result = await proactive.runBriefing(getPromptOverride(body.prompt));
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Briefing error:", (err as Error).message);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/proactive/deadlines"] = async (req, res) => {
    const body = await readJsonBody(req, res, { allowEmpty: true }) as { prompt?: unknown } | null;
    if (!body) return;
    log("PROACTIVE", "Scanning for deadlines...");
    try {
      const result = await proactive.runDeadlines(getPromptOverride(body.prompt));
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Deadlines error:", (err as Error).message);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/proactive/ghosts"] = async (req, res) => {
    const body = await readJsonBody(req, res, { allowEmpty: true }) as { prompt?: unknown } | null;
    if (!body) return;
    log("PROACTIVE", "Detecting unreplied emails...");
    try {
      const result = await proactive.runGhosts(getPromptOverride(body.prompt));
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Ghosts error:", (err as Error).message);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/proactive/meeting-prep"] = async (req, res) => {
    const body = await readJsonBody(req, res, { allowEmpty: true }) as { prompt?: unknown } | null;
    if (!body) return;
    log("PROACTIVE", "Preparing meeting context...");
    try {
      const result = await proactive.runMeetingPrep(getPromptOverride(body.prompt));
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Meeting prep error:", (err as Error).message);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/proactive/scan-all"] = async (req, res) => {
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

    // Run all scans in parallel for ~4x speedup
    const [briefing, deadlines, ghosts, meetingPrep] = await Promise.allSettled([
      proactive.runBriefing(),
      proactive.runDeadlines(),
      proactive.runGhosts(),
      proactive.runMeetingPrep(),
    ]);

    const unwrap = (
      result: PromiseSettledResult<{ ok: boolean; data?: Record<string, unknown>; raw?: string; error?: string }>
    ) =>
      result.status === "fulfilled"
        ? result.value
        : { ok: false, error: result.reason?.message || "Unknown error" };

    const results = {
      briefing: unwrap(briefing),
      deadlines: unwrap(deadlines),
      ghosts: unwrap(ghosts),
      meetingPrep: unwrap(meetingPrep),
    };

    jsonRes(res, 200, { ok: true, source, results, scannedAt: new Date().toISOString() });
  };
}
