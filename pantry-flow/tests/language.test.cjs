const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');
// The provider reads the build-time default; never depend on a value set in the shell or CI.
delete process.env.EXPO_PUBLIC_DEFAULT_LOCALE;

const language = load('lib/language.ts');
const { phoneLocale, defaultLocale, isLocale } = language;

function mount(storage, phone, sets = []) {
  const { en } = load('lib/i18n/en.ts');
  const { de } = load('lib/i18n/de.ts');
  const { I18nProvider, useTranslation } = load('lib/i18n/index.tsx', {
    './en': { en }, './de': { de }, '../language': language,
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => { sets.push([key, value]); storage.set(key, value); },
    },
    'expo-localization': { getLocales: () => [{ languageCode: phone }] },
  });
  const ref = {};
  function Probe() { ref.current = useTranslation(); return null; }
  return { ref, Provider: I18nProvider, Probe };
}
async function run(storage, phone, sets) {
  const { ref, Provider, Probe } = mount(storage, phone, sets);
  let view;
  await act(async () => { view = create(React.createElement(Provider, null, React.createElement(Probe))); });
  const locale = ref.current.locale;
  act(() => view.unmount());
  return locale;
}

test('phoneLocale maps a German first locale to de and anything else to en', () => {
  assert.equal(phoneLocale([{ languageCode: 'de' }]), 'de');
  assert.equal(phoneLocale([{ languageCode: 'de', regionCode: 'AT', languageTag: 'de-AT' }]), 'de');
  assert.equal(phoneLocale([{ languageCode: 'fr' }]), 'en');
  assert.equal(phoneLocale([{ languageCode: null }]), 'en');
  assert.equal(phoneLocale([]), 'en');
  assert.equal(isLocale('de'), true);
  assert.equal(isLocale('xx'), false);
});

test('without a saved choice the provider starts in the phone language and does not save it', async () => {
  const sets = [];
  assert.equal(await run(new Map(), 'de', sets), 'de');
  assert.equal(sets.length, 0);
});

test('a saved choice wins over the phone language', async () => {
  assert.equal(await run(new Map([['user_language', 'en']]), 'de'), 'en');
});

test('an invalid saved value falls back to the phone language', async () => {
  assert.equal(await run(new Map([['user_language', 'xx']]), 'de'), 'de');
});

test('a phone language change is followed while no choice was saved', async () => {
  const storage = new Map();
  assert.equal(await run(storage, 'en'), 'en');
  assert.equal(await run(storage, 'de'), 'de');
});

test('a saved choice wins over the build-time default', async () => {
  const before = process.env.EXPO_PUBLIC_DEFAULT_LOCALE;
  process.env.EXPO_PUBLIC_DEFAULT_LOCALE = 'de';
  try {
    // The default is in effect without a saved choice (phone is English) ...
    assert.equal(await run(new Map(), 'en'), 'de');
    // ... and a saved choice replaces it.
    assert.equal(await run(new Map([['user_language', 'en']]), 'en'), 'en');
  } finally {
    if (before === undefined) delete process.env.EXPO_PUBLIC_DEFAULT_LOCALE;
    else process.env.EXPO_PUBLIC_DEFAULT_LOCALE = before;
  }
});

test('a valid build-time default replaces the phone language; an invalid one is ignored', () => {
  const phone = [{ languageCode: 'de' }];
  assert.equal(defaultLocale('en', phone), 'en');
  assert.equal(defaultLocale('xx', phone), 'de');
  assert.equal(defaultLocale(undefined, phone), phoneLocale(phone));
});

test('e2e prepare writes the English default unless the phone-language build is requested', () => {
  const { e2eLocaleEnv } = load('scripts/e2e-locale.ts');
  assert.deepEqual(e2eLocaleEnv(undefined), { EXPO_PUBLIC_DEFAULT_LOCALE: 'en' });
  assert.deepEqual(e2eLocaleEnv('other'), { EXPO_PUBLIC_DEFAULT_LOCALE: 'en' });
  assert.deepEqual(e2eLocaleEnv('phone'), {});
});
