const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

const theme = load('lib/theme.ts');
const constants = load('lib/constants.ts');
const pagination = load('lib/pagination.ts');
const pantryData = load('lib/pantry-data.ts', { './write-outcome': load('lib/write-outcome.ts'), './constants': constants, './pagination': pagination });
const shoppingData = load('lib/shopping-data.ts', { './write-outcome': load('lib/write-outcome.ts'), './pagination': pagination });
const pantryShopping = load('lib/pantry-shopping.ts');
const statusMenu = load('lib/status-menu.ts');
const t = key => key;
const NODE = { measureInWindow: cb => cb(10, 20, 30, 40) };
const mk = (id, name, status) => ({ id, household_id: 'h', name, category: 'dairy', location: 'fridge', status });

function render({ items: initial = [mk('1', 'Milk', 'in_stock')], addItem } = {}) {
  const log = { alerts: [], writes: [], adds: [], announced: [], nav: [], onAlert: null };
  const store = { items: initial, unconfirmed: new Set(), household: 'h', force: () => {}, impl: null };
  const cleanups = [];
  const set = fn => act(() => { fn(); store.force(); });
  store.commit = (id, status) => { store.items = store.items.map(i => (i.id === id ? { ...i, status } : i)); store.force(); };

  const native = { Keyboard: { dismiss: () => {} }, Text: 'Text', View: 'View', ActivityIndicator: 'Spinner', Pressable: 'Pressable', Modal: 'Modal',
    Platform: { OS: 'android' }, StyleSheet: { create: s => s, absoluteFill: {} },
    useWindowDimensions: () => ({ width: 400, height: 800 }),
    AccessibilityInfo: { setAccessibilityFocus: () => {} }, findNodeHandle: () => null,
    Alert: { alert: (...args) => { log.alerts.push(args); log.onAlert?.(); } },
    FlatList: ({ data, renderItem, keyExtractor, extraData }) => {
      // Like the real list: rows re-render only when data or extraData change.
      const last = React.useRef(null);
      const same = last.current && last.current.data === data && last.current.extra.length === extraData.length
        && last.current.extra.every((v, i) => v === extraData[i]);
      if (!same) {
        last.current = { data, extra: extraData,
          out: React.createElement('FlatList', null, data.map(item => React.createElement(React.Fragment, { key: keyExtractor(item) }, renderItem({ item })))) };
      }
      return last.current.out;
    } };
  const expoRouter = { useFocusEffect: cb => React.useEffect(() => { const c = cb(); cleanups.push(c); return c; }, [cb]) };
  const mutation = load('hooks/useItemMutation.ts', { 'expo-router': expoRouter });
  const shoppingStub = { useShoppingItems: () => ({ loading: false, items: [],
    addItem: async input => { log.adds.push(input); return (addItem ?? (async () => ({})))(input); } }) };
  const prompt = load('hooks/useShoppingPrompt.ts', { 'react-native': native, '@/hooks/useShoppingItems': shoppingStub,
    '@/lib/shopping-data': shoppingData, '@/lib/pantry-shopping': pantryShopping, '@/lib/i18n': { useTranslation: () => ({ t }) },
    '@/hooks/household-scope': { useHouseholdScope: () => ({ householdId: store.household }) } });
  const selector = load('components/StatusSelector.tsx', { 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { SafeAreaInsetsContext: React.createContext(null) },
    '@/lib/theme': theme, '@/lib/i18n': { useTranslation: () => ({ t }) }, '@/lib/status-menu': statusMenu });
  const row = load('components/PantryItem.tsx', { 'react-native': native, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/lib/theme': theme, './StatusBadge': { StatusBadge: 'Badge' }, '@/lib/i18n': { useTranslation: () => ({ t }) } });
  const { default: Screen } = load('app/(tabs)/index.tsx', {
    'react-native': native, 'expo-router': expoRouter, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/lib/theme': theme, '@/lib/i18n': { useTranslation: () => ({ t }) },
    '@/components/EmptyState': { EmptyState: 'EmptyState' }, '@/components/Button': { Button: 'Button' },
    '@/components/PantryItem': row, '@/components/StatusSelector': selector,
    '@/hooks/useItemMutation': mutation, '@/hooks/useShoppingPrompt': prompt,
    '@/hooks/useKeyboardOverlap': { useKeyboardOverlap: () => 0 },
    '@/hooks/useSingleOpen': { useSingleOpen: () => {
      const go = path => { log.nav.push(path); log.navLocked = true; };
      go.isLocked = () => Boolean(log.navLocked);
      return go;
    } },
    '@/hooks/useErrorAnnouncement': { useFocusedErrorAnnouncement: () => {} },
    '@/lib/accessibility': { announce: m => log.announced.push(m) },
    '@/lib/pantry-data': pantryData, '@/lib/pantry-shopping': pantryShopping,
    '@/lib/status-menu': statusMenu,
    '@/components/SearchField': { SearchField: 'SearchField' }, '@/lib/pantry-search': { filterItemsByName: items => items },
    '@/hooks/usePantryItems': { usePantryItems: () => {
      const [, bump] = React.useState(0);
      store.force = () => bump(n => n + 1);
      return { items: store.items, loading: false, error: null, retry: () => {},
        setItemStatus: (id, next) => { log.writes.push([id, next]); return store.impl(id, next); },
        isUnconfirmed: id => store.unconfirmed.has(id) };
    } },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen), { createNodeMock: () => NODE }); });
  const by = id => renderer.root.findByProps({ testID: id });
  const has = id => renderer.root.findAllByProps({ testID: id }).length > 0;
  const label = id => by(`pantry-item-status-${id}`).props.accessibilityLabel;
  const open = id => act(() => by(`pantry-item-status-${id}`).props.onPress());
  const choose = status => act(() => by(`status-option-${status}`).props.onPress());
  const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
  const press = text => log.alerts.at(-1)[2].find(b => b.text === text).onPress();
  const titles = () => log.alerts.map(a => a[0]);
  return { renderer, log, store, set, by, has, label, open, choose, flush, press, titles,
    blur: () => act(() => { cleanups.forEach(c => c?.()); }), unmount: () => act(() => renderer.unmount()) };
}
const changed = (id, name, from, to) => async () => ({ kind: 'changed', item: mk(id, name, to), previous: from });
async function change(h, id, status) { h.open(id); h.choose(status); await h.flush(); }

