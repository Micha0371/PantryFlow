'use strict';
// Destructive ONLY to the pinned disposable local test stack; never accepts a URL/project argument.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { acquireRunLock, releaseRunLock, lockFile, isAlive } = require('./e2e-lock.cjs');
const { redactStartupLog } = require('./redact-startup-log.cjs');
const root = path.resolve(__dirname, '..');
const container = 'supabase_db_pantryflow-tests';
const launcher = path.join(root, 'node_modules/supabase/dist/supabase.js');
const integration = 'tests/integration/write-isolation.integration.ts';
const sqlTest = 'supabase/tests/database/write_isolation.test.sql';
const mutants = [
  { policy: 'items_update_member', table: 'pantry_items', clause: 'USING (true) WITH CHECK (true)' },
  { policy: 'items_delete_member', table: 'pantry_items', clause: 'USING (true)' },
  { policy: 'shopping_update_member', table: 'pantry_shopping_items', clause: 'USING (true) WITH CHECK (true)' },
  { policy: 'shopping_delete_member', table: 'pantry_shopping_items', clause: 'USING (true)' },
  { policy: 'profiles_update_own', table: 'profiles', clause: 'USING (true) WITH CHECK (true)' },
  { policy: 'items_insert_member', table: 'pantry_items', clause: 'WITH CHECK (created_by = auth.uid())' },
  { policy: 'shopping_insert_member', table: 'pantry_shopping_items', clause: 'WITH CHECK (created_by = auth.uid())' },
];

function outputName(argv) {
  if (argv.length === 0) return 'rls-write-mutations';
  if (argv.length !== 2 || argv[0] !== '--out' || !/^[a-zA-Z0-9_-]+$/.test(argv[1])) {
    throw new Error('Usage: check-rls-mutations.cjs [--out <new-directory-name>]; output stays under .verification');
  }
  return argv[1];
}

function validateTarget(config, status, endpoint, labels, version) {
  assert.match(config, /^project_id = "pantryflow-tests"$/m, 'only the dedicated test project is allowed');
  assert.ok(status.API_URL === 'http://127.0.0.1:54321', 'only the pinned local API is allowed');
  const db = new URL(status.DB_URL);
  assert.ok(db.hostname === '127.0.0.1' && db.port === '54322' && db.pathname === '/postgres', 'only the pinned local database is allowed');
  assert.ok(endpoint.startsWith('npipe://') || endpoint.startsWith('unix://'), 'remote Docker contexts are forbidden');
  assert.equal(labels['com.supabase.cli.project'], 'pantryflow-tests', 'container must belong to the disposable test project');
  assert.match(version, /^17\./, 'PostgreSQL 17 is required');
}

function validateDockerEnvironment(env) {
  assert.ok(!env.DOCKER_HOST && !env.DOCKER_CONTEXT, 'Docker target overrides are forbidden for policy mutations');
}

function sanitize(text) {
  const roots = [root, root.replaceAll('\\', '/'), root.replaceAll('\\', '\\\\'), root.replace(/^[a-zA-Z]:/, '').replaceAll('\\', '/')];
  const cleaned = roots.reduce((result, prefix) => result.split(prefix).join('<app>'), redactStartupLog(text));
  return cleaned
    .replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<fixture-uuid>')
    .replace(/pf\.test\.[a-zA-Z0-9.-]+@example\.com/g, '<fixture-email>');
}

function command(exe, args, input) {
  const run = spawnSync(exe, args, { cwd: root, input, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, PANTRY_E2E_RUNNER_PID: String(process.pid) } });
  if (run.error) throw new Error(`Command did not complete: ${path.basename(exe)}`, { cause: run.error });
  return { exit: run.status, text: sanitize((run.stdout || '') + (run.stderr || '')) };
}

function successful(result, label) {
  assert.equal(result.exit, 0, `${label} must succeed before proceeding`);
  return result.text;
}

