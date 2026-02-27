#!/usr/bin/env node
// ===== IQ Copilot SDK Proxy =====
// HTTP server that bridges the browser extension to Copilot CLI via the official SDK.
//
// Architecture:
//   Browser Extension  →  HTTP (this proxy)  →  @github/copilot-sdk  →  Copilot CLI
//
// Usage:
//   node proxy.js [--cli-port 4321] [--http-port 8321]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

// ── Args ──
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : fallback;
}

const cliPort = parseInt(getArg("--cli-port", "4321"));
const httpPort = parseInt(getArg("--http-port", "8321"));

// ── Logging ──
function ts() { return new Date().toISOString(); }
function log(tag, ...msg) { console.log(`[${ts()}] [${tag}]`, ...msg); }

// ── SDK Client ──
let client = null;
const sessions = new Map(); // sessionId → CopilotSession

async function ensureClient() {
  if (client && client.getState() === "connected") return client;

  log("SDK", `Connecting to CLI at localhost:${cliPort}...`);
  client = new CopilotClient({ cliUrl: `localhost:${cliPort}` });
  await client.start();
  log("SDK", `Connected! State: ${client.getState()}`);
  return client;
}

// ── HTTP Helpers ──
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function jsonRes(res, status, data) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ── Route Handlers ──
const routes = {};

// Health check
routes["GET /health"] = async (_req, res) => {
  const state = client ? client.getState() : "not-initialized";
  jsonRes(res, 200, { status: "ok", cliPort, httpPort, sdkState: state });
};

// Ping
routes["POST /api/ping"] = async (_req, res) => {
  const c = await ensureClient();
  const result = await c.ping("iq-copilot");
  jsonRes(res, 200, { ok: true, result });
};

// List models
routes["POST /api/models"] = async (_req, res) => {
  const c = await ensureClient();
  try {
    const result = await c.listModels();
    jsonRes(res, 200, { ok: true, models: result });
  } catch (err) {
    log("WARN", "listModels not available:", err.message);
    jsonRes(res, 200, {
      ok: true,
      models: [
        "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini",
        "claude-sonnet-4-20250514", "claude-haiku-4-20250414",
        "o4-mini",
      ],
      fallback: true,
    });
  }
};

// Switch model in active session
routes["POST /api/session/switch-model"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { sessionId, modelId } = body;

  if (!modelId) {
    jsonRes(res, 400, { ok: false, error: "modelId is required" });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    jsonRes(res, 404, { ok: false, error: `Session ${sessionId} not found` });
    return;
  }

  try {
    const result = await session.rpc.model.switchTo({ modelId });
    log("MODEL", `[${sessionId.slice(0, 8)}] Switched to model: ${modelId}`, result);
    jsonRes(res, 200, { ok: true, modelId: result?.modelId || modelId });
  } catch (err) {
    log("WARN", `model.switchTo failed: ${err.message}`);
    jsonRes(res, 500, { ok: false, error: err.message });
  }
};

// Read local MCP config
routes["GET /api/mcp/config"] = async (_req, res) => {
  const configPaths = [
    path.join(os.homedir(), ".copilot", "mcp-config.json"),
    path.join(os.homedir(), ".config", "github-copilot", "mcp-config.json"),
  ];

  for (const p of configPaths) {
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const config = JSON.parse(raw);
      log("MCP", `Loaded config from ${p}`);
      jsonRes(res, 200, { ok: true, source: p, config });
      return;
    } catch {
      // try next path
    }
  }

  jsonRes(res, 200, { ok: true, source: null, config: { mcpServers: {} } });
};

// Create session
routes["POST /api/session/create"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  log("SESSION", "Creating session with config:", JSON.stringify(body));

  const c = await ensureClient();
  const config = {
    ...(body.model && { model: body.model }),
    ...(body.streaming !== undefined && { streaming: body.streaming }),
    ...(body.systemMessage && { systemMessage: { content: body.systemMessage } }),
    onPermissionRequest: approveAll,
  };

  const session = await c.createSession(config);
  const sid = session.sessionId;
  sessions.set(sid, session);

  log("SESSION", `Created session: ${sid}`);
  jsonRes(res, 200, { ok: true, sessionId: sid });
};

// Resume session
routes["POST /api/session/resume"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { sessionId } = body;
  log("SESSION", `Resuming session: ${sessionId}`);

  const c = await ensureClient();
  const session = await c.resumeSession(sessionId, {
    onPermissionRequest: approveAll,
  });
  sessions.set(sessionId, session);

  jsonRes(res, 200, { ok: true, sessionId });
};

// List sessions
routes["POST /api/session/list"] = async (_req, res) => {
  const c = await ensureClient();
  const list = await c.listSessions();
  jsonRes(res, 200, { ok: true, sessions: list });
};

// Delete session
routes["POST /api/session/delete"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { sessionId } = body;

  const c = await ensureClient();
  await c.deleteSession(sessionId);
  sessions.delete(sessionId);

  log("SESSION", `Deleted session: ${sessionId}`);
  jsonRes(res, 200, { ok: true });
};

