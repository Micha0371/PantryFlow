import test from 'node:test';
import assert from 'node:assert/strict';
import { localUrl, withTestUsers, type TestUser } from './local-stack';

type Table = 'pantry_items' | 'pantry_shopping_items' | 'profiles';
type Write = { policy: string; table: Table; method: 'PATCH' | 'DELETE'; change?: Record<string, unknown> };
const writes: Write[] = [
  { policy: 'items_update_member', table: 'pantry_items', method: 'PATCH', change: { status: 'out' } },
  { policy: 'items_delete_member', table: 'pantry_items', method: 'DELETE' },
  { policy: 'shopping_update_member', table: 'pantry_shopping_items', method: 'PATCH', change: { is_checked: true } },
  { policy: 'shopping_delete_member', table: 'pantry_shopping_items', method: 'DELETE' },
  { policy: 'profiles_update_own', table: 'profiles', method: 'PATCH', change: { name: 'Updated profile' } },
];

// Reads use the actual owner, not the actor or a client-side household filter.
async function read(owner: TestUser, table: Table, id: string) {
  const result = await owner.client.from(table).select('*').eq('id', id).maybeSingle();
  assert.equal(result.error, null);
  return result.data;
}

async function seed(owner: TestUser, table: Table, name: string) {
  if (table === 'profiles') {
    const row = await read(owner, table, owner.id);
    assert.ok(row, 'fixture profile exists');
    return row;
  }
  const result = await owner.client.from(table).insert({ household_id: owner.household, created_by: owner.id, name })
    .select().single();
  assert.equal(result.error, null);
  assert.ok(result.data, 'fixture inventory row exists');
  return result.data;
}

// Raw HTTP deliberately has no query string, count preference or returned representation.
async function minimalWrite(actor: TestUser, key: string, table: Table, method: string, body?: Record<string, unknown>) {
  const session = await actor.client.auth.getSession();
  assert.equal(session.error, null);
  assert.ok(session.data.session, 'ordinary user is signed in');
  return fetch(`${localUrl}/rest/v1/${table}`, {
    method, signal: AbortSignal.timeout(20000),
    headers: { apikey: key, Authorization: `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function ownControl(actor: TestUser, spec: Write) {
  const row = await seed(actor, spec.table, 'Own fixture');
  const change = spec.table === 'pantry_items' ? { status: 'low' } : { name: 'Own positive control' };
  const result = spec.method === 'DELETE'
    ? await actor.client.from(spec.table).delete().eq('id', row.id)
    : await actor.client.from(spec.table).update(change).eq('id', row.id);
  assert.equal(result.error, null, `${spec.policy}: own minimal control accepted`);
  assert.equal(result.data, null, 'own control returns no representation');
  const after = await read(actor, spec.table, row.id);
  if (spec.method === 'DELETE') {
    assert.equal(after, null, `${spec.policy}: own control deleted`);
    return seed(actor, spec.table, 'Own fixture');
  }
  assert.ok(after, 'own control row remains');
  for (const [column, value] of Object.entries(change)) assert.deepEqual(after[column], value);
  return after;
}

async function checkBareResponse(response: Response, spec: Write, diagnostic: (message: string) => void) {
  if (response.status === 400) {
    const rejection = await response.json();
    assert.equal(rejection.code, '21000', 'only the actual full-table gateway guard is an accepted boundary');
    assert.equal(rejection.message, `${spec.method === 'PATCH' ? 'UPDATE' : 'DELETE'} requires a WHERE clause`);
    diagnostic(`${spec.policy}: bare HTTP blocked by gateway (21000); not an RLS detector`);
    return false;
  }
  assert.equal(response.status, 204, `${spec.policy}: minimal write accepted`);
  assert.equal(await response.text(), '', 'no returned representation');
  return true;
}

for (const spec of writes) {
  test(`${spec.policy} HTTP preserves foreign state without returning`, async t => {
    await withTestUsers(2, 'bare-write', async ([actor, stranger], stack) => {
      const foreign = await seed(stranger, spec.table, 'Foreign fixture');
      const own = await ownControl(actor, spec);
      const response = await minimalWrite(actor, stack.key, spec.table, spec.method, spec.change);
      const applied = await checkBareResponse(response, spec, message => t.diagnostic(message));
      const ownAfter = await read(actor, spec.table, own.id);
      if (!applied) assert.deepEqual(ownAfter, own, `${spec.policy}: rejected bare write changed no own data`);
      else if (spec.method === 'DELETE') assert.equal(ownAfter, null, `${spec.policy}: own deletion persisted`);
      else {
        assert.ok(ownAfter, `${spec.policy}: own row still exists`);
        for (const [column, value] of Object.entries(spec.change!)) {
          assert.deepEqual(ownAfter[column], value, `${spec.policy}: own update persisted`);
        }
      }
      assert.deepEqual(await read(stranger, spec.table, foreign.id), foreign,
        `${spec.policy}: foreign state unchanged`);
    });
  });
}

for (const [policy, table] of [['items_insert_member', 'pantry_items'], ['shopping_insert_member', 'pantry_shopping_items']] as const) {
  test(`${policy} HTTP rejects foreign household insert without returning`, async () => {
    await withTestUsers(2, 'bare-insert', async ([actor, stranger], stack) => {
      const foreign = await seed(stranger, table, 'Foreign fixture');
      const own = await minimalWrite(actor, stack.key, table, 'POST', {
        household_id: actor.household, created_by: actor.id, name: 'Own insert',
      });
      assert.equal(own.status, 201, `${policy}: own insert accepted`);
      assert.equal(await own.text(), '', 'no returned insert representation');
      const ownRows = await actor.client.from(table).select('name');
      assert.equal(ownRows.error, null);
      assert.deepEqual(ownRows.data, [{ name: 'Own insert' }], `${policy}: own insertion persisted`);
      const response = await minimalWrite(actor, stack.key, table, 'POST', {
        household_id: stranger.household, created_by: actor.id, name: 'Foreign insert',
      });
      // Assert foreign state first: a permissive mutant must fail here, not merely on HTTP status.
      const foreignRows = await stranger.client.from(table).select('*').order('name');
      assert.equal(foreignRows.error, null);
      assert.deepEqual(foreignRows.data, [foreign], `${policy}: foreign row absent`);
      assert.equal(response.status, 403, `${policy}: foreign insert rejected`);
      const rejection = await response.json();
      assert.equal(rejection.code, '42501');
    });
  });
}
