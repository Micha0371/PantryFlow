const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');
const { readContract } = require('./list-provider-contract.cjs');
const constants = load('lib/constants.ts');
const data = load('lib/pantry-data.ts', { './write-outcome': load('lib/write-outcome.ts'), './constants': constants, './pagination': load('lib/pagination.ts') });
const row = (id = '1', household_id = 'h') => ({ id, household_id, name: 'Milk', status: 'in_stock',
  category: 'dairy', location: 'fridge', created_by: 'u', created_at: '2026-01-01', updated_at: '2026-01-01' });

function fixture() {
  let user = { id: 'u' }, household = 'h', scope = { loading: false, error: null };
  let first, second, mutationResult;
  const reads = [];
  const refreshes = [];
  const apiCalls = [];
  const supabase = { from() { return { insert() { apiCalls.push('insert'); return this; }, update() { apiCalls.push('update'); return this; },
    delete() { apiCalls.push('delete'); return this; }, eq() { return this; }, select() { return this; },
    single() { return Promise.resolve(mutationResult); },
    then(yes, no) { return Promise.resolve(mutationResult).then(yes, no); } }; } };
  const boundary = { '@/lib/supabase': { supabase }, '@/lib/auth': { useAuth: () => ({ user }) },
    './household-scope': { useHouseholdScope: () => ({ householdId: household, loading: scope.loading, error: scope.error,
      refreshHousehold: async () => { refreshes.push(1); } }) } };
  const { PantryProvider, usePantryItems } = load('hooks/usePantryItems.tsx', {
    ...boundary, './household-list': load('hooks/household-list.ts', boundary),
    '@/lib/pantry-data': { ...data, fetchAllItems: () => { const d = deferred(); reads.push(d); return d.promise; } },
  });
  function One() { first = usePantryItems(); return null; }
  function Two() { second = usePantryItems(); return null; }
  const tree = () => React.createElement(PantryProvider, null, React.createElement(One), React.createElement(Two));
  let renderer;
  act(() => { renderer = create(tree()); });
  return { reads, apiCalls, refreshes, get first() { return first; }, get second() { return second; },
    mutation(value) { mutationResult = value; },
    change(nextUser, nextHousehold, nextScope = scope) { user = nextUser; household = nextHousehold; scope = nextScope; act(() => renderer.update(tree())); },
    dispose() { act(() => renderer.unmount()); } };
}

test('both consumers observe add, edit and delete; old reads cannot undo a write', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([]));
  let refresh;
  act(() => { refresh = f.first.fetchItems(); });
  f.mutation({ data: row(), error: null });
  await act(async () => f.first.addItem(row()));
  assert.equal(f.first.items.length, 1);
  assert.equal(f.second.items.length, 1);
  await act(async () => assert.rejects(f.first.addItem({ ...row(), name: ' milk ' }), error => error.code === '23505'));
  await act(async () => { f.reads[1].resolve([]); await refresh; });
  assert.equal(f.first.items.length, 1);
  f.mutation({ data: { ...row(), status: 'low' }, error: null });
  await act(async () => f.second.updateItem('1', { ...row(), status: 'low' }));
  assert.equal(f.first.items[0].status, 'low');
  f.mutation({ data: [{ id: '1' }], error: null });
  await act(async () => f.second.deleteItem('1'));
  assert.equal(f.first.items.length, 0);
  f.dispose();
});

readContract({ fixture, row, loadError: 'err_load_items' });

test('a delete that removes no row rejects', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row()]));
  f.mutation({ data: [], error: null });
  await act(async () => assert.rejects(f.first.deleteItem('missing'), /not deleted/));
  f.dispose();
});

test('a pending update locks the same item against a second screen deleting it', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row()]));
  const pending = deferred();
  f.mutation(pending.promise);
  let first, second;
  act(() => {
    first = f.first.updateItem('1', { ...row(), status: 'low' });
    second = f.second.deleteItem('1');
  });
  let outcomes;
  await act(async () => {
    pending.resolve({ data: { ...row(), status: 'low' }, error: null });
    outcomes = await Promise.allSettled([first, second]);
  });
  assert.equal(outcomes[0].status, 'fulfilled');
  assert.equal(outcomes[1].status, 'rejected');
  assert.match(outcomes[1].reason.message, /pending/);
  assert.deepEqual(f.apiCalls, ['update']);
  assert.equal(f.first.items[0].status, 'low');
  f.dispose();
});

