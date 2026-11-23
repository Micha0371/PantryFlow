import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localStack, withTestUsers, password, removeUserByEmail, runThenCleanup, type TestUser } from './local-stack';
import { isMissingPantryItem } from '../../lib/pantry-data';

// Every test below owns its accounts (withTestUsers) and creates exactly the
// rows it asserts on; none depends on another test or on shared state.
const ok = <T,>(result: { data: T; error: unknown }) => { assert.equal(result.error, null); return result.data; };

const insert = (user: TestUser, name: string, extra = {}) => user.client.from('pantry_items').insert({
  household_id: user.household, created_by: user.id, name, ...extra,
}).select().single();
const insertMilk = async (a: TestUser) => {
  const milk = ok(await insert(a, '  Milk  '));
  assert.equal(milk.name, 'Milk');
  return milk;
};

test('direct API rejects duplicate creates and renames, permits self edits and distinct names', async () => {
  await withTestUsers(2, 'dup', async ([a, b]) => {
    const milk = await insertMilk(a);
    for (const name of ['Milk', 'milk', ' MILK ', '\u00a0Milk\u00a0']) {
      assert.equal((await insert(a, name, { category: 'grains', location: 'counter', status: 'out' })).error?.code, '23505');
    }
    const fridge = ok(await insert(a, 'Milk Fridge'));
    ok(await insert(a, 'Milk  Fridge')); // Internal whitespace is intentionally significant.
    assert.equal((await a.client.from('pantry_items').update({ name: 'milk' }).eq('id', fridge.id)).error?.code, '23505');
    ok(await a.client.from('pantry_items').update({ name: ' Milk ', status: 'low' }).eq('id', milk.id));
    ok(await insert(b, 'milk'));
  });
});

test('independent HTTP transactions produce exactly one winner for concurrent duplicates', async () => {
  await withTestUsers(1, 'race', async ([a]) => {
    const results = await Promise.all([insert(a, 'Eggs'), insert(a, ' eggs ')]);
    assert.equal(results.filter(r => !r.error).length, 1);
    assert.equal(results.find(r => r.error)?.error?.code, '23505');
    const x = ok(await insert(a, 'Bread A')), y = ok(await insert(a, 'Bread B'));
    const renames = await Promise.all([x, y].map(row => a.client.from('pantry_items').update({ name: 'Bread' }).eq('id', row.id)));
    assert.equal(renames.filter(r => !r.error).length, 1);
    assert.equal(renames.find(r => r.error)?.error?.code, '23505');
  });
});

test('two households and anonymous callers cannot cross authorization boundaries', async () => {
  await withTestUsers(2, 'authz', async ([a, b], stack) => {
    // Each household owns a pantry row so the empty-result assertions below can fail.
    const ownedA = ok(await insert(a, 'Owned A')), ownedB = ok(await insert(b, 'Owned B'));
    for (const [actor, owner] of [[b, a], [a, b]]) {
      for (const table of ['pantry_items', 'pantry_households', 'pantry_household_members', 'profiles']) {
        const filter = ({ pantry_items: 'household_id', pantry_households: 'id', profiles: 'id',
          pantry_household_members: 'user_id' } as Record<string, string>)[table];
        const value = table === 'pantry_items' || table === 'pantry_households' ? owner.household : owner.id;
        assert.deepEqual(ok(await actor.client.from(table).select('*').eq(filter, value)), []);
      }
      assert.deepEqual(ok(await actor.client.from('pantry_items').update({ name: 'Stolen' }).eq('household_id', owner.household).select()), []);
      assert.deepEqual(ok(await actor.client.from('pantry_items').delete().eq('household_id', owner.household).select()), []);
      assert.ok((await insert(actor, 'Foreign', { household_id: owner.household })).error);
      assert.deepEqual(ok(await actor.client.from('profiles').update({ name: 'Stolen' }).eq('id', owner.id).select()), []);
      assert.deepEqual(ok(await actor.client.from('pantry_households').update({ name: 'Stolen' }).eq('id', owner.household).select()), []);
      assert.deepEqual(ok(await actor.client.from('pantry_households').delete().eq('id', owner.household).select()), []);
      assert.deepEqual(ok(await actor.client.from('pantry_household_members').update({ role: 'owner' }).eq('user_id', owner.id).select()), []);
      assert.deepEqual(ok(await actor.client.from('pantry_household_members').delete().eq('user_id', owner.id).select()), []);
      assert.equal((await actor.client.from('pantry_household_members').insert({ household_id: owner.household, user_id: actor.id, role: 'owner' })).error?.code, '42501');
      assert.equal((await actor.client.from('pantry_households').insert({ owner_id: actor.id, name: 'Unapproved second household' })).error?.code, '42501');
    }
    // The owners' rows survived every attempt, so the empty results above were denials.
    assert.equal(ok(await a.client.from('pantry_items').select('name').eq('id', ownedA.id).single())?.name, 'Owned A');
    assert.equal(ok(await b.client.from('pantry_items').select('name').eq('id', ownedB.id).single())?.name, 'Owned B');
    const anon = stack.client();
    const read = await anon.from('pantry_items').select('*');
    assert.ok(read.error || read.data?.length === 0);
    assert.ok((await anon.from('pantry_items').insert({ name: 'Anon', household_id: a.household, created_by: a.id })).error);
  });
});

