const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');
const theme = load('lib/theme.ts');
const native = { Keyboard: { dismiss: () => {} }, Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', FlatList: 'FlatList',
  Pressable: 'Pressable', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'ios' }, StyleSheet: { create: styles => styles } };
const t = key => key;
// KAN-39: the real announcement hook and live region, with a recording AccessibilityInfo.
const inlineError = load('components/InlineError.tsx', { 'react-native': { Text: 'Text', View: 'View' } });
const makeShared = announced => {
const announcement = load('hooks/useErrorAnnouncement.ts', {
  '@/lib/accessibility': load('lib/accessibility.ts', { 'react-native': { Platform: { OS: 'android' }, AccessibilityInfo: { announceForAccessibility: m => announced.push(m) } } }),
  'expo-router': { useFocusEffect: callback => React.useEffect(callback, [callback]) } });
const shared = { 'react-native': native, '@/lib/theme': theme,
  '@/components/MissingItemState': load('components/MissingItemState.tsx', { 'react-native': native, '@/lib/theme': theme, '@/components/Button': { Button: 'Button' }, '@/lib/i18n': { useTranslation: () => ({ t }) } }),
  '@/components/FormFooter': { FormFooter: 'FormFooter' }, '@/hooks/useKeyboardOverlap': { useKeyboardOverlap: () => 0 },
  '@/lib/i18n': { useTranslation: () => ({ t }) }, '@/components/Button': { Button: 'Button' },
  '@/hooks/useErrorAnnouncement': announcement, '@/components/InlineError': inlineError,
  '@/hooks/useFormError': load('hooks/useFormError.ts'),
  // UX-01B list wiring: modules the pantry list imports, inert in these tests.
  '@/components/StatusSelector': { StatusSelector: 'StatusSelector' },
  '@/hooks/useShoppingPrompt': { useShoppingPrompt: () => ({ prompting: false, offer: () => {}, invalidate: () => {} }), notice: () => {} },
  '@/lib/pantry-data': load('lib/pantry-data.ts', { './constants': load('lib/constants.ts'), './pagination': load('lib/pagination.ts') }),
  '@/lib/pantry-shopping': load('lib/pantry-shopping.ts'),
  '@/lib/accessibility': { announce: () => {} },
  // KAN-92 search: inert here; the rows come through unfiltered.
  '@/components/SearchField': { SearchField: 'SearchField' },
  '@/lib/pantry-search': { filterItemsByName: items => items },
  '@/hooks/useItemMutation': load('hooks/useItemMutation.ts', { 'expo-router': { useFocusEffect: callback => React.useEffect(callback, [callback]) } }), };
return shared;
};
const shared = () => makeShared([]);
const politeRegions = renderer => renderer.root.findAll(n => n.type === 'View' && n.props.accessibilityLiveRegion === 'polite');
// The real single-open hook runs with the same router stub; the list stays focused.
const routerStubs = push => {
  const expoRouter = { useRouter: () => ({ push }), useFocusEffect: callback => React.useEffect(callback, [callback]) };
  return { 'expo-router': expoRouter, '@/hooks/useKeyboardOverlap': { useKeyboardOverlap: () => 0 }, '@/hooks/useSingleOpen': load('hooks/useSingleOpen.ts', { 'expo-router': expoRouter }) };
};

test('initial inventory loading shows progress without claiming an empty pantry', () => {
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared(),
    ...routerStubs(() => {}), '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items: [], loading: true, error: null }) },
  });
  let renderer;
  try {
    act(() => { renderer = create(React.createElement(Screen)); });
    assert.equal(renderer.root.findAllByType('EmptyState').length, 0);
    assert.equal(renderer.root.findAllByType('Spinner').length, 1);
  } finally { if (renderer) act(() => renderer.unmount()); }
});

test('a failed initial pantry load shows retry instead of claiming the pantry is empty', () => {
  let retries = 0;
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared(),
    ...routerStubs(() => {}), '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items: [], loading: false, error: 'err_load_items', retry: () => retries++ }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  assert.equal(renderer.root.findAllByType('EmptyState').length, 0);
  act(() => renderer.root.findByType('Button').props.onPress());
  assert.equal(retries, 1);
  act(() => renderer.unmount());
});

