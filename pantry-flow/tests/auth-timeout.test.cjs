const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { load } = require('./helpers.cjs');

// KAN-122 review: React Native's Android HTTP client has no timeouts, so a sign-in whose
// connection opens but never answers kept the spinner forever with no message. Requests the
// user starts from a form get a timeout; token refresh never does, because cutting off a
// refresh the server already rotated would replay the old refresh token.
// KAN-127: data requests (PostgREST, /rest/v1/) get their own, longer timeout.
const { withRequestTimeouts, AUTH_FORM_TIMEOUT_MS, DATA_REQUEST_TIMEOUT_MS } = load('lib/auth-timeout.ts');
const { signInErrorKey } = load('lib/auth-error.ts');

// A server that accepts the request and never answers; only an abort ends it.
function hanging(seen = []) {
  return (input, init = {}) => {
    seen.push({ url: String(input), signal: init.signal });
    return new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    });
  };
}
const client = fetch => createClient('http://pantryflow.invalid', 'anon-key', {
  global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const ok = async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// Without the timeout under test the request would wait forever; this deadline turns that into a
// named assertion failure instead of a hung test run (the S13 lesson, TI-4).
const within = (promise, message, ms = 2000) => {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new assert.AssertionError({ message })), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
};

test('the timeouts are 15 s for the sign-in forms and 20 s for data requests (owner decision 2026-11-27)', () => {
  assert.equal(AUTH_FORM_TIMEOUT_MS, 15000);
  assert.equal(DATA_REQUEST_TIMEOUT_MS, 20000);
});

test('a password sign-in that never answers ends with the connection message', async () => {
  const { error } = await within(client(withRequestTimeouts(hanging(), { formMs: 50 })).auth.signInWithPassword({ email: 'a@example.com', password: 'secret' }),
    'the form timeout must end a sign-in that never answers');
  assert.equal(signInErrorKey(error), 'err_auth_connection');
});

test('sign-up and resending the confirmation email are also ended by the timeout', async () => {
  const c = client(withRequestTimeouts(hanging(), { formMs: 50 }));
  assert.ok((await within(c.auth.signUp({ email: 'a@example.com', password: 'secret-password' }), 'the form timeout must end a sign-up')).error);
  assert.ok((await within(c.auth.resend({ type: 'signup', email: 'a@example.com' }), 'the form timeout must end a resend')).error);
});

test('token refresh, the confirmation-link exchange and sign-out get no timeout', async () => {
  const seen = [];
  const timed = withRequestTimeouts(hanging(seen), { formMs: 50, dataMs: 50 });
  for (const url of ['http://x/auth/v1/token?grant_type=refresh_token', 'http://x/auth/v1/token?grant_type=pkce',
    'http://x/auth/v1/logout?scope=local']) {
    void timed(url, { method: 'POST' });
  }
  await wait(120);
  assert.deepEqual(seen.map(s => s.signal), [undefined, undefined, undefined]);
});

test('a data read that never answers ends after the data timeout with an error and no data', async () => {
  const { data, error, status } = await within(client(withRequestTimeouts(hanging(), { dataMs: 50 })).from('pantry_items').select('*'),
    'the data timeout must end a read that never answers');
  assert.equal(data, null);
  assert.equal(status, 0);
  assert.equal(error.code, '', 'an aborted request carries no database error code');
});

test('a data write that never answers ends after the data timeout with an uncoded error', async () => {
  const { error, status } = await within(client(withRequestTimeouts(hanging(), { dataMs: 50 }))
    .from('pantry_items').insert({ name: 'Milk' }).select().single(), 'the data timeout must end a write that never answers');
  assert.equal(status, 0);
  assert.equal(error.code, '', 'the outcome is unknown: the server may have committed');
});

test('data requests use the data timeout, not the shorter form timeout', async () => {
  const seen = [];
  const timed = withRequestTimeouts(hanging(seen), { formMs: 50, dataMs: 300 });
  void timed('http://x/rest/v1/pantry_items?select=*', { method: 'GET' }).catch(() => undefined);
  await wait(150);
  assert.ok(seen[0].signal instanceof AbortSignal, 'the data request gets a timeout signal');
  assert.equal(seen[0].signal.aborted, false, 'not ended by the 50 ms form timeout');
  await wait(400);
  assert.equal(seen[0].signal.aborted, true, 'ended by the 300 ms data timeout');
});

test('a request that answers in time is not aborted later', async () => {
  const seen = [];
  const timed = withRequestTimeouts(async (input, init) => { seen.push(init.signal); return ok(); }, { formMs: 50, dataMs: 50 });
  await timed('http://x/auth/v1/token?grant_type=password', { method: 'POST' });
  await timed('http://x/rest/v1/pantry_items?select=*', { method: 'GET' });
  await wait(120);
  assert.equal(seen[0].aborted, false);
  assert.equal(seen[1].aborted, false);
});

test('a caller that brings its own abort signal keeps it', async () => {
  const seen = [];
  const own = new AbortController();
  const timed = withRequestTimeouts(async (input, init) => { seen.push(init.signal); return ok(); }, { formMs: 50, dataMs: 50 });
  await timed('http://x/auth/v1/signup', { method: 'POST', signal: own.signal });
  await timed('http://x/rest/v1/pantry_items', { method: 'POST', signal: own.signal });
  assert.equal(seen[0], own.signal);
  assert.equal(seen[1], own.signal);
});

test('the app client sends its requests through the request timeouts', async () => {
  let options;
  const saved = { url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, fetch: globalThis.fetch };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'local-test-only';
  const seen = [];
  globalThis.fetch = async (input, init = {}) => { seen.push({ url: String(input), signal: init.signal }); return ok(); };
  try {
    load('lib/supabase.ts', {
      'react-native-url-polyfill/auto': {}, './native-auth-crypto': {}, './auth-timeout': load('lib/auth-timeout.ts'),
      'react-native': { Platform: { OS: 'web' }, AppState: {} },
      '@react-native-async-storage/async-storage': {},
      '@supabase/supabase-js': { createClient: (url, key, given) => { options = given; return { auth: {} }; } },
    });
    await options.global.fetch('http://127.0.0.1:54321/auth/v1/token?grant_type=password', { method: 'POST' });
    await options.global.fetch('http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token', { method: 'POST' });
    await options.global.fetch('http://127.0.0.1:54321/rest/v1/pantry_items?select=*', { method: 'GET' });
    assert.ok(seen[0].signal instanceof AbortSignal, 'sign-in gets the timeout signal');
    assert.equal(seen[1].signal, undefined, 'refresh does not');
    assert.ok(seen[2].signal instanceof AbortSignal, 'data requests get the timeout signal');
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [name, value] of [['EXPO_PUBLIC_SUPABASE_URL', saved.url], ['EXPO_PUBLIC_SUPABASE_ANON_KEY', saved.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
