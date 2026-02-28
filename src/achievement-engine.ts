// ===== IQ Copilot — Achievement & Gamification Engine =====
// Xbox-style achievement system: XP, levels, badges, streaks.
// Persisted in chrome.storage.local under key "iq_score".

import type {
  AchievementCatalogEntry,
  AchievementDetail,
  AchievementListItem,
  AchievementRule,
  EngineEvent,
  EngineEventCallback,
  EngineState,
  RarityInfo,
  RarityKey,
  Settings,
  TrackableEventDef,
} from "./shared/types.js";

declare const chrome:
  | {
      storage?: {
        local?: {
          get: (key: string, callback: (data: Record<string, unknown>) => void) => void;
          set: (value: Record<string, unknown>) => void;
        };
      };
    }
  | undefined;
const AchievementEngine = (() => {
  // ── Level Thresholds ──
  const LEVELS = [
    { level: 1,  title: "🌱 Newbie",       xp: 0 },
    { level: 2,  title: "💡 Explorer",      xp: 50 },
    { level: 3,  title: "⚡ Learner",       xp: 150 },
    { level: 4,  title: "🔥 Active User",   xp: 350 },
    { level: 5,  title: "🚀 Power User",    xp: 600 },
    { level: 6,  title: "💎 Expert",        xp: 1000 },
    { level: 7,  title: "🏆 Champion",      xp: 1500 },
    { level: 8,  title: "👑 Master",        xp: 2200 },
    { level: 9,  title: "🌟 Legend",        xp: 3000 },
    { level: 10, title: "🎖️ IQ Architect",  xp: 5000 },
  ];

  // ── Trackable Events ──
  const TRACKABLE_EVENTS: Record<string, TrackableEventDef> = {
    chat_send:         { xp: 5,  counters: ["totalMessages"] },
    chat_session_new:  { xp: 3,  counters: ["totalSessions"] },
    agent_call:        { xp: 15, counters: ["totalAgentCalls"] },
    agent_suggestion:  { xp: 10, counters: [] },
    briefing_view:     { xp: 10, counters: ["totalProactiveBriefings"] },
    deadline_avoided:  { xp: 25, counters: ["totalDeadlinesAvoided"] },
    meeting_prepped:   { xp: 15, counters: ["totalMeetingsPrepped"] },
    ghost_replied:     { xp: 30, counters: ["totalGhostReplies"] },
    mcp_call:          { xp: 10, counters: ["totalMcpCalls"] },
    skill_used:        { xp: 12, counters: [] },
    task_completed:    { xp: 20, counters: ["totalTasks"] },
    context_viewed:    { xp: 3,  counters: ["totalContextSites"] },
    config_updated:    { xp: 5,  counters: [] },
    panel_viewed:      { xp: 1,  counters: [] },
    daily_login:       { xp: 8,  counters: [] },
    file_uploaded:     { xp: 3,  counters: ["totalFileUploads"] },
  };

  // ── Achievement Catalog ──
  const ACHIEVEMENT_CATALOG: Record<string, AchievementCatalogEntry> = {
    // Chat
    "chat-001": { name: "初次對話",   icon: "💬", desc: "發送第一則訊息",           rarity: "common",    category: "chat" },
    "chat-002": { name: "健談者",     icon: "🗣️", desc: "累計 50 則訊息",           rarity: "uncommon",  category: "chat" },
    "chat-003": { name: "話題王",     icon: "👑", desc: "累計 500 則訊息",          rarity: "rare",      category: "chat" },
    "chat-004": { name: "深度對話",   icon: "🧠", desc: "單次對話超過 20 回合",     rarity: "rare",      category: "chat" },
    "chat-005": { name: "多工大師",   icon: "🔀", desc: "同時維持 5 個 Session",    rarity: "epic",      category: "chat" },
    "chat-006": { name: "千言萬語",   icon: "📖", desc: "累計 5000 則訊息",         rarity: "legendary", category: "chat" },

    // Agent
    "agent-001": { name: "Agent 初體驗", icon: "🤖", desc: "首次呼叫 Agent",         rarity: "common",    category: "agent" },
    "agent-002": { name: "Agent 愛好者", icon: "💙", desc: "使用 Agent 50 次",       rarity: "uncommon",  category: "agent" },
    "agent-003": { name: "Agent 達人",   icon: "⭐", desc: "使用 Agent 200 次",      rarity: "rare",      category: "agent" },
    "agent-004": { name: "全能指揮官",   icon: "🎯", desc: "使用過所有類型 Agent",   rarity: "epic",      category: "agent" },
    "agent-005": { name: "AI 共生體",    icon: "🧬", desc: "單日使用 Agent 50+ 次",  rarity: "legendary", category: "agent" },

    // Proactive
    "proactive-001": { name: "早安打工人",   icon: "☀️", desc: "首次查看每日晨報",                rarity: "common",    category: "proactive" },
    "proactive-002": { name: "時間守護者",   icon: "⏰", desc: "透過 Deadline Hawk 避免 3 次逾期", rarity: "uncommon",  category: "proactive" },
    "proactive-003": { name: "有備而來",     icon: "📋", desc: "使用 Meeting Prep 準備 10 場會議", rarity: "rare",      category: "proactive" },
    "proactive-004": { name: "信件零遺漏",   icon: "📭", desc: "Ghost Detector 清零",             rarity: "epic",      category: "proactive" },
    "proactive-005": { name: "連續早起",     icon: "🌅", desc: "連續 7 天查看晨報",               rarity: "rare",      category: "proactive" },
    "proactive-006": { name: "零死角",       icon: "🛡️", desc: "同時使用全部 4 個 Proactive",     rarity: "legendary", category: "proactive" },

    // Tools
    "tool-001": { name: "好奇心",     icon: "🔍", desc: "瀏覽過所有 Panel",              rarity: "common",    category: "tools" },
    "tool-002": { name: "MCP 入門",   icon: "🔌", desc: "首次使用 MCP 工具",             rarity: "common",    category: "tools" },
    "tool-003": { name: "Skill 收集者", icon: "🧩", desc: "使用 5 種不同 Skill",          rarity: "uncommon",  category: "tools" },
    "tool-004": { name: "設定狂人",   icon: "⚙️", desc: "在 Config 中完成所有設定",      rarity: "uncommon",  category: "tools" },
    "tool-005": { name: "Context 大師", icon: "🌐", desc: "在 50 個不同網站使用 Context", rarity: "rare",      category: "tools" },
    "tool-006": { name: "任務終結者", icon: "✅", desc: "透過 Tasks 完成 100 個任務",    rarity: "epic",      category: "tools" },

    // Streaks
    "streak-001": { name: "三日不斷",   icon: "🔥", desc: "連續 3 天使用",   rarity: "common",    category: "streaks" },
    "streak-002": { name: "周周不缺",   icon: "📅", desc: "連續 7 天使用",   rarity: "uncommon",  category: "streaks" },
    "streak-003": { name: "月度常客",   icon: "🌙", desc: "連續 30 天使用",  rarity: "epic",      category: "streaks" },
    "streak-004": { name: "百日傳說",   icon: "💯", desc: "連續 100 天使用", rarity: "legendary", category: "streaks" },

    // Hidden
    "hidden-001": { name: "夜貓子",     icon: "🦉", desc: "凌晨 2-5 點使用 Agent",       rarity: "rare",      category: "hidden", hidden: true },
    "hidden-002": { name: "週末戰士",   icon: "⚔️", desc: "週六日都使用",                rarity: "uncommon",  category: "hidden", hidden: true },
    "hidden-003": { name: "速度之星",   icon: "⚡", desc: "30 秒內完成 3 個操作",        rarity: "rare",      category: "hidden", hidden: true },
    "hidden-004": { name: "彩蛋獵人",   icon: "🥚", desc: '在 Chat 中輸入 "iq easter egg"', rarity: "epic",   category: "hidden", hidden: true },
  };

  // ── Achievement Rules ──
  const ACHIEVEMENT_RULES: readonly AchievementRule[] = [
    // Threshold-based (counter >= threshold)
    { id: "chat-001",  counter: "totalMessages",           threshold: 1,    xpBonus: 20  },
    { id: "chat-002",  counter: "totalMessages",           threshold: 50,   xpBonus: 50  },
    { id: "chat-003",  counter: "totalMessages",           threshold: 500,  xpBonus: 200 },
    { id: "chat-006",  counter: "totalMessages",           threshold: 5000, xpBonus: 500 },

    { id: "agent-001", counter: "totalAgentCalls",         threshold: 1,    xpBonus: 20  },
    { id: "agent-002", counter: "totalAgentCalls",         threshold: 50,   xpBonus: 80  },
    { id: "agent-003", counter: "totalAgentCalls",         threshold: 200,  xpBonus: 200 },

    { id: "proactive-001", counter: "totalProactiveBriefings", threshold: 1,  xpBonus: 15  },
    { id: "proactive-002", counter: "totalDeadlinesAvoided",   threshold: 3,  xpBonus: 100 },
    { id: "proactive-003", counter: "totalMeetingsPrepped",    threshold: 10, xpBonus: 120 },

    { id: "tool-002",  counter: "totalMcpCalls",           threshold: 1,    xpBonus: 25  },
    { id: "tool-006",  counter: "totalTasks",              threshold: 100,  xpBonus: 200 },
    { id: "tool-005",  counter: "totalContextSites",       threshold: 50,   xpBonus: 100 },

    { id: "streak-001", counter: "currentStreak",          threshold: 3,    xpBonus: 30  },
    { id: "streak-002", counter: "currentStreak",          threshold: 7,    xpBonus: 80  },
    { id: "streak-003", counter: "currentStreak",          threshold: 30,   xpBonus: 300 },
    { id: "streak-004", counter: "currentStreak",          threshold: 100,  xpBonus: 1000 },

    // Custom check rules
    { id: "chat-004",      type: "custom", check: "singleSessionTurns20",    xpBonus: 80  },
    { id: "chat-005",      type: "custom", check: "concurrentSessions5",     xpBonus: 100 },
    { id: "agent-004",     type: "custom", check: "allAgentTypesUsed",       xpBonus: 150 },
    { id: "agent-005",     type: "custom", check: "agentCalls50InOneDay",    xpBonus: 300 },
    { id: "proactive-004", type: "custom", check: "ghostDetectorZero",       xpBonus: 200 },
    { id: "proactive-005", type: "custom", check: "consecutiveBriefing7",    xpBonus: 150 },
    { id: "proactive-006", type: "custom", check: "allProactiveAgentsActive", xpBonus: 500 },
    { id: "tool-001",      type: "custom", check: "allPanelsVisited",        xpBonus: 10  },
    { id: "tool-003",      type: "custom", check: "fiveSkillsUsed",          xpBonus: 80  },
    { id: "tool-004",      type: "custom", check: "allConfigCompleted",      xpBonus: 50  },
    { id: "hidden-001",    type: "custom", check: "usedBetween2and5am",      xpBonus: 50  },
    { id: "hidden-002",    type: "custom", check: "weekendWarrior",          xpBonus: 40  },
    { id: "hidden-003",    type: "custom", check: "threeActionsIn30s",       xpBonus: 60  },
    { id: "hidden-004",    type: "custom", check: "easterEggInput",          xpBonus: 100 },
  ];

  // ── Rarity config ──
  const RARITY: Record<RarityKey, RarityInfo> = {
    common:    { label: "Common",    color: "#9ca3af" },
    uncommon:  { label: "Uncommon",  color: "#3b82f6" },
    rare:      { label: "Rare",      color: "#8b5cf6" },
    epic:      { label: "Epic",      color: "#f97316" },
    legendary: { label: "Legendary", color: "#eab308" },
  };

  // ── Default state ──
  const DEFAULT_STATE: EngineState = {
    version: "1.0.0",
    profile: {
      level: 1,
      xp: 0,
      title: "🌱 Newbie",
      createdAt: new Date().toISOString(),
    },
    achievements: {},
    counters: {
      totalMessages: 0,
      totalAgentCalls: 0,
      totalTasks: 0,
      totalMcpCalls: 0,
      totalSkillsUsed: [],
      totalContextSites: 0,
      totalSessions: 0,
      totalProactiveBriefings: 0,
      totalDeadlinesAvoided: 0,
      totalMeetingsPrepped: 0,
      totalGhostReplies: 0,
      totalFileUploads: 0,
      panelsVisited: [],
      agentTypesUsed: [],
      dailyAgentCalls: {},    // { "2026-02-27": count }
      briefingDays: [],       // consecutive briefing tracking
    },
    streaks: {
      currentDays: 0,
      longestDays: 0,
      lastActiveDate: null,
    },
    history: [],
    settings: {
      notifications: true,
      showToast: true,
      soundEnabled: false,
    },
  };

  // ── Internal state ──
  let _state: EngineState | null = null;
  let _initialized = false;
  let _listeners: EngineEventCallback[] = [];
  const _recentActions: number[] = [];

  // ── Counter helpers (safe dynamic access) ──
  function _incCounter(key: string): void {
    if (!_state) return;
    const val = (_state.counters as unknown as Record<string, unknown>)[key];
    if (typeof val === "number") {
      (_state.counters as unknown as Record<string, unknown>)[key] = val + 1;
    }
  }

  function _getNumericCounter(key: string): number {
    if (!_state) return 0;
    const val = (_state.counters as unknown as Record<string, unknown>)[key];
    return typeof val === "number" ? val : 0;
  }

  // ── Storage ──
  function _loadFromStorage(): Promise<EngineState | null> {
    return new Promise<EngineState | null>((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get("iq_score", (data) => {
          resolve((data.iq_score as EngineState | null) ?? null);
        });
      } else {
        // Fallback for non-extension context
        try {
          const raw = localStorage.getItem("iq_score");
          resolve(raw ? (JSON.parse(raw) as EngineState) : null);
        } catch {
          resolve(null);
        }
      }
    });
  }

  function _saveToStorage() {
    if (!_state) return;
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ iq_score: _state });
    } else {
      try {
        localStorage.setItem("iq_score", JSON.stringify(_state));
      } catch { /* ignore */ }
    }
  }

  // ── Deep merge helper ──
  function _deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
      const sVal = source[key];
      const tVal = target[key];
      if (
        sVal &&
        typeof sVal === "object" &&
        !Array.isArray(sVal) &&
        tVal &&
        typeof tVal === "object" &&
        !Array.isArray(tVal)
      ) {
        result[key] = _deepMerge(tVal as Record<string, unknown>, sVal as Record<string, unknown>);
      } else if (!(key in target)) {
        result[key] = sVal;
      }
    }
    return result;
  }

  // ── Init ──
  async function init() {
    if (_initialized) return _state;

    const stored = await _loadFromStorage();
    if (stored) {
      // Merge with defaults to handle schema upgrades
      _state = _deepMerge(stored as unknown as Record<string, unknown>, DEFAULT_STATE as unknown as Record<string, unknown>) as unknown as EngineState;
    } else {
      _state = JSON.parse(JSON.stringify(DEFAULT_STATE)) as EngineState;
    }

    // Check daily login streak
    _checkDailyLogin();
    _initialized = true;

    return _state;
  }

  // ── Daily login / streak ──
  function _checkDailyLogin(): void {
    if (!_state) return;
    const today = _todayStr();
    const last = _state.streaks.lastActiveDate;

    if (last === today) return; // Already logged in today

    if (last === _yesterdayStr()) {
      // Consecutive day
      _state.streaks.currentDays += 1;
    } else if (last) {
      // Streak broken
      _state.streaks.currentDays = 1;
    } else {
      // First ever
      _state.streaks.currentDays = 1;
    }

    _state.streaks.lastActiveDate = today;
    if (_state.streaks.currentDays > _state.streaks.longestDays) {
      _state.streaks.longestDays = _state.streaks.currentDays;
    }

    // Award daily login XP
    const dailyLoginDef = TRACKABLE_EVENTS["daily_login"];
    if (dailyLoginDef) _addXP(dailyLoginDef.xp, "daily_login");
    _saveToStorage();
  }

  function _todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function _yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  // ── Core: track(event, data) ──
  function track(event: string, data: Record<string, unknown> = {}): { xp: number; newUnlocks: (AchievementDetail | null)[] } | undefined {
    if (!_initialized || !_state) return;

    const def = TRACKABLE_EVENTS[event];
    if (!def) return;

    // Update counters
    for (const c of def.counters) {
      _incCounter(c);
    }

    // Special counter logic
    _handleSpecialCounters(event, data);

    // Add XP
    _addXP(def.xp, event);

    // Track recent actions for speed achievement
    _recentActions.push(Date.now());
    if (_recentActions.length > 10) _recentActions.shift();

    // Check achievements
    const newUnlocks = _checkAchievements();

    // Save
    _saveToStorage();

    // Notify listeners
    _emit({ type: "track", event, xp: def.xp, newUnlocks });

    return { xp: def.xp, newUnlocks };
  }

  function _handleSpecialCounters(event: string, data: Record<string, unknown>): void {
    if (!_state) return;
    const today = _todayStr();

    if (event === "agent_call") {
      // Track daily agent calls
      _state.counters.dailyAgentCalls[today] = (_state.counters.dailyAgentCalls[today] ?? 0) + 1;

      // Track agent type used
      const agentType = data.agentType;
      if (typeof agentType === "string" && !_state.counters.agentTypesUsed.includes(agentType)) {
        _state.counters.agentTypesUsed.push(agentType);
      }
    }

    if (event === "skill_used") {
      const skillName = data.skillName;
      if (typeof skillName === "string" && !_state.counters.totalSkillsUsed.includes(skillName)) {
        _state.counters.totalSkillsUsed.push(skillName);
      }
    }

    if (event === "panel_viewed") {
      const panel = data.panel;
      if (typeof panel === "string" && !_state.counters.panelsVisited.includes(panel)) {
        _state.counters.panelsVisited.push(panel);
      }
    }

    if (event === "briefing_view") {
      if (!_state.counters.briefingDays.includes(today)) {
        _state.counters.briefingDays.push(today);
      }
    }
  }

  // ── XP & Level ──
  function _addXP(amount: number, source: string): void {
    if (!_state) return;
    const prevLevel = _state.profile.level;
    _state.profile.xp += amount;

    // Add to history
    _state.history.push({
      type: "xp",
      source,
      amount,
      at: new Date().toISOString(),
    });

    // Trim history to 200 entries
    if (_state.history.length > 200) {
      _state.history = _state.history.slice(-200);
    }

    // Check level up
    const newLevel = _calcLevel(_state.profile.xp);
    if (newLevel > prevLevel) {
      _state.profile.level = newLevel;
      _state.profile.title = LEVELS[newLevel - 1]?.title || _state.profile.title;

      _state.history.push({
        type: "levelup",
        from: prevLevel,
        to: newLevel,
        at: new Date().toISOString(),
      });

      _emit({
        type: "levelup",
        from: prevLevel,
        to: newLevel,
        title: _state.profile.title,
        xp: _state.profile.xp,
      });
    }
  }

  function _calcLevel(xp: number): number {
    let level = 1;
    for (const l of LEVELS) {
      if (xp >= l.xp) level = l.level;
      else break;
    }
    return level;
  }

  // ── Achievement Checking ──
  function _checkAchievements(): (AchievementDetail | null)[] {
    if (!_state) return [];
    const unlocked: (AchievementDetail | null)[] = [];

    for (const rule of ACHIEVEMENT_RULES) {
      // Skip already unlocked
      if (_state.achievements[rule.id]?.unlocked) continue;

      let passed: boolean;

      if (rule.type === "custom") {
        passed = _checkCustomRule(rule.check);
      } else {
        // Threshold-based
        const counterKey = rule.counter;
        let value: number;

        if (counterKey === "currentStreak") {
          value = _state.streaks.currentDays;
        } else {
          value = _getNumericCounter(counterKey);
        }

        // Update progress
        const ach = _state.achievements[rule.id];
        if (!ach) {
          _state.achievements[rule.id] = { unlocked: false, progress: value, target: rule.threshold };
        } else {
          ach.progress = value;
          ach.target = rule.threshold;
        }

        passed = value >= rule.threshold;
      }

      if (passed) {
        unlocked.push(_unlockAchievement(rule.id, rule.xpBonus));
      }
    }

    return unlocked;
  }

  // ── Custom Rule Checks ──
  function _checkCustomRule(checkName: string): boolean {
    if (!_state) return false;
    switch (checkName) {
      case "singleSessionTurns20":
        return false;

      case "concurrentSessions5":
        return _state.counters.totalSessions >= 5;

      case "allAgentTypesUsed":
        return _state.counters.agentTypesUsed.length >= 4;

      case "agentCalls50InOneDay": {
        const today = _todayStr();
        return (_state.counters.dailyAgentCalls[today] ?? 0) >= 50;
      }

      case "ghostDetectorZero":
        // Check if ghost detector has no unread ghosts
        // This is set externally via setCustomFlag("ghostsCleared", true)
        return Boolean(_state.counters.ghostsCleared);

      case "consecutiveBriefing7": {
        const days = _state.counters.briefingDays;
        if (days.length < 7) return false;
        const sorted = [...days].sort().slice(-7);
        for (let i = 1; i < sorted.length; i++) {
          const prev = new Date(sorted[i - 1]!).getTime();
          const curr = new Date(sorted[i]!).getTime();
          if (curr - prev > 86400000 * 1.5) return false;
        }
        return true;
      }

      case "allProactiveAgentsActive":
        // Check if all 4 proactive agents have been used (briefing, deadlines, ghosts, meetingPrep)
        // This is set externally via setCustomFlag("allProactiveUsed", true)
        return Boolean(_state.counters.allProactiveUsed);

      case "allPanelsVisited": {
        const required = ["chat", "context", "agent", "history", "usage", "tasks", "skills", "mcp", "config"];
        const visited = _state.counters.panelsVisited;
        return required.every((p) => visited.includes(p));
      }

      case "fiveSkillsUsed":
        return _state.counters.totalSkillsUsed.length >= 5;

      case "allConfigCompleted":
        return false;

      case "usedBetween2and5am": {
        const hour = new Date().getHours();
        return hour >= 2 && hour < 5;
      }

      case "weekendWarrior": {
        const day = new Date().getDay();
        return day === 0 || day === 6;
      }

      case "threeActionsIn30s":
        if (_recentActions.length < 3) return false;
        return (_recentActions[_recentActions.length - 1]! - _recentActions[_recentActions.length - 3]!) <= 30000;

      case "easterEggInput":
        return false;

      default:
        return false;
    }
  }

  // ── Unlock ──
  function _unlockAchievement(id: string, xpBonus: number): AchievementDetail | null {
    if (!_state) return null;
    const catalog = ACHIEVEMENT_CATALOG[id];
    if (!catalog) return null;

    const prevTarget = _state.achievements[id]?.target ?? 0;
    _state.achievements[id] = {
      unlocked: true,
      unlockedAt: new Date().toISOString(),
      progress: prevTarget,
      target: prevTarget,
    };

    // Add bonus XP
    _addXP(xpBonus, `achievement:${id}`);

    _state.history.push({
      type: "achievement",
      id,
      xp: xpBonus,
      at: new Date().toISOString(),
    });

    const detail: AchievementDetail = {
      id,
      ...catalog,
      xpBonus,
      rarityInfo: RARITY[catalog.rarity],
    };

    _emit({ type: "achievement_unlocked", achievement: detail });

    return detail;
  }

  // Force unlock (for special conditions checked externally)
  function forceUnlock(id: string): AchievementDetail | null {
    if (!_state) return null;
    if (_state.achievements[id]?.unlocked) return null;
    const rule = ACHIEVEMENT_RULES.find((r) => r.id === id);
    if (!rule) return null;
    const detail = _unlockAchievement(id, rule.xpBonus);
    _saveToStorage();
    _emit({ type: "achievement_unlocked", achievement: detail });
    return detail;
  }

  // ── Event emitter ──
  function _emit(event: EngineEvent): void {
    for (const fn of _listeners) {
      try { fn(event); } catch { /* ignore */ }
    }
  }

  function onEvent(fn: EngineEventCallback): () => void {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((f) => f !== fn);
    };
  }

  // ── Getters ──
  function getProfile() {
    if (!_state) return null;
    const currentLevelInfo = LEVELS[_state.profile.level - 1];
    const nextLevelInfo = LEVELS[_state.profile.level] || null;
    return {
      ..._state.profile,
      currentLevelXP: currentLevelInfo?.xp || 0,
      nextLevelXP: nextLevelInfo?.xp || null,
      streak: _state.streaks,
    };
  }

  function getAchievements(): AchievementListItem[] {
    if (!_state) return [];
    const s = _state;
    return Object.entries(ACHIEVEMENT_CATALOG).map(([id, catalog]) => {
      const achState = s.achievements[id] ?? { unlocked: false, progress: 0, target: 0 };
      const rule = ACHIEVEMENT_RULES.find((r) => r.id === id);
      return {
        id,
        ...catalog,
        ...achState,
        target: rule?.threshold ?? achState.target ?? 0,
        rarityInfo: RARITY[catalog.rarity],
      } as AchievementListItem;
    });
  }

  function getAchievementsByCategory(): Record<string, AchievementListItem[]> {
    const all = getAchievements();
    const grouped: Record<string, AchievementListItem[]> = {};
    for (const a of all) {
      if (!grouped[a.category]) grouped[a.category] = [];
      grouped[a.category]!.push(a);
    }
    return grouped;
  }

  function getCounters() {
    return _state ? { ..._state.counters } : {};
  }

  function getStreaks() {
    return _state ? { ..._state.streaks } : {};
  }

  function getHistory(limit = 20) {
    if (!_state) return [];
    return _state.history.slice(-limit).reverse();
  }

  function getSettings() {
    return _state?.settings || {};
  }

  function updateSettings(patch: Partial<Settings>): void {
    if (!_state) return;
    _state.settings = { ..._state.settings, ...patch };
    _saveToStorage();
  }

  function getStats() {
    if (!_state) return {};
    const c = _state.counters;
    return {
      totalXP: _state.profile.xp,
      level: _state.profile.level,
      title: _state.profile.title,
      achievementsUnlocked: Object.values(_state.achievements).filter((a) => a.unlocked).length,
      achievementsTotal: Object.keys(ACHIEVEMENT_CATALOG).length,
      streak: _state.streaks.currentDays,
      longestStreak: _state.streaks.longestDays,
      totalMessages: c.totalMessages,
      totalAgentCalls: c.totalAgentCalls,
      totalTasks: c.totalTasks,
      totalSessions: c.totalSessions,
      timeSavedMinutes: c.totalAgentCalls * 5,
    };
  }

  // ── Export & Reset ──
  function exportData() {
    return _state ? JSON.parse(JSON.stringify(_state)) : null;
  }

  function resetAll(): void {
    _state = JSON.parse(JSON.stringify(DEFAULT_STATE)) as EngineState;
    _saveToStorage();
    _emit({ type: "reset" });
  }

  // ── Custom Flag Setter (for external checks like ghostDetectorZero, allProactiveAgentsActive) ──
  function setCustomFlag(flag: string, value: boolean): void {
    if (!_state) return;
    (_state.counters as unknown as Record<string, unknown>)[flag] = value;

    // After setting flag, check achievements in case this unlocks something
    const newUnlocks = _checkAchievements();
    if (newUnlocks.length > 0) {
      _emit({ type: "track", event: `flag:${flag}`, xp: 0, newUnlocks });
    }
    _saveToStorage();
  }

  // ── Public API ──
  return {
    init,
    track,
    forceUnlock,
    setCustomFlag,
    onEvent,
    getProfile,
    getAchievements,
    getAchievementsByCategory,
    getCounters,
    getStreaks,
    getHistory,
    getSettings,
    updateSettings,
    getStats,
    exportData,
    resetAll,
    LEVELS,
    RARITY,
    ACHIEVEMENT_CATALOG,
  };
})();

Object.assign(globalThis, { AchievementEngine });