test('a pending mutation cannot repopulate the next signed-in user cache', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row()]));
  const pending = deferred();
  f.mutation(pending.promise);
  let updating;
  act(() => { updating = f.first.updateItem('1', { ...row(), status: 'low' }); });
  f.change({ id: 'other-user' }, 'other-household');
  await act(async () => f.reads[1].resolve([row('other-item', 'other-household')]));
  await act(async () => {
    pending.resolve({ data: { ...row(), status: 'low' }, error: null });
    await updating;
  });
  assert.deepEqual(f.first.items.map(item => item.id), ['other-item']);
  f.dispose();
});

test('failed writes preserve existing inventory and allow a subsequent retry', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([row()]));
  // A confirmed (coded) rejection; a write without a database answer is the KAN-127 test below.
  f.mutation({ error: Object.assign(new Error('server rejected the write'), { code: 'XX000' }) });
  await act(async () => {
    await assert.rejects(f.first.updateItem('1', { ...row(), status: 'out' }), /rejected/);
    await assert.rejects(f.first.deleteItem('1'), /rejected/);
    await assert.rejects(f.first.addItem({ ...row(), name: 'Eggs' }), /rejected/);
  });
  assert.equal(f.first.items[0].status, 'in_stock');
  assert.equal(f.first.items.length, 1);
  f.mutation({ data: { ...row(), status: 'out' }, error: null });
  await act(async () => f.first.updateItem('1', { ...row(), status: 'out' }));
  assert.equal(f.first.items[0].status, 'out');
  f.dispose();
});

// KAN-32: a write before the first successful read must not strand the list.
const named = (id, name) => ({ ...row(id), name });
const ids = items => items.map(i => i.id).sort();

test('a pantry write while the first read is in flight ends with the full server list, not a stuck spinner', async () => {
  const f = fixture();
  f.mutation({ data: named('new', 'New'), error: null });
  await act(async () => { await f.first.addItem(named('new', 'New')); });
  await act(async () => f.reads[f.reads.length - 1].resolve([named('new', 'New'), named('a', 'A'), named('b', 'B')]));
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  assert.deepEqual(ids(f.first.items), ['a', 'b', 'new']);
  f.dispose();
});

test('a successful pantry write after a failed load re-reads instead of showing a partial list', async () => {
  const f = fixture();
  await act(async () => f.reads[0].reject(new Error('offline')));
  assert.equal(f.first.error, 'err_load_items');
  f.mutation({ data: named('new', 'New'), error: null });
  await act(async () => { await f.first.addItem(named('new', 'New')); });
  await act(async () => f.reads[f.reads.length - 1].resolve([named('new', 'New'), named('a', 'A')]));
  assert.equal(f.reads.length, 2);
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  assert.deepEqual(ids(f.first.items), ['a', 'new']);
  f.dispose();
});

test('a failed pantry write after a failed load keeps the load error and retry recovers', async () => {
  const f = fixture();
  await act(async () => f.reads[0].reject(new Error('offline')));
  f.mutation({ error: new Error('offline') });
  await act(async () => {
    await assert.rejects(f.first.addItem(named('new', 'New')), e => e.code === data.WRITE_UNCONFIRMED && /offline/.test(e.cause.message));
  });
  await act(async () => f.reads[f.reads.length - 1].reject(new Error('offline')));
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, 'err_load_items');
  let retry;
  act(() => { retry = f.first.retry(); });
  await act(async () => { f.reads[f.reads.length - 1].resolve([named('a', 'A')]); await retry; });
  assert.equal(f.first.error, null);
  assert.equal(f.first.loading, false);
  assert.deepEqual(ids(f.first.items), ['a']);
  f.dispose();
});

test('a pantry write on a loaded list issues no re-read', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('a', 'A')]));
  f.mutation({ data: named('new', 'New'), error: null });
  await act(async () => { await f.first.addItem(named('new', 'New')); });
  assert.equal(f.reads.length, 1);
  assert.deepEqual(ids(f.first.items), ['a', 'new']);
  f.dispose();
});

test('a refresh that sees an added pantry row before the insert returns leaves one entry', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('a', 'A')]));
  const pending = deferred();
  f.mutation(pending.promise);
  let adding, refresh;
  act(() => { adding = f.first.addItem(named('new', 'New')); });
  act(() => { refresh = f.second.fetchItems(); });
  await act(async () => { f.reads[1].resolve([named('new', 'New'), named('a', 'A')]); await refresh; });
  await act(async () => { pending.resolve({ data: named('new', 'New'), error: null }); await adding; });
  assert.deepEqual(f.first.items.map(i => i.id), ['new', 'a']);
  assert.deepEqual(f.second.items.map(i => i.id), ['new', 'a']);
  assert.equal(f.first.loading, false);
  f.dispose();
});