test('changing to the same status closes the selector without any call', async () => {
  const h = render({ items: [mk('1', 'Milk', 'low')] });
  h.store.impl = changed('1', 'Milk', 'low', 'low');
  try {
    h.open('1');
    assert.equal(h.has('status-modal'), true);
    h.choose('low');
    await h.flush();
    assert.equal(h.has('status-modal'), false);
    assert.equal(h.log.writes.length, 0);
    assert.equal(h.log.alerts.length, 0);
  } finally { h.unmount(); }
});

test('in stock to low, in stock to out, low to out and out to low prompt; changes to in stock do not', async () => {
  const cases = [['in_stock', 'low', true], ['in_stock', 'out', true], ['low', 'out', true], ['out', 'low', true],
    ['low', 'in_stock', false], ['out', 'in_stock', false]];
  for (const [from, to, prompts] of cases) {
    const h = render({ items: [mk('1', 'Milk', from)] });
    h.store.impl = async (id, next) => { h.store.commit(id, next); return { kind: 'changed', item: mk('1', 'Milk', next), previous: from }; };
    try {
      await change(h, '1', to);
      assert.deepEqual(h.titles(), prompts ? ['shopping_prompt_title'] : [], `${from} to ${to}`);
    } finally { h.unmount(); }
  }
});

test('an already result never prompts and announces the database status', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock')] });
  h.store.impl = async () => ({ kind: 'already', item: mk('1', 'Milk', 'low') });
  try {
    await change(h, '1', 'low');
    assert.equal(h.log.alerts.length, 0);
    assert.deepEqual(h.log.announced, ['Milk, status_low']);
  } finally { h.unmount(); }
});

