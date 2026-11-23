const test = require('node:test');
const assert = require('node:assert/strict');
const { findViolations, analyze } = require('../scripts/check-test-independence.cjs');

const check = (text, path = 'fixture.test.cjs') => findViolations([{ path, text }]);
const rules = text => check(text).map(v => v.rule);
// Each case is [source, expected rule names]; the source is the failure message.
const expectRules = cases => {
  for (const [source, expected] of cases) assert.deepEqual(rules(source), expected, source);
};

test('module-state flags a file-level array mutated in a test', () => {
  expectRules([
    ["const announced = [];\ntest('a', () => { announced.push(1); });", ['module-state']],
  ]);
});

test('module-state flags a file-level let that a test reassigns', () => {
  expectRules([
    ["let n = 0;\ntest('a', () => { n++; });", ['module-state']],
  ]);
});

test('module-state follows a call from a test into a file-level function', () => {
  assert.deepEqual(rules("const log = new Map();\nfunction record() { log.set('a', 1); }\ntest('a', () => { record(); });"),
    ['module-state']);
});

test('module-state allows read-only constants, per-test arrays and subtests sharing constants', () => {
  expectRules([
    ["const theme = load('x');\ntest('a', () => { use(theme); });", []],
    ["test('a', () => { const arr = []; arr.push(1); });", []],
    ["const base = { a: 1 };\ntest('p', async t => {\n  await t.test('x', () => { use(base.a); });\n  await t.test('y', () => { use(base.a); });\n});", []],
  ]);
});

test('module-state ignores a file with no tests (a helper module)', () => {
  expectRules([
    ['const cache = [];\nfunction remember(x) { cache.push(x); }\nmodule.exports = { remember };', []],
  ]);
});

test('global-patch flags an unrestored assignment, including in a called helper', () => {
  expectRules([
    ["test('a', () => { global.fetch = f; });", ['global-patch']],
    ["function setup() { process.env.X = '1'; }\ntest('a', () => { setup(); });", ['global-patch']],
  ]);
});

test('global-patch allows a restore in finally, t.after or a file-level afterEach', () => {
  expectRules([
    ["test('a', () => { const original = global.fetch; global.fetch = f; try { run(); } finally { global.fetch = original; } });", []],
    ["test('a', t => { const original = globalThis.fetch; globalThis.fetch = f; t.after(() => { globalThis.fetch = original; }); });", []],
    ["afterEach(() => { global.fetch = original; });\ntest('a', () => { global.fetch = f; });", []],
    ["test('a', () => { process.env.X = '1'; try { run(); } finally { delete process.env.X; } });", []],
  ]);
});

test('global-patch ignores strings, load-time normalisation and per-test restore of another property', () => {
  expectRules([
    ["test('a', () => { fs.writeFileSync(p, 'global.fetch = 1'); });", []],
    ["delete process.env.EXPO_PUBLIC_DEFAULT_LOCALE;\ntest('a', () => {});", []],
    ["test('a', () => { global.fetch = f; try { run(); } finally { global.other = o; } });", ['global-patch']],
  ]);
});

test('fake-timers flags enable that is not directly followed by a protecting try', () => {
  expectRules([
    ["test('a', () => { mock.timers.enable(); render(); try { go(); } finally { mock.timers.reset(); } });", ['fake-timers']],
  ]);
});

test('fake-timers allows a protecting try and t.mock', () => {
  expectRules([
    ["test('a', () => { mock.timers.enable(); try { render(); go(); } finally { mock.timers.reset(); } });", []],
    ["test('a', t => { t.mock.timers.enable(); render(); });", []],
  ]);
});

test('fake-timers: jest.useFakeTimers needs useRealTimers in finally or afterEach', () => {
  expectRules([
    ["test('a', () => { jest.useFakeTimers(); run(); });", ['fake-timers']],
    ["afterEach(() => { jest.useRealTimers(); });\ntest('a', () => { jest.useFakeTimers(); run(); });", []],
  ]);
});

test('invisible-whitespace flags a literal no-break space and allows escapes, umlauts, emoji and a BOM', () => {
  expectRules([
    ["const s = 'a\u00A0b';", ['invisible-whitespace']],
    ["const s = 'a\\u00A0b';", []],
    ["const s = 'M\u00FCsli \u{1F95B}';", []],
    ["\uFEFFconst s = 1;", []],
    ["const s = 1;\uFEFF", ['invisible-whitespace']],
  ]);
});

