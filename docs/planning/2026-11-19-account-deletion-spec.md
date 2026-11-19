# Account deletion, retention and privileged boundary — technical specification

**Version 0.3, 2026-11-19, for the focused Codex follow-up review.** Implementation, migrations, Edge Function deployment and destructive tests are not authorized.

**Changes in 0.3:** runtime results from the [feasibility evidence](../testing/2026-11-19-account-lifecycle-feasibility.md) are folded in.
- FV-B1, B2, B3 and B4: confirmed.
- FV-B5: supabase-js hides the guard's error, so the function reconciles after *any* non-200 response (section 5.1).
- FV-B3: `auth.flow_state` rows stay behind after deletion (sections 6 and 7).

**Changes in 0.2** (owner decisions of 2026-11-19):
- OD-B1 conditionally approved: exact claim checks, temporary-session behavior, and verification of the rate-limit advantage (section 3).
- OD-B2 conditionally approved: trusted activation context, why it can't be bypassed, and exempted operations (section 2.1).
- OD-B5 requirement approved and the ledger designed (section 7).

**Sources:**
- the [Slice 3 decision record](2026-11-19-slice-3-decision-record.md), section 6 (KAN-57, option B);
- the Codex account-lifecycle review (H1, H2, H5, M1, M2, M3) and its follow-up, in [`docs/reviews/2026-11-19/`](../reviews/2026-11-19/);
- [the account-lifecycle overview](2026-11-19-account-lifecycle-overview.md), which holds the threat model, dispositions, provider assumptions, owner decisions and sequence.

