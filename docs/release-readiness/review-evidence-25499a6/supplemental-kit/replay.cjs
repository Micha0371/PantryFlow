// Policy replay (PantryFlow release assurance, 2026-11-24). In-memory PGlite only: reads the migrations
// and the pgTAP files of the given project, writes nothing, needs no network and no database server.
//
//   node replay.cjs --repo <clone>/pantry-flow [--modules <folder with node_modules>] [--json <file>]
// Do not run it on a clone that run_probes.py is changing at the same time.
//
// Part 1 replays statement shapes as a second user (B) against the first user's (A) rows.
// Part 2 runs the project's unmodified pgTAP files (supabase/tests/database) inside PGlite.
// Both run with intact policies and then with one policy broken at a time.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const repo = path.resolve(arg('--repo') ?? '.');
const modules = path.resolve(arg('--modules') ?? repo);
const load = createRequire(path.join(modules, 'package.json'));
const { PGlite } = load('@electric-sql/pglite');
const { pgtap } = load('@electric-sql/pglite/pgtap');
const A = '00000000-0000-0000-0000-000000000001', B = '00000000-0000-0000-0000-000000000002';
const read = file => fs.readFileSync(path.join(repo, 'supabase', file), 'utf8').replace(/\r\n/g, '\n');
const P = 'public.pantry_items', S = 'public.pantry_shopping_items';
const policy = (name, table, rest) => `DROP POLICY ${name} ON ${table}; CREATE POLICY ${name} ON ${table} ${rest};`;
const BREAKS = {
  none: '',
  'pantry SELECT open': policy('items_select_member', P, 'FOR SELECT USING (true)'),
  'pantry INSERT any household': policy('items_insert_member', P, 'FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid())'),
  'pantry UPDATE open': policy('items_update_member', P, 'FOR UPDATE USING (true)'),
  'pantry DELETE open': policy('items_delete_member', P, 'FOR DELETE USING (true)'),
  'shopping SELECT open': policy('shopping_select_member', S, 'FOR SELECT TO authenticated USING (true)'),
  'shopping INSERT any household': policy('shopping_insert_member', S, 'FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid())'),
  'shopping UPDATE open': policy('shopping_update_member', S, 'FOR UPDATE TO authenticated USING (true) WITH CHECK (true)'),
  'shopping DELETE open': policy('shopping_delete_member', S, 'FOR DELETE TO authenticated USING (true)'),
  'profile SELECT open': policy('profiles_select_own', 'public.profiles', 'FOR SELECT USING (true)'),
  'profile UPDATE open': policy('profiles_update_own', 'public.profiles', 'FOR UPDATE USING (true)'),
  'household SELECT open': policy('households_select_member', 'public.pantry_households', 'FOR SELECT USING (true)'),
};
const insert = (t, h, n, r = '') => `INSERT INTO ${t}(household_id,name,created_by) VALUES ('${h}','${n}',auth.uid())${r}`;
const SHAPES = {
  // as written in supabase/tests/database/*.sql
  'pgTAP pantry count': () => `SELECT * FROM ${P}`,
  'pgTAP pantry foreign insert': h => insert(P, h, 'Foreign'),
  'pgTAP pantry update WHERE+RETURNING': h => `UPDATE ${P} SET status='out' WHERE household_id IN ('${h}') RETURNING id`,
  'pgTAP pantry delete WHERE+RETURNING': h => `DELETE FROM ${P} WHERE household_id IN ('${h}') RETURNING id`,
  'pgTAP shopping count': () => `SELECT * FROM ${S}`,
  'pgTAP shopping foreign insert': h => insert(S, h, 'Foreign'),
  'pgTAP shopping update RETURNING': () => `UPDATE ${S} SET name='Stolen' RETURNING id`,
  'pgTAP shopping delete RETURNING': () => `DELETE FROM ${S} RETURNING id`,
  'pgTAP profiles count': () => 'SELECT * FROM public.profiles',
  'pgTAP households count': () => 'SELECT * FROM public.pantry_households',
  // the SQL effect of supabase-js .insert().select() and .update().eq().select()
  'API pantry insert RETURNING': h => insert(P, h, 'Foreign2', ' RETURNING *'),
  'API pantry update WHERE+RETURNING': h => `UPDATE ${P} SET name='Stolen' WHERE household_id='${h}' RETURNING *`,
  'API shopping insert RETURNING': h => insert(S, h, 'Foreign2', ' RETURNING *'),
  'API shopping update WHERE+RETURNING': h => `UPDATE ${S} SET name='Stolen' WHERE household_id='${h}' RETURNING *`,
  'API profile update WHERE+RETURNING': () => `UPDATE public.profiles SET name='Stolen' WHERE id='${A}' RETURNING *`,
  // no WHERE and no RETURNING: the write policy alone decides
  'BARE pantry update': () => `UPDATE ${P} SET status='low'`,
  'BARE pantry delete': () => `DELETE FROM ${P}`,
  'BARE shopping update': () => `UPDATE ${S} SET is_checked=true`,
  'BARE shopping delete': () => `DELETE FROM ${S}`,
  'BARE profile update': () => "UPDATE public.profiles SET language='de'",
};

