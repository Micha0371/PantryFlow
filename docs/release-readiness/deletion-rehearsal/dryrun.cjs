'use strict';
// Dry run of the rehearsal mechanics in an in-memory PGlite database: the committed migrations, a stub of the
// Auth tables the read-back touches, and scripted deletions. It shows that readback.sql and evaluate.cjs give
// PASS for a correct deletion and FAIL or STOP for the failure cases. It is NOT evidence about the hosted
// project or Supabase Auth: the stub only mirrors the foreign keys recorded in FV-B3 (local Auth v2.198.0).
//
//   node docs/release-readiness/deletion-rehearsal/dryrun.cjs     (from the repository root, after npm ci in pantry-flow)
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { evaluate } = require('./evaluate.cjs');

const root = path.resolve(__dirname, '../../..');
const { PGlite } = createRequire(path.join(root, 'pantry-flow/package.json'))('@electric-sql/pglite');
const migration = name => fs.readFileSync(path.join(root, 'pantry-flow/supabase/migrations', name), 'utf8');
const READBACK = fs.readFileSync(path.join(__dirname, 'readback.sql'), 'utf8');
const ID = {
  TARGET_USER: '00000000-0000-4000-8000-0000000000a1', OTHER_USER: '00000000-0000-4000-8000-0000000000b1',
  THIRD_USER: '00000000-0000-4000-8000-0000000000c1', PANTRY_ITEM: '00000000-0000-4000-8000-0000000001a1',
  LINKED_SHOPPING: '00000000-0000-4000-8000-0000000002a1', MANUAL_SHOPPING: '00000000-0000-4000-8000-0000000002a2',
  COMPLETED_SHOPPING: '00000000-0000-4000-8000-0000000002a3',
};

