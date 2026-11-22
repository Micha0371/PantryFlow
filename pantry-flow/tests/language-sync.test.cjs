const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');
// The provider reads the build-time default; never depend on a value set in the shell or CI.
delete process.env.EXPO_PUBLIC_DEFAULT_LOCALE;

const language = load('lib/language.ts');
const localization = { getLocales: () => [{ languageCode: 'en' }] };

function syncFixture({ fetch, pending = {}, save = async () => {} } = {}) {
  const calls = [];
  const store = { ...pending };
  let generation = 0;
  let pendingGate = null;
  let auth = { user: null };
  const profile = {
    fetchProfileLanguage: async id => { calls.push(['fetch', id]); return fetch(id); },
    saveProfileLanguage: async (id, l) => { calls.push(['save', id, l]); return save(id, l); },
    getPendingLanguage: async id => { if (pendingGate) await pendingGate; return store[id] ?? null; },
    clearPendingLanguage: async id => { calls.push(['clear', id]); delete store[id]; },
    languageChoiceGeneration: () => generation,
  };
  const setLocale = l => calls.push(['setLocale', l]);
  const { LanguageSync } = load('components/LanguageSync.tsx', {
    '@/lib/auth': { useAuth: () => auth },
    '@/lib/i18n': { useTranslation: () => ({ setLocale }) },
    '@/lib/profile-language': profile,
  });
  let view;
  const el = () => React.createElement(LanguageSync);
  return {
    calls, store,
    choose() { generation++; },
    delayPendingRead(p) { pendingGate = p; },
    async mount(user) { auth = { user }; await act(async () => { view = create(el()); }); },
    async setUser(user) { auth = { user }; await act(async () => { view.update(el()); }); },
    dispose() { act(() => view.unmount()); },
  };
}
const locales = calls => calls.filter(c => c[0] === 'setLocale').map(c => c[1]);

test('on sign-in the account language is applied', async () => {
  const f = syncFixture({ fetch: async () => 'de' });
  await f.mount({ id: 'u1' });
  assert.deepEqual(locales(f.calls), ['de']);
  f.dispose();
});

test('a pending choice is written to the profile before anything else and then applied', async () => {
  const f = syncFixture({ fetch: async () => 'en', pending: { u1: 'de' } });
  await f.mount({ id: 'u1' });
  // The pending choice replaces the profile read: no fetch at all.
  assert.deepEqual(f.calls, [['save', 'u1', 'de'], ['clear', 'u1'], ['setLocale', 'de']]);
  assert.equal(f.store.u1, undefined);
  assert.deepEqual(locales(f.calls), ['de']);
  f.dispose();
});

test('a failed pending write keeps the pending choice and applies it', async () => {
  const f = syncFixture({ fetch: async () => 'en', pending: { u1: 'de' }, save: async () => { throw new Error('offline'); } });
  await f.mount({ id: 'u1' });
  assert.equal(f.store.u1, 'de');
  assert.deepEqual(locales(f.calls), ['de']);
  f.dispose();
});

test('an offline profile read keeps the current language', async () => {
  const f = syncFixture({ fetch: async () => { throw new Error('offline'); } });
  await f.mount({ id: 'u1' });
  assert.deepEqual(locales(f.calls), []);
  f.dispose();
});

test('a read for a previous user is dropped', async () => {
  const a = deferred();
  const f = syncFixture({ fetch: id => (id === 'A' ? a.promise : Promise.resolve('en')) });
  await f.mount({ id: 'A' });
  await f.setUser({ id: 'B' });
  await act(async () => a.resolve('de'));
  assert.deepEqual(locales(f.calls), ['en']);
  f.dispose();
});

test('a read that resolves after a newer Settings choice applies nothing', async () => {
  const read = deferred();
  const f = syncFixture({ fetch: () => read.promise });
  await f.mount({ id: 'u1' });
  f.choose();
  await act(async () => read.resolve('de'));
  assert.deepEqual(locales(f.calls), []);
  f.dispose();
});

test('a Settings choice during a pending flush: the older locale is not applied and the pending key is not cleared', async () => {
  const write = deferred();
  const f = syncFixture({ pending: { u1: 'de' }, save: () => write.promise });
  await f.mount({ id: 'u1' });
  f.store.u1 = 'en'; // Settings wrote its own pending choice
  f.choose();
  await act(async () => write.resolve());
  assert.deepEqual(f.calls.filter(c => c[0] === 'clear'), []);
  assert.deepEqual(locales(f.calls), []);
  assert.equal(f.store.u1, 'en');
  f.dispose();
});

test('a Settings choice made before the pending save starts: LanguageSync does not save', async () => {
  const f = syncFixture({ pending: { u1: 'de' } });
  const pendingRead = deferred();
  // Delay the pending read so the choice lands between effect start and the save.
  f.delayPendingRead(pendingRead.promise);
  await f.mount({ id: 'u1' });
  f.choose();
  await act(async () => pendingRead.resolve());
  assert.deepEqual(f.calls.filter(c => c[0] === 'save'), []);
  assert.deepEqual(locales(f.calls), []);
  f.dispose();
});

test('the user changing during a pending flush applies nothing for the old user', async () => {
  const write = deferred();
  const f = syncFixture({ fetch: async () => 'en', pending: { A: 'de' }, save: id => (id === 'A' ? write.promise : Promise.resolve()) });
  await f.mount({ id: 'A' });
  await f.setUser({ id: 'B' });
  await act(async () => write.resolve());
  assert.deepEqual(locales(f.calls), ['en']);
  // The old user's write succeeded, so only their own pending record is cleared.
  assert.equal(f.store.A, undefined);
  f.dispose();
});

