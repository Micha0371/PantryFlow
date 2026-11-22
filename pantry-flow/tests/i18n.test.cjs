const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');
// The provider reads the build-time default; never depend on a value set in the shell or CI.
delete process.env.EXPO_PUBLIC_DEFAULT_LOCALE;

const language = load('lib/language.ts');
const localization = { getLocales: () => [{ languageCode: 'en' }] };

test('saved locale restores, missing translations fall back and locale changes persist', async () => {
  const storage = new Map([['user_language', 'de']]);
  const { en } = load('lib/i18n/en.ts');
  const { de } = load('lib/i18n/de.ts');
  const { I18nProvider, useTranslation } = load('lib/i18n/index.tsx', {
    './en': { en }, './de': { de }, '../language': language, 'expo-localization': localization,
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key), setItem: async (key, value) => { storage.set(key, value); },
    },
  });
  let current;
  function Probe() { current = useTranslation(); return React.createElement('Text', null, current.t('err_duplicate_item')); }
  let view;
  try {
    await act(async () => { view = create(React.createElement(I18nProvider, null, React.createElement(Probe))); });
    assert.equal(current.locale, 'de');
    // KAN-60: German is complete, so the restored German locale shows German text.
    assert.equal(view.toJSON().children[0], de.err_duplicate_item);
    assert.notEqual(de.err_duplicate_item, en.err_duplicate_item);
    assert.equal(current.t('unrecognized_test_key'), 'unrecognized_test_key');
    await act(async () => current.setLocale('en'));
    assert.equal(storage.get('user_language'), 'en');
    const { CATEGORIES, LOCATIONS, STATUSES } = load('lib/constants.ts');
    for (const [prefix, values] of [['cat', CATEGORIES], ['loc', LOCATIONS], ['status', STATUSES]]) {
      for (const value of values) assert.notEqual(current.t(`${prefix}_${value}`), `${prefix}_${value}`);
    }
  } finally { if (view) act(() => view.unmount()); }
});

// KAN-27: the context value is memoized, so consumers re-render for locale changes only.
test('the i18n context value is stable across a parent re-render and changes with the locale', async () => {
  const { en } = load('lib/i18n/en.ts');
  const { de } = load('lib/i18n/de.ts');
  const { I18nProvider, useTranslation } = load('lib/i18n/index.tsx', {
    './en': { en }, './de': { de }, '../language': language, 'expo-localization': localization,
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
  });
  const seen = [];
  function Probe() { seen.push(useTranslation()); return null; }
  const tree = () => React.createElement(I18nProvider, null, React.createElement(Probe));
  let view;
  try {
    await act(async () => { view = create(tree()); });
    const first = seen.at(-1);
    act(() => view.update(tree()));
    assert.equal(seen.at(-1), first);
    await act(async () => first.setLocale('de'));
    const german = seen.at(-1);
    assert.notEqual(german, first);
    assert.equal(german.locale, 'de');
    assert.equal(german.t('nav_shopping'), de.nav_shopping ?? en.nav_shopping);
    assert.equal(german.setLocale, first.setLocale);
  } finally { if (view) act(() => view.unmount()); }
});

// KAN-60: German is complete today; a key missing from a future German catalogue still
// falls back to English instead of showing its internal name.
test('a key missing from the German catalogue falls back to English', async () => {
  const { en } = load('lib/i18n/en.ts');
  const incompleteDe = { nav_pantry: 'Vorrat' };
  const { I18nProvider, useTranslation } = load('lib/i18n/index.tsx', {
    './en': { en }, './de': { de: incompleteDe }, '../language': language, 'expo-localization': localization,
    '@react-native-async-storage/async-storage': { getItem: async () => 'de', setItem: async () => {} },
  });
  let current;
  function Probe() { current = useTranslation(); return null; }
  let view;
  try {
    await act(async () => { view = create(React.createElement(I18nProvider, null, React.createElement(Probe))); });
    assert.equal(current.locale, 'de');
    assert.equal(current.t('nav_pantry'), 'Vorrat');
    assert.equal(current.t('err_duplicate_item'), en.err_duplicate_item);
  } finally { if (view) act(() => view.unmount()); }
});
