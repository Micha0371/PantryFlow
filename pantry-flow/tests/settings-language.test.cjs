const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

const theme = load('lib/theme.ts');
const language = load('lib/language.ts');
const native = { Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: s => s } };
const catalogue = { settings_language: 'Language', err_language_save: 'Could not save your language to your account.', common_retry: 'Try again', auth_logout: 'Sign Out', err_signout: 'x' };
const OptionChips = load('components/OptionChips.tsx', { 'react-native': native, '@/lib/theme': theme }).OptionChips;
const InlineError = load('components/InlineError.tsx', { 'react-native': native }).InlineError;

function fixture({ user = { id: 'u1' }, save = async () => {} } = {}) {
  const calls = [], notes = [];
  let locale = 'en', view;
  const profile = {
    saveProfileLanguage: async (id, l) => { calls.push(['save', id, l]); return save(id, l); },
    setPendingLanguage: async (id, l) => { calls.push(['pending', id, l]); },
    clearPendingLanguage: async id => { calls.push(['clear', id]); },
    noteLanguageChoice: () => { notes.push(1); },
  };
  const { default: Settings } = load('app/(tabs)/settings.tsx', {
    'react-native': native, '@/lib/theme': theme, '@/lib/language': language,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useRouter: () => ({ replace() {} }) },
    '@/components/Button': { Button: 'Button' }, '@/components/InlineError': { InlineError },
    '@/components/OptionChips': { OptionChips },
    '@/lib/auth': { useAuth: () => ({ user, signOut: async () => {} }) },
    '@/lib/i18n': { useTranslation: () => ({ locale, t: k => catalogue[k] ?? k, setLocale: l => { calls.push(['setLocale', l]); locale = l; } }) },
    '@/lib/profile-language': profile,
  });
  const el = () => React.createElement(Settings);
  return {
    calls, notes,
    async mount() { await act(async () => { view = create(el()); }); },
    chip: l => view.root.findByProps({ testID: `settings-language-${l}` }),
    async press(l) { await act(async () => { view.root.findByProps({ testID: `settings-language-${l}` }).props.onPress(); }); },
    errorText: () => view.root.findAllByProps({ testID: 'settings-language-error' }).filter(n => typeof n.type === 'string').map(n => n.props.children),
    retry: () => view.root.findAllByProps({ testID: 'settings-language-retry' }).filter(n => n.type === 'Button')[0],
    json: () => JSON.stringify(view.toJSON()),
    dispose() { act(() => view.unmount()); },
  };
}
const writes = calls => calls.filter(c => c[0] === 'save').map(c => c[2]);

test('the language row shows English and Deutsch in their own language with the current one checked', async () => {
  const f = fixture();
  await f.mount();
  assert.equal(f.chip('en').findByType('Text').props.children, 'English');
  assert.equal(f.chip('de').findByType('Text').props.children, 'Deutsch');
  assert.equal(f.chip('en').props.accessibilityState.checked, true);
  assert.equal(f.chip('de').props.accessibilityState.checked, false);
  f.dispose();
});

test('choosing Deutsch applies it at once and saves it to the profile when signed in', async () => {
  const f = fixture();
  await f.mount();
  await f.press('de');
  assert.deepEqual(f.calls.filter(c => c[0] !== 'pending' && c[0] !== 'note'), [['setLocale', 'de'], ['save', 'u1', 'de'], ['clear', 'u1']]);
  assert.deepEqual(f.errorText(), []);
  f.dispose();
});

test('a failed profile save keeps Deutsch, shows the error and remembers it as pending; Retry saves and clears the error', async () => {
  let fail = true;
  const f = fixture({ save: async () => { if (fail) throw new Error('offline'); } });
  await f.mount();
  await f.press('de');
  assert.deepEqual(f.errorText(), ['Could not save your language to your account.']);
  assert.ok(f.calls.some(c => c[0] === 'pending' && c[2] === 'de'));
  assert.ok(!f.calls.some(c => c[0] === 'clear'));
  assert.deepEqual(f.calls.filter(c => c[0] === 'setLocale'), [['setLocale', 'de']]);
  fail = false;
  await act(async () => f.retry().props.onPress());
  assert.deepEqual(writes(f.calls), ['de', 'de']);
  assert.ok(f.calls.some(c => c[0] === 'clear'));
  assert.deepEqual(f.errorText(), []);
  assert.equal(f.retry(), undefined);
  f.dispose();
});

test('choosing a language notes the choice so the startup sync stands down', async () => {
  const f = fixture();
  await f.mount();
  await f.press('de');
  assert.equal(f.notes.length, 1);
  f.dispose();
});

test('signed out, choosing a language saves only on the device', async () => {
  const f = fixture({ user: null });
  await f.mount();
  await f.press('de');
  assert.deepEqual(f.calls.filter(c => c[0] !== 'note'), [['setLocale', 'de']]);
  f.dispose();
});

test('the last of two quick choices wins on screen and in the profile', async () => {
  const first = deferred();
  const f = fixture({ save: (id, l) => (l === 'de' ? first.promise : Promise.resolve()) });
  await f.mount();
  await f.press('de');
  await f.press('en');
  // Serialized: the second save waits for the first, and no pending record is cleared yet.
  assert.deepEqual(writes(f.calls), ['de']);
  assert.deepEqual(f.calls.filter(c => c[0] === 'clear'), []);
  await act(async () => first.resolve());
  assert.deepEqual(f.calls.filter(c => c[0] === 'setLocale').map(c => c[1]), ['de', 'en']);
  assert.equal(writes(f.calls).at(-1), 'en');
  const clears = f.calls.filter(c => c[0] === 'clear');
  assert.equal(clears.length, 1);
  assert.ok(f.calls.indexOf(clears[0]) > f.calls.findIndex(c => c[0] === 'save' && c[2] === 'en'));
  assert.deepEqual(f.errorText(), []);
  f.dispose();
});

test('chips expose radio semantics with the checked state', () => {
  let view;
  act(() => { view = create(React.createElement(OptionChips, { options: ['a', 'b'], value: 'b', onChange() {}, labelFor: k => k, testIDPrefix: 'x' })); });
  const a = view.root.findByProps({ testID: 'x-a' }), b = view.root.findByProps({ testID: 'x-b' });
  assert.equal(a.props.accessibilityRole, 'radio');
  assert.deepEqual([a.props.accessibilityState, b.props.accessibilityState], [{ checked: false }, { checked: true }]);
  act(() => view.unmount());
});

test('a profile update that touches no row is a failure', async () => {
  const mod = load('lib/profile-language.ts', {
    './supabase': { supabase: { from: () => ({ update: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) }) } },
    './language': language,
    '@react-native-async-storage/async-storage': {},
  });
  await assert.rejects(mod.saveProfileLanguage('u1', 'de'));
});
