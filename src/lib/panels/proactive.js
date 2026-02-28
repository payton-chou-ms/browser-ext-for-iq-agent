(function initIQPanelProactive(global) {
  const root = global.IQ || (global.IQ = {});
  if (!root.panels) root.panels = {};

  const stateFactory = root.panels.proactiveStateFactory;
  const renderFactory = root.panels.proactiveRenderFactory;
  const scanFactory = root.panels.proactiveScanFactory;

  if (!stateFactory || !renderFactory || !scanFactory) {
    console.error("[proactive] missing proactive module factories");
    return;
  }

  const stateApi = stateFactory();
  const renderApi = renderFactory({ stateApi });
  const scanApi = scanFactory({ stateApi, renderApi });

  root.panels.proactive = {
    handleProactiveUpdate: scanApi.handleProactiveUpdate,
    runFullProactiveScan: scanApi.runFullProactiveScan,
    restoreProactiveState: scanApi.restoreProactiveState,
    loadProactiveConfig: scanApi.loadProactiveConfig,
    renderTopPriority: renderApi.renderTopPriority,
    updateNotificationBadge: stateApi.updateNotificationBadge,
    bindEvents: scanApi.bindEvents,
  };
})(window);