// KAN-85 item 2: the re-read after a write on an unloaded list belongs to the
// household that made the write; after a household change it must not run.
test('a write that settles after the same user changes household does not re-read for the new household (KAN-85)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].reject(new Error('offline')));
  const pending = deferred();
  f.mutation(pending.promise);
  let adding;
  act(() => { adding = f.first.addItem(named('new', 'New')); });
  // Same user, so the provider stays mounted and only the household scope changes.
  f.change({ id: 'u' }, 'other-household');
  await act(async () => f.reads[1].resolve([row('other-item', 'other-household')]));
  await act(async () => { pending.resolve({ data: named('new', 'New'), error: null }); await adding; });
  assert.equal(f.first.loading, false, 'the new household list is not stranded loading');
  assert.deepEqual(f.first.items.map(item => item.id), ['other-item']);
  assert.equal(f.reads.length, 2, 'no re-read after the household changed');
  f.dispose();
});

// KAN-85 item 3: a successful write on a loaded list clears an earlier error.
test('a successful write on a loaded list clears an earlier refresh error (KAN-85)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('a', 'A')]));
  let refresh;
  act(() => { refresh = f.first.fetchItems(); });
  await act(async () => { f.reads[1].reject(new Error('offline')); await refresh; });
  assert.equal(f.first.error, 'err_load_items');
  f.mutation({ data: named('new', 'New'), error: null });
  await act(async () => { await f.first.addItem(named('new', 'New')); });
  assert.equal(f.first.error, null);
  assert.equal(f.reads.length, 2, 'a loaded list needs no re-read');
  assert.deepEqual(ids(f.first.items), ['a', 'new']);
  f.dispose();
});

// CR-01 (KAN-115): an item deleted on another device. A write filtered by id and
// household returns zero rows; the provider drops the stale row at once (it must
// not depend on the re-read) and re-reads the household list.
const gone = () => ({ data: null, error: Object.assign(new Error('0 rows'), { code: 'PGRST116' }) });

test('a missing-record update or delete drops the stale row and re-reads (CR-01)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('1', 'Milk'), named('2', 'Eggs')]));
  f.mutation(gone());
  await act(async () => { await assert.rejects(f.first.updateItem('1', named('1', 'Oat milk')), e => e.code === 'PGRST116'); });
  assert.deepEqual(f.first.items.map(i => i.id), ['2'], 'the stale row is dropped before the re-read settles');
  assert.equal(f.reads.length, 2, 'a household re-read started');
  await act(async () => f.reads[1].resolve([named('2', 'Eggs')]));
  assert.deepEqual(f.second.items.map(i => i.id), ['2']);
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  f.mutation({ data: [], error: null });
  await act(async () => { await assert.rejects(f.second.deleteItem('2'), e => e.code === data.PANTRY_MISSING); });
  assert.deepEqual(f.first.items, []);
  assert.equal(f.reads.length, 3);
  await act(async () => f.reads[2].resolve([]));
  assert.deepEqual(f.first.items, []);
  assert.equal(f.first.loading, false);
  f.dispose();
});

test('a failed recovery read keeps the missing row out and shows the load error with retry (CR-01)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('1', 'Milk'), named('2', 'Eggs')]));
  f.mutation(gone());
  await act(async () => { await assert.rejects(f.first.updateItem('1', named('1', 'Oat milk')), e => e.code === 'PGRST116'); });
  await act(async () => f.reads[1].reject(new Error('offline')));
  assert.deepEqual(f.first.items.map(i => i.id), ['2']);
  assert.equal(f.first.error, 'err_load_items');
  assert.equal(f.first.loading, false);
  let retry;
  act(() => { retry = f.first.retry(); });
  await act(async () => { f.reads[2].resolve([named('2', 'Eggs')]); await retry; });
  assert.equal(f.first.error, null);
  assert.deepEqual(f.first.items.map(i => i.id), ['2']);
  f.dispose();
});

test('a permission failure keeps cached rows and issues no re-read (CR-01)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('1', 'Milk')]));
  const error = Object.assign(new Error('denied'), { code: '42501' });
  f.mutation({ data: null, error });
  await act(async () => {
    await assert.rejects(f.first.updateItem('1', { ...named('1', 'Milk'), status: 'low' }), e => e === error);
    await assert.rejects(f.first.deleteItem('1'), e => e === error);
  });
  assert.equal(f.reads.length, 1);
  assert.deepEqual(f.first.items.map(i => [i.id, i.status]), [['1', 'in_stock']]);
  assert.equal(f.first.error, null);
  assert.equal(f.first.loading, false);
  f.dispose();
});

