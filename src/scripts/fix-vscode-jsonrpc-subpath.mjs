#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const packageDir = path.join(root, "node_modules", "vscode-jsonrpc");
const targetPath = path.join(packageDir, "node");
const sourcePath = path.join(packageDir, "node.js");
const shimSource = "module.exports = require('./node.js');\n";

if (!fs.existsSync(sourcePath)) {
  console.log("[postinstall] vscode-jsonrpc/node.js not found; skipping subpath shim");
  process.exit(0);
}

if (fs.existsSync(targetPath)) {
  console.log("[postinstall] vscode-jsonrpc/node already exists; leaving installed package untouched");
  process.exit(0);
}

fs.writeFileSync(targetPath, shimSource, "utf8");
console.log("[postinstall] wrote vscode-jsonrpc/node compatibility shim");