const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { load } = require('./helpers.cjs');

// KAN-122 review: React Native's Android HTTP client has no timeouts, so a sign-in whose
// connection opens but never answers kept the spinner forever with no message. Requests the
// user starts from a form get a timeout; token refresh never does, because cutting off a
// refresh the server already rotated would replay the old refresh token.
const { withAuthTimeout } = load('lib/auth-timeout.ts');
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

test('a password sign-in that never answers ends with the connection message', async () => {
  const started = Date.now();
  const { error } = await client(withAuthTimeout(hanging(), 50)).auth.signInWithPassword({ email: 'a@example.com', password: 'secret' });
  assert.ok(Date.now() - started < 5000, 'the timeout must end the request');
  assert.equal(signInErrorKey(error), 'err_auth_connection');
});

test('sign-up and resending the confirmation email are also ended by the timeout', async () => {
  const c = client(withAuthTimeout(hanging(), 50));
  assert.ok((await c.auth.signUp({ email: 'a@example.com', password: 'secret-password' })).error);
  assert.ok((await c.auth.resend({ type: 'signup', email: 'a@example.com' })).error);
});

test('token refresh, other Auth calls and data requests get no timeout', async () => {
  const seen = [];
  const timed = withAuthTimeout(hanging(seen), 50);
  for (const url of ['http://x/auth/v1/token?grant_type=refresh_token', 'http://x/auth/v1/token?grant_type=pkce',
    'http://x/auth/v1/logout?scope=local', 'http://x/rest/v1/pantry_items?select=*']) {
    void timed(url, { method: 'POST' });
  }
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.deepEqual(seen.map(s => s.signal), [undefined, undefined, undefined, undefined]);
});

test('a request that answers in time is not aborted later', async () => {
  const seen = [];
  const timed = withAuthTimeout(async (input, init) => { seen.push(init.signal); return ok(); }, 50);
  await timed('http://x/auth/v1/token?grant_type=password', { method: 'POST' });
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(seen[0].aborted, false);
});

test('a caller that brings its own abort signal keeps it', async () => {
  const seen = [];
  const own = new AbortController();
  const timed = withAuthTimeout(async (input, init) => { seen.push(init.signal); return ok(); }, 50);
  await timed('http://x/auth/v1/signup', { method: 'POST', signal: own.signal });
  assert.equal(seen[0], own.signal);
});

test('the app client sends its requests through the Auth form timeout', async () => {
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
    assert.ok(seen[0].signal instanceof AbortSignal, 'sign-in gets the timeout signal');
    assert.equal(seen[1].signal, undefined, 'refresh does not');
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [name, value] of [['EXPO_PUBLIC_SUPABASE_URL', saved.url], ['EXPO_PUBLIC_SUPABASE_ANON_KEY', saved.key]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
