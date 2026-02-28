import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const watchedDir = projectRoot;
const ignoredDirs = new Set(['node_modules', '.git', 'playwright-report', 'test-results']);
const allowedExtensions = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css']);

let running = false;
let pending = false;
let debounceTimer;

const isIgnored = (relativePath) => {
  if (!relativePath) return true;
  const parts = relativePath.split(path.sep);
  return parts.some((part) => ignoredDirs.has(part));
};

const isRelevantFile = (relativePath) => {
  const ext = path.extname(relativePath);
  return allowedExtensions.has(ext);
};

const runTests = () => {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  const child = spawn('npm', ['test', '--', 'tests/extension.spec.js'], {
    stdio: 'inherit',
    cwd: projectRoot,
  });

  child.on('exit', () => {
    running = false;
    if (pending) {
      pending = false;
      runTests();
    }
  });
};

const scheduleRun = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runTests();
  }, 400);
};

console.log('Watching files for changes...');
console.log('Press Ctrl+C to stop.');

watch(watchedDir, { recursive: true }, (_eventType, filename) => {
  if (!filename) return;
  const relativePath = filename.toString();
  if (isIgnored(relativePath)) return;
  if (!isRelevantFile(relativePath)) return;
  scheduleRun();
});

runTests();