test('empty pantry offers add navigation and populated pantry opens the selected item', ctx => {
  const navigation = [];
  let items = [];
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared(),
    ...routerStubs(route => navigation.push(route)),
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items, loading: false, error: null, isUnconfirmed: () => false }) },
  });
  // The add action and the rows share one lock (KAN-38). The list never blurs
  // here, so the one-second fallback releases it before the row tap. The
  // test-scoped mock is restored after the test, even when an assertion fails.
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  try {
    act(() => renderer.root.findByType('EmptyState').props.onCtaPress());
    assert.deepEqual(navigation, ['/add-item']);
    ctx.mock.timers.tick(1000);
    items = [{ id: 'selected-item' }];
    act(() => renderer.update(React.createElement(Screen)));
    assert.equal(renderer.root.findAllByType('EmptyState').length, 0);
    const row = renderer.root.findByType('FlatList').props.renderItem({ item: items[0] });
    act(() => row.props.onPress());
    assert.equal(navigation.at(-1), '/edit-item/selected-item');
  } finally { act(() => renderer.unmount()); }
});

test('fast repeated pantry row taps open one edit screen, even on different rows (KAN-33)', () => {
  const navigation = [];
  const items = [{ id: 'a' }, { id: 'b' }];
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared(),
    ...routerStubs(route => navigation.push(route)),
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items, loading: false, error: null, isUnconfirmed: () => false }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  try {
    const tap = item => renderer.root.findByType('FlatList').props.renderItem({ item }).props.onPress();
    act(() => { tap(items[0]); tap(items[0]); tap(items[1]); });
    assert.deepEqual(navigation, ['/edit-item/a']);
  } finally { act(() => renderer.unmount()); }
});

test('fast repeated add taps open one add screen (KAN-38)', () => {
  const navigation = [];
  let items = [];
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared(),
    ...routerStubs(route => navigation.push(route)),
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items, loading: false, error: null, isUnconfirmed: () => false }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  try {
    const cta = renderer.root.findByType('EmptyState').props.onCtaPress;
    act(() => { cta(); cta(); });
    assert.deepEqual(navigation, ['/add-item']);
  } finally { act(() => renderer.unmount()); }

  navigation.length = 0;
  items = [{ id: 'a' }];
  act(() => { renderer = create(React.createElement(Screen)); });
  try {
    const fab = () => renderer.root.findByProps({ testID: 'pantry-fab-add' }).props.onPress();
    const row = () => renderer.root.findByType('FlatList').props.renderItem({ item: items[0] }).props.onPress();
    act(() => { fab(); fab(); row(); });
    assert.deepEqual(navigation, ['/add-item']);
  } finally { act(() => renderer.unmount()); }
});