test('focused-test flags only forms', () => {
  expectRules([
    ["test.only('a', () => {});", ['focused-test']],
    ["describe.only('a', () => {});", ['focused-test']],
    ["test('a', { only: true }, () => {});", ['focused-test']],
    ["// test.only is banned\nconst s = 'it.only(';", []],
  ]);
});

test('an independence-ok exemption with a reason is listed, without a reason it is still flagged', () => {
  const waived = analyze([{ path: 'a.test.cjs', text: "let n = 0;\ntest('a', () => {\n  // independence-ok: counter only seeds unique ids\n  n++;\n});" }]);
  assert.deepEqual(waived.violations, []);
  assert.deepEqual(waived.exemptions.map(e => [e.rule, e.line, e.reason]), [['module-state', 4, 'counter only seeds unique ids']]);
  const empty = check("let n = 0;\ntest('a', () => {\n  n++; // independence-ok:\n});");
  assert.deepEqual(empty.map(v => v.rule), ['module-state']);
});

test('CRLF and LF fixtures report the same line numbers', () => {
  const lf = "const a = [];\n\ntest('x', () => {\n  a.push(1);\n  global.fetch = f;\n});\n";
  const crlf = lf.replace(/\n/g, '\r\n');
  const lines = text => check(text).map(v => [v.rule, v.line]);
  assert.deepEqual(lines(crlf), lines(lf));
  assert.deepEqual(lines(lf), [['module-state', 4], ['global-patch', 5]]);
});

test('global-patch accepts a computed-key restore loop; fake-timers allows non-throwing declarations before the try', () => {
  expectRules([
    ["afterEach(() => { for (const [name, o] of pairs) { global[name] = o; } });\ntest('a', () => { global.raf = f; });", []],
    ["test('a', () => { mock.timers.enable(); let r; try { r = go(); } finally { mock.timers.reset(); } });", []],
    ["test('a', () => { mock.timers.enable(); const h = harness(); try { h.go(); } finally { mock.timers.reset(); } });", ['fake-timers']],
  ]);
});

test('module-state: describe-level bindings are shared by every test in the describe', () => {
  expectRules([
    ["describe('d', () => {\n  let n = 0;\n  const seen = [];\n  it('a', () => { n++; seen.push(1); });\n});", ['module-state', 'module-state']],
    ["describe('d', () => {\n  const base = { a: 1 };\n  it('a', () => { use(base.a); });\n  it('b', () => { const own = []; own.push(1); });\n});", []],
  ]);
});

test('module-state: a parent test local mutated inside a nested subtest is shared state', () => {
  expectRules([
    ["test('p', async t => {\n  const a = [];\n  await t.test('x', () => a.push(1));\n  await t.test('y', () => assert.equal(a.length, 1));\n});", ['module-state']],
    ["test('p', async t => {\n  let n = 0;\n  await t.test('x', () => { n += 1; });\n});", ['module-state']],
  ]);
});

test('module-state allows legitimate subtest structure', () => {
  // subtests that only read parent constants
  expectRules([
    ["test('p', async t => {\n  const base = [1];\n  await t.test('x', () => use(base[0]));\n  await t.test('y', () => use(base.length));\n});", []],
  ]);
  // the parent mutating its own locals outside any subtest
  expectRules([
    ["test('p', async t => {\n  const a = [];\n  a.push(1);\n  let n = 0;\n  n++;\n  await t.test('x', () => use(a));\n});", []],
  ]);
  // a binding declared and mutated inside the same subtest
  expectRules([
    ["test('p', async t => {\n  await t.test('x', () => { const a = []; a.push(1); let n = 0; n++; });\n});", []],
  ]);
});

test('invisible-whitespace allows ZWJ/ZWNJ between visible characters but flags them at an edge', () => {
  expectRules([
    ["const family = '\u{1F468}\u200D\u{1F469}';", []],
    ["const s = '\u200Dabc';", ['invisible-whitespace']],
    ["const s = 'abc\u200D';", ['invisible-whitespace']],
    ["const s = 'a \u200Db';", ['invisible-whitespace']],
    ["const s = 'a\u200Bb';", ['invisible-whitespace']],
  ]);
});

test('fake-timers: negative numbers and empty literals may precede the try, side-effecting initialisers may not', () => {
  const body = init => "test('a', () => { mock.timers.enable(); const x = " + init + "; try { go(); } finally { mock.timers.reset(); } });";
  for (const ok of ['-1', '{}', '[]']) assert.deepEqual(rules(body(ok)), [], ok);
  for (const bad of ['render()', '{ a: f() }', '[f()]']) assert.deepEqual(rules(body(bad)), ['fake-timers'], bad);
});

