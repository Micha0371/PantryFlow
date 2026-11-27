const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');
const constants = load('lib/constants.ts');
const data = load('lib/pantry-data.ts', { './write-outcome': load('lib/write-outcome.ts'), './constants': constants, './pagination': load('lib/pagination.ts') });
const row = (over = {}) => ({ id: '1', household_id: 'h', name: 'Milk', status: 'in_stock',
  category: 'dairy', location: 'fridge', created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01', ...over });

// Scripted Supabase mock: each awaited chain consumes the next queued response
// (a value or a promise) and records its method, filters and update payload.
function fixture() {
  let user = { id: 'u' }, household = 'h';
  const queue = [], calls = [], reads = [];
  const supabase = { from() {
    const call = { method: 'select', filters: {}, payload: undefined };
    calls.push(call);
    const chain = {
      update(payload) { call.method = 'update'; call.payload = payload; return chain; },
      select() { return chain; },
      eq(key, value) { call.filters[key] = value; return chain; },
      maybeSingle() {
        const next = queue.shift();
        return next && next.throws ? Promise.reject(next.throws) : Promise.resolve(next);
      },
    };
    return chain;
  } };
  const boundary = { '@/lib/supabase': { supabase }, '@/lib/auth': { useAuth: () => ({ user }) },
    './household-scope': { useHouseholdScope: () => ({ householdId: household, loading: false, error: null, refreshHousehold: async () => {} }) } };
  const { PantryProvider, usePantryItems } = load('hooks/usePantryItems.tsx', {
    ...boundary, './household-list': load('hooks/household-list.ts', boundary),
    '@/lib/pantry-data': { ...data, fetchAllItems: () => { const d = deferred(); reads.push(d); return d.promise; } },
  });
  let first;
  function One() { first = usePantryItems(); return null; }
  const tree = () => React.createElement(PantryProvider, null, React.createElement(One));
  let renderer;
  act(() => { renderer = create(tree()); });
  return { reads, calls, queue, get api() { return first; },
    change(nextUser, nextHousehold) { user = nextUser; household = nextHousehold; act(() => renderer.update(tree())); },
    dispose() { act(() => renderer.unmount()); } };
}
const ok = value => ({ data: value, error: null });
async function loaded(f, items = [row()]) { await act(async () => f.reads[0].resolve(items)); }

test('a status change writes only status, filtered by id, household and the cached status', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push(ok(row({ status: 'low' })));
  let result;
  await act(async () => { result = await f.api.setItemStatus('1', 'low'); });
  assert.deepEqual(f.calls[0].payload, { status: 'low' });
  assert.deepEqual(f.calls[0].filters, { id: '1', household_id: 'h', status: 'in_stock' });
  assert.equal(result.kind, 'changed');
  assert.equal(result.previous, 'in_stock');
  assert.equal(f.api.items[0].status, 'low');
  f.dispose();
});

test('the returned row replaces the cached one, including a name changed elsewhere', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push(ok(row({ status: 'low', name: 'Oat milk' })));
  await act(async () => { await f.api.setItemStatus('1', 'low'); });
  assert.equal(f.api.items[0].name, 'Oat milk');
  f.dispose();
});

test('selecting the cached status makes no API call and returns already', async () => {
  const f = fixture(); await loaded(f);
  let result;
  await act(async () => { result = await f.api.setItemStatus('1', 'in_stock'); });
  assert.equal(result.kind, 'already');
  assert.equal(f.calls.length, 0);
  f.dispose();
});

test('an unknown cached item throws without a call', async () => {
  const f = fixture(); await loaded(f);
  await act(async () => assert.rejects(f.api.setItemStatus('nope', 'low'), /Invalid pantry item/));
  assert.equal(f.calls.length, 0);
  f.dispose();
});

test('a database already holding the new status returns already without a write or prompt data', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push(ok(null), ok(row({ status: 'low' })));
  let result;
  await act(async () => { result = await f.api.setItemStatus('1', 'low'); });
  assert.equal(result.kind, 'already');
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls.filter(c => c.method === 'update').length, 1);
  f.dispose();
});

