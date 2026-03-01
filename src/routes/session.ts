import { approveAll } from "@github/copilot-sdk";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import type { RouteTable, SessionRouteDeps } from "../shared/types.js";
import {
  Schemas,
  type SwitchModelInput,
  type SessionCreateInput,
  type SessionIdOnlyInput,
  type SessionSendInput,
} from "./schemas.js";

import type { SessionEvent } from "@github/copilot-sdk";

type SessionRuntimeContext = {
  cwd: string;
  gitRoot: string;
  repository: string;
  branch: string;
};

function runGit(args: string[], cwd: string): string {
  try {
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status !== 0) return "";
    return (result.stdout || "").trim();
  } catch {
    return "";
  }
}

function parseRepository(remoteUrl: string, gitRoot: string): string {
  if (remoteUrl) {
    const cleaned = remoteUrl.trim().replace(/\.git$/i, "");
    const sshMatch = cleaned.match(/^[^@]+@[^:]+:(.+)$/);
    if (sshMatch?.[1]) return sshMatch[1];

    try {
      const url = new URL(cleaned);
      return url.pathname.replace(/^\//, "");
    } catch {
      return cleaned;
    }
  }

  if (!gitRoot) return "";
  return path.basename(gitRoot);
}

/**
 * Transform image file paths in content to markdown image links.
 * Detects paths like /path/to/output/image.png and converts to:
 * ![Generated Image](http://127.0.0.1:8321/api/image?path=...)
 */
function transformImagePaths(content: string, httpPort: number): string {
  // Match common image paths in output directory
  const imagePathRegex = /(?:^|\s|：|:|儲存至)(\/?(?:[\w./-]+\/)?output\/[^\s\n]+\.(?:png|jpg|jpeg|gif|webp))/gi;
  
  let transformed = content;
  const matches = content.matchAll(imagePathRegex);
  
  for (const match of matches) {
    const imagePath = match[1];
    if (!imagePath) continue;
    // Check if this path already has a markdown image link
    if (content.includes(`](http://127.0.0.1:${httpPort}/api/image?path=`)) {
      continue;
    }
    
    // Resolve to absolute path if relative
    const absPath = path.isAbsolute(imagePath) 
      ? imagePath 
      : path.resolve(process.cwd(), imagePath);
    
    // Only transform if file exists
    if (fs.existsSync(absPath)) {
      const encodedPath = encodeURIComponent(absPath);
      const imageUrl = `http://127.0.0.1:${httpPort}/api/image?path=${encodedPath}`;
      const markdownImage = `\n\n![Generated Image](${imageUrl})`;
      
      // Append markdown image if not already present
      if (!transformed.includes(imageUrl)) {
        transformed += markdownImage;
      }
    }
  }
  
  return transformed;
}

function getSessionRuntimeContext(): SessionRuntimeContext {
  const cwd = process.cwd();
  const gitRoot = runGit(["rev-parse", "--show-toplevel"], cwd);
  const gitCwd = gitRoot || cwd;
  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], gitCwd);
  const remoteUrl = runGit(["config", "--get", "remote.origin.url"], gitCwd);
  const repository = parseRepository(remoteUrl, gitRoot);

  return {
    cwd,
    gitRoot,
    repository,
    branch,
  };
}

