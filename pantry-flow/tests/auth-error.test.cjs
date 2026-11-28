const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { load } = require('./helpers.cjs');

// KAN-122 (UX-09): the sign-in screen showed "Invalid email or password" for every
// failure, including an unreachable server. The errors below are produced by the real
// supabase-js sign-in with only fetch replaced, so the mapping sees exactly what the
// library throws for each server answer or transport failure.
const authError = () => load('lib/auth-error.ts', { './password-policy': load('lib/password-policy.ts') });
const { signInErrorKey } = authError();

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
const { signUpErrorKey } = authError();
async function signUpError(fetch, password = 'secret-password') {
  const client = createClient('http://pantryflow.invalid', 'anon-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signUp({ email: 'a@example.com', password });
  assert.ok(error, 'the stubbed answer must make sign-up fail');
  return error;
}

const weak = (...reasons) => json(422, { code: 'weak_password', msg: 'provider text that must never matter', weak_password: { reasons } });

// Section 2.6 / P17: the mapping is keyed on the error code and the weak_password reasons, never on
// message text. Bodies are as Auth v2.197.0 and v2.198.0 send them (internal/api/password.go).
for (const [name, fetch, password, expected] of [
  ['an unreachable server', async () => { throw new TypeError('Network request failed'); }, 'secret-password', 'err_auth_connection'],
  ['a timed-out request', async () => { throw new DOMException('The operation was aborted.', 'AbortError'); }, 'secret-password', 'err_auth_connection'],
  ['a server error', text(503, '<html>Service Unavailable</html>'), 'secret-password', 'err_auth_server'],
  ['a 500 answer', json(500, { code: 'unexpected_failure', msg: 'Internal error' }), 'secret-password', 'err_auth_server'],
  ['too many confirmation emails', json(429, { code: 'over_email_send_rate_limit', msg: 'Email rate limit exceeded' }), 'secret-password', 'err_confirmation_rate_limit'],
  ['weak_password with reason length', weak('length'), 'a'.repeat(15), 'err_password_length'],
  ['weak_password with reason pwned', weak('pwned'), 'a'.repeat(15), 'err_password_pwned'],
  ['weak_password with reason characters', weak('characters'), 'a'.repeat(15), 'err_password_characters'],
  ['several reasons: length comes first', weak('pwned', 'characters', 'length'), 'a'.repeat(15), 'err_password_length'],
  ['several reasons: pwned before characters', weak('characters', 'pwned'), 'a'.repeat(15), 'err_password_pwned'],
  ['weak_password without a known reason', weak('something_new'), 'a'.repeat(15), 'err_register_failed'],
  ['weak_password without reasons', json(422, { code: 'weak_password', msg: 'Password is too weak' }), 'a'.repeat(15), 'err_register_failed'],
  ['validation_failed with a submitted password over 72 bytes (73 ASCII)', json(400, { code: 'validation_failed', msg: 'whatever' }), 'a'.repeat(73), 'auth_password_too_long'],
  ['validation_failed with 37 umlauts (74 bytes)', json(400, { code: 'validation_failed', msg: 'whatever' }), '\u00e4'.repeat(37), 'auth_password_too_long'],
  ['validation_failed with exactly 72 bytes', json(400, { code: 'validation_failed', msg: 'whatever' }), '\u00e4'.repeat(36), 'err_password_unusable'],
  ['validation_failed without that context', json(400, { code: 'validation_failed', msg: 'Unable to validate email address: invalid format' }), 'a'.repeat(20), 'err_password_unusable'],
  // Message text is never consulted: a body that talks about 72 characters, with a short password.
  ['validation_failed whose text mentions 72 but the password is short', json(400, { code: 'validation_failed', msg: 'Password cannot be longer than 72 characters' }), 'a'.repeat(20), 'err_password_unusable'],
  ['a weak_password message that says "longer than 72" but reasons length', json(422, { code: 'weak_password', msg: 'Password cannot be longer than 72 characters', weak_password: { reasons: ['length'] } }), 'a'.repeat(5), 'err_password_length'],
  ['an unknown 4xx code', json(400, { code: 'something_else', msg: 'Password is too weak and too long' }), 'a'.repeat(80), 'err_register_failed'],
  ['an answer without a code', json(400, { msg: 'Password cannot be longer than 72 characters' }), 'a'.repeat(80), 'err_register_failed'],
]) {
  test(`registration: ${name} shows ${expected}`, async () => {
    assert.equal(signUpErrorKey(await signUpError(fetch, password), password), expected);
  });
}

test('registration: no provider message text reaches the result, only catalogue keys', async () => {
  const { en } = load('lib/i18n/en.ts');
  for (const fetch of [weak('length'), weak('pwned'), weak('characters'), json(400, { code: 'validation_failed', msg: 'raw provider text' })]) {
    const key = signUpErrorKey(await signUpError(fetch, 'a'.repeat(20)), 'a'.repeat(20));
    assert.ok(Object.hasOwn(en, key), key);
    assert.doesNotMatch(en[key], /provider text/);
  }
});

test('registration: errors that do not come from Auth keep the registration message', () => {
  for (const error of [new Error('Invalid name'), undefined, { status: 503 }]) assert.equal(signUpErrorKey(error, 'a'.repeat(80)), 'err_register_failed');
});
