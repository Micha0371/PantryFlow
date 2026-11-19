const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

const theme = load('lib/theme.ts');
const constants = load('lib/constants.ts');
const pagination = load('lib/pagination.ts');
const pantryData = load('lib/pantry-data.ts', { './constants': constants, './pagination': pagination });
const pantryShopping = load('lib/pantry-shopping.ts');
const statusMenu = load('lib/status-menu.ts');
const pantrySearch = load('lib/pantry-search.ts', { './pantry-data': pantryData });
const t = key => key;
const i18n = { useTranslation: () => ({ t }) };
const NODE = { measureInWindow: cb => cb(10, 20, 30, 40) };
const mk = (id, name, status = 'in_stock') => ({ id, household_id: 'h', name, category: 'dairy', location: 'fridge', status });

function render(initial) {
  const log = { writes: [], announced: [], nav: [], dismissed: 0, listeners: [], removed: 0,
    emit: (name, e) => log.listeners.filter(l => l.name === name).forEach(l => l.cb(e)) };
  const store = { items: initial, household: 'h', force: () => {} };
  const native = { Text: 'Text', View: 'View', TextInput: 'TextInput', ActivityIndicator: 'Spinner', Pressable: 'Pressable', Modal: 'Modal',
    Platform: { OS: 'android' }, Keyboard: { dismiss: () => { log.dismissed += 1; },
      addListener: (name, cb) => { const l = { name, cb }; log.listeners.push(l); return { remove: () => { log.removed += 1; log.listeners.splice(log.listeners.indexOf(l), 1); } }; } }, StyleSheet: { create: s => s, absoluteFill: {} },
    useWindowDimensions: () => ({ width: 400, height: 800 }),
    AccessibilityInfo: { setAccessibilityFocus: () => {} }, findNodeHandle: () => null,
    FlatList: props => React.createElement('FlatList', props, props.data.map(item =>
      React.createElement(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item })))) };
  const prompt = { invalidate: () => {}, offer: () => {} }; // stable, like the real hook
  const expoRouter = { useFocusEffect: cb => React.useEffect(() => cb(), [cb]) };
  const mutation = load('hooks/useItemMutation.ts', { 'expo-router': expoRouter });
  const selector = load('components/StatusSelector.tsx', { 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { SafeAreaInsetsContext: React.createContext(null) },
    '@/lib/theme': theme, '@/lib/i18n': i18n, '@/lib/status-menu': statusMenu });
  const row = load('components/PantryItem.tsx', { 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/lib/theme': theme, './StatusBadge': { StatusBadge: 'Badge' }, '@/lib/i18n': i18n });
  const field = load('components/SearchField.tsx', { 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/lib/theme': theme, '@/lib/i18n': i18n });
  const { default: Screen } = load('app/(tabs)/index.tsx', {
    'react-native': native, 'expo-router': expoRouter, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/lib/theme': theme, '@/lib/i18n': i18n,
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/Button': { Button: 'Button' },
    '@/components/PantryItem': row, '@/components/StatusSelector': selector, '@/components/SearchField': field,
    '@/hooks/useItemMutation': mutation,
    '@/hooks/useKeyboardOverlap': load('hooks/useKeyboardOverlap.ts', { 'react-native': native }),
    '@/hooks/useShoppingPrompt': { useShoppingPrompt: () => prompt, notice: () => {} },
    '@/hooks/useSingleOpen': { useSingleOpen: () => { const go = p => log.nav.push(p); go.isLocked = () => false; return go; } },
    '@/hooks/useErrorAnnouncement': { useFocusedErrorAnnouncement: () => {} },
    '@/lib/accessibility': { announce: m => log.announced.push(m) },
    '@/lib/pantry-data': pantryData, '@/lib/pantry-shopping': pantryShopping, '@/lib/status-menu': statusMenu,
    '@/lib/pantry-search': pantrySearch,
    '@/hooks/usePantryItems': { usePantryItems: () => {
      const [, bump] = React.useState(0);
      store.force = () => bump(n => n + 1);
      return { householdId: store.household, items: store.items, loading: false, error: null, retry: () => {},
        setItemStatus: (...a) => { log.writes.push(a); return Promise.reject(new Error('no writes expected')); },
        addItem: (...a) => log.writes.push(a), updateItem: (...a) => log.writes.push(a), deleteItem: (...a) => log.writes.push(a),
        isUnconfirmed: () => false };
    } },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen), { createNodeMock: () => NODE }); });
  const by = id => renderer.root.findByProps({ testID: id });
  const has = id => renderer.root.findAllByProps({ testID: id }).length > 0;
  const ids = () => renderer.root.findAll(n => n.type === 'Pressable' && /^pantry-item-\d+$/.test(String(n.props.testID)))
    .map(n => n.props.testID.slice('pantry-item-'.length));
  const type = text => act(() => by('pantry-search').props.onChangeText(text));
  const set = fn => act(() => { fn(); store.force(); });
  return { renderer, log, store, by, has, ids, type, set, unmount: () => act(() => renderer.unmount()) };
}
const base = () => [mk('1', 'Milk'), mk('2', 'Oat milk'), mk('3', 'Eggs')];

test('typing filters rows by name and clearing restores the full list', () => {
  const h = render(base());
  try {
    assert.deepEqual(h.ids(), ['1', '2', '3']);
    assert.equal(h.has('pantry-search-clear'), false);
    h.type('MILK');
    assert.deepEqual(h.ids(), ['1', '2']);
    act(() => h.by('pantry-search-clear').props.onPress());
    assert.deepEqual(h.ids(), ['1', '2', '3']);
    assert.equal(h.by('pantry-search').props.value, '');
    assert.equal(h.has('pantry-search-clear'), false);
  } finally { h.unmount(); }
});

test('the field is a labelled search input that keeps taps and dismisses on drag', () => {
  const h = render(base());
  try {
    const input = h.by('pantry-search');
    assert.equal(input.props.accessibilityRole, 'search');
    assert.equal(input.props.accessibilityLabel, 'pantry_search_label');
    assert.equal(input.props.placeholder, 'pantry_search_placeholder');
    assert.equal(input.props.returnKeyType, 'search');
    const list = h.renderer.root.findByType('FlatList');
    assert.equal(list.props.keyboardShouldPersistTaps, 'handled');
    assert.equal(list.props.keyboardDismissMode, 'on-drag');
    h.type('a');
    assert.equal(h.by('pantry-search-clear').props.accessibilityLabel, 'pantry_search_clear');
  } finally { h.unmount(); }
});

test('a whitespace-only query shows the full list', () => {
  const h = render(base());
  try {
    h.type('   ');
    assert.deepEqual(h.ids(), ['1', '2', '3']);
    assert.equal(h.has('pantry-search-no-match'), false);
  } finally { h.unmount(); }
});

test('no match shows its own state with the query and a clear action, and no EmptyState', () => {
  const h = render(base());
  try {
    h.type('  zzz ');
    assert.equal(h.has('pantry-search-no-match'), true);
    assert.equal(h.renderer.root.findAllByType('EmptyState').length, 0);
    assert.equal(h.renderer.root.findAllByType('FlatList').length, 0);
    const texts = h.by('pantry-search-no-match').findAllByType('Text').map(n => n.props.children);
    assert.deepEqual(texts, ['pantry_search_no_match_title', '"zzz"']);
    const clear = h.by('pantry-search-no-match-clear');
    assert.equal(clear.props.label, 'pantry_search_clear');
    act(() => clear.props.onPress());
    assert.equal(h.has('pantry-search-no-match'), false);
    assert.deepEqual(h.ids(), ['1', '2', '3']);
  } finally { h.unmount(); }
});

test('an empty pantry shows EmptyState and no search field', () => {
  const h = render([]);
  try {
    assert.equal(h.renderer.root.findAllByType('EmptyState').length, 1);
    assert.equal(h.has('pantry-search'), false);
  } finally { h.unmount(); }
});

test('results follow add, rename, delete and status change while a query is active', () => {
  const h = render(base());
  try {
    h.type('milk');
    assert.deepEqual(h.ids(), ['1', '2']);
    h.set(() => { h.store.items = [...h.store.items, mk('4', 'Almond milk')]; });
    assert.deepEqual(h.ids(), ['1', '2', '4']);
    h.set(() => { h.store.items = h.store.items.map(i => (i.id === '3' ? { ...i, name: 'Milk powder' } : i)); });
    assert.deepEqual(h.ids(), ['1', '2', '3', '4']);
    h.set(() => { h.store.items = h.store.items.filter(i => i.id !== '2'); });
    assert.deepEqual(h.ids(), ['1', '3', '4']);
    h.set(() => { h.store.items = h.store.items.map(i => (i.id === '1' ? { ...i, status: 'out' } : i)); });
    assert.deepEqual(h.ids(), ['1', '3', '4']);
    assert.equal(h.by('pantry-item-status-1').props.accessibilityLabel, 'Milk, status_out');
    h.set(() => { h.store.items = h.store.items.map(i => (i.id === '1' ? { ...i, name: 'Bread' } : i)); });
    assert.deepEqual(h.ids(), ['3', '4']);
  } finally { h.unmount(); }
});

test('a household change clears the query', () => {
  const h = render(base());
  try {
    h.type('milk');
    h.set(() => { h.store.household = 'other'; });
    assert.equal(h.by('pantry-search').props.value, '');
    assert.deepEqual(h.ids(), ['1', '2', '3']);
  } finally { h.unmount(); }
});

test('the selector closes when its item leaves the results', () => {
  const h = render(base());
  try {
    act(() => h.by('pantry-item-status-1').props.onPress());
    assert.equal(h.has('status-modal'), true);
    h.type('egg');
    assert.equal(h.has('status-modal'), false);
    assert.equal(h.log.writes.length, 0);
  } finally { h.unmount(); }
});

test('the result count is announced once after typing pauses', ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const h = render(base());
  try {
    h.type('m');
    ctx.mock.timers.tick(500);
    h.type('mi');
    ctx.mock.timers.tick(500);
    assert.deepEqual(h.log.announced, []);
    ctx.mock.timers.tick(100);
    assert.deepEqual(h.log.announced, ['2 pantry_search_results_many']);
    ctx.mock.timers.tick(5000);
    assert.equal(h.log.announced.length, 1);
    h.type('egg');
    ctx.mock.timers.tick(600);
    assert.equal(h.log.announced.at(-1), 'pantry_search_results_one');
    h.type('zzz');
    ctx.mock.timers.tick(600);
    assert.equal(h.log.announced.at(-1), 'pantry_search_no_match_title');
    const n = h.log.announced.length;
    h.type('');
    ctx.mock.timers.tick(2000);
    assert.equal(h.log.announced.length, n, 'an empty query announces nothing');
  } finally { h.unmount(); }
});

