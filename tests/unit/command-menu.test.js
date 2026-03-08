import { afterEach, describe, expect, test, vi } from "vitest";

async function loadCommandMenu() {
  vi.resetModules();
  document.body.innerHTML = `
    <div id="command-menu"></div>
    <textarea id="chat-input"></textarea>
    <button id="btn-command-menu"></button>
  `;

  const sendToBackground = vi.fn();
  const sendMessageStreaming = vi.fn(async () => undefined);
  const addUserMessage = vi.fn();
  const addBotMessage = vi.fn();
  const updateStats = vi.fn();

  window.IQ = {
    state: { CONFIG: { DEFAULT_MODEL: "gpt-4.1" } },
    utils: {
      sendToBackground,
      cachedSendToBackground: vi.fn(),
      escapeHtml: (value) => String(value),
      debugLog: vi.fn(),
    },
    connection: {
      isConnected: vi.fn(() => true),
    },
    chat: {
      addUserMessage,
      addBotMessage,
      sendMessageStreaming,
      getState: vi.fn(() => ({
        currentSessionId: "session-1",
        availableModels: [],
      })),
    },
    panels: {
      usage: {
        updateStats,
      },
    },
    i18n: {
      localizeRuntimeMessage: (message) => message,
    },
  };

  await import("../../src/lib/command-menu.js");

  return {
    commandMenu: window.IQ.commandMenu,
    sendToBackground,
    sendMessageStreaming,
    addUserMessage,
    addBotMessage,
    updateStats,
  };
}

afterEach(() => {
  delete window.IQ;
  document.body.innerHTML = "";
});

describe("command menu /workiq routing", () => {
  test("explicit /workiq routes Chinese query through WorkIQ backend", async () => {
    const {
      commandMenu,
      sendToBackground,
      addUserMessage,
      addBotMessage,
    } = await loadCommandMenu();
    sendToBackground.mockResolvedValue({
      ok: true,
      content: "找到 3 份 AKS 相關投影片",
    });

    const handled = await commandMenu.handleSlashCommand("/workiq 給我跟 aks 主題相關的投影片");

    expect(handled).toBe(true);
    expect(addUserMessage).toHaveBeenCalledWith("/workiq 給我跟 aks 主題相關的投影片");
    expect(sendToBackground).toHaveBeenCalledWith({
      type: "WORKIQ_QUERY",
      query: "給我跟 aks 主題相關的投影片",
      sessionId: "session-1",
    });
    expect(addBotMessage).toHaveBeenCalledWith("找到 3 份 AKS 相關投影片", {
      source: "workiq",
      sourceLabel: "WorkIQ",
    });
  });

  test("keeps document lookup query on Work IQ path", async () => {
    const {
      commandMenu,
      sendToBackground,
      sendMessageStreaming,
      addBotMessage,
    } = await loadCommandMenu();
    sendToBackground.mockResolvedValue({
      ok: true,
      content: "Title: Microsoft Foundry Overview Deck",
    });

    const handled = await commandMenu.handleSlashCommand("/workiq check latest microsoft foundry deck");

    expect(handled).toBe(true);
    expect(sendToBackground).toHaveBeenCalledWith({
      type: "WORKIQ_QUERY",
      query: "check latest microsoft foundry deck",
      sessionId: "session-1",
    });
    expect(addBotMessage).toHaveBeenCalledWith("Title: Microsoft Foundry Overview Deck", {
      source: "workiq",
      sourceLabel: "WorkIQ",
    });
    expect(sendMessageStreaming).not.toHaveBeenCalled();
  });

  test("does not block explicit /workiq on stale disconnected UI state", async () => {
    const {
      commandMenu,
      sendToBackground,
      addBotMessage,
    } = await loadCommandMenu();

    window.IQ.connection.isConnected.mockReturnValue(false);
    sendToBackground.mockResolvedValue({
      ok: true,
      content: "找到 2 份 AKS 相關文件",
    });

    const handled = await commandMenu.handleSlashCommand("/workiq 給我跟 aks 主題相關的文件");

    expect(handled).toBe(true);
    expect(sendToBackground).toHaveBeenCalledWith({
      type: "WORKIQ_QUERY",
      query: "給我跟 aks 主題相關的文件",
      sessionId: "session-1",
    });
    expect(addBotMessage).toHaveBeenCalledWith("找到 2 份 AKS 相關文件", {
      source: "workiq",
      sourceLabel: "WorkIQ",
    });
  });
});