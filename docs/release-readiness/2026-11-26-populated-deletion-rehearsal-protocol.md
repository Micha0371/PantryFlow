# Protocol: deleting a populated test account on hosted (beta line B4)

**Status:** protocol only, 2026-11-26. **Not executed.** Running it needs the owner's separate authorization ([request](2026-11-26-hosted-deletion-rehearsal-request.md)). It closes the gap in the 2026-11-21 rehearsal, whose account held no pantry or shopping items.

**What it shows:** the [interim support path](2026-11-21-interim-reset-deletion-runbook.md) removes a household with data on the hosted project, removes nothing else, and is closed with the requester. What remains afterwards is in the [retention boundaries](2026-11-26-deletion-retention-boundaries.md).

**Tools:** [`readback.sql`](deletion-rehearsal/readback.sql) (read-only, returns counts and hashes) and [`evaluate.cjs`](deletion-rehearsal/evaluate.cjs) (compares before and after: PASS, FAIL or STOP). Their mechanics were checked in memory with [`dryrun.cjs`](deletion-rehearsal/dryrun.cjs); that is not evidence about hosted.

## 1. Preconditions (all, or do not start)

1. **Authorization:** the owner has approved the [request](2026-11-26-hosted-deletion-rehearsal-request.md), naming the date, the operator and the two test addresses.
2. **Target:** hosted project `oiqteedkfwmcertgxqga` only, as in [hosted verification](../testing/hosted-verification.md). No other project is linked in the workdir.
3. **No testers:** the beta has not started, so nobody else is changing data during the rehearsal.
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
- **Without the hosted-configured beta build (B10):** fixtures could be created by the owner with a reviewed SQL insert instead. Then no flow-state row or app session exists, and that part goes unobserved; the evidence must say so.

## 3. Procedure

| Step | Action | Check |
|---|---|---|
| 1 | Fill the eight placeholders in a working copy of `readback.sql`; never commit the copy | — |
| 2 | Run it read-only, as in SEC-02 (`supabase db query --linked --project-ref oiqteedkfwmcertgxqga --workdir <isolated workdir> --file <copy> --output-format json`), saving `before.json` | A leftover placeholder makes the query fail: STOP |
| 3 | `node evaluate.cjs --before-only before.json` | Must print **READY**. Any **STOP** line ends the rehearsal before anything is deleted, for example a second member in H_T, a missing fixture, or an item of T outside H_T |
| 4 | From T's address, email the support contact asking for deletion. The owner runs the requester check of the runbook: reply to the **registered** address, act only on the confirming reply | Record date and time of request, confirmation request and confirming reply (no addresses) |
| 5 | Owner deletes T in the dashboard: Authentication → Users → **Delete user** (runbook step 2) | Record the UTC time and whether the dashboard reported an error |
| 6 | Run the read-back again, saving `after.json`, then `node evaluate.cjs before.json after.json` | **PASS** needs every target count at 0, every O and "rest" value unchanged (counts and row hashes), and no row elsewhere attributed to T |
| 7 | Owner sends the closing confirmation to T's address, with the corrected wording of runbook step 4 | Record the time sent |
| 8 | Owner records date and T's UUID in the support log (runbook step 5); the case is closed | — |
| 9 | Optional, after authorization: one day later, re-run the read-back to see whether T's `auth.flow_state` rows were cleaned up | Recorded, not judged |

**What the read-back covers:**
- **T's Auth records:** user, identities, sessions, refresh tokens, MFA factors, one-time tokens.
- **T's flow states:** recorded only.
- **T's application records:** profile, household, membership, pantry and shopping rows, plus the four fixture rows by ID with their relationships (L linked to P, M unlinked, C completed). It also checks that no row outside H_T is attributed to T.
- **O's records:** account, household and rows, as counts and MD5 hashes of the rows.
- **Everything else:** totals of users, households, pantry and shopping rows outside T and O.

## 4. Expected results and failure handling

- **Expected:**
  - **Removed:** every class-1 and class-2 record of T ([retention boundaries](2026-11-26-deletion-retention-boundaries.md)). A soft delete in the dashboard would leave `auth.users` at 1 and fail the run.
  - **Recorded only:** T's `auth.flow_state` rows. They are expected to remain.
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

- **After a PASS:** delete O through the same support path, with its own read-back.
- **Remaining flow-state rows:** as decided under OD-B7.
- **Local files:** delete the working copy of the SQL and the local password records of both test accounts.
