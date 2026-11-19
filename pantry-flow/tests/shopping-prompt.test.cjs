const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

const shoppingData = load('lib/shopping-data.ts', { './pagination': load('lib/pagination.ts') });
const pantryShopping = load('lib/pantry-shopping.ts');
const STATUSES = ['in_stock', 'low', 'out'];

function setup({ addItem } = {}) {
  const log = { alerts: [], adds: [], pantry: 0 };
  const scope = { householdId: 'h' };
  const { useShoppingPrompt } = load('hooks/useShoppingPrompt.ts', {
    'react-native': { Alert: { alert: (...args) => log.alerts.push(args) } },
    '@/hooks/useShoppingItems': { useShoppingItems: () => ({
      addItem: async input => { log.adds.push(input); return (addItem ?? (async () => ({})))(input); } }) },
    '@/hooks/household-scope': { useHouseholdScope: () => scope },
    // The hook must never reach pantry state: any use of this stub is recorded.
    '@/hooks/usePantryItems': { usePantryItems: () => { log.pantry++; return new Proxy({}, { get: () => () => { log.pantry++; } }); } },
    '@/lib/shopping-data': shoppingData, '@/lib/pantry-shopping': pantryShopping,
    '@/lib/i18n': { useTranslation: () => ({ t: key => key }) },
  });
  let api;
  const Host = () => { api = useShoppingPrompt(); return null; };
  let renderer;
  act(() => { renderer = create(React.createElement(Host)); });
  const press = text => log.alerts.at(-1)[2].find(b => b.text === text).onPress();
  const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
  const rerender = () => act(() => renderer.update(React.createElement(Host)));
  return { log, scope, press, flush, renderer, rerender, hook: () => api };
}
const item = (status, extra = {}) => ({ id: '1', household_id: 'h', name: 'Milk', category: 'dairy', location: 'fridge', status, ...extra });
const yes = () => true;
const offer = (h, args) => { let p; act(() => { p = h.hook().offer(args); }); return p; };

test('offers only for the four D3 transitions', async () => {
  const asked = [];
  for (const previous of STATUSES) for (const next of STATUSES) {
    const h = setup();
    try {
      const p = offer(h, { saved: item(next), previous, current: yes });
      await h.flush();
      if (h.log.alerts.length) { asked.push(`${previous}>${next}`); await act(async () => { h.press('shopping_prompt_skip'); }); }
      await p;
    } finally { act(() => h.renderer.unmount()); }
  }
  assert.deepEqual(asked.sort(), ['in_stock>low', 'in_stock>out', 'low>out', 'out>low']);
});

test('adds the saved name and id, not any caller value', async () => {
  const h = setup();
  try {
    const p = offer(h, { saved: item('low', { name: 'Whole milk', id: '9' }), previous: 'in_stock', current: yes,
      name: 'Form name', pantryItemId: 'wrong' });
    await h.flush();
    assert.equal(h.log.alerts[0][0], 'shopping_prompt_title');
    assert.equal(h.log.alerts[0][1], 'Whole milk');
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    await p;
    assert.deepEqual(h.log.adds, [{ name: 'Whole milk', pantryItemId: '9' }]);
  } finally { act(() => h.renderer.unmount()); }
});

test('a saved item from another household is never offered or added', async () => {
  const h = setup();
  try {
    await offer(h, { saved: item('low', { household_id: 'other' }), previous: 'in_stock', current: yes });
    assert.equal(h.log.alerts.length, 0);
    assert.equal(h.log.adds.length, 0);
    // The household changing while the prompt is open also cancels the add.
    const p = offer(h, { saved: item('low'), previous: 'in_stock', current: yes });
    await h.flush();
    assert.equal(h.log.alerts.length, 1);
    h.scope.householdId = 'other';
    h.rerender();
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    await p;
    assert.equal(h.log.adds.length, 0);
  } finally { act(() => h.renderer.unmount()); }
});

test('current() false before or after the answer prevents the prompt or the add', async () => {
  const h = setup();
  try {
    await offer(h, { saved: item('low'), previous: 'in_stock', current: () => false });
    assert.equal(h.log.alerts.length, 0);
    let live = true;
    const p = offer(h, { saved: item('low'), previous: 'in_stock', current: () => live });
    await h.flush();
    assert.equal(h.log.alerts.length, 1);
    live = false;
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    await p;
    assert.equal(h.log.adds.length, 0);
    assert.equal(h.log.alerts.length, 1);
  } finally { act(() => h.renderer.unmount()); }
});

