const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load } = require('./helpers.cjs');
const { FLOWS } = require('../scripts/e2e-flows.cjs');

// Wiring: the real e2e-fixtures command code runs against a stubbed stack, so the lock guard
// is proven to sit in front of everything that can mutate or clean up, without a local stack.
const source = fs.readFileSync(path.join(__dirname, '../scripts/e2e-fixtures.ts'), 'utf8');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-fixtures-lock-'));
  const calls = [];
  const stack = { key: 'anon', admin: {}, client: () => ({}) };
  const mod = load('scripts/e2e-fixtures.ts', {
    '../tests/integration/local-stack': {
      appRoot: dir, emails: [], password: 'x',
      localStack: () => { calls.push('localStack'); return stack; },
      fixtures: async () => { calls.push('fixtures'); throw new Error('fixtures stub failed'); },
      cleanup: async () => { calls.push('cleanup'); },
    },
    '../tests/integration/confirmation-mail': { confirmationLink: async () => '', messages: async () => [], openVerification: async () => ({}) },
    './e2e-locale': { e2eLocaleEnv: () => ({}) },
  });
  const lock = path.join(dir, 'run.lock');
  // The holder is this very process: alive, and not the runner pid unless a test says so.
  const hold = pid => fs.writeFileSync(lock, JSON.stringify({ pid, root: 'C:/other', startedAt: new Date().toISOString() }));
  return { dir, calls, mod, lock, hold, env: extra => ({ PANTRY_E2E_LOCK_FILE: lock, ...extra }),
    done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// The commands are the keys of the `handlers` object literal in the source, read from the TypeScript AST
// (not a regex), so an unquoted key or an inline arrow entry is seen and rejected, not skipped.
const ts = require('typescript');
const sourceFile = ts.createSourceFile('e2e-fixtures.ts', source, ts.ScriptTarget.Latest, true);
function handlerMap() {
  let literal;
  sourceFile.forEachChild(node => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'handlers') literal = declaration.initializer;
    }
  });
  assert.ok(literal && ts.isObjectLiteralExpression(literal), 'the source must declare `const handlers = { ... }`');
  return literal.properties.map(property => {
    assert.ok(ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer),
      `every handlers entry must be \`'command': namedFunction\`: ${property.getText(sourceFile)}`);
    const key = property.name;
    assert.ok(ts.isStringLiteral(key), `handlers keys must be quoted strings: ${property.getText(sourceFile)}`);
    return { command: key.text, handler: property.initializer.text };
  });
}
const mapped = handlerMap();

// Every command literal in the source, so a command added later cannot dodge the guard test.
const commands = [...new Set([
  ...mapped.map(entry => entry.command),
  ...FLOWS.map(flow => `seed:${flow.name}`), ...FLOWS.map(flow => `verify:${flow.name}`),
  'unknown-command',
])];

test('the handler map has exactly one entry per handler function', () => {
  const handlerFunctions = sourceFile.statements
    .filter(node => ts.isFunctionDeclaration(node) && node.name && node.name.text !== 'runSeed'
      && node.parameters.length === 1 && node.parameters[0].type?.getText(sourceFile) === 'Stack')
    .map(node => node.name.text);
  assert.deepEqual(mapped.map(entry => entry.handler).sort(), handlerFunctions.sort());
  assert.equal(new Set(mapped.map(entry => entry.command)).size, mapped.length, 'no duplicate commands');
  assert.equal(mapped.length, 12);
});

test('commands are dispatched only through the handler map, never by comparing the command', () => {
  // Allow-list: the one legitimate use is the lookup guard that decides whether the map has the command.
  const allowed = 'command !== undefined && Object.hasOwn(handlers, command)';
  const stripped = source.split(allowed).join('');
  assert.doesNotMatch(stripped, /\bcommand\s*[!=]==?|switch\s*\(\s*command\s*\)/);
  assert.equal(source.split(allowed).length - 1, 1, 'the allow-listed lookup appears exactly once');
});

test('the command list covers every mutating command', () => {
  for (const name of ['prepare', 'cleanup', 'confirmation-first', 'confirmation-reset', 'confirmation-expired', 'confirmation-resent', 'verify:confirmation', 'seed:confirmation']) {
    assert.ok(commands.includes(name), name);
  }
});

test('a seed refused by a live run calls neither fixtures nor cleanup, and builds no stack', async () => {
  const t = setup();
  try {
    t.hold(process.pid);
    await assert.rejects(t.mod.runCommand('seed:slice-3-entry', t.env({})), /^Error: Another e2e run is active \(pid \d+, C:\/other\)/);
    assert.deepEqual(t.calls, []);
  } finally { t.done(); }
});

test('without a live run the same seed reaches fixtures, and its own failure cleans up', async () => {
  const t = setup();
  try {
    await assert.rejects(t.mod.runCommand('seed:slice-3-entry', t.env({})), /fixtures stub failed/);
    assert.deepEqual(t.calls, ['localStack', 'fixtures', 'cleanup']);
  } finally { t.done(); }
});

test('every command is refused while another live run holds the lock, before any stack or cleanup', async () => {
  for (const command of commands) {
    const t = setup();
    try {
      t.hold(process.pid);
      await assert.rejects(t.mod.runCommand(command, t.env({ PANTRY_E2E_RUNNER_PID: String(process.pid + 1) })),
        /Another e2e run is active/, command);
      assert.deepEqual(t.calls, [], command);
    } finally { t.done(); }
  }
});

test('standalone cleanup is refused while a live run holds the lock', async () => {
  const t = setup();
  try {
    t.hold(process.pid);
    await assert.rejects(t.mod.runCommand('cleanup', t.env({})), /Another e2e run is active/);
    assert.deepEqual(t.calls, []);
  } finally { t.done(); }
});

test("the runner's own cleanup and prepare are allowed through via its pid", async () => {
  const t = setup();
  try {
    t.hold(process.pid);
    const env = t.env({ PANTRY_E2E_RUNNER_PID: String(process.pid) });
    await t.mod.runCommand('cleanup', env);
    assert.deepEqual(t.calls, ['localStack', 'cleanup']);
    await assert.rejects(t.mod.runCommand('prepare', env), /fixtures stub failed/);
    assert.deepEqual(t.calls, ['localStack', 'cleanup', 'localStack', 'fixtures', 'cleanup']);
  } finally { t.done(); }
});

test('cleanup after the run released the lock, or over a dead holder, is allowed', async () => {
  const t = setup();
  try {
    await t.mod.runCommand('cleanup', t.env({}));
    t.hold(2 ** 22 + 12345); // a pid that is not running
    await t.mod.runCommand('cleanup', t.env({}));
    assert.deepEqual(t.calls, ['localStack', 'cleanup', 'localStack', 'cleanup']);
  } finally { t.done(); }
});
