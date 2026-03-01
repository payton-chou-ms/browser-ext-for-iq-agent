/**
 * Demo 5 & 6 — Foundry Agents + Image Generation
 */
import { test, expect } from "@playwright/test";
import { launchExtension, sendAndWaitForReply, resetChat, goToChat, AGENT_TIMEOUT, CONNECTION_TIMEOUT } from "./demo-helper.js";

test.describe("Demo 5-6: Foundry Agents & Gen Img", () => {
  test.describe.configure({ mode: "serial" });

  let context, page;

  test.beforeAll(async () => {
    test.setTimeout(CONNECTION_TIMEOUT + 30000); // Extra buffer for browser launch
    ({ context, page } = await launchExtension());
  });
  test.afterAll(async () => { await context?.close(); });

  test("5-1 Foundry UM agent answers product question", async () => {
    test.slow();
    await goToChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "/foundry_agent_skills um-semantic-agent to check Which projectors support Short Throw?",
      AGENT_TIMEOUT,
    );
    const text = await bot.textContent();
    expect(text.length).toBeGreaterThan(20);
  });

  test("5-2 Foundry PKM agent troubleshooting", async () => {
    test.slow();
    await resetChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "/foundry_agent_skills pkm-semantic-agent to check How do I fix projector screen flickering?",
      AGENT_TIMEOUT,
    );
    const text = await bot.textContent();
    expect(text.length).toBeGreaterThan(20);
  });

  test("5-3 Foundry Fabric agent specs lookup", async () => {
    test.slow();
    await resetChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "/foundry_agent_skills fabric-specs-agent to check What is the resolution of 4KB257?",
      AGENT_TIMEOUT,
    );
    const text = await bot.textContent();
    expect(text.length).toBeGreaterThan(10);
  });

  test("6 /gen_img generates an image response", async () => {
    test.slow();
    await resetChat(page);
    const bot = await sendAndWaitForReply(
      page,
      "/gen_img Generate a cute cat picture",
      AGENT_TIMEOUT,
    );
    const html = await bot.innerHTML();
    const hasImage = html.includes("<img") || html.includes("http") || html.includes("image");
    const text = await bot.textContent();
    expect(hasImage || text.length > 10).toBeTruthy();
  });
});
