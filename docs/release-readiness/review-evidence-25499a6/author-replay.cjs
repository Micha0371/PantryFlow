// Sanitized author evidence; SQL logic unchanged; see README.md.
// Assurance probe, 2026-11-24. In-memory PGlite only; reads the migrations, writes nothing.
// Breaks one RLS policy at a time and replays the statement shapes used by pgTAP, by supabase-js
// (.eq().select()), and a bare write without WHERE and RETURNING. Run: node replay.cjs
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.PANTRY_REVIEW_PROBE_ROOT;
if (!root || !fs.existsSync(path.join(root, '../.review-probe-disposable'))) throw new Error('Set PANTRY_REVIEW_PROBE_ROOT to a marked disposable clone');
const { PGlite } = require('node:module').createRequire(path.resolve(root, 'package.json'))('@electric-sql/pglite');
const A = '00000000-0000-0000-0000-000000000001', B = '00000000-0000-0000-0000-000000000002';
const sql = n => fs.readFileSync(path.join(root, 'supabase/migrations', n), 'utf8').replace(/\r\n/g, '\n');
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
  'API pantry insert RETURNING': h => insert(P, h, 'Foreign2', ' RETURNING *'),
  'API pantry update WHERE+RETURNING': h => `UPDATE ${P} SET name='Stolen' WHERE household_id='${h}' RETURNING *`,
  'API shopping insert RETURNING': h => insert(S, h, 'Foreign2', ' RETURNING *'),
  'API shopping update WHERE+RETURNING': h => `UPDATE ${S} SET name='Stolen' WHERE household_id='${h}' RETURNING *`,
  'API profile update WHERE+RETURNING': () => `UPDATE public.profiles SET name='Stolen' WHERE id='${A}' RETURNING *`,
  'BARE pantry update': () => `UPDATE ${P} SET status='low'`,
  'BARE pantry delete': () => `DELETE FROM ${P}`,
  'BARE shopping update': () => `UPDATE ${S} SET is_checked=true`,
  'BARE shopping delete': () => `DELETE FROM ${S}`,
  'BARE profile update': () => "UPDATE public.profiles SET language='de'",
};
async function attempt(brk, shape) {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated;
      CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;`);
    await db.exec(sql('00001_first_slice.sql').replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
    await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;');
    for (const n of ['00002_review_hardening.sql', '00003_strict_duplicate_prevention.sql', '00004_shopping_items.sql']) await db.exec(sql(n));
    if (brk) await db.exec(brk);
    await db.query('INSERT INTO auth.users (id) VALUES ($1), ($2)', [A, B]);
    const home = (await db.query('SELECT id FROM public.pantry_households WHERE owner_id=$1', [A])).rows[0].id;
    const as = async id => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]); await db.exec('SET ROLE authenticated'); };
    await as(A);
    await db.exec(insert(P, home, 'Milk')); await db.exec(insert(S, home, 'Bread'));
    await as(B);
    try { const r = await db.query(shape(home)); return r.affectedRows || r.rows.length; } catch (e) { return `ERR ${e.code}`; }
  } finally { await db.close(); }
}
(async () => {
  let base;
  for (const [name, brk] of Object.entries(BREAKS)) {
    const out = {};
    for (const [key, shape] of Object.entries(SHAPES)) out[key] = await attempt(brk, shape);
    if (name === 'none') { base = out; console.log('intact policies, rows seen or changed by the other user:', JSON.stringify(out, null, 1)); continue; }
    const noticed = Object.keys(out).filter(k => out[k] !== base[k]);
    console.log(`${name}: noticed by ${noticed.length ? noticed.map(k => `"${k}" (${base[k]} -> ${out[k]})`).join(', ') : 'NOTHING'}`);
  }
})();
