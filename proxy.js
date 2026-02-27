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

// ── Foundry Config (runtime, default from env vars) ──
let foundryEndpoint = process.env.FOUNDRY_ENDPOINT || "";
let foundryApiKey = process.env.FOUNDRY_API_KEY || "";

// ── Secret Filtering ──
// Collect all known secret values to redact from logs
function getSecretValues() {
  return [foundryApiKey, process.env.GITHUB_TOKEN || ""]
    .filter((s) => typeof s === "string" && s.length > 0);
}

function redactSecrets(str) {
  if (typeof str !== "string") return str;
  let result = str;
  for (const secret of getSecretValues()) {
    if (secret.length >= 4 && result.includes(secret)) {
      result = result.replaceAll(secret, `***${secret.slice(-4)}`);
    }
  }
  return result;
}

// ── Logging (with secret redaction) ──
function ts() { return new Date().toISOString(); }
function log(tag, ...msg) {
  const safeMsg = msg.map((m) =>
    typeof m === "string" ? redactSecrets(m) : m
  );
  console.log(`[${ts()}] [${tag}]`, ...safeMsg);
}

// ── SDK Client ──
let client = null;
const sessions = new Map(); // sessionId → CopilotSession

async function getSessionOrResume(sessionId) {
  if (!sessionId) return null;

  const existing = sessions.get(sessionId);
  if (existing) return existing;

  try {
    const c = await ensureClient();
    const resumed = await c.resumeSession(sessionId, {
      onPermissionRequest: approveAll,
    });
    sessions.set(sessionId, resumed);
    log("SESSION", `Resumed missing in-memory session: ${sessionId}`);
    return resumed;
  } catch (err) {
    log("WARN", `Failed to resume session ${sessionId}: ${err.message}`);
    return null;
  }
}

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

const MCP_CONFIG_PATHS = [
  path.join(os.homedir(), ".copilot", "mcp-config.json"),
  path.join(os.homedir(), ".config", "github-copilot", "mcp-config.json"),
];

function loadMcpConfigFromDisk() {
  for (const p of MCP_CONFIG_PATHS) {
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const config = JSON.parse(raw);
      return { source: p, config };
    } catch {
      // try next path
    }
  }
  return { source: null, config: { mcpServers: {} } };
}

function getWritableMcpConfigPath(existingSource) {
  if (existingSource) return existingSource;
  return MCP_CONFIG_PATHS[0];
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

  if (!sessionId) {
    jsonRes(res, 400, { ok: false, error: "sessionId is required" });
    return;
  }

  if (!modelId) {
    jsonRes(res, 400, { ok: false, error: "modelId is required" });
    return;
  }

  const session = await getSessionOrResume(sessionId);
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
  const loaded = loadMcpConfigFromDisk();
  if (loaded.source) {
    log("MCP", `Loaded config from ${loaded.source}`);
  }
  jsonRes(res, 200, { ok: true, source: loaded.source, config: loaded.config });
};

// Write MCP config to local config file
routes["POST /api/mcp/config"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const config = body?.config;

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    jsonRes(res, 400, { ok: false, error: "config must be a JSON object" });
    return;
  }

  if (!config.mcpServers || typeof config.mcpServers !== "object" || Array.isArray(config.mcpServers)) {
    jsonRes(res, 400, { ok: false, error: "config.mcpServers must be an object" });
    return;
  }

  try {
    const loaded = loadMcpConfigFromDisk();
    const targetPath = getWritableMcpConfigPath(loaded.source);
    const targetDir = path.dirname(targetPath);

    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

    log("MCP", `Saved config to ${targetPath}`);
    jsonRes(res, 200, { ok: true, source: targetPath, config });
  } catch (err) {
    jsonRes(res, 500, { ok: false, error: err.message });
  }
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

  if (!sessionId) {
    jsonRes(res, 400, { ok: false, error: "sessionId is required" });
    return;
  }

  const session = await getSessionOrResume(sessionId);
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

  if (!sessionId) {
    jsonRes(res, 400, { ok: false, error: "sessionId is required" });
    return;
  }

  const session = await getSessionOrResume(sessionId);
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

  // Foundry status (configured or not — never expose the key itself)
  context.foundry = {
    configured: !!(foundryEndpoint && foundryApiKey),
    endpoint: foundryEndpoint || null,
  };

  jsonRes(res, 200, { ok: true, context });
};

