BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(43);

-- Fixture ids and expected error codes, defined once (KAN-27).
CREATE TEMP TABLE shopping_keys AS SELECT '00000000-0000-0000-0000-0000000000a2'::uuid AS alice,'00000000-0000-0000-0000-0000000000b2'::uuid AS bob,
 '23505'::text AS duplicate,'42501'::text AS denied;
GRANT SELECT ON shopping_keys TO authenticated, anon;
INSERT INTO auth.users(id,email)
 SELECT alice,'pgtap.shopping.a@example.com' FROM shopping_keys
 UNION ALL SELECT bob,'pgtap.shopping.b@example.com' FROM shopping_keys;
CREATE TEMP TABLE shopping_homes AS SELECT owner_id,id AS household_id
 FROM public.pantry_households WHERE owner_id IN
 (SELECT alice FROM shopping_keys UNION ALL SELECT bob FROM shopping_keys);
INSERT INTO public.pantry_items(household_id,name,status,created_by)
 SELECT household_id,'Pantry milk','low',owner_id FROM shopping_homes;
CREATE TEMP TABLE shopping_links AS SELECT h.*,p.id AS pantry_id
 FROM shopping_homes h JOIN public.pantry_items p USING(household_id);
GRANT SELECT ON shopping_links TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT alice::text FROM shopping_keys),true);
SELECT lives_ok($$INSERT INTO public.pantry_shopping_items(household_id,pantry_item_id,name,created_by)
 SELECT household_id,pantry_id,'  Milk  ',owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,'member creates linked item');
SELECT is((SELECT name FROM public.pantry_shopping_items),'Milk','name is trimmed');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'milk',owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,(SELECT duplicate FROM shopping_keys),NULL,'manual and linked names share open namespace');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'   ',owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,'23514',NULL,'blank rejected');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,repeat('x',121),owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,'23514',NULL,'overlong rejected');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,NULL,owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,'23502',NULL,'null name rejected');
SELECT lives_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'Milk  Fridge',owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,'double internal space remains distinct');
SELECT lives_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'Milk Fridge',owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,'single internal space remains distinct');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET name='milk' WHERE name='Milk Fridge'$$,(SELECT duplicate FROM shopping_keys),NULL,'duplicate rename rejected');
SELECT lives_ok($$UPDATE public.pantry_shopping_items SET is_checked=true WHERE name='Milk'$$,'complete succeeds');
SELECT ok((SELECT completed_at IS NOT NULL FROM public.pantry_shopping_items WHERE name='Milk'),'completion timestamp set');
SELECT lives_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'milk',owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,'completed name can be added again');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET is_checked=false WHERE name='Milk'$$,(SELECT duplicate FROM shopping_keys),NULL,'reopen into duplicate rejected');
SELECT ok((SELECT is_checked AND completed_at IS NOT NULL FROM public.pantry_shopping_items WHERE name='Milk'),'failed reopen preserves completion');
SELECT lives_ok($$DELETE FROM public.pantry_shopping_items WHERE name='milk'$$,'explicit delete succeeds');
SELECT lives_ok($$UPDATE public.pantry_shopping_items SET is_checked=false WHERE name='Milk'$$,'reopen after conflict removal succeeds');
SELECT ok((SELECT completed_at IS NULL FROM public.pantry_shopping_items WHERE name='Milk'),'reopen clears completion time');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,pantry_item_id,name,created_by)
 SELECT a.household_id,b.pantry_id,'Foreign link',auth.uid() FROM shopping_links a,shopping_links b
 WHERE a.owner_id=auth.uid() AND b.owner_id<>auth.uid()$$,'23503',NULL,'cross-household pantry link rejected');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'Foreign home',auth.uid() FROM shopping_links WHERE owner_id<>auth.uid()$$,(SELECT denied FROM shopping_keys),NULL,'foreign household insert denied');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'Forged',(SELECT bob FROM shopping_keys) FROM shopping_links WHERE owner_id=auth.uid()$$,(SELECT denied FROM shopping_keys),NULL,'forged creator denied');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'Null author',NULL FROM shopping_links WHERE owner_id=auth.uid()$$,(SELECT denied FROM shopping_keys),NULL,'null creator denied on creation');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET household_id=(SELECT bob FROM shopping_keys)$$,(SELECT denied FROM shopping_keys),NULL,'household immutable');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET created_by=auth.uid()$$,(SELECT denied FROM shopping_keys),NULL,'creator immutable');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET created_at=now()$$,(SELECT denied FROM shopping_keys),NULL,'creation time immutable');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET updated_at=now()$$,(SELECT denied FROM shopping_keys),NULL,'update time server managed');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET completed_at=now()$$,(SELECT denied FROM shopping_keys),NULL,'completion time server managed');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET id=gen_random_uuid()$$,(SELECT denied FROM shopping_keys),NULL,'identity immutable');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by,completed_at)
 SELECT household_id,'Forged time',auth.uid(),now() FROM shopping_links WHERE owner_id=auth.uid()$$,(SELECT denied FROM shopping_keys),NULL,'inserted completion timestamp denied');
