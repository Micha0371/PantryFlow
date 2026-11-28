const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { load } = require('./helpers.cjs');

// KAN-122 (UX-09): the sign-in screen showed "Invalid email or password" for every
// failure, including an unreachable server. The errors below are produced by the real
// supabase-js sign-in with only fetch replaced, so the mapping sees exactly what the
// library throws for each server answer or transport failure.
const { signInErrorKey } = load('lib/auth-error.ts');

const json = (status, body) => async () => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'x-supabase-api-version': '2024-01-01' },
});
const text = (status, body) => async () => new Response(body, { status, headers: { 'Content-Type': 'text/html' } });

async function signInError(fetch) {
  const client = createClient('http://pantryflow.invalid', 'anon-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: 'a@example.com', password: 'secret' });
  assert.ok(error, 'the stubbed answer must make sign-in fail');
  return error;
}

test('only a genuine credential rejection shows the credential message', async () => {
  const error = await signInError(json(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' }));
  assert.equal(signInErrorKey(error), 'err_login_failed');
  // Servers without the API version header send the code as error_code.
  const legacy = await signInError(async () => new Response(JSON.stringify({ error_code: 'invalid_credentials', msg: 'Invalid login credentials' }), { status: 400 }));
  assert.equal(signInErrorKey(legacy), 'err_login_failed');
});

for (const [name, fetch, expected] of [
  ['an unreachable server (React Native fetch failure)', async () => { throw new TypeError('Network request failed'); }, 'err_auth_connection'],
  ['a client timeout', async () => { throw new DOMException('The operation timed out.', 'TimeoutError'); }, 'err_auth_connection'],
  ['an aborted request', async () => { throw new DOMException('The operation was aborted.', 'AbortError'); }, 'err_auth_connection'],
  ['rate limiting', json(429, { code: 'over_request_rate_limit', msg: 'Request rate limit reached' }), 'err_login_rate_limit'],
  ['a server error', json(500, { code: 'unexpected_failure', msg: 'Internal error' }), 'err_auth_server'],
  ['an unavailable gateway without a JSON body', text(503, '<html>Service Unavailable</html>'), 'err_auth_server'],
  ['a gateway timeout', text(504, '<html>Gateway Timeout</html>'), 'err_auth_server'],
  ['a server status outside the retryable list', json(507, { code: 'unexpected_failure', msg: 'Insufficient storage' }), 'err_auth_server'],
  ['an unconfirmed email address', json(400, { code: 'email_not_confirmed', msg: 'Email not confirmed' }), 'err_login_unconfirmed'],
  ['an unknown rejection', json(400, { code: 'validation_failed', msg: 'Unable to validate' }), 'err_generic'],
  ['a non-JSON answer such as a captive portal page', text(400, '<html>Sign in to the Wi-Fi</html>'), 'err_generic'],
]) {
  test(`${name} does not show the credential message`, async () => {
    const key = signInErrorKey(await signInError(fetch));
    assert.notEqual(key, 'err_login_failed');
    assert.equal(key, expected);
  });
}

test('errors that do not come from Auth do not show the credential message', () => {
  for (const error of [new Error('No session returned'), undefined, null, 'denied', { status: 400 }]) {
    assert.equal(signInErrorKey(error), 'err_generic');
  }
});

// KAN-122 review: registration showed "Could not create account" for every failure, including
// an unreachable server. The same transport classes now get the same messages as sign-in.
const { signUpErrorKey } = load('lib/auth-error.ts');
async function signUpError(fetch) {
  const client = createClient('http://pantryflow.invalid', 'anon-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signUp({ email: 'a@example.com', password: 'secret-password' });
  assert.ok(error, 'the stubbed answer must make sign-up fail');
  return error;
}

for (const [name, fetch, expected] of [
  ['an unreachable server', async () => { throw new TypeError('Network request failed'); }, 'err_auth_connection'],
  ['a timed-out request', async () => { throw new DOMException('The operation was aborted.', 'AbortError'); }, 'err_auth_connection'],
  ['a server error', text(503, '<html>Service Unavailable</html>'), 'err_auth_server'],
  ['too many confirmation emails', json(429, { code: 'over_email_send_rate_limit', msg: 'Email rate limit exceeded' }), 'err_confirmation_rate_limit'],
  // KAN-82: the server's two password rejections get their own messages (owner decision 5: a length
  // rejection reads differently from a failed sign-up). Bodies as Auth v2.197.0 and v2.198.0 send them
  // (internal/api/password.go): the minimum as weak_password with reasons, the 72-byte bcrypt
  // maximum as validation_failed with a message that says "characters".
  ['a password below the minimum', json(422, { code: 'weak_password', msg: 'Password should be at least 15 characters.', weak_password: { reasons: ['length'] } }), 'err_password_too_short'],
  ['a password over the 72-byte maximum', json(400, { code: 'validation_failed', msg: 'Password cannot be longer than 72 characters' }), 'err_password_too_long'],
  // Not configured (no character rules, no leaked-password check on Free): the general message.
  ['a weak password for another reason', json(422, { code: 'weak_password', msg: 'Password is too weak', weak_password: { reasons: ['characters'] } }), 'err_register_failed'],
  ['a leaked password', json(422, { code: 'weak_password', msg: 'Password is known to be weak', weak_password: { reasons: ['pwned'] } }), 'err_register_failed'],
  ['another validation failure', json(400, { code: 'validation_failed', msg: 'Unable to validate email address: invalid format' }), 'err_register_failed'],
]) {
  test(`registration: ${name} shows ${expected}`, async () => {
    assert.equal(signUpErrorKey(await signUpError(fetch)), expected);
  });
}

test('registration: errors that do not come from Auth keep the registration message', () => {
  for (const error of [new Error('Invalid name'), undefined, { status: 503 }]) assert.equal(signUpErrorKey(error), 'err_register_failed');
});