// Stub of the Auth tables the read-back reads. Foreign keys as recorded in FV-B3; flow_state has none.
const AUTH_STUB = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE TABLE auth.identities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
  CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
  CREATE TABLE auth.refresh_tokens (id bigserial PRIMARY KEY, user_id varchar(255), session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE);
  CREATE TABLE auth.mfa_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
  CREATE TABLE auth.one_time_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
  CREATE TABLE auth.flow_state (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid);
  CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;`;

async function build() {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(migration('00001_first_slice.sql').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
  for (const name of ['00002_review_hardening.sql', '00003_strict_duplicate_prevention.sql', '00004_shopping_items.sql']) {
    await db.exec(migration(name));
  }
  // Two accounts, created as sign-up would: the triggers add profile, household and membership.
  await db.query('INSERT INTO auth.users (id) VALUES ($1), ($2)', [ID.TARGET_USER, ID.OTHER_USER]);
  const home = async user => (await db.query('SELECT id FROM public.pantry_households WHERE owner_id = $1', [user])).rows[0].id;
  const ids = { ...ID, TARGET_HOUSEHOLD: await home(ID.TARGET_USER), OTHER_HOUSEHOLD: await home(ID.OTHER_USER) };
  for (const user of [ID.TARGET_USER, ID.OTHER_USER]) {
    await db.query('INSERT INTO auth.identities (user_id) VALUES ($1)', [user]);
    const session = (await db.query('INSERT INTO auth.sessions (user_id) VALUES ($1) RETURNING id', [user])).rows[0].id;
    await db.query('INSERT INTO auth.refresh_tokens (user_id, session_id) VALUES ($1, $2)', [user, session]);
    await db.query('INSERT INTO auth.one_time_tokens (user_id) VALUES ($1)', [user]);
    await db.query('INSERT INTO auth.flow_state (user_id) VALUES ($1)', [user]);
  }
  // Target fixtures: a pantry item, a linked, a manual and a completed shopping item.
  await db.query(`INSERT INTO public.pantry_items (id, household_id, name, status, created_by) VALUES ($1, $2, 'Fixture milk', 'low', $3)`,
    [ID.PANTRY_ITEM, ids.TARGET_HOUSEHOLD, ID.TARGET_USER]);
  await db.query(`INSERT INTO public.pantry_shopping_items (id, household_id, pantry_item_id, name, created_by) VALUES ($1, $2, $3, 'Fixture milk', $4)`,
    [ID.LINKED_SHOPPING, ids.TARGET_HOUSEHOLD, ID.PANTRY_ITEM, ID.TARGET_USER]);
  await db.query(`INSERT INTO public.pantry_shopping_items (id, household_id, name, created_by) VALUES ($1, $2, 'Fixture bread', $3)`,
    [ID.MANUAL_SHOPPING, ids.TARGET_HOUSEHOLD, ID.TARGET_USER]);
  await db.query(`INSERT INTO public.pantry_shopping_items (id, household_id, name, is_checked, created_by) VALUES ($1, $2, 'Fixture rice', true, $3)`,
    [ID.COMPLETED_SHOPPING, ids.TARGET_HOUSEHOLD, ID.TARGET_USER]);
  // Unrelated account: one pantry item and one shopping item.
  await db.query(`INSERT INTO public.pantry_items (household_id, name, created_by) VALUES ($1, 'Other oats', $2)`, [ids.OTHER_HOUSEHOLD, ID.OTHER_USER]);
  await db.query(`INSERT INTO public.pantry_shopping_items (household_id, name, created_by) VALUES ($1, 'Other tea', $2)`, [ids.OTHER_HOUSEHOLD, ID.OTHER_USER]);
  return { db, ids };
}

const fill = (sql, ids) => sql.replace(/__([A-Z_]+)__/g, (all, name) => ids[name] ?? all);

async function readback(db, ids) {
  const results = await db.exec(fill(READBACK, ids));
  return results.find(result => result.rows.length && 'entity' in result.rows[0]).rows;
}

const SCENARIOS = [
  ['correct deletion: delete the Auth user', 'PASS', async (db, ids) => {
    await db.query('DELETE FROM auth.users WHERE id = $1', [ids.TARGET_USER]);
  }],
  ['nothing deleted', 'FAIL', async () => {}],
  ['partial deletion: application rows removed by hand, Auth user and shopping rows kept', 'FAIL', async (db, ids) => {
    await db.query('DELETE FROM public.pantry_items WHERE household_id = $1', [ids.TARGET_HOUSEHOLD]);
    await db.query('DELETE FROM public.profiles WHERE id = $1', [ids.TARGET_USER]);
  }],
  ['correct deletion plus a change to the unrelated household', 'FAIL', async (db, ids) => {
    await db.query('DELETE FROM auth.users WHERE id = $1', [ids.TARGET_USER]);
    await db.query(`UPDATE public.pantry_items SET status = 'out' WHERE household_id = $1`, [ids.OTHER_HOUSEHOLD]);
  }],
  ['correct deletion plus a change outside both fixture accounts', 'FAIL', async (db, ids) => {
    await db.query('DELETE FROM auth.users WHERE id = $1', [ids.TARGET_USER]);
    await db.query('INSERT INTO auth.users (id) VALUES ($1)', [ids.THIRD_USER]);
  }],
];

async function preconditionScenario() {
  // A second member in the target household: deleting the owner would cascade that member's household.
  const { db, ids } = await build();
  try {
    await db.query('INSERT INTO auth.users (id) VALUES ($1)', [ids.THIRD_USER]);
    await db.query('DELETE FROM public.pantry_household_members WHERE user_id = $1', [ids.THIRD_USER]);
    await db.query(`INSERT INTO public.pantry_household_members (household_id, user_id, role) VALUES ($1, $2, 'member')`,
      [ids.TARGET_HOUSEHOLD, ids.THIRD_USER]);
    return evaluate(await readback(db, ids), null).verdict;
  } finally { await db.close(); }
}

async function placeholderScenario() {
  const { db, ids } = await build();
  try {
    await db.exec(fill(READBACK, { ...ids, PANTRY_ITEM: undefined }));
    return 'query ran';
  } catch (error) {
    return `query failed (${error.code ?? 'error'}): STOP`;
  } finally { await db.close(); }
}

async function main() {
  let failures = 0;
  const check = (name, expected, actual) => {
    const ok = actual === expected || (expected === 'STOP' && String(actual).endsWith('STOP'));
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'BAD '} ${name}: expected ${expected}, got ${actual}`);
  };
  for (const [name, expected, act] of SCENARIOS) {
    const { db, ids } = await build();
    try {
      const before = await readback(db, ids);
      await act(db, ids);
      const result = evaluate(before, await readback(db, ids));
      check(name, expected, result.verdict);
      if (expected === 'PASS') for (const line of result.lines) console.log(`       ${line}`);
    } finally { await db.close(); }
  }
  check('precondition: second member in the target household', 'STOP', await preconditionScenario());
  {
    const { db, ids } = await build();
    try { check('precondition: intact fixtures are ready', 'READY', evaluate(await readback(db, ids), null).verdict); } finally { await db.close(); }
  }
  check('a placeholder left in the query', 'STOP', await placeholderScenario());
  console.log(failures ? `DRY RUN FAILED: ${failures} scenario(s)` : 'DRY RUN OK: all scenarios gave the expected verdict');
  process.exitCode = failures ? 1 : 0;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
