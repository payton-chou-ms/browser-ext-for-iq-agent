// ===== IQ Copilot SDK Proxy =====
// HTTP server that bridges the browser extension to Copilot CLI via the official SDK.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { CopilotClient, approveAll, type CopilotSession } from "@github/copilot-sdk";
import type { Attachment, FoundryState, ProactiveConfig, RouteTable } from "./shared/types.js";
import { registerCoreRoutes } from "./routes/core.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerFoundryRoutes } from "./routes/foundry.js";
import { registerProactiveRoutes } from "./routes/proactive.js";
import { registerWorkiqRoutes } from "./routes/workiq.js";
import { readBody, readJsonBody as readJsonBodyInternal } from "./lib/proxy-body.js";
import { resolveProactiveWorkIqResult } from "./lib/proactive-workiq.js";
import { withWorkIqExecutionMeta } from "./lib/workiq-execution.js";
import {
  buildBriefingPrompt,
  buildDeadlinesPrompt,
  buildGhostsPrompt,
  buildMeetingPrepPrompt,
} from "./lib/proactive-prompts.js";

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

async function readJsonBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: { schema?: { safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: { issues: Array<{ path: Array<string | number>; message: string; code: string }> } } }; allowEmpty?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  return await readJsonBodyInternal(req, res, jsonRes, options);
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

const TEMP_FILE_TTL_MS = Number(process.env.UPLOAD_TEMP_TTL_MS || 24 * 60 * 60 * 1000);
const TEMP_MAX_TOTAL_BYTES = Number(process.env.UPLOAD_TEMP_MAX_TOTAL_BYTES || 200 * 1024 * 1024);
const TEMP_MAX_FILE_COUNT = Number(process.env.UPLOAD_TEMP_MAX_FILE_COUNT || 200);
const TEMP_CLEANUP_INTERVAL_MS = Number(process.env.UPLOAD_TEMP_CLEANUP_INTERVAL_MS || 60 * 1000);
let lastTempCleanupAt = 0;

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanupTempUploads(force = false): void {
  const now = Date.now();
  if (!force && now - lastTempCleanupAt < TEMP_CLEANUP_INTERVAL_MS) return;
  lastTempCleanupAt = now;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(TEMP_DIR, { withFileTypes: true });
  } catch (err) {
    log("WARN", `Temp cleanup skipped: ${(err as Error).message}`);
    return;
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fullPath = path.join(TEMP_DIR, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        fullPath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs);

  if (files.length === 0) return;

  const expired = files.filter((file) => now - file.mtimeMs > TEMP_FILE_TTL_MS);
  let removed = 0;
  let reclaimedBytes = 0;

  for (const file of expired) {
    try {
      fs.unlinkSync(file.fullPath);
      removed += 1;
      reclaimedBytes += file.size;
    } catch {
      // best effort cleanup
    }
  }

  const remainingFiles = files.filter((file) => now - file.mtimeMs <= TEMP_FILE_TTL_MS);
  let totalBytes = remainingFiles.reduce((sum, file) => sum + file.size, 0);
  let totalCount = remainingFiles.length;

  for (const file of remainingFiles) {
    if (totalCount <= TEMP_MAX_FILE_COUNT && totalBytes <= TEMP_MAX_TOTAL_BYTES) break;
    try {
      fs.unlinkSync(file.fullPath);
      removed += 1;
      reclaimedBytes += file.size;
      totalBytes -= file.size;
      totalCount -= 1;
    } catch {
      // best effort cleanup
    }
  }

  if (removed > 0) {
    log(
      "FILE",
      `Temp cleanup removed ${removed} file(s), reclaimed ${formatBytes(reclaimedBytes)} (ttl=${TEMP_FILE_TTL_MS}ms maxFiles=${TEMP_MAX_FILE_COUNT} maxBytes=${formatBytes(TEMP_MAX_TOTAL_BYTES)})`
    );
  }
}