test('invalidate() before the answer makes a later Add do nothing', async () => {
  const h = setup();
  try {
    const p = offer(h, { saved: item('out'), previous: 'in_stock', current: yes });
    await h.flush();
    act(() => h.hook().invalidate());
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    await p;
    assert.equal(h.log.adds.length, 0);
    assert.equal(h.hook().prompting, false);
  } finally { act(() => h.renderer.unmount()); }
});

test('a failed add shows the translated shopping notice; the hook never touches pantry state', async () => {
  const h = setup({ addItem: async () => { throw { code: '23505' }; } });
  try {
    const p = offer(h, { saved: item('low'), previous: 'in_stock', current: yes });
    await h.flush();
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    assert.equal(h.log.alerts.length, 2);
    assert.equal(h.log.alerts[1][0], 'shopping_prompt_failed_title');
    assert.equal(h.log.alerts[1][1], 'err_duplicate_shopping_item');
    await act(async () => { h.press('common_ok'); await h.flush(); });
    await p;
    assert.equal(h.log.pantry, 0);
    assert.deepEqual(Object.keys(h.hook()).sort(), ['invalidate', 'offer', 'prompting']);
  } finally { act(() => h.renderer.unmount()); }
});

test('prompting is true exactly while the dialog or its notice is unanswered', async () => {
  const h = setup({ addItem: async () => { throw { code: '23505' }; } });
  try {
    assert.equal(h.hook().prompting, false);
    const p = offer(h, { saved: item('low'), previous: 'in_stock', current: yes });
    await h.flush();
    assert.equal(h.hook().prompting, true);
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    assert.equal(h.log.alerts.length, 2);
    assert.equal(h.hook().prompting, true);
    await act(async () => { h.press('common_ok'); await h.flush(); });
    await p;
    assert.equal(h.hook().prompting, false);
  } finally { act(() => h.renderer.unmount()); }
});

test('an answer after unmount adds nothing and shows no notice', async () => {
  const h = setup({ addItem: async () => { throw { code: '23505' }; } });
  const p = offer(h, { saved: item('low'), previous: 'in_stock', current: yes });
  await h.flush();
  act(() => h.renderer.unmount());
  await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
  await p;
  assert.equal(h.log.adds.length, 0);
  assert.equal(h.log.alerts.length, 1);
});

test('a household change while the prompt is open makes a later Add do nothing', async () => {
  // Covers the case valid()'s own household comparison cannot: A -> B -> A before the answer.
  const h = setup();
  try {
    const p = offer(h, { saved: item('low'), previous: 'in_stock', current: yes });
    await h.flush();
    h.scope.householdId = 'other';
    h.rerender();
    h.scope.householdId = 'h';
    h.rerender();
    assert.equal(h.hook().prompting, false);
    await act(async () => { h.press('shopping_prompt_add'); await h.flush(); });
    await p;
    assert.equal(h.log.adds.length, 0);
  } finally { act(() => h.renderer.unmount()); }
});

test('a late answer to an obsolete offer does not clear a newer prompt', async () => {
  const h = setup();
  try {
    const first = offer(h, { saved: item('low'), previous: 'in_stock', current: yes });
    const pressA = h.log.alerts.at(-1)[2];
    const second = offer(h, { saved: item('out', { id: '2', name: 'Eggs' }), previous: 'in_stock', current: yes });
    const pressB = h.log.alerts.at(-1)[2];
    assert.equal(h.log.alerts.length, 2);
    await act(async () => { pressA.find(b => b.text === 'shopping_prompt_skip').onPress(); await h.flush(); });
    await first;
    assert.equal(h.hook().prompting, true);
    await act(async () => { pressB.find(b => b.text === 'shopping_prompt_skip').onPress(); await h.flush(); });
    await second;
    assert.equal(h.hook().prompting, false);
  } finally { act(() => h.renderer.unmount()); }
});

test('offer requests the native dialog synchronously', () => {
  const h = setup();
  try {
    let p;
    act(() => { p = h.hook().offer({ saved: item('low'), previous: 'in_stock', current: yes }); });
    assert.equal(h.log.alerts.length, 1);
    assert.ok(p instanceof Promise);
  } finally { act(() => h.renderer.unmount()); }
});
