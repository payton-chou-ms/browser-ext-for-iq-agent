#!/usr/bin/env node
/**
 * Syncs version from package.json to manifest.json
 * Run: node scripts/sync-version.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const pkgPath = path.join(root, 'package.json');
const manifestPath = path.join(root, 'manifest.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (pkg.version !== manifest.version) {
  console.log(`Syncing version: ${manifest.version} → ${pkg.version}`);
  manifest.version = pkg.version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('✔ manifest.json updated');
} else {
  console.log(`✔ Versions already in sync (${pkg.version})`);
}
