-- EXPERIMENTAL PROTOTYPE, NOT A MIGRATION.
-- Feasibility verification round 2 (2026-11-19) of the account-deletion spec v0.8.1, applied only to the disposable
-- local stack pf-fv2-20261119. Kept as evidence; an implementation migration must be written and reviewed separately.

-- EXPERIMENTAL (round 2, project pf-fv2-20261119). Not a repository migration.
-- Implements account-deletion spec v0.8.1 sections 2, 4.2, 5.1 as literally as SQL allows.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.account_deletion_requests (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('pending','fenced')),
  request_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ticket uuid,
  attempts_window_start timestamptz,
  attempts int
);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.account_deletion_admission (
  id int PRIMARY KEY CHECK (id = 1),
  paused boolean NOT NULL DEFAULT false
);
ALTER TABLE public.account_deletion_admission ENABLE ROW LEVEL SECURITY;
INSERT INTO public.account_deletion_admission (id, paused) VALUES (1, false);

-- Supabase default privileges grant everything on new public objects to anon/authenticated/service_role: revoke, then service_role only.
REVOKE ALL ON public.account_deletion_requests, public.account_deletion_admission FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_deletion_requests, public.account_deletion_admission TO service_role;

-- ISSUE_TICKET: fence-in-transaction for stale pending, then new ticket
CREATE FUNCTION private.issue_ticket(p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v_paused boolean; r record; v_ticket uuid;
BEGIN
  SELECT paused INTO v_paused FROM public.account_deletion_admission WHERE id = 1 FOR SHARE;
  IF v_paused THEN RAISE EXCEPTION 'PF_DELETION_PAUSED'; END IF;
  SELECT state, request_id, started_at INTO r FROM public.account_deletion_requests WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.account_deletion_requests (user_id, state, request_id, started_at, ticket)
      VALUES (p_user, 'fenced', gen_random_uuid(), now(), NULL);
  ELSIF r.state = 'pending' AND r.started_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'PF_DELETION_IN_PROGRESS';
  ELSIF r.state = 'pending' THEN
    UPDATE public.account_deletion_requests SET state = 'fenced', request_id = gen_random_uuid(), ticket = NULL WHERE user_id = p_user;
  END IF;
  v_ticket := gen_random_uuid();
  UPDATE public.account_deletion_requests SET ticket = v_ticket WHERE user_id = p_user;
  RETURN v_ticket;
END $f$;

-- ADMIT
CREATE FUNCTION private.admit(p_user uuid, p_ticket uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v_paused boolean; r record; v_req uuid;
BEGIN
  SELECT paused INTO v_paused FROM public.account_deletion_admission WHERE id = 1 FOR SHARE;
  IF v_paused THEN RAISE EXCEPTION 'PF_DELETION_MAINTENANCE'; END IF;
  SELECT state, request_id, ticket, attempts, attempts_window_start INTO r
    FROM public.account_deletion_requests WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PF_DELETION_REAUTHENTICATE'; END IF;
  IF r.attempts_window_start IS NOT NULL AND r.attempts_window_start > now() - interval '24 hours' AND r.attempts >= 5 THEN
    RAISE EXCEPTION 'PF_DELETION_RATE_LIMITED';
  END IF;
  IF r.state = 'pending' THEN RAISE EXCEPTION 'PF_DELETION_IN_PROGRESS'; END IF;
  IF r.state <> 'fenced' OR r.ticket IS NULL OR p_ticket IS NULL OR r.ticket <> p_ticket THEN
    RAISE EXCEPTION 'PF_DELETION_REAUTHENTICATE';
  END IF;
  v_req := gen_random_uuid();
  UPDATE public.account_deletion_requests SET state = 'pending', request_id = v_req, started_at = now(), ticket = NULL,
    attempts = CASE WHEN attempts_window_start IS NULL OR attempts_window_start <= now() - interval '24 hours' THEN 1 ELSE coalesce(attempts,0) + 1 END,
    attempts_window_start = CASE WHEN attempts_window_start IS NULL OR attempts_window_start <= now() - interval '24 hours' THEN now() ELSE attempts_window_start END
  WHERE user_id = p_user;
  RETURN v_req;
END $f$;

-- FENCE: returns previous request_id (null if no row). SELECT..FOR UPDATE first because INSERT..ON CONFLICT cannot RETURN the old value.
CREATE FUNCTION private.fence(p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v_prev uuid;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  SELECT request_id INTO v_prev FROM public.account_deletion_requests WHERE user_id = p_user FOR UPDATE;
  INSERT INTO public.account_deletion_requests (user_id, state, request_id, started_at, ticket)
    VALUES (p_user, 'fenced', gen_random_uuid(), now(), NULL)
  ON CONFLICT (user_id) DO UPDATE SET state = 'fenced', request_id = gen_random_uuid(), ticket = NULL;
  RETURN v_prev;
END $f$;

-- DELETE (spec 4.2)
CREATE FUNCTION private.delete_own_account(p_user uuid, p_request uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v_paused boolean; r record; v_h uuid; v_n int; v_hn int; v_ok boolean;
BEGIN
  SELECT paused INTO v_paused FROM public.account_deletion_admission WHERE id = 1 FOR SHARE;
  IF v_paused THEN RAISE EXCEPTION 'PF_DELETION_PAUSED'; END IF;
  SELECT state, request_id INTO r FROM public.account_deletion_requests WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND OR r.state <> 'pending' OR r.request_id <> p_request THEN RAISE EXCEPTION 'PF_DELETION_STALE'; END IF;
  PERFORM 1 FROM auth.users WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PF_DELETION_GONE'; END IF;
  PERFORM id FROM public.pantry_households WHERE owner_id = p_user ORDER BY id FOR UPDATE;
  PERFORM id FROM public.pantry_household_members
    WHERE household_id IN (SELECT id FROM public.pantry_households WHERE owner_id = p_user) OR user_id = p_user ORDER BY id FOR UPDATE;
  -- G1
  SELECT count(*) INTO v_n FROM public.pantry_households WHERE owner_id = p_user;
  IF v_n = 0 THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'no_household'; END IF;
  IF v_n > 1 THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'multiple_households'; END IF;
  SELECT id INTO v_h FROM public.pantry_households WHERE owner_id = p_user;
  -- G2
  SELECT count(*) INTO v_hn FROM public.pantry_household_members WHERE household_id = v_h;
  IF v_hn <> 1 THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'extra_members'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.pantry_household_members WHERE household_id = v_h AND user_id = p_user AND role = 'owner') INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'membership_mismatch'; END IF;
  -- G3
  SELECT EXISTS (SELECT 1 FROM public.pantry_household_members WHERE user_id = p_user AND household_id = v_h) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'membership_mismatch'; END IF;
  -- G4
  IF EXISTS (SELECT 1 FROM public.pantry_items WHERE created_by = p_user AND household_id <> v_h)
     OR EXISTS (SELECT 1 FROM public.pantry_shopping_items WHERE created_by = p_user AND household_id <> v_h) THEN
    RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'foreign_attribution';
  END IF;
  PERFORM set_config('pf.deletion_request', p_request::text, true);
  DELETE FROM auth.users WHERE id = p_user;
  RETURN 'deleted';
END $f$;

-- Backstop trigger function (SECURITY DEFINER so the auth admin role need not read the public table)
CREATE FUNCTION private.pf_guard_account_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE r record;
BEGIN
  SELECT state, request_id INTO r FROM public.account_deletion_requests WHERE user_id = OLD.id;
  IF NOT FOUND THEN RETURN OLD; END IF;
  IF r.state = 'pending' AND current_setting('pf.deletion_request', true) = r.request_id::text THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'PF_DELETION_USE_FUNCTION';
END $f$;
CREATE TRIGGER pf_guard_account_deletion BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.pf_guard_account_deletion();

-- Public SECURITY INVOKER wrappers
CREATE FUNCTION public.pf_deletion_issue_ticket(p_user uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.issue_ticket(p_user) $f$;
CREATE FUNCTION public.pf_deletion_admit(p_user uuid, p_ticket uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.admit(p_user, p_ticket) $f$;
CREATE FUNCTION public.pf_deletion_fence(p_user uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.fence(p_user) $f$;
CREATE FUNCTION public.pf_delete_own_account(p_user uuid, p_request uuid) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.delete_own_account(p_user, p_request) $f$;

-- Grants: functions
REVOKE ALL ON FUNCTION private.issue_ticket(uuid), private.admit(uuid,uuid), private.fence(uuid), private.delete_own_account(uuid,uuid),
  private.pf_guard_account_deletion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pf_deletion_issue_ticket(uuid), public.pf_deletion_admit(uuid,uuid), public.pf_deletion_fence(uuid),
  public.pf_delete_own_account(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.issue_ticket(uuid), private.admit(uuid,uuid), private.fence(uuid), private.delete_own_account(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pf_deletion_issue_ticket(uuid), public.pf_deletion_admit(uuid,uuid), public.pf_deletion_fence(uuid),
  public.pf_delete_own_account(uuid,uuid) TO service_role;