function saveTempFile(file: Attachment): string {
  cleanupTempUploads();
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

let proactiveConfig: ProactiveConfig = {
  workiqPrompt: "",
  model: process.env.PROACTIVE_MODEL || "gpt-4.1",
};

async function runProactiveBriefing(promptOverride = "") {
  const prompt = buildBriefingPrompt({
    customPrompt: proactiveConfig.workiqPrompt,
    promptOverride,
  });

  const resolved = await resolveProactiveWorkIqResult({
    kind: "briefing",
    prompt,
    promptOverride,
    execFile,
    log,
  });
  log("PROACTIVE", `Briefing response: ${resolved.content.slice(0, 200)}...`);
  return withWorkIqExecutionMeta({ ok: true, data: resolved.data, raw: resolved.content }, resolved.meta);
}

async function runProactiveDeadlines(promptOverride = "") {
  const prompt = buildDeadlinesPrompt({
    customPrompt: proactiveConfig.workiqPrompt,
    promptOverride,
  });

  const resolved = await resolveProactiveWorkIqResult({
    kind: "deadlines",
    prompt,
    execFile,
    log,
  });
  return withWorkIqExecutionMeta({ ok: true, data: resolved.data, raw: resolved.content }, resolved.meta);
}

async function runProactiveGhosts(promptOverride = "") {
  const prompt = buildGhostsPrompt({
    customPrompt: proactiveConfig.workiqPrompt,
    promptOverride,
  });

  const resolved = await resolveProactiveWorkIqResult({
    kind: "ghosts",
    prompt,
    execFile,
    log,
  });
  return withWorkIqExecutionMeta({ ok: true, data: resolved.data, raw: resolved.content }, resolved.meta);
}

async function runProactiveMeetingPrep(promptOverride = "") {
  const prompt = buildMeetingPrepPrompt({
    customPrompt: proactiveConfig.workiqPrompt,
    promptOverride,
  });

  const resolved = await resolveProactiveWorkIqResult({
    kind: "meeting-prep",
    prompt,
    execFile,
    log,
  });
  return withWorkIqExecutionMeta({ ok: true, data: resolved.data, raw: resolved.content }, resolved.meta);
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

cleanupTempUploads(true);

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
  execFile,
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
  loadMcpConfigFromDisk,
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
    runBriefing: (promptOverride?: string) => runProactiveBriefing(promptOverride || ""),
    runDeadlines: (promptOverride?: string) => runProactiveDeadlines(promptOverride || ""),
    runGhosts: (promptOverride?: string) => runProactiveGhosts(promptOverride || ""),
    runMeetingPrep: (promptOverride?: string) => runProactiveMeetingPrep(promptOverride || ""),
  },
});

registerWorkiqRoutes(routes, {
  ensureClient,
  getSessionOrResume,
  sessions,
  jsonRes,
  readJsonBody,
  log,
  execFile,
  loadMcpConfigFromDisk,
});

// Serve local images generated by gen-img skill
routes["GET /api/image"] = async (req, res) => {
  const url = new URL(req.url || "", `http://127.0.0.1:${httpPort}`);
  const filePath = url.searchParams.get("path");
  
  if (!filePath) {
    jsonRes(res, 400, { ok: false, error: "Missing path parameter" });
    return;
  }
  
  // Security: only allow serving from output directory
  const outputDir = path.resolve(process.cwd(), "output");
  const resolvedPath = path.resolve(filePath);
  
  if (!resolvedPath.startsWith(outputDir)) {
    jsonRes(res, 403, { ok: false, error: "Access denied: path outside output directory" });
    return;
  }
  
  if (!fs.existsSync(resolvedPath)) {
    jsonRes(res, 404, { ok: false, error: "File not found" });
    return;
  }
  
  try {
    const imageBuffer = fs.readFileSync(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": imageBuffer.length,
      "Cache-Control": "public, max-age=3600",
    });
    res.end(imageBuffer);
    log("IMAGE", `Served: ${path.basename(resolvedPath)} (${imageBuffer.length} bytes)`);
  } catch (err) {
    jsonRes(res, 500, { ok: false, error: (err as Error).message });
  }
};

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