test('a stale cache retries once against the database status and reports it as previous', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push(ok(null), ok(row({ status: 'out' })), ok(row({ status: 'low' })));
  let result;
  await act(async () => { result = await f.api.setItemStatus('1', 'low'); });
  assert.equal(result.kind, 'changed');
  assert.equal(result.previous, 'out');
  assert.equal(f.calls.length, 3);
  assert.equal(f.calls[2].filters.status, 'out');
  assert.equal(f.api.items[0].status, 'low');
  f.dispose();
});

test('a second mismatch throws a conflict and adopts the fresh row', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push(ok(null), ok(row({ status: 'out' })), ok(null), ok(row({ status: 'in_stock', name: 'Fresh' })));
  await act(async () => assert.rejects(f.api.setItemStatus('1', 'low'),
    e => e.code === 'PF_PANTRY_STATUS_CONFLICT' && e.current.name === 'Fresh'));
  assert.equal(f.api.items[0].name, 'Fresh');
  assert.equal(f.reads.length, 1);
  f.dispose();
});

test('a confirmed missing row drops it and re-reads', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push(ok(null), ok(null));
  await act(async () => assert.rejects(f.api.setItemStatus('1', 'low'), e => e.code === 'PF_PANTRY_MISSING'));
  assert.equal(f.api.items.length, 0);
  assert.equal(f.reads.length, 2);
  f.dispose();
});

// Confirmed rejections (a coded error on an update step) and read-step failures
// are rethrown unchanged: nothing was applied, nothing is unconfirmed.
for (const [step, script, error] of [
  ['the CAS', e => [{ data: null, error: e }], { code: '42501' }],
  ['the read', e => [ok(null), { data: null, error: e }], new Error('offline')],
  ['the read', e => [ok(null), { data: null, error: e }], { code: '42501' }],
  ['the retry', e => [ok(null), ok(row({ status: 'out' })), { data: null, error: e }], { code: '42501' }],
]) {
  test(`a confirmed error at ${step} is rethrown, keeps the row and is never missing or unconfirmed (${error.code ?? 'offline'})`, async () => {
    const f = fixture(); await loaded(f);
    f.queue.push(...script(error));
    await act(async () => {
      await assert.rejects(f.api.setItemStatus('1', 'low'), e => e === error);
    });
    assert.equal(f.api.items.length, 1);
    assert.equal(f.api.items[0].status, 'in_stock');
    assert.equal(f.api.isUnconfirmed('1'), false);
    assert.equal(f.reads.length, 1);
    f.dispose();
  });
}

// An update step that fails without a code may have committed (A1).
const lost = { message: 'FetchError: network lost', code: '' };
const gateway = { message: '<html>502</html>' };
for (const [name, script, original] of [
  ['a thrown exception on the CAS', () => [{ throws: new Error('boom') }], null],
  ['code "" on the CAS', () => [{ data: null, error: lost }], lost],
  ['a codeless gateway error on the CAS', () => [{ data: null, error: gateway }], gateway],
  ['code "" on the retry', () => [ok(null), ok(row({ status: 'out' })), { data: null, error: lost }], lost],
  ['a thrown exception on the retry', () => [ok(null), ok(row({ status: 'out' })), { throws: new Error('boom') }], null],
]) {
  test(`${name} is uncertain: coded unknown, row kept, marked, one re-read`, async () => {
    const f = fixture(); await loaded(f);
    f.queue.push(...script());
    await act(async () => {
      await assert.rejects(f.api.setItemStatus('1', 'low'), e => e.code === 'PF_PANTRY_STATUS_UNKNOWN'
        && (original ? e.cause === original : e.cause instanceof Error && e.cause.message === 'boom'));
    });
    assert.equal(f.api.items[0].status, 'in_stock');
    assert.equal(f.api.isUnconfirmed('1'), true);
    assert.equal(f.reads.length, 2);
    f.dispose();
  });
}

test('the unconfirmed mark clears after an accepted list read', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push({ data: null, error: lost });
  await act(async () => assert.rejects(f.api.setItemStatus('1', 'low'), e => e.code === 'PF_PANTRY_STATUS_UNKNOWN'));
  await act(async () => f.reads[1].resolve([row({ status: 'low' })]));
  assert.equal(f.api.isUnconfirmed('1'), false);
  assert.equal(f.api.items[0].status, 'low');
  f.dispose();
});

