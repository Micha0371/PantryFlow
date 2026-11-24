'use strict';
// Runs tests/*.test.cjs in random order. Extra node options are passed on, for example
// `npm test -- --test-concurrency=2` on a machine with little memory.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { nodeTestFiles } = require('./test-files.cjs');

function main() {
  const root = path.join(__dirname, '..');
  const files = nodeTestFiles(path.join(root, 'tests')).map(f => path.join('tests', f));
  const run = spawnSync(process.execPath, ['--test', '--test-randomize', ...process.argv.slice(2), ...files], { cwd: root, stdio: 'inherit' });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