test('search never calls a write', () => {
  const h = render(base());
  try {
    h.type('milk');
    h.type('zzz');
    act(() => h.by('pantry-search-no-match-clear').props.onPress());
    h.type('egg');
    act(() => h.by('pantry-search-clear').props.onPress());
    assert.deepEqual(h.log.writes, []);
  } finally { h.unmount(); }
});

test('the keyboard is dismissed when a row, a status control or the add button is pressed', () => {
  const h = render(base());
  try {
    act(() => h.by('pantry-item-1').props.onPress());
    assert.equal(h.log.dismissed, 1);
    assert.deepEqual(h.log.nav, ['/edit-item/1']);
    act(() => h.by('pantry-item-status-1').props.onPress());
    assert.equal(h.log.dismissed, 2);
    assert.equal(h.has('status-modal'), true);
    act(() => h.by('pantry-fab-add').props.onPress());
    assert.equal(h.log.dismissed, 3);
    assert.equal(h.log.nav.at(-1), '/add-item');
  } finally { h.unmount(); }
});

test('an emptied pantry drops the stale query so a later add shows the full list', () => {
  const h = render(base());
  try {
    h.type('milk');
    assert.deepEqual(h.ids(), ['1', '2']);
    h.set(() => { h.store.items = []; });
    assert.equal(h.renderer.root.findAllByType('EmptyState').length, 1);
    h.set(() => { h.store.items = [mk('9', 'Bread'), mk('10', 'Tea')]; });
    assert.deepEqual(h.ids(), ['9', '10']);
    assert.equal(h.has('pantry-search-no-match'), false);
    assert.equal(h.by('pantry-search').props.value, '');
  } finally { h.unmount(); }
});

