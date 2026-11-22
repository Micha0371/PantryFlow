import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localStack, fixtures, cleanup } from './local-stack';

// KAN-61: the profiles.language boundary through ordinary authenticated clients.
// Each test creates fresh fixture users and sets its own starting state, so the
// tests do not depend on each other or on their order.
type User = Awaited<ReturnType<typeof fixtures>>[number];

async function withUsers(run: (a: User, b: User) => Promise<void>) {
  const stack = localStack();
  try {
    const [a, b] = await fixtures(stack);
    await run(a, b);
  } finally {
    await cleanup(stack.admin);
  }
}

async function read(user: User, id: string) {
  const result = await user.client.from('profiles').select('language').eq('id', id);
  assert.equal(result.error, null);
  return result.data;
}

async function setOwn(user: User, language: string) {
  const update = await user.client.from('profiles').update({ language }).eq('id', user.id).select('language');
  assert.equal(update.error, null);
  assert.deepEqual(update.data, [{ language }]);
}

test('a new profile defaults to en (00001 column default)', () => withUsers(async a => {
  assert.deepEqual(await read(a, a.id), [{ language: 'en' }]);
}));

test('a user updates their own language to de and reads it back (00002 column grant)', () => withUsers(async a => {
  await setOwn(a, 'de');
  assert.deepEqual(await read(a, a.id), [{ language: 'de' }]);
}));

test("another user's language is neither readable nor updatable (00001 own-row policies)", () => withUsers(async (a, b) => {
  await setOwn(a, 'de');
  assert.deepEqual(await read(b, a.id), []);
  const update = await b.client.from('profiles').update({ language: 'en' }).eq('id', a.id).select('language');
  assert.equal(update.error, null);
  assert.deepEqual(update.data, []);
  assert.deepEqual(await read(a, a.id), [{ language: 'de' }]);
  assert.deepEqual(await read(b, b.id), [{ language: 'en' }]);
}));

test('an unsupported language is rejected (00002 profiles_language_valid)', () => withUsers(async a => {
  await setOwn(a, 'de');
  const update = await a.client.from('profiles').update({ language: 'fr' }).eq('id', a.id);
  assert.equal(update.error?.code, '23514');
  assert.match(update.error?.message ?? '', /profiles_language_valid/);
  assert.deepEqual(await read(a, a.id), [{ language: 'de' }]);
}));
