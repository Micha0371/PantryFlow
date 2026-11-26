# Record: populated-account deletion rehearsal on hosted, 2026-11-26 (beta line B4)

**Result: PASS.** The hosted interim support path removed a household with data, and the records outside T read by the check were unchanged. The cleanup of the control account was checked as well. B4 stays open until the owner accepts the remaining [retention limits](2026-11-26-deletion-retention-boundaries.md) (see [checklist](2026-11-21-beta-entry-checklist.md)).

## Authorization and setup

- **Approval:** the owner approved the [request](2026-11-26-hosted-deletion-rehearsal-request.md) on 2026-11-26 for that day, with the dashboard-and-SQL fixture path (actions 1b and 2b) and the agent running the read-backs.
- **Target:** hosted project `oiqteedkfwmcertgxqga`. Migrations unchanged since the [SEC-02 check](../testing/2026-11-21-sec02-hosted-drift-check.md): no commit touches them after `7b05ce4`.
- **Tools:** at `main` `31b004b`: [protocol](2026-11-26-populated-deletion-rehearsal-protocol.md), [`readback.sql`](deletion-rehearsal/readback.sql), [`evaluate.cjs`](deletion-rehearsal/evaluate.cjs), plus the fixture script [`fixtures.sql`](deletion-rehearsal/fixtures.sql), added with this record and tested in memory before use (8 IDs returned; READY, then PASS after deleting T; refuses a second run, T = O, a leftover placeholder and an unknown user).
- **Read-backs:** agent, through the pinned Supabase CLI 2.122.1 and the owner's existing login, in an isolated workdir built from the config and migrations of `31b004b` (`db query --linked --project-ref oiqteedkfwmcertgxqga --workdir <isolated> --file <filled copy> --output-format json`). The CLI wrote `linked-project.json` only into that workdir; the test stack's `supabase/.temp` holds only `cli-latest`. stderr contained only the login-role and update notices.

## Accounts and fixtures (disposable)

| Placeholder | UUID |
|---|---|
| T (target user) | `a8e98bfe-c7d2-401f-9162-c8e41f86aa89` |
| O (control user) | `ae7c8943-61a7-408c-822c-ccc057e07cac` |
| T's household | `b44f2451-1280-46a4-b7fd-ebf06ca58f76` |
| O's household | `b6ec070b-21c7-4e2b-8012-2b5b45864211` |
| Pantry item P | `93dda9ed-7915-40f2-9d39-ed83c061a536` |
| Linked shopping item L | `e7bbd036-9534-47e5-aaa8-37141cff56c4` |
| Manual shopping item M | `a331c5fa-5621-47f4-a8b1-e021a7b9a440` |
| Completed shopping item C | `c44956a7-c788-43de-96c8-e6032e32e06a` |

The owner created T and O in the dashboard (Add user, auto-confirmed) on two owner-controlled addresses, and ran the filled `fixtures.sql` once in the SQL editor. Item names were neutral test words. No address, password or token is kept here.

## Timeline

Times in UTC. Owner-reported times were given in Berlin time (CET, UTC+1) and are converted. Read-back times come from this machine's clock, which matched GitHub's and Supabase's server clocks to within 7 seconds at 13:44 UTC.

| Step | Time (UTC) | Source |
|---|---|---|
| Read-back before; `evaluate.cjs --before-only`: **READY** | 13:39:23 | Agent |
| T's deletion request to the support contact | 13:37 | Owner |
| Requester check sent to T's registered address | 13:38 | Owner |
| Confirming reply from T's address | 13:39 | Owner |
| T deleted in the dashboard, no error shown | 13:40 | Owner |
| Read-back after; `evaluate.cjs`: **PASS** | 13:42:28 | Agent |
| Closing confirmation sent to T's address, with the corrected runbook step 4 wording | 13:43 | Owner |
| O: request, check, reply, deletion (cleanup) | 13:43, 13:44, 13:45, 13:46 as reported | Owner |
| Cleanup read-back: O gone, rest unchanged | 13:44:04 | Agent |

**Timing discrepancies:**
- **The before read-back ran during T's requester exchange,** not before it as the protocol orders. T was still present and complete at that time, so the before state is valid.
- **O's reported deletion time (13:46) is later than the cleanup read-back (13:44:04),** which already showed O gone. The read-back time is the binding bound: O was deleted before 13:44:04 UTC. The owner's times for O are approximate.

## Results

**Before** ([JSON](deletion-rehearsal/run-2026-11-26/before.json), [evaluator](deletion-rehearsal/run-2026-11-26/evaluate-before-only.out)): READY.
- **T:** Auth user 1, identity 1; no sessions, refresh tokens, MFA factors, one-time tokens, flow states or audit entries.
- **T's fixtures:** profile 1, household 1, membership 1, the household's only member; pantry item 1, shopping items 3, with the four fixture relationships as specified.
- **O:** user, identity, profile, household and membership, 1 each; 1 pantry and 1 shopping item.
- **Outside T and O:** 3 users, 3 identities, 3 profiles, 3 households, 3 memberships, 1 pantry item, 0 shopping items.

**After** ([JSON](deletion-rehearsal/run-2026-11-26/after.json), [evaluator](deletion-rehearsal/run-2026-11-26/evaluate-before-after.out)): **PASS**.
- **Removed:** every counted record of T. That is the Auth user and identity, profile, household, membership, the pantry item and all three shopping items.
- **Unchanged:** every count and row hash of O and of the rest.
- **Recorded:** T's flow states 0 before and after; audit entries naming T 0 before and after.

**Cleanup** ([JSON](deletion-rehearsal/run-2026-11-26/cleanup.json)), checked by hand as the protocol requires:
- every count of O is 0, and O's row hashes are those of no rows;
- every "rest" count and hash equals the before state;
- T is still gone.

## What this settles, and what not

**Settled for this project on 2026-11-26:**
- The dashboard's **Delete user** performs a hard delete: the `auth.users` row is gone. It cascades to `auth.identities` and to all PantryFlow application rows of a household with a pantry item and linked, manual and completed shopping items.
- Nothing else that the check reads was changed.
- Dashboard-created users have an identity row.

**Not settled:**
- **Sessions, refresh tokens and flow states:** T had none, because the account was created in the dashboard, not through the app. Their removal and the flow-state boundary remain as recorded in the [retention boundaries](2026-11-26-deletion-retention-boundaries.md).
- **Audit entries:** the 0 is consistent with hosted not storing them in the database, but doesn't prove it. The dashboard may not write an entry.
- **Records outside the database:** provider logs, Resend's delivery records and the support correspondence were not inspected.
- **The app sign-up path:** not exercised; that needs the KAN-77 build.

## Cleanup and privacy

- **Not kept:** the filled-in SQL copies were deleted after the run, and no addresses, passwords, item names or screenshots are in the evidence.
- **Still with the owner:** the two test mailboxes, their passwords, and the support-log entries (date and UUID).
