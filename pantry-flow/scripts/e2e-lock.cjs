// A run lock for the four reserved e2e accounts: two runs at once would reset each
// other's accounts. The long-lived runner (run-e2e.cjs) holds it; short-lived fixture
// commands only check it (their own pid is dead by the time anyone looks).
const fs = require('node:fs');
const path = require('node:path');

const lockFile = root => path.join(root, '.verification', 'e2e-run.lock');

// EPERM means the process exists but belongs to someone else: still alive.
function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

function holder(file, isAliveFn) {
  let lock;
  try { lock = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
  return Number.isInteger(lock?.pid) && isAliveFn(lock.pid) ? lock.pid : null;
}

function acquireRunLock(file, pid, isAliveFn) {
  const other = holder(file, isAliveFn);
  if (other !== null) throw new Error(`Another e2e run is active (pid ${other})`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ pid, startedAt: new Date().toISOString() }));
}

function releaseRunLock(file, pid) {
  let lock;
  try { lock = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return; }
  if (lock?.pid === pid) fs.rmSync(file, { force: true });
}

function assertNoOtherRun(file, allowedPid, isAliveFn) {
  const other = holder(file, isAliveFn);
  if (other !== null && other !== allowedPid) throw new Error(`Another e2e run is active (pid ${other})`);
}

module.exports = { lockFile, isAlive, acquireRunLock, releaseRunLock, assertNoOtherRun };
