import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localStack, fixtures, cleanup } from './local-stack';

// KAN-61: the profiles.language boundary through ordinary authenticated clients.
test('profiles.language boundary from migrations 00001/00002', async t => {
  const stack = localStack();
  try {
    const [a, b] = await fixtures(stack);
    const read = async (user: typeof a, id: string) => {
      const result = await user.client.from('profiles').select('language').eq('id', id);
      assert.equal(result.error, null);
      return result.data;
    };

    await t.test('a new profile defaults to en', async () => {
      assert.deepEqual(await read(a, a.id), [{ language: 'en' }]);
    });

    await t.test('a user updates their own language to de and reads it back', async () => {
      const update = await a.client.from('profiles').update({ language: 'de' }).eq('id', a.id).select('language');
      assert.equal(update.error, null);
      assert.deepEqual(update.data, [{ language: 'de' }]);
      assert.deepEqual(await read(a, a.id), [{ language: 'de' }]);
    });

    await t.test("another user's language is neither readable nor updatable", async () => {
      assert.deepEqual(await read(b, a.id), []);
      const update = await b.client.from('profiles').update({ language: 'en' }).eq('id', a.id).select('language');
      assert.equal(update.error, null);
      assert.deepEqual(update.data, []);
      assert.deepEqual(await read(a, a.id), [{ language: 'de' }]);
      assert.deepEqual(await read(b, b.id), [{ language: 'en' }]);
    });

    await t.test('an unsupported language is rejected by profiles_language_valid', async () => {
      const update = await a.client.from('profiles').update({ language: 'fr' }).eq('id', a.id);
      assert.equal(update.error?.code, '23514');
      assert.match(update.error?.message ?? '', /profiles_language_valid/);
      assert.deepEqual(await read(a, a.id), [{ language: 'de' }]);
    });
  } finally {
    await cleanup(stack.admin);
  }
});
