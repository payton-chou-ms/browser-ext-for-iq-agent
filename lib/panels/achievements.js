(function initIQPanelAchievements(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const CONFIG = root.state?.CONFIG || {};

  let _achFilter = "all";

  function _relativeTime(isoStr) {
    if (!isoStr) return "";
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoStr).toLocaleDateString();
  }

  function renderAchievementPanel() {
    if (typeof AchievementEngine === "undefined") return;
    renderAchProfileCard();
    renderAchRecentUnlocks();
    renderAchCategories();
    renderAchAllList();
  }

  function renderAchProfileCard() {
    const profile = AchievementEngine.getProfile();
    const stats = AchievementEngine.getStats();
    if (!profile) return;

    const iconEl = document.getElementById("ach-profile-icon");
    const titleEl = document.getElementById("ach-profile-title");
    const levelEl = document.getElementById("ach-profile-level");
    const xpFillEl = document.getElementById("ach-xp-fill");
    const xpTextEl = document.getElementById("ach-xp-text");
    const streakEl = document.getElementById("ach-stat-streak");
    const unlockedEl = document.getElementById("ach-stat-unlocked");
    const timeEl = document.getElementById("ach-stat-time");

    if (!iconEl) return;

    const titleParts = (profile.title || "🌱 Newbie").split(" ");
    const icon = titleParts[0];
    const titleText = titleParts.slice(1).join(" ");

    iconEl.textContent = icon;
    titleEl.textContent = titleText;
    levelEl.textContent = `Level ${profile.level}`;

    const currentXP = profile.xp || 0;
    const currentLevelXP = profile.currentLevelXP || 0;
    const nextLevelXP = profile.nextLevelXP;
    let pct = 100;
    let xpLabel = `${currentXP.toLocaleString()} XP (MAX)`;

    if (nextLevelXP) {
      const rangeXP = nextLevelXP - currentLevelXP;
      const progressXP = currentXP - currentLevelXP;
      pct = rangeXP > 0 ? Math.min(100, Math.round((progressXP / rangeXP) * 100)) : 100;
      xpLabel = `${currentXP.toLocaleString()} / ${nextLevelXP.toLocaleString()} XP`;
    }
    xpFillEl.style.width = `${pct}%`;
    xpTextEl.textContent = xpLabel;

    streakEl.textContent = stats.streak || 0;
    unlockedEl.textContent = `${stats.achievementsUnlocked}/${stats.achievementsTotal}`;
    const hrs = ((stats.timeSavedMinutes || 0) / 60).toFixed(1);
    timeEl.textContent = `${hrs}h`;
  }

  function renderAchRecentUnlocks() {
    const achievements = AchievementEngine.getAchievements();
    const recent = achievements
      .filter((a) => a.unlocked)
      .sort((a, b) => (b.unlockedAt || "").localeCompare(a.unlockedAt || ""))
      .slice(0, 5);

    const card = document.getElementById("ach-recent-card");
    const list = document.getElementById("ach-recent-list");
    if (!card || !list) return;

    if (recent.length === 0) { card.style.display = "none"; return; }
    card.style.display = "";

    list.innerHTML = recent
      .map((a) => {
        const rarityColor = a.rarityInfo?.color || "#9ca3af";
        const timeAgo = _relativeTime(a.unlockedAt);
        return `<div class="ach-recent-item" style="--rarity:${rarityColor}">
          <span class="ach-recent-icon">${a.icon}</span>
          <div class="ach-recent-info">
            <span class="ach-recent-name">${a.name}</span>
            <span class="ach-recent-time">${timeAgo}</span>
          </div>
          <span class="ach-recent-xp">+${a.xpBonus || 0} XP</span>
        </div>`;
      })
      .join("");
  }

  function renderAchCategories() {
    const container = document.getElementById("ach-categories");
    if (!container) return;

    const byCategory = AchievementEngine.getAchievementsByCategory();
    const categoryMeta = {
      chat:      { icon: "🗨️", label: "Chat" },
      agent:     { icon: "🤖", label: "Agent" },
      proactive: { icon: "📋", label: "Proactive" },
      tools:     { icon: "🔧", label: "Tools" },
      streaks:   { icon: "🔥", label: "Streaks" },
      hidden:    { icon: "🥚", label: "Hidden" },
    };

    container.innerHTML = Object.entries(categoryMeta)
      .map(([key, meta]) => {
        const items = byCategory[key] || [];
        const unlocked = items.filter((a) => a.unlocked).length;
        const total = items.length;
        const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
        return `<div class="ach-cat-row">
          <span class="ach-cat-icon">${meta.icon}</span>
          <span class="ach-cat-label">${meta.label}</span>
          <div class="ach-cat-bar"><div class="ach-cat-fill" style="width:${pct}%"></div></div>
          <span class="ach-cat-count">${unlocked}/${total}</span>
        </div>`;
      })
      .join("");
  }

  function renderAchAllList(filter) {
    if (filter) _achFilter = filter;
    const container = document.getElementById("ach-all-list");
    if (!container) return;

    let all = AchievementEngine.getAchievements();
    if (_achFilter === "unlocked") all = all.filter((a) => a.unlocked);
    else if (_achFilter === "locked") all = all.filter((a) => !a.unlocked);

    container.innerHTML = all
      .map((a) => {
        const rarityColor = a.rarityInfo?.color || "#9ca3af";
        const isHidden = a.hidden && !a.unlocked;

        if (a.unlocked) {
          return `<div class="ach-item unlocked" style="--rarity:${rarityColor}">
            <span class="ach-item-icon">${a.icon}</span>
            <div class="ach-item-info">
              <span class="ach-item-name">${a.name}</span>
              <span class="ach-item-desc">${a.desc}</span>
            </div>
            <span class="ach-item-badge">✅</span>
          </div>`;
        }

        if (isHidden) {
          return `<div class="ach-item locked hidden-ach">
            <span class="ach-item-icon">❓</span>
            <div class="ach-item-info">
              <span class="ach-item-name">Hidden Achievement</span>
              <span class="ach-item-desc">Keep exploring to discover this…</span>
            </div>
            <span class="ach-item-badge">🔒</span>
          </div>`;
        }

        const progress = a.progress || 0;
        const target = a.target || 1;
        const pct = Math.min(100, Math.round((progress / target) * 100));
        const showBar = target > 1 && progress > 0;

        return `<div class="ach-item locked" style="--rarity:${rarityColor}">
          <span class="ach-item-icon">${a.icon}</span>
          <div class="ach-item-info">
            <span class="ach-item-name">${a.name}</span>
            <span class="ach-item-desc">${a.desc}</span>
            ${showBar ? `<div class="ach-item-progress-bar"><div class="ach-item-progress-fill" style="width:${pct}%"></div></div><span class="ach-item-progress-text">${progress}/${target}</span>` : ""}
          </div>
          <span class="ach-item-badge">🔒</span>
        </div>`;
      })
      .join("");
  }

  function showAchievementToast(achievement) {
    document.querySelectorAll(".ach-toast").forEach((t) => t.remove());

    const profile = AchievementEngine.getProfile();
    const rarityColor = achievement.rarityInfo?.color || "#9ca3af";
    const rarityLabel = achievement.rarityInfo?.label || "Common";

    let xpBarHTML = "";
    if (profile && profile.nextLevelXP) {
      const range = profile.nextLevelXP - profile.currentLevelXP;
      const prog = profile.xp - profile.currentLevelXP;
      const pct = range > 0 ? Math.min(100, Math.round((prog / range) * 100)) : 100;
      xpBarHTML = `<div class="ach-toast-xp-bar"><div class="ach-toast-xp-fill" style="width:${pct}%"></div></div>
        <span class="ach-toast-level">Lv.${profile.level}</span>`;
    }

    const toast = document.createElement("div");
    toast.className = "ach-toast";
    toast.style.setProperty("--rarity", rarityColor);
    toast.innerHTML = `
      <div class="ach-toast-header">🏅 Achievement Unlocked!</div>
      <div class="ach-toast-body">
        <span class="ach-toast-icon">${achievement.icon}</span>
        <div class="ach-toast-info">
          <span class="ach-toast-name">${achievement.name}</span>
          <span class="ach-toast-desc">${achievement.desc}</span>
          <span class="ach-toast-rarity">${rarityLabel}</span>
        </div>
        <span class="ach-toast-xp">+${achievement.xpBonus} XP</span>
      </div>
      ${xpBarHTML}
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(120%)";
      setTimeout(() => toast.remove(), CONFIG.TOAST_FADE_OUT_MS || 400);
    }, CONFIG.ACH_TOAST_DURATION_MS || 4000);
  }

  function showLevelUpToast(from, to, title) {
    document.querySelectorAll(".ach-toast").forEach((t) => t.remove());

    const toast = document.createElement("div");
    toast.className = "ach-toast level-up";
    toast.innerHTML = `
      <div class="ach-toast-header">🎉 Level Up!</div>
      <div class="ach-toast-body">
        <span class="ach-toast-icon ach-toast-icon--level-up">${title.split(" ")[0]}</span>
        <div class="ach-toast-info">
          <span class="ach-toast-name">Level ${from} → Level ${to}</span>
          <span class="ach-toast-desc">${title}</span>
        </div>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(120%)";
      setTimeout(() => toast.remove(), CONFIG.TOAST_FADE_OUT_MS || 400);
    }, CONFIG.LEVELUP_TOAST_DURATION_MS || 5000);
  }

  function initAchievements() {
    if (typeof AchievementEngine === "undefined") return;

    AchievementEngine.init().then(() => {
      AchievementEngine.onEvent((evt) => {
        if (evt.type === "achievement_unlocked" && evt.achievement) {
          showAchievementToast(evt.achievement);
          const panel = document.getElementById("panel-achievements");
          if (panel && !panel.classList.contains("hidden") && panel.offsetParent !== null) {
            renderAchievementPanel();
          }
        }
        if (evt.type === "levelup") {
          showLevelUpToast(evt.from, evt.to, evt.title);
          renderAchProfileCard();
        }
      });
      renderAchievementPanel();
    });
  }

  function bindEvents() {
    document.getElementById("ach-filter-bar")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".ach-filter-btn");
      if (!btn) return;
      document.querySelectorAll("#ach-filter-bar .ach-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderAchAllList(btn.dataset.filter);
    });
  }

  root.panels.achievements = {
    renderAchievementPanel,
    initAchievements,
    showAchievementToast,
    showLevelUpToast,
    bindEvents,
  };
})(window);
