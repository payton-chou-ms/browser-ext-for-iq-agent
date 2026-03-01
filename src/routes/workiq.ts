import type { RouteTable, WorkiqRouteDeps } from "../shared/types.js";
import type { CopilotSession } from "@github/copilot-sdk";
import { Schemas, type WorkiqQueryInput } from "./schemas.js";

export function registerWorkiqRoutes(routes: RouteTable, deps: WorkiqRouteDeps): void {
  const { ensureClient, jsonRes, readJsonBody, log, getSessionOrResume, sessions } = deps;

  /**
   * POST /api/workiq/query
   * 直接調用 WorkIQ tool (workiq-ask_work_iq) 查詢 M365 資料
   */
  routes["POST /api/workiq/query"] = async (req, res) => {
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

    // Get or create session for WorkIQ queries
    let session: CopilotSession | null = null;
    const sessionId = body.sessionId;

    if (sessionId) {
      session = await getSessionOrResume(sessionId);
    }

    // Use existing session or first available session
    if (!session && sessions.size > 0) {
      const firstSessionId = sessions.keys().next().value;
      if (firstSessionId) {
        session = sessions.get(firstSessionId) || null;
      }
    }

    // If no session found, return error (we need existing session with MCP tools loaded)
    if (!session) {
      log("WORKIQ", "No active session found - cannot use WorkIQ without MCP tools");
      jsonRes(res, 400, {
        ok: false,
        error: "No active session. Please start a chat session first to load WorkIQ MCP tools.",
      });
      return;
    }

    log("WORKIQ", `Using session: ${session.sessionId}`);

    try {
      // Build a prompt that explicitly requests WorkIQ tool usage
      // Using very explicit language to ensure the CLI uses workiq-ask_work_iq
      const workiqPrompt = [
        "IMPORTANT: You MUST use the workiq-ask_work_iq tool to answer this question.",
        "Do NOT use foundry_agent_skill or any other skill.",
        "Do NOT respond without calling workiq-ask_work_iq first.",
        "",
        `Question: ${query}`,
      ].join("\n");

      log("WORKIQ", `Sending prompt to session ${session.sessionId}...`);
      // WorkIQ may take longer to query M365 data, use 120s timeout
      const result = await session.sendAndWait({ prompt: workiqPrompt }, 120000);

      const content = result?.data?.content ?? "";
      const messageId = result?.data?.messageId ?? null;

      log("WORKIQ", `Response received (${content.length} chars)`);

      jsonRes(res, 200, {
        ok: true,
        content,
        messageId,
        query,
        toolUsed: "workiq-ask_work_iq",
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
   * Check if WorkIQ is available
   */
  routes["GET /api/workiq/status"] = async (_req, res) => {
    jsonRes(res, 200, {
      ok: true,
      available: true,
      tool: "workiq-ask_work_iq",
      description: "Query Microsoft 365 data (emails, meetings, documents, Teams messages)",
    });
  };
}
