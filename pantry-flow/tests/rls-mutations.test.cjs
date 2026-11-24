const test = require('node:test');
const assert = require('node:assert/strict');
const { outputName, validateTarget, validateDockerEnvironment, requireDetector, sanitize } = require('../scripts/check-rls-mutations.cjs');
const { assertLocalRunAllowed, withLocalRunLock } = require('../scripts/run-local-db.cjs');
const { acquireRunLock, releaseRunLock } = require('../scripts/e2e-lock.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('mutation output cannot traverse outside the ignored evidence directory', () => {
  assert.equal(outputName([]), 'rls-write-mutations');
  assert.equal(outputName(['--out', 'fresh-run-2']), 'fresh-run-2');
  for (const args of [['--out', '../outside'], ['--out', 'C:/outside'], ['--out', '.'], ['--host', 'remote']]) {
    assert.throws(() => outputName(args), /output stays under/);
  }
});

test('mutation runner accepts only the pinned disposable project and local engine', () => {
  const config = 'project_id = "pantryflow-tests"';
  const status = { API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgresql://unused@127.0.0.1:54322/postgres' };
  const labels = { 'com.supabase.cli.project': 'pantryflow-tests' };
  const check = (cfg = config, target = status, endpoint = 'unix:///var/run/docker.sock', identity = labels, version = '17.11') =>
    validateTarget(cfg, target, endpoint, identity, version);
  assert.doesNotThrow(() => check());
  assert.throws(() => check('project_id = "production"'), /dedicated test project/);
  assert.throws(() => check(config, { ...status, API_URL: 'https://hosted.invalid' }), /pinned local API/);
  assert.throws(() => check(config, { ...status, DB_URL: 'postgresql://unused@hosted.invalid:54322/postgres' }), /pinned local database/);
  assert.throws(() => check(config, status, 'tcp://remote:2375'), /remote Docker/);
  assert.throws(() => check(config, status, 'unix:///var/run/docker.sock', {}), /disposable test project/);
  assert.throws(() => check(config, status, 'unix:///var/run/docker.sock', labels, '15.19'), /PostgreSQL 17/);
});

test('Docker overrides cannot redirect mutations away from the validated context', () => {
  assert.doesNotThrow(() => validateDockerEnvironment({}));
  assert.throws(() => validateDockerEnvironment({ DOCKER_HOST: 'tcp://remote:2375' }), /target overrides/);
  assert.throws(() => validateDockerEnvironment({ DOCKER_CONTEXT: 'another-context' }), /target overrides/);
});

test('ordinary local database and integration entry points refuse a live mutation lock', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rls-lock-'));
  const file = path.join(dir, 'run.lock');
  const env = { PANTRY_E2E_LOCK_FILE: file };
  try {
    acquireRunLock(file, process.pid, () => true, dir);
    assert.throws(() => assertLocalRunAllowed(env), /Another e2e run is active/);
    assert.doesNotThrow(() => assertLocalRunAllowed({ ...env, PANTRY_E2E_RUNNER_PID: String(process.pid) }));
    releaseRunLock(file, process.pid);
    assert.doesNotThrow(() => assertLocalRunAllowed(env));
  } finally {
    releaseRunLock(file, process.pid);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('local suites hold the shared lock throughout execution and release it after failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rls-suite-lock-'));
  const file = path.join(dir, 'run.lock');
  const env = { PANTRY_E2E_LOCK_FILE: file };
  try {
    assert.throws(() => withLocalRunLock(childEnv => {
      assert.throws(() => assertLocalRunAllowed(env), /Another e2e run is active/);
      withLocalRunLock(() => assert.ok(fs.existsSync(file)), childEnv);
      assert.ok(fs.existsSync(file), 'nested child must not release its parent lock');
      throw new Error('suite failed');
    }, env), /suite failed/);
    assert.ok(!fs.existsSync(file), 'failed suite releases its own lock');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('mutant detection requires the corresponding explicit foreign-state failure', () => {
  const policy = 'items_update_member';
  const label = `${policy}: foreign state unchanged`;
  assert.doesNotThrow(() => requireDetector({ exit: 1, text: `not ok 3 - ${label}` }, policy, true));
  assert.doesNotThrow(() => requireDetector({ exit: 1, text: `# Failed test 3: "${label}"` }, policy, true));
  assert.doesNotThrow(() => requireDetector({ exit: 1, text: `${label}\nERR_ASSERTION\n# fail 1` }, policy, false));
  for (const result of [{ exit: 0, text: label }, { exit: null, text: label }, { exit: 1, text: 'setup failed' },
    { exit: 1, text: `${label}\n# fail 0\n# cancelled 1` }]) {
    assert.throws(() => requireDetector(result, policy, false));
  }
  assert.throws(() => requireDetector({ exit: 1, text: `not ok 3 - shopping_update_member: foreign state unchanged` }, policy, true));
  assert.throws(() => requireDetector({ exit: 1, text: `not ok 3 - ${label}\nnot ok 4 - other failure` }, policy, true));
});

test('published mutation diagnostics omit synthetic fixture identifiers and credential labels', () => {
  const text = sanitize('password: example-value\npf.test.bare-write.12345678.0@example.com\n00000000-0000-0000-0000-000000000001');
  assert.ok(!text.includes('example-value'));
  assert.ok(!text.includes('@example.com'));
  assert.ok(!text.includes('00000000-0000-0000-0000-000000000001'));
});
