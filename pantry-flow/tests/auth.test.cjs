const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

function fixture() {
  const restored = deferred();
  let value, listener, response = { data: { session: null }, error: null };
  let signoutError = null;
  let signupRequest;
  const auth = {
    getSession: () => restored.promise,
    onAuthStateChange: cb => { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    signUp: async request => { signupRequest = request; return response; }, signInWithPassword: async () => response,
    signOut: async () => ({ error: signoutError }),
  };
  const { AuthProvider, useAuth } = load('lib/auth.tsx', { './i18n': { useTranslation: () => ({ locale: 'en' }) }, './profile-language': { setPendingLanguage: async () => {} }, './supabase': { supabase: { auth } }, 'expo-linking': { createURL: () => 'pantryflow://auth/callback' }, './native-auth-crypto': { assertSecurePkce() {} } });
  function Consumer() { value = useAuth(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Consumer))); });
  return { restored, auth, get value() { return value; },
    get signupRequest() { return signupRequest; },
    response(next) { response = next; }, signoutFails() { signoutError = new Error('offline'); },
    event(session) { act(() => listener('SIGNED_IN', session)); },
    dispose() { act(() => renderer.unmount()); } };
}

test('rejected session restoration settles loading, exposes retry, and recovers', async () => {
  const f = fixture();
  await act(async () => f.restored.reject(new Error('storage unavailable')));
  assert.equal(f.value.loading, false);
  assert.equal(f.value.error, 'err_restore_session');
  f.auth.getSession = async () => ({ data: { session: null }, error: null });
  await act(async () => f.value.retrySession());
  assert.equal(f.value.error, null);
  assert.equal(f.value.loading, false);
  f.dispose();
});

test('a late restoration cannot overwrite a newer auth event', async () => {
  const f = fixture();
  const session = { user: { id: 'new-user' } };
  f.event(session);
  await act(async () => f.restored.resolve({ data: { session: null }, error: null }));
  assert.equal(f.value.user.id, 'new-user');
  assert.equal(f.value.loading, false);
  f.dispose();
});

test('signup distinguishes email confirmation from an authenticated session', async () => {
  const f = fixture();
  await act(async () => f.restored.resolve({ data: { session: null }, error: null }));
  let outcome;
  await act(async () => { outcome = await f.value.signUp('Name', 'a@example.com', 'password'); });
  assert.equal(outcome, 'confirmation_required');
  assert.equal(f.signupRequest.options.emailRedirectTo, 'pantryflow://auth/callback');
  assert.equal(f.value.session, null);
  f.response({ data: { session: { user: { id: 'u' } } }, error: null });
  await act(async () => { outcome = await f.value.signUp('Name', 'a@example.com', 'password'); });
  assert.equal(outcome, 'signed_in');
  assert.equal(f.value.user.id, 'u');
  f.signoutFails();
  await act(async () => assert.rejects(f.value.signOut(), /offline/));
  assert.equal(f.value.user.id, 'u');
  f.dispose();
});

test('saved sessions restore, logout clears identity and a later login replaces it', async () => {
  const f = fixture();
  const saved = { user: { id: 'saved-user' } };
  await act(async () => f.restored.resolve({ data: { session: saved }, error: null }));
  assert.equal(f.value.user.id, 'saved-user');
  await act(async () => f.value.signOut());
  assert.equal(f.value.session, null);
  assert.equal(f.value.user, null);
  f.response({ data: { session: { user: { id: 'next-user' } } }, error: null });
  await act(async () => f.value.signIn('next@example.com', 'password'));
  assert.equal(f.value.user.id, 'next-user');
  f.dispose();
});

