import type child_process from "node:child_process";
import { createUnavailableProactiveResult, normalizeProactiveResult } from "./proactive-result.js";
import { createWorkIqExecutionMeta } from "./workiq-execution.js";
import { runWorkIqCliPrompt, WORKIQ_SKILL_COMMAND } from "./workiq-cli.js";
import type { WorkIqExecutionMeta } from "../shared/types.js";

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

function toProactiveExecutionMeta(data: Record<string, unknown>): WorkIqExecutionMeta {
  const liveDataConfirmed = data.liveDataConfirmed === true;
  return createWorkIqExecutionMeta({
    toolUsed: `${WORKIQ_SKILL_COMMAND} via copilot -p`,
    unavailable: data.unavailable === true,
    liveDataConfirmed,
    liveDataSource: liveDataConfirmed ? "skill" : "none",
  });
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
}: ResolveProactiveWorkIqArgs): Promise<{ content: string; data: Record<string, unknown>; meta: WorkIqExecutionMeta }> {
  try {
    const content = await runDirectCliPrompt(prompt, execFile);
    const normalized = finalizeProactiveData(normalizeProactiveResult(kind, content, promptOverride));
    return {
      content,
      data: normalized,
      meta: toProactiveExecutionMeta(normalized),
    };
  } catch (err) {
    log?.("WARN", `Proactive Work IQ direct CLI failed: ${(err as Error).message}`);
  }

  const unavailableData = finalizeProactiveData(createUnavailableProactiveResult(kind, "Live Work IQ / M365 data is unavailable in this session."));

  return {
    content: "",
    data: unavailableData,
    meta: toProactiveExecutionMeta(unavailableData),
  };
}