import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const SRC_DIR = join(import.meta.dirname, '..', 'src');
const MIN_SUFFIX = '.min.js';

function collectJs(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) continue;
    if (extname(entry) !== '.js' || basename(entry).endsWith(MIN_SUFFIX)) continue;
    files.push(full);
  }
  return files;
}

const files = collectJs(SRC_DIR);

const results = await Promise.allSettled(files.map(async (f) => {
  try {
    await execFileP('node', ['--check', f]);
  } catch (err) {
    const stderr = err.stderr || err.message || '';
    throw new Error(`${f}: ${stderr.trim().split('\n').pop() || 'syntax error'}`);
  }
}));

let failed = 0;
for (const r of results) {
  if (r.status === 'rejected') {
    console.error(`FAIL: ${r.reason.message}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) failed syntax check.`);
  process.exit(1);
}

console.log(`OK: ${files.length} file(s) passed syntax check.`);