test('independence-ok waivers work the same in LF and CRLF files', () => {
  const lf = "let n = 0;\ntest('a', () => {\n  // independence-ok: counter only seeds unique ids\n  n++;\n});\n";
  const crlf = lf.replace(/\n/g, '\r\n');
  for (const text of [lf, crlf]) {
    const r = analyze([{ path: 'a.test.cjs', text }]);
    assert.deepEqual(r.violations, []);
    assert.deepEqual(r.exemptions.map(e => e.reason), ['counter only seeds unique ids']);
  }
  const noReason = "let n = 0;\r\ntest('a', () => {\r\n  n++; // independence-ok:\r\n});\r\n";
  const r = analyze([{ path: 'a.test.cjs', text: noReason }]);
  assert.deepEqual(r.violations.map(v => v.rule), ['module-state']);
  assert.deepEqual(r.exemptions, []);
});

test('independence-ok: a trailing waiver covers only its own line, a comment-only waiver also the next', () => {
  const trailing = "let n = 0;\nlet m = 0;\ntest('a', () => {\n  n++; // independence-ok: seeds ids\n  m++;\n});";
  const t = analyze([{ path: 'a.test.cjs', text: trailing }]);
  assert.deepEqual(t.violations.map(v => v.line), [5]);
  assert.deepEqual(t.exemptions.map(e => e.line), [4]);
  const above = "let n = 0;\ntest('a', () => {\n  // independence-ok: seeds ids\n  n++;\n});";
  assert.equal(analyze([{ path: 'a.test.cjs', text: above }]).violations.length, 0);
});

test('global-patch covers built-in globals written without `global.`', () => {
  for (const code of ['console.error = f;', 'Date.now = f;', 'Math.random = f;', 'JSON.stringify = f;', 'Intl.DateTimeFormat = f;']) {
    assert.deepEqual(rules(`test('a', () => { ${code} });`), ['global-patch'], code);
  }
  expectRules([
    ["test('a', () => { const original = console.error; console.error = f; try { run(); } finally { console.error = original; } });", []],
    ["test('a', t => { const o = Date.now; Date.now = f; t.after(() => { Date.now = o; }); });", []],
  ]);
  // a local named console is not the global
  expectRules([
    ["test('a', () => { const console = {}; console.error = f; });", []],
    ["function run(Math) { Math.random = f; }\ntest('a', () => { run({}); });", []],
  ]);
});

test('global-patch: file-level mock.method on a global needs a restore, t.mock.method never does', () => {
  expectRules([
    ["test('a', () => { mock.method(console, 'error', f); });", ['global-patch']],
    ["test('a', () => { mock.method(globalThis, 'fetch', f); });", ['global-patch']],
    ["test('a', () => { mock.method(Date, 'now', f); });", ['global-patch']],
    ["test('a', t => { t.mock.method(console, 'error', f); });", []],
    ["test('a', () => { const m = mock.method(console, 'error', f); try { run(); } finally { m.mock.restore(); } });", []],
    ["test('a', () => { mock.method(console, 'error', f); try { run(); } finally { mock.restoreAll(); } });", []],
    ["afterEach(() => { mock.reset(); });\ntest('a', () => { mock.method(console, 'error', f); });", []],
    ["test('a', () => { const m = mock.method(console, 'error', f); try { run(); } finally { other.mock.restore(); } });", ['global-patch']],
    ["test('a', () => { let m; try { m = mock.method(console, 'error', f); run(); } finally { if (m) m.mock.restore(); } });", []],
  ]);
  // a non-global target is not this rule's business; a local `console` is not the global
  expectRules([
    ["test('a', () => { mock.method(service, 'call', f); });", []],
    ["test('a', () => { const console = mk(); mock.method(console, 'error', f); });", []],
  ]);
});

test('global-patch: a file-level after hook runs once after all tests and is not a restore', () => {
  expectRules([
    ["test('a', () => { global.fetch = f; });\ntest('b', () => {});\nafter(() => { global.fetch = orig; });", ['global-patch']],
    ["test('a', () => { global.fetch = f; });\nafterAll(() => { global.fetch = orig; });", ['global-patch']],
    ["test('a', () => { global.fetch = f; });\nafterEach(() => { global.fetch = orig; });", []],
  ]);
});

test('the CLI exits 1 when it finds no test files', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'indep-empty-'));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'check-test-independence.cjs'), dir], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /No test files found/);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
