const test = require('node:test');
const assert = require('node:assert/strict');
const { findViolations, analyze } = require('../scripts/check-test-independence.cjs');

const check = (text, path = 'fixture.test.cjs') => findViolations([{ path, text }]);
const rules = text => check(text).map(v => v.rule);

test('module-state flags a file-level array mutated in a test', () => {
  assert.deepEqual(rules("const announced = [];\ntest('a', () => { announced.push(1); });"), ['module-state']);
});

test('module-state flags a file-level let that a test reassigns', () => {
  assert.deepEqual(rules("let n = 0;\ntest('a', () => { n++; });"), ['module-state']);
});

test('module-state follows a call from a test into a file-level function', () => {
  assert.deepEqual(rules("const log = new Map();\nfunction record() { log.set('a', 1); }\ntest('a', () => { record(); });"),
    ['module-state']);
});

test('module-state allows read-only constants, per-test arrays and subtests sharing constants', () => {
  assert.deepEqual(rules("const theme = load('x');\ntest('a', () => { use(theme); });"), []);
  assert.deepEqual(rules("test('a', () => { const arr = []; arr.push(1); });"), []);
  assert.deepEqual(rules("const base = { a: 1 };\ntest('p', async t => {\n  await t.test('x', () => { use(base.a); });\n  await t.test('y', () => { use(base.a); });\n});"), []);
});

test('module-state ignores a file with no tests (a helper module)', () => {
  assert.deepEqual(rules('const cache = [];\nfunction remember(x) { cache.push(x); }\nmodule.exports = { remember };'), []);
});

test('global-patch flags an unrestored assignment, including in a called helper', () => {
  assert.deepEqual(rules("test('a', () => { global.fetch = f; });"), ['global-patch']);
  assert.deepEqual(rules("function setup() { process.env.X = '1'; }\ntest('a', () => { setup(); });"), ['global-patch']);
});

test('global-patch allows a restore in finally, t.after or a file-level afterEach', () => {
  assert.deepEqual(rules("test('a', () => { const original = global.fetch; global.fetch = f; try { run(); } finally { global.fetch = original; } });"), []);
  assert.deepEqual(rules("test('a', t => { const original = globalThis.fetch; globalThis.fetch = f; t.after(() => { globalThis.fetch = original; }); });"), []);
  assert.deepEqual(rules("afterEach(() => { global.fetch = original; });\ntest('a', () => { global.fetch = f; });"), []);
  assert.deepEqual(rules("test('a', () => { process.env.X = '1'; try { run(); } finally { delete process.env.X; } });"), []);
});

test('global-patch ignores strings, load-time normalisation and per-test restore of another property', () => {
  assert.deepEqual(rules("test('a', () => { fs.writeFileSync(p, 'global.fetch = 1'); });"), []);
  assert.deepEqual(rules("delete process.env.EXPO_PUBLIC_DEFAULT_LOCALE;\ntest('a', () => {});"), []);
  assert.deepEqual(rules("test('a', () => { global.fetch = f; try { run(); } finally { global.other = o; } });"), ['global-patch']);
});

test('fake-timers flags enable that is not directly followed by a protecting try', () => {
  assert.deepEqual(rules("test('a', () => { mock.timers.enable(); render(); try { go(); } finally { mock.timers.reset(); } });"), ['fake-timers']);
});

test('fake-timers allows a protecting try and t.mock', () => {
  assert.deepEqual(rules("test('a', () => { mock.timers.enable(); try { render(); go(); } finally { mock.timers.reset(); } });"), []);
  assert.deepEqual(rules("test('a', t => { t.mock.timers.enable(); render(); });"), []);
});

test('fake-timers: jest.useFakeTimers needs useRealTimers in finally or afterEach', () => {
  assert.deepEqual(rules("test('a', () => { jest.useFakeTimers(); run(); });"), ['fake-timers']);
  assert.deepEqual(rules("afterEach(() => { jest.useRealTimers(); });\ntest('a', () => { jest.useFakeTimers(); run(); });"), []);
});

test('invisible-whitespace flags a literal no-break space and allows escapes, umlauts, emoji and a BOM', () => {
  assert.deepEqual(rules("const s = 'a\u00A0b';"), ['invisible-whitespace']);
  assert.deepEqual(rules("const s = 'a\\u00A0b';"), []);
  assert.deepEqual(rules("const s = 'M\u00FCsli \u{1F95B}';"), []);
  assert.deepEqual(rules("\uFEFFconst s = 1;"), []);
  assert.deepEqual(rules("const s = 1;\uFEFF"), ['invisible-whitespace']);
});

test('focused-test flags only forms', () => {
  assert.deepEqual(rules("test.only('a', () => {});"), ['focused-test']);
  assert.deepEqual(rules("describe.only('a', () => {});"), ['focused-test']);
  assert.deepEqual(rules("test('a', { only: true }, () => {});"), ['focused-test']);
  assert.deepEqual(rules("// test.only is banned\nconst s = 'it.only(';"), []);
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
  assert.deepEqual(rules("afterEach(() => { for (const [name, o] of pairs) { global[name] = o; } });\ntest('a', () => { global.raf = f; });"), []);
  assert.deepEqual(rules("test('a', () => { mock.timers.enable(); let r; try { r = go(); } finally { mock.timers.reset(); } });"), []);
  assert.deepEqual(rules("test('a', () => { mock.timers.enable(); const h = harness(); try { h.go(); } finally { mock.timers.reset(); } });"), ['fake-timers']);
});
