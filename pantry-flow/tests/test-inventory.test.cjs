const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inventoryProblems } = require('../scripts/test-inventory.cjs');

const TEST = "test('a', () => {});\n";
const COMPLETE = {
  'package.json': JSON.stringify({ scripts: { 'test:integration': 'tsx --test tests/integration/a.integration.ts' } }),
  'jest.config.cjs': "module.exports = { testMatch: ['**/tests/components/**/*.test.tsx'] };\n",
  'tests/a.test.cjs': TEST,
  'tests/helpers.cjs': 'module.exports = {};\n',
  'tests/components/a.test.tsx': "it('a', () => {});\n",
  'tests/integration/a.integration.ts': TEST,
  'supabase/tests/database/a.test.sql': 'SELECT plan(1);\n',
  '.maestro/one.yaml': 'appId: x\n',
};

// The problems of a throwaway project: the complete one with the given files changed (null removes a file).
function problems(t, changes, flowFiles = ['one']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-inventory-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries({ ...COMPLETE, ...changes })) {
    if (text === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  return inventoryProblems(dir, flowFiles);
}

test('a project whose test files all belong to a runner has no problems', t => {
  assert.deepEqual(problems(t, {}), []);
});

test('a test file that no runner picks up is reported', t => {
  for (const file of ['tests/integration/new.integration.ts', 'tests/integration/new.test.ts', 'tests/nested/new.test.cjs',
    'tests/new.test.mjs', 'tests/new.test.tsx']) {
    assert.deepEqual(problems(t, { [file]: TEST }), [`${file}: no test runner picks this file up`]);
  }
});

test('a script that only names a longer path does not cover a file', t => {
  const scripts = { 'test:integration': 'tsx --test tests/integration/a.integration.ts tests/integration/my-new.integration.ts' };
  const changes = { 'package.json': JSON.stringify({ scripts }), 'tests/integration/my-new.integration.ts': TEST, 'tests/integration/new.integration.ts': TEST };
  assert.deepEqual(problems(t, changes), ['tests/integration/new.integration.ts: no test runner picks this file up']);
});

test('a test file without a test is reported, comments and strings do not count', t => {
  for (const file of ['tests/a.test.cjs', 'tests/components/a.test.tsx', 'tests/integration/a.integration.ts']) {
    for (const text of ['', "// test('a', () => {});\n", "const s = \"test('a', () => {})\";\n", "describe('a', () => {});\n"]) {
      assert.deepEqual(problems(t, { [file]: text }), [`${file}: declares no test`], text);
    }
  }
});

test('a Maestro flow that the runner does not use is reported, helpers are not flows', t => {
  assert.deepEqual(problems(t, { '.maestro/two.yaml': 'appId: x\n', '.maestro/helpers/login.yaml': 'appId: x\n' }),
    ['.maestro/two.yaml: the e2e runner does not use this flow']);
});

test('a runner without any file is reported', t => {
  const cases = [
    ['tests/a.test.cjs', 'node'],
    ['tests/components/a.test.tsx', 'component'],
    ['tests/integration/a.integration.ts', 'integration'],
    ['supabase/tests/database/a.test.sql', 'database'],
    ['.maestro/one.yaml', 'Maestro'],
  ];
  for (const [file, kind] of cases) assert.deepEqual(problems(t, { [file]: null }), [`no ${kind} test files found`]);
});

test('every test file of this project belongs to a runner', () => {
  assert.deepEqual(inventoryProblems(path.resolve(__dirname, '..')), []);
});
