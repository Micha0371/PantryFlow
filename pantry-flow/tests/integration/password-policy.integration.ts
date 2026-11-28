import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { appRoot, localStack, localUrl, password as fixturePassword, removeUserByEmail, runThenCleanup, withTestUsers } from './local-stack';

// KAN-83, password spec §6 P01–P05: the approved policy (15 code points, at most 72 UTF-8 bytes,
// no character rules) is enforced by local Auth itself (CLI 3.2.0 / Auth v2.198.0,
// minimum_password_length = 15), whatever the client does. Reserved pf.test.* accounts only,
// all removed. Never prints passwords.

type Outcome = 'accepted' | 'length' | 'too_long';
type AuthFailure = { status?: number; code?: string; reasons?: string[] } | null;
const e = 'é'; // e + combining acute: two code points, one visible character

// The §2.3 table of the spec. Accepted values are all distinct (a repeated value is `same_password`).
const ROWS: [string, string, Outcome][] = [
  ['14 ASCII', 'a'.repeat(14), 'length'],
  ['15 ASCII', 'b'.repeat(15), 'accepted'],
  ['14 × ä (28 bytes)', 'ä'.repeat(14), 'length'],
  ['15 × ä', 'ä'.repeat(15), 'accepted'],
  ['15 × 😀 (60 bytes)', '😀'.repeat(15), 'accepted'],
  ['14 × e+U+0301 (28 code points)', e.repeat(14), 'accepted'],
  ['7 × e+U+0301 (14 code points, 7 visible)', e.repeat(7), 'length'],
  ['64 ASCII', 'c'.repeat(64), 'accepted'],
  ['72 ASCII', 'd'.repeat(72), 'accepted'],
  ['73 ASCII', 'f'.repeat(73), 'too_long'],
  ['36 × ä (72 bytes)', 'ä'.repeat(36), 'accepted'],
  ['37 × ä (74 bytes)', 'ä'.repeat(37), 'too_long'],
  ['64 × ä (128 bytes)', 'ä'.repeat(64), 'too_long'],
  ['18 × 😀 (72 bytes)', '😀'.repeat(18), 'accepted'],
  ['19 × 😀 (76 bytes)', '😀'.repeat(19), 'too_long'],
  ['64 × 😀 (256 bytes)', '😀'.repeat(64), 'too_long'],
  ['passphrase with leading and trailing spaces', '  correct horse battery  ', 'accepted'],
];
// Accepted rows whose sign-in is checked: the boundaries and the spaces.
const SIGN_IN_CHECKED = new Set(['15 ASCII', '15 × ä', '14 × e+U+0301 (28 code points)', '72 ASCII', '36 × ä (72 bytes)', '18 × 😀 (72 bytes)', 'passphrase with leading and trailing spaces']);

function outcome(error: AuthFailure): string {
  if (!error) return 'accepted';
  if (error.status === 422 && error.code === 'weak_password' && error.reasons?.includes('length')) return 'length';
  if (error.status === 400 && error.code === 'validation_failed') return 'too_long';
  return `other ${error.status} ${error.code}`;
}

const email = (label: string) => `pf.test.pwpolicy.${label}.${randomUUID().slice(0, 8)}@example.com`;
async function accountExists(stack: ReturnType<typeof localStack>, address: string) {
  const { data, error } = await stack.admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.some(user => user.email === address);
}
async function signsIn(stack: ReturnType<typeof localStack>, address: string, value: string) {
  const { data, error } = await stack.client().auth.signInWithPassword({ email: address, password: value });
  return { ok: error === null && !!data.session, error, weakPassword: data.weakPassword };
}

test('P01–P03: a password change accepts and rejects exactly the §2.3 rows, and stores the value as given', async () => {
  await withTestUsers(1, 'pwpolicy-update', async ([user], stack) => {
    for (const [label, value, expected] of ROWS) {
      const { error } = await user.client.auth.updateUser({ password: value });
      assert.equal(outcome(error as AuthFailure), expected, label);
      if (expected === 'accepted' && SIGN_IN_CHECKED.has(label)) {
        assert.ok((await signsIn(stack, user.email, value)).ok, `${label}: signs in with the exact value`);
      }
    }
    // The last accepted value keeps its spaces: without them it is a different password.
    assert.equal((await signsIn(stack, user.email, 'correct horse battery')).ok, false, 'spaces are part of the password');
  });
});

