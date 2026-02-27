#!/usr/bin/env node
// ===== IQ Copilot SDK Proxy =====
// HTTP server that bridges the browser extension to Copilot CLI via the official SDK.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { CopilotClient, approveAll, type CopilotSession } from "@github/copilot-sdk";
import type { Attachment, FoundryState, ProactiveConfig, RouteTable } from "./shared/types.js";
import { registerCoreRoutes } from "./routes/core.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerFoundryRoutes } from "./routes/foundry.js";
import { registerProactiveRoutes } from "./routes/proactive.js";

// ===== Body Size Limits (B3) =====
const MAX_BODY_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_JSON_BODY_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const args = process.argv.slice(2);
function getArg(name: string, fallback: string) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : fallback;
}

const cliPort = parseInt(getArg("--cli-port", "4321") ?? "4321", 10);
const httpPort = parseInt(getArg("--http-port", "8321") ?? "8321", 10);

let foundryEndpoint = process.env.FOUNDRY_ENDPOINT || "";
let foundryApiKey = process.env.FOUNDRY_API_KEY || "";

function getSecretValues() {
  return [foundryApiKey, process.env.GITHUB_TOKEN || ""]
    .filter((secret) => typeof secret === "string" && secret.length > 0);
}

function redactSecrets(str: string): string {
  if (typeof str !== "string") return str;
  let result = str;
  for (const secret of getSecretValues()) {
    if (secret.length >= 4 && result.includes(secret)) {
      result = result.replaceAll(secret, `***${secret.slice(-4)}`);
    }
  }
  return result;
}

function ts() {
  return new Date().toISOString();
}

function log(tag: string, ...msg: unknown[]): void {
  const safeMsg = msg.map((value) => (typeof value === "string" ? redactSecrets(value) : value));
  console.log(`[${ts()}] [${tag}]`, ...safeMsg);
}

let client: CopilotClient | null = null;
const sessions = new Map<string, CopilotSession>();

async function ensureClient() {
  if (client && client.getState() === "connected") return client;

  log("SDK", `Connecting to CLI at localhost:${cliPort}...`);
  client = new CopilotClient({ cliUrl: `localhost:${cliPort}` });
  await client.start();
  log("SDK", `Connected! State: ${client.getState()}`);
  return client;
}

function getClientState() {
  return client ? client.getState() : "not-initialized";
}

async function getSessionOrResume(sessionId: string): Promise<CopilotSession | null> {
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
  } catch (err: unknown) {
    log("WARN", `Failed to resume session ${sessionId}: ${(err as Error).message}`);
    return null;
  }
}

function cors(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function jsonRes(res: http.ServerResponse, status: number, data: unknown): void {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage, maxSize = MAX_BODY_SIZE_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", (chunk: Buffer | string) => {
      size += Buffer.byteLength(chunk);
      if (size > maxSize) {
        req.destroy();
        reject(new Error(`Request body too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`));
        return;
      }
      body += chunk;
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function formatZodError(error: { issues: Array<{ path: Array<string | number>; message: string; code: string }> }) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

async function readJsonBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: { schema?: { safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: { issues: Array<{ path: Array<string | number>; message: string; code: string }> } } }; allowEmpty?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  const { schema, allowEmpty = false } = options;

  let raw: string;
  try {
    raw = await readBody(req, MAX_JSON_BODY_SIZE_BYTES);
  } catch (err) {
    jsonRes(res, 413, { ok: false, error: (err as Error).message });
    return null;
  }

  if (!raw || !raw.trim()) {
    if (!allowEmpty) {
      jsonRes(res, 400, { ok: false, error: "Request body is required" });
      return null;
    }

    if (!schema) return {};
    const emptyParsed = schema.safeParse({});
    if (!emptyParsed.success) {
      jsonRes(res, 400, { ok: false, error: "Invalid request body", details: formatZodError(emptyParsed.error!) });
      return null;
    }
    return emptyParsed.data as Record<string, unknown>;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    jsonRes(res, 400, { ok: false, error: `Invalid JSON: ${(err as Error).message}` });
    return null;
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    jsonRes(res, 400, { ok: false, error: "Request body must be a JSON object" });
    return null;
  }

  if (!schema) return parsed;

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    jsonRes(res, 400, {
      ok: false,
      error: "Invalid request body",
      details: formatZodError(validated.error!),
    });
    return null;
  }

  return validated.data as Record<string, unknown>;
}

const MCP_CONFIG_PATHS = [
  path.join(os.homedir(), ".copilot", "mcp-config.json"),
  path.join(os.homedir(), ".config", "github-copilot", "mcp-config.json"),
];

function loadMcpConfigFromDisk() {
  for (const configPath of MCP_CONFIG_PATHS) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw);
      return { source: configPath, config };
    } catch {
      // config file not found or invalid — try next
    }
  }
  return { source: null, config: { mcpServers: {} } };
}

