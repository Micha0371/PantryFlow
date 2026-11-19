const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

// KAN-35: the pantry provider drops the row from its state before deleteItem
// resolves, so the closing edit screen must not fall back to its missing state.
const theme = load('lib/theme.ts');
const constants = load('lib/constants.ts');
const pantryData = load('lib/pantry-data.ts', { './constants': constants, './pagination': load('lib/pagination.ts') });
const shoppingData = load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') });
const pantryShopping = load('lib/pantry-shopping.ts');
const mutation = load('hooks/useItemMutation.ts', { 'expo-router': { useFocusEffect: () => {} } });
const t = key => key;
const item = { id: '1', household_id: 'h', name: 'Milk', category: 'dairy', location: 'fridge', status: 'in_stock' };

function render({ present = true, deleteResult = deferred(), drops = true, update = async () => item } = {}) {
  const state = { present, deleted: [], back: 0, alerts: [] };
  const native = { Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', Pressable: 'Pressable',
    ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' },
    Alert: { alert: (...args) => state.alerts.push(args) }, StyleSheet: { create: s => s } };
  let renderer;
  const { default: Screen } = load('app/edit-item/[id].tsx', {
    // Announcements are covered in screens.test.cjs (KAN-39); inert here.
    '@/hooks/useErrorAnnouncement': { useFocusedErrorAnnouncement: () => {} }, '@/hooks/useFormError': load('hooks/useFormError.ts'),
    'react-native': native, '@/lib/theme': theme, '@/lib/constants': constants,
    '@/lib/i18n': { useTranslation: () => ({ t }) },
    'expo-router': { useRouter: () => ({ back: () => { state.back++; } }), useLocalSearchParams: () => ({ id: '1' }) },
    '@/components/Button': { Button: 'Button' }, '@/components/Input': { Input: 'Input' },
    '@/components/OptionChips': { OptionChips: 'OptionChips' },
    '@/components/AuthGate': { AuthGate: ({ children }) => children },
    '@/hooks/useItemMutation': mutation, '@/lib/pantry-data': pantryData,
    '@/lib/shopping-data': shoppingData, '@/lib/pantry-shopping': pantryShopping,
    '@/hooks/usePantryItems': { usePantryItems: () => ({ loading: false, error: null, retry: () => {},
      getItem: () => (state.present ? item : null),
      updateItem: (...args) => update({ state, rerender: () => renderer.update(React.createElement(Screen)) }, ...args),
      deleteItem: id => {
        state.deleted.push(id);
        if (drops) {
          state.present = false;
          renderer.update(React.createElement(Screen));
        }
        return deleteResult.promise;
      } }) },
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ loading: false, items: [], addItem: async () => ({}) }) },
    '@/hooks/useShoppingPrompt': load('hooks/useShoppingPrompt.ts', { 'react-native': native,
      '@/hooks/useShoppingItems': { useShoppingItems: () => ({ loading: false, items: [], addItem: async () => ({}) }) },
      '@/lib/shopping-data': shoppingData, '@/lib/pantry-shopping': pantryShopping,
      '@/lib/i18n': { useTranslation: () => ({ t }) },
      '@/hooks/household-scope': { useHouseholdScope: () => ({ householdId: 'h' }) } }),
  });
  act(() => { renderer = create(React.createElement(Screen)); });
  const missingShown = () => renderer.root.findAll(n =>
    (n.type === 'Text' && /err_item_missing/.test(JSON.stringify(n.props.children)))
    || (n.type === 'Button' && ['common_retry', 'common_back'].includes(n.props.label))).length > 0;
  const confirmDelete = () => {
    act(() => renderer.root.findByProps({ testID: 'edit-item-delete' }).props.onPress());
    let pending;
    act(() => { pending = state.alerts.at(-1)[2].find(b => b.style === 'destructive').onPress(); });
    return pending;
  };
  return { renderer, state, missingShown, confirmDelete };
}

test('a successful pantry delete closes without showing the missing state', async () => {
  const d = deferred();
  const { renderer, state, missingShown, confirmDelete } = render({ deleteResult: d });
  try {
    const pending = confirmDelete();
    assert.deepEqual(state.deleted, ['1']);
    assert.equal(missingShown(), false, 'no missing state while the delete completes');
    await act(async () => { d.resolve(); await d.promise; await pending; });
    assert.equal(state.back, 1);
    assert.equal(missingShown(), false, 'no missing state while the screen closes');
  } finally { act(() => renderer.unmount()); }
});

test('a pantry delete that fails after the row was dropped shows the missing state', async () => {
  const d = deferred();
  const { renderer, state, missingShown, confirmDelete } = render({ deleteResult: d });
  try {
    const pending = confirmDelete();
    await act(async () => { d.reject(new Error('gone')); await pending; });
    assert.equal(state.back, 0);
    assert.equal(missingShown(), true);
  } finally { act(() => renderer.unmount()); }
});

test('a pantry delete that fails for another reason keeps the typed form and shows the error', async () => {
  const d = deferred();
  const { renderer, state, missingShown, confirmDelete } = render({ deleteResult: d, drops: false });
  try {
    act(() => renderer.root.findByType('Input').props.onChangeText('Oat milk'));
    const pending = confirmDelete();
    await act(async () => { d.reject(new Error('network')); await pending; });
    assert.equal(state.back, 0);
    assert.equal(missingShown(), false);
    const input = renderer.root.findByType('Input');
    assert.equal(input.props.value, 'Oat milk');
    assert.equal(input.props.error, 'err_delete_item');
  } finally { act(() => renderer.unmount()); }
});

test('an item already missing when the screen opens shows the missing state', () => {
  const { renderer, missingShown } = render({ present: false });
  try {
    assert.equal(missingShown(), true);
  } finally { act(() => renderer.unmount()); }
});

// CR-01 (KAN-115): saving an item deleted on another device. The provider drops
// the row and rejects; the screen must show the missing state with a way back
// instead of a form that fails on every further save.
test('a save that finds the item deleted elsewhere shows the missing state, not the form', async () => {
  const gone = Object.assign(new Error('0 rows'), { code: 'PGRST116' });
  const { renderer, state, missingShown } = render({ update: async ({ state: s, rerender }) => {
    s.present = false; rerender(); throw gone;
  } });
  try {
    act(() => renderer.root.findByType('Input').props.onChangeText('Oat milk'));
    await act(async () => { await renderer.root.findByProps({ testID: 'edit-item-save' }).props.onPress(); });
    assert.equal(state.back, 0, 'the screen does not close as if the save had worked');
    assert.equal(missingShown(), true);
    assert.equal(renderer.root.findAll(n => n.props.testID === 'edit-item-save').length, 0, 'no further edits of a missing item');
    assert.ok(renderer.root.findAll(n => n.type === 'Button' && n.props.label === 'common_back').length > 0);
  } finally { act(() => renderer.unmount()); }
});