// CR-01 (KAN-115): the provider's exact write shapes against a row deleted
// elsewhere and a row of another household. Both look the same, so the
// client can recover without learning whether a foreign row exists.
test('writes to a deleted or foreign pantry row are classified as missing', async () => {
  await withTestUsers(2, 'missing', async ([a, b]) => {
    const update = (user: TestUser, id: string) => user.client.from('pantry_items')
      .update({ name: 'Renamed', category: 'other', location: 'pantry', status: 'low' })
      .eq('id', id).eq('household_id', user.household).select().single();
    const remove = (user: TestUser, id: string) => user.client.from('pantry_items')
      .delete().eq('id', id).eq('household_id', user.household).select('id');
    const gone = ok(await insert(a, 'Deleted elsewhere'));
    assert.deepEqual(ok(await remove(a, gone.id)), [{ id: gone.id }]);
    const foreign = ok(await insert(b, 'Foreign item'));
    for (const id of [gone.id, foreign.id]) {
      const updated = await update(a, id);
      assert.equal(updated.error?.code, 'PGRST116');
      assert.equal(isMissingPantryItem(updated.error), true);
      assert.deepEqual(ok(await remove(a, id)), []);
    }
    const still = await b.client.from('pantry_items').select('name').eq('id', foreign.id).single();
    assert.equal(ok(still)?.name, 'Foreign item');
  });
});

test('profile privileges and immutable creator/household/timestamps are enforced', async () => {
  await withTestUsers(2, 'profile', async ([a, b]) => {
    const milk = await insertMilk(a);
    ok(await a.client.from('profiles').update({ name: 'Alice', language: 'de' }).eq('id', a.id));
    assert.ok((await a.client.from('profiles').update({ is_premium: true }).eq('id', a.id)).error);
    for (const [column, value] of Object.entries({ created_by: b.id, household_id: b.household, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), id: b.id })) {
      assert.ok((await a.client.from('pantry_items').update({ [column]: value }).eq('id', milk.id)).error);
    }
    assert.ok((await insert(a, 'Forged', { created_by: b.id })).error);
    assert.ok((await insert(a, 'Null', { created_by: null })).error);
  });
});

test('blank/overlong names and unsupported values fail; all stock states persist', async () => {
  await withTestUsers(1, 'values', async ([a]) => {
    const milk = await insertMilk(a);
    for (const name of ['', ' ', '\t\n', 'a'.repeat(121)]) assert.equal((await insert(a, name)).error?.code, '23514');
    for (const column of ['category', 'location', 'status']) assert.equal((await insert(a, 'Invalid', { [column]: 'invalid' })).error?.code, '23514');
    for (const status of ['low', 'in_stock', 'out']) { // fresh row is in_stock: every step is a real change
      const saved = ok(await a.client.from('pantry_items').update({ status }).eq('id', milk.id).select().single());
      assert.equal(saved.status, status);
      assert.equal(ok(await a.client.from('pantry_items').select('status').eq('id', milk.id).single())!.status, status);
    }
    ok(await a.client.from('pantry_items').delete().eq('id', milk.id));
    assert.deepEqual(ok(await a.client.from('pantry_items').select().eq('id', milk.id)), []);
  });
});

