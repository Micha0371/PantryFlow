const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-96 H3: the missing-item views stack message, Retry and Back with gap 12, full width.
const theme = load('lib/theme.ts');
const constants = load('lib/constants.ts');
const pagination = load('lib/pagination.ts');
const pantryData = load('lib/pantry-data.ts', { './constants': constants, './pagination': pagination });
const shoppingData = load('lib/shopping-data.ts', { './pagination': pagination });
const t = key => key;

const SCREENS = { edit: 'app/edit-item/[id].tsx', shopping: 'app/shopping-item/[id].tsx' };

function render(kind) {
  const Keyboard = { addListener: () => ({ remove: () => {} }) };
  const AppState = { addEventListener: () => ({ remove: () => {} }) };
  const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', Pressable: 'Pressable',
    ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' },
    Alert: { alert: () => {} }, Keyboard, AppState, StyleSheet: { create: s => s, hairlineWidth: 1 } };
  const useKeyboardOverlap = load('hooks/useKeyboardOverlap.ts', { 'react-native': native });
  const FormFooter = load('components/FormFooter.tsx', { 'react-native': native, '@/lib/theme': theme,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }) } });
  const mutation = load('hooks/useItemMutation.ts', { 'expo-router': { useFocusEffect: () => {} } });
  // The real Button, so the assertions see the style it actually renders.
  const { Button } = load('components/Button.tsx', { 'react-native': native, '@/lib/theme': theme });
  const { default: Screen } = load(SCREENS[kind], {
    'react-native': native, '@/lib/theme': theme, '@/lib/constants': constants,
    '@/lib/i18n': { useTranslation: () => ({ t }) },
    'expo-router': { useRouter: () => ({ back: () => {} }), useLocalSearchParams: () => ({ id: '1' }) },
    '@/components/Button': { Button }, '@/components/Input': { Input: 'Input' },
    '@/components/MissingItemState': load('components/MissingItemState.tsx', { 'react-native': native, '@/lib/theme': theme,
      '@/components/Button': { Button }, '@/lib/i18n': { useTranslation: () => ({ t }) } }),
    '@/components/OptionChips': { OptionChips: 'OptionChips' }, '@/components/InlineError': { InlineError: 'InlineError' },
    '@/components/AuthGate': { AuthGate: ({ children }) => children },
    '@/components/FormFooter': FormFooter, '@/hooks/useKeyboardOverlap': useKeyboardOverlap,
    '@/hooks/useItemMutation': mutation, '@/hooks/useFormError': load('hooks/useFormError.ts'),
    '@/hooks/useErrorAnnouncement': { useFocusedErrorAnnouncement: () => {} },
    '@/hooks/useShoppingPrompt': { useShoppingPrompt: () => ({ prompting: false, offer: () => {} }) },
    '@/lib/pantry-data': pantryData, '@/lib/shopping-data': shoppingData,
    '@/hooks/usePantryItems': { usePantryItems: () => ({ householdId: 'h', loading: false, error: null, retry: () => {},
      addItem: async () => null, getItem: () => undefined, updateItem: async () => null, deleteItem: async () => {} }) },
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ loading: false, error: null, retry: () => {},
      getItem: () => undefined, renameItem: async () => {}, deleteItem: async () => {} }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  return { renderer, Button };
}

const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
// Pressable takes a style function; resolve it for the resting (not pressed) state.
const resolved = style => flat(typeof style === 'function' ? style({ pressed: false }) : style);

for (const kind of ['edit', 'shopping']) {
  test(`${kind}: missing states stack message, Retry and Back with gap 12 and full-width buttons`, () => {
    const { renderer: r, Button } = render(kind);
    try {
      const alert = r.root.findByProps({ accessibilityRole: 'alert' });
      const container = alert.parent;
      // The message and both buttons are the container's direct children, in this order,
      // so the gap and stretch below apply to them (not to some wrapper).
      const kids = container.children.filter(c => typeof c !== 'string');
      assert.deepEqual(kids.map(c => c.type === Button ? c.props.label : 'alert'),
        ['alert', 'common_retry', 'common_back']);
      const s = flat(container.props.style);
      assert.equal(s.gap, theme.spacing.md);
      assert.equal(s.gap, 12);
      assert.equal(s.alignItems, 'stretch');
      // What each Button actually renders: nothing may shrink it or re-add a margin.
      const pressables = container.findAllByType('Pressable');
      assert.equal(pressables.length, 2);
      for (const p of pressables) {
        const bs = resolved(p.props.style);
        assert.ok(bs.alignSelf === undefined || bs.alignSelf === 'stretch', `alignSelf ${bs.alignSelf}`);
        assert.equal(bs.width, undefined);
        assert.equal(bs.maxWidth, undefined);
        assert.equal(bs.marginTop, undefined);
      }
    } finally { act(() => r.unmount()); }
  });
}
