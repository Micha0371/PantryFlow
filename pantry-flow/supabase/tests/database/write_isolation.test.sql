-- Bare writes isolate write authorization from SELECT policy enforcement.
-- Every assertion reads a known seeded row after RESET ROLE, never the write result.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(23);

CREATE TEMP TABLE rls_keys AS SELECT
  gen_random_uuid() AS actor, gen_random_uuid() AS stranger,
  gen_random_uuid() AS own_pantry, gen_random_uuid() AS foreign_pantry,
  gen_random_uuid() AS own_shopping, gen_random_uuid() AS foreign_shopping;
GRANT SELECT ON rls_keys TO authenticated;
INSERT INTO auth.users(id, email, raw_user_meta_data)
  SELECT actor, 'rls.actor@example.com', '{"name":"Own profile"}'::jsonb FROM rls_keys
  UNION ALL SELECT stranger, 'rls.stranger@example.com', '{"name":"Foreign profile"}'::jsonb FROM rls_keys;
CREATE TEMP TABLE rls_homes AS SELECT a.id AS own_home, b.id AS foreign_home
  FROM public.pantry_households a, public.pantry_households b, rls_keys k
  WHERE a.owner_id=k.actor AND b.owner_id=k.stranger;
GRANT SELECT ON rls_homes TO authenticated;
INSERT INTO public.pantry_items(id,household_id,name,created_by)
  SELECT own_pantry,own_home,'Own pantry',actor FROM rls_keys,rls_homes
  UNION ALL SELECT foreign_pantry,foreign_home,'Foreign pantry',stranger FROM rls_keys,rls_homes;
-- Manual shopping rows deliberately have no pantry FK: pantry deletion cannot erase them.
INSERT INTO public.pantry_shopping_items(id,household_id,name,created_by)
  SELECT own_shopping,own_home,'Own shopping',actor FROM rls_keys,rls_homes
  UNION ALL SELECT foreign_shopping,foreign_home,'Foreign shopping',stranger FROM rls_keys,rls_homes;
CREATE TEMP TABLE rls_before AS SELECT
  (SELECT to_jsonb(p) FROM public.pantry_items p WHERE p.id=k.foreign_pantry) AS pantry,
  (SELECT to_jsonb(s) FROM public.pantry_shopping_items s WHERE s.id=k.foreign_shopping) AS shopping,
  (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id=k.stranger) AS profile FROM rls_keys k;
ALTER TABLE rls_before ALTER COLUMN pantry SET NOT NULL,
  ALTER COLUMN shopping SET NOT NULL, ALTER COLUMN profile SET NOT NULL;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT actor::text FROM rls_keys),true);
SELECT lives_ok($$UPDATE public.pantry_items SET status='out'$$,'items_update_member: bare update accepted');
RESET ROLE;
SELECT is((SELECT status FROM public.pantry_items WHERE id=(SELECT own_pantry FROM rls_keys)),
  'out','items_update_member: own update persisted');
SELECT is((SELECT to_jsonb(p) FROM public.pantry_items p WHERE id=(SELECT foreign_pantry FROM rls_keys)),
  (SELECT pantry FROM rls_before),'items_update_member: foreign state unchanged');

-- Each operation compares with its own pre-write snapshot. A failed UPDATE
-- assertion must not masquerade as a later DELETE-policy detection.
UPDATE rls_before SET pantry=(SELECT to_jsonb(p) FROM public.pantry_items p
  WHERE id=(SELECT foreign_pantry FROM rls_keys));
SET LOCAL ROLE authenticated;
SELECT lives_ok($$DELETE FROM public.pantry_items$$,'items_delete_member: bare delete accepted');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.pantry_items WHERE id=(SELECT own_pantry FROM rls_keys)),
  0::bigint,'items_delete_member: own deletion persisted');
SELECT is((SELECT to_jsonb(p) FROM public.pantry_items p WHERE id=(SELECT foreign_pantry FROM rls_keys)),
  (SELECT pantry FROM rls_before),'items_delete_member: foreign state unchanged');

SET LOCAL ROLE authenticated;
SELECT lives_ok($$UPDATE public.pantry_shopping_items SET is_checked=true$$,'shopping_update_member: bare update accepted');
RESET ROLE;
SELECT ok((SELECT is_checked AND completed_at IS NOT NULL FROM public.pantry_shopping_items
  WHERE id=(SELECT own_shopping FROM rls_keys)),'shopping_update_member: own update persisted');
SELECT is((SELECT to_jsonb(s) FROM public.pantry_shopping_items s WHERE id=(SELECT foreign_shopping FROM rls_keys)),
  (SELECT shopping FROM rls_before),'shopping_update_member: foreign state unchanged');

UPDATE rls_before SET shopping=(SELECT to_jsonb(s) FROM public.pantry_shopping_items s
  WHERE id=(SELECT foreign_shopping FROM rls_keys));
SET LOCAL ROLE authenticated;
SELECT lives_ok($$DELETE FROM public.pantry_shopping_items$$,'shopping_delete_member: bare delete accepted');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.pantry_shopping_items WHERE id=(SELECT own_shopping FROM rls_keys)),
  0::bigint,'shopping_delete_member: own deletion persisted');
SELECT is((SELECT to_jsonb(s) FROM public.pantry_shopping_items s WHERE id=(SELECT foreign_shopping FROM rls_keys)),
  (SELECT shopping FROM rls_before),'shopping_delete_member: foreign state unchanged');

SET LOCAL ROLE authenticated;
SELECT lives_ok($$UPDATE public.profiles SET name='Updated profile'$$,'profiles_update_own: bare update accepted');
RESET ROLE;
SELECT is((SELECT name FROM public.profiles WHERE id=(SELECT actor FROM rls_keys)),
  'Updated profile','profiles_update_own: own update persisted');
SELECT is((SELECT to_jsonb(p) FROM public.profiles p WHERE id=(SELECT stranger FROM rls_keys)),
  (SELECT profile FROM rls_before),'profiles_update_own: foreign state unchanged');

SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
  SELECT own_home,'Own pantry insert',actor FROM rls_keys,rls_homes$$,'items_insert_member: own minimal insert accepted');
SELECT throws_ok($$INSERT INTO public.pantry_items(household_id,name,created_by)
  SELECT foreign_home,'Foreign pantry insert',actor FROM rls_keys,rls_homes$$,
  '42501',NULL,'items_insert_member: foreign minimal insert rejected');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.pantry_items WHERE created_by=(SELECT actor FROM rls_keys)
  AND name='Own pantry insert'),1::bigint,'items_insert_member: own insertion persisted');
SELECT is((SELECT count(*) FROM public.pantry_items WHERE household_id=(SELECT foreign_home FROM rls_homes)
  AND name='Foreign pantry insert'),0::bigint,'items_insert_member: foreign row absent');

SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
  SELECT own_home,'Own shopping insert',actor FROM rls_keys,rls_homes$$,'shopping_insert_member: own minimal insert accepted');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
  SELECT foreign_home,'Foreign shopping insert',actor FROM rls_keys,rls_homes$$,
  '42501',NULL,'shopping_insert_member: foreign minimal insert rejected');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.pantry_shopping_items WHERE created_by=(SELECT actor FROM rls_keys)
  AND name='Own shopping insert'),1::bigint,'shopping_insert_member: own insertion persisted');
SELECT is((SELECT count(*) FROM public.pantry_shopping_items WHERE household_id=(SELECT foreign_home FROM rls_homes)
  AND name='Foreign shopping insert'),0::bigint,'shopping_insert_member: foreign row absent');
SELECT * FROM finish();
ROLLBACK;
