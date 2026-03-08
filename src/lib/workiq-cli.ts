import type child_process from "node:child_process";

import { execFileAsync } from "../routes/core.js";
import { WORKIQ_CLI_TIMEOUT_MS } from "../shared/runtime-constants.js";

export const WORKIQ_SKILL_COMMAND = "/workiq:workiq";
export { WORKIQ_CLI_TIMEOUT_MS };

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