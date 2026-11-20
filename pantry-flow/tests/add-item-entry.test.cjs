const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

// KAN-94 (UX-04): Return on the name field saves and keeps Add Item open for the next item.
const theme = load('lib/theme.ts');
const constants = load('lib/constants.ts');
const pagination = load('lib/pagination.ts');
const pantryData = load('lib/pantry-data.ts', { './constants': constants, './pagination': pagination });
const { en } = load('lib/i18n/en.ts');
const native = { Text: 'Text', View: 'View', Platform: { OS: 'ios' }, ScrollView: 'ScrollView',
  KeyboardAvoidingView: 'KeyboardAvoidingView', StyleSheet: { create: s => s } };
const mutation = load('hooks/useItemMutation.ts', { 'expo-router': { useFocusEffect: () => {} } });
const inlineError = load('components/InlineError.tsx', { 'react-native': { Text: 'Text', View: 'View' } });

function setup({ addItem } = {}) {
  const state = { added: [], back: 0, announced: [], focused: 0 };
  const saved = [];
  const defaultAdd = async input => {
    if (saved.some(n => n.toLowerCase() === input.name.toLowerCase())) throw { code: '23505' };
    saved.push(input.name);
    state.added.push(input);
    return { id: String(saved.length), ...input };
  };
  const add = addItem ? input => { state.added.push(input); return addItem(input, saved); } : defaultAdd;
  const { default: Screen } = load('app/add-item.tsx', {
    'react-native': native, '@/lib/theme': theme, '@/lib/constants': constants, '@/lib/pantry-data': pantryData,
    '@/lib/i18n': { useTranslation: () => ({ t: key => en[key] ?? key }) },
    '@/lib/accessibility': { announce: m => state.announced.push(m) },
    'expo-router': { useRouter: () => ({ back: () => { state.back++; } }) },
    '@/components/Button': { Button: 'Button' }, '@/components/Input': { Input: 'Input' },
    '@/components/OptionChips': { OptionChips: 'OptionChips' }, '@/components/InlineError': inlineError,
    '@/components/AuthGate': { AuthGate: ({ children }) => children },
    '@/components/FormFooter': { FormFooter: 'FormFooter' }, '@/hooks/useKeyboardOverlap': { useKeyboardOverlap: () => 0 },
    '@/hooks/useItemMutation': mutation, '@/hooks/useFormError': load('hooks/useFormError.ts'),
    '@/hooks/usePantryItems': { usePantryItems: () => ({ householdId: 'h', loading: false, error: null, retry: () => {}, addItem: add }) },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(Screen), { createNodeMock: () => ({ focus: () => { state.focused++; } }) }); });
  const input = () => renderer.root.findByProps({ testID: 'add-item-name' });
  const button = id => renderer.root.findByProps({ testID: id });
  const chips = prefix => renderer.root.findAll(n => n.type === 'OptionChips' && n.props.testIDPrefix === prefix)[0];
  const type = text => act(() => input().props.onChangeText(text));
  const submit = () => input().props.onSubmitEditing();
  const savedText = () => {
    const nodes = renderer.root.findAll(n => n.props.testID === 'add-item-saved' && typeof n.type === 'string');
    return nodes.length ? nodes[0].findAllByType('Text').flatMap(x => x.children).join('') || nodes[0].children.join('') : '';
  };
  const choose = (kind, value) => act(() => chips(`add-item-${kind}`).props.onChange(value));
  return { state, renderer, input, button, chips, type, submit, savedText, choose,
    cleanup: () => { try { act(() => renderer.unmount()); } catch { /* already unmounted */ } } };
}

test('Return with a valid name adds once, clears the name, keeps category and location, stays open and shows the confirmation', async () => {
  const h = setup();
  try {
    h.choose('category', 'dairy'); h.choose('location', 'fridge');
    h.type('Milk');
    await act(async () => { h.submit(); });
    assert.deepEqual(h.state.added, [{ name: 'Milk', category: 'dairy', location: 'fridge' }]);
    assert.equal(h.input().props.value, '');
    assert.equal(h.chips('add-item-category').props.value, 'dairy');
    assert.equal(h.chips('add-item-location').props.value, 'fridge');
    assert.equal(h.state.back, 0);
    assert.match(h.savedText(), /Added:/);
    assert.match(h.savedText(), /Milk/);
    assert.equal(h.input().props.returnKeyType, 'next');
    assert.equal(h.input().props.submitBehavior, 'submit');
    assert.deepEqual(h.state.announced, [`Milk, ${en.item_added_announcement}`]);
    assert.ok(h.state.focused >= 1, 'name input re-focused');
  } finally { h.cleanup(); }
});