function getWritableMcpConfigPath(existingSource: string | null): string {
  if (existingSource) return existingSource;
  return MCP_CONFIG_PATHS[0]!;
}

const TEMP_DIR = path.join(os.tmpdir(), "iq-copilot-uploads");
fs.mkdirSync(TEMP_DIR, { recursive: true });

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function saveTempFile(file: Attachment): string {
  const base64 = file.dataUrl?.split(",")[1] || "";
  const buf = Buffer.from(base64, "base64");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const tempPath = path.join(TEMP_DIR, `${Date.now()}_${safeName}`);
  fs.writeFileSync(tempPath, buf);
  log("FILE", `Saved attachment: ${file.name} → ${tempPath} (${formatBytes(buf.length)})`);
  return tempPath;
}

function buildPromptWithAttachments(prompt: string, attachments: readonly Attachment[]): string {
  if (!attachments || attachments.length === 0) return prompt;

  const parts = [];
  for (const file of attachments) {
    if (file.textContent) {
      parts.push(`<file name="${file.name}" type="${file.type}">\n${file.textContent}\n</file>`);
      continue;
    }

    if (file.dataUrl) {
      const tempPath = saveTempFile(file);
      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

      if (isPdf) {
        parts.push(`<file name="${file.name}" type="${file.type}" path="${tempPath}">\n[PDF saved to: ${tempPath}]\nThe user attached a PDF file. You can read it using bash tools, e.g.:\n  strings "${tempPath}" | head -200\nor any other command to extract text from the PDF.\n</file>`);
      } else if (file.isImage) {
        parts.push(`<file name="${file.name}" type="${file.type}" path="${tempPath}">\n[Image saved to: ${tempPath}]\nYou can view or analyze this image file at the path above.\n</file>`);
      } else {
        parts.push(`<file name="${file.name}" type="${file.type}" path="${tempPath}">\n[File saved to: ${tempPath}]\n</file>`);
      }
    }
  }

  if (parts.length === 0) return prompt;
  return `${parts.join("\n\n")}\n\n${prompt}`;
}

let proactiveSession: CopilotSession | null = null;
let proactiveConfig: ProactiveConfig = {
  workiqPrompt: "",
  model: process.env.PROACTIVE_MODEL || "gpt-4.1",
};

function extractJson(text: string): Record<string, unknown> {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    // not valid JSON — try other formats
  }

  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]!);
    } catch {
      // code block content not valid JSON
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // extracted substring not valid JSON
    }
  }

  return { _raw: text, _parseError: true };
}

function withWorkIqPrompt(lines: string[]): string[] {
  const customPrompt = (proactiveConfig.workiqPrompt || "").trim();
  if (!customPrompt) return lines;
  return [...lines, `Additional user guidance for WorkIQ: ${customPrompt}`];
}

function invalidateProactiveSession(reason = "") {
  if (proactiveSession?.sessionId) {
    sessions.delete(proactiveSession.sessionId);
    log("PROACTIVE", `Invalidated proactive session${reason ? ` (${reason})` : ""}: ${proactiveSession.sessionId}`);
  }
  proactiveSession = null;
}