// Destroy session (free resources)
routes["POST /api/session/destroy"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { sessionId } = body;

  const session = sessions.get(sessionId);
  if (session) {
    await session.destroy();
    sessions.delete(sessionId);
  }

  log("SESSION", `Destroyed session: ${sessionId}`);
  jsonRes(res, 200, { ok: true });
};

// ── File Attachment Helpers ──
// Copilot SDK session.send() expects a prompt string.
// For text files: inline content into the prompt.
// For binary files (PDF, etc.): save to temp dir and tell the model the path.
const TEMP_DIR = path.join(os.tmpdir(), "iq-copilot-uploads");
fs.mkdirSync(TEMP_DIR, { recursive: true });

function buildPromptWithAttachments(prompt, attachments) {
  if (!attachments || attachments.length === 0) return prompt;

  const parts = [];

  for (const file of attachments) {
    if (file.textContent) {
      // Text-based file — inline content
      parts.push(`<file name="${file.name}" type="${file.type}">\n${file.textContent}\n</file>`);
    } else if (file.isImage && file.dataUrl) {
      // Image — save to temp and reference
      const tempPath = saveTempFile(file);
      parts.push(`<file name="${file.name}" type="${file.type}" path="${tempPath}">\n[Image saved to: ${tempPath}]\nYou can view or analyze this image file at the path above.\n</file>`);
    } else if (file.dataUrl) {
      // Binary file (PDF, etc.) — save to temp and tell model the path
      const tempPath = saveTempFile(file);
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
      if (isPdf) {
        parts.push(`<file name="${file.name}" type="${file.type}" path="${tempPath}">\n[PDF saved to: ${tempPath}]\nThe user attached a PDF file. You can read it using bash tools, e.g.:\n  strings "${tempPath}" | head -200\nor any other command to extract text from the PDF.\n</file>`);
      } else {
        parts.push(`<file name="${file.name}" type="${file.type}" path="${tempPath}">\n[File saved to: ${tempPath}]\n</file>`);
      }
    }
  }

  if (parts.length === 0) return prompt;

  const fileContext = parts.join("\n\n");
  return `${fileContext}\n\n${prompt}`;
}

