(function initIQState(global) {
  const root = global.IQ || (global.IQ = {});

  const CONFIG = Object.freeze({
    // ── Timing ──
    CONNECTION_DEBOUNCE_MS: 15_000,
    TOAST_DURATION_MS: 2_200,
    TOAST_FADE_OUT_MS: 400,
    ACH_TOAST_DURATION_MS: 4_000,
    LEVELUP_TOAST_DURATION_MS: 5_000,
    TASK_TIMER_INTERVAL_MS: 100,
    SIMULATE_DELAY_BASE_MS: 800,
    SIMULATE_DELAY_RANDOM_MS: 1_200,
    INSIGHT_REMOVE_DELAY_MS: 300,

    // ── Cache TTL ──
    CACHE_TTL_MODELS_MS:   5 * 60_000,  // 5 min — rarely changes
    CACHE_TTL_TOOLS_MS:   30 * 60_000,  // 30 min — tools list rarely changes
    CACHE_TTL_QUOTA_MS:    2 * 60_000,  // 2 min — may update with usage
    CACHE_TTL_SESSIONS_MS: 30_000,      // 30 sec — user may create new sessions
    CACHE_TTL_CONTEXT_MS:  2 * 60_000,  // 2 min — aggregated endpoint
    CACHE_TTL_DEFAULT_MS:  60_000,      // 1 min — fallback

    // ── Limits ──
    MAX_DEBUG_LOG_ENTRIES: 500,
    MAX_CHAT_HISTORY_ENTRIES: 200,
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,  // 10 MB
    MAX_CACHE_ENTRIES: 50,

    // ── Storage Batching (P2-10) ──
    STORAGE_BATCH_DELAY_MS: 500,  // Debounce multiple writes within 500ms

    // ── Defaults ──
    DEFAULT_CLI_PORT: 19_836,
    DEFAULT_MODEL: "gpt-4.1",
    MS_PER_SECOND: 1_000,
  });

  root.state = Object.freeze({
    CONFIG,
  });
})(window);
