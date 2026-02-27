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
  readonly target: number;
  readonly rarityInfo: RarityInfo;
};

export interface Attachment {
  readonly name: string;
  readonly type: string;
  readonly size?: number;
  readonly dataUrl?: string;
  readonly textContent?: string;
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
