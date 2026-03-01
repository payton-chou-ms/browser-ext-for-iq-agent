import type { RouteTable, CoreRouteDeps } from "../shared/types.js";
import { Schemas, type ToolsListInput, type McpConfigWriteInput, type SkillsExecuteInput } from "./schemas.js";

type LocalSkillItem = {
  name: string;
  description: string;
  source: "local-skill";
  path: string;
};

function extractSkillDescription(skillDoc: string): string {
  const lines = skillDoc
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    if (line.startsWith("#")) continue;
    if (line.startsWith("```")) continue;
    if (line.startsWith("-")) continue;
    return line;
  }

  return "Local repo skill";
}

function listLocalSkills(baseDir: string, fsImpl: CoreRouteDeps["fs"], pathImpl: CoreRouteDeps["path"]): LocalSkillItem[] {
  const skillsRoot = pathImpl.join(baseDir, ".github", "skills");
  if (!fsImpl.existsSync(skillsRoot)) return [];

  const entries = fsImpl.readdirSync(skillsRoot, { withFileTypes: true });
  const skills = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillName = entry.name;
      const skillPath = pathImpl.join(skillsRoot, skillName);
      const skillDocPath = pathImpl.join(skillPath, "SKILL.md");
      const readmePath = pathImpl.join(skillPath, "README.md");

      const docPath = fsImpl.existsSync(skillDocPath)
        ? skillDocPath
        : fsImpl.existsSync(readmePath)
          ? readmePath
          : null;

      if (!docPath) return null;

      let description = "Local repo skill";
      try {
        const rawDoc = fsImpl.readFileSync(docPath, "utf-8");
        description = extractSkillDescription(rawDoc);
      } catch {}

      return {
        name: skillName,
        description,
        source: "local-skill" as const,
        path: pathImpl.relative(baseDir, skillPath),
      };
    })
    .filter((skill): skill is LocalSkillItem => skill !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return skills;
}