export function registerSessionRoutes(routes: RouteTable, deps: SessionRouteDeps): void {
  const {
    ensureClient,
    getSessionOrResume,
    sessions,
    jsonRes,
    readJsonBody,
    log,
    buildPromptWithAttachments,
    cors,
    loadMcpConfigFromDisk,
  } = deps;

  routes["POST /api/session/switch-model"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.switchModel }) as SwitchModelInput | null;
    if (!body) return;

    const session = await getSessionOrResume(body.sessionId);
    if (!session) {
      jsonRes(res, 404, { ok: false, error: `Session ${body.sessionId} not found` });
      return;
    }

    try {
      const result = await session.rpc.model.switchTo({ modelId: body.modelId });
      log("MODEL", `[${body.sessionId.slice(0, 8)}] Switched to model: ${body.modelId}`, result);
      jsonRes(res, 200, { ok: true, modelId: result?.modelId || body.modelId });
    } catch (err) {
      log("WARN", `model.switchTo failed: ${(err as Error).message}`);
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
    }
  };

  routes["POST /api/session/create"] = async (req, res) => {
    const body = await readJsonBody(req, res, {
      schema: Schemas.sessionCreate,
      allowEmpty: true,
    }) as SessionCreateInput | null;
    if (!body) return;

    log("SESSION", "Creating session with config:", JSON.stringify(body));

    // Load MCP config from disk
    const mcpConfig = loadMcpConfigFromDisk();
    const mcpServers = mcpConfig.config?.mcpServers || {};
    if (Object.keys(mcpServers).length > 0) {
      log("SESSION", `Loading ${Object.keys(mcpServers).length} MCP servers from ${mcpConfig.source}`);
    }

    const c = await ensureClient();
    const config = {
      ...(body.model && { model: body.model }),
      ...(body.streaming !== undefined && { streaming: body.streaming }),
      ...(body.systemMessage && { systemMessage: { content: body.systemMessage } }),
      ...(Object.keys(mcpServers).length > 0 && { mcpServers: mcpServers as Record<string, import("@github/copilot-sdk").MCPServerConfig> }),
      onPermissionRequest: approveAll,
    };

    const session = await c.createSession(config);
    const sid = session.sessionId;
    sessions.set(sid, session);

    log("SESSION", `Created session: ${sid}`);
    jsonRes(res, 200, { ok: true, sessionId: sid, ...getSessionRuntimeContext() });
  };

  routes["POST /api/session/resume"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionIdOnly }) as SessionIdOnlyInput | null;
    if (!body) return;

    log("SESSION", `Resuming session: ${body.sessionId}`);
    const c = await ensureClient();
    const session = await c.resumeSession(body.sessionId, {
      onPermissionRequest: approveAll,
    });
    sessions.set(body.sessionId, session);
    jsonRes(res, 200, { ok: true, sessionId: body.sessionId, ...getSessionRuntimeContext() });
  };

  routes["POST /api/session/list"] = async (_req, res) => {
    const c = await ensureClient();
    const list = await c.listSessions();
    jsonRes(res, 200, { ok: true, sessions: list });
  };

  routes["POST /api/session/delete"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionIdOnly }) as SessionIdOnlyInput | null;
    if (!body) return;

    const c = await ensureClient();
    await c.deleteSession(body.sessionId);
    sessions.delete(body.sessionId);

    log("SESSION", `Deleted session: ${body.sessionId}`);
    jsonRes(res, 200, { ok: true });
  };

  routes["POST /api/session/destroy"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionIdOnly }) as SessionIdOnlyInput | null;
    if (!body) return;

    const session = sessions.get(body.sessionId);
    if (session) {
      await session.destroy();
      sessions.delete(body.sessionId);
    }

    log("SESSION", `Destroyed session: ${body.sessionId}`);
    jsonRes(res, 200, { ok: true });
  };

  routes["POST /api/session/messages"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionIdOnly }) as SessionIdOnlyInput | null;
    if (!body) return;

    const session = await getSessionOrResume(body.sessionId);
    if (!session) {
      jsonRes(res, 404, { ok: false, error: `Session ${body.sessionId} not found` });
      return;
    }

    const messages = await session.getMessages();
    jsonRes(res, 200, { ok: true, messages });
  };

  routes["POST /api/session/sendAndWait"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionSend }) as SessionSendInput | null;
    if (!body) return;

    const session = await getSessionOrResume(body.sessionId);
    if (!session) {
      jsonRes(res, 404, { ok: false, error: `Session ${body.sessionId} not found` });
      return;
    }

    const fullPrompt = buildPromptWithAttachments(body.prompt, body.attachments);
    log(
      "CHAT",
      `[${body.sessionId.slice(0, 8)}] sendAndWait: ${fullPrompt.slice(0, 100)}... (${body.attachments?.length || 0} files)`
    );
    // 180s timeout for long-running operations like image generation
    const SEND_AND_WAIT_TIMEOUT_MS = 180_000;
    const result = await session.sendAndWait({ prompt: fullPrompt }, SEND_AND_WAIT_TIMEOUT_MS);
    log("CHAT", `[${body.sessionId.slice(0, 8)}] Response received`);

    const content = result?.data?.content ?? "";
    const messageId = result?.data?.messageId ?? null;
    jsonRes(res, 200, {
      ok: true,
      content,
      messageId,
      type: result?.type ?? null,
      raw: result ? { type: result.type, data: result.data } : null,
    });
  };

  routes["POST /api/session/send"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionSend }) as SessionSendInput | null;
    if (!body) return;

    const session = await getSessionOrResume(body.sessionId);
    if (!session) {
      jsonRes(res, 404, { ok: false, error: `Session ${body.sessionId} not found` });
      return;
    }

    const fullPrompt = buildPromptWithAttachments(body.prompt, body.attachments);
    log(
      "CHAT",
      `[${body.sessionId.slice(0, 8)}] send (streaming): ${fullPrompt.slice(0, 100)}... (${body.attachments?.length || 0} files)`
    );

    cors(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const sendSSE = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // HTTP port for image proxy URLs (default 8321)
    const httpPort = parseInt(process.env.HTTP_PORT || "8321", 10);

    let finished = false;

    const unsubscribe = session.on((event: SessionEvent) => {
      if (finished) return;
      log("SSE", `[${body.sessionId.slice(0, 8)}] event: ${event.type}`);
      
      // Transform image paths in assistant messages
      let eventToSend: SessionEvent | Record<string, unknown> = event;
      if (event.type === "assistant.message" && "content" in (event.data ?? {})) {
        const eventData = event.data as { content?: string };
        if (eventData.content) {
          const transformedContent = transformImagePaths(eventData.content, httpPort);
          if (transformedContent !== eventData.content) {
            eventToSend = {
              ...event,
              data: { ...event.data, content: transformedContent },
            };
            log("SSE", `[${body.sessionId.slice(0, 8)}] transformed image path in response`);
          }
        }
      }
      
      sendSSE(event.type, eventToSend);

      if (event.type === "session.idle") {
        finished = true;
        sendSSE("done", { type: "done" });
        res.end();
        unsubscribe();
        log("SSE", `[${body.sessionId.slice(0, 8)}] stream finished (idle)`);
      }
    });

    req.on("close", () => {
      if (!finished) {
        log("SSE", `[${body.sessionId.slice(0, 8)}] client disconnected`);
        finished = true;
        unsubscribe();
      }
    });

    try {
      const msgId = await session.send({ prompt: fullPrompt });
      log("SSE", `[${body.sessionId.slice(0, 8)}] send() returned msgId: ${msgId}`);
    } catch (err) {
      log("ERROR", `[${body.sessionId.slice(0, 8)}] send() error:`, (err as Error).message);
      if (!finished) {
        finished = true;
        sendSSE("error", { type: "error", message: (err as Error).message });
        res.end();
        unsubscribe();
      }
    }
  };
}