// ── Foundry Proxy ──
// Update Foundry runtime config (endpoint in local storage, key in session storage via extension)
routes["POST /api/foundry/config"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));

  if (typeof body.endpoint === "string") {
    foundryEndpoint = body.endpoint.trim();
  }

  if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    foundryApiKey = body.apiKey.trim();
  }

  if (body.clearApiKey === true) {
    foundryApiKey = "";
  }

  jsonRes(res, 200, {
    ok: true,
    configured: !!(foundryEndpoint && foundryApiKey),
    endpoint: foundryEndpoint || null,
  });
};

// Proxies chat completion requests to Azure Foundry so the extension never sees the API key.
routes["POST /api/foundry/chat"] = async (req, res) => {
  if (!foundryEndpoint || !foundryApiKey) {
    jsonRes(res, 400, { ok: false, error: "Foundry not configured. Set FOUNDRY_ENDPOINT and FOUNDRY_API_KEY env vars." });
    return;
  }

  const body = await readBody(req);
  const url = `${foundryEndpoint.replace(/\/$/, "")}/chat/completions?api-version=2024-12-01-preview`;
  log("FOUNDRY", `→ POST ${url.split("?")[0]}`);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": foundryApiKey,
      },
      body,
    });

    const result = await upstream.json();
    if (!upstream.ok) {
      log("FOUNDRY", `← HTTP ${upstream.status}:`, JSON.stringify(result));
      jsonRes(res, upstream.status, { ok: false, error: result?.error?.message || `HTTP ${upstream.status}` });
      return;
    }

    log("FOUNDRY", `← OK (model: ${result?.model || "unknown"})`);
    jsonRes(res, 200, { ok: true, ...result });
  } catch (err) {
    log("FOUNDRY", "Error:", err.message);
    jsonRes(res, 502, { ok: false, error: err.message });
  }
};

// Foundry status check (no secrets exposed)
routes["GET /api/foundry/status"] = async (_req, res) => {
  const configured = !!(foundryEndpoint && foundryApiKey);
  jsonRes(res, 200, { ok: true, configured, endpoint: foundryEndpoint || null });
};

// Get session messages
routes["POST /api/session/messages"] = async (req, res) => {
  const body = JSON.parse(await readBody(req));
  const { sessionId } = body;

  if (!sessionId) {
    jsonRes(res, 400, { ok: false, error: "sessionId is required" });
    return;
  }

  const session = await getSessionOrResume(sessionId);
  if (!session) {
    jsonRes(res, 404, { ok: false, error: `Session ${sessionId} not found` });
    return;
  }

  const messages = await session.getMessages();
  jsonRes(res, 200, { ok: true, messages });
};

// ── Proactive Agent ──
// Dedicated session for background proactive scans
let proactiveSession = null;
let proactiveConfig = {
  workiqPrompt: "",
};

function withWorkIqPrompt(lines) {
  const customPrompt = (proactiveConfig.workiqPrompt || "").trim();
  if (!customPrompt) return lines;
  return [...lines, `Additional user guidance for WorkIQ: ${customPrompt}`];
}

routes["GET /api/proactive/config"] = async (_req, res) => {
  jsonRes(res, 200, { ok: true, config: { ...proactiveConfig } });
};

routes["POST /api/proactive/config"] = async (req, res) => {
  const body = JSON.parse(await readBody(req) || "{}");
  const nextPrompt = typeof body.workiqPrompt === "string" ? body.workiqPrompt : "";
  proactiveConfig = { workiqPrompt: nextPrompt };
  proactiveSession = null;
  jsonRes(res, 200, { ok: true, config: { ...proactiveConfig } });
};