**Tickets:**
- [KAN-43](https://michaelwuerthner.atlassian.net/browse/KAN-43), the parent;
- [KAN-57](https://michaelwuerthner.atlassian.net/browse/KAN-57), this contract;
- [KAN-58](https://michaelwuerthner.atlassian.net/browse/KAN-58) and [KAN-59](https://michaelwuerthner.atlassian.net/browse/KAN-59), the implementation;
- [KAN-72](https://michaelwuerthner.atlassian.net/browse/KAN-72), public content.

**Status tags:** as in the [password spec](2026-11-19-password-recovery-session-spec.md): [Settled], [Specified], [Feasibility FV-x], [Owner OD-x], [Blocked].

## 1. Provider and schema facts

These were verified by reading the source. Execution is not verified.

| Fact | Source |
|---|---|
| Admin hard delete runs in **one database transaction**: it inserts an audit entry (`user_id`, `user_email`, `user_phone`) and then `tx.Destroy(user)`, which deletes the `auth.users` row. Any error rolls back both, and the API answers with an error ("Database error deleting user", 500). `should_soft_delete` defaults to false. | [admin.go@v2.197.0](https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/admin.go) `adminUserDelete` |
| Authenticated Auth endpoints answer 403 `user_not_found` for a deleted user (checked before the session) and 403 `session_not_found` for a deleted session. | `api/auth.go` `maybeLoadUserOrSession` |
| Access tokens carry `sub`, `session_id` and `amr` `[{method, timestamp}]`. A password sign-in creates a new session with a `password` entry. A refresh keeps the stored entries. | `tokens/service.go`, `models/amr.go` |
| `public.profiles.id` → `auth.users`, cascade. | `00001_first_slice.sql:12` |
| `public.pantry_households.owner_id` → `auth.users`, cascade. No uniqueness on `owner_id`. | `00001:26` |
| `public.pantry_household_members`: `household_id` → households (cascade); `user_id` → `auth.users` (cascade); `role text DEFAULT 'owner'` with no CHECK; `UNIQUE(user_id)`. One membership per user does **not** mean one member per household. | `00001:35–39` |
| `public.pantry_items`: `household_id` → households (cascade); `created_by` → `auth.users` ON DELETE SET NULL. | `00001`, `00002:17–21` |
| `public.pantry_shopping_items`: `household_id` cascade; `created_by` SET NULL; `(household_id, pantry_item_id)` → pantry ON DELETE SET NULL (pantry_item_id). | `00004:12–31` |
| Signup creates one profile, one owned household and one owner membership through triggers. This is not a database-wide invariant. | `00001` `handle_new_user`, `handle_new_profile` |
| Clients have no write grants on households or memberships; only privileged roles can change them. | `00001`/`00002` grants and policies |
| No Supabase Storage is used by the app. | grep of `lib/` and `app/` |
| Existing tests deliberately hard-delete an *author* whose rows live in another household and expect `created_by` to become null: `tests/database.test.cjs:133`, `supabase/tests/database/shopping.test.sql:87–90`, `tests/integration/behavior.integration.ts:251–258`. Fixture cleanup deletes users through the Admin API. | repository |

## 2. Architecture

**[Settled]:**
- one narrow Supabase Edge Function, `delete-account`;
- the supported Auth Admin API with hard delete;
- no general backend;
- the service-role key only in the function's environment.

**[Specified], two small database additions** in one migration, written after feasibility verification:

1. **`public.account_deletion_requests`**
   - Columns:
     - `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`;
     - `state text CHECK (state IN ('idle','in_progress'))`;
     - `request_id uuid`;
     - `started_at timestamptz`;
     - `attempts_window_start timestamptz`;
     - `attempts int`.
   - Row level security is on with no policies. Grants go only to `service_role`; there is no access for `anon` or `authenticated`.
   - Purpose:
     - **serialization**: one in-flight deletion per user;
     - **per-user attempt limiting**;
     - **the commit-time guard's activation marker**.
   - The row disappears with the user through the cascade.
2. **Guard trigger `pf_guard_account_deletion`**
   - `BEFORE DELETE ON auth.users FOR EACH ROW`.
   - Function: `private.guard_account_deletion()`, `SECURITY DEFINER`, `SET search_path = ''`, owned by `postgres`, `EXECUTE` revoked from all client roles.
   - When the deleted user has an `account_deletion_requests` row with `state = 'in_progress'` and `started_at > now() - interval '5 minutes'`, the trigger:
     - locks the graph;
     - checks it (section 4);
     - raises `PF_DELETION_INELIGIBLE` when the check fails. That aborts Auth's transaction: nothing is deleted, including the audit entry.
   - Deletions without an active request (operators, test fixtures, the existing author-deletion semantics) are unchanged. [Owner OD-B2]
   - Placing a trigger on `auth.users` in hosted Supabase is [Feasibility FV-B1]. The project already has an `AFTER INSERT` trigger there (`on_auth_user_created`).

### 2.1 Trusted activation context

**[Conditionally approved, OD-B2, 2026-11-19].**

**How the context reaches Auth's transaction:**
1. The function, holding the service-role key, commits the `in_progress` row in its own short transaction **before** it calls the Admin API.
2. Auth's deletion transaction then runs the trigger, which reads that committed row (READ COMMITTED) inside the same transaction that deletes the user.
3. No request parameter, header, claim or session setting is used. The Admin API offers no way to pass context into its transaction, and none is needed.

**Why ordinary callers can't forge or bypass it:**
- `anon` and `authenticated` have no grants on `account_deletion_requests`, and row level security is enabled with no policies. A client can neither create nor delete a row: verified by tests D16 and D17.
- Clients cannot delete `auth.users` at all, because they have no SQL grants and the Admin API requires the service-role key. So "bypassing" the guard means deleting a user without a row, which only a privileged operator can do.
- Activation can only make a deletion stricter. A forged row, if one could exist, would block the deletion, never permit it.

**Explicitly exempted operations** (guard inactive, existing semantics; each is privileged):

| Operation | Who | Rule |
|---|---|---|
| Disposable or local test fixtures and their cleanup (`local-stack.ts`, `e2e-fixtures.ts`, the existing author-deletion tests) | Test harness with the local service key | Local and disposable environments only |
| Operator deletion through the dashboard or Admin API without a request row | Owner or operator | **Not used for user-requested deletions.** User-requested and external requests always insert the `in_progress` row first (section 7). Allowed only for test or legacy accounts, with an owner-approved, recorded reason |
| Database maintenance as `postgres` or `supabase_admin` | Owner or operator | Follows the lock-order rule (section 4.3) or the maintenance pause (OD-B6) |

**Why the guard sits in the database and is conditional:**
- An eligibility check in the function followed by a separate `admin.deleteUser` is not atomic.
- Locks taken in one RPC end with that RPC.
- The guard therefore runs inside the very transaction that deletes the user.
- It activates only for self-service requests, so the Slice 1–2 database semantics that existing tests pin stay intact.
- An unconditional guard would also be possible. It would turn every author-deletion test and fixture cleanup with an unusual graph into a failure, and it is listed under OD-B2.
- The alternative of a direct SQL function (deleting `auth.users` from a service-role-only RPC, with the check in the same transaction) bypasses Auth's audit entry and lifecycle. It stays an alternative only if FV-B1 fails.

## 3. Caller identity and fresh authentication

**[Owner OD-B1]. Two candidate mechanisms; recommended: B.**

| | A: password checked inside the function | **B: fresh sign-in by the app, verified by the function** |
|---|---|---|
| How | The app sends the current password to the function. The function signs in with an isolated non-persisting Auth client, checks that the returned id equals the caller, deletes, then signs the temporary session out. | The app signs in again with an isolated non-persisting client (memory storage, `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`) using the current account's email and the entered password. It sends that fresh session's access token as the bearer. The function verifies the token and its freshness. |
| Password handling | The password passes through an extra server hop, with log-hygiene risk. | The password goes only to Auth, exactly like a normal sign-in. |
| Rate limiting | Auth's limiter sees the **function's** address for every user. That creates a shared bucket: anyone can exhaust deletion checks for all users, and per-attacker limits are lost. It needs function-side per-user limits *and* [Feasibility] on Auth's keying. | Auth's sign-in limiter sees the **phone's** address, as at normal login. The function adds per-user request limits. |
| Temporary credentials | Created in the function and must be cleaned up there. | The fresh session belongs to the app. The hard delete removes it on success; the app signs it out on rejection. |
| Freshness proof | The direct password check. | `amr` contains `password` with `timestamp ≥ now − 300 s`, on a session that still exists. A refreshed token keeps its old `amr` timestamp, so a stolen refresh token cannot produce a fresh entry. A client flag or `iat` is never used. |

**[Conditionally approved, OD-B1, 2026-11-19]: B, if the proof is sufficient.** The function rejects with 401 `not_fresh` (or 401 `unauthenticated`) unless every check holds. Each check is independent of the app.

| # | Check | How |
|---|---|---|
| 1 | **Authenticity** | The JWT signature is verified against the project's Auth signing keys (the gateway's `verify_jwt = true` plus an in-function verification of the same token). Expected claims: `iss` is the project Auth URL, `aud` is `authenticated`, `role` is `authenticated`, `exp` in the future (60 s clock tolerance), `is_anonymous` false, `sub` a UUID, `session_id` a non-nil UUID. |
| 2 | **Current session and user** | `auth.getUser(token)` succeeds. Auth itself looks up the user, then the session named in the token (403 `user_not_found` / `session_not_found` → 401). |
| 3 | **Immutable identity** | The caller is `getUser().user.id`; it must equal `sub`. The target is always the caller. Email is never used for targeting. |
| 4 | **No client target** | The body is empty JSON `{}`; any field gives 400 `unexpected_field`. |
| 5 | **Password method, server-derived time, ≤ 300 s** | The verified token's `amr` contains an entry with `method === 'password'`, and that entry's `timestamp` satisfies `now − 300 ≤ timestamp ≤ now + 60`. The timestamp is written by Auth when it issues the session (`mfa_amr_claims.updated_at`) and signed into the token. The app supplies nothing for this check. |

**Why a refreshed token cannot renew the window:**
- A refresh issues a new access token from the session's stored `amr` entries and adds no new entry; `AddClaimToSession` runs only when a session is issued (`tokens/service.go`).
- The `password` timestamp therefore stays at the original sign-in time.
- `iat` is never used. [Feasibility FV-B4] verifies this at runtime.

**Why recovery, OTP and other sessions cannot satisfy it:**
- Only `method === 'password'` counts. `recovery`, `otp`, `magiclink`, `email/signup` and `token_refresh` entries are ignored.
- `amr` is per session, so another session's sign-in never appears in this token.
- A just-recovered user satisfies the check by signing in with the new password, which creates a new session.

**Temporary and replacement sessions** (the fresh session belongs to the isolated client and never replaces the main session):

| Situation | Behavior |
|---|---|
| Cancel during or after FreshAuth, before dispatch | The app signs the fresh session out (`signOut({ scope: 'local' })` on the isolated client), which revokes it server-side |
| Confirmed rejection | Same; the main session stays the active one |
| Confirmed deletion | Every session, the fresh one included, is gone with the user |
| Unknown | The isolated client stays in memory until Reconciling ends. If not deleted, sign the fresh session out; if deleted, nothing remains. If the app is closed first, the fresh session is an orphan: its tokens existed only in memory, the server row remains until the provider's session limits remove it. This residual is documented. |

**Rate-limit advantage and residual risk** [Feasibility FV-B6]:
- **Claim:**
  - With B, password attempts reach Auth from the phone's address, so the per-address token limiter applies per attacker.
  - With A, every user's attempt would come from the function's egress address and share one bucket, unless Auth honors a forwarded client address.
- **To verify:** in the disposable stack, compare limiter behavior for direct sign-ins with sign-ins sent from inside a locally served function. For hosted keying, record it as a provider assumption, documented by Supabase or confirmed in the authorized read.
- **Residual risk, stated plainly:** an attacker who obtains a fresh token (for example, malware on the phone) within its 300-second window, while that session is alive, can trigger deletion. This is equivalent to having just stolen the password. The 5-per-24-hour request limit bounds repetition, not a single use.

**Also specified:**
- **Logging:** the function logs only `request_id`, the outcome code and the duration. It never logs headers, tokens, passwords or emails.
- **Wrong password:** fails at the app's sign-in with "Password is incorrect" (generic).
- **Auth unavailable:** "We couldn't verify your password. Nothing was deleted."

## 4. Eligible household graph and the commit-time guard

### 4.1 Eligibility for caller U (Slice 3)

**[Specified] from the owner's preferred contract.**

| Rule | Condition | Failure code |
|---|---|---|
| G1 | Exactly one `pantry_households` row with `owner_id = U`; call it H | `no_household` / `multiple_households` |
| G2 | Exactly one `pantry_household_members` row with `household_id = H`, and it is `(user_id = U, role = 'owner')` | `extra_members` / `membership_mismatch` |
| G3 | U's membership row (at most one, by `UNIQUE(user_id)`) exists and has `household_id = H` | `membership_mismatch` |
| G4 | No `pantry_items` and no `pantry_shopping_items` with `created_by = U` and `household_id ≠ H` | `foreign_attribution` |

**Ineligible graphs fail closed:**
- The function returns 409 with the code. The app shows: "Your account can't be deleted automatically. Contact support." No other user's details are revealed.
- **Support repair procedure:**
  - Inspect the graph by UUID.
  - Agree the repair with the owner.
  - Any data change follows a reviewed SQL script, recorded with date and UUID only.
  - The user then retries.
- In today's app these graphs arise only from privileged fixtures or legacy data.

### 4.2 Guard algorithm

```text
BEFORE DELETE ON auth.users, row OLD:
  if not exists active request for OLD.id: return OLD        -- unguarded path, unchanged semantics
  -- OLD's auth.users row is already locked (FOR UPDATE-strength) by the DELETE before row triggers run
  lock: SELECT id FROM public.pantry_households WHERE owner_id = OLD.id ORDER BY id FOR UPDATE
  lock: SELECT id FROM public.pantry_household_members
          WHERE household_id IN (those ids) OR user_id = OLD.id ORDER BY id FOR UPDATE
  evaluate G1–G4 with fresh statements (READ COMMITTED: each sees rows committed before its lock wait ended)
  if any fails: RAISE EXCEPTION 'PF_DELETION_INELIGIBLE' USING DETAIL = <code>
  return OLD                                                   -- cascades follow in the same transaction
```

### 4.3 Concurrency argument

[Feasibility FV-B2] must prove each of the following with deterministic interleavings.

| Competing operation | Lock it needs | Interaction | Outcome |
|---|---|---|---|
| Insert a membership into H for another user V | `KEY SHARE` on H (FK check) | Conflicts with the guard's `FOR UPDATE` on H | Committed before the guard's lock: the guard sees it and aborts (`extra_members`). Started after: it waits, then fails its FK because H was deleted. |
| Move V's membership into H (`UPDATE … SET household_id = H`) | `KEY SHARE` on H | Same | Same |
| Change H's owner | Row lock on H | Conflicts | Serialized; the guard re-evaluates after the wait |
| Create a second household owned by U | `KEY SHARE` on U's `auth.users` row | Conflicts with the DELETE's row lock | Committed first: the guard sees two households and aborts. Otherwise it waits, then fails its FK. |
| Insert an item or shopping row elsewhere with `created_by = U` | `KEY SHARE` on U's row | Same | Committed first: `foreign_attribution` aborts. Otherwise it waits, then fails its FK. |
| Concurrent self-service deletion for U | `account_deletion_requests` row update | The function's conditional update admits one `in_progress` request | The second gets 409 `in_progress`, or 401 once U is gone |

**Further rules:**
- **Isolation assumption:** Auth's default READ COMMITTED. Under REPEATABLE READ a lock conflict can raise a serialization failure, which is a confirmed rejection.
- **Deadlocks:**
  - The guard's lock order is user row → households (by id) → memberships (by id).
  - A privileged writer locking in another order can deadlock. PostgreSQL then aborts one transaction. If the guard's transaction is aborted, the deletion is a confirmed rejection and the user may retry.
  - **Maintenance rule:** privileged writers touching ownership, membership or attribution lock in the same order, or run while self-service deletion is paused. Pausing means the function returns 503 `maintenance` while a flag row exists; that is [Owner OD-B6].
- **Rollback:** the exception aborts the whole Auth transaction, including the audit entry. Cascades already applied inside it are undone.
- **A count-only check is insufficient** without these row locks. That is why the guard locks before counting.

## 5. Request protocol and state machine

### 5.1 Function steps

1. Verify the caller and freshness (section 3); a failure returns 401.
2. Upsert `account_deletion_requests` for U in one statement:
   - reset the attempt window after 24 h;
   - reject with 429 `rate_limited` when `attempts ≥ 5` in the window;
   - reject with 409 `in_progress` when `state = 'in_progress'` and `started_at > now() − 5 min`;
   - otherwise set `state = 'in_progress'`, a new `request_id`, `started_at = now()` and `attempts + 1`.

   **[Specified]** The limits are [Owner OD-B3]: proposed 5 per 24 h, with a 5-minute in-flight window.
3. Eligibility pre-check (section 4.1) with service privileges, for a clear error. If ineligible: set `state = 'idle'` and return 409 with the code. The trigger re-checks at commit.
4. Call `admin.deleteUser(U)`; it is a hard delete.
5. Map the result:

   | Auth response | Function response |
   |---|---|
   | 200 | 200 `deleted` (the request row is gone with U) |
   | Any non-200: Auth error, timeout, connection reset or gateway 5xx | Reconcile once with `admin.getUserById(U)`. **404** → 200 `deleted`. **Found** → the transaction rolled back: set `idle`, re-run the section 4.1 check, and return 409 `ineligible_changed` if it is now ineligible, else 500 `not_deleted`. **Reconciliation failed** → 503 `unknown`. |

   Why every error is reconciled (FV-B5): the raw Admin REST body of a guard rejection is `{"code":"P0001","message":"PF_DELETION_INELIGIBLE: <code>"}`, but supabase-js 2.119.0 surfaces it as `AuthRetryableFetchError` 500 "Database error deleting user". A bug in the guard produces the same 500 and fails closed. The function therefore never trusts error text. It makes exactly one delete call, with no SDK retry, and decides only by the read-only lookup.

   Reconciliation is read-only. The function never resends the delete.

### 5.2 App state machine

```mermaid
stateDiagram-v2
    [*] --> SignedIn
    SignedIn --> Confirming: Settings, Delete account
    Confirming --> SignedIn: Cancel, nothing sent
    Confirming --> FreshAuth: enter password, Delete
    FreshAuth --> Confirming: wrong password, rate limit, Auth unavailable
    FreshAuth --> Dispatched: fresh session for the same user id
    Dispatched --> Rejected: 401, 409, 429, 500 not_deleted
    Dispatched --> Deleted: 200 deleted
    Dispatched --> Unknown: 503 unknown, timeout, network loss after send
    Rejected --> SignedIn: temporary session signed out, message
    Unknown --> Reconciling: Check again, automatic on app start
    Reconciling --> Deleted: GET /user gives 403 user_not_found
    Reconciling --> SignedIn: GET /user gives 200, account still exists
    Reconciling --> Unknown: offline or session_not_found, support path offered
    Deleted --> CleanedUp: local cleanup
    CleanedUp --> [*]: signed-out Account deleted screen
```

| State | Behavior |
|---|---|
| **Confirming** | One disclosure, then the password field and a destructive **Delete account** button. The disclosure says what is deleted (account, household, pantry and shopping lists), that it is permanent, that other signed-in devices lose access within an hour and keep any offline copy until they reconnect, and what remains in operational records (section 7). Cancel sends nothing. There is no typed confirmation phrase. |
| **FreshAuth** | Isolated client sign-in (section 3). It asserts that the fresh session's user id equals the main session's user id; otherwise it aborts and signs the fresh session out. |
| **Dispatched** | The button is disabled and there is no cancel, because a dispatched request cannot be recalled. One request per tap. |
| **Rejected** | Nothing changed. The app signs out the temporary session (`signOut({ scope: 'local' })` on the isolated client). Messages by code: `not_fresh` ("Please enter your password again"), `in_progress`, `rate_limited`, ineligible ("Contact support"), `not_deleted` ("Nothing was deleted. Try again later."). |
| **Unknown** | Persist `pf.deletion.unknown = {user_id, at}` (not secret) and drop the temporary session from memory. Show "We couldn't confirm whether your account was deleted." It is never retried automatically. Starting a new deletion requires Reconciling to end in SignedIn first. |
| **Reconciling** | Read-only `GET /user` with the main session, which is a different session from the temporary one: `user_not_found` → Deleted; 200 → SignedIn ("Your account was not deleted") and the flag is cleared; `session_not_found` or offline → stays Unknown, offering "Check again" and the support contact. It runs again on every app start while the flag exists. |
| **CleanedUp** | `signOut({ scope: 'local' })` on the main client; it tolerates errors, because the server already removed the sessions. Remove the PantryFlow AsyncStorage keys (session, verifiers, markers, unknown flag; the language preference may stay), reset the providers' in-memory household lists, and route to "Your account was deleted". Late in-flight responses are dropped by the existing scope guards (`isCurrent`). |

### 5.3 Further cases

- **Duplicate taps:** the button is disabled, and the server request row serializes requests.
- **Two devices:** the second gets 409 `in_progress`, or 401 after completion.
- **Replay of a captured fresh token:** after deletion, 401 because the user is gone. Before deletion, an attacker needs the token within 5 minutes plus a valid session; that is equivalent to a stolen fresh login and is documented as a residual risk.
- **Re-registration with the same email:** gets a new UUID. Nothing is keyed by email, so old request rows and flags cannot affect it. The local unknown flag compares `user_id`.
- **Offline other devices:** lose server access once their JWT expires (≤ 3600 s; PostgREST data access ends at once in practice, because the memberships are gone) and the refresh fails. Their local cache is cleared on their next authenticated refresh failure. **No promise of remote erasure of an offline device.**

## 6. Table-by-table hard-deletion contract

All of this happens in Auth's single deletion transaction, after the guard passes for an eligible graph.

| Data | Effect | Verified by |
|---|---|---|
| `auth.users` (U) | Deleted | D05 |
| `auth.identities`, `auth.sessions`, `auth.refresh_tokens`, `auth.mfa_factors`, `auth.mfa_amr_claims`, `auth.one_time_tokens` | Removed by Auth's FK cascades. [Feasibility FV-B3]: confirm each FK in the deployed auth schema. | D05, D12 |
| `auth.flow_state` rows of U | **Not deleted** (no FK; FV-B3 observed the row surviving a hard delete). They hold U's id and PKCE flow data, not pantry content. See retention R-2b. | D05 |
| `auth.audit_log_entries` | **Retained.** Earlier entries plus the new `user_deleted` entry with user id, email and phone. There is no FK. See the retention table. | Retention R-2 |
| `public.profiles` (U) | Cascade-deleted | D05 |
| `public.pantry_households` (H) | Cascade-deleted | D05 |
| `public.pantry_household_members` (U's, the only row of H) | Cascade-deleted | D05 |
| `public.pantry_items` in H | Cascade-deleted | D05 |
| `public.pantry_shopping_items` in H | Cascade-deleted; links inside H vanish with the rows | D05 |
| Rows elsewhere with `created_by = U` | None exist (G4) | D06 |
| `public.account_deletion_requests` (U) | Cascade-deleted | D05 |
| Storage | Not used; nothing to delete | — |
| Device-local data (this installation) | Cleared by CleanedUp | D13 |
| Other users' rows | Unchanged, byte for byte | D04, D05 |

Application data is **never** deleted in a separate request before the Auth user.

## 7. Retention inventory and restoration

No periods are invented. "Unverified" means it needs a plan or settings read (authorized) or a legal review.

| ID | Category | Data | Role | Period | Deletion mechanism | Justification | Status |
|---|---|---|---|---|---|---|---|
| R-1 | Live application data | Profile, household, pantry, shopping | PantryFlow (controller); Supabase (processor) | Until account deletion | Section 6 | Service | Specified |
| R-2 | Auth audit log | User id, email, phone, IP, actions | Same | Unverified: in-database table with no automatic expiry known; platform log retention by plan | None today. [Owner OD-B4]: periodic purge of entries older than N days, or keep | Security investigation | Unverified, owner decision |
| R-2b | Auth PKCE flow states | User id, flow type and timestamps of past confirmation and recovery flows | Same | Unverified: no FK, so they survive deletion. Whether Auth expires them is unverified | [Owner OD-B7]: accept until provider cleanup is verified, or have the function delete U's `auth.flow_state` rows after a confirmed deletion (needs a reviewed privileged statement) | Flow integrity | Unverified, owner decision |
| R-3 | Supabase platform logs (API, Auth, function) | Request metadata, IPs, no bodies | Supabase (processor) | Unverified (plan-dependent) | Expiry | Operations | Unverified |
| R-4 | Database backups / PITR | Everything in R-1 and R-2 at backup time | Supabase (processor) | Unverified (plan-dependent) | Expiry; restore procedure below | Disaster recovery | Unverified |
| R-5 | Resend delivery records | Recipient email, subject, delivery events | Resend (processor) | Unverified (Resend plan) | Expiry or Resend deletion request | Delivery troubleshooting | Unverified, legal review |
| R-6 | Sentry (future, OPS-01) | Scrubbed crash data, no email | Sentry (processor) | Unverified until OPS-01 | Expiry; per-user deletion only if user ids are ever attached (not planned) | Crash diagnosis | Pending OPS-01 |
| R-7 | Device-local storage | Session, cache, preferences | User's device | Until cleanup or uninstall | CleanedUp on this device; other devices on their next refresh failure | — | Specified |
| R-8 | Support and external requests | Email thread, UUID, outcome | PantryFlow | [Owner OD-B4] | Manual | Proof of fulfillment | Owner decision |

**Restoration and the deletion ledger [Requirement approved, OD-B5, 2026-11-19; design below for review]:**

Requirement: a restored backup never silently brings deleted accounts back into an accessible system.

| Ledger option | Survives a database restore? | New infrastructure | Verdict |
|---|---|---|---|
| A table in the same database | No: rolled back with the restore, losing exactly the deletions that matter | None | Rejected |
| Platform logs | Only within their (plan-dependent, unverified) retention | None | Fallback only |
| **One notification per completed deletion to the owner's mailbox, sent through the existing Resend account** | Yes: stored outside the database | None (Resend already sends Auth email) | **Proposed** |

**Proposed ledger:**
- **Content:** the subject `PantryFlow deletion ledger`, the account UUID and the UTC completion time. No email address, name or other data.
- **When:** sent by the function only after a **confirmed** deletion (a 200 from the Admin API, or reconciliation found the user absent). A ledger entry never exists for an account that still exists, so a restore can't wrongly delete a live account.
- **Failure handling:** up to 3 send attempts within the request. If all fail, the user still gets `deleted` (the deletion is final), and the function logs `ledger_failed` with the UUID. This is the one log line that contains a UUID; function logs are operator-only and short-lived. The owner checks for `ledger_failed` per the operations runbook. Residual: a gap is possible if the logs expire before the check. [Owner OD-B5a]: how often to check.
- **Durability:** the mailbox provider plus Resend's own delivery records (R-5). The two are independent of the Supabase database and its backups.
- **Access:** the owner's mailbox only. Entries are never forwarded to third parties.
- **Retention:** at least the longest database backup or PITR retention plus 30 days, then deleted. The exact figure follows the plan read-back (R-4).
- **Privacy:** the UUID is pseudonymous personal data kept as a minimal fulfilment record. Its lawful basis and retention are part of the legal review, and the privacy notice mentions it (KAN-72).

**Restore procedure** (operations runbook, owner-executed):
1. Restore only into an **isolated** project, never directly into production access.
2. Note the backup or recovery-point timestamp T.
3. Collect the ledger entries with completion time ≥ T − 24 h. The 24-hour overlap covers clock and recovery-point uncertainty.
4. For each UUID present in the restored `auth.users`: insert an `in_progress` request row and run the Admin delete (the guard applies). An ineligible graph goes through the support repair procedure.
5. Verify that none of those UUIDs remain, then open access.
6. If the gap since T exceeds what the ledger and logs cover (for example after a `ledger_failed` whose log has expired), access stays closed pending an owner or legal decision.

**External deletion requests** (no app access) **[Specified]:**
- **Request channel:** the support email published under KAN-72. It is also the web deletion route Google Play requires.
- **Identity check:** the request must come from the account's email address, and the requester confirms by replying to our acknowledgement, which proves mailbox control. App access is never required.
- **Execution:**
  - The operator looks up the UUID once by email at intake and from then on uses only the UUID.
  - The operator inserts an `in_progress` request row, so the guard applies, then runs the Admin delete.
  - The operator records date, UUID and outcome (R-8).
- **Timing:** a reply within the period stated in the privacy notice (KAN-72, legal review).

**Technical guarantees versus legal requirements:**
- This spec states technical behavior.
- These need a separate legal review, which this spec does not provide:
  - whether the retained categories (R-2 to R-5, R-8) and their periods satisfy GDPR and store policy;
  - the response deadlines.

## 8. Tests

These are proposed tests, not a claim that any currently passes. Destructive and concurrency tests run only in a disposable stack. Mocked Admin calls alone are not accepted as proof.

| ID | Requirement | Oracle | Layer |
|---|---|---|---|
| D01 | Missing, malformed or expired bearer | 401; nothing deleted | Function integration |
| D02 | Stolen or refreshed bearer without a fresh password | Token whose `amr` password entry is older than 300 s → 401 `not_fresh`; a client flag in the body → 400 | Function + Auth |
| D03 | Wrong password or Auth outage | App sign-in fails; the function is never called; no temporary session leaks | Comp + Auth |
| D04 | A targets B | Body `{user_id: B}` → 400; B's graph unchanged byte for byte | Function + DB |
| D05 | Eligible hard delete | Every section 6 row matches; B's data unchanged; U's refresh fails; `getUserById(U)` → 404 | Real Auth + DB |
| D06 | Ineligible graphs | Each G1–G4 failure → 409 with its code; nothing deleted (all rows and the audit table unchanged) | Fixture graphs + function |
| D07 | Membership race | Deterministic interleavings with two DB connections and `pg_locks` polling: (a) T2 inserts a membership into H and holds it; T1's guarded DELETE blocks; T2 commits; T1 aborts `extra_members`; full rollback. (b) T1's guarded DELETE holds its locks; T2's insert blocks; T1 commits; T2 fails its FK. | DB, plus one Admin API end-to-end |
| D08 | Ownership, second household and foreign attribution races; deadlock | The same method for each section 4.3 row; a forced deadlock aborts one side without a partial state | DB |
| D09 | Duplicate and replay | Concurrent calls: one `in_progress`, the other 409; replay after deletion → 401 | Function |
| D10 | Failure before commit | Guard exception, or an injected FK failure → 500/409; full graph intact | DB + function |
| D11 | Commit, then lost response | The proxy drops the function's 200 → app Unknown → Reconciling → `user_not_found` → Deleted; re-registering the same email afterwards is unaffected | Function + Comp + Auth |
| D12 | Stale tokens after deletion | Old JWT: PostgREST returns no pantry, shopping or profile rows (memberships gone); Auth `GET /user` → `user_not_found`; refresh fails; the function → 401 | Multi-client API |
| D13 | Local cleanup | After Deleted, restart shows the signed-out screen; no cached rows; late responses dropped | Comp + Native |
| D14 | UX | Cancel before dispatch has no effect; no cancel after; errors announced; English and German; TalkBack | Comp + Native |
| D15 | Unguarded paths unchanged | The existing author-deletion tests (`database.test.cjs`, `shopping.test.sql`, `behavior.integration.ts`) and fixture cleanup pass unmodified | Existing suites |
| D16 | Request table unreachable by clients | As `anon` and `authenticated`: insert, update, delete and select on `account_deletion_requests` are all denied | pgTAP |
| D17 | Guard activation only from the committed row | Delete without a row → existing semantics (D15); with a row older than 5 min → unguarded; with a fresh `in_progress` row → guarded | pgTAP + DB |
| D18 | Freshness claims | Tokens with a `password` entry at 301 s → 401; `recovery`, `otp` or `magiclink` entries only → 401; refreshed token of a 10-minute-old password session → 401; wrong `aud`, `role` or `iss`, anonymous, or missing `session_id` → 401 | Function + Auth |
| D19 | Ledger | A confirmed deletion sends exactly one ledger message with the UUID and time only; a rejected or unknown outcome sends none; send failure → `deleted` response plus a `ledger_failed` log | Function |
| V01 | Diagnostics | Function logs and crash payloads contain no password, token, authorization header or email | Review + test |
| V02 | Restore rehearsal | Disposable restore → re-apply the ledger UUIDs → deleted accounts absent before access opens | Operational exercise |
| V03 | External request | The runbook is executed on a fixture account; the identity check is recorded; another user is unaffected | Manual |
| G01 | Regression | Signup, confirmation, login, CRUD and household-isolation suites green | Existing suites |

**Feasibility verification items** (separate authorization; disposable environment):

| ID | What it checks |
|---|---|
| FV-B1 | **Local: done.** Trigger creation as `postgres` works; it fires for Auth's deletes; ineligible deletions roll back fully, including the audit entry; rows older than 5 minutes don't activate it; clients are denied the request table. **Hosted permission:** open (FV-A1 scope or a separate check). |
| FV-B2 | **Done:** all six interleavings (three patterns, each in both orders) proven blocking through `pg_locks` and `pg_blocking_pids`, with the expected outcomes. Caveat: T1 was a direct SQL delete, while Auth's own path was exercised in FV-B1. |
| FV-B3 | **Done (local v2.198.0):** cascades confirmed, plus `flow_state` without an FK. Hosted schema parity: open. |
| FV-B4 | **Done for Auth:** `iat` changes on refresh while the password timestamp stays, and a new sign-in creates a new timestamp. **Open:** the Edge gateway exposing verified claims, checked when the function is built. |
| FV-B5 | **Done:** raw REST 500 with `P0001 PF_DELETION_INELIGIBLE: <code>`; supabase-js hides it, hence reconcile-always (§5.1). |
| FV-B6 | Rate-limit keying for direct sign-ins compared with sign-ins sent from a function (disposable stack). Hosted keying is recorded as a provider assumption. |

## 9. Slice 4 compatibility

These assumptions must be replaced, not relaxed, before sharing is enabled:

- **Owner deletion with other members:** today G2 rejects it. Slice 4 must choose between ownership transfer and household deletion with member notice, and only then change G2.
- **Ownership transfer:** a new privileged write path that must take the guard's lock order.
- **Non-owner member deletion:** today G1 rejects it (no owned household). Slice 4 must define leaving the household, keeping shared rows with `created_by` set to null, and how the member's attribution is presented.
- **Invitations:** pending invitations to or from U need a defined cascade or revocation. No invitation table exists today.
- **Historical attribution:** G4 becomes a real branch once rows in shared households carry U as creator. The SET NULL semantics already pinned by tests are the likely basis.
- **Concurrent membership operations:** every new membership writer obeys section 4.3's lock order, and the deterministic race tests extend to it.

The present guard stays fail-closed until a reviewed Slice 4 contract replaces it.
