# Protocol: deleting a populated test account on hosted (beta line B4)

**Status:** protocol, 2026-11-26. **Executed once on 2026-11-26** with the owner's authorization, by the dashboard-and-SQL fixture path ([`fixtures.sql`](deletion-rehearsal/fixtures.sql)): **PASS** ([record](2026-11-26-populated-deletion-rehearsal-record.md)). Any further run needs a new authorization ([request](2026-11-26-hosted-deletion-rehearsal-request.md)). It closes the gap in the 2026-11-21 rehearsal, whose account held no pantry or shopping items.

**What it shows:** whether the [interim support path](2026-11-21-interim-reset-deletion-runbook.md) removes a household with data on the hosted project, and whether the request is closed with the requester. It also shows that the records it reads outside the target stay unchanged: the control account's Auth user, identities, sessions and application rows, and the other accounts' users, identities, profiles, households, memberships, pantry and shopping rows (counts, and hashes of the application rows). Records it does not read are listed in section 4. What remains afterwards is in the [retention boundaries](2026-11-26-deletion-retention-boundaries.md).

**Tools:** [`readback.sql`](deletion-rehearsal/readback.sql) (read-only, returns counts and hashes) and [`evaluate.cjs`](deletion-rehearsal/evaluate.cjs) (compares before and after: PASS, FAIL or STOP). Their mechanics were checked in memory with [`dryrun.cjs`](deletion-rehearsal/dryrun.cjs); that is not evidence about hosted.

## 1. Preconditions (all, or do not start)

1. **Authorization:** the owner has approved the [request](2026-11-26-hosted-deletion-rehearsal-request.md), naming the date, the operator and the two test addresses.
2. **Target:** hosted project `oiqteedkfwmcertgxqga` only, as in [hosted verification](../testing/hosted-verification.md). No other project is linked in the workdir.
3. **No other activity:** the beta has not started, nobody else signs up or changes data during the rehearsal, and **O is signed out before the first read-back, or its app stays closed, and nobody signs O in or out until after the second** (a sign-in or sign-out changes O's session count; the app writes the profile language at start, which changes O's hash).
4. **Two disposable accounts,** on addresses the owner controls and that belong to no real person:
   - **T (target),** to be deleted;
   - **O (other),** an unrelated account in its own household that must stay unchanged.
5. **Migrations unchanged** since the [SEC-02 check](../testing/2026-11-21-sec02-hosted-drift-check.md) (00001–00004), or SEC-02 repeated first.

## 2. Fixtures

| Account | Rows | How |
|---|---|---|
| T | Auth user, profile, household H_T, one membership (created by sign-up) | Sign up in the app (preferred: also creates the PKCE flow-state row and a session) |
| T | One pantry item P in H_T | Added in the app |
| T | Shopping item L **linked** to P | Added through the low/out prompt in the app |
| T | Shopping item M, **manual** | Added on the Shopping tab |
| T | Shopping item C, **completed** | Added and checked off |
| O | Auth user, profile, household H_O, membership, at least one pantry and one shopping item | Same way, on the second address |

- **Item names:** neutral test words only (for example "Test milk"), never real content.
- **IDs:** the operator records the UUIDs of T, H_T, O, H_O, P, L, M and C, read from the database by the read-back, not typed from memory.
- **Expected before the deletion (app sign-up path):** T has at least one identity, one session and one flow-state row. `evaluate.cjs` requires an identity; it prints the before value of every Auth count, so a zero shows in the evidence.
- **Without the hosted-configured beta build (B10):** fixtures could be created by the owner with a reviewed SQL insert instead (a separate option in the request). Then no session or flow-state row exists, and that part goes unobserved; the evidence must say so.

## 3. Procedure

