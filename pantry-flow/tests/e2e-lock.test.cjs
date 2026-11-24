const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { lockFile, acquireRunLock, releaseRunLock, assertNoOtherRun } = require('../scripts/e2e-lock.cjs');

// Each test owns a fresh folder, so no lock state is shared between tests.
function withLock(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-lock-'));
  try { body(path.join(dir, 'nested', 'e2e-run.lock')); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const alive = () => true;
const dead = () => false;

test('acquiring writes a fresh lock with pid and start time', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(lock.pid, 111);
  assert.ok(!Number.isNaN(Date.parse(lock.startedAt)));
}));

test('a lock held by a live pid blocks another run', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  assert.throws(() => acquireRunLock(file, 222, alive, 'C:/other'), { message: /^Another e2e run is active \(pid 111\)\. If no e2e run is active, delete .+e2e-run\.lock\.$/ });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, 111);
}));

test('the error names the holder root and the lock file', () => withLock(file => {
  acquireRunLock(file, 111, alive, 'C:/wt-a/pantry-flow');
  assert.throws(() => acquireRunLock(file, 222, alive, 'C:/wt-b'), error =>
    error.message.startsWith('Another e2e run is active (pid 111, C:/wt-a/pantry-flow)') && error.message.includes(file));
  assert.throws(() => assertNoOtherRun(file, null, alive), /pid 111, C:\/wt-a\/pantry-flow/);
}));

test('a corrupt lock file is taken over', () => withLock(file => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'not json');
  acquireRunLock(file, 222, alive);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, 222);
}));

test('two acquires in a row: the second is refused', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  assert.throws(() => acquireRunLock(file, 111, alive), /^Error: Another e2e run is active/);
}));

test('the lock path is machine-wide by default and overridable', () => {
  const saved = process.env.PANTRY_E2E_LOCK_FILE;
  try {
    delete process.env.PANTRY_E2E_LOCK_FILE;
    assert.equal(lockFile(), path.join(os.tmpdir(), 'pantryflow-e2e-run.lock'));
    process.env.PANTRY_E2E_LOCK_FILE = 'X:/custom.lock';
    assert.equal(lockFile(), 'X:/custom.lock');
  } finally {
    if (saved === undefined) delete process.env.PANTRY_E2E_LOCK_FILE; else process.env.PANTRY_E2E_LOCK_FILE = saved;
  }
});

test('a lock held by a dead pid is replaced', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  acquireRunLock(file, 222, dead);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, 222);
}));

test('release by another pid keeps the lock', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  releaseRunLock(file, 222);
  assert.ok(fs.existsSync(file));
}));

test('release by the owner removes the lock', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  releaseRunLock(file, 111);
  assert.ok(!fs.existsSync(file));
  releaseRunLock(file, 111); // releasing a missing lock is harmless
}));

test('assertNoOtherRun allows the allowed pid', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  assert.doesNotThrow(() => assertNoOtherRun(file, 111, alive));
}));

test('assertNoOtherRun throws for another live pid, also without an allowed pid', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  assert.throws(() => assertNoOtherRun(file, 222, alive), { message: /^Another e2e run is active \(pid 111\)\. If no e2e run is active, delete .+e2e-run\.lock\.$/ });
  assert.throws(() => assertNoOtherRun(file, null, alive), { message: /^Another e2e run is active \(pid 111\)\. If no e2e run is active, delete .+e2e-run\.lock\.$/ });
}));

test('assertNoOtherRun ignores a dead pid and a missing file', () => withLock(file => {
  assert.doesNotThrow(() => assertNoOtherRun(file, null, alive));
  acquireRunLock(file, 111, alive);
  assert.doesNotThrow(() => assertNoOtherRun(file, 222, dead));
}));

test('a takeover leaves the lock complete and no temp or stale files behind', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  acquireRunLock(file, 222, pid => pid !== 111, 'C:/wt');
  const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(lock.pid, 222);
  assert.equal(lock.root, 'C:/wt');
  assert.deepEqual(fs.readdirSync(path.dirname(file)), [path.basename(file)]);
}));

test('a refused acquire leaves the live holder intact and no temp files behind', () => withLock(file => {
  acquireRunLock(file, 111, alive, 'C:/wt-a');
  assert.throws(() => acquireRunLock(file, 222, alive), /pid 111, C:\/wt-a/);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, 111);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), [path.basename(file)]);
}));

test('an empty lock file is taken over like a corrupt one', () => withLock(file => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  acquireRunLock(file, 222, alive);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, 222);
}));

test('a racer that replaced the stale lock first is not destroyed: its lock is put back and we are refused', () => withLock(file => {
  acquireRunLock(file, 111, alive);
  // The moment this run judges pid 111 dead, another run takes the lock over (pid 333, live).
  const racing = pid => {
    if (pid !== 111) return true;
    fs.rmSync(file);
    fs.writeFileSync(file, JSON.stringify({ pid: 333, root: 'C:/racer', startedAt: new Date().toISOString() }));
    return false;
  };
  assert.throws(() => acquireRunLock(file, 222, racing), /Another e2e run is active \(pid 333, C:\/racer\)/);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, 333);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), [path.basename(file)]);
}));
