const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { androidRelevant, rerunNeeded } = require('../scripts/android-relevance.cjs');

// What starts the Android e2e job on its own, and when a new head needs it again. A miss here
// skips a run that was needed, so the default for anything unknown under pantry-flow/ is "relevant".

test('app code, e2e flows and harness, native config, database and the workflow are Android-relevant', () => {
  for (const file of [
    'pantry-flow/app/(tabs)/index.tsx', 'pantry-flow/components/Button.tsx', 'pantry-flow/hooks/usePantryItems.tsx',
    'pantry-flow/lib/auth-timeout.ts', 'pantry-flow/plugins/with-backup-exclusion.cjs', 'pantry-flow/app.json',
    'pantry-flow/package.json', 'pantry-flow/package-lock.json', 'pantry-flow/babel.config.js',
    'pantry-flow/.maestro/slice-1-1.yaml', 'pantry-flow/.maestro/helpers/wait-write.js',
    'pantry-flow/scripts/e2e-proxy.cjs', 'pantry-flow/scripts/build-e2e.cjs', 'pantry-flow/scripts/run-local-db.cjs',
    'pantry-flow/tests/integration/local-stack.ts', 'pantry-flow/supabase/migrations/20261101_x.sql',
    'pantry-flow/supabase/config.toml', '.github/workflows/pantryflow-tests.yml',
    'pantry-flow/something-new/file.ts',
  ]) assert.equal(androidRelevant([file]).relevant, true, file);
});

test('docs, Jira tooling, other workflows, unit and component tests are not Android-relevant', () => {
  for (const file of [
    'docs/testing/coverage-matrix.md', 'tools/jira/jira.py', '.github/workflows/jira-tooling.yml',
    '.github/pull_request_template.md', 'README.md', 'pantry-flow/README.md', 'pantry-flow/docs/notes.md',
    'pantry-flow/tests/data-timeout.test.cjs', 'pantry-flow/tests/helpers.cjs',
    'pantry-flow/tests/list-provider-contract.cjs', 'pantry-flow/tests/components/Button.test.tsx',
  ]) assert.equal(androidRelevant([file]).relevant, false, file);
});

test('one relevant file among irrelevant ones makes the change relevant, and the reasons name it', () => {
  const result = androidRelevant(['docs/a.md', 'pantry-flow/tests/x.test.cjs', 'pantry-flow/lib/pantry-data.ts', '']);
  assert.equal(result.relevant, true);
  assert.deepEqual(result.files, ['pantry-flow/lib/pantry-data.ts']);
  assert.deepEqual(androidRelevant([]), { relevant: false, files: [] });
});

test('a test file outside tests/ or a nested unit test path is still relevant', () => {
  assert.equal(androidRelevant(['pantry-flow/scripts/x.test.cjs']).relevant, true);
  assert.equal(androidRelevant(['pantry-flow/tests/integration/behavior.integration.ts']).relevant, true);
  assert.equal(androidRelevant(['pantry-flow/tests/integration/x.test.cjs']).relevant, true);
});

test('the CLI reads changed files on stdin and prints the GitHub output line', () => {
  const script = path.join(__dirname, '../scripts/android-relevance.cjs');
  const run = input => execFileSync(process.execPath, [script], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  assert.equal(run('docs/a.md\npantry-flow/lib/x.ts\n'), 'android=true\n');
  assert.equal(run('docs/a.md\n'), 'android=false\n');
  assert.equal(run(''), 'android=false\n');
});

// Rule 3: after a green Android run on commit G, a new head H needs a run again only when the PR's
// own Android-relevant changes differ. Commits merged in from main are checked by main's own run.
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-relevance-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'test'); git('config', 'commit.gpgsign', 'false');
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
  const commit = (files, message) => { for (const [file, text] of Object.entries(files)) write(file, text); git('add', '-A'); git('commit', '-q', '-m', message); return git('rev-parse', 'HEAD'); };
  commit({ 'pantry-flow/lib/a.ts': 'a1', 'pantry-flow/lib/b.ts': 'b1', 'docs/d.md': 'd1' }, 'base');
  return { dir, git, commit, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('merging main into a green branch needs no new run when the branch\'s own relevant changes are unchanged', () => {
  const r = repo();
  try {
    r.git('checkout', '-q', '-b', 'feature');
    const green = r.commit({ 'pantry-flow/lib/a.ts': 'a2' }, 'feature change');
    r.git('checkout', '-q', 'main');
    r.commit({ 'pantry-flow/lib/b.ts': 'b2' }, 'main moves on');
    r.git('checkout', '-q', 'feature');
    r.git('merge', '-q', '--no-edit', 'main');
    const result = rerunNeeded({ green, head: 'HEAD', base: 'main', cwd: r.dir });
    assert.deepEqual(result, { needed: false, files: [] });
  } finally { r.cleanup(); }
});

test('a new relevant change on the branch after the green run needs a new run and names the file', () => {
  const r = repo();
  try {
    r.git('checkout', '-q', '-b', 'feature');
    const green = r.commit({ 'pantry-flow/lib/a.ts': 'a2' }, 'feature change');
    r.commit({ 'pantry-flow/lib/b.ts': 'b3' }, 'another app change');
    assert.deepEqual(rerunNeeded({ green, head: 'HEAD', base: 'main', cwd: r.dir }), { needed: true, files: ['pantry-flow/lib/b.ts'] });
  } finally { r.cleanup(); }
});

test('a docs-only change after the green run needs no new run; reverting a relevant change does', () => {
  const r = repo();
  try {
    r.git('checkout', '-q', '-b', 'feature');
    const green = r.commit({ 'pantry-flow/lib/a.ts': 'a2' }, 'feature change');
    r.commit({ 'docs/d.md': 'd2' }, 'docs');
    assert.deepEqual(rerunNeeded({ green, head: 'HEAD', base: 'main', cwd: r.dir }), { needed: false, files: [] });
    r.commit({ 'pantry-flow/lib/a.ts': 'a1' }, 'revert the feature change');
    assert.deepEqual(rerunNeeded({ green, head: 'HEAD', base: 'main', cwd: r.dir }), { needed: true, files: ['pantry-flow/lib/a.ts'] });
  } finally { r.cleanup(); }
});

test('when main changed a file the branch also changed, the merged result needs a new run', () => {
  const r = repo();
  try {
    r.git('checkout', '-q', '-b', 'feature');
    r.commit({ 'pantry-flow/lib/a.ts': 'a2\nshared\n' }, 'feature change');
    const green = r.git('rev-parse', 'HEAD');
    r.git('checkout', '-q', 'main');
    r.commit({ 'pantry-flow/lib/a.ts': 'a1\nshared\nmain line\n', 'pantry-flow/lib/b.ts': 'b2' }, 'main touches a.ts too');
    r.git('checkout', '-q', 'feature');
    try { r.git('merge', '-q', '--no-edit', 'main'); } catch {
      r.commit({ 'pantry-flow/lib/a.ts': 'a2\nshared\nmain line\n' }, 'resolve');
    }
    assert.deepEqual(rerunNeeded({ green, head: 'HEAD', base: 'main', cwd: r.dir }), { needed: true, files: ['pantry-flow/lib/a.ts'] });
  } finally { r.cleanup(); }
});
