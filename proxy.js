#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const noBuild = args.includes("--no-build");

const distProxyPath = path.resolve("dist/proxy.js");
const sourceProxyPath = path.resolve("proxy.ts");

function shouldBuild() {
  if (noBuild) return false;

  if (!fs.existsSync(distProxyPath)) return true;
  if (!fs.existsSync(sourceProxyPath)) return true;

  const distMtimeMs = fs.statSync(distProxyPath).mtimeMs;
  const sourceMtimeMs = fs.statSync(sourceProxyPath).mtimeMs;

  return distMtimeMs < sourceMtimeMs;
}

if (shouldBuild()) {
  console.log("[proxy-launcher] Building TypeScript proxy...");
  const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
    stdio: "inherit",
    env: process.env,
  });

  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
} else if (noBuild) {
  console.log("[proxy-launcher] Skipping build (--no-build).");
} else {
  console.log("[proxy-launcher] Skipping build (dist/proxy.js is up to date).");
}

await import("./dist/proxy.js");