async function ensureProactiveSession() {
  if (proactiveSession) return proactiveSession;
  const c = await ensureClient();
  const customPrompt = (proactiveConfig.workiqPrompt || "").trim();
  const customPromptLine = customPrompt
    ? `Additional user guidance for WorkIQ: ${customPrompt}`
    : "";
  proactiveSession = await c.createSession({
    model: "gpt-4.1",
    systemMessage: {
      content: [
        "You are a Proactive Agent for IQ Copilot. Your job is to analyze the user's M365 data (Email, Calendar, Tasks, Teams) and generate structured insights.",
        "ALWAYS respond with valid JSON only. No markdown, no explanation outside the JSON.",
        "You have access to WorkIQ / M365 Graph tools. Use them to fetch real data when available.",
        "If tools are not available, generate realistic mock data so the UI can still demonstrate the feature.",
        "When generating mock data, make it realistic — use real-looking names, dates within the next 7 days, and plausible subjects.",
        customPromptLine,
      ].join(" "),
    },
    onPermissionRequest: approveAll,
  });
  sessions.set(proactiveSession.sessionId, proactiveSession);
  log("PROACTIVE", `Created proactive session: ${proactiveSession.sessionId}`);
  return proactiveSession;
}

// Daily Briefing (Idea 1)
routes["POST /api/proactive/briefing"] = async (_req, res) => {
  log("PROACTIVE", "Generating daily briefing...");
  try {
    const session = await ensureProactiveSession();
    const prompt = withWorkIqPrompt([
      "Generate a daily briefing for today. Return JSON with this exact structure:",
      "{",
      '  "emails": [{ "from": "sender name", "subject": "subject line", "age": "2h ago", "priority": "high|medium|low", "snippet": "preview text..." }],',
      '  "meetings": [{ "time": "09:00", "title": "meeting title", "attendees": ["name1", "name2"], "location": "room/link" }],',
      '  "tasks": [{ "title": "task name", "due": "today|tomorrow|3 days", "status": "pending|overdue", "source": "Planner|To-Do" }],',
      '  "mentions": [{ "from": "person", "channel": "team/channel", "message": "snippet...", "time": "1h ago" }]',
      "}",
      "Use WorkIQ tools to fetch real data if available. If not, generate 3-5 realistic items per category based on a typical enterprise work day.",
    ]).join("\n");

    const result = await session.sendAndWait({ prompt });
    const content = result?.data?.content ?? "";
    log("PROACTIVE", `Briefing response: ${content.slice(0, 200)}...`);

    // Try to parse JSON from the response
    const json = extractJson(content);
    jsonRes(res, 200, { ok: true, data: json, raw: content });
  } catch (err) {
    log("ERROR", "Briefing error:", err.message);
    jsonRes(res, 500, { ok: false, error: err.message });
  }
};

// Deadline Hawk (Idea 2)
routes["POST /api/proactive/deadlines"] = async (_req, res) => {
  log("PROACTIVE", "Scanning for deadlines...");
  try {
    const session = await ensureProactiveSession();
    const prompt = withWorkIqPrompt([
      "Scan the user's email and calendar for upcoming deadlines, due dates, expense reports, and submission dates. Return JSON:",
      "{",
      '  "deadlines": [{ "title": "what is due", "date": "YYYY-MM-DD", "daysLeft": number, "source": "email|calendar|task", "sourceDetail": "from: sender / event name", "urgency": "critical|warning|normal", "snippet": "context..." }]',
      "}",
      "Include expense reports, approvals, submissions, reviews, and any time-sensitive items.",
      "Sort by daysLeft ascending (most urgent first).",
      "Use WorkIQ tools to fetch real data if available. If not, generate 4-6 realistic deadlines within the next 14 days.",
    ]).join("\n");

    const result = await session.sendAndWait({ prompt });
    const content = result?.data?.content ?? "";
    const json = extractJson(content);
    jsonRes(res, 200, { ok: true, data: json, raw: content });
  } catch (err) {
    log("ERROR", "Deadlines error:", err.message);
    jsonRes(res, 500, { ok: false, error: err.message });
  }
};

