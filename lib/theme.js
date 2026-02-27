(function initIQTheme(global) {
  const root = global.IQ || (global.IQ = {});
  const i18n = root.i18n;

  function applyTheme(theme, persist = true) {
    const resolved = theme === "light" ? "light" : "dark";
    i18n.setTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    const themeSel = document.getElementById("config-theme");
    if (themeSel) themeSel.value = resolved;
    if (persist) chrome.storage.local.set({ uiTheme: resolved });
  }

  function applyLanguage(language, persist = true) {
    const resolved = language === "en" ? "en" : "zh-TW";
    i18n.setLanguage(resolved);
    const langSel = document.getElementById("config-language");
    if (langSel) langSel.value = resolved;
    i18n.translateStaticUi();
    // updateConnectionUI will be called by the bootstrap after this module loads
    if (typeof root._updateConnectionUI === "function") {
      root._updateConnectionUI();
    }
    if (persist) chrome.storage.local.set({ uiLanguage: resolved });
  }

  function loadUiPreferences() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["uiTheme", "uiLanguage"], (data) => {
        applyTheme(data.uiTheme || "dark", false);
        applyLanguage(data.uiLanguage || "zh-TW", false);
        resolve();
      });
    });
  }

  root.theme = {
    applyTheme,
    applyLanguage,
    loadUiPreferences,
  };
})(window);
