import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { localStack, localUrl, password, removeUserByEmail, runThenCleanup } from './local-stack';

import { callback, messages, confirmationLink, openVerification, otpExpirySeconds } from './confirmation-mail';

test('otp expiry is read from supabase/config.toml', () => {
  assert.equal(otpExpirySeconds(), 60);
});

// `challenges` receives the PKCE method of every signup/resend request this client makes.
function pkceClient(key: string, challenges: string[], storage = new Map<string, string>()) {
  return createClient(localUrl, key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: false,
      storage: { getItem: k => storage.get(k) ?? null, setItem: (k, value) => { storage.set(k, value); }, removeItem: k => { storage.delete(k); } } },
    global: { fetch: (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.pathname.endsWith('/signup') || url.pathname.endsWith('/resend')) {
        challenges.push(JSON.parse(String(init?.body)).code_challenge_method);
      }
      return fetch(input, { ...init, signal: AbortSignal.timeout(15000) });
    } },
  });
}

test('received link confirms identity, survives a new client and cannot be replayed', { timeout: 60000 }, async () => {
  const stack = localStack();
  const email = `pf.test.signup.${randomUUID().slice(0, 8)}@example.com`;
  let createdId: string | undefined;
  const challenges: string[] = [];
  await runThenCleanup(async () => {
    const storage = new Map<string, string>();
    const initial = pkceClient(stack.key, challenges, storage);
    const previous = new Set((await messages()).map(m => m.ID));
    const signup = await initial.auth.signUp({ email, password, options: { emailRedirectTo: callback } });
    createdId = signup.data.user?.id;
    assert.equal(signup.error, null);
    assert.equal(signup.data.session, null);
    const denied = await stack.client().auth.signInWithPassword({ email, password });
    assert.ok(denied.error);
    const location = await openVerification(await confirmationLink(email, previous));
    const code = location.searchParams.get('code');
    assert.ok(code);
    const restarted = pkceClient(stack.key, challenges, storage);
    assert.equal((await restarted.auth.getSession()).data.session, null);
    const verified = await restarted.auth.exchangeCodeForSession(code);
    assert.equal(verified.error, null);
    assert.ok(verified.data.session);
    assert.ok(verified.data.user?.email_confirmed_at);
    const replay = await pkceClient(stack.key, challenges).auth.exchangeCodeForSession(code);
    assert.ok(replay.error);
    assert.equal(replay.data.session, null);
    const restored = pkceClient(stack.key, challenges, storage);
    assert.equal((await restored.auth.getSession()).data.session?.user.id, verified.data.user?.id);
    await restored.auth.signOut();
    assert.equal(challenges.length, 1); // one signup
    assert.ok(challenges.every(method => method === 's256'));
  }, () => removeUserByEmail(stack.admin, email, createdId));
});

test('expired link cannot authenticate; resend produces a working replacement', { timeout: 150000 }, async () => {
  const stack = localStack();
  const email = `pf.test.confirm.${randomUUID().slice(0, 8)}@example.com`;
  let createdId: string | undefined;
  const challenges: string[] = [];
  await runThenCleanup(async () => {
    const current = pkceClient(stack.key, challenges);
    let previous = new Set((await messages()).map(m => m.ID));
    const sentAt = Date.now();
    const signup = await current.auth.signUp({ email, password, options: { emailRedirectTo: callback } });
    createdId = signup.data.user?.id;
    assert.equal(signup.error, null);
    const original = await confirmationLink(email, previous);
    await delay(Math.max(0, otpExpirySeconds() * 1000 + 5000 - (Date.now() - sentAt)));
    const expired = await openVerification(original);
    assert.equal(new URLSearchParams(expired.hash.slice(1)).get('error_code'), 'otp_expired');
    assert.equal((await current.auth.getSession()).data.session, null);
    previous = new Set((await messages()).map(m => m.ID));
    const resent = await current.auth.resend({ type: 'signup', email, options: { emailRedirectTo: callback } });
    assert.equal(resent.error, null);
    const replacement = await openVerification(await confirmationLink(email, previous));
    const verified = await current.auth.exchangeCodeForSession(replacement.searchParams.get('code')!);
    assert.equal(verified.error, null);
    assert.ok(verified.data.session);
    await current.auth.signOut();
    assert.equal(challenges.length, 2); // one signup, one resend
    assert.ok(challenges.every(method => method === 's256'));
  }, () => removeUserByEmail(stack.admin, email, createdId));
});