// KAN-127: a write that ends without a database answer (a timeout, a lost connection) may have
// been committed. It keeps the cached rows, re-reads, and reports an unknown outcome, never a failure.
test('a write without a database answer keeps cached rows, re-reads and reports an unknown outcome (KAN-127)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('1', 'Milk')]));
  const writes = [
    () => f.first.addItem({ name: 'Eggs', category: 'dairy', location: 'fridge' }),
    () => f.first.updateItem('1', { ...named('1', 'Milk'), status: 'low' }),
    () => f.first.deleteItem('1'),
  ];
  for (const [index, write] of writes.entries()) {
    for (const error of [{ message: 'AbortError: The operation was aborted.', code: '' }, new TypeError('Network request failed')]) {
      const readsBefore = f.reads.length;
      f.mutation({ data: null, error });
      await act(async () => {
        await assert.rejects(write(), e => e.code === data.WRITE_UNCONFIRMED && e.cause === error, `write ${index}`);
      });
      assert.equal(f.reads.length, readsBefore + 1, `write ${index} re-reads the list`);
      assert.deepEqual(f.first.items.map(i => [i.id, i.status]), [['1', 'in_stock']], `write ${index} keeps the cached rows`);
      await act(async () => f.reads.at(-1).resolve([named('1', 'Milk')]));
    }
  }
  f.dispose();
});

test('the re-read after an unknown add shows the item the server did commit (KAN-127)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('1', 'Milk')]));
  f.mutation({ data: null, error: { message: 'AbortError', code: '' } });
  await act(async () => {
    await assert.rejects(f.first.addItem({ name: 'Eggs', category: 'dairy', location: 'fridge' }), e => e.code === data.WRITE_UNCONFIRMED);
  });
  await act(async () => f.reads.at(-1).resolve([named('2', 'Eggs'), named('1', 'Milk')]));
  assert.deepEqual(f.first.items.map(i => i.name), ['Eggs', 'Milk']);
  assert.deepEqual(f.second.items.map(i => i.name), ['Eggs', 'Milk']);
  f.dispose();
});

test('a missing-record re-read loses to a newer read and to a household change (CR-01)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('1', 'Milk')]));
  f.mutation({ data: [], error: null });
  await act(async () => { await assert.rejects(f.first.deleteItem('1'), e => e.code === data.PANTRY_MISSING); });
  assert.equal(f.reads.length, 2);
  let newer;
  act(() => { newer = f.first.fetchItems(); });
  await act(async () => { f.reads[2].resolve([named('1', 'Milk'), named('3', 'Tea')]); await newer; });
  await act(async () => f.reads[1].resolve([]));
  assert.deepEqual(ids(f.first.items), ['1', '3'], 'the older recovery read cannot overwrite the newer one');
  await act(async () => { await assert.rejects(f.first.deleteItem('1'), e => e.code === data.PANTRY_MISSING); });
  assert.equal(f.reads.length, 4);
  f.change({ id: 'u' }, 'h2');
  await act(async () => f.reads[3].resolve([row('old', 'h')]));
  assert.deepEqual(f.first.items, [], 'a recovery read of the old household cannot fill the new one');
  await act(async () => f.reads[4].resolve([row('x', 'h2')]));
  assert.deepEqual(f.first.items.map(i => i.id), ['x']);
  f.dispose();
});

test('a later successful write wins over a pending recovery read, and the missing row stays out (CR-01)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('1', 'Milk'), named('2', 'Eggs')]));
  f.mutation({ data: [], error: null });
  await act(async () => { await assert.rejects(f.first.deleteItem('1'), e => e.code === data.PANTRY_MISSING); });
  assert.deepEqual(f.first.items.map(i => i.id), ['2']);
  f.mutation({ data: { ...named('2', 'Eggs'), status: 'low' }, error: null });
  await act(async () => { await f.second.updateItem('2', { ...named('2', 'Eggs'), status: 'low' }); });
  await act(async () => f.reads[1].resolve([named('2', 'Eggs')]));
  assert.deepEqual(f.first.items.map(i => [i.id, i.status]), [['2', 'low']]);
  assert.equal(f.first.loading, false);
  f.dispose();
});

test('a missing result that arrives after a household change neither re-reads nor touches the new list (CR-01)', async () => {
  const f = fixture();
  await act(async () => f.reads[0].resolve([named('1', 'Milk')]));
  const pending = deferred();
  f.mutation(pending.promise);
  let updating;
  act(() => { updating = f.first.updateItem('1', named('1', 'Oat milk')); });
  f.change({ id: 'u' }, 'h2');
  await act(async () => f.reads[1].resolve([row('x', 'h2')]));
  await act(async () => {
    pending.resolve(gone());
    await assert.rejects(updating, e => e.code === 'PGRST116');
  });
  assert.equal(f.reads.length, 2, 'no recovery read for the new household');
  assert.deepEqual(f.first.items.map(i => i.id), ['x']);
  assert.equal(f.first.loading, false);
  assert.equal(f.first.error, null);
  f.dispose();
});
