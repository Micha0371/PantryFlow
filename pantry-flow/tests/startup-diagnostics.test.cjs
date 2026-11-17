const test = require('node:test');
const assert = require('node:assert/strict');
const { redactStartupLog } = require('../scripts/redact-startup-log.cjs');

test('startup diagnostics preserve the actual port failure while removing test credentials', () => {
  const failure = 'failed to bind host port 0.0.0.0:54324/tcp: address already in use';
  const result = redactStartupLog([
    'Pull complete', failure,
    'ANON_KEY=eyJfixture.payload.signature',
    'service_role: private-fixture-value',
    'Publishable | sb_publishable_fixture',
    'Secret | sb_secret_fixture',
    'opaque value eyJother.payload.signature',
    'Authorization: Bearer private-value',
    'Database URL: postgresql://postgres:fixture-db-password@127.0.0.1:54322/postgres',
    'password authentication failed for user postgres',
  ].join('\n'));
  assert.match(result, /address already in use/);
  assert.ok(result.includes(failure));
  assert.match(result, /Pull complete/);
  assert.match(result, /password authentication failed for user postgres/);
  assert.match(result, /postgresql:\/\/\[credentials redacted\]@127.0.0.1:54322\/postgres/);
  assert.doesNotMatch(result, /private-fixture|fixture-db-password|sb_publishable_fixture|sb_secret_fixture|eyJfixture|eyJother|Bearer private-value/);
  assert.equal(redactStartupLog(result), result);
});

// KAN-27: the same redaction without a backtracking or oversized regex.
const LABELS = [['anon', 'key'], ['service', 'role'], ['service', 'role', 'key'], ['publishable'], ['publishable', 'key'],
  ['secret'], ['secret', 'key'], ['api', 'key'], ['authorization'], ['password'], ['access', 'token'], ['refresh', 'token']];

test('every secret label form is redacted', () => {
  for (const words of LABELS) for (const join of ['', '_', '-', ' ']) for (const sep of [':', '=', '|', ' : ', '\t= ']) {
    for (const label of [words.join(join), words.join(join).toUpperCase()]) {
      assert.equal(redactStartupLog(`${label}${sep}top-secret`), `${label}${sep}[value redacted]`);
      assert.equal(redactStartupLog(`x ${label}${sep}top-secret`), `x ${label}${sep}[value redacted]`);
    }
  }
  for (const kept of ['password authentication failed for user postgres', 'secretary is out', 'anon__key: x', 'token: x', 'pass word: x'])
    assert.equal(redactStartupLog(kept), kept);
});

test('URL userinfo is redacted in every form and other URLs are untouched', () => {
  for (const user of ['user', 'user:pass', 'user:', ':pass'])
    assert.equal(redactStartupLog(`x postgresql://${user}@host:5432/db`), 'x postgresql://[credentials redacted]@host:5432/db');
  assert.equal(redactStartupLog('two a://u@h and b://v:w@k'), 'two a://[credentials redacted]@h and b://[credentials redacted]@k');
  for (const kept of ['postgresql://127.0.0.1:54322/postgres', 'see https://example.com/a@b', 'a://b c@d', 'mailto:a@b.c'])
    assert.equal(redactStartupLog(kept), kept);
});

test('adversarial lines redact in linear time', () => {
  for (const line of ['a://' + 'a'.repeat(100000), 'a'.repeat(100000), 'password' + ' '.repeat(100000) + 'x']) {
    const started = performance.now();
    redactStartupLog(line);
    assert.ok(performance.now() - started < 100, `took ${Math.round(performance.now() - started)} ms`);
  }
});

test('a line with thousands of CR-separated labels redacts every value without overflowing the stack', () => {
  const cr = String.fromCharCode(13);
  const line = ('secret=1' + cr).repeat(12000);
  const started = performance.now();
  const output = redactStartupLog(line);
  assert.ok(performance.now() - started < 1000, `took ${Math.round(performance.now() - started)} ms`);
  assert.equal(output, ('secret=[value redacted]' + cr).repeat(12000));
});