test('real confirmation-required signup, rejection, confirmation, refresh and logout', async () => {
  const stack = localStack();
  const email = `pf.test.signup.${randomUUID().slice(0, 8)}@example.com`;
  let createdId: string | undefined;
  await runThenCleanup(async () => {
    const client = stack.client();
    const signup = await client.auth.signUp({ email, password, options: { data: { name: 'Signup' } } });
    createdId = signup.data.user?.id;
    assert.equal(signup.error, null); assert.equal(signup.data.session, null); assert.ok(signup.data.user);
    assert.ok((await client.auth.signInWithPassword({ email, password })).error);
    const confirmed = await stack.admin.auth.admin.updateUserById(signup.data.user!.id, { email_confirm: true });
    assert.equal(confirmed.error, null); // Real email delivery remains a separate release task.
    assert.ok((await client.auth.signInWithPassword({ email, password: 'wrong-password' })).error);
    const login = await client.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null); assert.ok(login.data.session);
    const restored = stack.client();
    assert.equal((await restored.auth.setSession(login.data.session!)).error, null);
    const refresh = await restored.auth.refreshSession();
    assert.equal(refresh.error, null); assert.ok(refresh.data.session);
    assert.equal((await restored.auth.signOut({ scope: 'local' })).error, null);
    assert.ok((await stack.client().auth.refreshSession({ refresh_token: refresh.data.session!.refresh_token })).error);
  }, () => removeUserByEmail(stack.admin, email, createdId));
});

// Shopping persistence: each test builds its own pantry rows and shopping row.
const table = 'pantry_shopping_items';
const insertShopping = (user: TestUser, name: string | null, extra = {}) => user.client.from(table).insert({
  household_id: user.household, created_by: user.id, name, ...extra,
}).select().single();
const shoppingRow = async (a: TestUser, id: string) => ok(await a.client.from(table).select().eq('id', id).single())!;
const insertPantry = async (user: TestUser, name: string, extra = {}) => ok(await user.client.from('pantry_items').insert({
  household_id: user.household, created_by: user.id, name, ...extra }).select().single())!;
// pantryA (low) + a linked shopping 'Milk' in a's household.
const shoppingMilk = async (a: TestUser) => {
  const pantryA = await insertPantry(a, 'Pantry milk', { status: 'low' });
  const milk = ok(await insertShopping(a, '\u00a0 Milk \u00a0', { pantry_item_id: pantryA.id }))!;
  return { pantryA, milk };
};

test('direct API normalizes edge whitespace, rejects bad names and shares manual/linked uniqueness', async () => {
  await withTestUsers(2, 'shopnorm', async ([a, b]) => {
    const { milk } = await shoppingMilk(a);
    assert.equal(milk.name, 'Milk');
    for (const name of ['milk', ' MILK ', '\u00a0milk\u00a0']) {
      assert.equal((await insertShopping(a, name)).error?.code, '23505');
    }
    for (const name of ['', ' \t\n', '\u00a0', 'x'.repeat(121)]) {
      assert.equal((await insertShopping(a, name)).error?.code, '23514');
    }
    assert.equal((await insertShopping(a, null)).error?.code, '23502');
    const x = ok(await insertShopping(a, 'Milk Fridge'))!;
    ok(await insertShopping(a, 'Milk  Fridge'));
    assert.equal((await a.client.from(table).update({ name: 'milk' }).eq('id', x.id)).error?.code, '23505');
    ok(await a.client.from(table).update({ name: ' Milk ' }).eq('id', milk.id));
    ok(await insertShopping(b, 'milk'));
  });
});

test('completion is retained, server-timed and reopenable without changing pantry state', async () => {
  await withTestUsers(1, 'shopdone', async ([a]) => {
    const { pantryA, milk } = await shoppingMilk(a);
    const checked = ok(await a.client.from(table).update({ is_checked: true }).eq('id', milk.id).select().single())!;
    assert.ok(checked.completed_at); assert.equal(checked.is_checked, true);
    const edited = ok(await a.client.from(table).update({ name: 'Milk', is_checked: true }).eq('id', milk.id).select().single())!;
    assert.equal(edited.completed_at, checked.completed_at);
    const open = ok(await insertShopping(a, 'milk'))!;
    assert.equal((await a.client.from(table).update({ is_checked: false }).eq('id', milk.id)).error?.code, '23505');
    assert.equal((await shoppingRow(a, milk.id)).completed_at, checked.completed_at);
    ok(await a.client.from(table).delete().eq('id', open.id));
    const reopened = ok(await a.client.from(table).update({ is_checked: false }).eq('id', milk.id).select().single())!;
    assert.equal(reopened.completed_at, null);
    assert.equal(reopened.is_checked, false);
    assert.deepEqual(ok(await a.client.from('pantry_items').select().eq('id', pantryA.id).single()), pantryA);
  });
});