test('the user changing while the pending read is in flight applies nothing for the old user', async () => {
  const gate = deferred();
  const f = syncFixture({ fetch: async () => 'en', pending: { A: 'de' } });
  f.delayPendingRead(gate.promise);
  await f.mount({ id: 'A' });
  await f.setUser({ id: 'B' });
  await act(async () => gate.resolve());
  assert.deepEqual(locales(f.calls), ['en']);
  f.dispose();
});

test('signing out during an in-flight profile read applies nothing', async () => {
  const read = deferred();
  const f = syncFixture({ fetch: () => read.promise });
  await f.mount({ id: 'u1' });
  await f.setUser(null);
  await act(async () => read.resolve('de'));
  assert.deepEqual(locales(f.calls), []);
  f.dispose();
});

test('signing out during a pending flush applies nothing', async () => {
  const write = deferred();
  const f = syncFixture({ pending: { u1: 'de' }, save: () => write.promise });
  await f.mount({ id: 'u1' });
  await f.setUser(null);
  await act(async () => write.resolve());
  assert.deepEqual(locales(f.calls), []);
  f.dispose();
});

test('signing out applies nothing', async () => {
  const f = syncFixture({ fetch: async () => 'de' });
  await f.mount(null);
  assert.deepEqual(f.calls, []);
  f.dispose();
});

test('a pre-KAN-61 account keeps its saved English', async () => {
  const f = syncFixture({ fetch: async () => 'en' });
  await f.mount({ id: 'u1' });
  assert.deepEqual(locales(f.calls), ['en']);
  f.dispose();
});

test('profile-language reads, validates and writes through supabase and storage', async () => {
  const storage = new Map();
  let row = { language: 'de' }, updated, failWrite = false;
  const query = {
    select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: row, error: null }),
    update(v) { return { eq: (c, id) => { updated = [v, c, id]; return { select: async () => ({ data: [{ id }], error: failWrite ? new Error('x') : null }) }; } }; },
  };
  const mod = load('lib/profile-language.ts', {
    './supabase': { supabase: { from: t => { assert.equal(t, 'profiles'); return query; } } },
    './language': language,
    '@react-native-async-storage/async-storage': {
      getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => { storage.set(k, v); }, removeItem: async k => { storage.delete(k); },
    },
  });
  assert.equal(await mod.fetchProfileLanguage('u1'), 'de');
  row = { language: 'fr' }; assert.equal(await mod.fetchProfileLanguage('u1'), null);
  row = null; assert.equal(await mod.fetchProfileLanguage('u1'), null);
  await mod.saveProfileLanguage('u1', 'en');
  assert.deepEqual(updated, [{ language: 'en' }, 'id', 'u1']);
  failWrite = true;
  await assert.rejects(mod.saveProfileLanguage('u1', 'en'));
  await mod.setPendingLanguage('u1', 'de');
  assert.equal(storage.get('pending_language:u1'), 'de');
  assert.equal(await mod.getPendingLanguage('u1'), 'de');
  storage.set('pending_language:u2', 'xx');
  assert.equal(await mod.getPendingLanguage('u2'), null);
  await mod.clearPendingLanguage('u1');
  assert.equal(storage.has('pending_language:u1'), false);
});

for (const outcome of ['signed_in', 'confirmation_required']) {
  test(`signUp stores the current locale as pending for the new user (${outcome})`, async () => {
    const pending = {};
    const session = outcome === 'signed_in' ? { user: { id: 'u1' } } : null;
    const auth = {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: async () => ({ data: { user: { id: 'u1' }, session }, error: null }),
    };
    const { AuthProvider, useAuth } = load('lib/auth.tsx', {
      './supabase': { supabase: { auth } }, 'expo-linking': { createURL: () => 'x' },
      './native-auth-crypto': { assertSecurePkce() {} },
      './i18n': { useTranslation: () => ({ locale: 'de' }) },
      './profile-language': { setPendingLanguage: async (id, l) => { pending[id] = l; } },
    });
    let value, view;
    function C() { value = useAuth(); return null; }
    await act(async () => { view = create(React.createElement(AuthProvider, null, React.createElement(C))); });
    let result;
    await act(async () => { result = await value.signUp('Ann', 'a@b.c', 'pw'); });
    assert.equal(result, outcome);
    assert.deepEqual(pending, { u1: 'de' });
    act(() => view.unmount());
  });
}

test('the initial storage read does not overwrite an explicit setLocale', async () => {
  const { en } = load('lib/i18n/en.ts');
  const { de } = load('lib/i18n/de.ts');
  const read = deferred();
  const { I18nProvider, useTranslation } = load('lib/i18n/index.tsx', {
    './en': { en }, './de': { de }, '../language': language, 'expo-localization': localization,
    '@react-native-async-storage/async-storage': { getItem: () => read.promise, setItem: async () => {} },
  });
  let current, view;
  function P() { current = useTranslation(); return null; }
  await act(async () => { view = create(React.createElement(I18nProvider, null, React.createElement(P))); });
  await act(async () => current.setLocale('de'));
  await act(async () => read.resolve('en'));
  assert.equal(current.locale, 'de');
  act(() => view.unmount());
});