async function ensureProactiveSession() {
  if (proactiveSession) return proactiveSession;

  const c = await ensureClient();
  const customPrompt = (proactiveConfig.workiqPrompt || "").trim();
  const customPromptLine = customPrompt ? `Additional user guidance for WorkIQ: ${customPrompt}` : "";

  proactiveSession = await c.createSession({
    model: proactiveConfig.model || "gpt-4.1",
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

async function sendProactivePrompt(prompt: string) {
  let attempt = 0;
  while (attempt < 2) {
    try {
      const session = await ensureProactiveSession();
      return await session.sendAndWait({ prompt });
    } catch (err: unknown) {
      attempt += 1;
      log("WARN", `Proactive send failed (attempt ${attempt}): ${(err as Error).message}`);
      invalidateProactiveSession("stale or failed");
      if (attempt >= 2) throw err;
    }
  }
  throw new Error("Proactive send failed");
}

async function runProactiveBriefing() {
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

  const result = await sendProactivePrompt(prompt);
  const content = result?.data?.content ?? "";
  log("PROACTIVE", `Briefing response: ${content.slice(0, 200)}...`);
  return { ok: true, data: extractJson(content), raw: content };
}

async function runProactiveDeadlines() {
  const prompt = withWorkIqPrompt([
    "Scan the user's email and calendar for upcoming deadlines, due dates, expense reports, and submission dates. Return JSON:",
    "{",
    '  "deadlines": [{ "title": "what is due", "date": "YYYY-MM-DD", "daysLeft": number, "source": "email|calendar|task", "sourceDetail": "from: sender / event name", "urgency": "critical|warning|normal", "snippet": "context..." }]',
    "}",
    "Include expense reports, approvals, submissions, reviews, and any time-sensitive items.",
    "Sort by daysLeft ascending (most urgent first).",
    "Use WorkIQ tools to fetch real data if available. If not, generate 4-6 realistic deadlines within the next 14 days.",
  ]).join("\n");

  const result = await sendProactivePrompt(prompt);
  const content = result?.data?.content ?? "";
  return { ok: true, data: extractJson(content), raw: content };
}

async function runProactiveGhosts() {
  const prompt = withWorkIqPrompt([
    "Find emails in the user's inbox that they haven't replied to yet and probably should. Return JSON:",
    "{",
    '  "ghosts": [{ "from": "sender name", "subject": "email subject", "receivedAt": "2 days ago", "priority": "critical|high|medium", "reason": "客戶信件|主管要求|內部請求|HR|需要確認", "snippet": "preview of the email..." }]',
    "}",
    "Prioritize: customer emails > manager requests > internal requests > HR > FYI.",
    "Only include emails older than 4 hours that likely need a response.",
    "Use WorkIQ tools to fetch real data if available. If not, generate 3-5 realistic unreplied emails.",
  ]).join("\n");

  const result = await sendProactivePrompt(prompt);
  const content = result?.data?.content ?? "";
  return { ok: true, data: extractJson(content), raw: content };
}

async function runProactiveMeetingPrep() {
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

  const result = await sendProactivePrompt(prompt);
  const content = result?.data?.content ?? "";
  return { ok: true, data: extractJson(content), raw: content };
}

function getFoundryState() {
  return { endpoint: foundryEndpoint, apiKey: foundryApiKey };
}

function setFoundryState(next: FoundryState): void {
  foundryEndpoint = next.endpoint ?? foundryEndpoint;
  foundryApiKey = next.apiKey ?? foundryApiKey;
}

function getFoundrySnapshot() {
  return {
    configured: !!(foundryEndpoint && foundryApiKey),
    endpoint: foundryEndpoint || null,
  };
}

const routes: RouteTable = {};

registerCoreRoutes(routes, {
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
});

registerSessionRoutes(routes, {
  ensureClient,
  getSessionOrResume,
  sessions,
  jsonRes,
  readJsonBody,
  log,
  buildPromptWithAttachments,
  cors,
});

registerFoundryRoutes(routes, {
  jsonRes,
  readJsonBody,
  readBody,
  log,
  getFoundryState,
  setFoundryState,
  getFoundrySnapshot,
});

registerProactiveRoutes(routes, {
  jsonRes,
  readJsonBody,
  log,
  proactive: {
    getConfig: () => ({ ...proactiveConfig }),
    setConfig: (next: ProactiveConfig) => {
      proactiveConfig = { ...next };
    },
    invalidateSession: (reason: string) => invalidateProactiveSession(reason),
    runBriefing: () => runProactiveBriefing(),
    runDeadlines: () => runProactiveDeadlines(),
    runGhosts: () => runProactiveGhosts(),
    runMeetingPrep: () => runProactiveMeetingPrep(),
  },
});

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
  } catch (err: unknown) {
    log("ERROR", `${routeKey}:`, (err as Error).message);
    if (!res.headersSent) {
      jsonRes(res, 500, { ok: false, error: (err as Error).message });
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
  log("PROXY", "  POST /api/ping                - Ping CLI");
  log("PROXY", "  POST /api/models              - List available models");
  log("PROXY", "  POST /api/tools               - List available tools (skills)");
  log("PROXY", "  POST /api/quota               - Get account quota");
  log("PROXY", "  POST /api/session/create      - Create session");
  log("PROXY", "  POST /api/session/send        - Send message (SSE streaming)");
  log("PROXY", "  POST /api/session/sendAndWait - Send (wait for full response)");
  log("PROXY", "  POST /api/session/list        - List sessions");
  log("PROXY", "  POST /api/session/messages    - Get session messages");
  log("PROXY", "  POST /api/session/delete      - Delete session");
  log("PROXY", "  POST /api/session/destroy     - Destroy session");
  log("PROXY", "  POST /api/context             - Get CLI context (aggregated)");
  log("PROXY", "  POST /api/foundry/config      - Set Foundry runtime config");
  log("PROXY", "  POST /api/foundry/chat        - Proxy Foundry chat completion");
  log("PROXY", "  GET  /api/foundry/status      - Foundry configuration status");
  log("PROXY", "  GET  /api/mcp/config          - Read local MCP config");
  log("PROXY", "  POST /api/mcp/config          - Save local MCP config");
  log("PROXY", "");
  log("PROXY", "Proactive Agent:");
  log("PROXY", "  POST /api/proactive/briefing     - Daily briefing");
  log("PROXY", "  POST /api/proactive/deadlines    - Deadline tracking");
  log("PROXY", "  POST /api/proactive/ghosts       - Unreplied email detection");
  log("PROXY", "  POST /api/proactive/meeting-prep - Meeting preparation");
  log("PROXY", "  POST /api/proactive/scan-all     - Run all scans");
  log("PROXY", "");
});
