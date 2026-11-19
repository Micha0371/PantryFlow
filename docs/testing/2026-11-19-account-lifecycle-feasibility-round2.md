# Account lifecycle feasibility verification, round 2 — 2026-11-19

Owner-authorized experiments for the account-lifecycle specifications v0.8.1. They ran in a fully isolated, disposable Supabase stack (`pf-fv2-20261119`, CLI 3.2.0, Auth v2.198.0, Postgres 17.12, supabase-js 2.119.0): no hosted access, no real accounts or personal data, and no other environment touched. The stack, its containers, volumes and networks were removed afterwards. **Local results only; not evidence for hosted.**

The experimental SQL is kept for reference as [`evidence/2026-11-19-fv2-deletion-protocol.sql`](evidence/2026-11-19-fv2-deletion-protocol.sql). It is a prototype, **not a migration**. Scripts and raw outputs stay in ignored local storage.

Disclosure: two diagnostic commands printed the disposable stack's well-known local default keys to the terminal. The stack is destroyed; the committed files contain no key material, which was checked by a pattern scan.

---

Date: 2026-11-19. Local disposable stack only (`project_id = pf-fv2-20261119`, ports 57321/57322/57320/57329/57323/57324/57327, studio/analytics/storage/realtime/edge disabled).

| Item | Value |
|---|---|
| Supabase CLI | 3.2.0 (`npx -y supabase@3.2.0`) |
| Auth (GoTrue) | v2.198.0 (from `/auth/v1/health`) |
| Postgres | 17.12 |
| supabase-js | 2.119.0 (required from the main checkout's node_modules by absolute path; nothing installed there) |
| pg (installed in C:/pffv2 only) | 8.23.1 |
| Config | `jwt_expiry = 60` for the whole stack; email confirmations off; `[api] schemas = public, graphql_public` (private not exposed) |
| Migrations | the four project migrations copied unmodified; experimental SQL only in `01_deletion_protocol.sql` (applied via `pg`, never a migration) |
| Identity checks | `identity-log.txt`: before each step, `docker ps` showed the five `*_pf-fv2-20261119` containers on 57xxx, API `http://127.0.0.1:57321`, DB port 57322. The five `*_pantryflow-tests` containers (543xx) were present throughout and never touched (no stop/exec/query). |

Scripts and raw outputs: `a1_boundary.js`/`a1_output.txt`, `a1b_acl.js`/`a1b_output.txt`, `a2_d20.js`/`a2_output.txt`, `a3_d17.js`/`a3_output.txt`, `a4_timeout.js`/`a4_output.txt`, `b1_signout.js`/`b1_output.txt`, `c1_late_commit.js`, `c2_controls.js`, `c1_runs.txt`, `c_config.txt`. Helpers: `lib.js`, `fix.js`, `apply.js`, `identity.sh`.
Secrets: service-role key, anon key and JWT secret were read at runtime from `supabase status -o json` into a temp file (deleted at cleanup) and never printed by my scripts. Disclosure note: two of my diagnostic commands (a `grep` of Kong's `kong.yml` and a `pg_db_role_setting` query) printed the Supabase CLI's well-known **default demo** keys / JWT secret to the terminal (the same public defaults that leaked in round 1). They belong to this disposable stack, which was destroyed; nothing real was exposed.

## Part A - deletion protocol

Implementation (`01_deletion_protocol.sql`): both tables (RLS on, no policies, grants revoked from PUBLIC/anon/authenticated, `service_role` only); `private.issue_ticket/admit/fence/delete_own_account` (`SECURITY DEFINER`, `search_path = ''`, owner `postgres`); `public.pf_deletion_issue_ticket/admit/fence` and `pf_delete_own_account` (`SECURITY INVOKER`, `search_path = ''`); `BEFORE DELETE ON auth.users` trigger `pf_guard_account_deletion` (function in `private`, SECURITY DEFINER).

| Item | Expected | Observed | Verdict |
|---|---|---|---|
| FV-B9a | service-role RPCs through PostgREST work end to end; private implementation runs | issue_ticket -> uuid; admit -> new request_id, row `pending`, ticket cleared; delete -> `'deleted'` (HTTP 200) | CONFIRMED |
| FV-B9b | anon/authenticated denied on every wrapper; `private.*` unreachable | all 4 wrappers: 42501 "permission denied for function ..." for both roles; `schema('private')` via PostgREST: PGRST106 "Invalid schema: private" (even for service_role); as DB role anon/authenticated `private.*`: 42501 "permission denied for schema private"; D16 tables: all select/insert/update/delete denied (42501) | CONFIRMED |
| FV-B9c / FV-B10 | P0001 code+message intact | `{"code":"P0001","message":"PF_DELETION_STALE","details":null,"hint":null}`; INELIGIBLE arrives with `details: "extra_members"` (DETAIL preserved) | CONFIRMED |
| FV-B9d | `set_config(..., true)` reaches the trigger | delete through the function succeeded with a row present (trigger would raise `PF_DELETION_USE_FUNCTION` otherwise; raised for all other paths) | CONFIRMED |
| FV-B9e | section 6 cascades incl. FV-B3 | user with 2 sessions, 2 refresh tokens, identity, mfa factor, 2 mfa_amr_claims, one_time_token, flow_state, profile, household, member, 2 items, 1 shopping row: all 0 after delete except `auth.flow_state` (1 -> 1, not cascaded, as FV-B3/R-2b); other user's graph digest identical before/after; no `user_deleted` audit entry for the function path (audit_log_entries only grew by Auth's own login/refresh events; the 2 `user_deleted` rows belong to Admin-API deletes of no-row fixtures); refresh -> `refresh_token_not_found`; `getUserById` -> 404 | CONFIRMED |
| FV-B9f | privileges that turned out necessary | see "Privileges" below | RECORDED |
| D24 | Admin deleteUser of user with row refused, nothing deleted; user without row deleted | with row: HTTP 500; SDK message only "Database error deleting user", raw body `{"code":"P0001","message":"PF_DELETION_USE_FUNCTION"}`; rows intact. Without row: deleted. Plain SQL delete with row: P0001 `PF_DELETION_USE_FUNCTION` | CONFIRMED |
| D17 | no row = existing semantics; fenced/older generation -> STALE; current pending of any age passes G1-G4 | fenced row with its *current* request_id -> STALE; no row -> STALE; older generation -> STALE; pending aged 2 days: reaches G2 (INELIGIBLE) when graph ineligible and returns `'deleted'` when eligible; `issue_ticket` on pending <2 min -> IN_PROGRESS, older supersedes and the old generation then STALE | CONFIRMED |
| D20.1 | call held in-flight; concurrent fence waits; result terminal | RPC delete held on the user row (after taking the request row FOR UPDATE; `pg_blocking_pids` proof); fence RPC blocked by the delete backend, still waiting at 500 ms; (a) delete commits -> fence gets FK violation 23503 (user gone), `getUserById` 404; (b) delete fails INELIGIBLE -> fence succeeds, returns the previous request_id, row `fenced`, user exists = terminal not_deleted; later call with the old generation STALE | CONFIRMED |
| D20.2 pre-admission | admit with ticket T held; fence; admit refused | admit blocked at the barrier (`pg_blocking_pids`), fence ran, admit then `PF_DELETION_REAUTHENTICATE`, row fenced | CONFIRMED |
| D20.3 reactivation | old generation call after fence + new ticket + new admission -> STALE | STALE; user intact; only the new generation then commits. Note: the old call is "delayed" by issuing it late, because every other delay point also blocks the fence/ticket/admit (the barrier is the first lock) | CONFIRMED |
| D20.4 fence ordering | ticket issued between two fences completing in reverse order is refused | Fa transaction opened first, Fb fenced and completed, ticket T issued, Fa then fenced: admit(T) -> REAUTHENTICATE. Control: two simultaneous fences both blocked on the row and serialized; a ticket issued after both is admitted | CONFIRMED |
| D20.5 consumed ticket replay | refused `reauthenticate` | refused in both cases, but the code is `PF_DELETION_IN_PROGRESS` while the row is still pending (spec 5.1 step 4) and `REAUTHENTICATE` after a fence | CONFIRMED (code differs from D20.5 wording, see discrepancies) |
| D20.6 concurrent consumption | exactly one succeeds | two pg txs: second blocked on the row lock (proof), then IN_PROGRESS; 8 concurrent RPC admissions with one ticket: exactly 1 success | CONFIRMED |
| D20.7 orders | never >1 live generation; never admits a ticket issued before a completed fence | all six orders of issue/admit/fence run sequentially match the oracle (admit only succeeds when first; the admitted generation is STALE iff a fence followed); 40 concurrent I/A/F triples via PostgREST: 0 violations (8 admissions accepted). Weak oracle (no commit-order log), see limits | CONFIRMED (with the limit noted) |
| D21 | eligibility change before delayed same-generation call: G2 aborts, other member intact | INELIGIBLE with `extra_members`, U and V still exist, V graph digest unchanged by the call, then newer generation -> STALE | CONFIRMED |
| D22 | pause waits for in-flight calls or request fails PAUSED; never executable after pause | (1) ticket request holding the barrier share: pause UPDATE blocked (proof), after commit admit -> `PF_DELETION_MAINTENANCE`, row fenced; (2) issue/delete after pause -> PAUSED; (3) in-flight delete finished before pause committed, later delete PAUSED, drain fenced 0 pending left, pre-pause generation STALE after resume; (4) request arriving while pause UPDATE uncommitted: blocked then PAUSED, no row created | CONFIRMED |
| D25 | each prefix arrives intact | STALE, INELIGIBLE (+DETAIL), PAUSED (and IN_PROGRESS, REAUTHENTICATE, MAINTENANCE) arrive as `P0001`/message. GONE: only produced in a rolled-back transaction after dropping the FK (see discrepancies) | CONFIRMED for STALE/INELIGIBLE/PAUSED; GONE CONFIRMED (SQL-only, unreachable in valid state) |

### Privileges (FV-B9f)
Revoke-and-observe on a fresh eligible request (`a1_boundary.js`):
- `USAGE` on schema `private` for `service_role`: required (without it 42501 "permission denied for schema private").
- `EXECUTE` on `private.delete_own_account`: required (42501).
- `EXECUTE` on `public.pf_delete_own_account`: required (42501).
- Table privileges of `service_role` on `account_deletion_*`: **not** required for the RPC path (the `SECURITY DEFINER` function owner `postgres` accesses them; delete still returned `'deleted'`); they matter only for direct service-role table access.
- `postgres` is not superuser (rolsuper=false) but may `DELETE FROM auth.users` and create the trigger on it (auth.users is owned by `supabase_auth_admin`); it may **not** `ALTER TABLE auth.users DISABLE TRIGGER` ("must be owner of table users").
- Default privileges grant EXECUTE/table rights to anon/authenticated on new `public` objects, so the explicit `REVOKE ... FROM PUBLIC, anon, authenticated` on both tables and all wrappers is **necessary**; final ACLs in `a1b_output.txt` (functions: only postgres + service_role; schema `private`: `postgres=UC, service_role=U`).
- Trigger function can be `SECURITY DEFINER` in `private` with no grant to the Auth role (the trigger is invoked by the owner-checked path; Auth's Admin delete ran it without permission errors).

## Part B - sign-out evidence (jwt_expiry 60 s, Auth v2.198.0)

| # | Expected | Observed | Verdict |
|---|---|---|---|
| 1 | global logout -> 204, all sessions gone | 204; sessions 0; refresh of each earlier session 400 `refresh_token_not_found` | CONFIRMED |
| 2 | revoked session -> 403 `session_not_found`; other session still refreshes | 403 `session_not_found` ("Session from session_id claim in JWT does not exist"); session S2 refresh 200, still present | CONFIRMED |
| 3 | expired access token + valid refresh -> 403 `bad_jwt`; refresh then logout 204 | `scope=global` and `scope=local` both 403 `bad_jwt` ("...token is expired"); refresh 200; logout with refreshed token 204 | CONFIRMED |
| 4 | `scope=others` from fresh session: 204, others deleted, fresh refreshes | 204; only the fresh session left; the 3 old ones 400 `refresh_token_not_found`; fresh refresh 200 | CONFIRMED |
| 5 | `scope=others` from B leaves A | 204; A's session set identical before/after (2/2), both A refreshes 200; B 2 -> 1 | CONFIRMED |
| 6 | supabase-js signOut `{error:null}` in cases 2 and 3 | case 2 (revoked session, global): `{"error":null}`; case 3 (expired token + valid refresh, local): `{"error":null}` (the SDK refreshes the expired session before signing out; the raw call for the same token is 403 `bad_jwt`); revoked session local: `{"error":null}` | CONFIRMED (illustrates V5-4) |

## Part C - FV-A9 late password commits (local only; not evidence for hosted)

### Configuration-backed bounds (`c_config.txt`, source files in `src-v2198/`)
- Auth v2.198.0: `APIConfiguration.MaxRequestDuration` default **10 s** (`GOTRUE_API_MAX_REQUEST_DURATION`, not overridden in the local stack); applied by `timeoutMiddleware` via `r.WithContext(ctx)` with that deadline, producing 504 `request_timeout` (`internal/api/api.go`, `middleware.go`). `http.Server` sets only `ReadHeaderTimeout = 2 s`; no ReadTimeout/WriteTimeout/IdleTimeout.
- Database: `SHOW statement_timeout` = 0 for `postgres`; `supabase_auth_admin` has no statement_timeout, `idle_in_transaction_session_timeout = 60000` (60 s), no lock_timeout. Roles `authenticator` has `statement_timeout = 8s` and `lock_timeout = 8s`, `anon` 3 s, `authenticated` 8 s (these apply to PostgREST, not to Auth).
- Kong 2.8.1 gateway: `auth-v1` service has no timeout settings in `kong.yml` (only `functions-v1` sets `read_timeout: 150000`). Kong's default service timeouts are 60 s connect/read/write (documented default; the admin API was unreachable so not read from a running instance).
- A config value is not a demonstrated maximum: the hosted values are unverified here.

### Demonstrated behaviour (fixture user row held `FOR UPDATE`; `PUT /user` with new password; client gives up at 3 s; lock released after N s)
| Path | Hold/release | Auth DB lock-wait | Password after release | Verdict |
|---|---|---|---|---|
| via Kong (`/auth/v1/user`) | 5 s, 10 s, 60 s | waiting at 1.5 s and **still waiting at the 3.0 s sample**; gone at the next sample (4.6 s in the 5 s run, 5.0 s in the others), so cancellation happened somewhere within those sample intervals *(corrected after the Codex evidence review, V9-4)* | unchanged in all three; sessions unchanged (2/2); new password login 400, old 200 | no late commit |
| direct to Auth :9999 (raw HTTP piped through nc inside the auth container, killed after 3 s) | 5 s, 10 s, 60 s | waiting at 1.5 s; gone by the 3.5 s poll (0.5 s after the connection closed) | unchanged in all three | no late commit |
| controls, client does not give up | none / lock 5 s / lock 15 s | n/a | no lock: 200, changed; lock 5 s: 200 at 5.0 s, changed; lock 15 s: **504 `request_timeout` at 9.9 s**, unchanged after release at 15 s | consistent with the 10 s bound |

Findings: a client disconnect cancels Auth's database work at both the gateway and Auth level. The connection close cancels the request context. **Timing:** on the direct path a 200 ms poll saw the wait end about 0.5 s after the disconnect; on the gateway path only the coarser samples exist (still waiting at 3.0 s, gone by 4.6–5.0 s), so no sub-second claim is made there *(V9-4)*. and the unaided server limit at 10 s also cancels it. Note: a half-closed connection (EOF on the client's write side) is already treated as a disconnect (my first direct attempt returned 500 "context canceled"). **Limits:** this exercised a request blocked *before* its UPDATE (lock wait). It does not show behaviour when the statement is already running, or when the transaction has progressed past the last cancellation point; a finite observation is not a proven maximum. Not evidence for hosted.

## Spec discrepancies and observations
1. **FENCE `RETURNING the previous request_id`** (5.1) cannot be written as a single `INSERT ... ON CONFLICT DO UPDATE` (RETURNING gives the new values). Implemented as `SELECT request_id ... FOR UPDATE` then the upsert, inside the same function (same lock semantics).
2. **D20.5 vs 5.1(4):** replaying a consumed ticket while the row is `pending` yields `in_progress`, not `reauthenticate`; `reauthenticate` only after a fence. D20.6 already allows either; D20.5 wording should too.
3. **`PF_DELETION_GONE` is unreachable** in a valid state: the request row has an FK with cascade to `auth.users`, the function holds it `FOR UPDATE`, so a concurrent user deletion cannot happen first (and the trigger would block it). The branch is dead code, or the FK model needs restating; it also means the spec's mapping "`GONE` means already deleted" never triggers through PostgREST (a missing row yields STALE).
4. **Admit error taxonomy:** the spec names `maintenance`, `rate_limited`, `reauthenticate`, `in_progress` but not their database-side prefixes; implemented as `PF_DELETION_MAINTENANCE`, `..._RATE_LIMITED`, `..._REAUTHENTICATE`, `..._IN_PROGRESS`. D25 lists only INELIGIBLE/STALE/PAUSED/GONE (issue_ticket uses `PAUSED`, admit uses `MAINTENANCE`).
5. **Privileges beyond the spec text:** explicit revokes are needed because of Supabase default privileges (anon/authenticated get EXECUTE and table rights on new public objects); `USAGE` on `private` and `EXECUTE` on both layers are required; table privileges for service_role are not needed for the RPC path. The trigger function was created `SECURITY DEFINER` in `private` (spec 2 item 5 does not say).
6. **PostgREST role timeouts:** the `authenticator` role carries `statement_timeout = 8s` and `lock_timeout = 8s`; a service-role RPC blocked longer fails with 57014 "canceling statement due to statement timeout" after ~8.1 s (`a4_output.txt`). Not a P0001 prefix, so the app takes the "anything else -> FENCE" path; the spec's `lock_timeout = 5s` for FENCE fits under it, but FV-B8 should confirm hosted values.
7. **Admin API opacity (D24):** supabase-js reports only "Database error deleting user" (HTTP 500); the marker `PF_DELETION_USE_FUNCTION` appears only in the raw HTTP body.
8. **Trigger administration:** `postgres` cannot disable the `auth.users` trigger (not owner), relevant to any runbook or test that assumed disabling it.
9. Password-spec facts: bad_jwt for expired tokens confirmed (403, not 401), matching V6-4.

## Limits
- D20.7 concurrent runs use a weak oracle (no commit-order log).
- D20.3: the late call is simply issued later; a delayed-in-flight variant is impossible because the barrier blocks every competing step.
- Part C is local, single Auth instance, lock-wait scenario only.

## Cleanup
See final section appended after teardown.

Teardown (2026-11-19): identity re-verified, then `supabase stop --no-backup --project-id pf-fv2-20261119` (rc 0). Afterwards 0 containers, 0 volumes and 0 networks matching `fv2` remained. The five `*_pantryflow-tests` containers (543xx) were still running and were never touched. Deleted from C:/pffv2: node_modules, package files, supabase/ (config + migration copies), experiments/ (SQL kept as `evidence/01_deletion_protocol.sql`), `.status.json` (keys). Kept: evidence/ and FV-BRIEF.md. No file in C:/GitHub/own/PantryFlow was modified.
