-- Supplement catalog-snapshot.sql with extra-object detection. Catalogs only.
-- The schema name is defined once in app; objects whose keys repeat across
-- sections are built from column aliases (KAN-27).
BEGIN READ ONLY;
WITH app AS (SELECT 'public'::name AS schema)
SELECT jsonb_build_object(
  'server_version', current_setting('server_version'),
  'migration_ledger_exists', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
  'relations', (SELECT jsonb_agg(to_jsonb(r) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN app CROSS JOIN LATERAL (SELECT c.relname AS name, c.relkind AS kind, pg_get_userbyid(c.relowner) AS owner,
      CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END AS definition) r
    WHERE n.nspname=app.schema AND c.relkind IN ('r','p','v','m','S','f')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')),
  'routines', (SELECT jsonb_agg(to_jsonb(r) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN app
    CROSS JOIN LATERAL (SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
      pg_get_userbyid(p.proowner) AS owner, to_jsonb(p.proacl) AS proacl, pg_get_functiondef(p.oid) AS definition) r
    WHERE n.nspname=app.schema AND p.prokind IN ('f','p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')),
  'types', (SELECT jsonb_agg(jsonb_build_object('name',t.typname,'kind',t.typtype)
    ORDER BY t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace CROSS JOIN app
    WHERE n.nspname=app.schema AND t.typtype IN ('e','d')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')),
  'triggers', (SELECT jsonb_agg(to_jsonb(r) ORDER BY n.nspname,c.relname,t.tgname)
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN app
    CROSS JOIN LATERAL (SELECT n.nspname AS "schema", c.relname AS "table", t.tgname AS name,
      pg_get_triggerdef(t.oid,true) AS definition, t.tgenabled AS enabled) r
    WHERE NOT t.tgisinternal
    AND (n.nspname=app.schema OR (n.nspname='auth' AND c.relname='users'))
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_trigger'::regclass AND d.objid=t.oid AND d.deptype='e')),
  'event_triggers', (SELECT jsonb_agg(jsonb_build_object('name',e.evtname,
    'event',e.evtevent,'enabled',e.evtenabled,'tags',e.evttags,
    'owner',pg_get_userbyid(e.evtowner),'function_schema',n.nspname,'function',p.proname)
    ORDER BY e.evtname) FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE NOT EXISTS (SELECT 1 FROM pg_depend d
      WHERE d.classid='pg_event_trigger'::regclass AND d.objid=e.oid AND d.deptype='e')),
  'uuid_extension', (SELECT jsonb_build_object('name',e.extname,'version',e.extversion,
    'schema',n.nspname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
    WHERE e.extname='uuid-ossp')
) AS snapshot;
COMMIT;
