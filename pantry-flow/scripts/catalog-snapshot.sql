-- Read-only application-schema evidence. No user rows or credentials selected.
-- The schema, table and role names are defined once in app; objects whose keys
-- repeat across sections are built from column aliases (KAN-27).
BEGIN READ ONLY;
WITH app AS (
  SELECT 'public'::name AS schema,
    ARRAY['profiles','pantry_households','pantry_household_members','pantry_items','pantry_shopping_items']::name[] AS tables,
    ARRAY['anon','authenticated']::name[] AS roles
), app_class AS (
  SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN app
  WHERE n.nspname=app.schema AND c.relname=ANY(app.tables)
)
SELECT jsonb_build_object(
  'public_tables', (SELECT jsonb_agg(c.relname ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN app WHERE n.nspname=app.schema AND c.relkind IN ('r','p')),
  'tables', (SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.relname) FROM app_class c),
  'columns', (SELECT jsonb_agg(to_jsonb(r) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN app_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum CROSS JOIN LATERAL (SELECT c.relname AS "table", a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null, pg_get_expr(d.adbin,d.adrelid) AS "default") r WHERE a.attnum>0 AND NOT a.attisdropped),
  'constraints', (SELECT jsonb_agg(to_jsonb(r) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN app_class c ON c.oid=k.conrelid CROSS JOIN LATERAL (SELECT c.relname AS "table", k.conname AS name, pg_get_constraintdef(k.oid,true) AS definition, k.convalidated AS validated) r),
  'indexes', (SELECT jsonb_agg(to_jsonb(r) ORDER BY c.relname,i.relname) FROM pg_index x JOIN app_class c ON c.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid CROSS JOIN LATERAL (SELECT c.relname AS "table", i.relname AS name, pg_get_indexdef(i.oid) AS definition, x.indisvalid AS valid, x.indisunique AS "unique") r),
  'policies', (SELECT jsonb_agg(to_jsonb(r) ORDER BY p.tablename,p.policyname) FROM pg_policies p CROSS JOIN app CROSS JOIN LATERAL (SELECT p.tablename AS "table", p.policyname AS name, p.roles AS roles, p.cmd AS command, p.permissive AS permissive, p.qual AS "using", p.with_check AS "check") r WHERE p.schemaname=app.schema AND p.tablename=ANY(app.tables)),
  'triggers', (SELECT jsonb_agg(to_jsonb(r) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN app CROSS JOIN LATERAL (SELECT n.nspname AS "schema", c.relname AS "table", t.tgname AS name, t.tgenabled AS enabled, pg_get_triggerdef(t.oid,true) AS definition) r WHERE NOT t.tgisinternal AND ((n.nspname=app.schema AND c.relname=ANY(app.tables)) OR (n.nspname='auth' AND c.relname='users' AND t.tgname='on_auth_user_created'))),
  'functions', (SELECT jsonb_agg(to_jsonb(r) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN app CROSS JOIN LATERAL (SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition, p.prosecdef AS security_definer, p.proconfig AS settings, has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute, has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute) r WHERE n.nspname=app.schema AND p.proname IN ('handle_new_user','handle_new_profile','set_pantry_item_updated_at','pantry_trim_item_name','normalize_pantry_item_name','prepare_shopping_item')),
  'table_privileges', (SELECT jsonb_agg(to_jsonb(r) ORDER BY ro.name::text,c.relname,v.name) FROM app_class c CROSS JOIN app CROSS JOIN unnest(app.roles) ro(name) CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(name) CROSS JOIN LATERAL (SELECT ro.name::text AS "role", c.relname AS "table", v.name AS privilege, has_table_privilege(ro.name,c.oid,v.name) AS allowed) r),
  'column_privileges', (SELECT jsonb_agg(to_jsonb(r) ORDER BY ro.name::text,c.relname,a.attname,v.name) FROM pg_attribute a JOIN app_class c ON c.oid=a.attrelid CROSS JOIN app CROSS JOIN unnest(app.roles) ro(name) CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) v(name) CROSS JOIN LATERAL (SELECT ro.name::text AS "role", c.relname AS "table", a.attname AS "column", v.name AS privilege, has_column_privilege(ro.name,c.oid,a.attname,v.name) AS allowed) r WHERE a.attnum>0 AND NOT a.attisdropped)
) AS snapshot;
COMMIT;
