"use strict";
(() => {
  const AchievementEngine = (() => {
    const LEVELS = [
      { level: 1, title: "\u{1F331} Newbie", xp: 0 },
      { level: 2, title: "\u{1F4A1} Explorer", xp: 50 },
      { level: 3, title: "\u26A1 Learner", xp: 150 },
      { level: 4, title: "\u{1F525} Active User", xp: 350 },
      { level: 5, title: "\u{1F680} Power User", xp: 600 },
      { level: 6, title: "\u{1F48E} Expert", xp: 1e3 },
      { level: 7, title: "\u{1F3C6} Champion", xp: 1500 },
      { level: 8, title: "\u{1F451} Master", xp: 2200 },
      { level: 9, title: "\u{1F31F} Legend", xp: 3e3 },
      { level: 10, title: "\u{1F396}\uFE0F IQ Architect", xp: 5e3 }
    ];
    const TRACKABLE_EVENTS = {
      chat_send: { xp: 5, counters: ["totalMessages"] },
      chat_session_new: { xp: 3, counters: ["totalSessions"] },
      agent_call: { xp: 15, counters: ["totalAgentCalls"] },
      agent_suggestion: { xp: 10, counters: [] },
      briefing_view: { xp: 10, counters: ["totalProactiveBriefings"] },
      deadline_avoided: { xp: 25, counters: ["totalDeadlinesAvoided"] },
      meeting_prepped: { xp: 15, counters: ["totalMeetingsPrepped"] },
      ghost_replied: { xp: 30, counters: ["totalGhostReplies"] },
      mcp_call: { xp: 10, counters: ["totalMcpCalls"] },
      skill_used: { xp: 12, counters: [] },
      task_completed: { xp: 20, counters: ["totalTasks"] },
      context_viewed: { xp: 3, counters: ["totalContextSites"] },
      config_updated: { xp: 5, counters: [] },
      panel_viewed: { xp: 1, counters: [] },
      daily_login: { xp: 8, counters: [] },
      file_uploaded: { xp: 3, counters: ["totalFileUploads"] }
    };
    const ACHIEVEMENT_CATALOG = {
      // Chat
      "chat-001": { name: "\u521D\u6B21\u5C0D\u8A71", icon: "\u{1F4AC}", desc: "\u767C\u9001\u7B2C\u4E00\u5247\u8A0A\u606F", rarity: "common", category: "chat" },
      "chat-002": { name: "\u5065\u8AC7\u8005", icon: "\u{1F5E3}\uFE0F", desc: "\u7D2F\u8A08 50 \u5247\u8A0A\u606F", rarity: "uncommon", category: "chat" },
      "chat-003": { name: "\u8A71\u984C\u738B", icon: "\u{1F451}", desc: "\u7D2F\u8A08 500 \u5247\u8A0A\u606F", rarity: "rare", category: "chat" },
      "chat-004": { name: "\u6DF1\u5EA6\u5C0D\u8A71", icon: "\u{1F9E0}", desc: "\u55AE\u6B21\u5C0D\u8A71\u8D85\u904E 20 \u56DE\u5408", rarity: "rare", category: "chat" },
      "chat-005": { name: "\u591A\u5DE5\u5927\u5E2B", icon: "\u{1F500}", desc: "\u540C\u6642\u7DAD\u6301 5 \u500B Session", rarity: "epic", category: "chat" },
      "chat-006": { name: "\u5343\u8A00\u842C\u8A9E", icon: "\u{1F4D6}", desc: "\u7D2F\u8A08 5000 \u5247\u8A0A\u606F", rarity: "legendary", category: "chat" },
      // Agent
      "agent-001": { name: "Agent \u521D\u9AD4\u9A57", icon: "\u{1F916}", desc: "\u9996\u6B21\u547C\u53EB Agent", rarity: "common", category: "agent" },
      "agent-002": { name: "Agent \u611B\u597D\u8005", icon: "\u{1F499}", desc: "\u4F7F\u7528 Agent 50 \u6B21", rarity: "uncommon", category: "agent" },
      "agent-003": { name: "Agent \u9054\u4EBA", icon: "\u2B50", desc: "\u4F7F\u7528 Agent 200 \u6B21", rarity: "rare", category: "agent" },
      "agent-004": { name: "\u5168\u80FD\u6307\u63EE\u5B98", icon: "\u{1F3AF}", desc: "\u4F7F\u7528\u904E\u6240\u6709\u985E\u578B Agent", rarity: "epic", category: "agent" },
      "agent-005": { name: "AI \u5171\u751F\u9AD4", icon: "\u{1F9EC}", desc: "\u55AE\u65E5\u4F7F\u7528 Agent 50+ \u6B21", rarity: "legendary", category: "agent" },
      // Proactive
      "proactive-001": { name: "\u65E9\u5B89\u6253\u5DE5\u4EBA", icon: "\u2600\uFE0F", desc: "\u9996\u6B21\u67E5\u770B\u6BCF\u65E5\u6668\u5831", rarity: "common", category: "proactive" },
      "proactive-002": { name: "\u6642\u9593\u5B88\u8B77\u8005", icon: "\u23F0", desc: "\u900F\u904E Deadline Hawk \u907F\u514D 3 \u6B21\u903E\u671F", rarity: "uncommon", category: "proactive" },
      "proactive-003": { name: "\u6709\u5099\u800C\u4F86", icon: "\u{1F4CB}", desc: "\u4F7F\u7528 Meeting Prep \u6E96\u5099 10 \u5834\u6703\u8B70", rarity: "rare", category: "proactive" },
      "proactive-004": { name: "\u4FE1\u4EF6\u96F6\u907A\u6F0F", icon: "\u{1F4ED}", desc: "Ghost Detector \u6E05\u96F6", rarity: "epic", category: "proactive" },
      "proactive-005": { name: "\u9023\u7E8C\u65E9\u8D77", icon: "\u{1F305}", desc: "\u9023\u7E8C 7 \u5929\u67E5\u770B\u6668\u5831", rarity: "rare", category: "proactive" },
      "proactive-006": { name: "\u96F6\u6B7B\u89D2", icon: "\u{1F6E1}\uFE0F", desc: "\u540C\u6642\u4F7F\u7528\u5168\u90E8 4 \u500B Proactive", rarity: "legendary", category: "proactive" },
      // Tools
      "tool-001": { name: "\u597D\u5947\u5FC3", icon: "\u{1F50D}", desc: "\u700F\u89BD\u904E\u6240\u6709 Panel", rarity: "common", category: "tools" },
      "tool-002": { name: "MCP \u5165\u9580", icon: "\u{1F50C}", desc: "\u9996\u6B21\u4F7F\u7528 MCP \u5DE5\u5177", rarity: "common", category: "tools" },
      "tool-003": { name: "Skill \u6536\u96C6\u8005", icon: "\u{1F9E9}", desc: "\u4F7F\u7528 5 \u7A2E\u4E0D\u540C Skill", rarity: "uncommon", category: "tools" },
      "tool-004": { name: "\u8A2D\u5B9A\u72C2\u4EBA", icon: "\u2699\uFE0F", desc: "\u5728 Config \u4E2D\u5B8C\u6210\u6240\u6709\u8A2D\u5B9A", rarity: "uncommon", category: "tools" },
      "tool-005": { name: "Context \u5927\u5E2B", icon: "\u{1F310}", desc: "\u5728 50 \u500B\u4E0D\u540C\u7DB2\u7AD9\u4F7F\u7528 Context", rarity: "rare", category: "tools" },
      "tool-006": { name: "\u4EFB\u52D9\u7D42\u7D50\u8005", icon: "\u2705", desc: "\u900F\u904E Tasks \u5B8C\u6210 100 \u500B\u4EFB\u52D9", rarity: "epic", category: "tools" },
      // Streaks
      "streak-001": { name: "\u4E09\u65E5\u4E0D\u65B7", icon: "\u{1F525}", desc: "\u9023\u7E8C 3 \u5929\u4F7F\u7528", rarity: "common", category: "streaks" },
      "streak-002": { name: "\u5468\u5468\u4E0D\u7F3A", icon: "\u{1F4C5}", desc: "\u9023\u7E8C 7 \u5929\u4F7F\u7528", rarity: "uncommon", category: "streaks" },
      "streak-003": { name: "\u6708\u5EA6\u5E38\u5BA2", icon: "\u{1F319}", desc: "\u9023\u7E8C 30 \u5929\u4F7F\u7528", rarity: "epic", category: "streaks" },
      "streak-004": { name: "\u767E\u65E5\u50B3\u8AAA", icon: "\u{1F4AF}", desc: "\u9023\u7E8C 100 \u5929\u4F7F\u7528", rarity: "legendary", category: "streaks" },
      // Hidden
      "hidden-001": { name: "\u591C\u8C93\u5B50", icon: "\u{1F989}", desc: "\u51CC\u6668 2-5 \u9EDE\u4F7F\u7528 Agent", rarity: "rare", category: "hidden", hidden: true },
      "hidden-002": { name: "\u9031\u672B\u6230\u58EB", icon: "\u2694\uFE0F", desc: "\u9031\u516D\u65E5\u90FD\u4F7F\u7528", rarity: "uncommon", category: "hidden", hidden: true },
      "hidden-003": { name: "\u901F\u5EA6\u4E4B\u661F", icon: "\u26A1", desc: "30 \u79D2\u5167\u5B8C\u6210 3 \u500B\u64CD\u4F5C", rarity: "rare", category: "hidden", hidden: true },
      "hidden-004": { name: "\u5F69\u86CB\u7375\u4EBA", icon: "\u{1F95A}", desc: '\u5728 Chat \u4E2D\u8F38\u5165 "iq easter egg"', rarity: "epic", category: "hidden", hidden: true }
    };
    const ACHIEVEMENT_RULES = [
      // Threshold-based (counter >= threshold)
      { id: "chat-001", counter: "totalMessages", threshold: 1, xpBonus: 20 },
      { id: "chat-002", counter: "totalMessages", threshold: 50, xpBonus: 50 },
      { id: "chat-003", counter: "totalMessages", threshold: 500, xpBonus: 200 },
      { id: "chat-006", counter: "totalMessages", threshold: 5e3, xpBonus: 500 },
      { id: "agent-001", counter: "totalAgentCalls", threshold: 1, xpBonus: 20 },
      { id: "agent-002", counter: "totalAgentCalls", threshold: 50, xpBonus: 80 },
      { id: "agent-003", counter: "totalAgentCalls", threshold: 200, xpBonus: 200 },
      { id: "proactive-001", counter: "totalProactiveBriefings", threshold: 1, xpBonus: 15 },
      { id: "proactive-002", counter: "totalDeadlinesAvoided", threshold: 3, xpBonus: 100 },
      { id: "proactive-003", counter: "totalMeetingsPrepped", threshold: 10, xpBonus: 120 },
      { id: "tool-002", counter: "totalMcpCalls", threshold: 1, xpBonus: 25 },
      { id: "tool-006", counter: "totalTasks", threshold: 100, xpBonus: 200 },
      { id: "tool-005", counter: "totalContextSites", threshold: 50, xpBonus: 100 },
      { id: "streak-001", counter: "currentStreak", threshold: 3, xpBonus: 30 },
      { id: "streak-002", counter: "currentStreak", threshold: 7, xpBonus: 80 },
      { id: "streak-003", counter: "currentStreak", threshold: 30, xpBonus: 300 },
      { id: "streak-004", counter: "currentStreak", threshold: 100, xpBonus: 1e3 },
      // Custom check rules
      { id: "chat-004", type: "custom", check: "singleSessionTurns20", xpBonus: 80 },
      { id: "chat-005", type: "custom", check: "concurrentSessions5", xpBonus: 100 },
      { id: "agent-004", type: "custom", check: "allAgentTypesUsed", xpBonus: 150 },
      { id: "agent-005", type: "custom", check: "agentCalls50InOneDay", xpBonus: 300 },
      { id: "proactive-004", type: "custom", check: "ghostDetectorZero", xpBonus: 200 },
      { id: "proactive-005", type: "custom", check: "consecutiveBriefing7", xpBonus: 150 },
      { id: "proactive-006", type: "custom", check: "allProactiveAgentsActive", xpBonus: 500 },
      { id: "tool-001", type: "custom", check: "allPanelsVisited", xpBonus: 10 },
      { id: "tool-003", type: "custom", check: "fiveSkillsUsed", xpBonus: 80 },
      { id: "tool-004", type: "custom", check: "allConfigCompleted", xpBonus: 50 },
      { id: "hidden-001", type: "custom", check: "usedBetween2and5am", xpBonus: 50 },
      { id: "hidden-002", type: "custom", check: "weekendWarrior", xpBonus: 40 },
      { id: "hidden-003", type: "custom", check: "threeActionsIn30s", xpBonus: 60 },
      { id: "hidden-004", type: "custom", check: "easterEggInput", xpBonus: 100 }
    ];
    const RARITY = {
      common: { label: "Common", color: "#9ca3af" },
      uncommon: { label: "Uncommon", color: "#3b82f6" },
      rare: { label: "Rare", color: "#8b5cf6" },
      epic: { label: "Epic", color: "#f97316" },
      legendary: { label: "Legendary", color: "#eab308" }
    };
    const DEFAULT_STATE = {
      version: "1.0.0",
      profile: {
        level: 1,
        xp: 0,
        title: "\u{1F331} Newbie",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
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
        dailyAgentCalls: {},
        // { "2026-02-27": count }
        briefingDays: []
        // consecutive briefing tracking
      },
      streaks: {
        currentDays: 0,
        longestDays: 0,
        lastActiveDate: null
      },
      history: [],
      settings: {
        notifications: true,
        showToast: true,
        soundEnabled: false
      }
    };
    let _state = null;
    let _initialized = false;
    let _listeners = [];
    const _recentActions = [];
    function _incCounter(key) {
      if (!_state) return;
      const val = _state.counters[key];
      if (typeof val === "number") {
        _state.counters[key] = val + 1;
      }
    }
    function _getNumericCounter(key) {
      if (!_state) return 0;
      const val = _state.counters[key];
      return typeof val === "number" ? val : 0;
    }
    function _loadFromStorage() {
      return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage?.local) {
          chrome.storage.local.get("iq_score", (data) => {
            resolve(data.iq_score ?? null);
          });
        } else {
          try {
            const raw = localStorage.getItem("iq_score");
            resolve(raw ? JSON.parse(raw) : null);
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
        } catch {
        }
      }
    }
    function _deepMerge(target, source) {
      const result = { ...target };
      for (const key of Object.keys(source)) {
        const sVal = source[key];
        const tVal = target[key];
        if (sVal && typeof sVal === "object" && !Array.isArray(sVal) && tVal && typeof tVal === "object" && !Array.isArray(tVal)) {
          result[key] = _deepMerge(tVal, sVal);
        } else if (!(key in target)) {
          result[key] = sVal;
        }
      }
      return result;
    }
    async function init() {
      if (_initialized) return _state;
      const stored = await _loadFromStorage();
      if (stored) {
        _state = _deepMerge(stored, DEFAULT_STATE);
      } else {
        _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
      _checkDailyLogin();
      _initialized = true;
      return _state;
    }
    function _checkDailyLogin() {
      if (!_state) return;
      const today = _todayStr();
      const last = _state.streaks.lastActiveDate;
      if (last === today) return;
      if (last === _yesterdayStr()) {
        _state.streaks.currentDays += 1;
      } else if (last) {
        _state.streaks.currentDays = 1;
      } else {
        _state.streaks.currentDays = 1;
      }
      _state.streaks.lastActiveDate = today;
      if (_state.streaks.currentDays > _state.streaks.longestDays) {
        _state.streaks.longestDays = _state.streaks.currentDays;
      }
      const dailyLoginDef = TRACKABLE_EVENTS["daily_login"];
      if (dailyLoginDef) _addXP(dailyLoginDef.xp, "daily_login");
      _saveToStorage();
    }
    function _todayStr() {
      return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    }
    function _yesterdayStr() {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    function track(event, data = {}) {
      if (!_initialized || !_state) return;
      const def = TRACKABLE_EVENTS[event];
      if (!def) return;
      for (const c of def.counters) {
        _incCounter(c);
      }
      _handleSpecialCounters(event, data);
      _addXP(def.xp, event);
      _recentActions.push(Date.now());
      if (_recentActions.length > 10) _recentActions.shift();
      const newUnlocks = _checkAchievements();
      _saveToStorage();
      _emit({ type: "track", event, xp: def.xp, newUnlocks });
      return { xp: def.xp, newUnlocks };
    }
    function _handleSpecialCounters(event, data) {
      if (!_state) return;
      const today = _todayStr();
      if (event === "agent_call") {
        _state.counters.dailyAgentCalls[today] = (_state.counters.dailyAgentCalls[today] ?? 0) + 1;
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
    function _addXP(amount, source) {
      if (!_state) return;
      const prevLevel = _state.profile.level;
      _state.profile.xp += amount;
      _state.history.push({
        type: "xp",
        source,
        amount,
        at: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (_state.history.length > 200) {
        _state.history = _state.history.slice(-200);
      }
      const newLevel = _calcLevel(_state.profile.xp);
      if (newLevel > prevLevel) {
        _state.profile.level = newLevel;
        _state.profile.title = LEVELS[newLevel - 1]?.title || _state.profile.title;
        _state.history.push({
          type: "levelup",
          from: prevLevel,
          to: newLevel,
          at: (/* @__PURE__ */ new Date()).toISOString()
        });
        _emit({
          type: "levelup",
          from: prevLevel,
          to: newLevel,
          title: _state.profile.title,
          xp: _state.profile.xp
        });
      }
    }
    function _calcLevel(xp) {
      let level = 1;
      for (const l of LEVELS) {
        if (xp >= l.xp) level = l.level;
        else break;
      }
      return level;
    }
    function _checkAchievements() {
      if (!_state) return [];
      const unlocked = [];
      for (const rule of ACHIEVEMENT_RULES) {
        if (_state.achievements[rule.id]?.unlocked) continue;
        let passed;
        if (rule.type === "custom") {
          passed = _checkCustomRule(rule.check);
        } else {
          const counterKey = rule.counter;
          let value;
          if (counterKey === "currentStreak") {
            value = _state.streaks.currentDays;
          } else {
            value = _getNumericCounter(counterKey);
          }
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
    function _checkCustomRule(checkName) {
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
          return Boolean(_state.counters.ghostsCleared);
        case "consecutiveBriefing7": {
          const days = _state.counters.briefingDays;
          if (days.length < 7) return false;
          const sorted = [...days].sort().slice(-7);
          for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1]).getTime();
            const curr = new Date(sorted[i]).getTime();
            if (curr - prev > 864e5 * 1.5) return false;
          }
          return true;
        }
        case "allProactiveAgentsActive":
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
          const hour = (/* @__PURE__ */ new Date()).getHours();
          return hour >= 2 && hour < 5;
        }
        case "weekendWarrior": {
          const day = (/* @__PURE__ */ new Date()).getDay();
          return day === 0 || day === 6;
        }
        case "threeActionsIn30s":
          if (_recentActions.length < 3) return false;
          return _recentActions[_recentActions.length - 1] - _recentActions[_recentActions.length - 3] <= 3e4;
        case "easterEggInput":
          return false;
        default:
          return false;
      }
    }
    function _unlockAchievement(id, xpBonus) {
      if (!_state) return null;
      const catalog = ACHIEVEMENT_CATALOG[id];
      if (!catalog) return null;
      const prevTarget = _state.achievements[id]?.target ?? 0;
      _state.achievements[id] = {
        unlocked: true,
        unlockedAt: (/* @__PURE__ */ new Date()).toISOString(),
        progress: prevTarget,
        target: prevTarget
      };
      _addXP(xpBonus, `achievement:${id}`);
      _state.history.push({
        type: "achievement",
        id,
        xp: xpBonus,
        at: (/* @__PURE__ */ new Date()).toISOString()
      });
      const detail = {
        id,
        ...catalog,
        xpBonus,
        rarityInfo: RARITY[catalog.rarity]
      };
      _emit({ type: "achievement_unlocked", achievement: detail });
      return detail;
    }
    function forceUnlock(id) {
      if (!_state) return null;
      if (_state.achievements[id]?.unlocked) return null;
      const rule = ACHIEVEMENT_RULES.find((r) => r.id === id);
      if (!rule) return null;
      const detail = _unlockAchievement(id, rule.xpBonus);
      _saveToStorage();
      _emit({ type: "achievement_unlocked", achievement: detail });
      return detail;
    }
    function _emit(event) {
      for (const fn of _listeners) {
        try {
          fn(event);
        } catch {
        }
      }
    }
    function onEvent(fn) {
      _listeners.push(fn);
      return () => {
        _listeners = _listeners.filter((f) => f !== fn);
      };
    }
    function getProfile() {
      if (!_state) return null;
      const currentLevelInfo = LEVELS[_state.profile.level - 1];
      const nextLevelInfo = LEVELS[_state.profile.level] || null;
      return {
        ..._state.profile,
        currentLevelXP: currentLevelInfo?.xp || 0,
        nextLevelXP: nextLevelInfo?.xp || null,
        streak: _state.streaks
      };
    }
    function getAchievements() {
      if (!_state) return [];
      const s = _state;
      return Object.entries(ACHIEVEMENT_CATALOG).map(([id, catalog]) => {
        const achState = s.achievements[id] ?? { unlocked: false, progress: 0, target: 0 };
        const rule = ACHIEVEMENT_RULES.find((r) => r.id === id);
        return {
          id,
          ...catalog,
          ...achState,
          xpBonus: rule?.xpBonus ?? 0,
          target: rule?.threshold ?? achState.target ?? 0,
          rarityInfo: RARITY[catalog.rarity]
        };
      });
    }
    function getAchievementsByCategory() {
      const all = getAchievements();
      const grouped = {};
      for (const a of all) {
        if (!grouped[a.category]) grouped[a.category] = [];
        grouped[a.category].push(a);
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
    function updateSettings(patch) {
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
        timeSavedMinutes: c.totalAgentCalls * 5
      };
    }
    function exportData() {
      return _state ? JSON.parse(JSON.stringify(_state)) : null;
    }
    function resetAll() {
      _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      _saveToStorage();
      _emit({ type: "reset" });
    }
    function setCustomFlag(flag, value) {
      if (!_state) return;
      _state.counters[flag] = value;
      const newUnlocks = _checkAchievements();
      if (newUnlocks.length > 0) {
        _emit({ type: "track", event: `flag:${flag}`, xp: 0, newUnlocks });
      }
      _saveToStorage();
    }
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
      ACHIEVEMENT_CATALOG
    };
  })();
  Object.assign(globalThis, { AchievementEngine });
})();
//# sourceMappingURL=achievement-engine.js.map
