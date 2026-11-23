// A run lock for the four reserved e2e accounts: two runs at once would reset each
// other's accounts. The long-lived runner (run-e2e.cjs) holds it; short-lived fixture
// commands only check it (their own pid is dead by the time anyone looks).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// One lock per machine, not per worktree: every worktree shares the same local Supabase
// stack and the same four reserved accounts. The override is for tests and CI.
const lockFile = () => process.env.PANTRY_E2E_LOCK_FILE || path.join(os.tmpdir(), 'pantryflow-e2e-run.lock');

// EPERM means the process exists but belongs to someone else: still alive.
function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

function read(file) {
  try { const lock = JSON.parse(fs.readFileSync(file, 'utf8')); return Number.isInteger(lock?.pid) ? lock : null; } catch { return null; }
}

function holder(file, isAliveFn) {
  const lock = read(file);
  return lock && isAliveFn(lock.pid) ? lock : null;
}

function busy(file, lock) {
  const where = lock.root ? `, ${lock.root}` : '';
  return new Error(`Another e2e run is active (pid ${lock.pid}${where}). If no e2e run is active, delete ${file}.`);
}

function acquireRunLock(file, pid, isAliveFn, root) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; ; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx');
      try { fs.writeSync(fd, JSON.stringify({ pid, root, startedAt: new Date().toISOString() })); } finally { fs.closeSync(fd); }
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const other = holder(file, isAliveFn);
      if (other) throw busy(file, other);
      // Dead or unreadable holder: take over once; a second collision means a live racer.
      if (attempt > 0) throw busy(file, read(file) ?? { pid: 'unknown' });
      fs.rmSync(file, { force: true });
    }
  }
}

function releaseRunLock(file, pid) {
  if (read(file)?.pid === pid) fs.rmSync(file, { force: true });
}

function assertNoOtherRun(file, allowedPid, isAliveFn) {
  const other = holder(file, isAliveFn);
  if (other && other.pid !== allowedPid) throw busy(file, other);
}

module.exports = { lockFile, isAlive, acquireRunLock, releaseRunLock, assertNoOtherRun };
