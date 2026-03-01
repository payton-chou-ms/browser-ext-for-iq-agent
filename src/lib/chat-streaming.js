(function initIQChatStreaming(global) {
  const root = global.IQ || (global.IQ = {});

  root.chatStreamingFactory = function createChatStreamingFactory(deps) {
    const {
      localizeRuntimeMessage,
      ensureSession,
      fallbackSend,
      enrichPromptWithTabContext,
      showTyping,
      removeTyping,
      createStreamingBotMessage,
      pushChatHistory,
      getToolCalls,
      getTokenDetails,
      getStats,
      onUsageUpdated,
    } = deps;

    function createToolCallCard(name, args) {
      const template = document.getElementById("tool-call-template");
      if (!template) return null;
      const card = template.querySelector(".tool-call-card").cloneNode(true);
      card.classList.add("running");
      card.querySelector(".tool-call-name").textContent = name;
      card.querySelector(".tool-call-status").textContent = "";
      card.querySelector(".tool-call-status").className = "tool-call-status running";
      card.querySelector(".tool-call-args").textContent = typeof args === "string" ? args : JSON.stringify(args, null, 2);
      card.querySelector(".tool-call-result").textContent = localizeRuntimeMessage("等待結果...");
      card.dataset.toolName = name;

      const now = Date.now();
      const entry = { name, status: "running", timestamp: new Date().toISOString(), startedAt: now, endedAt: null, args, result: null };
      const toolCalls = getToolCalls();
      toolCalls.push(entry);
      card.dataset.toolIndex = toolCalls.length - 1;

      return card;
    }

    function updateToolCallCard(card, status, result) {
      if (!card) return;
      // Update card class for spinner/check/error icons
      card.classList.remove("running", "success", "error");
      card.classList.add(status === "success" ? "success" : status === "error" ? "error" : "running");
      
      const statusEl = card.querySelector(".tool-call-status");
      if (statusEl) {
        statusEl.textContent = status === "success" ? "成功" : status === "error" ? "失敗" : "";
        statusEl.className = "tool-call-status " + (status === "success" ? "success" : status === "error" ? "error" : "running");
      }
      if (result != null) {
        const resultEl = card.querySelector(".tool-call-result");
        if (resultEl) resultEl.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      }

      const idx = parseInt(card.dataset.toolIndex, 10);
      const toolCalls = getToolCalls();
      if (!isNaN(idx) && toolCalls[idx]) {
        toolCalls[idx].status = status;
        toolCalls[idx].result = result;
        toolCalls[idx].endedAt = Date.now();

      }
    }

    function safeDisconnectPort(port) {
      if (!port) return;
      try { port.disconnect(); } catch { /* ignore */ }
    }

    async function sendMessageStreaming(text, files = []) {
      const utils = root.utils || {};
      const escapeHtml = utils.escapeHtml || ((s) => s);
      const formatText = utils.formatText || ((s) => s);
      const debugLog = utils.debugLog || console.log;

      const sid = await ensureSession();
      if (!sid) {
        await fallbackSend(text, files);
        return;
      }

      showTyping();
      let bubble = null;
      let content = "";
      let currentToolCard = null;
      let toolCallsContainer = null;
      let streamDone = false;
      let pendingRender = null;

      // Batched render - coalesces rapid message_delta updates to next frame
      function scheduleRender() {
        if (pendingRender) return;
        pendingRender = requestAnimationFrame(() => {
          pendingRender = null;
          if (bubble) {
            bubble.innerHTML = formatText(content);
            utils.scrollToBottom?.();
          }
        });
      }

      const attachments = files.map((file) => ({
        name: file.name, type: file.type, size: file.size,
        dataUrl: file.dataUrl, textContent: file.textContent || null, isImage: file.isImage,
      }));

      let port = null;
      try {
        port = chrome.runtime.connect({ name: "copilot-stream" });

        port.onMessage.addListener((msg) => {
          if (msg.type === "STREAM_EVENT") {
            removeTyping();
            if (!bubble) bubble = createStreamingBotMessage();

            const evt = msg.data || {};
            const evtData = evt.data || {};

            if (evt.type === "assistant.message_delta" && (evtData.deltaContent || evtData.content)) {
              content += evtData.deltaContent || evtData.content;
              scheduleRender();  // Batched - avoid reflow on every delta
            }
            if (evt.type === "assistant.message" && evtData.content) {
              content = evtData.content;
              // Immediate render for final message (ensures complete content shown)
              if (pendingRender) cancelAnimationFrame(pendingRender);
              bubble.innerHTML = formatText(content);
              utils.scrollToBottom?.();
            }
            if (evt.type === "tool.execution_start") {
              const toolName = evtData.toolName || evtData.name || "tool";
              const toolArgs = evtData.arguments || evtData.args || "";
              if (typeof AchievementEngine !== "undefined") {
                AchievementEngine.track("agent_call", { agentType: toolName });
              }
              currentToolCard = createToolCallCard(toolName, toolArgs);
              if (currentToolCard) {
                // Create container if not exists
                if (!toolCallsContainer) {
                  toolCallsContainer = document.createElement("div");
                  toolCallsContainer.className = "tool-calls-container";
                  bubble.parentElement.appendChild(toolCallsContainer);
                }
                toolCallsContainer.appendChild(currentToolCard);
                utils.scrollToBottom?.();
              }
            }
            if (evt.type === "tool.execution_complete") {
              updateToolCallCard(currentToolCard, "success", evtData.result || evtData.output || "done");
              currentToolCard = null;
            }
            if (evt.type === "session.error") {
              const errMsg = evtData.message || "Session error";
              content += `\n⚠ ${errMsg}`;
              bubble.innerHTML = formatText(content);
              if (currentToolCard) updateToolCallCard(currentToolCard, "error", errMsg);
            }

            if (evt.type === "assistant.usage") {
              const tokenDetails = getTokenDetails();
              const stats = getStats();
              tokenDetails.apiCalls++;
              if (evtData.inputTokens) tokenDetails.inputTokens += evtData.inputTokens;
              if (evtData.outputTokens) tokenDetails.outputTokens += evtData.outputTokens;
              if (evtData.cacheReadTokens) tokenDetails.cacheReadTokens += evtData.cacheReadTokens;
              if (evtData.cacheWriteTokens) tokenDetails.cacheWriteTokens += evtData.cacheWriteTokens;
              if (evtData.cost) tokenDetails.cost += evtData.cost;
              stats.tokens = tokenDetails.inputTokens + tokenDetails.outputTokens;
              debugLog("USAGE", `tokens in=${evtData.inputTokens || 0} out=${evtData.outputTokens || 0} model=${evtData.model || "-"}`);
              onUsageUpdated?.();
            }

            if (evt.type === "session.usage_info" && evtData.currentTokens) {
              debugLog("USAGE", `context tokens=${evtData.currentTokens} limit=${evtData.tokenLimit}`);
            }
          }

          if (msg.type === "STREAM_DONE") {
            streamDone = true;
            removeTyping();
            getToolCalls().forEach((tc) => { if (tc.status === "running") { tc.status = "success"; tc.endedAt = Date.now(); } });
            if (!bubble) bubble = createStreamingBotMessage();
            if (!content) {
              const final = msg.data?.content || msg.data?.text || "";
              if (final) {
                content = final;
                bubble.innerHTML = formatText(content);
              }
            }
            const streamEl = document.getElementById("streaming-msg");
            if (streamEl) streamEl.removeAttribute("id");
            pushChatHistory({ role: "bot", content });
            safeDisconnectPort(port);
          }

          if (msg.type === "STREAM_ERROR") {
            streamDone = true;
            removeTyping();
            getToolCalls().forEach((tc) => { if (tc.status === "running") { tc.status = "error"; tc.endedAt = Date.now(); } });
            if (!bubble) bubble = createStreamingBotMessage();
            const errText = msg.error || msg.message || localizeRuntimeMessage("串流錯誤");
            bubble.innerHTML = `<span style="color:var(--error)">⚠ ${escapeHtml(errText)}</span>`;
            const streamEl = document.getElementById("streaming-msg");
            if (streamEl) streamEl.removeAttribute("id");
            pushChatHistory({ role: "bot", content: errText });
            if (currentToolCard) updateToolCallCard(currentToolCard, "error", errText);
            safeDisconnectPort(port);
          }
        });

        port.onDisconnect.addListener(() => {
          if (!streamDone) {
            removeTyping();
            if (!content) fallbackSend(text);
          }
        });

        const enrichedPrompt = await enrichPromptWithTabContext(text);
        port.postMessage({ type: "STREAM_SEND", sessionId: sid, prompt: enrichedPrompt, attachments });
      } catch {
        safeDisconnectPort(port);
        removeTyping();
        await fallbackSend(text, files);
      }
    }

    return {
      createToolCallCard,
      updateToolCallCard,
      safeDisconnectPort,
      sendMessageStreaming,
    };
  };
})(window);
