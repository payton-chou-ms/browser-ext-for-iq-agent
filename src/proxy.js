#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const noBuild = args.includes("--no-build");

const distProxyPath = path.resolve("dist/proxy.js");
const sourceRootPath = path.resolve("src");

function getNewestSourceMtimeMs(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;

  let newest = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, getNewestSourceMtimeMs(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;

    newest = Math.max(newest, fs.statSync(fullPath).mtimeMs);
  }

  return newest;
}

function shouldBuild() {
  if (noBuild) return false;

  if (!fs.existsSync(distProxyPath)) return true;

  const distMtimeMs = fs.statSync(distProxyPath).mtimeMs;
  const sourceMtimeMs = getNewestSourceMtimeMs(sourceRootPath);

  if (sourceMtimeMs === 0) return true;

  return distMtimeMs < sourceMtimeMs;
}

if (shouldBuild()) {
  console.log("[proxy-launcher] Building TypeScript proxy...");
  const build = spawnSync(process.execPath, ["src/scripts/build.mjs"], {
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

await import("../dist/proxy.js");
