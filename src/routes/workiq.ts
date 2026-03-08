import { approveAll, type CopilotClient, type CopilotSession, type MCPServerConfig } from "@github/copilot-sdk";
import type http from "node:http";
import type { RouteTable, WorkiqRouteDeps } from "../shared/types.js";
import { Schemas, type WorkiqQueryInput } from "./schemas.js";
import { execFileAsync } from "./core.js";

const WORKIQ_TOOL_UNAVAILABLE_RE = /(?:workiq-ask_work_iq\s+is\s+not\s+available(?:\s+in\s+this\s+session)?|work\s*iq(?:\s+tool)?\s+is\s+not\s+available(?:\s+in\s+this\s+session)?|workiq\s+skill\s+is\s+no\s+longer\s+available|no\s+["'`]?workiq["'`]?\s+skill\s+is\s+registered|workiq\s+skill\s+is\s+not\s+(?:registered|listed|available)|available\s+skills?\s+(?:for\s+this\s+session|are)\s*:?|not\s+listed\s+among\s+available\s+skills|current\s+skill\s+registry|temporarily\s+loaded\s+earlier|re-?enabled|enable\/provide\s+the\s+work\s*iq\s+tool|won['’]t\s+fabricate\s+m365\s+search\s+results|tool\s+isn['’]t\s+available\s+in\s+this\s+session|work\s*iq\s+技能目前不可用於此會話|可用的技能清單中沒有|可用的技能(?:清單)?(?:中)?沒有\s*["'`]?workiq["'`]?)/i;
const WORKIQ_SKILL_COMMAND = "/workiq:workiq";
const WORKIQ_PROBE_PROMPT = `${WORKIQ_SKILL_COMMAND} availability probe only. Do not query, summarize, or reveal any user data. Reply with exactly WORKIQ_AVAILABLE if the Work IQ skill is available in this session. If it is unavailable, reply with WORKIQ_UNAVAILABLE: followed by a short reason.`;
const WORKIQ_PROBE_AVAILABLE_RE = /\bWORKIQ_AVAILABLE\b/i;
const WORKIQ_CLI_TIMEOUT_MS = 180000;

type WorkIqExecutionResult = {
  content: string;
  toolUsed: string;
  unavailable: boolean;
  liveDataConfirmed: boolean;
  liveDataSource: "none" | "skill";
};

export function isWorkIqToolUnavailable(content: string): boolean {
  return WORKIQ_TOOL_UNAVAILABLE_RE.test(content);
}

function toWorkIqExecutionResult(content: string, toolUsed: string): WorkIqExecutionResult {
  const unavailable = isWorkIqToolUnavailable(content);
  return {
    content,
    toolUsed,
    unavailable,
    liveDataConfirmed: !unavailable,
    liveDataSource: unavailable ? "none" : "skill",
  };
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
  const { stdout } = await execFileAsync(
    deps.execFile,
    "copilot",
    ["-p", prompt, "--allow-all-tools", "--silent"],
    {
      cwd: process.cwd(),
      timeout: WORKIQ_CLI_TIMEOUT_MS,
      env: process.env,
    },
  );
  return stdout.trim();
}

async function hasLiveSkillTool(ensureClient: WorkiqRouteDeps["ensureClient"]): Promise<boolean> {
  try {
    const client = await ensureClient();
    const result = await client.rpc.tools.list({});
    return Array.isArray(result?.tools)
      && result.tools.some((tool) => String(tool?.name || "").toLowerCase() === "skill");
  } catch {
    return false;
  }
}

function getMcpServers(loadMcpConfigFromDisk: WorkiqRouteDeps["loadMcpConfigFromDisk"]): Record<string, MCPServerConfig> | undefined {
  const config = loadMcpConfigFromDisk();
  const mcpServers = config.config?.mcpServers;
  if (!mcpServers || Object.keys(mcpServers).length === 0) return undefined;
  return mcpServers as Record<string, MCPServerConfig>;
}

async function createWorkIqSession(client: CopilotClient, deps: WorkiqRouteDeps): Promise<CopilotSession> {
  const mcpServers = getMcpServers(deps.loadMcpConfigFromDisk);
  return client.createSession({
    ...(mcpServers && { mcpServers }),
    onPermissionRequest: approveAll,
  });
}

async function resolveWorkIqSession(preferredSessionId: string | undefined, deps: WorkiqRouteDeps): Promise<CopilotSession> {
  const { ensureClient, sessions, log } = deps;
  const client = await ensureClient();

  if (preferredSessionId) {
    try {
      const resumed = await client.resumeSession(preferredSessionId, {
        onPermissionRequest: approveAll,
      });
      sessions.set(preferredSessionId, resumed);
      return resumed;
    } catch (err) {
      log("WARN", `Failed to resume preferred WorkIQ session ${preferredSessionId}: ${(err as Error).message}`);
      sessions.delete(preferredSessionId);
      const created = await createWorkIqSession(client, deps);
      sessions.set(created.sessionId, created);
      return created;
    }
  }

  try {
    const listed = await client.listSessions();
    for (const meta of listed) {
      const sessionId = typeof meta?.sessionId === "string" ? meta.sessionId : "";
      if (!sessionId) continue;
      try {
        const resumed = await client.resumeSession(sessionId, {
          onPermissionRequest: approveAll,
        });
        sessions.set(sessionId, resumed);
        return resumed;
      } catch (err) {
        log("WARN", `Skipping unusable WorkIQ session ${sessionId}: ${(err as Error).message}`);
        sessions.delete(sessionId);
      }
    }
  } catch (err) {
    log("WARN", `Failed to list sessions for WorkIQ resolution: ${(err as Error).message}`);
  }

  const created = await createWorkIqSession(client, deps);
  sessions.set(created.sessionId, created);
  return created;
}