async function database(brk) {
  const db = new PGlite({ extensions: { pgtap } });
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA extensions;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, extensions, public TO anon, authenticated;
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;`);
  // Only difference to the real migrations: the uuid-ossp extension is replaced by the function above.
  await db.exec(read('migrations/00001_first_slice.sql').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
  await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;'); // Supabase's default table grants
  for (const n of ['00002_review_hardening.sql', '00003_strict_duplicate_prevention.sql', '00004_shopping_items.sql']) await db.exec(read(`migrations/${n}`));
  if (brk) await db.exec(brk);
  return db;
}

async function shapeResult(brk, shape) {
  const db = await database(brk);
  try {
    await db.query('INSERT INTO auth.users (id) VALUES ($1), ($2)', [A, B]);
    const home = (await db.query('SELECT id FROM public.pantry_households WHERE owner_id=$1', [A])).rows[0].id;
    const as = async id => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]); await db.exec('SET ROLE authenticated'); };
    await as(A);
    await db.exec(insert(P, home, 'Milk')); await db.exec(insert(S, home, 'Bread'));
    await as(B);
    try { const r = await db.query(shape(home)); return r.affectedRows || r.rows.length; } catch (e) { return `ERR ${e.code}`; }
  } finally { await db.close(); }
}

async function pgtapResult(brk, file) {
  const db = await database(brk);
  try {
    await db.exec('SET search_path TO public, extensions');
    const results = await db.exec(read(`tests/database/${file}`));
    const lines = results.flatMap(r => r.rows).flatMap(row => Object.values(row)).filter(v => typeof v === 'string');
    const tap = lines.flatMap(l => l.split('\n'));
    return { plan: tap.find(l => /^1\.\.\d+/.test(l)) ?? null, ok: tap.filter(l => /^ok /.test(l)).length, notOk: tap.filter(l => /^not ok /.test(l)), error: null };
  } catch (e) {
    return { plan: null, ok: 0, notOk: [], error: `${e.code ?? ''} ${e.message}`.trim() };
  } finally { await db.close(); }
}

(async () => {
  const version = await new PGlite().query('select version()');
  const out = { node: process.version, pglite: JSON.parse(fs.readFileSync(path.join(modules, 'node_modules/@electric-sql/pglite/package.json'), 'utf8')).version, server: version.rows[0].version, shapes: {}, pgtap: {} };
  console.log(`node ${out.node}, PGlite ${out.pglite}, ${out.server.split(' on ')[0]}`);
  console.log('\nPART 1: statement shapes (rows the other user sees or changes, or the error code)');
  let base;
  for (const [name, brk] of Object.entries(BREAKS)) {
    const row = {};
    for (const [key, shape] of Object.entries(SHAPES)) row[key] = await shapeResult(brk, shape);
    out.shapes[name] = row;
    if (name === 'none') { base = row; for (const [k, v] of Object.entries(row)) console.log(`  intact  ${k}: ${v}`); continue; }
    const noticed = Object.keys(row).filter(k => row[k] !== base[k]);
    console.log(`  ${name}: noticed by ${noticed.length ? noticed.map(k => `"${k}" (${base[k]} -> ${row[k]})`).join(', ') : 'NOTHING'}`);
  }
  console.log('\nPART 2: unmodified pgTAP files');
  for (const [name, brk] of Object.entries(BREAKS)) {
    out.pgtap[name] = {};
    for (const file of ['slice_1_1.test.sql', 'shopping.test.sql']) {
      const r = out.pgtap[name][file] = await pgtapResult(brk, file);
      console.log(`  ${name} | ${file}: plan ${r.plan}, ok ${r.ok}, not ok ${r.notOk.length}${r.error ? `, ERROR ${r.error}` : ''}${r.notOk.length ? ` -> ${r.notOk.join(' ; ')}` : ''}`);
    }
  }
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(out, null, 1) + '\n');
})();