test('independent clients arbitrate concurrent add, rename, reopen and add-versus-reopen', async () => {
  await withTestUsers(1, 'shoprace', async ([a], stack) => {
    const peer = stack.client();
    assert.equal((await peer.auth.signInWithPassword({ email: a.email, password })).error, null);
    const oneWinner = (results: Array<{ error: { code?: string } | null }>) => {
      assert.equal(results.filter(r => !r.error).length, 1);
      assert.equal(results.find(r => r.error)?.error?.code, '23505');
    };
    oneWinner(await Promise.all([insertShopping(a, 'Eggs'), peer.from(table).insert({
      household_id: a.household, created_by: a.id, name: ' eggs ',
    })]));
    const x = ok(await insertShopping(a, 'Rename A'))!, y = ok(await insertShopping(a, 'Rename B'))!;
    oneWinner(await Promise.all([a.client.from(table).update({ name: 'Bread' }).eq('id', x.id),
      peer.from(table).update({ name: ' bread ' }).eq('id', y.id)]));
    const c = ok(await insertShopping(a, 'Reopen', { is_checked: true }))!;
    const d = ok(await insertShopping(a, 'reopen', { is_checked: true }))!;
    oneWinner(await Promise.all([a.client.from(table).update({ is_checked: false }).eq('id', c.id),
      peer.from(table).update({ is_checked: false }).eq('id', d.id)]));
    assert.equal(ok(await a.client.from(table).select().in('id', [c.id, d.id]).eq('is_checked', false))!.length, 1);
    const e = ok(await insertShopping(a, 'Race', { is_checked: true }))!;
    oneWinner(await Promise.all([insertShopping(a, ' race '), peer.from(table).update({ is_checked: false }).eq('id', e.id)]));
    assert.equal(ok(await a.client.from(table).select().eq('household_id', a.household).ilike('name', 'race').eq('is_checked', false))!.length, 1);
  });
});

test('ordinary and anonymous clients cannot cross households, spoof creators or timestamps', async () => {
  await withTestUsers(2, 'shopauth', async ([a, b], stack) => {
    const { milk } = await shoppingMilk(a);
    // b's household owns a shopping row too, so both directions' empty results can fail.
    const bRow = ok(await insertShopping(b, 'B list item'))!;
    for (const [actor, owner] of [[a, b], [b, a]]) {
      assert.deepEqual(ok(await actor.client.from(table).select().eq('household_id', owner.household)), []);
      assert.deepEqual(ok(await actor.client.from(table).update({ name: 'Stolen' }).eq('household_id', owner.household).select()), []);
      assert.deepEqual(ok(await actor.client.from(table).delete().eq('household_id', owner.household).select()), []);
      assert.equal((await insertShopping(actor, 'Foreign', { household_id: owner.household })).error?.code, '42501');
      assert.equal((await insertShopping(actor, 'Forged', { created_by: owner.id })).error?.code, '42501');
    }
    assert.equal((await shoppingRow(b, bRow.id)).name, 'B list item');
    assert.equal((await shoppingRow(a, milk.id)).name, 'Milk');
    assert.equal((await insertShopping(a, 'Null author', { created_by: null })).error?.code, '42501');
    for (const [column, value] of Object.entries({ id: b.id, household_id: b.household, created_by: b.id,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: new Date().toISOString() })) {
      assert.equal((await a.client.from(table).update({ [column]: value }).eq('id', milk.id)).error?.code, '42501');
      if (column !== 'household_id' && column !== 'created_by') {
        assert.equal((await insertShopping(a, 'Injected ' + column, { [column]: value })).error?.code, '42501');
      }
    }
    assert.equal((await a.client.from(table).update({ is_checked: null }).eq('id', milk.id)).error?.code, '23502');
    const anon = stack.client();
    assert.equal((await anon.from(table).select()).error?.code, '42501');
    assert.equal((await anon.from(table).insert({ name: 'Anon', household_id: a.household, created_by: a.id })).error?.code, '42501');
    assert.equal((await anon.from(table).update({ name: 'Anon' }).eq('id', milk.id)).error?.code, '42501');
    assert.equal((await anon.from(table).delete().eq('id', milk.id)).error?.code, '42501');
  });
});

