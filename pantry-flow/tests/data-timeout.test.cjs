const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { createClient } = require('@supabase/supabase-js');
const { load } = require('./helpers.cjs');

// KAN-127, end to end below the screens: the real supabase-js client with the app's request
// timeouts, against a server that accepts every request and never answers, through the real
// list hooks and error mappings. Reads end with the screen's load error; writes end with the
// could-not-be-confirmed message and a re-read, never with a failure message.
const { withRequestTimeouts } = load('lib/auth-timeout.ts');
const writeOutcome = load('lib/write-outcome.ts');
const pagination = load('lib/pagination.ts');
const pantryData = load('lib/pantry-data.ts', { './write-outcome': writeOutcome, './constants': load('lib/constants.ts'), './pagination': pagination });
const shoppingData = load('lib/shopping-data.ts', { './write-outcome': writeOutcome, './pagination': pagination });

const DATA_MS = 50;
// `answerReads`: how many list reads get an (empty) answer before the server stops answering.
function hangingServer(answerReads = 0) {
  const seen = [];
  let answered = 0;
  const fetch = (input, init = {}) => {
    const method = init.method ?? 'GET';
    seen.push({ url: String(input), method });
    if (method === 'GET' && answered < answerReads) {
      answered += 1;
      return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' } }));
    }
    return new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    });
  };
  const client = createClient('http://pantryflow.invalid', 'anon-key', {
    global: { fetch: withRequestTimeouts(fetch, { dataMs: DATA_MS }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, seen };
}
const settle = () => new Promise(resolve => setTimeout(resolve, DATA_MS * 4));
// Without the timeout under test the request would wait forever; this deadline turns that into a
// named assertion failure instead of a hung test run (the S13 lesson, TI-4).
const within = (promise, message, ms = 2000) => {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new assert.AssertionError({ message })), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
};

function mount(hookFile, hookName, Provider, data, dataStub, answerReads = 0) {
  const server = hangingServer(answerReads);
  const boundary = { '@/lib/supabase': { supabase: server.client }, '@/lib/auth': { useAuth: () => ({ user: { id: 'u' } }) },
    './household-scope': { useHouseholdScope: () => ({ householdId: 'h', loading: false, error: null, refreshHousehold: async () => {} }) } };
  const hooks = load(hookFile, { ...boundary, './household-list': load('hooks/household-list.ts', boundary), [dataStub]: data });
  let value;
  function Probe() { value = hooks[hookName](); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(hooks[Provider], null, React.createElement(Probe))); });
  return { server, get value() { return value; }, dispose: () => act(() => renderer.unmount()) };
}

test('pantry: a read that never answers shows the load error; a write that never answers is unconfirmed and re-reads', async () => {
  const m = mount('hooks/usePantryItems.tsx', 'usePantryItems', 'PantryProvider', pantryData, '@/lib/pantry-data');
  try {
    await act(settle);
    assert.equal(m.value.error, 'err_load_items', 'the read ended with the load error');
    assert.equal(m.value.loading, false);
    const readsBefore = m.server.seen.filter(r => r.method === 'GET').length;
    let outcome;
    await act(async () => {
      [outcome] = await Promise.allSettled([within(m.value.addItem({ name: 'Eggs', category: 'dairy', location: 'fridge' }),
        'the data timeout must end a pantry write that never answers')]);
      await settle();
    });
    assert.equal(outcome.status, 'rejected');
    assert.equal(outcome.reason.code, pantryData.WRITE_UNCONFIRMED, outcome.reason.message);
    assert.equal(pantryData.itemSaveErrorKey(outcome.reason), 'err_change_unconfirmed');
    assert.equal(m.server.seen.filter(r => r.method === 'GET').length, readsBefore + 1, 'the write is followed by a re-read');
    assert.equal(m.server.seen.filter(r => r.method === 'POST').length, 1, 'the write was sent once, never retried');
  } finally { m.dispose(); }
});

test('shopping: a read that never answers shows the load error; a write that never answers is unconfirmed and re-reads', async () => {
  const m = mount('hooks/useShoppingItems.tsx', 'useShoppingItems', 'ShoppingProvider', shoppingData, '@/lib/shopping-data');
  try {
    await act(settle);
    assert.equal(m.value.error, 'err_load_shopping', 'the read ended with the load error');
    const readsBefore = m.server.seen.filter(r => r.method === 'GET').length;
    let outcome;
    await act(async () => {
      [outcome] = await Promise.allSettled([within(m.value.addItem({ name: 'Eggs' }), 'the data timeout must end a shopping write that never answers')]);
      await settle();
    });
    assert.equal(outcome.status, 'rejected');
    assert.equal(outcome.reason.code, shoppingData.WRITE_UNCONFIRMED, outcome.reason.message);
    assert.equal(shoppingData.shoppingErrorKey(outcome.reason), 'err_change_unconfirmed');
    assert.equal(m.server.seen.filter(r => r.method === 'GET').length, readsBefore + 1, 'the write is followed by a re-read');
    assert.equal(m.server.seen.filter(r => r.method === 'POST').length, 1, 'the write was sent once, never retried');
  } finally { m.dispose(); }
});

// #86 review: the re-read after an unconfirmed write is started, not awaited, so the message must
// not claim the list was refreshed; when that re-read also gets no answer, the list shows its load
// error with Retry, never a synchronized state.
const { en } = load('lib/i18n/en.ts');
const { de } = load('lib/i18n/de.ts');

