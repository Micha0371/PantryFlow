-- Fixtures for the populated-account deletion rehearsal (beta line B4), option 1b/2b of the request:
-- run ONCE in the hosted dashboard's SQL editor, after T and O were created in Authentication -> Users.
-- The two __PLACEHOLDERS__ are filled with the UUIDs of T and O; a placeholder left in place fails the cast.
-- Writes only test rows into the two fresh households, and refuses unless both accounts are fresh and distinct.
-- Item names are neutral test words. The final SELECT returns the ids that readback.sql needs.
BEGIN;
DO $$
DECLARE
  t uuid := '__TARGET_USER__';
  o uuid := '__OTHER_USER__';
  th uuid;
  oh uuid;
  p uuid;
BEGIN
  IF t = o THEN RAISE EXCEPTION 'T and O must be different accounts'; END IF;
  IF (SELECT count(*) FROM auth.users WHERE id IN (t, o)) <> 2 THEN RAISE EXCEPTION 'T or O does not exist'; END IF;
  SELECT id INTO STRICT th FROM public.pantry_households WHERE owner_id = t;
  SELECT id INTO STRICT oh FROM public.pantry_households WHERE owner_id = o;
  IF (SELECT count(*) FROM public.pantry_household_members WHERE household_id = th) <> 1
     OR (SELECT count(*) FROM public.pantry_household_members WHERE household_id = oh) <> 1 THEN
    RAISE EXCEPTION 'each fixture household must have exactly one member';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pantry_items WHERE household_id IN (th, oh))
     OR EXISTS (SELECT 1 FROM public.pantry_shopping_items WHERE household_id IN (th, oh)) THEN
    RAISE EXCEPTION 'fixture households must be empty before this script';
  END IF;
  INSERT INTO public.pantry_items (household_id, name, status, created_by) VALUES (th, 'Test milk', 'low', t) RETURNING id INTO p;
  INSERT INTO public.pantry_shopping_items (household_id, pantry_item_id, name, created_by) VALUES (th, p, 'Test milk', t);
  INSERT INTO public.pantry_shopping_items (household_id, name, created_by) VALUES (th, 'Test bread', t);
  INSERT INTO public.pantry_shopping_items (household_id, name, is_checked, created_by) VALUES (th, 'Test rice', true, t);
  INSERT INTO public.pantry_items (household_id, name, created_by) VALUES (oh, 'Test oats', o);
  INSERT INTO public.pantry_shopping_items (household_id, name, created_by) VALUES (oh, 'Test tea', o);
END $$;
COMMIT;
WITH p AS (SELECT '__TARGET_USER__'::uuid AS t, '__OTHER_USER__'::uuid AS o)
SELECT 'TARGET_USER' AS placeholder, p.t AS id FROM p
UNION ALL SELECT 'OTHER_USER', p.o FROM p
UNION ALL SELECT 'TARGET_HOUSEHOLD', h.id FROM public.pantry_households h, p WHERE h.owner_id = p.t
UNION ALL SELECT 'OTHER_HOUSEHOLD', h.id FROM public.pantry_households h, p WHERE h.owner_id = p.o
UNION ALL SELECT 'PANTRY_ITEM', i.id FROM public.pantry_items i JOIN public.pantry_households h ON h.id = i.household_id, p WHERE h.owner_id = p.t
UNION ALL SELECT 'LINKED_SHOPPING', s.id FROM public.pantry_shopping_items s JOIN public.pantry_households h ON h.id = s.household_id, p WHERE h.owner_id = p.t AND s.pantry_item_id IS NOT NULL
UNION ALL SELECT 'MANUAL_SHOPPING', s.id FROM public.pantry_shopping_items s JOIN public.pantry_households h ON h.id = s.household_id, p WHERE h.owner_id = p.t AND s.pantry_item_id IS NULL AND NOT s.is_checked
UNION ALL SELECT 'COMPLETED_SHOPPING', s.id FROM public.pantry_shopping_items s JOIN public.pantry_households h ON h.id = s.household_id, p WHERE h.owner_id = p.t AND s.is_checked;
