import type { RouteTable, CoreRouteDeps } from "../shared/types.js";
import type child_process from "node:child_process";
import { Schemas, type ToolsListInput, type McpConfigWriteInput, type SkillsExecuteInput } from "./schemas.js";

type LocalSkillItem = {
  name: string;
  description: string;
  source: "local-skill";
  path: string;
};

function extractSkillDescription(skillDoc: string): string {
  const frontmatterMatch = skillDoc.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch?.[1]) {
    const frontmatter = frontmatterMatch[1];
    const descLine = frontmatter
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.toLowerCase().startsWith("description:"));

    if (descLine) {
      const desc = descLine.replace(/^description:\s*/i, "").trim().replace(/^['"]|['"]$/g, "");
      if (desc) return desc;
    }
  }

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

/** Parse payload.message into { agentName, message } for invoke commands. */
export function parseInvokePayload(payload: Record<string, unknown>): { agentName: string; message: string } | null {
  const rawMessage = String(payload.message ?? "").trim();
  if (!rawMessage) return null;

  // Pattern: "<agent-name> to check <actual message>"
  const match = rawMessage.match(/^(\S+)\s+to\s+check\s+([\s\S]+)$/i);
  if (match?.[1] && match[2]) {
    return { agentName: match[1], message: match[2].trim() };
  }

  // Fallback: if --agent-name is provided separately in payload
  const agentName = String(payload.agentName ?? payload.agent_name ?? "").trim();
  if (agentName) {
    return { agentName, message: rawMessage };
  }

  // Raw message only — no agent name detected
  return null;
}

/** Build CLI args for foundry_agent.sh based on the command. */
export function buildFoundryArgs(command: string, payload: Record<string, unknown>): string[] | null {
  switch (command) {
    case "health":
      return ["health", "--json"];

    case "list":
      return ["list", "--json", "--limit", String(payload.limit ?? 50)];

    case "invoke": {
      const parsed = parseInvokePayload(payload);
      if (!parsed) {
        // Fall back to using the raw message with a default agent
        const fallbackMessage = String(payload.message ?? "").trim();
        if (!fallbackMessage) return null;
        return [
          "invoke",
          "--agent-name", String(payload.defaultAgent ?? "um-semantic-agent"),
          "--message", fallbackMessage,
          "--json",
        ];
      }

      const args = [
        "invoke",
        "--agent-name", parsed.agentName,
        "--message", parsed.message,
        "--json",
      ];

      const sessionId = String(payload.sessionId ?? payload.session_id ?? "").trim();
      if (sessionId) {
        args.push("--session-id", sessionId);
      }

      return args;
    }

    case "status":
      return ["health", "--json"];

    default:
      return null;
  }
}

type ExecFileResult = { stdout: string; stderr: string };
type ExecFileFn = typeof child_process.execFile;

/** Promise wrapper around child_process.execFile. */
export function execFileAsync(
  execFileFn: ExecFileFn,
  file: string,
  args: string[],
  options: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv },
): Promise<ExecFileResult> {
  return new Promise((resolve, reject) => {
    execFileFn(file, args, options, (error, stdout, stderr) => {
      if (error) {
        const enriched = Object.assign(error, {
          stderr: typeof stderr === "string" ? stderr : String(stderr ?? ""),
        });
        reject(enriched);
      } else {
        resolve({
          stdout: typeof stdout === "string" ? stdout : String(stdout ?? ""),
          stderr: typeof stderr === "string" ? stderr : String(stderr ?? ""),
        });
      }
    });
  });
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
    execFile,
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
        error: `Only foundry skill is enabled: ${skillName}`,
      });
      return;
    }

    // Resolve the foundry_agent.sh script path
    const scriptPath = path.join(
      process.cwd(),
      ".github",
      "skills",
      "foundry_agent_skill",
      "scripts",
      "foundry_agent.sh",
    );

    if (!fs.existsSync(scriptPath)) {
      log("WARN", `Foundry skill script not found at ${scriptPath}, falling back to mock`);
      jsonRes(res, 200, {
        ok: true,
        mode: "mock",
        result: {
          skillName,
          command,
          status: "script-not-found",
          summary: "foundry_agent.sh not found — mock fallback",
        },
      });
      return;
    }

    // Build CLI arguments based on the command
    const args = buildFoundryArgs(command, payload);
    if (args === null) {
      jsonRes(res, 400, {
        ok: false,
        error: `Unsupported foundry command: ${command}`,
      });
      return;
    }

    log("SKILL", `Foundry ${command}: ${scriptPath} ${args.join(" ")}`);

    const timeoutMs = parseInt(process.env.SKILL_REQUEST_TIMEOUT_SECONDS || "60", 10) * 1000;

    try {
      const result = await execFileAsync(execFile, scriptPath, args, {
        cwd: process.cwd(),
        timeout: timeoutMs,
        env: { ...process.env },
      });

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        // If JSON parse fails, wrap raw output
        parsed = { raw: result.stdout.trim(), stderr: result.stderr.trim() };
      }

      if (result.stderr) {
        log("SKILL", `Foundry stderr: ${result.stderr.slice(0, 500)}`);
      }

      jsonRes(res, 200, {
        ok: true,
        mode: "live",
        result: {
          skillName,
          command,
          status: "completed",
          startedAt: new Date().toISOString(),
          ...parsed,
        },
      });
    } catch (err) {
      const error = err as Error & { code?: string; killed?: boolean; stderr?: string };
      const isTimeout = error.killed === true || error.code === "ERR_CHILD_PROCESS_TIMEOUT";
      log("ERROR", `Foundry skill failed: ${error.message}`);
      if (error.stderr) log("ERROR", `Foundry stderr: ${error.stderr.slice(0, 500)}`);

      jsonRes(res, isTimeout ? 504 : 502, {
        ok: false,
        mode: "live",
        error: isTimeout
          ? `Foundry skill timed out after ${timeoutMs / 1000}s`
          : `Foundry skill error: ${error.message}`,
        stderr: error.stderr?.slice(0, 1000) || undefined,
      });
    }
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

    const mergedTools: Array<{ name: string; description?: string; source: "cli" | "local-skill" }> = [];
    const seenToolNames = new Set<string>();

    try {
      const toolsResult = await c.rpc.tools.list({});
      for (const t of (toolsResult.tools || [])) {
        const name = String(t?.name || "").trim();
        const key = name.toLowerCase();
        if (!key || seenToolNames.has(key)) continue;
        seenToolNames.add(key);
        mergedTools.push({
          name,
          description: t?.description,
          source: "cli",
        });
      }
    } catch (err) {
      log("WARN", "tools.list not available:", (err as Error).message);
    }

    try {
      const localSkills = listLocalSkills(process.cwd(), fs, path);
      for (const skill of localSkills) {
        const name = String(skill?.name || "").trim();
        const key = name.toLowerCase();
        if (!key || seenToolNames.has(key)) continue;
        seenToolNames.add(key);
        mergedTools.push({
          name,
          description: skill.description,
          source: "local-skill",
        });
      }
    } catch (err) {
      log("WARN", "listLocalSkills not available:", (err as Error).message);
    }

    context.tools = mergedTools;

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