const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const fabBottom = h => flat(h.by('pantry-fab-add').props.style({ pressed: false })).bottom;
const listPad = h => flat(h.renderer.root.findByType('FlatList').props.contentContainerStyle).paddingBottom;

test('the add button and list clear the keyboard and return when it hides (KAN-92)', () => {
  const h = render(base());
  try {
    const normalFab = fabBottom(h);
    const normalPad = listPad(h);
    assert.equal(normalFab, theme.spacing.xl);
    // The screen is stubbed at window y 20..60; a keyboard top at 10 overlaps it by 50.
    act(() => h.log.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 10 } }));
    assert.equal(fabBottom(h), theme.spacing.xl + 50);
    assert.equal(listPad(h), normalPad + 50);
    act(() => h.log.emit('keyboardDidHide', {}));
    assert.equal(fabBottom(h), normalFab);
    assert.equal(listPad(h), normalPad);
  } finally { h.unmount(); }
});

test('a keyboard below the screen bottom (tab bar area only) does not lift anything', () => {
  const h = render(base());
  try {
    act(() => h.log.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 500 } }));
    assert.equal(fabBottom(h), theme.spacing.xl);
  } finally { h.unmount(); }
});

test('keyboard listeners are removed on unmount', () => {
  const h = render(base());
  assert.equal(h.log.listeners.length, 2);
  h.unmount();
  assert.equal(h.log.listeners.length, 0);
  assert.equal(h.log.removed, 2);
});
