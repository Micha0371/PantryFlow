// Review evidence only: execute committed pgTAP SQL unchanged in memory.
// No network, hosted writes, product file writes or new product tests.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const req = require('node:module').createRequire(path.join(root, 'pantry-flow/package.json'));
const {PGlite} = req('@electric-sql/pglite');
const {pgtap} = req('@electric-sql/pglite/pgtap');
const sha = '25499a656c1e419883d95b6e9ade8cd0fa4fc791';
const read = file => execFileSync('git', ['show', `${sha}:pantry-flow/supabase/${file}`], {cwd:root,encoding:'utf8'});
const migrations = ['00001_first_slice.sql','00002_review_hardening.sql','00003_strict_duplicate_prevention.sql','00004_shopping_items.sql'].map(n=>read(`migrations/${n}`));
const cases = [
  ['intact'],
  ['items_update_member','pantry_items','UPDATE'],
  ['items_delete_member','pantry_items','DELETE'],
  ['shopping_update_member','pantry_shopping_items','UPDATE'],
  ['shopping_delete_member','pantry_shopping_items','DELETE'],
  ['profiles_update_own','profiles','UPDATE'],
];
(async()=>{
  for(const [policy,table,op] of cases) {
    for(const [file,count] of [['slice_1_1.test.sql',21],['shopping.test.sql',43]]) {
      const db=new PGlite({extensions:{pgtap}});
      try {
        await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA extensions;
          CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
          CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
          $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
          GRANT USAGE ON SCHEMA auth,extensions,public TO anon,authenticated;
          CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;`);
        await db.exec(migrations[0].replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',''));
        await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated');
        for(const m of migrations.slice(1)) await db.exec(m);
        if(policy!=='intact') await db.exec(`DROP POLICY ${policy} ON public.${table};
          CREATE POLICY ${policy} ON public.${table} FOR ${op} TO authenticated USING(true)
          ${op==='UPDATE'?'WITH CHECK(true)':''}`);
        await db.exec('SET search_path TO public,extensions');
        const sql=read(`tests/database/${file}`);
        const results=await db.exec(sql);
        const lines=results.flatMap(r=>r.rows).flatMap(Object.values).filter(x=>typeof x==='string').flatMap(x=>x.split('\n'));
        const ok=lines.filter(l=>/^ok /.test(l));const bad=lines.filter(l=>/^not ok |^Bail out!|^# Looks like/.test(l));
        assert.ok(lines.includes(`1..${count}`));assert.equal(ok.length,count);assert.deepEqual(bad,[]);
        console.log(JSON.stringify({commit:sha,policy,file,sourceSha256:createHash('sha256').update(sql).digest('hex'),plan:count,passed:ok.length,failed:bad.length,limit:'Unmodified pgTAP SQL in PGlite, not a Supabase server/API mutant suite'}));
      } finally {await db.close();}
    }
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