test('the mark survives a later write that discards the reconciling read, which starts a new one', async () => {
  const f = fixture(); await loaded(f, [row(), row({ id: '2', name: 'Eggs' })]);
  f.queue.push({ data: null, error: lost });
  await act(async () => assert.rejects(f.api.setItemStatus('1', 'low'), e => e.code === 'PF_PANTRY_STATUS_UNKNOWN'));
  f.queue.push(ok(row({ id: '2', name: 'Eggs', status: 'low' })));
  await act(async () => { await f.api.setItemStatus('2', 'low'); });
  assert.equal(f.reads.length, 3);
  await act(async () => f.reads[1].resolve([row()]));
  assert.equal(f.api.isUnconfirmed('1'), true);
  await act(async () => f.reads[2].resolve([row({ status: 'low' }), row({ id: '2', name: 'Eggs', status: 'low' })]));
  assert.equal(f.api.isUnconfirmed('1'), false);
  f.dispose();
});

test('an authoritative row for the item clears its mark', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push({ data: null, error: lost });
  await act(async () => assert.rejects(f.api.setItemStatus('1', 'low'), e => e.code === 'PF_PANTRY_STATUS_UNKNOWN'));
  f.queue.push(ok(row({ status: 'low' })));
  await act(async () => { await f.api.setItemStatus('1', 'low'); });
  assert.equal(f.api.isUnconfirmed('1'), false);
  f.dispose();
});

test('an unconfirmed item selecting its cached status still asks the database', async () => {
  const f = fixture(); await loaded(f);
  f.queue.push({ data: null, error: lost });
  await act(async () => assert.rejects(f.api.setItemStatus('1', 'low'), e => e.code === 'PF_PANTRY_STATUS_UNKNOWN'));
  // The lost write did commit: the database holds low although the cache says in_stock.
  f.queue.push(ok(row({ status: 'low' })), ok(row({ status: 'in_stock' })));
  let result;
  await act(async () => { result = await f.api.setItemStatus('1', 'in_stock'); });
  assert.equal(f.calls.length, 3);
  assert.equal(f.calls[1].method, 'select');
  assert.equal(result.kind, 'changed');
  assert.equal(result.previous, 'low');
  assert.equal(f.api.isUnconfirmed('1'), false);
  f.dispose();
});

test('the status write shares the per-item lock with updateItem', async () => {
  const f = fixture(); await loaded(f);
  const pending = deferred();
  f.queue.push(pending.promise);
  let writing;
  act(() => { writing = f.api.setItemStatus('1', 'low'); });
  await act(async () => assert.rejects(
    f.api.updateItem('1', { name: 'Milk', category: 'dairy', location: 'fridge', status: 'out' }), /pending/));
  assert.equal(f.calls.length, 1);
  await act(async () => { pending.resolve(ok(row({ status: 'low' }))); await writing; });
  f.dispose();
});

test('a status write that settles after a household change writes nothing into the new scope', async () => {
  const f = fixture(); await loaded(f);
  const pending = deferred();
  f.queue.push(pending.promise);
  let writing;
  act(() => { writing = f.api.setItemStatus('1', 'low'); });
  f.change({ id: 'u' }, 'h2');
  await act(async () => f.reads[1].resolve([row({ id: '9', household_id: 'h2' })]));
  await act(async () => { pending.resolve(ok(row({ status: 'low' }))); await writing; });
  assert.deepEqual(f.api.items.map(i => [i.id, i.status]), [['9', 'in_stock']]);
  f.dispose();
});

test('an uncertain outcome after a household change leaves the new household\'s list loading normally', async () => {
  const f = fixture(); await loaded(f);
  const pending = deferred();
  f.queue.push(pending.promise);
  let writing;
  act(() => { writing = f.api.setItemStatus('1', 'low'); });
  f.change({ id: 'u' }, 'h2');
  await act(async () => {
    pending.resolve({ data: null, error: lost });
    await assert.rejects(writing, e => e.code === 'PF_PANTRY_STATUS_UNKNOWN');
  });
  await act(async () => f.reads[1].resolve([row({ id: '9', household_id: 'h2' })]));
  assert.equal(f.api.loading, false);
  assert.deepEqual(f.api.items.map(i => i.id), ['9']);
  assert.equal(f.api.isUnconfirmed('1'), false);
  f.dispose();
});