type WorkIqProbeResult = {
  available: boolean;
  skillToolAvailable: boolean;
  route: string;
  content: string;
  reason?: string;
  ambiguous?: boolean;
};

async function probeWorkIqAvailability(deps: WorkiqRouteDeps): Promise<WorkIqProbeResult> {
  const skillToolAvailable = await hasLiveSkillTool(deps.ensureClient);
  if (skillToolAvailable) {
    const client = await deps.ensureClient();
    const session = await createWorkIqSession(client, deps);

    try {
      const result = await session.sendAndWait({ prompt: WORKIQ_PROBE_PROMPT }, 45000);
      const content = result?.data?.content ?? "";
      const unavailable = isWorkIqToolUnavailable(content) || /WORKIQ_UNAVAILABLE\s*:/i.test(content);
      const explicitlyAvailable = WORKIQ_PROBE_AVAILABLE_RE.test(content);

      if (explicitlyAvailable && !unavailable) {
        return {
          available: true,
          skillToolAvailable,
          route: WORKIQ_SKILL_COMMAND,
          content,
        };
      }

      if (!unavailable) {
        return {
          available: false,
          skillToolAvailable,
          route: WORKIQ_SKILL_COMMAND,
          content,
          reason: "Probe did not return explicit WORKIQ_AVAILABLE marker.",
          ambiguous: true,
        };
      }
    } finally {
      try {
        await session.destroy();
      } catch {
        try {
          await session.disconnect();
        } catch {
          // best effort cleanup
        }
      }
    }
  }

  try {
    const content = await runWorkIqViaCliPrompt(WORKIQ_PROBE_PROMPT, deps);
    const unavailable = isWorkIqToolUnavailable(content) || /WORKIQ_UNAVAILABLE\s*:/i.test(content);
    const explicitlyAvailable = WORKIQ_PROBE_AVAILABLE_RE.test(content);
    return {
      available: explicitlyAvailable && !unavailable,
      skillToolAvailable,
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
      skillToolAvailable,
      route: `${WORKIQ_SKILL_COMMAND} via copilot -p`,
      content: "",
      reason: `CLI fallback probe failed: ${(err as Error).message}`,
    };
  }
}

export function registerWorkiqRoutes(routes: RouteTable, deps: WorkiqRouteDeps): void {
  const { jsonRes, readJsonBody, log } = deps;

  /**
   * POST /api/workiq/query
   * 直接使用 CLI 已驗證可用的 /workiq:workiq skill 路徑查詢 M365 資料
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

    const session = await resolveWorkIqSession(body.sessionId, deps);

    log("WORKIQ", `Using session: ${session.sessionId}`);

    try {
      const workiqPrompt = `${WORKIQ_SKILL_COMMAND} ${query}`;

      log("WORKIQ", `Sending prompt to session ${session.sessionId}...`);
      // WorkIQ may take longer to query M365 data, use 120s timeout
      const result = await session.sendAndWait({ prompt: workiqPrompt }, 120000);

      const content = result?.data?.content ?? "";
      let messageId = result?.data?.messageId ?? null;
      let execution = toWorkIqExecutionResult(content, WORKIQ_SKILL_COMMAND);

      log("WORKIQ", `Response received (${content.length} chars)`);

      if (execution.unavailable) {
        log("WORKIQ", "Headless SDK session reported Work IQ unavailable, falling back to direct copilot CLI prompt");
        const fallbackContent = await runWorkIqViaCliPrompt(workiqPrompt, deps);
        execution = toWorkIqExecutionResult(fallbackContent, `${WORKIQ_SKILL_COMMAND} via copilot -p`);
        messageId = null;
      }

      jsonRes(res, 200, {
        ok: true,
        content: execution.content,
        messageId,
        query,
        toolUsed: execution.toolUsed,
        unavailable: execution.unavailable,
        liveDataConfirmed: execution.liveDataConfirmed,
        liveDataSource: execution.liveDataSource,
      });
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

    const probe = await probeWorkIqAvailability(deps);
    jsonRes(res, 200, {
      ok: true,
      available: probe.available,
      skillToolAvailable: probe.skillToolAvailable,
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

    const probe = await probeWorkIqAvailability(deps);
    jsonRes(res, 200, {
      ok: true,
      available: probe.available,
      skillToolAvailable: probe.skillToolAvailable,
      route: probe.route,
      ambiguous: probe.ambiguous === true,
      reason: probe.reason || null,
      content: probe.content,
    });
  };
}
