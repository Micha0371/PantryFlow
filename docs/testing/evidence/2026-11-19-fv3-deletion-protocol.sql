-- EXPERIMENTAL PROTOTYPE, NOT A MIGRATION.
-- Feasibility verification round 3 (2026-11-19) of the account-deletion spec v0.11.1, applied only to the disposable
-- local stack pf-fv3-20261119. Updated from the round-2 prototype (v0.8.1). Kept as evidence only.
-- Changes vs round 2: ENSURE_ROW first step; FENCE_ALL/FENCE_OWN do not read the barrier; uniform PF_DELETION_PAUSED
-- (no MAINTENANCE); public.pf_deletion_fence_own; no GONE branch; SQL outcome helper (private.pf_outcome).
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

REVOKE ALL ON public.account_deletion_requests, public.account_deletion_admission FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_deletion_requests, public.account_deletion_admission TO service_role;

-- ENSURE_ROW(U): insert-if-missing (a missing user violates the FK -> 23503), then lock the row; returns the values
-- actually present and whether this transaction created the row.
CREATE FUNCTION private.ensure_row(p_user uuid, OUT created boolean, OUT request_id uuid, OUT state text,
                                   OUT started_at timestamptz, OUT ticket uuid, OUT attempts int, OUT attempts_window_start timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v_ins uuid;
BEGIN
  INSERT INTO public.account_deletion_requests AS t (user_id, state, request_id, started_at, ticket)
    VALUES (p_user, 'fenced', gen_random_uuid(), now(), NULL)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING t.user_id INTO v_ins;
  created := (v_ins IS NOT NULL);
  SELECT t.request_id, t.state, t.started_at, t.ticket, t.attempts, t.attempts_window_start
    INTO request_id, state, started_at, ticket, attempts, attempts_window_start
    FROM public.account_deletion_requests t WHERE t.user_id = p_user FOR UPDATE;
END $f$;

-- ISSUE_TICKET: behind the barrier
CREATE FUNCTION private.issue_ticket(p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v_paused boolean; r record; v_ticket uuid;
BEGIN
  SELECT paused INTO v_paused FROM public.account_deletion_admission WHERE id = 1 FOR SHARE;
  IF v_paused THEN RAISE EXCEPTION 'PF_DELETION_PAUSED'; END IF;
  SELECT * INTO r FROM private.ensure_row(p_user);
  IF r.state = 'pending' AND r.started_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'PF_DELETION_IN_PROGRESS';
  ELSIF r.state = 'pending' THEN
    UPDATE public.account_deletion_requests SET state = 'fenced', request_id = gen_random_uuid(), ticket = NULL WHERE user_id = p_user;
  END IF;
  v_ticket := gen_random_uuid();
  UPDATE public.account_deletion_requests SET ticket = v_ticket WHERE user_id = p_user;
  RETURN v_ticket;
END $f$;

-- ADMIT: behind the barrier
CREATE FUNCTION private.admit(p_user uuid, p_ticket uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v_paused boolean; r record; v_req uuid;
BEGIN
  SELECT paused INTO v_paused FROM public.account_deletion_admission WHERE id = 1 FOR SHARE;
  IF v_paused THEN RAISE EXCEPTION 'PF_DELETION_PAUSED'; END IF;
  SELECT * INTO r FROM private.ensure_row(p_user);
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

-- FENCE_ALL: does NOT read or wait for the barrier. Returns the previous generation (NULL if ENSURE_ROW created the row).
CREATE FUNCTION private.fence(p_user uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE r record;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  SELECT * INTO r FROM private.ensure_row(p_user);
  UPDATE public.account_deletion_requests SET state = 'fenced', request_id = gen_random_uuid(), ticket = NULL WHERE user_id = p_user;
  IF r.created THEN RETURN NULL; END IF;
  RETURN r.request_id;
END $f$;

-- FENCE_OWN(U, g): does NOT read the barrier. 'gone' | 'fenced_own' | 'superseded'
CREATE FUNCTION private.fence_own(p_user uuid, p_request uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE r record;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  SELECT request_id, state INTO r FROM public.account_deletion_requests WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN 'gone'; END IF;
  IF r.request_id = p_request AND r.state = 'pending' THEN
    UPDATE public.account_deletion_requests SET state = 'fenced', request_id = gen_random_uuid(), ticket = NULL WHERE user_id = p_user;
    RETURN 'fenced_own';
  END IF;
  RETURN 'superseded';
END $f$;

-- DELETE (spec 4.2, v0.11.1: no GONE branch)
CREATE FUNCTION private.delete_own_account(p_user uuid, p_request uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
DECLARE v_paused boolean; r record; v_h uuid; v_n int; v_hn int; v_ok boolean;
BEGIN
  SELECT paused INTO v_paused FROM public.account_deletion_admission WHERE id = 1 FOR SHARE;
  IF v_paused THEN RAISE EXCEPTION 'PF_DELETION_PAUSED'; END IF;
  SELECT state, request_id INTO r FROM public.account_deletion_requests WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND OR r.state <> 'pending' OR r.request_id <> p_request THEN RAISE EXCEPTION 'PF_DELETION_STALE'; END IF;
  PERFORM 1 FROM auth.users WHERE id = p_user FOR UPDATE;
  PERFORM id FROM public.pantry_households WHERE owner_id = p_user ORDER BY id FOR UPDATE;
  PERFORM id FROM public.pantry_household_members
    WHERE household_id IN (SELECT id FROM public.pantry_households WHERE owner_id = p_user) OR user_id = p_user ORDER BY id FOR UPDATE;
  SELECT count(*) INTO v_n FROM public.pantry_households WHERE owner_id = p_user;
  IF v_n = 0 THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'no_household'; END IF;
  IF v_n > 1 THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'multiple_households'; END IF;
  SELECT id INTO v_h FROM public.pantry_households WHERE owner_id = p_user;
  SELECT count(*) INTO v_hn FROM public.pantry_household_members WHERE household_id = v_h;
  IF v_hn <> 1 THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'extra_members'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.pantry_household_members WHERE household_id = v_h AND user_id = p_user AND role = 'owner') INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'membership_mismatch'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.pantry_household_members WHERE user_id = p_user AND household_id = v_h) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'membership_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.pantry_items WHERE created_by = p_user AND household_id <> v_h)
     OR EXISTS (SELECT 1 FROM public.pantry_shopping_items WHERE created_by = p_user AND household_id <> v_h) THEN
    RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = 'foreign_attribution';
  END IF;
  PERFORM set_config('pf.deletion_request', p_request::text, true);
  DELETE FROM auth.users WHERE id = p_user;
  RETURN 'deleted';
END $f$;

-- Backstop trigger
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

-- OUTCOME HELPER (spec 5.1 mapping + generation/account outcome rule). Pure function over observed facts.
--   p_event : 'deleted' (g's RPC returned 'deleted') | 'stale' | 'ineligible' | 'paused' | 'other' (timeout, 57014, reset, 5xx, unparsable)
--             | 'replaced' (status/takeover/operator replaced generation p while the row existed)
--             | 'replaced_fk' (ENSURE_ROW hit the FK: the account is gone)
--   p_fence : 'fenced_own' | 'superseded' | 'gone' | 'timeout' | 'none'   (FENCE_OWN result; 'none' = no fence was run)
--   p_lookup: 'gone' | 'exists' | 'error' | 'none'                        (admin.getUserById after the fence)
-- Returns gen ('committed' | 'not_committed' | NULL), acct ('account_deleted' | 'exists' | 'unknown'), http (the response).
CREATE FUNCTION private.pf_outcome(p_event text, p_fence text, p_lookup text,
                                   OUT gen text, OUT acct text, OUT http text)
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $f$
BEGIN
  IF p_event = 'deleted' THEN
    gen := 'committed'; acct := 'account_deleted'; http := '200 deleted';
  ELSIF p_event = 'replaced' THEN
    gen := 'not_committed'; acct := 'exists'; http := 'status';       -- row existed => account existed at that moment
  ELSIF p_event = 'replaced_fk' THEN
    gen := NULL; acct := 'account_deleted'; http := 'status deleted';
  ELSIF p_event = 'stale' THEN                                          -- no fence
    gen := 'not_committed';
    IF p_lookup = 'gone' THEN acct := 'account_deleted'; http := '200 deleted';
    ELSIF p_lookup = 'exists' THEN acct := 'exists'; http := '409 superseded';
    ELSE acct := 'unknown'; http := '503 unknown'; END IF;
  ELSIF p_event IN ('ineligible', 'paused') THEN                        -- FENCE_OWN for hygiene, then lookup
    gen := 'not_committed';
    IF p_fence = 'gone' THEN acct := 'account_deleted'; http := '200 deleted';
    ELSIF p_fence = 'timeout' OR p_lookup IN ('error', 'none') THEN acct := 'unknown'; http := '503 unknown';
    ELSIF p_lookup = 'gone' THEN acct := 'account_deleted'; http := '200 deleted';
    ELSIF p_fence = 'superseded' THEN acct := 'exists'; http := '409 superseded';
    ELSE acct := 'exists'; http := CASE WHEN p_event = 'ineligible' THEN '409 <code>' ELSE '503 maintenance' END; END IF;
  ELSIF p_event = 'other' THEN                                          -- FENCE_OWN, then lookup
    IF p_fence = 'gone' THEN gen := NULL; acct := 'account_deleted'; http := '200 deleted';
    ELSIF p_fence = 'timeout' THEN gen := NULL; acct := 'unknown'; http := '503 unknown';
    ELSE
      gen := 'not_committed';                                           -- g was replaced while the row existed
      IF p_lookup = 'gone' THEN acct := 'account_deleted'; http := '200 deleted';
      ELSIF p_lookup IN ('error', 'none') THEN acct := 'unknown'; http := '503 unknown';
      ELSIF p_fence = 'superseded' THEN acct := 'exists'; http := '409 superseded';
      ELSE acct := 'exists'; http := '500 not_deleted'; END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'pf_outcome: unknown event %', p_event;
  END IF;
END $f$;

-- Public SECURITY INVOKER wrappers
CREATE FUNCTION public.pf_deletion_issue_ticket(p_user uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.issue_ticket(p_user) $f$;
CREATE FUNCTION public.pf_deletion_admit(p_user uuid, p_ticket uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.admit(p_user, p_ticket) $f$;
CREATE FUNCTION public.pf_deletion_fence(p_user uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.fence(p_user) $f$;
CREATE FUNCTION public.pf_deletion_fence_own(p_user uuid, p_request uuid) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.fence_own(p_user, p_request) $f$;
CREATE FUNCTION public.pf_delete_own_account(p_user uuid, p_request uuid) RETURNS text
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $f$ SELECT private.delete_own_account(p_user, p_request) $f$;

-- Grants
REVOKE ALL ON FUNCTION private.ensure_row(uuid), private.issue_ticket(uuid), private.admit(uuid,uuid), private.fence(uuid),
  private.fence_own(uuid,uuid), private.delete_own_account(uuid,uuid), private.pf_guard_account_deletion(),
  private.pf_outcome(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pf_deletion_issue_ticket(uuid), public.pf_deletion_admit(uuid,uuid), public.pf_deletion_fence(uuid),
  public.pf_deletion_fence_own(uuid,uuid), public.pf_delete_own_account(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.issue_ticket(uuid), private.admit(uuid,uuid), private.fence(uuid), private.fence_own(uuid,uuid),
  private.delete_own_account(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pf_deletion_issue_ticket(uuid), public.pf_deletion_admit(uuid,uuid), public.pf_deletion_fence(uuid),
  public.pf_deletion_fence_own(uuid,uuid), public.pf_delete_own_account(uuid,uuid) TO service_role;
