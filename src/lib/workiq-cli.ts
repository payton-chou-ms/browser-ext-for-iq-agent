import type child_process from "node:child_process";

import { execFileAsync } from "../routes/core.js";

export const WORKIQ_SKILL_COMMAND = "/workiq:workiq";
export const WORKIQ_CLI_TIMEOUT_MS = 180000;

type RunWorkIqCliPromptArgs = {
  prompt: string;
  execFile: typeof child_process.execFile;
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export async function runWorkIqCliPrompt({
  prompt,
  execFile,
  cwd = process.cwd(),
  timeoutMs = WORKIQ_CLI_TIMEOUT_MS,
  env = process.env,
}: RunWorkIqCliPromptArgs): Promise<string> {
  const { stdout } = await execFileAsync(
    execFile,
    "copilot",
    ["-p", prompt, "--allow-all-tools", "--silent"],
    {
      cwd,
      timeout: timeoutMs,
      env,
    },
  );

  return stdout.trim();
}