test('the prompt uses the returned name and id', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock')] });
  h.store.impl = changed('1', 'Oat milk', 'in_stock', 'low');
  try {
    await change(h, '1', 'low');
    assert.equal(h.log.alerts[0][1], 'Oat milk');
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    assert.deepEqual(h.log.adds, [{ name: 'Oat milk', pantryItemId: '1' }]);
  } finally { h.unmount(); }
});

test('the badge keeps the old status while saving and after a failure', async () => {
  const h = render();
  const write = deferred();
  h.store.impl = () => write.promise;
  try {
    h.open('1'); h.choose('low'); await h.flush();
    assert.equal(h.label('1'), 'Milk, status_in_stock');
    write.reject({ code: 'x' });
    await h.flush();
    assert.equal(h.label('1'), 'Milk, status_in_stock');
  } finally { h.unmount(); }
});

test('a failed status write shows Status not changed with the mapped reason', async () => {
  for (const [error, message] of [[{ code: 'x' }, 'err_save_item'], [{ code: 'PF_PANTRY_MISSING' }, 'err_item_missing']]) {
    const h = render();
    h.store.impl = async () => { throw error; };
    try {
      await change(h, '1', 'low');
      assert.deepEqual(h.log.alerts.map(a => [a[0], a[1]]), [['status_not_changed_title', message]]);
    } finally { h.unmount(); }
  }
});

test('a failed shopping add after a successful change shows the shopping notice and keeps the new status', async () => {
  const h = render({ addItem: async () => { throw { code: '23505' }; } });
  h.store.impl = async (id, next) => { h.store.commit(id, next); return { kind: 'changed', item: mk('1', 'Milk', next), previous: 'in_stock' }; };
  try {
    await change(h, '1', 'low');
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    assert.deepEqual(h.titles(), ['shopping_prompt_title', 'shopping_prompt_failed_title']);
    assert.equal(h.label('1'), 'Milk, status_low');
  } finally { h.unmount(); }
});

test('a double tap on an option or a second status control writes once', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock'), mk('2', 'Eggs', 'in_stock')] });
  const write = deferred();
  h.store.impl = () => write.promise;
  try {
    h.open('1');
    const tap = h.by('status-option-low').props.onPress;
    act(() => { tap(); tap(); });
    await h.flush();
    assert.deepEqual(h.log.writes, [['1', 'low']]);
    h.open('2');
    assert.equal(h.has('status-modal'), false, 'no selector while the write is in flight');
    assert.equal(h.log.writes.length, 1);
    write.reject({ code: 'x' });
    await h.flush();
  } finally { h.unmount(); }
});

test('other status controls are disabled only while the write is in flight', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock'), mk('2', 'Eggs', 'in_stock')] });
  const write = deferred();
  h.store.impl = () => write.promise;
  const disabled = id => Boolean(h.by(`pantry-item-status-${id}`).props.disabled);
  try {
    assert.deepEqual([disabled('1'), disabled('2')], [false, false]);
    h.open('1'); h.choose('low'); await h.flush();
    assert.deepEqual([disabled('1'), disabled('2')], [true, true]);
    write.reject({ code: 'x' });
    await h.flush();
    assert.deepEqual([disabled('1'), disabled('2')], [false, false]);
  } finally { h.unmount(); }
});

test('the changed item edit action is disabled while its write is in flight and re-enabled after success, failure and a missing record', async () => {
  const outcomes = [
    ['success', async () => ({ kind: 'changed', item: mk('1', 'Milk', 'in_stock'), previous: 'out' })],
    ['failure', async () => { throw { code: 'x' }; }],
    ['missing', async () => { throw { code: 'PF_PANTRY_MISSING' }; }]];
  for (const [name, outcome] of outcomes) {
    const h = render({ items: [mk('1', 'Milk', 'out'), mk('2', 'Eggs', 'in_stock')] });
    const gate = deferred();
    h.store.impl = async (...args) => { await gate.promise; return outcome(...args); };
    const edit = id => Boolean(h.by(`pantry-item-${id}`).props.disabled);
    try {
      h.open('1'); h.choose('in_stock'); await h.flush();
      assert.deepEqual([edit('1'), edit('2')], [true, false], `${name} in flight`);
      gate.resolve();
      await h.flush();
      assert.deepEqual([edit('1'), edit('2')], [false, false], `${name} settled`);
    } finally { h.unmount(); }
  }
});

