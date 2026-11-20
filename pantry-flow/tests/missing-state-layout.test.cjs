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
  const { default: Screen } = load(SCREENS[kind], {
    'react-native': native, '@/lib/theme': theme, '@/lib/constants': constants,
    '@/lib/i18n': { useTranslation: () => ({ t }) },
    'expo-router': { useRouter: () => ({ back: () => {} }), useLocalSearchParams: () => ({ id: '1' }) },
    '@/components/Button': { Button: 'Button' }, '@/components/Input': { Input: 'Input' },
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
  return renderer;
}

const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

for (const kind of ['edit', 'shopping']) {
  test(`${kind}: missing states stack message, Retry and Back with gap 12 and full-width buttons`, () => {
    const r = render(kind);
    try {
      const alert = r.root.findByProps({ accessibilityRole: 'alert' });
      const container = alert.parent;
      const s = flat(container.props.style);
      assert.equal(s.gap, theme.spacing.md);
      assert.equal(s.gap, 12);
      assert.equal(s.alignItems, 'stretch');
      const buttons = container.findAllByType('Button');
      assert.equal(buttons.length, 2);
      for (const b of buttons) {
        const bs = flat(b.props.style);
        assert.notEqual(bs.alignSelf, 'center');
        assert.equal(bs.marginTop, undefined);
      }
    } finally { act(() => r.unmount()); }
  });
}
