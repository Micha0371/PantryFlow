const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PASSING = "require('node:test')('passes', () => {});\n";
const FAILING = "require('node:test')('fails', () => { throw new Error('boom'); });\n";

// Runs a copy of the real script in a throwaway project with the given test files.
function runScript(t, script, tests) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-runners-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'tests'));
  fs.cpSync(path.join(__dirname, '../scripts'), path.join(dir, 'scripts'), { recursive: true });
  for (const [name, text] of Object.entries(tests)) fs.writeFileSync(path.join(dir, 'tests', name), text);
  // inside a node test, a child `node --test` would otherwise report success without running anything
  const { NODE_TEST_CONTEXT: _, ...env } = process.env;
  const r = spawnSync(process.execPath, [path.join('scripts', script)], { cwd: dir, encoding: 'utf8', env, timeout: 120000 });
  return { status: r.status, output: r.stdout + r.stderr };
}

test('run-node-tests fails when there is no test file', t => {
  const r = runScript(t, 'run-node-tests.cjs', {});
  assert.equal(r.status, 1, r.output);
  assert.match(r.output, /No \*\.test\.cjs files found/);
});

test('run-node-tests runs every test file and passes', t => {
  const r = runScript(t, 'run-node-tests.cjs', { 'a.test.cjs': PASSING, 'b.test.cjs': PASSING, 'helpers.cjs': FAILING });
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /tests 2\b/);
});

test('run-node-tests fails when a test fails', t => {
  const r = runScript(t, 'run-node-tests.cjs', { 'a.test.cjs': PASSING, 'b.test.cjs': FAILING });
  assert.equal(r.status, 1, r.output);
  assert.match(r.output, /fail 1\b/);
});

test('run-tests-alone fails when there is no test file', t => {
  const r = runScript(t, 'run-tests-alone.cjs', {});
  assert.equal(r.status, 1, r.output);
  assert.match(r.output, /No \*\.test\.cjs files found/);
});

test('run-tests-alone fails for a test file without any test', t => {
  const r = runScript(t, 'run-tests-alone.cjs', { 'a.test.cjs': PASSING, 'empty.test.cjs': '\n' });
  assert.equal(r.status, 1, r.output);
  assert.match(r.output, /empty\.test\.cjs :: \(no top-level tests found\)/);
});

test('run-tests-alone passes when every test passes alone', t => {
  const r = runScript(t, 'run-tests-alone.cjs', { 'a.test.cjs': PASSING });
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /ran 1 top-level tests alone across 1 files/);
});