test('the could-not-be-confirmed message never claims that the list was refreshed', () => {
  assert.doesNotMatch(en.err_change_unconfirmed, /refreshed|has been (re)?loaded|is up to date/i);
  assert.doesNotMatch(de.err_change_unconfirmed, /wurde neu geladen|ist aktuell|aktualisiert/i);
  assert.match(en.err_change_unconfirmed, /could not be confirmed/);
});

for (const [label, hookFile, hookName, Provider, data, dataStub, loadError, write] of [
  ['pantry', 'hooks/usePantryItems.tsx', 'usePantryItems', 'PantryProvider', pantryData, '@/lib/pantry-data', 'err_load_items',
    value => value.addItem({ name: 'Eggs', category: 'dairy', location: 'fridge' })],
  ['shopping', 'hooks/useShoppingItems.tsx', 'useShoppingItems', 'ShoppingProvider', shoppingData, '@/lib/shopping-data', 'err_load_shopping',
    value => value.addItem({ name: 'Eggs' })],
]) {
  test(`${label}: when the re-read after an unconfirmed write also gets no answer, the list shows its load error with Retry`, async () => {
    const m = mount(hookFile, hookName, Provider, data, dataStub, 1);
    try {
      await act(settle);
      assert.equal(m.value.error, null, 'the first read was answered');
      assert.equal(m.value.loading, false);
      let outcome;
      await act(async () => {
        [outcome] = await Promise.allSettled([within(write(m.value), `the data timeout must end a ${label} write that never answers`)]);
        await settle();
      });
      assert.equal(outcome.reason?.code, data.WRITE_UNCONFIRMED, 'the write outcome is unconfirmed, not failed');
      assert.equal(m.server.seen.filter(r => r.method === 'GET').length, 2, 'the write was followed by a re-read');
      assert.equal(m.value.error, loadError, 'the failed re-read shows the load error, never a synchronized list');
      assert.equal(m.value.loading, false);
      assert.equal(typeof m.value.retry, 'function', 'the load error keeps its Retry');
    } finally { m.dispose(); }
  });
}

// The household lookup goes through the same client: when it gets no answer, both lists show their
// load error with Try again (which re-runs the lookup), never "No household found. Please sign out
// and back in."; only an answer without a membership row keeps that message. Real supabase-js,
// real useHousehold, HouseholdProvider and both list providers.
function mountHousehold(fetch) {
  const client = createClient('http://pantryflow.invalid', 'anon-key', {
    global: { fetch: withRequestTimeouts(fetch, { dataMs: DATA_MS }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const stubs = { '@/lib/supabase': { supabase: client }, '@/lib/auth': { useAuth: () => ({ user: { id: 'u' } }) } };
  const scope = load('hooks/household-scope.tsx', { ...stubs, './useHousehold': load('hooks/useHousehold.ts', stubs) });
  const boundary = { ...stubs, './household-scope': scope };
  const list = load('hooks/household-list.ts', boundary);
  const pantry = load('hooks/usePantryItems.tsx', { ...boundary, './household-list': list, '@/lib/pantry-data': pantryData });
  const shopping = load('hooks/useShoppingItems.tsx', { ...boundary, './household-list': list, '@/lib/shopping-data': shoppingData });
  const value = {};
  function Probe() { value.pantry = pantry.usePantryItems(); value.shopping = shopping.useShoppingItems(); return null; }
  let renderer;
  act(() => {
    renderer = create(React.createElement(scope.HouseholdProvider, null, React.createElement(pantry.PantryProvider, null,
      React.createElement(shopping.ShoppingProvider, null, React.createElement(Probe)))));
  });
  return { value, dispose: () => act(() => renderer.unmount()) };
}

test('a household lookup that never answers shows each list\'s load error, not "No household found"', async () => {
  const neverAnswers = (_input, init = {}) => new Promise((_, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  });
  const m = mountHousehold(neverAnswers);
  try {
    await act(settle);
    assert.equal(m.value.pantry.error, 'err_load_items');
    assert.equal(m.value.shopping.error, 'err_load_shopping');
    assert.equal(m.value.pantry.loading, false);
    assert.equal(m.value.shopping.loading, false);
  } finally { m.dispose(); }
});

// The lookup asks for an array (maybeSingle), so PostgREST answers "no row" with [] and never with
// its single-object 406 (PGRST116), which is ambiguous between no row and more than one.
const rows = list => async (input, init = {}) => {
  rows.accept = new Headers(init.headers).get('accept');
  return new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': `*/${list.length}` } });
};

test('an empty answer to the household lookup keeps "No household found"; the lookup never asks for a single object', async () => {
  const m = mountHousehold(rows([]));
  try {
    await act(settle);
    assert.equal(m.value.pantry.error, 'err_no_household');
    assert.equal(m.value.shopping.error, 'err_no_household');
    assert.doesNotMatch(rows.accept ?? '', /vnd\.pgrst\.object/, 'with the single-object header, no row would be a 406 error');
  } finally { m.dispose(); }
});

test('more than one membership row (ruled out by UNIQUE(user_id)) is a failed lookup, never "No household found"', async () => {
  const m = mountHousehold(rows([{ household_id: 'h1' }, { household_id: 'h2' }]));
  try {
    await act(settle);
    assert.equal(m.value.pantry.error, 'err_load_items');
    assert.equal(m.value.shopping.error, 'err_load_shopping');
  } finally { m.dispose(); }
});