export function registerCoreRoutes(routes: RouteTable, deps: CoreRouteDeps): void {
  const {
    ensureClient,
    getClientState,
    cliPort,
    httpPort,
    jsonRes,
    readJsonBody,
    log,
    loadMcpConfigFromDisk,
    getWritableMcpConfigPath,
    fs,
    path,
    getFoundrySnapshot,
  } = deps;

  routes["GET /health"] = async (_req, res) => {
    const state = getClientState();
    jsonRes(res, 200, { status: "ok", cliPort, httpPort, sdkState: state });
  };

  routes["POST /api/ping"] = async (_req, res) => {
    const c = await ensureClient();
    const result = await c.ping("iq-copilot");
    jsonRes(res, 200, { ok: true, result });
  };

  routes["POST /api/models"] = async (_req, res) => {
    const c = await ensureClient();
    try {
      const result = await c.listModels();
      jsonRes(res, 200, { ok: true, models: result });
    } catch (err) {
      log("WARN", "listModels not available:", (err as Error).message);
      jsonRes(res, 200, {
        ok: true,
        models: [
          "gpt-4.1",
          "gpt-4.1-mini",
          "gpt-4o",
          "gpt-4o-mini",
          "claude-sonnet-4-20250514",
          "claude-haiku-4-20250414",
          "o4-mini",
        ],
        fallback: true,
      });
    }
  };

  routes["POST /api/tools"] = async (req, res) => {
    const params = await readJsonBody(req, res, {
      schema: Schemas.toolsList,
      allowEmpty: true,
    }) as ToolsListInput | null;
    if (!params) return;

    const c = await ensureClient();
    try {
      const result = await c.rpc.tools.list(params.model ? { model: params.model } : {});
      jsonRes(res, 200, { ok: true, tools: result.tools || [] });
    } catch (err) {
      log("WARN", "tools.list not available:", (err as Error).message);
      jsonRes(res, 200, { ok: true, tools: [], fallback: true, error: (err as Error).message });
    }
  };

  routes["POST /api/skills/local"] = async (_req, res) => {
    try {
      const skills = listLocalSkills(process.cwd(), fs, path);
      jsonRes(res, 200, { ok: true, skills });
    } catch (err) {
      jsonRes(res, 200, { ok: true, skills: [], error: (err as Error).message });
    }
  };

  routes["POST /api/skills/execute"] = async (req, res) => {
    const body = await readJsonBody(req, res, {
      schema: Schemas.skillsExecute,
    }) as SkillsExecuteInput | null;
    if (!body) return;

    const skillName = body.skillName.trim();
    const command = (body.command || "status").trim();
    const payload = body.payload || {};
    const normalized = skillName.toLowerCase();

    if (!normalized.includes("foundry")) {
      jsonRes(res, 400, {
        ok: false,
        error: `Only foundry mock skill is enabled in MVP: ${skillName}`,
      });
      return;
    }

    log("SKILL", `Mock execute ${skillName} command=${command}`);
    jsonRes(res, 200, {
      ok: true,
      mode: "mock",
      result: {
        skillName,
        command,
        status: "completed",
        startedAt: new Date().toISOString(),
        summary: `Mock Foundry agent executed command: ${command}`,
        output: {
          message: "Mock response from Foundry Agent",
          nextAction: "Replace /api/skills/execute mock handler with real Foundry invocation",
          payloadEcho: payload,
        },
      },
    });
  };

  routes["POST /api/quota"] = async (_req, res) => {
    const c = await ensureClient();
    try {
      const result = await c.rpc.account.getQuota();
      jsonRes(res, 200, { ok: true, quota: result.quotaSnapshots || {} });
    } catch (err) {
      log("WARN", "account.getQuota not available:", (err as Error).message);
      jsonRes(res, 200, { ok: true, quota: {}, fallback: true, error: (err as Error).message });
    }
  };

  routes["POST /api/context"] = async (_req, res) => {
    const c = await ensureClient();
    const context: Record<string, unknown> = {};

    try {
      context.status = await c.getStatus();
    } catch (err) {
      log("WARN", "getStatus not available:", (err as Error).message);
      context.status = { version: "unknown", protocolVersion: 0 };
    }

    try {
      context.auth = await c.getAuthStatus();
    } catch (err) {
      log("WARN", "getAuthStatus not available:", (err as Error).message);
      context.auth = { isAuthenticated: false };
    }

    try {
      const models = await c.listModels();
      context.models = models.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }));
    } catch (err) {
      log("WARN", "listModels not available:", (err as Error).message);
      context.models = [];
    }

    try {
      const toolsResult = await c.rpc.tools.list({});
      context.tools = (toolsResult.tools || []).map((t: { name: string; description?: string }) => ({
        name: t.name,
        description: t.description,
      }));
    } catch (err) {
      log("WARN", "tools.list not available:", (err as Error).message);
      context.tools = [];
    }

    try {
      const sessionsList = await c.listSessions();
      context.sessions = sessionsList.map(
        (session) => ({
          sessionId: session.sessionId,
          summary: session.summary,
          context: session.context || {},
        })
      );
    } catch (err) {
      log("WARN", "listSessions not available:", (err as Error).message);
      context.sessions = [];
    }

    try {
      const quotaResult = await c.rpc.account.getQuota();
      context.quota = quotaResult.quotaSnapshots || {};
    } catch (err) {
      log("WARN", "account.getQuota not available:", (err as Error).message);
      context.quota = {};
    }

    context.sdkState = c.getState();
    context.foundry = getFoundrySnapshot();

    jsonRes(res, 200, { ok: true, context });
  };

  routes["GET /api/mcp/config"] = async (_req, res) => {
    const loaded = loadMcpConfigFromDisk();
    if (loaded.source) {
      log("MCP", `Loaded config from ${loaded.source}`);
    }
    jsonRes(res, 200, { ok: true, source: loaded.source, config: loaded.config });
  };

  routes["POST /api/mcp/config"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.mcpConfigWrite }) as McpConfigWriteInput | null;
    if (!body) return;

    try {
      const loaded = loadMcpConfigFromDisk();
      const targetPath = getWritableMcpConfigPath(loaded.source);
      const targetDir = path.dirname(targetPath);

      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(targetPath, `${JSON.stringify(body.config, null, 2)}\n`, "utf-8");

      log("MCP", `Saved config to ${targetPath}`);
      jsonRes(res, 200, { ok: true, source: targetPath, config: body.config });
    } catch (err) {
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };
}
