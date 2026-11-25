'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { assertNoOtherRun, acquireRunLock, releaseRunLock, lockFile, isAlive } = require('./e2e-lock.cjs');
const root = path.resolve(__dirname, '..');

function assertLocalRunAllowed(env = process.env) {
  assertNoOtherRun(lockFile(env), Number(env.PANTRY_E2E_RUNNER_PID) || null, isAlive);
}

function inheritedOwner(file, env) {
  const pid = Number(env.PANTRY_E2E_RUNNER_PID);
  if (!pid || !isAlive(pid)) return false;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')).pid === pid; } catch { return false; }
}

function withLocalRunLock(run, env = process.env) {
  const file = lockFile(env);
  assertLocalRunAllowed(env);
  if (inheritedOwner(file, env)) return run(env);
  acquireRunLock(file, process.pid, isAlive, root);
  try { return run({ ...env, PANTRY_E2E_RUNNER_PID: String(process.pid) }); }
  finally { releaseRunLock(file, process.pid); }
}

function integrationFiles(files) {
  if (!files.length || files.some(file => !/^tests\/integration\/[a-z-]+\.integration\.ts$/.test(file))) {
    throw new Error('Expected explicit integration test paths');
  }
  return files;
}

function runChild(args, env) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runDatabase(command, env) {
  const args = command === 'reset' ? ['db', 'reset', '--local'] : ['test', 'db'];
  return runChild([path.join(root, 'node_modules/supabase/dist/supabase.js'), ...args], env);
}

function runIntegration(files, env) {
  return runChild(['node_modules/tsx/dist/cli.mjs', '--test', '--test-randomize', '--test-concurrency=1', ...integrationFiles(files)], env);
}

function main() {
  const command = process.argv[2];
  if (!['reset', 'test', 'integration', 'local'].includes(command)) throw new Error('Expected reset, test, integration or local');
  if (command !== 'integration' && process.argv.length !== 3) throw new Error('Unexpected database command arguments');
  process.exitCode = withLocalRunLock(env => {
    if (command === 'integration') return runIntegration(process.argv.slice(3), env);
    if (command !== 'local') return runDatabase(command, env);
    const reset = runDatabase('reset', env);
    if (reset) return reset;
    const sql = runDatabase('test', env);
    if (sql) return sql;
    const { scripts } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return runIntegration(scripts['test:integration'].split(/\s+/).slice(3), env);
  });
}

module.exports = { assertLocalRunAllowed, withLocalRunLock };
if (require.main === module) {
  try { main(); } catch {
    // An exception may carry process/environment details; child command diagnostics
    // are already emitted separately. Never print the exception object or message.
    console.error('Local database command could not complete. Check its arguments and the shared test-run lock.');
    process.exitCode = 1;
  }
}
