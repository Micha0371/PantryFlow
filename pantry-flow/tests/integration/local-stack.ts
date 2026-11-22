import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const appRoot = path.resolve(__dirname, '../..');
export const localUrl = 'http://127.0.0.1:54321';
export const password = 'PF-local-test-only-9281!';
export const emails = ['pf.test.alice@example.com', 'pf.test.bob@example.com', 'pf.test.signup@example.com', 'pf.test.confirm@example.com'];

export function validateLocalStatus(status: Record<string, string>) {
  assert.equal(status.API_URL, localUrl, 'Refusing any non-local or unexpected Supabase stack');
  assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY, 'Local CLI must return local anon/admin keys');
  return status;
}

// Explicit CLI cwd, never .env or hosted credentials. The admin client is only
// for local fixture lifecycle. All behavioral assertions use ordinary clients.
export function localStack() {
  const launcher = path.join(appRoot, 'node_modules/supabase/dist/supabase.js');
  const status = validateLocalStatus(JSON.parse(execFileSync(process.execPath, [launcher, 'status', '-o', 'json'], {
    cwd: appRoot, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'],
  })));
  const options = { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) } };
  return {
    key: status.ANON_KEY,
    admin: createClient(localUrl, status.SERVICE_ROLE_KEY, options),
    client: () => createClient(localUrl, status.ANON_KEY, options),
  };
}

export async function cleanup(admin: SupabaseClient) {
  // Only exact reserved fixture emails; never bulk-delete arbitrary accounts.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const user of data.users.filter(user => emails.includes(user.email ?? ''))) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
}

export async function fixtures(stack: ReturnType<typeof localStack>) {
  await cleanup(stack.admin);
  const users = [];
  for (const email of emails.slice(0, 2)) {
    const { data, error } = await stack.admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { name: email.includes('alice') ? 'Alice' : 'Bob' } });
    if (error) throw error;
    const client = stack.client();
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    const membership = await client.from('pantry_household_members').select('household_id').single();
    if (membership.error) throw membership.error;
    users.push({ client, id: data.user.id, household: membership.data.household_id as string });
  }
  return users;
}

export type TestUser = { client: SupabaseClient; id: string; email: string; household: string };

// Per-test accounts: unique emails, removed by exact id (never by pattern).
export async function createTestUsers(stack: ReturnType<typeof localStack>, count: number, label: string): Promise<TestUser[]> {
  const users: TestUser[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const email = `pf.test.${label}.${randomUUID().slice(0, 8)}.${i}@example.com`;
      const name = i === 0 ? 'Alice' : i === 1 ? 'Bob' : `User ${i}`;
      const { data, error } = await stack.admin.auth.admin.createUser({ email, password, email_confirm: true,
        user_metadata: { name } });
      if (error) throw error;
      const entry = { id: data.user.id } as TestUser;
      users.push(entry);
      const client = stack.client();
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      const membership = await client.from('pantry_household_members').select('household_id').single();
      if (membership.error) throw membership.error;
      Object.assign(entry, { client, email, household: membership.data.household_id as string });
    }
  } catch (error) {
    await removeTestUsers(stack.admin, users);
    throw error;
  }
  return users;
}

export async function removeTestUsers(admin: SupabaseClient, users: { id: string }[]) {
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error && !/not.?found/i.test(error.message) && error.status !== 404) throw error;
  }
}

export async function withTestUsers(count: number, label: string,
  run: (users: TestUser[], stack: ReturnType<typeof localStack>) => Promise<void>) {
  const stack = localStack();
  const users = await createTestUsers(stack, count, label);
  try {
    await run(users, stack);
  } finally {
    await removeTestUsers(stack.admin, users);
  }
}