test('email-confirmation signup shows instructions and does not navigate to the pantry', async () => {
  const navigation = [];
  const { default: Register } = load('app/(auth)/register.tsx', { ...shared(),
    'expo-router': { Link: 'Link', useRouter: () => ({ replace: path => navigation.push(path) }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/Input': { Input: 'Input' },
    '@/lib/auth': { useAuth: () => ({ signUp: async () => 'confirmation_required' }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Register)); });
  const inputs = renderer.root.findAllByType('Input');
  act(() => { inputs[0].props.onChangeText('Alice'); inputs[1].props.onChangeText('a@example.com'); inputs[2].props.onChangeText('password'); });
  await act(async () => renderer.root.findByType('Button').props.onPress());
  assert.deepEqual(navigation, []);
  assert.match(JSON.stringify(renderer.toJSON()), /auth_check_email_message/);
  act(() => renderer.unmount());
});

test('sign-out failure is visible and does not navigate away', async () => {
  let navigation = 0;
  const { default: Settings } = load('app/(tabs)/settings.tsx', { ...shared(),
    'expo-router': { useRouter: () => ({ replace: () => navigation++ }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/lib/auth': { useAuth: () => ({ signOut: async () => { throw new Error('offline'); } }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Settings)); });
  await act(async () => renderer.root.findByType('Button').props.onPress());
  assert.equal(navigation, 0);
  assert.match(JSON.stringify(renderer.toJSON()), /err_signout/);
  assert.equal(renderer.root.findByType('Button').props.loading, false);
  act(() => renderer.unmount());
});

test('protected routes do not mount children during restoration, failure or signed-out access', () => {
  let state = { loading: true, error: null, session: null }, mounted = 0;
  const { AuthGate } = load('components/AuthGate.tsx', { ...shared(),
    'expo-router': { Redirect: 'Redirect' }, './Button': { Button: 'Button' },
    '@/lib/auth': { useAuth: () => ({ ...state, retrySession: async () => {} }) },
  });
  function Private() { mounted++; return React.createElement('Private'); }
  const tree = () => React.createElement(AuthGate, { requireSession: true }, React.createElement(Private));
  let renderer;
  act(() => { renderer = create(tree()); });
  assert.equal(mounted, 0);
  state = { loading: false, error: 'err_restore_session', session: null };
  act(() => renderer.update(tree()));
  assert.equal(mounted, 0);
  state = { loading: false, error: null, session: null };
  act(() => renderer.update(tree()));
  assert.equal(renderer.root.findByType('Redirect').props.href, '/(auth)/login');
  assert.equal(mounted, 0);
  state = { loading: false, error: null, session: { user: { id: 'u' } } };
  act(() => renderer.update(tree()));
  assert.equal(mounted, 1);
  act(() => renderer.unmount());
});

for (const [file, label] of [['app/add-item.tsx', 'item_add_button'], ['app/edit-item/[id].tsx', 'item_save_button']]) {
  test(`${file} translates a server unique-constraint rejection without navigating`, async () => {
    const constants = load('lib/constants.ts');
    const data = load('lib/pantry-data.ts', { './constants': constants, './pagination': load('lib/pagination.ts') });
    const { en } = load('lib/i18n/en.ts');
    const mutation = load('hooks/useItemMutation.ts', { 'expo-router': {
      useFocusEffect: callback => React.useEffect(callback, [callback]),
    } });
    let navigations = 0;
    const existing = { id: '1', household_id: 'h', name: 'Oat milk', category: 'dairy', location: 'fridge', status: 'in_stock' };
    const duplicate = async () => { throw { code: '23505' }; };
    const { default: Screen } = load(file, { ...shared(),
      'expo-router': { useRouter: () => ({ back: () => navigations++ }), useLocalSearchParams: () => ({ id: '1' }) },
      '@/lib/i18n': { useTranslation: () => ({ t: key => en[key] ?? key }) },
      '@/components/AuthGate': { AuthGate: ({ children }) => children },
      '@/components/Input': { Input: 'Input' }, '@/components/OptionChips': { OptionChips: 'OptionChips' },
      '@/hooks/useItemMutation': mutation, '@/lib/pantry-data': data, '@/lib/constants': constants,
      '@/hooks/useShoppingItems': { useShoppingItems: () => ({ addItem: async () => ({}) }) },
      '@/lib/shopping-data': load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') }),
      '@/lib/pantry-shopping': load('lib/pantry-shopping.ts'),
      '@/hooks/useShoppingPrompt': load('hooks/useShoppingPrompt.ts', { 'react-native': native,
        '@/hooks/useShoppingItems': { useShoppingItems: () => ({ addItem: async () => ({}) }) },
        '@/lib/shopping-data': load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') }),
        '@/lib/pantry-shopping': load('lib/pantry-shopping.ts'), '@/lib/i18n': { useTranslation: () => ({ t }) },
        '@/hooks/household-scope': { useHouseholdScope: () => ({ householdId: 'h' }) } }),
      '@/hooks/usePantryItems': { usePantryItems: () => ({ householdId: 'h', loading: false, error: null,
        addItem: duplicate, updateItem: duplicate, getItem: () => existing }) },
    });
    let renderer;
    act(() => { renderer = create(React.createElement(Screen)); });
    act(() => renderer.root.findByType('Input').props.onChangeText('milk'));
    await act(async () => renderer.root.findAllByType('Button').find(button => button.props.label === en[label]).props.onPress());
    assert.equal(renderer.root.findByType('Input').props.error, en.err_duplicate_item);
    assert.equal(navigations, 0);
    act(() => renderer.unmount());
  });
}

test('a failed pantry load is announced on the focused tab after the tab is spoken (KAN-39)', () => {
  const announced = [];
  const shared = () => makeShared(announced);
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared(),
    ...routerStubs(() => {}), '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items: [], loading: false, error: 'err_load_items', retry: () => {} }) },
  });
  mock.timers.enable({ apis: ['setTimeout'] });
  let renderer;
  try {
    act(() => { renderer = create(React.createElement(Screen)); });
    act(() => mock.timers.tick(1000));
    assert.deepEqual(announced, ['err_load_items']);
    const alert = renderer.root.find(n => n.type === 'Text' && n.props.accessibilityRole === 'alert');
    assert.equal(alert.props.children, 'err_load_items');
  } finally { if (renderer) act(() => renderer.unmount()); mock.timers.reset(); }
});

test('a sign-out failure appears inside a live region that was already mounted (KAN-39)', async () => {
  const { default: Settings } = load('app/(tabs)/settings.tsx', { ...shared(),
    'expo-router': { useRouter: () => ({ replace: () => {} }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/lib/auth': { useAuth: () => ({ signOut: async () => { throw new Error('offline'); } }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Settings)); });
  try {
    const [region] = politeRegions(renderer);
    assert.ok(region, 'the live region exists before any error');
    assert.equal(region.findAllByType('Text').length, 0);
    await act(async () => renderer.root.findByType('Button').props.onPress());
    assert.equal(politeRegions(renderer)[0], region);
    const alert = region.findByType('Text');
    assert.equal(alert.props.accessibilityRole, 'alert');
    assert.equal(alert.props.children, 'err_signout');
  } finally { act(() => renderer.unmount()); }
});

test('a session restore failure is announced without a screen focus (KAN-39)', () => {
  const announced = [];
  const shared = () => makeShared(announced);
  let state = { loading: true, error: null, session: null };
  const { AuthGate } = load('components/AuthGate.tsx', { ...shared(),
    'expo-router': { Redirect: 'Redirect' }, './Button': { Button: 'Button' },
    '@/lib/auth': { useAuth: () => ({ ...state, retrySession: async () => {} }) },
  });
  const tree = () => React.createElement(AuthGate, null, React.createElement('Private'));
  let renderer;
  act(() => { renderer = create(tree()); });
  try {
    assert.deepEqual(announced, []);
    state = { loading: false, error: 'err_restore_session', session: null };
    act(() => renderer.update(tree()));
    assert.deepEqual(announced, ['err_restore_session']);
    assert.equal(renderer.root.find(n => n.type === 'Text' && n.props.accessibilityRole === 'alert').props.children,
      'err_restore_session');
  } finally { act(() => renderer.unmount()); }
});

test('an Add Item load error appears inside a live region that was already mounted (KAN-39)', () => {
  const constants = load('lib/constants.ts');
  const data = load('lib/pantry-data.ts', { './constants': constants, './pagination': load('lib/pagination.ts') });
  let pantry = { householdId: 'h', loading: false, error: null, retry: () => {}, addItem: async () => ({}) };
  const { default: Screen } = load('app/add-item.tsx', { ...shared(),
    'expo-router': { useRouter: () => ({ back: () => {} }), useLocalSearchParams: () => ({}) },
    '@/components/AuthGate': { AuthGate: ({ children }) => children },
    '@/components/Input': { Input: 'Input' }, '@/components/OptionChips': { OptionChips: 'OptionChips' },
    '@/hooks/useItemMutation': load('hooks/useItemMutation.ts', { 'expo-router': {
      useFocusEffect: callback => React.useEffect(callback, [callback]) } }),
    '@/lib/pantry-data': data, '@/lib/constants': constants,
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ addItem: async () => ({}) }) },
    '@/lib/shopping-data': load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') }),
    '@/lib/pantry-shopping': load('lib/pantry-shopping.ts'),
    '@/hooks/usePantryItems': { usePantryItems: () => pantry },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  try {
    const before = politeRegions(renderer);
    assert.equal(before.length, 1, 'one live region for the load error before it appears');
    assert.equal(before[0].findAllByType('Text').length, 0);
    pantry = { ...pantry, error: 'err_load_items' };
    act(() => renderer.update(React.createElement(Screen)));
    assert.equal(politeRegions(renderer)[0], before[0]);
    const alert = before[0].findByType('Text');
    assert.equal(alert.props.accessibilityRole, 'alert');
    assert.equal(alert.props.children, 'err_load_items');
    assert.ok(renderer.root.findAllByType('Button').some(b => b.props.label === 'common_retry'));
  } finally { act(() => renderer.unmount()); }
});

for (const [file, label] of [['app/add-item.tsx', 'item_add_button'], ['app/edit-item/[id].tsx', 'item_save_button']]) {
  test(`${file}: Save twice with the same validation error announces it the second time (KAN-84)`, async () => {
  const announced = [];
  const shared = () => makeShared(announced);
    const constants = load('lib/constants.ts');
    const data = load('lib/pantry-data.ts', { './constants': constants, './pagination': load('lib/pagination.ts') });
    const { en } = load('lib/i18n/en.ts');
    const input = load('components/Input.tsx', {
      'react-native': { Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: s => s } },
      '@/lib/theme': theme, './InlineError': inlineError,
      '@/lib/accessibility': load('lib/accessibility.ts', { 'react-native': { Platform: { OS: 'android' },
        AccessibilityInfo: { announceForAccessibility: m => announced.push(m) } } }) });
    const existing = { id: '1', household_id: 'h', name: 'Oat milk', category: 'dairy', location: 'fridge', status: 'in_stock' };
    const { default: Screen } = load(file, { ...shared(),
      'expo-router': { useRouter: () => ({ back: () => {} }), useLocalSearchParams: () => ({ id: '1' }),
        useFocusEffect: callback => React.useEffect(callback, [callback]) },
      '@/lib/i18n': { useTranslation: () => ({ t: key => en[key] ?? key }) },
      '@/components/AuthGate': { AuthGate: ({ children }) => children },
      '@/components/Input': input, '@/components/OptionChips': { OptionChips: 'OptionChips' },
      '@/hooks/useItemMutation': load('hooks/useItemMutation.ts', { 'expo-router': {
        useFocusEffect: callback => React.useEffect(callback, [callback]) } }),
      '@/lib/pantry-data': data, '@/lib/constants': constants,
      '@/hooks/useShoppingItems': { useShoppingItems: () => ({ addItem: async () => ({}) }) },
      '@/lib/shopping-data': load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') }),
      '@/lib/pantry-shopping': load('lib/pantry-shopping.ts'),
      '@/hooks/useShoppingPrompt': load('hooks/useShoppingPrompt.ts', { 'react-native': native,
        '@/hooks/useShoppingItems': { useShoppingItems: () => ({ addItem: async () => ({}) }) },
        '@/lib/shopping-data': load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') }),
        '@/lib/pantry-shopping': load('lib/pantry-shopping.ts'), '@/lib/i18n': { useTranslation: () => ({ t }) },
        '@/hooks/household-scope': { useHouseholdScope: () => ({ householdId: 'h' }) } }),
      '@/hooks/usePantryItems': { usePantryItems: () => ({ householdId: 'h', loading: false, error: null,
        addItem: async () => ({}), updateItem: async () => ({}), getItem: () => existing }) },
    });
    let renderer;
    act(() => { renderer = create(React.createElement(Screen)); });
    try {
      act(() => renderer.root.findByType('TextInput').props.onChangeText('   '));
      const save = () => renderer.root.findAllByType('Button').find(button => button.props.label === en[label]).props.onPress();
      await act(async () => save());
      assert.equal(renderer.root.findByType(input.Input).props.error, en.err_required_name);
      assert.deepEqual(announced, [], 'the first error is spoken by the live region');
      await act(async () => save());
      assert.deepEqual(announced, [en.err_required_name]);
    } finally { act(() => renderer.unmount()); }
  });
}

for (const [file, fill, failing] of [
  ['app/(auth)/login.tsx', inputs => { inputs[0].props.onChangeText('a@example.com'); inputs[1].props.onChangeText('wrong'); },
    { signIn: async () => { throw new Error('denied'); } }],
  ['app/(auth)/register.tsx', inputs => { inputs[0].props.onChangeText('Alice'); inputs[1].props.onChangeText('a@example.com'); inputs[2].props.onChangeText('password'); },
    { signUp: async () => { throw new Error('denied'); } }],
]) {
  test(`${file}: each failed submit gives the error field a new announceKey (KAN-84)`, async () => {
    const { default: Screen } = load(file, { ...shared(),
      'expo-router': { Link: 'Link', useRouter: () => ({ replace: () => {} }) },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      '@/components/Input': { Input: 'Input' },
      '@/lib/auth': { useAuth: () => failing },
    });
    let renderer;
    act(() => { renderer = create(React.createElement(Screen)); });
    try {
      act(() => fill(renderer.root.findAllByType('Input')));
      const field = () => renderer.root.findAllByType('Input').find(i => 'error' in i.props);
      const before = field().props.announceKey;
      await act(async () => renderer.root.findByType('Button').props.onPress());
      const first = field().props.announceKey;
      await act(async () => renderer.root.findByType('Button').props.onPress());
      assert.ok(field().props.error);
      assert.notEqual(first, before);
      assert.notEqual(field().props.announceKey, first);
    } finally { act(() => renderer.unmount()); }
  });
}

test('the Edit Item screen announces a missing item or failed load as an alert (final review I1)', () => {
  const announced = [];
  const shared = () => makeShared(announced);
  const constants = load('lib/constants.ts');
  const data = load('lib/pantry-data.ts', { './constants': constants, './pagination': load('lib/pagination.ts') });
  const { default: Screen } = load('app/edit-item/[id].tsx', { ...shared(),
    'expo-router': { useRouter: () => ({ back: () => {} }), useLocalSearchParams: () => ({ id: '1' }),
      useFocusEffect: callback => React.useEffect(callback, [callback]) },
    '@/components/AuthGate': { AuthGate: ({ children }) => children },
    '@/components/Input': { Input: 'Input' }, '@/components/OptionChips': { OptionChips: 'OptionChips' },
    '@/hooks/useItemMutation': load('hooks/useItemMutation.ts', { 'expo-router': {
      useFocusEffect: callback => React.useEffect(callback, [callback]) } }),
    '@/lib/pantry-data': data, '@/lib/constants': constants,
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({ addItem: async () => ({}) }) },
    '@/lib/shopping-data': load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') }),
    '@/lib/pantry-shopping': load('lib/pantry-shopping.ts'),
    '@/hooks/useShoppingPrompt': load('hooks/useShoppingPrompt.ts', { 'react-native': native,
      '@/hooks/useShoppingItems': { useShoppingItems: () => ({ addItem: async () => ({}) }) },
      '@/lib/shopping-data': load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') }),
      '@/lib/pantry-shopping': load('lib/pantry-shopping.ts'), '@/lib/i18n': { useTranslation: () => ({ t }) },
      '@/hooks/household-scope': { useHouseholdScope: () => ({ householdId: 'h' }) } }),
    '@/hooks/usePantryItems': { usePantryItems: () => ({ householdId: 'h', loading: false, error: 'err_load_items',
      retry: () => {}, updateItem: async () => ({}), deleteItem: async () => {}, getItem: () => undefined }) },
  });
  mock.timers.enable({ apis: ['setTimeout'] });
  let renderer;
  try {
    act(() => { renderer = create(React.createElement(Screen)); });
    const alert = renderer.root.find(n => n.type === 'Text' && n.props.accessibilityRole === 'alert');
    assert.equal(alert.props.children, 'err_load_items');
    act(() => mock.timers.tick(1000));
    assert.deepEqual(announced, ['err_load_items']);
  } finally { if (renderer) act(() => renderer.unmount()); mock.timers.reset(); }
});

// Package 5 review M4: a Pantry load error on an unfocused tab is not announced
// until the user opens that tab.
test('a pantry load error on an unfocused tab is announced only once the tab is focused', () => {
  const announced = [];
  const shared = () => makeShared(announced);
  let setFocused;
  const focusable = load('hooks/useErrorAnnouncement.ts', {
    '@/lib/accessibility': load('lib/accessibility.ts', { 'react-native': { Platform: { OS: 'android' }, AccessibilityInfo: { announceForAccessibility: m => announced.push(m) } } }),
    'expo-router': { useFocusEffect: callback => {
      const [focused, set] = React.useState(false);
      setFocused = set;
      React.useEffect(() => (focused ? callback() : undefined), [focused, callback]);
    } } });
  const { default: Screen } = load('app/(tabs)/index.tsx', { ...shared(), '@/hooks/useErrorAnnouncement': focusable,
    ...routerStubs(() => {}), '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/PantryItem': { PantryItem: 'Item' },
    '@/hooks/usePantryItems': { usePantryItems: () => ({ items: [], loading: false, error: 'err_load_items', retry: () => {} }) },
  });
  mock.timers.enable({ apis: ['setTimeout'] });
  let renderer;
  try {
    act(() => { renderer = create(React.createElement(Screen)); });
    act(() => mock.timers.tick(5000));
    assert.deepEqual(announced, [], 'nothing while another tab is visible');
    act(() => setFocused(true));
    act(() => mock.timers.tick(1000));
    assert.deepEqual(announced, ['err_load_items']);
  } finally { if (renderer) act(() => renderer.unmount()); mock.timers.reset(); }
});
