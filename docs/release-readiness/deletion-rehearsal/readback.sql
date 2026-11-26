-- Populated-account deletion rehearsal: read-back (beta line B4). Read-only; returns counts and hashes only.
-- Fill the eight __PLACEHOLDERS__ in a working copy, never in this file. A placeholder left in place makes
-- the query fail (invalid uuid), which is a stop condition. Run once before and once after the deletion;
-- evaluate.cjs compares the two outputs. Protocol: ../2026-11-26-populated-deletion-rehearsal-protocol.md
-- User ids are compared as text because Auth tables differ in column type (uuid or varchar).
BEGIN READ ONLY;
WITH p AS (
  SELECT '__TARGET_USER__'::uuid AS tu, '__TARGET_HOUSEHOLD__'::uuid AS th,
         '__OTHER_USER__'::uuid AS ou, '__OTHER_HOUSEHOLD__'::uuid AS oh,
         '__PANTRY_ITEM__'::uuid AS pi, '__LINKED_SHOPPING__'::uuid AS sl,
         '__MANUAL_SHOPPING__'::uuid AS sm, '__COMPLETED_SHOPPING__'::uuid AS sc
), checks(entity, scope, n) AS (
  -- Auth records of the target
  SELECT 'auth.users', 'target', (SELECT count(*) FROM auth.users, p WHERE id::text = p.tu::text)
  UNION ALL SELECT 'auth.identities', 'target', (SELECT count(*) FROM auth.identities, p WHERE user_id::text = p.tu::text)
  UNION ALL SELECT 'auth.sessions', 'target', (SELECT count(*) FROM auth.sessions, p WHERE user_id::text = p.tu::text)
  UNION ALL SELECT 'auth.refresh_tokens', 'target', (SELECT count(*) FROM auth.refresh_tokens, p WHERE user_id::text = p.tu::text)
  UNION ALL SELECT 'auth.mfa_factors', 'target', (SELECT count(*) FROM auth.mfa_factors, p WHERE user_id::text = p.tu::text)
  UNION ALL SELECT 'auth.one_time_tokens', 'target', (SELECT count(*) FROM auth.one_time_tokens, p WHERE user_id::text = p.tu::text)
  UNION ALL SELECT 'auth.flow_state', 'target', (SELECT count(*) FROM auth.flow_state, p WHERE user_id::text = p.tu::text)
  -- Application records of the target
  UNION ALL SELECT 'public.profiles', 'target', (SELECT count(*) FROM public.profiles, p WHERE id = p.tu)
  UNION ALL SELECT 'public.pantry_households', 'target', (SELECT count(*) FROM public.pantry_households, p WHERE id = p.th OR owner_id = p.tu)
  UNION ALL SELECT 'public.pantry_household_members', 'target', (SELECT count(*) FROM public.pantry_household_members, p WHERE user_id = p.tu OR household_id = p.th)
  UNION ALL SELECT 'public.pantry_items', 'target', (SELECT count(*) FROM public.pantry_items, p WHERE household_id = p.th)
  UNION ALL SELECT 'public.pantry_shopping_items', 'target', (SELECT count(*) FROM public.pantry_shopping_items, p WHERE household_id = p.th)
  UNION ALL SELECT 'attributed_elsewhere', 'target', (SELECT count(*) FROM p, (
    SELECT created_by, household_id FROM public.pantry_items
    UNION ALL SELECT created_by, household_id FROM public.pantry_shopping_items) a
    WHERE a.created_by = p.tu AND a.household_id <> p.th)
  -- The four fixture rows by id, and the relationships they must have before the deletion
  UNION ALL SELECT 'fixture.pantry_item', 'target', (SELECT count(*) FROM public.pantry_items, p WHERE id = p.pi AND household_id = p.th)
  UNION ALL SELECT 'fixture.linked_shopping', 'target', (SELECT count(*) FROM public.pantry_shopping_items, p WHERE id = p.sl AND household_id = p.th AND pantry_item_id = p.pi AND NOT is_checked)
  UNION ALL SELECT 'fixture.manual_shopping', 'target', (SELECT count(*) FROM public.pantry_shopping_items, p WHERE id = p.sm AND household_id = p.th AND pantry_item_id IS NULL AND NOT is_checked)
  UNION ALL SELECT 'fixture.completed_shopping', 'target', (SELECT count(*) FROM public.pantry_shopping_items, p WHERE id = p.sc AND household_id = p.th AND is_checked AND completed_at IS NOT NULL)
  UNION ALL SELECT 'fixture.fixture_rows_anywhere', 'target', (SELECT count(*) FROM p, (
    SELECT id FROM public.pantry_items UNION ALL SELECT id FROM public.pantry_shopping_items) r
    WHERE r.id IN (p.pi, p.sl, p.sm, p.sc))
  -- Preconditions: the target household has exactly one member, the target
  UNION ALL SELECT 'precondition.target_household_members', 'target', (SELECT count(*) FROM public.pantry_household_members, p WHERE household_id = p.th)
  UNION ALL SELECT 'precondition.target_memberships', 'target', (SELECT count(*) FROM public.pantry_household_members, p WHERE user_id = p.tu)
  -- The unrelated account must be complete and unchanged
  UNION ALL SELECT 'auth.users', 'other', (SELECT count(*) FROM auth.users, p WHERE id::text = p.ou::text)
  UNION ALL SELECT 'public.profiles', 'other', (SELECT count(*) FROM public.profiles, p WHERE id = p.ou)
  UNION ALL SELECT 'public.pantry_households', 'other', (SELECT count(*) FROM public.pantry_households, p WHERE id = p.oh AND owner_id = p.ou)
  UNION ALL SELECT 'public.pantry_household_members', 'other', (SELECT count(*) FROM public.pantry_household_members, p WHERE household_id = p.oh)
  UNION ALL SELECT 'public.pantry_items', 'other', (SELECT count(*) FROM public.pantry_items, p WHERE household_id = p.oh)
  UNION ALL SELECT 'public.pantry_shopping_items', 'other', (SELECT count(*) FROM public.pantry_shopping_items, p WHERE household_id = p.oh)
  -- Everything outside the two fixture accounts (other projects' users, if any, must not change)
  UNION ALL SELECT 'auth.users', 'rest', (SELECT count(*) FROM auth.users, p WHERE id::text NOT IN (p.tu::text, p.ou::text))
  UNION ALL SELECT 'public.pantry_households', 'rest', (SELECT count(*) FROM public.pantry_households, p WHERE id NOT IN (p.th, p.oh))
  UNION ALL SELECT 'public.pantry_items', 'rest', (SELECT count(*) FROM public.pantry_items, p WHERE household_id NOT IN (p.th, p.oh))
  UNION ALL SELECT 'public.pantry_shopping_items', 'rest', (SELECT count(*) FROM public.pantry_shopping_items, p WHERE household_id NOT IN (p.th, p.oh))
), digests(entity, scope, digest) AS (
  -- Hashes of the unrelated account's rows: any change to them changes the hash; no content is returned.
  SELECT 'public.profiles', 'other', (SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM public.profiles t, p WHERE t.id = p.ou)
  UNION ALL SELECT 'public.pantry_households', 'other', (SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM public.pantry_households t, p WHERE t.id = p.oh)
  UNION ALL SELECT 'public.pantry_household_members', 'other', (SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM public.pantry_household_members t, p WHERE t.household_id = p.oh)
  UNION ALL SELECT 'public.pantry_items', 'other', (SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM public.pantry_items t, p WHERE t.household_id = p.oh)
  UNION ALL SELECT 'public.pantry_shopping_items', 'other', (SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM public.pantry_shopping_items t, p WHERE t.household_id = p.oh)
)
SELECT entity, scope, n::text AS value FROM checks
UNION ALL SELECT entity, scope || '.digest', digest FROM digests
ORDER BY 1, 2;
ROLLBACK;