const cli = args => command(process.execPath, [launcher, ...args]);
const psql = sql => command('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], sql);
const policies = () => JSON.parse(successful(psql(`SELECT json_agg(p ORDER BY policyname) FROM
  (SELECT policyname,tablename,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public') p;`), 'policy snapshot'));

function integrationArgs(policy) {
  const args = ['node_modules/tsx/dist/cli.mjs', '--test', '--test-reporter=tap', '--test-randomize', '--test-concurrency=1'];
  if (policy) args.push(`--test-name-pattern=^${policy} HTTP `);
  return [...args, integration];
}

function saveRun(dir, name, exe, args) {
  const result = command(exe, args);
  fs.writeFileSync(path.join(dir, `${name}.log`), result.text);
  return { exit: result.exit, text: result.text, command: [path.basename(exe), ...args.map(arg => arg === launcher ? '<locked-supabase-cli>' : arg)] };
}

function baseline(out, name) {
  const dir = path.join(out, name);
  fs.mkdirSync(dir);
  successful(cli(['db', 'reset', '--local']), 'local reset');
  const sql = saveRun(dir, 'sql', process.execPath, [launcher, 'test', 'db', sqlTest]);
  const http = saveRun(dir, 'http', process.execPath, integrationArgs());
  successful(sql, 'intact SQL tests');
  successful(http, 'intact HTTP tests');
  assert.match(sql.text, /Tests=23\b/, 'SQL assertions must actually execute');
  assert.match(http.text, /# tests 7\b/, 'all seven HTTP tests must execute');
  return { sql: { exit: sql.exit, command: sql.command }, http: { exit: http.exit, command: http.command } };
}

function requireDetector(result, policy, sql) {
  assert.ok(result.exit !== null && result.exit !== 0, `${policy}: weakened policy must fail`);
  const message = `${policy}: foreign ${policy.includes('insert') ? 'row absent' : 'state unchanged'}`;
  assert.ok(result.text.includes(message), `${policy}: expected foreign-state assertion must be named`);
  if (sql) {
    const failures = result.text.split('\n').filter(line => /^\s*(?:not ok \d+|# Failed test \d+:)/.test(line));
    assert.ok(failures.some(line => line.includes(message)), `${policy}: SQL must fail the foreign-state assertion`);
    assert.ok(failures.every(line => line.includes(message) ||
      (policy.includes('insert') && line.includes(`${policy}: foreign minimal insert rejected`))),
    `${policy}: unrelated failures cannot establish a policy detector`);
  }
  else {
    assert.match(result.text, /ERR_ASSERTION/, `${policy}: HTTP must fail by assertion, not timeout/setup`);
    assert.match(result.text, /# fail 1\b/, `${policy}: exactly the targeted HTTP test must fail`);
  }
}

function mutate(out, spec) {
  successful(cli(['db', 'reset', '--local']), 'reset between mutants');
  const dir = path.join(out, spec.policy);
  fs.mkdirSync(dir);
  const before = policies().find(p => p.policyname === spec.policy);
  assert.ok(before, 'the policy being challenged must exist');
  const change = `ALTER POLICY ${spec.policy} ON public.${spec.table} ${spec.clause};\n`;
  fs.writeFileSync(path.join(dir, 'mutation.sql'), change);
  fs.writeFileSync(path.join(dir, 'policy-before.json'), JSON.stringify(before, null, 2) + '\n');
  successful(psql(change), 'apply one permissive policy change');
  const after = policies().find(p => p.policyname === spec.policy);
  assert.notDeepEqual(after, before, 'the policy restriction must actually be weakened');
  const beforeText = JSON.stringify(before, null, 2) + '\n';
  const afterText = JSON.stringify(after, null, 2) + '\n';
  fs.writeFileSync(path.join(dir, 'policy-after.json'), afterText);
  const beforeLines = beforeText.trimEnd().split('\n');
  const afterLines = afterText.trimEnd().split('\n');
  fs.writeFileSync(path.join(dir, 'mutation.diff'), [
    '--- policy-before.json', '+++ policy-after.json', `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
    ...beforeLines.map(line => '-' + line), ...afterLines.map(line => '+' + line), '',
  ].join('\n'));
  const sql = saveRun(dir, 'sql', process.execPath, [launcher, 'test', 'db', sqlTest]);
  const http = saveRun(dir, 'http', process.execPath, integrationArgs(spec.policy));
  requireDetector(sql, spec.policy, true);
  let httpOutcome = 'explicit foreign-state assertion failure';
  if (http.exit === 0) {
    assert.ok(!spec.policy.includes('insert'), 'HTTP INSERT mutants must fail their foreign-state assertion');
    assert.ok(http.text.includes(`${spec.policy}: bare HTTP blocked by gateway (21000)`), 'an HTTP survivor needs the specific gateway boundary');
    assert.match(http.text, /# pass 1\b/, 'the targeted HTTP test must actually run');
    httpOutcome = 'gateway rejected bare write (21000); not an RLS detector';
  } else requireDetector(http, spec.policy, false);
  console.log(`${spec.policy}: SQL foreign-state assertion detected mutant; HTTP: ${httpOutcome}`);
  return { policy: spec.policy, sql: { exit: sql.exit, command: sql.command }, http: { exit: http.exit, command: http.command, outcome: httpOutcome }, detectedBy: 'explicit SQL foreign-state assertion' };
}

function fingerprint() {
  const files = [integration, sqlTest, 'scripts/check-rls-mutations.cjs', 'scripts/run-local-db.cjs', 'tests/integration/local-stack.ts', 'package-lock.json', ...fs.readdirSync(path.join(root, 'supabase/migrations')).map(f => `supabase/migrations/${f}`)];
  return Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
}

function main() {
  const out = path.join(root, '.verification', outputName(process.argv.slice(2)));
  assert.ok(!fs.existsSync(out), 'refusing to overwrite historical evidence; choose a fresh --out name');
  assert.ok(!fs.existsSync(path.join(root, 'supabase/.temp/project-ref')), 'linked projects are forbidden');
  validateDockerEnvironment(process.env);
  const lock = lockFile();
  acquireRunLock(lock, process.pid, isAlive, root);
  let validated = false;
  const restore = () => { if (validated) successful(cli(['db', 'reset', '--local']), 'restore intact local database'); };
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    process.once(signal, () => { try { restore(); } finally { releaseRunLock(lock, process.pid); process.exit(code); } });
  }
  try {
    // Raw status contains local keys: parse in memory only, never save/print it.
    const statusRun = spawnSync(process.execPath, [launcher, 'status', '-o', 'json'], { cwd: root, encoding: 'utf8', timeout: 20000 });
    assert.equal(statusRun.status, 0, 'local status must succeed');
    const status = JSON.parse(statusRun.stdout);
    const endpoint = JSON.parse(successful(command('docker', ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']), 'Docker context'));
    const labels = JSON.parse(successful(command('docker', ['inspect', '--format', '{{json .Config.Labels}}', container]), 'container identity'));
    const version = successful(psql('SHOW server_version;'), 'database version').trim();
    validateTarget(fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8'), status, endpoint, labels, version);
    validated = true;
    fs.mkdirSync(out, { recursive: true });
    const result = { utc: new Date().toISOString(), sourceCommit: successful(command('git', ['rev-parse', 'HEAD']), 'source commit').trim(),
      dirty: successful(command('git', ['status', '--porcelain']), 'source status').trim() !== '',
      node: process.version, postgres: version,
      postgrestImage: successful(command('docker', ['inspect', '--format', '{{.Config.Image}}', 'supabase_rest_pantryflow-tests']), 'gateway image').trim(),
      files: fingerprint(), baselineBefore: baseline(out, 'baseline-before'), mutants: [], baselineAfter: null };
    try {
      for (const spec of mutants) result.mutants.push(mutate(out, spec));
      result.baselineAfter = baseline(out, 'baseline-after');
    } finally {
      fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 2) + '\n');
    }
    console.log('All seven SQL mutants detected; HTTP insert detectors/gateway boundaries recorded; intact baselines passed before and after.');
  } finally {
    try { restore(); } finally { releaseRunLock(lock, process.pid); }
  }
}

module.exports = { outputName, validateTarget, validateDockerEnvironment, requireDetector, sanitize };
if (require.main === module) {
  try { main(); } catch (error) { console.error(sanitize(error.message)); process.exitCode = 1; }
}