test('pantry links are household-consistent and pantry deletion preserves shopping state', async () => {
  await withTestUsers(2, 'shoplink', async ([a, b]) => {
    const { pantryA, milk } = await shoppingMilk(a);
    const pantryB = await insertPantry(b, 'Pantry milk');
    assert.equal((await insertShopping(a, 'Foreign link', { pantry_item_id: pantryB.id })).error?.code, '23503');
    assert.equal((await a.client.from(table).update({ pantry_item_id: pantryB.id }).eq('id', milk.id)).error?.code, '23503');
    const alternate = await insertPantry(a, 'Pantry oats', { status: 'out' });
    ok(await a.client.from(table).update({ is_checked: true }).eq('id', milk.id));
    const original = await shoppingRow(a, milk.id);
    assert.ok(original.completed_at);
    const relinked = ok(await a.client.from(table).update({ pantry_item_id: alternate.id })
      .eq('id', milk.id).select().single())!;
    assert.equal(relinked.pantry_item_id, alternate.id);
    assert.equal(relinked.name, original.name);
    assert.equal(relinked.household_id, original.household_id);
    assert.equal(relinked.is_checked, original.is_checked);
    assert.equal(relinked.completed_at, original.completed_at);
    assert.deepEqual(ok(await a.client.from('pantry_items').select().eq('id', alternate.id).single()), alternate);
    ok(await a.client.from('pantry_items').delete().eq('id', pantryA.id));
    assert.equal((await shoppingRow(a, milk.id)).pantry_item_id, alternate.id, 'deleting the former target leaves the new link intact');
    const before = await shoppingRow(a, milk.id);
    ok(await a.client.from('pantry_items').delete().eq('id', alternate.id));
    const after = await shoppingRow(a, milk.id);
    assert.equal(after.pantry_item_id, null); assert.equal(after.name, before.name);
    assert.equal(after.household_id, before.household_id); assert.equal(after.completed_at, before.completed_at);
    ok(await a.client.from(table).delete().eq('id', milk.id));
    assert.deepEqual(ok(await a.client.from(table).select().eq('id', milk.id)), []);
    assert.deepEqual(ok(await b.client.from('pantry_items').select().eq('id', pantryB.id).single()), pantryB);
  });
});

test('another member may edit; deleting its author preserves the surviving household row', async () => {
  await withTestUsers(2, 'shopmember', async ([a, b], stack) => {
    // Admin only prepares the shared-membership fixture; assertions use member clients.
    // b's own household keeps a pantry row and a shopping row, so deleting b covers an owner whose former household has rows.
    const formerHousehold = b.household;
    await insertPantry(b, 'Former pantry');
    ok(await insertShopping(b, 'milk'));
    ok(await stack.admin.from('pantry_household_members').update({ household_id: a.household }).eq('user_id', b.id));
    const shared = ok(await insertShopping({ ...b, household: a.household }, 'Shared author'))!;
    ok(await a.client.from(table).update({ name: 'Shared edited' }).eq('id', shared.id));
    assert.equal((await shoppingRow(a, shared.id)).name, 'Shared edited');
    assert.equal((await stack.admin.auth.admin.deleteUser(b.id)).error, null);
    assert.deepEqual(ok(await stack.admin.from('pantry_items').select().eq('household_id', formerHousehold)), []);
    assert.deepEqual(ok(await stack.admin.from(table).select().eq('household_id', formerHousehold)), []);
    assert.equal((await shoppingRow(a, shared.id)).created_by, null);
    ok(await a.client.from(table).update({ is_checked: true }).eq('id', shared.id));
    assert.ok((await shoppingRow(a, shared.id)).completed_at);
  });
});
