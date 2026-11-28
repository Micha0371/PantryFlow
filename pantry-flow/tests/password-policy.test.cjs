const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

// KAN-82: the approved policy (KAN-81, owner decisions 2026-11-27): at least 15 Unicode code points,
// no character rules, at most the Auth server's 72 bytes (bcrypt), checked before sending. The
// password is only measured, never trimmed, truncated or normalized.
const policy = load('lib/password-policy.ts');
const repeat = (s, n) => s.repeat(n);

test('the minimum is 15 code points and the maximum the server\'s 72 bytes', () => {
  assert.equal(policy.PASSWORD_MIN_CODE_POINTS, 15);
  assert.equal(policy.PASSWORD_MAX_BYTES, 72);
});

test('14 code points are too short, 15 are enough; spaces count and are allowed', () => {
  assert.equal(policy.passwordProblem(repeat('a', 14)), 'too_short');
  assert.equal(policy.passwordProblem(repeat('a', 15)), null);
  assert.equal(policy.passwordProblem('milk and eggs 2'), null);
  assert.equal(policy.passwordProblem(repeat(' ', 15)), null, 'no character rules: spaces alone are allowed');
  assert.equal(policy.passwordProblem(''), 'too_short');
});

test('length counts code points, not UTF-16 units: an emoji is one character', () => {
  // 14 emoji are 28 UTF-16 units but 14 characters: still too short.
  assert.equal(policy.passwordProblem(repeat('🥛', 14)), 'too_short');
  assert.equal(policy.passwordProblem(repeat('🥛', 15)), null);
  // 14 letters and one emoji are 15 characters.
  assert.equal(policy.passwordProblem(repeat('a', 14) + '🥛'), null);
  // Umlauts are one character each (two bytes for the server, see below).
  assert.equal(policy.passwordProblem(repeat('ä', 14)), 'too_short');
  assert.equal(policy.passwordProblem(repeat('ä', 15)), null);
});

test('more than 72 bytes is too long: umlauts take 2 bytes and emoji 4', () => {
  assert.equal(policy.passwordProblem(repeat('a', 72)), null);
  assert.equal(policy.passwordProblem(repeat('a', 73)), 'too_long');
  assert.equal(policy.passwordProblem(repeat('ä', 36)), null, '36 umlauts are 72 bytes');
  assert.equal(policy.passwordProblem(repeat('ä', 37)), 'too_long', '37 umlauts are 74 bytes, though only 37 characters');
  assert.equal(policy.passwordProblem(repeat('🥛', 18)), null, '18 emoji are 72 bytes');
  assert.equal(policy.passwordProblem(repeat('🥛', 19)), 'too_long');
  assert.equal(policy.passwordProblem(repeat('€', 24)), null, 'the euro sign takes 3 bytes');
  assert.equal(policy.passwordProblem(repeat('€', 25)), 'too_long');
});

test('UTF-8 size matches what the server receives, including an unpaired surrogate', () => {
  for (const sample of ['a', 'ä', '€', '🥛', 'milk and eggs on tuesday', 'Grüße 🥛 €']) {
    assert.equal(policy.passwordBytes(sample), Buffer.byteLength(sample, 'utf8'), sample);
  }
  // An unpaired surrogate reaches the server as U+FFFD, three bytes, like Buffer encodes it.
  assert.equal(policy.passwordBytes('\uD83E'), 3);
  assert.equal(policy.passwordBytes('\uD83E'), Buffer.byteLength('\uD83E', 'utf8'));
});

test('the check only measures: the same string comes back unchanged from nothing it calls', () => {
  const typed = '  Milk And Eggs  ';
  const copy = typed.slice();
  policy.passwordProblem(typed);
  assert.equal(typed, copy);
  assert.equal(policy.passwordCodePoints(typed), 17, 'leading and trailing spaces are counted, never trimmed');
});
