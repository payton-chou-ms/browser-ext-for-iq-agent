export type RarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface RarityInfo {
  readonly label: string;
  readonly color: string;
}

export interface TrackableEventDef {
  readonly xp: number;
  readonly counters: readonly string[];
}

export interface AchievementCatalogEntry {
  readonly name: string;
  readonly icon: string;
  readonly desc: string;
  readonly rarity: RarityKey;
  readonly category: string;
  readonly hidden?: boolean;
}

export interface AchievementDetail extends AchievementCatalogEntry {
  readonly id: string;
  readonly xpBonus: number;
  readonly rarityInfo: RarityInfo;
}

export interface ThresholdRule {
  readonly id: string;
  readonly counter: string;
  readonly threshold: number;
  readonly xpBonus: number;
  readonly type?: undefined;
  readonly check?: undefined;
}

export interface CustomRule {
  readonly id: string;
  readonly type: "custom";
  readonly check: string;
  readonly xpBonus: number;
  readonly counter?: undefined;
  readonly threshold?: undefined;
}

export type AchievementRule = ThresholdRule | CustomRule;

export interface AchievementProgress {
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  target: number;
}

export interface Profile {
  level: number;
  xp: number;
  title: string;
  createdAt: string;
}

export interface Counters {
  totalMessages: number;
  totalAgentCalls: number;
  totalTasks: number;
  totalMcpCalls: number;
  totalSkillsUsed: string[];
  totalContextSites: number;
  totalSessions: number;
  totalProactiveBriefings: number;
  totalDeadlinesAvoided: number;
  totalMeetingsPrepped: number;
  totalGhostReplies: number;
  totalFileUploads: number;
  panelsVisited: string[];
  agentTypesUsed: string[];
  dailyAgentCalls: Record<string, number>;
  briefingDays: string[];
  // Custom achievement flags
  ghostsCleared?: boolean;
  allProactiveUsed?: boolean;
}

export interface Streaks {
  currentDays: number;
  longestDays: number;
  lastActiveDate: string | null;
}

export interface HistoryEntry {
  type: string;
  at: string;
  [key: string]: unknown;
}

export interface Settings {
  notifications: boolean;
  showToast: boolean;
  soundEnabled: boolean;
}

export interface EngineState {
  version: string;
  profile: Profile;
  achievements: Record<string, AchievementProgress>;
  counters: Counters;
  streaks: Streaks;
  history: HistoryEntry[];
  settings: Settings;
}

export interface EngineEvent {
  type: string;
  [key: string]: unknown;
}

export type EngineEventCallback = (event: EngineEvent) => void;

export type AchievementListItem = AchievementCatalogEntry & AchievementProgress & {
  readonly id: string;
  readonly xpBonus: number;
  readonly target: number;
  readonly rarityInfo: RarityInfo;
};

export interface Attachment {
  readonly name: string;
  readonly type: string;
  readonly size?: number;
  readonly dataUrl?: string | null;
  readonly textContent?: string | null;
  readonly isImage?: boolean;
}

export interface FoundryState {
  endpoint?: string;
  apiKey?: string;
}

export interface ProactiveConfig {
  workiqPrompt: string;
  model: string;
}

export interface WorkIqExecutionMeta {
  toolUsed: string;
  unavailable: boolean;
  liveDataConfirmed: boolean;
  liveDataSource: "none" | "skill";
}

export interface ProactiveExecutionResponse {
  ok: boolean;
  data?: Record<string, unknown>;
  raw?: string;
  error?: string;
  meta?: WorkIqExecutionMeta;
  toolUsed?: string;
  unavailable?: boolean;
  liveDataConfirmed?: boolean;
  liveDataSource?: "none" | "skill";
}

// ===== Route Handler Types =====

import type http from "node:http";
import type fs from "node:fs";
import type path from "node:path";
import type child_process from "node:child_process";
import type { CopilotSession, CopilotClient } from "@github/copilot-sdk";

