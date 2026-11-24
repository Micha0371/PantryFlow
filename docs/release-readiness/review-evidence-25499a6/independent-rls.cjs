// Review-only, no network, no product edits. Run from repository root:
// node docs/release-readiness/review-evidence-25499a6/independent-rls.cjs
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const req = require('node:module').createRequire(path.join(root, 'pantry-flow/package.json'));
const { PGlite } = req('@electric-sql/pglite');
const commit = '25499a656c1e419883d95b6e9ade8cd0fa4fc791';
const read = p => execFileSync('git', ['show', `${commit}:pantry-flow/${p}`], { cwd: root, encoding: 'utf8' });
const names = ['00001_first_slice.sql', '00002_review_hardening.sql', '00003_strict_duplicate_prevention.sql', '00004_shopping_items.sql'];
const migrations = names.map(n => read(`supabase/migrations/${n}`));
const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const cases = [
  ['items_update_member', 'pantry_items', 'UPDATE', "status='out'", 'status'],
  ['items_delete_member', 'pantry_items', 'DELETE'],
  ['shopping_update_member', 'pantry_shopping_items', 'UPDATE', 'is_checked=true', 'is_checked'],
  ['shopping_delete_member', 'pantry_shopping_items', 'DELETE'],
  ['profiles_update_own', 'profiles', 'UPDATE', "language='de'", 'language'],
];
async function build() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated;
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;`);
  await db.exec(migrations[0].replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
  await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated');
  for (const m of migrations.slice(1)) await db.exec(m);
  await db.query('INSERT INTO auth.users(id) VALUES ($1),($2)', [A, B]);
  for (const t of ['pantry_items', 'pantry_shopping_items']) {
    await db.exec(`INSERT INTO public.${t}(household_id,name,created_by)
      SELECT id,CASE owner_id WHEN '${A}'::uuid THEN 'Alice item' ELSE 'Bob item' END,owner_id
      FROM public.pantry_households`);
  }
  return db;
}
async function replay() {
  const db = await build();
  try {
    console.log(JSON.stringify({commit, node:process.version, postgres:(await db.query('SELECT version() v')).rows[0].v}));
    for (const [policy, table, op, set, column] of cases) {
      for (const mode of ['intact', 'open', 'absent']) {
        const outcomes = {};
        for (const shape of ['filtered-returning', 'bare']) {
          await db.exec('BEGIN');
          try {
            if (mode !== 'intact') await db.exec(`DROP POLICY ${policy} ON public.${table}`);
            if (mode === 'open') await db.exec(`CREATE POLICY ${policy} ON public.${table}
              FOR ${op} TO authenticated USING(true) ${op === 'UPDATE' ? 'WITH CHECK(true)' : ''}`);
            const victim = (await db.query(`SELECT id${column ? `,${column}` : ''} FROM public.${table}
              WHERE ${table === 'profiles' ? 'id' : 'created_by'}=$1`, [A])).rows[0];
            await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [B]);
            await db.exec('SET LOCAL ROLE authenticated');
            const sql = `${op === 'UPDATE' ? `UPDATE public.${table} SET ${set}` : `DELETE FROM public.${table}`}
              ${shape === 'filtered-returning' ? `WHERE id='${victim.id}' RETURNING id` : ''}`;
            const result = await db.query(sql);
            await db.exec('RESET ROLE');
            // Check the victim as administrator: an empty client result alone proves nothing.
            const after = (await db.query(`SELECT * FROM public.${table} WHERE id=$1`, [victim.id])).rows[0];
            const changed = op === 'DELETE' ? !after : after[column] !== victim[column];
            const expected = mode === 'open' && shape === 'bare';
            assert.equal(changed, expected, `${policy}/${mode}/${shape}`);
            if (shape === 'filtered-returning') assert.equal(result.rows.length, 0);
            outcomes[shape] = {affected:result.affectedRows, returned:result.rows.length, foreignChanged:changed};
          } finally { await db.exec('ROLLBACK'); }
        }
        console.log(JSON.stringify({policy,mode,...outcomes}));
      }
    }
    // RETURNING masks an opened INSERT household check; no RETURNING exposes it.
    for (const table of ['pantry_items', 'pantry_shopping_items']) {
      for (const returning of [false,true]) {
        await db.exec('BEGIN');
        let code, affected;
        try {
          const policy = table === 'pantry_items' ? 'items_insert_member' : 'shopping_insert_member';
          await db.exec(`DROP POLICY ${policy} ON public.${table}; CREATE POLICY ${policy} ON public.${table}
            FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid())`);
          const home = (await db.query('SELECT id FROM public.pantry_households WHERE owner_id=$1',[A])).rows[0].id;
          await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[B]);
          await db.exec('SET LOCAL ROLE authenticated');
          try { affected = (await db.query(`INSERT INTO public.${table}(household_id,name,created_by)
            VALUES('${home}','Intruder','${B}') ${returning ? 'RETURNING *' : ''}`)).affectedRows; }
          catch(e) { code=e.code; }
          assert.equal(returning ? code : affected, returning ? '42501' : 1);
          console.log(JSON.stringify({insert:table,returning,code,affected}));
        } finally { await db.exec('ROLLBACK'); }
      }
    }
  } finally { await db.close(); }
}
function existingTests() {
  // Copy only committed inputs into OS temp; leave the checkout untouched.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pantryflow-rls-review-'));
  fs.mkdirSync(path.join(dir,'tests'));
  fs.mkdirSync(path.join(dir,'supabase/migrations'),{recursive:true});
  fs.writeFileSync(path.join(dir,'tests/database.test.cjs'),read('tests/database.test.cjs'));
  const env={...process.env,NODE_PATH:path.join(root,'pantry-flow/node_modules')};
  for (const mode of ['intact','items_update_member','items_delete_member']) {
    names.forEach((n,i)=>{
      let sql=migrations[i];
      if (i===0 && mode!=='intact') {
        const start=sql.indexOf(`CREATE POLICY "${mode}"`);
        const end=sql.indexOf(';',start);
        const statement=sql.slice(start,end);
        sql=sql.slice(0,start)+statement.slice(0,statement.indexOf('USING ('))+'USING (true)'+sql.slice(end);
      }
      fs.writeFileSync(path.join(dir,'supabase/migrations',n),sql);
    });
    const run=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/database.test.cjs'],{cwd:dir,env,encoding:'utf8',timeout:120000});
    fs.writeFileSync(path.join(__dirname,`database-${mode}.tap`),run.stdout+(run.stderr||''));
    console.log(JSON.stringify({existingDatabaseTests:mode,exit:run.status,summary:run.stdout.split(/\r?\n/).filter(l=>/^# (tests|pass|fail|skipped)/.test(l))}));
    assert.equal(run.status,0,run.error?.message||run.stderr);
  }
  console.log('All independent assertions passed. Disposable committed-input copy retained at '+dir);
}
replay().then(existingTests).catch(e=>{console.error(e);process.exitCode=1;});
