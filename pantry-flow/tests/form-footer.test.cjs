const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-96 H1: Save and Cancel live in a footer that lifts above the Android keyboard.
const theme = load('lib/theme.ts');
const constants = load('lib/constants.ts');
const pagination = load('lib/pagination.ts');
const pantryData = load('lib/pantry-data.ts', { './constants': constants, './pagination': pagination });
const shoppingData = load('lib/shopping-data.ts', { './pagination': pagination });
const t = key => key;
const item = { id: '1', household_id: 'h', name: 'Milk', category: 'dairy', location: 'fridge', status: 'in_stock' };
const shoppingItem = { id: '1', household_id: 'h', pantry_item_id: null, name: 'Milk', is_checked: false,
  completed_at: null, created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01' };

const SCREENS = {
  add: { file: 'app/add-item.tsx', save: 'add-item-save', cancel: 'add-item-cancel', destructive: null },
  edit: { file: 'app/edit-item/[id].tsx', save: 'edit-item-save', cancel: 'edit-item-cancel', destructive: 'edit-item-delete' },
  shopping: { file: 'app/shopping-item/[id].tsx', save: 'shopping-edit-save', cancel: 'shopping-edit-cancel', destructive: 'shopping-edit-remove' },
};

function render(kind, os = 'android') {
  const listeners = [];
  const Keyboard = { addListener: (name, cb) => { const l = { name, cb }; listeners.push(l);
    return { remove: () => listeners.splice(listeners.indexOf(l), 1) }; } };
  const AppState = { addEventListener: () => ({ remove: () => {} }) };
  const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', Pressable: 'Pressable',
    ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: os },
    Alert: { alert: () => {} }, Keyboard, AppState, StyleSheet: { create: s => s, hairlineWidth: 1 } };
  const useKeyboardOverlap = load('hooks/useKeyboardOverlap.ts', { 'react-native': native });
  const FormFooter = load('components/FormFooter.tsx', { 'react-native': native, '@/lib/theme': theme });
  const mutation = load('hooks/useItemMutation.ts', { 'expo-router': { useFocusEffect: () => {} } });
  const { default: Screen } = load(SCREENS[kind].file, {
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
      addItem: async () => item, getItem: () => item, updateItem: async () => item, deleteItem: async () => {} }) },
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ loading: false, error: null, retry: () => {},
      getItem: () => shoppingItem, renameItem: async () => {}, deleteItem: async () => {} }) },
  });
  let renderer;
  // The root view of the screen measures 800 dp tall from the window top.
  act(() => { renderer = create(React.createElement(Screen),
    { createNodeMock: () => ({ measureInWindow: cb => cb(0, 0, 360, 800) }) }); });
  const emit = (name, e) => act(() => listeners.filter(l => l.name === name).forEach(l => l.cb(e)));
  const show = () => emit(os === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', { endCoordinates: { height: 240, screenY: 560 } });
  const hide = () => emit(os === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', {});
  const scroll = () => renderer.root.findByType('ScrollView');
  const footer = () => renderer.root.findByProps({ testID: 'form-footer' });
  const inside = (parent, id) => parent.findAll(n => n.props.testID === id).length > 0;
  const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
  return { renderer, show, hide, scroll, footer, inside, flat, cleanup: () => act(() => renderer.unmount()) };
}

test('the footer lifts by the keyboard overlap and returns when it hides', () => {
  const h = render('add');
  try {
    const f = () => h.flat(h.footer().props.style);
    assert.equal(f().paddingBottom, theme.spacing.xl);
    assert.equal(f().paddingHorizontal, theme.spacing.xl);
    assert.equal(f().paddingTop, theme.spacing.md);
    assert.equal(f().gap, theme.spacing.md);
    assert.equal(f().backgroundColor, theme.colors.bg);
    assert.equal(f().borderTopColor, theme.colors.border);
    h.show();
    assert.equal(f().paddingBottom, theme.spacing.xl + 240);
    h.hide();
    assert.equal(f().paddingBottom, theme.spacing.xl);
  } finally { h.cleanup(); }
});

test('iOS keeps KeyboardAvoidingView padding and applies no overlap to the footer', () => {
  const h = render('add', 'ios');
  try {
    h.show();
    assert.equal(h.flat(h.footer().props.style).paddingBottom, theme.spacing.xl);
    assert.equal(h.renderer.root.findByType('KeyboardAvoidingView').props.behavior, 'padding');
  } finally { h.cleanup(); }
});

for (const kind of ['add', 'edit', 'shopping']) {
  test(`${kind}: Cancel and Save render inside the footer, outside the ScrollView`, () => {
    const h = render(kind);
    try {
      const { save, cancel } = SCREENS[kind];
      assert.ok(h.inside(h.footer(), save));
      assert.ok(h.inside(h.footer(), cancel));
      assert.ok(!h.inside(h.scroll(), save));
      assert.ok(!h.inside(h.scroll(), cancel));
      assert.equal(h.footer().findAllByType('Button').length, 2);
    } finally { h.cleanup(); }
  });

  test(`${kind}: the ScrollView bottom padding includes the footer height and the overlap`, () => {
    const h = render(kind);
    try {
      const pad = () => h.flat(h.scroll().props.contentContainerStyle).paddingBottom;
      assert.equal(pad(), theme.spacing.xl);
      act(() => h.footer().props.onLayout({ nativeEvent: { layout: { height: 100 } } }));
      assert.equal(pad(), theme.spacing.xl + 100);
      h.show();
      // The footer now measures taller by the lift; only its own height is reserved once.
      act(() => h.footer().props.onLayout({ nativeEvent: { layout: { height: 340 } } }));
      assert.equal(pad(), theme.spacing.xl + 100 + 240);
      h.hide();
      assert.equal(pad(), theme.spacing.xl + 100);
    } finally { h.cleanup(); }
  });
}

for (const kind of ['edit', 'shopping']) {
  test(`${kind}: Delete and Remove stay in the scroll content`, () => {
    const h = render(kind);
    try {
      const id = SCREENS[kind].destructive;
      assert.ok(h.inside(h.scroll(), id));
      assert.ok(!h.inside(h.footer(), id));
    } finally { h.cleanup(); }
  });
}
