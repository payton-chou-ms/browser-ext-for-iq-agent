import type child_process from "node:child_process";
import { createUnavailableProactiveResult, normalizeProactiveResult } from "./proactive-result.js";
import { runWorkIqCliPrompt } from "./workiq-cli.js";

type ProactiveKind = "briefing" | "deadlines" | "ghosts" | "meeting-prep";

type ResolveProactiveWorkIqArgs = {
  kind: ProactiveKind;
  prompt: string;
  promptOverride?: string;
  execFile: typeof child_process.execFile;
  log?: (tag: string, ...msg: unknown[]) => void;
};

function finalizeProactiveData(data: Record<string, unknown>) {
  const liveDataConfirmed = !(data.unavailable === true || data._parseError === true);
  return {
    ...data,
    liveDataConfirmed,
    liveDataSource: liveDataConfirmed ? "skill" : "none",
  };
}

async function runDirectCliPrompt(prompt: string, execFile: typeof child_process.execFile): Promise<string> {
  return await runWorkIqCliPrompt({ prompt, execFile });
}

export async function resolveProactiveWorkIqResult({
  kind,
  prompt,
  promptOverride = "",
  execFile,
  log,
}: ResolveProactiveWorkIqArgs): Promise<{ content: string; data: Record<string, unknown> }> {
  try {
    const content = await runDirectCliPrompt(prompt, execFile);
    const normalized = normalizeProactiveResult(kind, content, promptOverride);
    return {
      content,
      data: finalizeProactiveData(normalized),
    };
  } catch (err) {
    log?.("WARN", `Proactive Work IQ direct CLI failed: ${(err as Error).message}`);
  }

  return {
    content: "",
    data: finalizeProactiveData(createUnavailableProactiveResult(kind, "Live Work IQ / M365 data is unavailable in this session.")),
  };
}