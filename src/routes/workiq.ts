import type http from "node:http";
import type { RouteTable, WorkiqRouteDeps } from "../shared/types.js";
import { Schemas, type WorkiqQueryInput } from "./schemas.js";
import { createWorkIqExecutionMeta, withWorkIqExecutionMeta } from "../lib/workiq-execution.js";
import { runWorkIqCliPrompt, WORKIQ_CLI_TIMEOUT_MS, WORKIQ_SKILL_COMMAND } from "../lib/workiq-cli.js";
import { WORKIQ_STATUS_CACHE_TTL_MS, WORKIQ_STATUS_UNAVAILABLE_CACHE_TTL_MS } from "../shared/runtime-constants.js";

const WORKIQ_TOOL_UNAVAILABLE_RE = /(?:workiq-ask_work_iq\s+is\s+not\s+available(?:\s+in\s+this\s+session)?|work\s*iq(?:\s+tool)?\s+is\s+not\s+available(?:\s+in\s+this\s+session)?|workiq\s+skill\s+is\s+no\s+longer\s+available|no\s+["'`]?workiq["'`]?\s+skill\s+is\s+registered|workiq\s+skill\s+is\s+not\s+(?:registered|listed|available)|available\s+skills?\s+(?:for\s+this\s+session|are|include)\s*:?|not\s+listed\s+among\s+available\s+skills|current\s+skill\s+registry|temporarily\s+loaded\s+earlier|re-?enabled|enable\/provide\s+the\s+work\s*iq\s+tool|won['’]t\s+fabricate\s+m365\s+search\s+results|tool\s+isn['’]t\s+available\s+in\s+this\s+session|work\s*iq\s+技能目前不可用於此會話|workiq\s+skill\s+工具目前無法使用|未在此\s*session\s*的可用技能清單中|可用的技能清單中沒有|可用的技能(?:清單)?(?:中)?沒有\s*["'`]?workiq["'`]?|可用的技能包括)/i;
const WORKIQ_PROBE_PROMPT = `${WORKIQ_SKILL_COMMAND} availability probe only. Do not query, summarize, or reveal any user data. Reply with exactly WORKIQ_AVAILABLE if the Work IQ skill is available in this session. If it is unavailable, reply with WORKIQ_UNAVAILABLE: followed by a short reason.`;
const WORKIQ_PROBE_AVAILABLE_RE = /\bWORKIQ_AVAILABLE\b/i;

type WorkIqExecutionResult = {
  content: string;
  meta: ReturnType<typeof createWorkIqExecutionMeta>;
};

type CachedWorkIqProbe = {
  expiresAt: number;
  probe: WorkIqProbeResult;
};

let cachedWorkIqProbe: CachedWorkIqProbe | null = null;

export function resetWorkIqStatusCacheForTests(): void {
  cachedWorkIqProbe = null;
}

export function isWorkIqToolUnavailable(content: string): boolean {
  return WORKIQ_TOOL_UNAVAILABLE_RE.test(content);
}

function toWorkIqExecutionResult(content: string, toolUsed: string): WorkIqExecutionResult {
  const unavailable = isWorkIqToolUnavailable(content) || /WORKIQ_UNAVAILABLE\s*:/i.test(content);
  return {
    content,
    meta: createWorkIqExecutionMeta({
      toolUsed,
      unavailable,
    }),
  };
}

function getWorkIqProbeTtlMs(probe: WorkIqProbeResult): number {
  return probe.available ? WORKIQ_STATUS_CACHE_TTL_MS : WORKIQ_STATUS_UNAVAILABLE_CACHE_TTL_MS;
}

function isTrustedWorkIqOrigin(req: http.IncomingMessage): boolean {
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return true;

  return /^(?:chrome-extension|edge-extension|moz-extension):\/\//i.test(origin)
    || /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin);
}

function rejectUntrustedWorkIqOrigin(req: http.IncomingMessage, res: http.ServerResponse, jsonRes: WorkiqRouteDeps["jsonRes"]): boolean {
  if (isTrustedWorkIqOrigin(req)) return false;
  jsonRes(res, 403, {
    ok: false,
    error: "Work IQ routes only accept extension or local trusted origins.",
  });
  return true;
}

async function runWorkIqViaCliPrompt(prompt: string, deps: WorkiqRouteDeps): Promise<string> {
  return await runWorkIqCliPrompt({
    prompt,
    execFile: deps.execFile,
    timeoutMs: WORKIQ_CLI_TIMEOUT_MS,
  });
}

type WorkIqProbeResult = {
  available: boolean;
  route: string;
  content: string;
  reason?: string;
  ambiguous?: boolean;
};