test('P01, P02: sign-up rejects every disallowed row without creating an account, and accepts 15 characters', async () => {
  const stack = localStack();
  const created: string[] = [];
  await runThenCleanup(async () => {
    for (const [label, value, expected] of ROWS.filter(row => row[2] !== 'accepted')) {
      const address = email('signup-rejected');
      created.push(address);
      const { error } = await stack.client().auth.signUp({ email: address, password: value });
      assert.equal(outcome(error as AuthFailure), expected, label);
      assert.equal(await accountExists(stack, address), false, `${label}: no account was created`);
    }
    const address = email('signup-accepted');
    created.push(address);
    const { error } = await stack.client().auth.signUp({ email: address, password: 'b'.repeat(15) });
    assert.equal(error, null, '15 ASCII characters are accepted at sign-up');
    assert.equal(await accountExists(stack, address), true);
  }, async () => { for (const address of created) await removeUserByEmail(stack.admin, address); });
});

test('P03: no truncation at 72 bytes: the full password signs in, a 71-byte prefix does not', async () => {
  await withTestUsers(1, 'pwpolicy-truncation', async ([user], stack) => {
    for (const [value, prefix] of [['x'.repeat(71) + 'y', 'x'.repeat(71)], ['ä'.repeat(35) + 'ö', 'ä'.repeat(35)]]) {
      assert.equal((await user.client.auth.updateUser({ password: value })).error, null);
      assert.equal((await signsIn(stack, user.email, value)).ok, true, 'the whole password signs in');
      const prefixed = await signsIn(stack, user.email, prefix);
      assert.equal(prefixed.ok, false, 'a prefix of it does not');
      assert.equal(prefixed.error?.code, 'invalid_credentials');
    }
  });
});

test('P04: raw POST /signup, raw PUT /user and the admin API cannot set a 14-code-point password', async () => {
  await withTestUsers(1, 'pwpolicy-raw', async ([user], stack) => {
    const short = 'a'.repeat(14);
    const address = email('raw-signup');
    await runThenCleanup(async () => {
      const signup = await fetch(`${localUrl}/auth/v1/signup`, { method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { apikey: stack.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: address, password: short }) });
      const signupBody = await signup.json();
      assert.equal(signup.status, 422);
      assert.equal(signupBody.error_code ?? signupBody.code, 'weak_password');
      assert.equal(await accountExists(stack, address), false);

      const session = (await user.client.auth.getSession()).data.session;
      assert.ok(session, 'the fixture user is signed in');
      const update = await fetch(`${localUrl}/auth/v1/user`, { method: 'PUT', signal: AbortSignal.timeout(20000),
        headers: { apikey: stack.key, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: short }) });
      const updateBody = await update.json();
      assert.equal(update.status, 422);
      assert.equal(updateBody.error_code ?? updateBody.code, 'weak_password');
      assert.equal((await signsIn(stack, user.email, fixturePassword)).ok, true, 'the password did not change');

      // Not even the admin API (service role) can set it.
      const adminUpdate = await stack.admin.auth.admin.updateUserById(user.id, { password: short });
      assert.equal(outcome(adminUpdate.error as AuthFailure), 'length');
      const adminCreate = await stack.admin.auth.admin.createUser({ email: address, password: short, email_confirm: true });
      assert.equal(outcome(adminCreate.error as AuthFailure), 'length');
      assert.equal(await accountExists(stack, address), false);
    }, () => removeUserByEmail(stack.admin, address));
  });
});

test('P05: a legacy 6-character account signs in with weakPassword, and its next password must comply', async () => {
  const stack = localStack();
  const address = email('legacy');
  await runThenCleanup(async () => {
    const { data, error } = await stack.admin.auth.admin.createUser({ email: address, password: fixturePassword, email_confirm: true });
    assert.equal(error, null);
    // A password from before the policy can only be set in the database: Auth refuses it everywhere.
    const legacy = 'abc123';
    execFileSync(process.execPath, [path.join(appRoot, 'node_modules/supabase/dist/supabase.js'), 'db', 'query',
      `update auth.users set encrypted_password = extensions.crypt('${legacy}', extensions.gen_salt('bf')) where id = '${data.user!.id}'`],
    { cwd: appRoot, stdio: 'ignore', timeout: 60000 });
    const client = stack.client();
    const login = await client.auth.signInWithPassword({ email: address, password: legacy });
    assert.equal(login.error, null, 'the legacy account signs in');
    assert.ok(login.data.session);
    assert.deepEqual(login.data.weakPassword?.reasons, ['length']);
    assert.equal(outcome((await client.auth.updateUser({ password: 'a'.repeat(14) })).error as AuthFailure), 'length', 'a new password must comply');
    const compliant = 'milk and eggs on tuesday';
    assert.equal((await client.auth.updateUser({ password: compliant })).error, null);
    const next = await signsIn(stack, address, compliant);
    assert.equal(next.ok, true);
    assert.equal(next.weakPassword, undefined, 'a compliant password brings no advisory');
  }, () => removeUserByEmail(stack.admin, address));
});
