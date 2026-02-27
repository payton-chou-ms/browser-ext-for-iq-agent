(function initIQChatSession(global) {
  const root = global.IQ || (global.IQ = {});

  root.chatSessionFactory = function createChatSessionFactory(deps) {
    const {
      localizeRuntimeMessage,
      getCurrentSessionId,
      setCurrentSessionId,
      getCurrentModel,
      setSessionData,
      getDefaultSystemMessage,
      enrichPromptWithTabContext,
      showTyping,
      removeTyping,
      addBotMessage,
      onSessionCreated,
      onUsageUpdated,
    } = deps;

    async function ensureSession() {
      const utils = root.utils || {};
      const sendToBackground = utils.sendToBackground;
      const agents = root.agents || {};

      const existingSessionId = getCurrentSessionId();
      if (existingSessionId) return existingSessionId;

      try {
        const config = {};
        const sysVal = document.getElementById("config-system-message")?.value;
        const systemParts = [getDefaultSystemMessage()];
        const selectedAgent = agents.findAgentById?.(agents.getSelectedAgentId?.());
        if (selectedAgent?.systemPrompt) systemParts.push(selectedAgent.systemPrompt);
        if (sysVal) systemParts.push(sysVal);
        config.systemMessage = systemParts.join("\n\n");

        const currentModel = getCurrentModel();
        if (currentModel) config.model = currentModel;

        const res = await sendToBackground({ type: "CREATE_SESSION", config });
        if (res && res.sessionId) {
          setCurrentSessionId(res.sessionId);
          setSessionData(res);
          utils.invalidateCache?.("sessions");
          if (typeof AchievementEngine !== "undefined") {
            AchievementEngine.track("chat_session_new");
          }
          onSessionCreated?.();
          return res.sessionId;
        }
      } catch (err) {
        utils.showToast?.(localizeRuntimeMessage("建立 Session 失敗: ") + err.message);
      }
      return null;
    }

    async function fallbackSend(text, files = []) {
      const utils = root.utils || {};
      const sendToBackground = utils.sendToBackground;

      showTyping();
      try {
        const sid = getCurrentSessionId() || (await ensureSession());
        if (!sid) {
          removeTyping();
          addBotMessage(localizeRuntimeMessage("⚠ 無法建立 Session"));
          return;
        }
        const attachments = files.map((file) => ({
          name: file.name, type: file.type, size: file.size,
          dataUrl: file.dataUrl, textContent: file.textContent || null, isImage: file.isImage,
        }));
        const enrichedPrompt = await enrichPromptWithTabContext(text);
        const res = await sendToBackground({ type: "SEND_AND_WAIT", sessionId: sid, prompt: enrichedPrompt, attachments });
        removeTyping();
        const reply = res?.content || res?.text || res?.message || JSON.stringify(res);
        addBotMessage(reply);
        onUsageUpdated?.(res, reply);
      } catch (err) {
        removeTyping();
        addBotMessage("⚠ " + err.message);
      }
    }

    return {
      ensureSession,
      fallbackSend,
    };
  };
})(window);