export type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => Promise<void> | void;

export type RouteTable = Record<string, RouteHandler>;

export type LogFn = (tag: string, ...msg: unknown[]) => void;
export type JsonResFn = (res: http.ServerResponse, status: number, data: unknown) => void;
export type CorsFn = (res: http.ServerResponse) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodSchemaSafeParse = { safeParse: (value: unknown) => { success: boolean; data?: any; error?: any } };

export interface ReadJsonBodyOptions {
  schema?: ZodSchemaSafeParse;
  allowEmpty?: boolean;
}

// The readJsonBody implementation returns Record<string, unknown> | null
// Routes cast the result to their specific types via schema inference
export type ReadJsonBodyFn = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options?: ReadJsonBodyOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<any>;

export type ReadBodyFn = (req: http.IncomingMessage, maxSize?: number) => Promise<string>;

export type EnsureClientFn = () => Promise<CopilotClient>;
export type GetClientStateFn = () => string;
export type GetSessionOrResumeFn = (sessionId: string) => Promise<CopilotSession | null>;

// ===== Route Dependency Types =====

export interface CoreRouteDeps {
  ensureClient: EnsureClientFn;
  getClientState: GetClientStateFn;
  cliPort: number;
  httpPort: number;
  jsonRes: JsonResFn;
  readJsonBody: ReadJsonBodyFn;
  log: LogFn;
  loadMcpConfigFromDisk: () => { source: string | null; config: { mcpServers: Record<string, unknown> } };
  getWritableMcpConfigPath: (existingSource: string | null) => string;
  fs: typeof fs;
  path: typeof path;
  execFile: typeof child_process.execFile;
  getFoundrySnapshot: () => { configured: boolean; endpoint: string | null };
}

export interface SessionRouteDeps {
  ensureClient: EnsureClientFn;
  getSessionOrResume: GetSessionOrResumeFn;
  sessions: Map<string, CopilotSession>;
  jsonRes: JsonResFn;
  readJsonBody: ReadJsonBodyFn;
  log: LogFn;
  buildPromptWithAttachments: (prompt: string, attachments: readonly Attachment[]) => string;
  cors: CorsFn;
  loadMcpConfigFromDisk: () => { source: string | null; config: { mcpServers?: Record<string, unknown> } };
}

export interface FoundryRouteDeps {
  jsonRes: JsonResFn;
  readJsonBody: ReadJsonBodyFn;
  readBody: ReadBodyFn;
  log: LogFn;
  getFoundryState: () => FoundryState;
  setFoundryState: (next: FoundryState) => void;
  getFoundrySnapshot: () => { configured: boolean; endpoint: string | null };
}

export interface ProactiveModule {
  getConfig: () => ProactiveConfig;
  setConfig: (next: ProactiveConfig) => void;
  runBriefing: (promptOverride?: string) => Promise<ProactiveExecutionResponse>;
  runDeadlines: (promptOverride?: string) => Promise<ProactiveExecutionResponse>;
  runGhosts: (promptOverride?: string) => Promise<ProactiveExecutionResponse>;
  runMeetingPrep: (promptOverride?: string) => Promise<ProactiveExecutionResponse>;
}

export interface ProactiveRouteDeps {
  jsonRes: JsonResFn;
  readJsonBody: ReadJsonBodyFn;
  log: LogFn;
  proactive: ProactiveModule;
}

export interface WorkiqRouteDeps {
  ensureClient: EnsureClientFn;
  getSessionOrResume: GetSessionOrResumeFn;
  sessions: Map<string, CopilotSession>;
  jsonRes: JsonResFn;
  readJsonBody: ReadJsonBodyFn;
  log: LogFn;
  execFile: typeof child_process.execFile;
  loadMcpConfigFromDisk: () => { source: string | null; config: { mcpServers?: Record<string, unknown> } };
}
