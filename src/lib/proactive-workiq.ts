import type child_process from "node:child_process";
import { execFileAsync } from "../routes/core.js";
import { createUnavailableProactiveResult, normalizeProactiveResult } from "./proactive-result.js";

type ProactiveKind = "briefing" | "deadlines" | "ghosts" | "meeting-prep";

type SendPromptResult = {
  data?: {
    content?: string;
  };
};

type ResolveProactiveWorkIqArgs = {
  kind: ProactiveKind;
  prompt: string;
  promptOverride?: string;
  sendPrompt: (prompt: string) => Promise<SendPromptResult>;
  execFile: typeof child_process.execFile;
  log?: (tag: string, ...msg: unknown[]) => void;
};

const WORKIQ_CLI_TIMEOUT_MS = 180000;

function finalizeProactiveData(data: Record<string, unknown>) {
  const liveDataConfirmed = !(data.unavailable === true || data._parseError === true);
  return {
    ...data,
    liveDataConfirmed,
    liveDataSource: liveDataConfirmed ? "skill" : "none",
  };
}

async function runDirectCliPrompt(prompt: string, execFile: typeof child_process.execFile): Promise<string> {
  const { stdout } = await execFileAsync(
    execFile,
    "copilot",
    ["-p", prompt, "--allow-all-tools", "--silent"],
    {
      cwd: process.cwd(),
      timeout: WORKIQ_CLI_TIMEOUT_MS,
      env: process.env,
    },
  );

  return stdout.trim();
}

export async function resolveProactiveWorkIqResult({
  kind,
  prompt,
  promptOverride = "",
  sendPrompt,
  execFile,
  log,
}: ResolveProactiveWorkIqArgs): Promise<{ content: string; data: Record<string, unknown>; usedCliFallback: boolean }> {
  try {
    const result = await sendPrompt(prompt);
    const content = result?.data?.content ?? "";
    const normalized = normalizeProactiveResult(kind, content, promptOverride);
    const shouldFallback = !content.trim() || normalized.unavailable === true || normalized._parseError === true;

    if (!shouldFallback) {
      return {
        content,
        data: finalizeProactiveData(normalized),
        usedCliFallback: false,
      };
    }
  } catch (err) {
    log?.("WARN", `Proactive Work IQ headless path failed; trying direct CLI fallback: ${(err as Error).message}`);
  }

  try {
    const fallbackContent = await runDirectCliPrompt(prompt, execFile);
    if (fallbackContent.trim()) {
      const normalized = normalizeProactiveResult(kind, fallbackContent, promptOverride);
      return {
        content: fallbackContent,
        data: finalizeProactiveData(normalized),
        usedCliFallback: true,
      };
    }
  } catch (err) {
    log?.("WARN", `Proactive Work IQ direct CLI fallback failed: ${(err as Error).message}`);
  }

  return {
    content: "",
    data: finalizeProactiveData(createUnavailableProactiveResult(kind, "Live Work IQ / M365 data is unavailable in this session.")),
    usedCliFallback: false,
  };
}