test('Return with an empty or overlong name shows the existing error and adds nothing', async () => {
  const h = setup();
  try {
    await act(async () => { h.submit(); });
    assert.equal(h.input().props.error, en.err_required_name);
    h.type('x'.repeat(pantryData.ITEM_NAME_MAX + 1));
    await act(async () => { h.submit(); });
    assert.equal(h.input().props.error, en.err_item_name_length);
    assert.deepEqual(h.state.added, []);
    assert.equal(h.state.back, 0);
  } finally { h.cleanup(); }
});

test('a duplicate (including one saved earlier in this visit) shows the duplicate error and keeps the name', async () => {
  const h = setup();
  try {
    h.type('Milk');
    await act(async () => { h.submit(); });
    h.type('milk');
    await act(async () => { h.submit(); });
    assert.equal(h.input().props.error, en.err_duplicate_item);
    assert.equal(h.input().props.value, 'milk');
    assert.equal(h.savedText(), '', 'the confirmation is replaced by the error');
    assert.equal(h.state.back, 0);
  } finally { h.cleanup(); }
});

test('a failed save keeps name, category and location', async () => {
  const h = setup({ addItem: async () => { throw new Error('offline'); } });
  try {
    h.choose('category', 'dairy'); h.choose('location', 'fridge');
    h.type('Milk');
    await act(async () => { h.submit(); });
    assert.equal(h.input().props.error, en.err_save_item);
    assert.equal(h.input().props.value, 'Milk');
    assert.equal(h.chips('add-item-category').props.value, 'dairy');
    assert.equal(h.chips('add-item-location').props.value, 'fridge');
    assert.equal(h.state.back, 0);
    assert.deepEqual(h.state.announced, []);
  } finally { h.cleanup(); }
});

test('Return then the Add Item button while busy creates one item', async () => {
  const pending = deferred();
  const h = setup({ addItem: () => pending.promise });
  try {
    h.type('Milk');
    act(() => { h.submit(); });
    await act(async () => { await h.button('add-item-save').props.onPress(); });
    assert.equal(h.state.added.length, 1);
    await act(async () => { pending.resolve({}); });
    assert.equal(h.state.added.length, 1);
    assert.equal(h.state.back, 0);
  } finally { h.cleanup(); }
});

test('repeated Return while busy creates one item', async () => {
  const pending = deferred();
  const h = setup({ addItem: () => pending.promise });
  try {
    h.type('Milk');
    act(() => { h.submit(); h.submit(); });
    act(() => { h.submit(); });
    await act(async () => { pending.resolve({}); });
    assert.equal(h.state.added.length, 1);
    assert.equal(h.state.announced.length, 1);
  } finally { h.cleanup(); }
});

test('the Add Item button still saves and closes', async () => {
  const h = setup();
  try {
    h.type('Milk');
    await act(async () => { await h.button('add-item-save').props.onPress(); });
    assert.equal(h.state.added.length, 1);
    assert.equal(h.state.back, 1);
    assert.deepEqual(h.state.announced, []);
  } finally { h.cleanup(); }
});

test('Cancel reads Done after a Return save and closes without adding', async () => {
  const h = setup();
  try {
    assert.equal(h.button('add-item-cancel').props.label, en.common_cancel);
    h.type('Milk');
    await act(async () => { h.submit(); });
    assert.equal(h.button('add-item-cancel').props.label, en.common_done);
    assert.equal(en.common_done, 'Done');
    act(() => h.button('add-item-cancel').props.onPress());
    assert.equal(h.state.back, 1);
    assert.equal(h.state.added.length, 1);
  } finally { h.cleanup(); }
});

test('a save resolving after close does not navigate or update state', async () => {
  const pending = deferred();
  const h = setup({ addItem: () => pending.promise });
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    h.type('Milk');
    act(() => { h.submit(); });
    act(() => h.renderer.unmount());
    await act(async () => { pending.resolve({}); });
    assert.equal(h.state.back, 0);
    assert.deepEqual(h.state.announced, []);
    assert.equal(h.state.added.length, 1);
    assert.deepEqual(errors, []);
  } finally { console.error = original; h.cleanup(); }
});

test('text typed while a Return save is pending is not cleared when that save succeeds', async () => {
  const pending = deferred();
  const h = setup({ addItem: () => pending.promise });
  try {
    h.type('Milk');
    act(() => { h.submit(); });
    assert.notEqual(h.input().props.editable, false);
    h.type('Eggs');
    await act(async () => { pending.resolve({}); });
    assert.equal(h.input().props.value, 'Eggs');
    assert.match(h.savedText(), /Milk/);
  } finally { h.cleanup(); }
});

test('a Return save is announced once: the confirmation is not also a live region', async () => {
  const h = setup();
  try {
    h.type('Milk');
    await act(async () => { h.submit(); });
    const node = h.renderer.root.findAll(n => n.props.testID === 'add-item-saved' && typeof n.type === 'string')[0];
    assert.equal(node.props.accessibilityLiveRegion, undefined);
    assert.match(h.savedText(), /Milk/);
    assert.deepEqual(h.state.announced, ['Milk, added']);
  } finally { h.cleanup(); }
});
