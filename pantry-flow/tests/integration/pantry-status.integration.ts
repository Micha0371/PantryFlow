import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localStack, fixtures, cleanup, emails, password } from './local-stack';
import { writeItemStatus, PANTRY_MISSING } from '../../lib/pantry-data';

async function rejection(work: Promise<unknown>): Promise<unknown> {
  try { await work; } catch (error) { return error; }
  assert.fail('expected the operation to be rejected');
}

// Each test gets its own stack fixtures and item, and cleans up after itself.
async function scenario(run: (ctx: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  const stack = localStack();
  try { await run(await setup(stack)); } finally { await cleanup(stack.admin); }
}
async function setup(stack: ReturnType<typeof localStack>) {
  const [a, b] = await fixtures(stack);
  const add = async (name: string, status = 'in_stock') => {
    const result = await a.client.from('pantry_items').insert({
      household_id: a.household, created_by: a.id, name, status,
    }).select().single();
    assert.equal(result.error, null);
    return result.data!;
  };
  const read = async (id: string) => {
    const result = await a.client.from('pantry_items').select('*').eq('id', id).single();
    assert.equal(result.error, null);
    return result.data!;
  };
  return { stack, a, b, add, read };
}

test('a matching compare-and-set returns the row and the previous status', () => scenario(async ({ a, add }) => {
  const milk = await add('Milk');
  const changed = await writeItemStatus(a.client, a.household, milk.id, 'in_stock', 'low');
  assert.equal(changed.kind, 'changed');
  assert.equal(changed.kind === 'changed' && changed.previous, 'in_stock');
  assert.equal(changed.item.status, 'low');
}));

test('zero matched rows return null data without an error', () => scenario(async ({ a, add }) => {
  const milk = await add('Milk', 'out');
  const zero = await a.client.from('pantry_items').update({ status: 'low' })
    .eq('id', milk.id).eq('household_id', a.household).eq('status', 'in_stock')
    .select().maybeSingle();
  assert.equal(zero.error, null);
  assert.equal(zero.data, null);
}));

test('a concurrent rename survives a status write', () => scenario(async ({ stack, a, add, read }) => {
  const milk = await add('Milk', 'low');
  const rival = stack.client();
  const login = await rival.auth.signInWithPassword({ email: emails[0], password });
  assert.equal(login.error, null);
  const renamed = await rival.from('pantry_items').update({ name: 'Oat milk' }).eq('id', milk.id);
  assert.equal(renamed.error, null);
  const result = await writeItemStatus(a.client, a.household, milk.id, 'low', 'out');
  assert.equal(result.kind, 'changed');
  const stored = await read(milk.id);
  assert.equal(stored.name, 'Oat milk');
  assert.equal(stored.status, 'out');
}));

test('a database already at the target status returns already and leaves updated_at unchanged', () => scenario(async ({ a, add, read }) => {
  const milk = await add('Milk', 'out');
  const before = await read(milk.id);
  const result = await writeItemStatus(a.client, a.household, milk.id, 'low', 'out');
  assert.equal(result.kind, 'already');
  assert.equal((await read(milk.id)).updated_at, before.updated_at);
}));

test('a stale previous status is retried against the database status', () => scenario(async ({ a, add, read }) => {
  const milk = await add('Milk', 'out');
  const result = await writeItemStatus(a.client, a.household, milk.id, 'in_stock', 'low');
  assert.equal(result.kind, 'changed');
  assert.equal(result.kind === 'changed' && result.previous, 'out');
  assert.equal((await read(milk.id)).status, 'low');
}));

test('a deleted row and a foreign household\'s row both throw PF_PANTRY_MISSING', () => scenario(async ({ a, b, add, read }) => {
  const milk = await add('Milk', 'low');
  const bread = await add('Bread');
  const del = await a.client.from('pantry_items').delete().eq('id', bread.id);
  assert.equal(del.error, null);
  const gone = await rejection(writeItemStatus(a.client, a.household, bread.id, 'in_stock', 'low')) as { code?: string };
  assert.equal(gone.code, PANTRY_MISSING);
  const foreign = await rejection(writeItemStatus(b.client, b.household, milk.id, 'low', 'out')) as { code?: string };
  assert.equal(foreign.code, PANTRY_MISSING);
  assert.equal((await read(milk.id)).status, 'low');
}));
