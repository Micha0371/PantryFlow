const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load, deferred } = require('./helpers.cjs');

test('household lookup rejects stale identities and exposes a retry after network failure', async () => {
  let user = { id: 'alice' }, value;
  const requests = [];
  const supabase = { from() { return { select() { return this; }, eq() { return this; },
    single() { const d = deferred(); requests.push(d); return d.promise; } }; } };
  const { useHousehold } = load('hooks/useHousehold.ts', {
    '@/lib/supabase': { supabase }, '@/lib/auth': { useAuth: () => ({ user }) },
  });
  function Consumer() { value = useHousehold(); return null; }
  let renderer;
  act(() => { renderer = create(React.createElement(Consumer)); });
  user = { id: 'bob' };
  act(() => renderer.update(React.createElement(Consumer)));
  await act(async () => requests[0].resolve({ data: { household_id: 'alice-home' }, error: null }));
  assert.equal(value.householdId, null);
  await act(async () => requests[1].reject(new Error('offline')));
  assert.equal(value.loading, false);
  // A failed read is not a missing household: the lists show their load message with Try again.
  assert.equal(value.error, 'household_unavailable');
  let retry;
  act(() => { retry = value.refreshHousehold(); });
  await act(async () => {
    requests[2].resolve({ data: { household_id: 'bob-home' }, error: null });
    await retry;
  });
  assert.equal(value.householdId, 'bob-home');
  assert.equal(value.error, null);
  user = null;
  act(() => renderer.update(React.createElement(Consumer)));
  assert.equal(value.householdId, null);
  act(() => renderer.unmount());
});

// Only a lookup that found no membership row means "no household"; a timeout (KAN-127), the network
// or the server is a read that failed and is shown as such, so nobody is told to sign out over it.
async function lookup(outcome) {
  let value;
  const supabase = { from() { return { select() { return this; }, eq() { return this; }, single: () => outcome() }; } };
  const { useHousehold } = load('hooks/useHousehold.ts', {
    '@/lib/supabase': { supabase }, '@/lib/auth': { useAuth: () => ({ user: { id: 'u' } }) },
  });
  function Consumer() { value = useHousehold(); return null; }
  let renderer;
  await act(async () => { renderer = create(React.createElement(Consumer)); });
  act(() => renderer.unmount());
  return value;
}

test('no membership row (PGRST116) or a row without a household is err_no_household', async () => {
  const none = await lookup(async () => ({ data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }));
  assert.equal(none.error, 'err_no_household');
  assert.equal(none.householdId, null);
  const empty = await lookup(async () => ({ data: { household_id: null }, error: null }));
  assert.equal(empty.error, 'err_no_household');
});

test('a timed-out, network or server failure of the lookup is household_unavailable', async () => {
  // supabase-js answers an aborted or failed fetch with an error object, not a rejection.
  for (const error of [{ code: '', message: 'AbortError: The operation was aborted.' },
    { code: '', message: 'TypeError: Network request failed' }, { code: 'PGRST002', message: 'schema cache' },
    { code: '500', message: 'server error' }, { message: 'an error without a code' }]) {
    const value = await lookup(async () => ({ data: null, error }));
    assert.equal(value.error, 'household_unavailable', error.message);
    assert.equal(value.loading, false);
  }
  assert.equal((await lookup(async () => { throw new Error('offline'); })).error, 'household_unavailable');
});
