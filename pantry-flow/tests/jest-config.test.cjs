const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const jestBin = require.resolve('jest/bin/jest');
const jest = (cwd, ...args) => spawnSync(process.execPath, [jestBin, ...args], { cwd, encoding: 'utf8', timeout: 120000 });

// A project below a dot folder, with the real Jest config and the given empty test files.
// Returns the test files Jest lists there, relative to that project.
function listBelowDotFolder(t, files) {
  const parent = path.join(project, '.verification');
  fs.mkdirSync(parent, { recursive: true });
  const copy = fs.mkdtempSync(path.join(parent, 'jest-config-'));
  t.after(() => fs.rmSync(copy, { recursive: true, force: true }));
  fs.copyFileSync(path.join(project, 'jest.config.cjs'), path.join(copy, 'jest.config.cjs'));
  for (const file of files) {
    fs.mkdirSync(path.join(copy, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(copy, file), '');
  }
  const run = jest(copy, '--listTests');
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.split(/\r?\n/).filter(Boolean).map(f => path.relative(copy, f).split(path.sep).join('/'));
}

test('a component run that matches no test fails', () => {
  const run = jest(project, '--runInBand', 'no-component-test-has-this-name');
  assert.match(run.stdout + run.stderr, /No tests found/);
  assert.equal(run.status, 1);
});

// On Windows, Jest keeps the backslash before a dot when it expands <rootDir>, so a checkout
// below a folder such as .verification matched no component test at all.
test('component tests are found when the project lies below a dot folder', t => {
  const listed = listBelowDotFolder(t, ['tests/components/sample.test.tsx', 'tests/sample.test.tsx']);
  assert.deepEqual(listed, ['tests/components/sample.test.tsx']);
});

test('test copies in .verification and dist are not run when the project lies below a dot folder', t => {
  const listed = listBelowDotFolder(t, [
    'tests/components/sample.test.tsx',
    '.verification/old/tests/components/copy.test.tsx',
    'dist/tests/components/copy.test.tsx',
  ]);
  assert.deepEqual(listed, ['tests/components/sample.test.tsx']);
});