// Ghost Detector (Idea 4)
routes["POST /api/proactive/ghosts"] = async (_req, res) => {
  log("PROACTIVE", "Detecting unreplied emails...");
  try {
    const session = await ensureProactiveSession();
    const prompt = withWorkIqPrompt([
      "Find emails in the user's inbox that they haven't replied to yet and probably should. Return JSON:",
      "{",
      '  "ghosts": [{ "from": "sender name", "subject": "email subject", "receivedAt": "2 days ago", "priority": "critical|high|medium", "reason": "客戶信件|主管要求|內部請求|HR|需要確認", "snippet": "preview of the email..." }]',
      "}",
      "Prioritize: customer emails > manager requests > internal requests > HR > FYI.",
      "Only include emails older than 4 hours that likely need a response.",
      "Use WorkIQ tools to fetch real data if available. If not, generate 3-5 realistic unreplied emails.",
    ]).join("\n");

    const result = await session.sendAndWait({ prompt });
    const content = result?.data?.content ?? "";
    const json = extractJson(content);
    jsonRes(res, 200, { ok: true, data: json, raw: content });
  } catch (err) {
    log("ERROR", "Ghosts error:", err.message);
    jsonRes(res, 500, { ok: false, error: err.message });
  }
};

// Meeting Prep (Idea 3)
routes["POST /api/proactive/meeting-prep"] = async (_req, res) => {
  log("PROACTIVE", "Preparing meeting context...");
  try {
    const session = await ensureProactiveSession();
    const prompt = withWorkIqPrompt([
      "Find the user's next upcoming meeting (within 2 hours or the next one today) and prepare a briefing. Return JSON:",
      "{",
      '  "meeting": { "title": "meeting name", "time": "HH:MM", "duration": "30 min", "location": "room/link" },',
      '  "attendees": [{ "name": "person name", "role": "title/department", "notes": "relevant context" }],',
      '  "relatedDocs": [{ "name": "doc name", "type": "pptx|docx|xlsx", "url": "sharepoint url", "relevance": "why this doc is relevant" }],',
      '  "recentChats": [{ "channel": "team/channel", "summary": "what was discussed", "time": "yesterday" }],',
      '  "actionItems": [{ "item": "what you promised", "from": "which meeting", "date": "when" }]',
      "}",
      "Use WorkIQ tools to fetch real data if available. If not, generate realistic meeting prep data.",
    ]).join("\n");

    const result = await session.sendAndWait({ prompt });
    const content = result?.data?.content ?? "";
    const json = extractJson(content);
    jsonRes(res, 200, { ok: true, data: json, raw: content });
  } catch (err) {
    log("ERROR", "Meeting prep error:", err.message);
    jsonRes(res, 500, { ok: false, error: err.message });
  }
};

// Run all proactive scans at once
routes["POST /api/proactive/scan-all"] = async (_req, res) => {
  log("PROACTIVE", "Running full proactive scan...");
  const results = {};

  const scanOne = async (name, path) => {
    try {
      const response = await fetch(`http://127.0.0.1:${httpPort}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      results[name] = await response.json();
    } catch (err) {
      results[name] = { ok: false, error: err.message };
    }
  };

  // Run sequentially to avoid overwhelming the session
  await scanOne("briefing", "/api/proactive/briefing");
  await scanOne("deadlines", "/api/proactive/deadlines");
  await scanOne("ghosts", "/api/proactive/ghosts");
  await scanOne("meetingPrep", "/api/proactive/meeting-prep");

  jsonRes(res, 200, { ok: true, results, scannedAt: new Date().toISOString() });
};

// Helper: extract JSON from LLM response (handles markdown code blocks)
function extractJson(text) {
  if (!text) return {};
  // Try direct parse
  try { return JSON.parse(text); } catch {}
  // Try extracting from ```json ... ``` blocks
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }
  // Try finding first { ... } block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return { _raw: text, _parseError: true };
}

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
  log("PROXY", "  POST /api/foundry/config   - Set Foundry runtime config");
  log("PROXY", "  POST /api/foundry/chat     - Proxy Foundry chat completion");
  log("PROXY", "  GET  /api/foundry/status   - Foundry configuration status");
  log("PROXY", "  GET  /api/mcp/config       - Read local MCP config");
  log("PROXY", "  POST /api/mcp/config       - Save local MCP config");
  log("PROXY", "");
  log("PROXY", "Proactive Agent:");
  log("PROXY", "  POST /api/proactive/briefing     - Daily briefing");
  log("PROXY", "  POST /api/proactive/deadlines     - Deadline tracking");
  log("PROXY", "  POST /api/proactive/ghosts        - Unreplied email detection");
  log("PROXY", "  POST /api/proactive/meeting-prep  - Meeting preparation");
  log("PROXY", "  POST /api/proactive/scan-all      - Run all scans");
  log("PROXY", "");
});
