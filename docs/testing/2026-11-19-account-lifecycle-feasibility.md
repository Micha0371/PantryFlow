# Account lifecycle feasibility verification — 2026-11-19

Owner-authorized experiments in a fully isolated, disposable Supabase stack (project `pf-fv-20261119`, CLI 3.2.0, Auth v2.198.0), run for the account-lifecycle specifications v0.2. No hosted access, no real accounts or personal data, no other environment touched. The stack, its containers and volumes were removed afterwards. Scripts and raw outputs stay in ignored local storage (`C:/pffv/evidence/`); this file is the committed record.

Disclosure: the CLI's own `supabase start` output printed the disposable stack's local default keys once. The stack was destroyed, so the keys no longer exist; the evidence below contains no key material.

Not covered here: FV-A1 (hosted read, awaiting authorization), FV-A3 (overlapping recovery requests, needs the phone), FV-B6 (rate-limit keying through a served function).

- Date: 2026-11-19
- Supabase CLI: 3.2.0 (`npx -y supabase@3.2.0`), project_id `pf-fv-20261119`, ports 56xxx
- Auth version (`GET /auth/v1/health`): v2.198.0 (GoTrue)
- Postgres: PostgreSQL 17.12 (image public.ecr.aws/supabase/postgres:17.12.0.000)
- supabase-js: 2.119.0 (required by absolute path from the main checkout's node_modules); `pg` installed only inside C:/pffv
- Identity checks (before each destructive step): `idcheck-b1.txt`, `idcheck-b2.txt`. Each showed only `*_pf-fv-20261119` containers for this stack (db 56322, kong/API 56321, mailpit 56324), API URL `http://127.0.0.1:56321`, `current_setting('port')` = 5432 inside the pf-fv db container (host-mapped to 56322). The `*_pantryflow-tests` containers (543xx) were never touched.
- Scripts: `evidence/scripts/` (lib.js reads keys at runtime from `supabase status -o json` cached in a temp file, deleted at cleanup). Raw outputs: `evidence/*-output.txt`. Config: `config-base.toml.bak` (A2 settings), `config-final.toml`.
- Safety note: the first `supabase start` printed the stack's default local demo keys (including the service-role JWT, a publicly known local default) to the terminal via the CLI's own start output. This was not intentional and was not repeated; the stack is disposable and has been destroyed. No hosted/supabase.co access occurred.
- Migrations: the four project migrations were copied unmodified into C:/pffv/supabase/migrations and applied. Experimental SQL (`guard.sql`) exists only in C:/pffv.

## FV-A2: password length enforcement. CONFIRMED
Config: minimum_password_length=15, password_requirements="", enable_confirmations=false. Script `a2.js`, output `a2-output.txt`.

| input | code points / bytes | result |
|---|---|---|
| 14 ASCII | 14/14 | 422 weak_password, reasons ["length"] |
| 15 ASCII | 15/15 | 200 |
| 14 a-umlaut (U+00E4) | 14/28 | 422 weak_password length |
| 15 a-umlaut | 15/30 | 200 |
| 15 emoji | 15/60 | 200 |
| 14 x (e+U+0301) | 28/42 | 200 (counted as 28 code points) |
| 7 x (e+U+0301) | 14/21 | 422 weak_password length |
| 64 ASCII | 64/64 | 200 |
| 72 ASCII | 72/72 | 200 |
| 73 ASCII | 73/73 | 400 validation_failed "Password cannot be longer than 72 characters" |
| 36 a-umlaut | 36/72 | 200 |
| 37 a-umlaut | 37/74 | 400 validation_failed |
| 18 emoji | 18/72 | 200 |
| 19 emoji | 19/76 | 400 validation_failed |
| 64 a-umlaut | 64/128 | 400 validation_failed |
| 64 emoji | 64/256 | 400 validation_failed |
| 25 chars with leading+trailing space | 25/25 | 200; sign-in with exact value 200; trimmed value 400 invalid_credentials (no trimming) |

Observations: the minimum counts code points (not graphemes); the maximum is 72 bytes. 72-byte ASCII account: full-value sign-in 200, 71-character prefix 400 invalid_credentials (no truncation). The brief's "14 x (e+U+0301)" is 28 code points, so it passes a 15 minimum; the 7-pair case (14 code points) fails.

## FV-A6 + FV-A4: password update, session revocation, amr. CONFIRMED
Script `a6.js`, output `a6-output.txt`. Config unchanged (confirmations false).
- U signed up and signed in 3 times (S1-S3); DB had 4 sessions (signup session + 3).
- S1 `updateUser({password})`: ok. Sessions in DB afterwards: 1 (only S1; the signup session was also deleted).
- S1 refresh: OK, same session_id d88e35ae-fb83-4530-9361-f9d07bd5d863.
- S2, S3 refresh: 400 refresh_token_not_found.
- S2's old, unexpired access token: `GET /auth/v1/user` 403 `session_not_found`; PostgREST `profiles` read with the same token 200 and returned the profile row (outstanding-JWT window confirmed).
- amr/iat: S1 before: amr [password, ts 1795088155], iat 1795088155; after refresh: amr unchanged [password, ts 1795088155], iat 1795088156, same session_id.
- Recovery (PKCE, memory storage): email link is `http://127.0.0.1:56321/auth/v1/verify?...type=recovery`; GET gave 303 to `redirect_to?code=...`. `exchangeCodeForSession`: ok, `redirectType` = "recovery", access token amr = [{method: recovery, ts 1795088158}], session_id 80ccc112-e186-4faf-bc6f-35856640a565. After refresh: amr still [recovery, same ts], iat 1795088159.
- Recovery session password update: ok. Sessions before 4 (S1, S4, S5, recovery), after 1: all other sessions were deleted (S1, S4, S5 refresh: 400 refresh_token_not_found). The recovery session itself refreshed OK afterwards, amr still only [recovery] (no password entry added). A fresh password sign-in with the new password gave amr [password, new ts].
- Rejection keeps sessions: weak update ("short") 422 `weak_password` reasons ["length"]; 73-char update 400 `validation_failed`. Fresh sessions F2, F3 and F1 all still refreshed 200.

## FV-A5: require current password and recovery exemption. PARTIALLY REFUTED (error code name differs)
Script `a5.js`, output `a5-output.txt`.
- Local config key found: `require_current_password = true` under `[auth.email]` (present, commented out, in the CLI 3.2.0-generated config.toml). The keys `update_password_require_current_password` and `password_update_require_current_password` (under `[auth]` and `[auth.email]`) are NOT recognised: the CLI prints "WARN: ... has keys this version of the Supabase CLI does not recognize and ignores" (it warns, it does not reject). With the correct key the auth container env shows `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD=true`.
- (a) password session, no current_password: 400 `current_password_required` (as expected).
- (b) wrong current_password: 400 `current_password_invalid` (EXPECTED `current_password_mismatch`). REFUTED on the name only. The message text is identical to (a): "Current password required when setting new password."
- (d) after a refresh of the password session, still 400 `current_password_required` (as expected).
- (c) correct current_password: 200; sign-in with the new password 200.
- (e) recovery session without current_password: 200; the recovery session after a refresh also 200 (exemption persists across refresh).

## FV-A7: signup enumeration. CONFIRMED (enumeration signal present; the brief gave no explicit expected outcome)
Config enable_confirmations=true. Script `a7.js`, output `a7-output.txt`.
- Existing confirmed address: 422, body `{code, error_code: "user_already_exists", msg: "User already registered"}`, no email sent.
- New address: 200 with a full user object (id, identities, confirmation_sent_at, ...), confirmation email sent.
- Repeat signup of an unconfirmed address: 200 user object again.
- So Auth v2.198.0 with the default local config distinguishes existing confirmed accounts by status and shape. The app must not rely on Auth to hide enumeration.

## FV-B3: auth-schema foreign keys. CONFIRMED (with additions)
Script `b3.sql`, output `b3-output.txt`. FKs referencing auth.users(id) / auth.sessions(id):
- CASCADE: auth.identities, sessions, mfa_factors, one_time_tokens (user); refresh_tokens, mfa_amr_claims (session); also mfa_recovery_code_sets, oauth_authorizations, oauth_consents, webauthn_challenges, webauthn_credentials.
- SET NULL: auth.scim_users.
- `auth.refresh_tokens` and `auth.mfa_amr_claims` have only session FKs (no direct user FK).
- `auth.flow_state` has NO foreign key (it has a user_id column): rows are orphaned by user deletion. Verified in B1: after a hard delete, the PKCE flow_state row for the deleted user still existed (1 -> 1).
- public: profiles.id CASCADE; pantry_households.owner_id CASCADE; pantry_household_members.user_id CASCADE; pantry_items.created_by SET NULL; pantry_shopping_items.created_by SET NULL. (Matches migrations, after 00002 changed pantry_items.created_by to SET NULL.)

## FV-B1 + FV-B5: guard trigger and Admin API error shape. CONFIRMED (after fixing a defect in my first SQL)
Scripts `guard.sql`, `b1.js`, `b5.js`; outputs `b1-guard-create.txt`, `b1-output.txt`, `b5-output.txt`; first run kept as `b1-output-run1-minuuid-bug.txt`.
- Creating the `BEFORE DELETE` trigger on `auth.users` as `postgres`: succeeds. The SECURITY DEFINER function in schema `private` fires for deletes performed by Auth (role supabase_auth_admin) without a permission error.
- Run 1 note (my defect, not a platform result): the first function version used `min(uuid)`, which does not exist in PG17, so every in-progress deletion failed with a generic 500 "Database error deleting user" (error_code unexpected_failure; the real SQLSTATE 42883 appeared only in the Auth log). This shows any trigger exception becomes a 500, so a bug in the guard fails closed. Fixed (SELECT ... ORDER BY id LIMIT 1) and re-run; results below are from the fixed version.
- Eligible user with in_progress row: Admin hard delete 200 `{}`. Rows gone: auth.users, identities, profile, household, memberships, items in H, and the request row (cascade). Audit entries 88 -> 89 (+1 `user_deleted`).
- Ineligible user (second member added) with in_progress row: Admin hard delete 500, raw body `{"code":"P0001","message":"PF_DELETION_INELIGIBLE: extra_members","detail":"extra_members"}`. So `PF_DELETION_INELIGIBLE` and the failing code are visible in the raw REST body (no `error_code` field; the shape differs from Auth's usual `{code,error_code,msg}`). Full rollback: user/identity/profile/household/membership/request counts unchanged and auth.audit_log_entries count unchanged (91 -> 91). Repeating the call gives the same result.
- Through supabase-js 2.119.0 `auth.admin.deleteUser(id, false)` the same failure surfaces as `AuthRetryableFetchError`, status 500, message "Database error deleting user": the PF code is NOT visible in the supabase-js error (observed in `b1-output.txt` and `b5-output.txt`; I did not investigate why the message differs from the raw body). Callers should use raw REST or the status plus a DB-side check, and note supabase-js treats it as retryable.
- Ineligible by foreign attribution (item with created_by=user in another household) with row: 500, `PF_DELETION_INELIGIBLE: foreign_attribution`; user remains.
- Ineligible user without a request row: deletion proceeds, 200: user/household/profile/memberships (H) gone; the other member's membership row (in the deleted household) cascaded; the foreign item's `created_by` became NULL (SET NULL).
- Extra: an `in_progress` row older than 5 minutes (10 min) does not trigger the guard: the ineligible user was deleted, 200.
- Privileges: `anon` select/insert/delete on `account_deletion_requests`: 401 42501 permission denied; `authenticated`: 403 42501 for all three.
- The Auth log shows the PF message with SQLSTATE P0001 for each blocked deletion.

## FV-B2: deterministic concurrency. CONFIRMED
Script `b2.js`, output `b2-output.txt`. Three `pg` connections (T1 = auth delete simulated as direct `DELETE FROM auth.users` as postgres, T2 = app write, plus a monitor polling `pg_stat_activity` / `pg_locks` / `pg_blocking_pids`). Each scenario confirmed the waiting session (wait_event_type Lock, wait_event transactionid, ShareLock not granted, `pg_blocking_pids` = the other backend) before releasing.
- Extra member, insert first: T1 BLOCKED by T2 (tuple lock on `pantry_households` while waiting for T2's xid); after T2 COMMIT, T1 raised `P0001 PF_DELETION_INELIGIBLE: extra_members`; user graph unchanged (members 2, user 1).
- Extra member, delete first: T2 BLOCKED by T1 (tuple AccessShareLock on `pantry_households`, FK check); after T1 COMMIT T2 failed `23503` `pantry_household_members_household_id_fkey`; graph deleted.
- Second household, insert first: T1 BLOCKED by T2 (tuple lock on `auth.users`: the FK key-share from T2's insert blocks the DELETE's tuple lock before the trigger runs); after T2 COMMIT T1 raised `owned_household_count`. Delete first: T2 BLOCKED; after T1 COMMIT T2 failed 23503 `pantry_households_owner_id_fkey`.
- Foreign attribution, insert first: T1 BLOCKED by T2 (tuple lock on `auth.users`); after T2 COMMIT T1 raised `foreign_attribution`. Delete first: T2 BLOCKED; after T1 COMMIT T2 failed 23503 `pantry_items_created_by_fkey`.
- Detail: in the second-household and foreign-attribution cases the wait occurs at the `auth.users` row lock (FK key share vs delete), i.e. before the guard function body runs, and the guard then sees the committed row on its fresh statement snapshot; in the extra-member case the wait is on the household `FOR UPDATE`. Caveat: T1 here is a direct SQL delete, not a request through Auth (Auth's own deletion path was exercised in B1 with the same trigger and outcomes).

## FV-B4: amr password timestamp across refresh. CONFIRMED
Script `b4.js`, output `b4-output.txt`. Sign-in: iat 1795088452, amr [password, ts 1795088452], session_id fdd822fe-.... After a 6 s wait and refresh: iat 1795088459 (changed), amr timestamp 1795088452 (unchanged), same session_id. New sign-in: new session_id a9783bdb-..., amr timestamp 1795088459 (new). Consistent with the A6 results.