async function probeWorkIqAvailability(deps: WorkiqRouteDeps): Promise<WorkIqProbeResult> {
  try {
    const content = await runWorkIqViaCliPrompt(WORKIQ_PROBE_PROMPT, deps);
    const unavailable = isWorkIqToolUnavailable(content) || /WORKIQ_UNAVAILABLE\s*:/i.test(content);
    const explicitlyAvailable = WORKIQ_PROBE_AVAILABLE_RE.test(content);
    return {
      available: explicitlyAvailable && !unavailable,
      route: `${WORKIQ_SKILL_COMMAND} via copilot -p`,
      content,
      ...(unavailable
        ? { reason: content.trim() || "Work IQ CLI fallback reported unavailable during live probe." }
        : explicitlyAvailable
          ? {}
          : {
            reason: "CLI fallback probe did not return explicit WORKIQ_AVAILABLE marker.",
            ambiguous: true,
          }),
    };
  } catch (err) {
    return {
      available: false,
      route: `${WORKIQ_SKILL_COMMAND} via copilot -p`,
      content: "",
      reason: `CLI fallback probe failed: ${(err as Error).message}`,
    };
  }
}

async function getCachedWorkIqProbe(deps: WorkiqRouteDeps, forceRefresh = false): Promise<WorkIqProbeResult> {
  if (!forceRefresh && cachedWorkIqProbe && cachedWorkIqProbe.expiresAt > Date.now()) {
    return cachedWorkIqProbe.probe;
  }

  const probe = await probeWorkIqAvailability(deps);
  cachedWorkIqProbe = {
    probe,
    expiresAt: Date.now() + getWorkIqProbeTtlMs(probe),
  };
  return probe;
}

export function registerWorkiqRoutes(routes: RouteTable, deps: WorkiqRouteDeps): void {
  const { jsonRes, readJsonBody, log } = deps;

  /**
   * POST /api/workiq/query
   * 務實做法：直接走 copilot -p '/workiq:workiq ...'，避免 SDK session 與 direct CLI skill registry 不一致。
   */
  routes["POST /api/workiq/query"] = async (req, res) => {
    if (rejectUntrustedWorkIqOrigin(req, res, jsonRes)) return;

    const body = (await readJsonBody(req, res, {
      schema: Schemas.workiqQuery,
    })) as WorkiqQueryInput | null;
    if (!body) return;

    const query = body.query.trim();
    if (!query) {
      jsonRes(res, 400, { ok: false, error: "Query is required" });
      return;
    }

    log("WORKIQ", `Query: ${query.slice(0, 100)}${query.length > 100 ? "..." : ""}`);

    try {
      const workiqPrompt = `${WORKIQ_SKILL_COMMAND} ${query}`;

      log("WORKIQ", "Executing Work IQ via direct copilot CLI prompt");
      const content = await runWorkIqViaCliPrompt(workiqPrompt, deps);
      const execution = toWorkIqExecutionResult(content, `${WORKIQ_SKILL_COMMAND} via copilot -p`);

      log("WORKIQ", `CLI response received (${content.length} chars)`);

      jsonRes(res, 200, withWorkIqExecutionMeta({
        ok: true,
        content: execution.content,
        messageId: null,
        query,
      }, execution.meta));
    } catch (err) {
      const error = err as Error;
      log("WORKIQ", `Error: ${error.message}`);
      log("WORKIQ", `Stack: ${error.stack}`);
      jsonRes(res, 500, {
        ok: false,
        error: error.message,
      });
    }
  };

  /**
   * GET /api/workiq/status
   * Run a real WorkIQ probe instead of returning a guessed status.
   */
  routes["GET /api/workiq/status"] = async (_req, res) => {
    if (rejectUntrustedWorkIqOrigin(_req, res, jsonRes)) return;

    const forceRefresh = /^(?:1|true|yes)$/i.test(String(new URL(_req.url || "/", "http://127.0.0.1").searchParams.get("refresh") || ""));
    const probe = await getCachedWorkIqProbe(deps, forceRefresh);
    jsonRes(res, 200, {
      ok: true,
      available: probe.available,
      tool: "skill",
      route: probe.route,
      probe: {
        available: probe.available,
        ambiguous: probe.ambiguous === true,
        reason: probe.reason || null,
        content: probe.content,
      },
      description: "Query Microsoft 365 data (emails, meetings, documents, Teams messages)",
    });
  };

  routes["POST /api/workiq/probe"] = async (req, res) => {
    if (rejectUntrustedWorkIqOrigin(req, res, jsonRes)) return;

    const probe = await getCachedWorkIqProbe(deps, true);
    jsonRes(res, 200, {
      ok: true,
      available: probe.available,
      route: probe.route,
      ambiguous: probe.ambiguous === true,
      reason: probe.reason || null,
      content: probe.content,
    });
  };
}
