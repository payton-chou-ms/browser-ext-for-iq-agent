import { Schemas } from "./schemas.js";

export function registerProactiveRoutes(routes, deps) {
  const {
    jsonRes,
    readJsonBody,
    log,
    proactive,
  } = deps;

  routes["GET /api/proactive/config"] = async (_req, res) => {
    jsonRes(res, 200, { ok: true, config: proactive.getConfig() });
  };

  routes["POST /api/proactive/config"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.proactiveConfig, allowEmpty: true });
    if (!body) return;

    const current = proactive.getConfig();
    const nextPrompt = typeof body.workiqPrompt === "string" ? body.workiqPrompt : current.workiqPrompt;
    const nextModel = typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : current.model;

    proactive.setConfig({ workiqPrompt: nextPrompt, model: nextModel });
    proactive.invalidateSession("config updated");

    jsonRes(res, 200, { ok: true, config: proactive.getConfig() });
  };

  routes["POST /api/proactive/briefing"] = async (_req, res) => {
    log("PROACTIVE", "Generating daily briefing...");
    try {
      const result = await proactive.runBriefing();
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Briefing error:", err.message);
      jsonRes(res, 500, { ok: false, error: err.message });
    }
  };

  routes["POST /api/proactive/deadlines"] = async (_req, res) => {
    log("PROACTIVE", "Scanning for deadlines...");
    try {
      const result = await proactive.runDeadlines();
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Deadlines error:", err.message);
      jsonRes(res, 500, { ok: false, error: err.message });
    }
  };

  routes["POST /api/proactive/ghosts"] = async (_req, res) => {
    log("PROACTIVE", "Detecting unreplied emails...");
    try {
      const result = await proactive.runGhosts();
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Ghosts error:", err.message);
      jsonRes(res, 500, { ok: false, error: err.message });
    }
  };

  routes["POST /api/proactive/meeting-prep"] = async (_req, res) => {
    log("PROACTIVE", "Preparing meeting context...");
    try {
      const result = await proactive.runMeetingPrep();
      jsonRes(res, 200, result);
    } catch (err) {
      log("ERROR", "Meeting prep error:", err.message);
      jsonRes(res, 500, { ok: false, error: err.message });
    }
  };

  routes["POST /api/proactive/scan-all"] = async (_req, res) => {
    log("PROACTIVE", "Running full proactive scan (parallel)...");

    // Run all scans in parallel for ~4x speedup
    const [briefing, deadlines, ghosts, meetingPrep] = await Promise.allSettled([
      proactive.runBriefing(),
      proactive.runDeadlines(),
      proactive.runGhosts(),
      proactive.runMeetingPrep(),
    ]);

    const unwrap = (result) =>
      result.status === "fulfilled"
        ? result.value
        : { ok: false, error: result.reason?.message || "Unknown error" };

    const results = {
      briefing: unwrap(briefing),
      deadlines: unwrap(deadlines),
      ghosts: unwrap(ghosts),
      meetingPrep: unwrap(meetingPrep),
    };

    jsonRes(res, 200, { ok: true, results, scannedAt: new Date().toISOString() });
  };
}