test('a lost prompt leaves the status controls usable', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock'), mk('2', 'Eggs', 'in_stock')] });
  h.store.impl = async (id, next) => ({ kind: 'changed', item: mk(id, id === '1' ? 'Milk' : 'Eggs', next), previous: 'in_stock' });
  try {
    await change(h, '1', 'low');
    assert.equal(h.log.alerts.length, 1, 'prompt never answered');
    assert.equal(h.by('pantry-item-status-2').props.disabled, false);
    await change(h, '2', 'out');
    assert.deepEqual(h.log.writes, [['1', 'low'], ['2', 'out']]);
  } finally { h.unmount(); }
});

test('a newer change invalidates an unanswered prompt', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock'), mk('2', 'Eggs', 'in_stock')] });
  h.store.impl = async (id, next) => ({ kind: 'changed', item: mk(id, id === '1' ? 'Milk' : 'Eggs', next), previous: 'in_stock' });
  try {
    await change(h, '1', 'low');
    const firstAdd = h.log.alerts[0][2].find(b => b.text === 'shopping_prompt_add');
    await change(h, '2', 'out');
    await act(async () => { firstAdd.onPress(); await h.flush(); });
    assert.deepEqual(h.log.adds, []);
  } finally { h.unmount(); }
});

test('the selector closes on blur and a later choice writes nothing', async () => {
  const h = render();
  h.store.impl = changed('1', 'Milk', 'in_stock', 'low');
  try {
    h.open('1');
    const stale = h.by('status-option-low').props.onPress;
    h.blur();
    assert.equal(h.has('status-modal'), false);
    act(() => { stale(); });
    await h.flush();
    assert.equal(h.log.writes.length, 0);
    assert.equal(h.log.alerts.length, 0);
    h.open('1');
    assert.equal(h.has('status-modal'), false, 'no selector opens while unfocused');
  } finally { h.unmount(); }
});

test('the status control is ignored while a navigation is pending', () => {
  for (const start of [
    h => act(() => h.by('pantry-item-1').props.onPress()),
    h => act(() => h.by('pantry-fab-add').props.onPress())]) {
    const h = render();
    try {
      start(h);
      assert.equal(h.log.nav.length, 1);
      h.open('1');
      assert.equal(h.has('status-modal'), false);
    } finally { h.unmount(); }
  }
});

test('a newer non-prompting change invalidates an unanswered prompt', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock'), mk('2', 'Eggs', 'low')] });
  h.store.impl = async (id, next) => ({ kind: 'changed', item: mk(id, id === '1' ? 'Milk' : 'Eggs', next),
    previous: id === '1' ? 'in_stock' : 'low' });
  try {
    await change(h, '1', 'low');
    const firstAdd = h.log.alerts[0][2].find(b => b.text === 'shopping_prompt_add');
    await change(h, '2', 'in_stock');
    assert.equal(h.log.alerts.length, 1, 'the second change does not prompt');
    await act(async () => { firstAdd.onPress(); await h.flush(); });
    assert.deepEqual(h.log.adds, []);
  } finally { h.unmount(); }
});

test('a completion after the list lost focus shows no prompt and no notice', async () => {
  for (const write of [
    () => Promise.resolve({ kind: 'changed', item: mk('1', 'Milk', 'low'), previous: 'in_stock' }),
    () => Promise.reject({ code: 'x' })]) {
    const h = render();
    const gate = deferred();
    h.store.impl = async () => { await gate.promise; return write(); };
    try {
      h.open('1'); h.choose('low'); await h.flush();
      h.blur();
      gate.resolve();
      await h.flush();
      assert.equal(h.log.alerts.length, 0);
      assert.equal(h.log.announced.length, 0);
    } finally { h.unmount(); }
  }
});