function saveTempFile(file) {
  const base64 = file.dataUrl.split(",")[1] || "";
  const buf = Buffer.from(base64, "base64");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const tempPath = path.join(TEMP_DIR, `${Date.now()}_${safeName}`);
  fs.writeFileSync(tempPath, buf);
  log("FILE", `Saved attachment: ${file.name} → ${tempPath} (${formatBytes(buf.length)})`);
  return tempPath;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Send and wait (non-streaming)
routes["POST /api/session/sendAndWait"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { sessionId, prompt, attachments } = body;

  const session = sessions.get(sessionId);
  if (!session) {
    jsonRes(res, 404, { ok: false, error: `Session ${sessionId} not found` });
    return;
  }

  const fullPrompt = buildPromptWithAttachments(prompt, attachments);
  log("CHAT", `[${sessionId.slice(0, 8)}] sendAndWait: ${fullPrompt.slice(0, 100)}... (${attachments?.length || 0} files)`);
  const result = await session.sendAndWait({ prompt: fullPrompt });
  log("CHAT", `[${sessionId.slice(0, 8)}] Response received`);

  // Flatten for easy consumption: { ok, content, messageId, type }
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

// Send with streaming (SSE)
routes["POST /api/session/send"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { sessionId, prompt, attachments } = body;

  const session = sessions.get(sessionId);
  if (!session) {
    jsonRes(res, 404, { ok: false, error: `Session ${sessionId} not found` });
    return;
  }

  const fullPrompt = buildPromptWithAttachments(prompt, attachments);
  log("CHAT", `[${sessionId.slice(0, 8)}] send (streaming): ${fullPrompt.slice(0, 100)}... (${attachments?.length || 0} files)`);

  // SSE headers
  cors(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let finished = false;

  // Subscribe to session events BEFORE sending
  const unsubscribe = session.on((event) => {
    if (finished) return;
    log("SSE", `[${sessionId.slice(0, 8)}] event: ${event.type}`);
    sendSSE(event.type, event);

    if (event.type === "session.idle") {
      finished = true;
      sendSSE("done", { type: "done" });
      res.end();
      unsubscribe();
      log("SSE", `[${sessionId.slice(0, 8)}] stream finished (idle)`);
    }
  });

  // Handle client disconnect
  req.on("close", () => {
    if (!finished) {
      log("SSE", `[${sessionId.slice(0, 8)}] client disconnected`);
      finished = true;
      unsubscribe();
    }
  });

  try {
    const msgId = await session.send({ prompt: fullPrompt });
    log("SSE", `[${sessionId.slice(0, 8)}] send() returned msgId: ${msgId}`);
  } catch (err) {
    log("ERROR", `[${sessionId.slice(0, 8)}] send() error:`, err.message);
    if (!finished) {
      finished = true;
      sendSSE("error", { type: "error", message: err.message });
      res.end();
      unsubscribe();
    }
  }
};

// Get account quota
routes["POST /api/quota"] = async (_req, res) => {
  const c = await ensureClient();
  try {
    const result = await c.rpc.account.getQuota();
    jsonRes(res, 200, { ok: true, quota: result.quotaSnapshots || {} });
  } catch (err) {
    log("WARN", "account.getQuota not available:", err.message);
    jsonRes(res, 200, { ok: true, quota: {}, fallback: true, error: err.message });
  }
};

// List available tools (skills)
routes["POST /api/tools"] = async (req, res) => {
  const body = await readBody(req);
  const params = body ? JSON.parse(body) : {};
  const c = await ensureClient();
  try {
    const result = await c.rpc.tools.list(params.model ? { model: params.model } : {});
    jsonRes(res, 200, { ok: true, tools: result.tools || [] });
  } catch (err) {
    log("WARN", "tools.list not available:", err.message);
    jsonRes(res, 200, { ok: true, tools: [], fallback: true, error: err.message });
  }
};

// Get CLI context (aggregated status, auth, models, tools, sessions)
routes["POST /api/context"] = async (_req, res) => {
  const c = await ensureClient();
  const context = {};

  // Status (version, protocol)
  try {
    const status = await c.getStatus();
    context.status = status;
  } catch (err) {
    log("WARN", "getStatus not available:", err.message);
    context.status = { version: "unknown", protocolVersion: 0 };
  }

  // Auth
  try {
    const auth = await c.getAuthStatus();
    context.auth = auth;
  } catch (err) {
    log("WARN", "getAuthStatus not available:", err.message);
    context.auth = { isAuthenticated: false };
  }

  // Models
  try {
    const models = await c.listModels();
    context.models = models.map((m) => ({ id: m.id, name: m.name }));
  } catch (err) {
    log("WARN", "listModels not available:", err.message);
    context.models = [];
  }

  // Tools
  try {
    const result = await c.rpc.tools.list({});
    context.tools = (result.tools || []).map((t) => ({ name: t.name, description: t.description }));
  } catch (err) {
    log("WARN", "tools.list not available:", err.message);
    context.tools = [];
  }

  // Sessions (with context: cwd, gitRoot, repository, branch)
  try {
    const sessionsList = await c.listSessions();
    context.sessions = sessionsList.map((s) => ({
      sessionId: s.sessionId,
      summary: s.summary,
      context: s.context || {},
    }));
  } catch (err) {
    log("WARN", "listSessions not available:", err.message);
    context.sessions = [];
  }

  // Quota
  try {
    const result = await c.rpc.account.getQuota();
    context.quota = result.quotaSnapshots || {};
  } catch (err) {
    log("WARN", "account.getQuota not available:", err.message);
    context.quota = {};
  }

  context.sdkState = c.getState();
  jsonRes(res, 200, { ok: true, context });
};

// Get session messages
routes["POST /api/session/messages"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { sessionId } = body;

  const session = sessions.get(sessionId);
  if (!session) {
    jsonRes(res, 404, { ok: false, error: `Session ${sessionId} not found` });
    return;
  }

  const messages = await session.getMessages();
  jsonRes(res, 200, { ok: true, messages });
};

// ── HTTP Server ──
const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const routeKey = `${req.method} ${req.url?.split("?")[0]}`;
  log("HTTP", `→ ${routeKey}`);

  const handler = routes[routeKey];
  if (!handler) {
    jsonRes(res, 404, { error: `Unknown route: ${routeKey}` });
    return;
  }

  try {
    await handler(req, res);
  } catch (err) {
    log("ERROR", `${routeKey}:`, err.message);
    if (!res.headersSent) {
      jsonRes(res, 500, { ok: false, error: err.message });
    }
  }
});

server.listen(httpPort, "127.0.0.1", () => {
  log("PROXY", "");
  log("PROXY", "✦ IQ Copilot SDK Proxy");
  log("PROXY", `  HTTP API  → http://127.0.0.1:${httpPort}`);
  log("PROXY", `  CLI (SDK) → localhost:${cliPort}`);
  log("PROXY", `  Health    → http://127.0.0.1:${httpPort}/health`);
  log("PROXY", "");
  log("PROXY", "Endpoints:");
  log("PROXY", "  POST /api/ping             - Ping CLI");
  log("PROXY", "  POST /api/models           - List available models");
  log("PROXY", "  POST /api/tools            - List available tools (skills)");
  log("PROXY", "  POST /api/quota            - Get account quota");
  log("PROXY", "  POST /api/session/create   - Create session");
  log("PROXY", "  POST /api/session/send     - Send message (SSE streaming)");
  log("PROXY", "  POST /api/session/sendAndWait - Send (wait for full response)");
  log("PROXY", "  POST /api/session/list     - List sessions");
  log("PROXY", "  POST /api/session/messages - Get session messages");
  log("PROXY", "  POST /api/session/delete   - Delete session");
  log("PROXY", "  POST /api/session/destroy  - Destroy session");
  log("PROXY", "  POST /api/context          - Get CLI context (aggregated)");
  log("PROXY", "  GET  /api/mcp/config       - Read local MCP config");
  log("PROXY", "");
});