SELECT throws_ok($$UPDATE public.pantry_shopping_items SET is_checked=NULL$$,'23502',NULL,'null completion flag denied');
SELECT is((SELECT status FROM public.pantry_items WHERE created_by=auth.uid()),'low','shopping operations do not change pantry state');
SELECT lives_ok($$DELETE FROM public.pantry_items WHERE created_by=auth.uid()$$,'pantry deletion succeeds');
SELECT ok((SELECT pantry_item_id IS NULL FROM public.pantry_shopping_items WHERE name='Milk'),'pantry deletion clears only link');
SELECT is((SELECT name FROM public.pantry_shopping_items WHERE name='Milk'),'Milk','independent name retained');
SELECT ok((SELECT household_id IS NOT NULL FROM public.pantry_shopping_items WHERE name='Milk'),'shopping household retained');

RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT * FROM public.pantry_shopping_items$$,(SELECT denied FROM shopping_keys),NULL,'anonymous reads denied');
SELECT throws_ok($$INSERT INTO public.pantry_shopping_items(name) VALUES('Anon')$$,(SELECT denied FROM shopping_keys),NULL,'anonymous insert denied');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT bob::text FROM shopping_keys),true);
SELECT is((SELECT count(*) FROM public.pantry_shopping_items),0::bigint,'foreign shopping invisible');
WITH changed AS (UPDATE public.pantry_shopping_items SET name='Stolen' RETURNING id)
 SELECT is((SELECT count(*) FROM changed),0::bigint,'foreign update touches zero');
WITH removed AS (DELETE FROM public.pantry_shopping_items RETURNING id)
 SELECT is((SELECT count(*) FROM removed),0::bigint,'foreign delete touches zero');
SELECT lives_ok($$INSERT INTO public.pantry_shopping_items(household_id,name,created_by)
 SELECT household_id,'Milk',owner_id FROM shopping_links WHERE owner_id=auth.uid()$$,'different household may use same name');
RESET ROLE;
UPDATE public.pantry_shopping_items SET created_by=(SELECT bob FROM shopping_keys)
 WHERE created_by=(SELECT alice FROM shopping_keys) AND name='Milk';
DELETE FROM auth.users WHERE id=(SELECT bob FROM shopping_keys);
SELECT ok((SELECT created_by IS NULL FROM public.pantry_shopping_items WHERE name='Milk'),'author deletion preserves shared item with null attribution');
SELECT is((SELECT count(*) FROM public.pantry_shopping_items),3::bigint,'owner deletion removes only its household items');
DELETE FROM public.pantry_households WHERE owner_id=(SELECT alice FROM shopping_keys);
SELECT is((SELECT count(*) FROM public.pantry_shopping_items),0::bigint,'household deletion cascades shopping items');
SELECT * FROM finish();
ROLLBACK;
