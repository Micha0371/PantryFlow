const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { load, deferred } = require('./helpers.cjs');

function fixture() {
  const exchange = deferred();
  const sent = deferred();
  const calls = { exchange: [], resend: [] };
  let session = null;
  const service = load('lib/email-confirmation.ts', {
    'expo-linking': { createURL: path => `pantryflow://${path}` },
    './native-auth-crypto': { assertSecurePkce() {} },
    './supabase': { supabase: { auth: {
      getSession: async () => ({ data: { session }, error: null }),
      exchangeCodeForSession: code => { calls.exchange.push(code); return exchange.promise; },
      resend: request => { calls.resend.push(request); return sent.promise; },
    } } },
  });
  return { service, calls, exchange, sent, signIn() { session = { user: { id: 'existing' } }; } };
}

test('confirmation rejects missing, ambiguous, malformed and error links without exchanging credentials', async () => {
  const f = fixture();
  for (const params of [{}, { code: ['one', 'two'] }, { code: 'a\nb' }, { code: 'x'.repeat(2049) }, { code: 'valid', error_code: 'otp_expired' }]) {
    assert.equal(f.service.confirmationCode(params), null);
    await assert.rejects(f.service.confirmEmail(params));
  }
  assert.deepEqual(f.calls.exchange, []);
});

test('confirmation coalesces duplicate active callbacks and requires an actual authenticated session', async () => {
  const f = fixture();
  const first = f.service.confirmEmail({ code: 'auth-code' });
  const second = f.service.confirmEmail({ code: 'auth-code' });
  assert.equal(first, second);
  await Promise.resolve();
  assert.deepEqual(f.calls.exchange, ['auth-code']);
  f.exchange.resolve({ data: { session: { user: { id: 'confirmed' } } }, error: null });
  await first;
  const missing = fixture();
  const attempt = missing.service.confirmEmail({ code: 'other-code' });
  missing.exchange.resolve({ data: { session: null }, error: null });
  await assert.rejects(attempt, /no session/);
});

test('expired codes remain recoverable and a callback cannot replace an already signed-in account', async () => {
  const f = fixture();
  const attempt = f.service.confirmEmail({ code: 'expired' });
  f.exchange.resolve({ data: { session: null }, error: new Error('expired') });
  await assert.rejects(attempt, /expired/);
  const signedIn = fixture();
  signedIn.signIn();
  await assert.rejects(signedIn.service.confirmEmail({ code: 'attacker-code' }), /Already signed in/);
  assert.deepEqual(signedIn.calls.exchange, []);
});

test('resend validates the address, prevents overlap, uses the app callback and unlocks after rejection', async () => {
  const f = fixture();
  await assert.rejects(f.service.resendConfirmation('not-an-address'));
  assert.deepEqual(f.calls.resend, []);
  const request = f.service.resendConfirmation(' alice@example.com ');
  await assert.rejects(f.service.resendConfirmation('bob@example.com'), /already running/);
  assert.deepEqual(f.calls.resend, [{ type: 'signup', email: 'alice@example.com', options: { emailRedirectTo: 'pantryflow://auth/callback' } }]);
  f.sent.resolve({ error: new Error('offline') });
  await assert.rejects(request, /offline/);
  await assert.rejects(f.service.resendConfirmation('alice@example.com'), /offline/);
  assert.equal(f.calls.resend.length, 2);
});

test('native PKCE adapter delegates secure randomness and SHA-256 without replacing browser crypto', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    const crypto = load('lib/native-auth-crypto.ts', {
      'react-native': { Platform: { OS: 'android' } },
      'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
        getRandomValues: values => webcrypto.getRandomValues(values),
        digest: (algorithm, bytes) => webcrypto.subtle.digest(algorithm, bytes),
      },
    });
    crypto.assertSecurePkce();
    const input = new TextEncoder().encode('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
    assert.equal(Buffer.from(digest).toString('base64url'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    assert.notDeepEqual(globalThis.crypto.getRandomValues(new Uint32Array(8)), new Uint32Array(8));
    await assert.rejects(globalThis.crypto.subtle.digest('MD5', input), /only supports SHA-256/);
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    crypto.installNativeAuthCrypto();
    assert.equal(globalThis.crypto, webcrypto);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});

// KAN-27: the email shape check without a backtracking regex, unchanged in what it accepts.
const NBSP = String.fromCharCode(0xa0);
const EMAIL_SHAPES = [['a@b.c', true], ['first.last@sub.example.com', true], ['üser@exämple.de', true], ['a@b', false],
  ['a@@b.c', false], ['a@b.', false], ['@b.c', false], ['a b@c.d', false], ['a@b c.d', false], ['a@.c', false],
  ['a@b.c.', true], ['a@.b.c', true], ['a.@b.c', true], ['a@b..c', true], ['a:b@c.d', true], ['', false], ['.@a.b', true],
  ['a@b.c@d.e', false], ['a\t@b.c', false], ['a@b.c\n', false], [`a@b${NBSP}.c`, false], ['x@y.zz', true], ['a@-.b', true]];

test('the email shape check accepts and rejects exactly the same addresses', () => {
  const { isEmailShape } = fixture().service;
  for (const [address, valid] of EMAIL_SHAPES) assert.equal(isEmailShape(address), valid, JSON.stringify(address));
});

function medianMs(fn, runs = 5) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const started = performance.now();
    fn();
    times.push(performance.now() - started);
  }
  return times.sort((a, b) => a - b)[Math.floor(runs / 2)];
}

// Compares a 10x larger input against a small one instead of a fixed time limit. For a slow check the ratio
// cancels machine speed; for a check that takes microseconds (this one) the 5 ms floor decides, i.e. an
// absolute bound of about 5 ms on the median large run. 40x sits between ~10x (linear) and ~100x (quadratic)
// growth for a 10x input; 5 ms absorbs sub-millisecond noise.
test('the email shape check runs in linear time', () => {
  const { isEmailShape } = fixture().service;
  const shapes = [n => 'a@' + 'b'.repeat(n), n => 'a@' + '.'.repeat(n), n => 'a'.repeat(n) + '@b',
    n => 'a@' + 'b.'.repeat(n / 2) + ' '];
  for (const build of shapes) {
    const [small, large] = [10000, 100000].map(n => { const address = build(n); return medianMs(() => isEmailShape(address)); });
    assert.ok(large < 40 * small + 5, `small ${small.toFixed(1)} ms, large ${large.toFixed(1)} ms`);
  }
});