test('the selector closes when its item leaves the list', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock'), mk('2', 'Eggs', 'in_stock')] });
  h.store.impl = changed('1', 'Milk', 'in_stock', 'low');
  try {
    h.open('1');
    assert.equal(h.has('status-modal'), true);
    h.set(() => { h.store.items = h.store.items.filter(i => i.id !== '1'); });
    assert.equal(h.has('status-modal'), false);
    assert.equal(h.log.writes.length, 0);
  } finally { h.unmount(); }
});

test('the result is announced only when no prompt follows', async () => {
  const h = render({ items: [mk('1', 'Milk', 'low'), mk('2', 'Eggs', 'in_stock')] });
  h.store.impl = async (id, next) => (id === '1'
    ? { kind: 'changed', item: mk('1', 'Milk', next), previous: 'low' }
    : { kind: 'already', item: mk('2', 'Eggs', 'out') });
  try {
    await change(h, '1', 'in_stock');
    assert.deepEqual(h.log.announced, ['Milk, status_in_stock']);
    await change(h, '2', 'out');
    assert.deepEqual(h.log.announced, ['Milk, status_in_stock', 'Eggs, status_out']);
    assert.equal(h.log.alerts.length, 0);
    h.store.impl = changed('1', 'Milk', 'low', 'out');
    await change(h, '1', 'out');
    assert.equal(h.log.alerts.length, 1);
    assert.equal(h.log.announced.length, 2, 'a prompt follows, so nothing is announced');
  } finally { h.unmount(); }
});

test('opening the selector passes the status control ref for focus return', () => {
  const h = render();
  try {
    h.open('1');
    const sel = h.renderer.root.findAll(n => n.props && n.props.returnFocusTo)[0];
    assert.equal(sel.props.returnFocusTo.current, NODE);
    assert.deepEqual(sel.props.anchor, { x: 10, y: 20, width: 30, height: 40 });
  } finally { h.unmount(); }
});

test('a prompt requested inside the locked operation blocks a second selection (lock gap)', async () => {
  const h = render({ items: [mk('1', 'Milk', 'in_stock')] });
  h.store.impl = changed('1', 'Milk', 'in_stock', 'low');
  try {
    h.open('1');
    const stale = h.by('status-option-out').props.onPress;
    h.log.onAlert = () => { stale(); };
    h.choose('low');
    await h.flush();
    assert.equal(h.log.alerts.length, 1);
    assert.deepEqual(h.log.writes, [['1', 'low']]);
  } finally { h.unmount(); }
});

test('an uncertain outcome shows Status change not confirmed, never prompts, and keeps edit disabled until confirmed', async () => {
  const h = render();
  h.store.impl = async () => {
    h.store.unconfirmed.add('1');
    throw { code: 'PF_PANTRY_STATUS_UNKNOWN' };
  };
  const edit = () => Boolean(h.by('pantry-item-1').props.disabled);
  try {
    await change(h, '1', 'low');
    assert.deepEqual(h.log.alerts.map(a => [a[0], a[1]]), [['status_unconfirmed_title', 'err_status_unconfirmed']]);
    assert.equal(edit(), true);
    assert.equal(h.label('1'), 'Milk, status_in_stock');
    h.set(() => { h.store.unconfirmed.delete('1'); });
    assert.equal(edit(), false);
  } finally { h.unmount(); }
});

test('a conflict shows the conflict message and the reconciled status', async () => {
  const h = render();
  h.store.impl = async () => { h.store.commit('1', 'out'); throw { code: 'PF_PANTRY_STATUS_CONFLICT' }; };
  try {
    await change(h, '1', 'low');
    assert.deepEqual(h.log.alerts.map(a => [a[0], a[1]]), [['status_not_changed_title', 'err_status_conflict']]);
    assert.equal(h.label('1'), 'Milk, status_out');
  } finally { h.unmount(); }
});

test('a household change while the prompt is open makes a later Add do nothing', async () => {
  const h = render();
  h.store.impl = changed('1', 'Milk', 'in_stock', 'low');
  try {
    await change(h, '1', 'low');
    assert.equal(h.log.alerts.length, 1);
    h.set(() => { h.store.household = 'other'; });
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    assert.deepEqual(h.log.adds, []);
  } finally { h.unmount(); }
});
