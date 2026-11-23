const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { acquireRunLock, releaseRunLock, assertNoOtherRun } = require('../scripts/e2e-lock.cjs');

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
  assert.throws(() => acquireRunLock(file, 222, alive), { message: 'Another e2e run is active (pid 111)' });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, 111);
}));

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
  assert.throws(() => assertNoOtherRun(file, 222, alive), { message: 'Another e2e run is active (pid 111)' });
  assert.throws(() => assertNoOtherRun(file, null, alive), { message: 'Another e2e run is active (pid 111)' });
}));

test('assertNoOtherRun ignores a dead pid and a missing file', () => withLock(file => {
  assert.doesNotThrow(() => assertNoOtherRun(file, null, alive));
  acquireRunLock(file, 111, alive);
  assert.doesNotThrow(() => assertNoOtherRun(file, 222, dead));
}));