// KAN-27: the context value is memoized, so consumers re-render for auth changes only.
test('the auth context value is stable across a parent re-render and changes with the session', async () => {
  const restored = deferred();
  let listener;
  const auth = {
    getSession: () => restored.promise,
    onAuthStateChange: cb => { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    signUp: async () => ({ data: { session: null }, error: null }), signInWithPassword: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
  };
  const { AuthProvider, useAuth } = load('lib/auth.tsx', { './i18n': { useTranslation: () => ({ locale: 'en' }) }, './profile-language': { setPendingLanguage: async () => {} }, './supabase': { supabase: { auth } },
    'expo-linking': { createURL: () => 'pantryflow://auth/callback' }, './native-auth-crypto': { assertSecurePkce() {} } });
  const seen = [];
  function Consumer() { seen.push(useAuth()); return null; }
  const tree = () => React.createElement(AuthProvider, null, React.createElement(Consumer));
  let renderer;
  try {
    act(() => { renderer = create(tree()); });
    await act(async () => restored.resolve({ data: { session: null }, error: null }));
    const settled = seen.at(-1);
    act(() => renderer.update(tree()));
    assert.equal(seen.at(-1), settled);
    act(() => listener('SIGNED_IN', { user: { id: 'u' } }));
    const signedIn = seen.at(-1);
    assert.notEqual(signedIn, settled);
    assert.equal(signedIn.user.id, 'u');
    assert.equal(signedIn.loading, false);
    for (const action of ['retrySession', 'signIn', 'signUp', 'signOut']) assert.equal(signedIn[action], settled[action], action);
  } finally { if (renderer) act(() => renderer.unmount()); }
});

// KAN-82 (owner decision 2026-11-28): an existing account whose password is below the new minimum
// still signs in. Auth answers the token request with a session and an advisory weak_password;
// supabase-js passes it on as data.weakPassword next to the session. The app neither shows nor acts
// on it during the supervised beta (revisit with KAN-42). Genuine failures still fail.
const { createClient } = require('@supabase/supabase-js');

function realClientProvider(answer) {
  const client = createClient('http://pantryflow.invalid', 'anon-key', {
    global: { fetch: async () => answer() },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { AuthProvider, useAuth } = load('lib/auth.tsx', { './i18n': { useTranslation: () => ({ locale: 'en' }) },
    './profile-language': { setPendingLanguage: async () => {} }, './supabase': { supabase: client },
    'expo-linking': { createURL: () => 'pantryflow://auth/callback' }, './native-auth-crypto': { assertSecurePkce() {} } });
  let value;
  function Consumer() { value = useAuth(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(AuthProvider, null, React.createElement(Consumer))); });
  return { client, get value() { return value; }, dispose: () => act(() => renderer.unmount()) };
}

const tokenAnswer = extra => () => new Response(JSON.stringify({
  access_token: 'header.payload.signature', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-token',
  user: { id: 'existing-user', aud: 'authenticated', role: 'authenticated', email: 'existing@example.com',
    app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  ...extra,
}), { status: 200, headers: { 'Content-Type': 'application/json', 'x-supabase-api-version': '2024-01-01' } });

test('KAN-82: a valid session with weakPassword {reasons: [length]} signs in, keeps the session and shows no warning or error', async () => {
  // auth-js passes the advisory on only with both reasons and message (lib/fetch.js _sessionResponsePassword).
  const p = realClientProvider(tokenAnswer({ weak_password: { reasons: ['length'], message: 'Password should be at least 15 characters.' } }));
  try {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    // The real library reports the advisory next to the session, not as an error.
    const raw = await p.client.auth.signInWithPassword({ email: 'existing@example.com', password: 'short-pass' });
    assert.equal(raw.error, null);
    assert.deepEqual(raw.data.weakPassword.reasons, ['length']);
    assert.ok(raw.data.session);
    await act(async () => { await p.value.signIn('existing@example.com', 'short-pass'); });
    assert.equal(p.value.user?.id, 'existing-user', 'the session is kept');
    assert.equal(p.value.session?.access_token, 'header.payload.signature');
    assert.equal(p.value.error, null, 'no warning or error is exposed');
    assert.equal(p.value.loading, false);
  } finally { p.dispose(); }
});

test('KAN-82: a genuine authentication error still fails sign-in', async () => {
  const p = realClientProvider(() => new Response(JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }),
    { status: 400, headers: { 'Content-Type': 'application/json', 'x-supabase-api-version': '2024-01-01' } }));
  try {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await act(async () => {
      await assert.rejects(p.value.signIn('existing@example.com', 'wrong-password'), error => error.code === 'invalid_credentials');
    });
    assert.equal(p.value.user, null);
    assert.equal(p.value.session, null);
  } finally { p.dispose(); }
});

test('KAN-82: an answer without a session is rejected even when error is null', async () => {
  const f = fixture();
  await act(async () => f.restored.resolve({ data: { session: null }, error: null }));
  f.response({ data: { user: null, session: null, weakPassword: { reasons: ['length'] } }, error: null });
  await act(async () => { await assert.rejects(f.value.signIn('existing@example.com', 'short-pass'), /No session returned/); });
  assert.equal(f.value.session, null);
  assert.equal(f.value.user, null);
  f.dispose();
});
