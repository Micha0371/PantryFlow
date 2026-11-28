const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./helpers.cjs');

// KAN-82 / section 2.6 (P09, P10, P14): one pure evaluator for the new-password field. The password
// is only measured, never trimmed, truncated or normalized.
const policy = load('lib/password-policy.ts');
const { evaluateNewPassword: evaluate } = policy;
const repeat = (s, n) => s.repeat(n);
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the constants mirror the server: 15 code points, 72 bytes', () => {
  assert.equal(policy.PASSWORD_MIN_CODE_POINTS, 15);
  assert.equal(policy.PASSWORD_MAX_BYTES, 72);
});

test('the module exports only the constants and the one evaluator (P14)', () => {
  assert.deepEqual(Object.keys(policy).sort(), ['PASSWORD_MAX_BYTES', 'PASSWORD_MIN_CODE_POINTS', 'evaluateNewPassword']);
});

test('P09: remaining counts down from 15; 14 and 15 are the boundary; spaces count', () => {
  assert.deepEqual(evaluate(''), { codePoints: 0, bytes: 0, remaining: 15, meetsMinimum: false, tooLong: false });
  assert.equal(evaluate('a').remaining, 14);
  assert.equal(evaluate(repeat('a', 14)).remaining, 1);
  assert.equal(evaluate(repeat('a', 14)).meetsMinimum, false);
  assert.equal(evaluate(repeat('a', 15)).remaining, 0);
  assert.equal(evaluate(repeat('a', 15)).meetsMinimum, true);
  assert.equal(evaluate(repeat('a', 20)).remaining, 0, 'remaining never goes negative');
  assert.equal(evaluate(repeat(' ', 15)).meetsMinimum, true, 'no character rules: spaces alone are allowed');
});

test('P09: length counts code points, not UTF-16 units or visible characters', () => {
  assert.equal(evaluate(repeat('\u{1F600}', 14)).codePoints, 14, '14 emoji are 28 UTF-16 units');
  assert.equal(evaluate(repeat('\u{1F600}', 14)).meetsMinimum, false);
  assert.equal(evaluate(repeat('\u{1F600}', 15)).meetsMinimum, true);
  assert.equal(evaluate(repeat('\u00e4', 14)).meetsMinimum, false);
  assert.equal(evaluate(repeat('\u00e4', 15)).meetsMinimum, true);
  const decomposed = repeat('e\u0301', 7);
  assert.equal(evaluate(decomposed).codePoints, 14, '7 x (e + U+0301) show 7 characters but count 14');
  assert.equal(evaluate(decomposed).remaining, 1);
  assert.equal(evaluate(repeat('e\u0301', 14)).meetsMinimum, true);
});

test('P10: more than 72 UTF-8 bytes is too long, whatever the number of characters', () => {
  const tooLong = value => evaluate(value).tooLong;
  assert.equal(tooLong(repeat('a', 72)), false);
  assert.equal(tooLong(repeat('a', 73)), true);
  assert.equal(tooLong(repeat('\u00e4', 36)), false, '36 x a-umlaut are 72 bytes');
  assert.equal(tooLong(repeat('\u00e4', 37)), true);
  assert.equal(tooLong(repeat('\u00e4', 64)), true);
  assert.equal(tooLong(repeat('\u{1F600}', 18)), false, '18 emoji are 72 bytes');
  assert.equal(tooLong(repeat('\u{1F600}', 19)), true);
  assert.equal(tooLong(repeat('\u20ac', 24)), false, 'the euro sign takes 3 bytes');
  assert.equal(tooLong(repeat('\u20ac', 25)), true);
  assert.equal(evaluate(repeat('\u00e4', 36)).meetsMinimum, true);
});

test('bytes match what the server receives, including an unpaired surrogate (3 bytes)', () => {
  for (const sample of ['', 'a', '\u00e4', '\u20ac', '\u{1F600}', 'milk and eggs on tuesday', 'Gr\u00fc\u00dfe \u{1F600} \u20ac', '\uD83E', 'x\uDE00y']) {
    assert.equal(evaluate(sample).bytes, Buffer.byteLength(sample, 'utf8'), JSON.stringify(sample));
  }
  assert.equal(evaluate('\uD83E').bytes, 3);
});

test('the value is measured exactly as given: leading and trailing spaces count, nothing is normalized', () => {
  assert.equal(evaluate('  correct horse battery  ').codePoints, 25, 'spaces are counted, never trimmed');
  assert.equal(evaluate('e\u0301x').codePoints, 3, 'no normalization');
});

test('P14: the old per-screen helpers are gone and no screen or field measures the password itself', () => {
  for (const file of ['app/(auth)/register.tsx', 'app/(auth)/login.tsx', 'components/NewPasswordField.tsx']) {
    assert.doesNotMatch(read(file), /password\w*\.length|\bvalue\.length|TextEncoder|codePointAt|Array\.from\(|\[\.\.\.(password|value)|Buffer/i, file);
  }
  assert.match(read('app/(auth)/register.tsx'), /evaluateNewPassword/);
  assert.match(read('components/NewPasswordField.tsx'), /evaluateNewPassword/);
});