| Step | Action | Check |
|---|---|---|
| 1 | Fill the eight placeholders in a working copy of `readback.sql`; never commit the copy | — |
| 2 | Run it read-only, as in SEC-02 (`supabase db query --linked --project-ref oiqteedkfwmcertgxqga --workdir <isolated workdir> --file <copy> --output-format json`), saving `before.json` | A leftover placeholder makes the query fail: STOP |
| 3 | `node evaluate.cjs --before-only before.json` | Must print **READY**. Any **STOP** line ends the rehearsal before anything is deleted, for example a second member in H_T, a missing fixture, or an item of T outside H_T |
| 4 | From T's address, email the support contact asking for deletion. The owner runs the requester check of the runbook: reply to the **registered** address, act only on the confirming reply | Record date and time of request, confirmation request and confirming reply (no addresses) |
| 5 | Owner deletes T in the dashboard: Authentication → Users → **Delete user** (runbook step 2) | Record the UTC time and whether the dashboard reported an error |
| 6 | Run the read-back again, saving `after.json`, then `node evaluate.cjs before.json after.json` | **PASS** needs every counted target record at 0 and every O and "rest" value unchanged (counts and row hashes). A FAIL on an O or "rest" value is first checked against activity that could explain it (for example an unplanned sign-up) before it is reported as an incident |
| 7 | Owner sends the closing confirmation to T's address, with the corrected wording of runbook step 4 | Record the time sent |
| 8 | Owner records date and T's UUID in the support log (runbook step 5); the case is closed | — |
| 9 | Optional, after authorization: one day later, re-run the read-back to see whether T's `auth.flow_state` rows were cleaned up | Recorded, not judged |

**What the read-back covers:**
- **T's Auth records:** user, identities, sessions, refresh tokens, MFA factors, one-time tokens.
- **T's flow states:** recorded only.
- **T's application records:** profile, household, membership, pantry and shopping rows, plus the four fixture rows by ID with their relationships (L linked to P, M unlinked, C completed). It also checks that no row outside H_T is attributed to T.
- **T's audit entries:** entries in `auth.audit_log_entries` naming T, recorded only.
- **O's records:** Auth user, identities and sessions; profile, household, memberships, pantry and shopping rows, as counts and MD5 hashes of the application rows.
- **Everything else:** users, identities, profiles, households, memberships, pantry and shopping rows outside T and O, as counts and MD5 hashes of the application rows. Sessions and refresh tokens outside T are not counted.
- **Preconditions:** T and O are different accounts, H_T has one member, T has one membership, and no row outside H_T is attributed to T.

## 4. Expected results and failure handling

- **Expected:**
  - **Removed:** T's application rows and the Auth records the read-back counts: user, identities, sessions, refresh tokens, MFA factors and one-time tokens. A soft delete in the dashboard would leave `auth.users` at 1 and fail the run.
  - **Not read:** other Auth tables that FV-B3 found cascading locally. Session MFA claims (`mfa_amr_claims`, one per session) cascade from the sessions, which are counted. WebAuthn and recovery-code records are not used by PantryFlow. Their removal is not shown directly.
  - **Not judged by the read-back:** whether a row elsewhere was attributed to T. Only the precondition (no such row before) means something, because the deletion clears the attribution.
  - **Recorded only:** T's `auth.flow_state` rows (expected to remain) and audit entries naming T in `auth.audit_log_entries` (FV-A1 says hosted does not store them there; a count above 0 means it does, and the retention boundaries must be corrected).
  - **Unchanged:** O, and the rest of the project.
- **FAIL:** do not retry the deletion and do not repair rows by hand.
  - Save both JSON files and note which rules failed.
  - Leftover rows of T are disposable test data. Removing them is a hosted write that needs its own authorization.
  - **Any change to O or to the rest is an incident:** stop all hosted work and tell the owner. There are no backups, so it cannot be undone.
- **Dashboard error with T still present:** the read-back shows what happened. A complete T is a clean failure; a partial T is a FAIL as above.
- **Interrupted after step 5:** run step 6 as soon as possible. The before file is still valid.

## 5. Evidence to keep

**Keep:** `before.json` and `after.json`, which hold only entity names, counts and MD5 hashes. Also the evaluator output, the UTC times of steps 4–8, the operator, and the commit of `readback.sql` and `evaluate.cjs`. The eight UUIDs belong to disposable test accounts and are kept to bind the evidence.

**Never keep:** passwords, tokens, keys, email addresses, item names, screenshots with personal data, or the filled-in SQL copy.

## 6. Cleanup

- **After a PASS:** delete O through the same support path. `evaluate.cjs` cannot judge this, because O has no full fixture set and no control account remains: run `readback.sql` once more with the same placeholders, and check by hand that every "other" count is 0 and every "rest" value is unchanged.
- **Remaining flow-state rows:** as decided under OD-B7.
- **Local files:** delete the working copy of the SQL and the local password records of both test accounts.
