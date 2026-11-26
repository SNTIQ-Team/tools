#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? discover(filename)
      : /\.test\.(?:ts|tsx|mjs|cjs)$/.test(entry.name) ? [filename] : [];
  });
}
const tests = discover(path.join(root, 'apps/web')).sort();
if (!tests.length) throw new Error('No test files discovered');
const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--test', ...tests], {
  cwd: path.join(root, 'apps/web'), stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
