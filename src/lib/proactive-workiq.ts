import type child_process from "node:child_process";
import { execFileAsync } from "../routes/core.js";
import { createUnavailableProactiveResult, normalizeProactiveResult } from "./proactive-result.js";

type ProactiveKind = "briefing" | "deadlines" | "ghosts" | "meeting-prep";

type ResolveProactiveWorkIqArgs = {
  kind: ProactiveKind;
  prompt: string;
  promptOverride?: string;
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
  execFile,
  log,
}: ResolveProactiveWorkIqArgs): Promise<{ content: string; data: Record<string, unknown>; usedCliFallback: boolean }> {
  try {
    const content = await runDirectCliPrompt(prompt, execFile);
    const normalized = normalizeProactiveResult(kind, content, promptOverride);
    return {
      content,
      data: finalizeProactiveData(normalized),
      usedCliFallback: false,
    };
  } catch (err) {
    log?.("WARN", `Proactive Work IQ direct CLI failed: ${(err as Error).message}`);
  }

  return {
    content: "",
    data: finalizeProactiveData(createUnavailableProactiveResult(kind, "Live Work IQ / M365 data is unavailable in this session.")),
    usedCliFallback: false,
  };
}