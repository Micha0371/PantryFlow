# Account lifecycle — overview, threat model and decisions

**Version 0.2, 2026-11-19, for the focused Codex follow-up review.** 0.2 records the owner decisions of 2026-11-19 (section 4).

This page connects the two technical specifications:
- [password policy, recovery and sessions](2026-11-19-password-recovery-session-spec.md) ("password spec", items marked A);
- [account deletion, retention and privileged boundary](2026-11-19-account-deletion-spec.md) ("deletion spec", items marked B).

The authority is the [Slice 3 decision record](2026-11-19-slice-3-decision-record.md), sections 5 and 6.

**Implementation remains NO-GO** until the owner decides the items in section 4, the authorized feasibility items in section 3 are complete, and the Codex follow-up review is done.

## 1. Threat model

| Actor or capability | Asset | Control | Where |
|---|---|---|---|
| Unauthenticated direct API caller | Deletion function, Admin API | Gateway JWT verification, then `getUser` (user and session exist); service key only in the function | Deletion §2, §3 |
| Holder of a stolen or refreshed bearer | Account existence | Fresh `amr` password entry (≤ 300 s) on a live session; a refresh can't create one | Deletion §3 |
| Holder of a stolen session | Password, the owner's other sessions | `update_password_require_current_password` (OD-A4); without it, takeover is possible | Password §4.3 |
| Authenticated A targeting B | B's account and data | Target is always the verified caller; any body field → 400 | Deletion §3 |
| Overlapping or replayed deletions | Re-registered account, partial state | Request row serialization, immutable UUID, read-only reconciliation, no automatic retry | Deletion §5 |
| Concurrent privileged membership or ownership writer | Other members' data | Commit-time guard with row locks inside Auth's deletion transaction; fail closed | Deletion §4 |
| Forged, replayed, wrong-purpose or intercepted reset link | Password, current session | PKCE verifier on this installation; recovery purpose from the local verifier plus `amr`; no exchange while signed in | Password §3 |
| Mass recovery or guessing traffic | Mail quota, privacy | Provider limiters and neutral replies; client cooldown is feedback only | Password §5 |
| Attacker exhausting a shared rate-limit bucket | Everyone's deletion ability | Mechanism B keeps password checks on the phone's address; per-user function limits | Deletion §3 |
| Operator restoring a backup | Deleted accounts | Isolated restore plus an out-of-band UUID ledger re-applied before access | Deletion §7 |
| Diagnostics and logs | Credentials, identifiers | No passwords, tokens, headers, codes or emails in app, function or crash logs | Password R14, deletion V01 |

**Out of scope:**
- a compromised mailbox, which can always reset the password;
- a stolen password;
- a compromised service-role key;
- rooted devices.

These limits stay explicit. They do not justify weakening the controls above.

## 2. Finding disposition

Codex review: original findings H1–H5 and M1–M3; follow-up findings F1–F3.

| Finding | Disposition | Where | Status |
|---|---|---|---|
| H1 Freshness has no server-verifiable contract | Two mechanisms specified. B (fresh sign-in, `amr` password ≤ 300 s, live session, caller-bound, no target field) is recommended over A (password in the function), because of A's shared rate-limit bucket | Deletion §3 | Specified; OD-B1, FV-B4 |
| H2 Household safety and transaction boundary | Exact graph G1–G4; `BEFORE DELETE` guard on `auth.users` with row locks inside Auth's deletion transaction, active only for self-service requests; lock-order rule for privileged writers | Deletion §4 | Specified; OD-B2, FV-B1, FV-B2 |
| H3 Fifteen characters is version-dependent; byte maximum | Code points for the minimum and 72 UTF-8 bytes for the maximum; v2.198.0 or later required (v2.197.0 counts bytes); full boundary table | Password §2 | Blocked on OD-A1, FV-A1, FV-A2 |
| H4 Recovery purpose, active account, restart | State machine; trusted purpose = local recovery verifier plus `amr`; no exchange while signed in; cold-start rule via `amr` and a completion marker | Password §3 | Specified; OD-A3, FV-A3, FV-A4 |
| H5 Uncertain outcomes | Password update: UpdateUnknown reconciled by an explicit isolated sign-in with the intended password (`same_password` is never evidence); no automatic resend, no persistence. Deletion: UUID-bound, function-side read-only reconciliation, app Reconciling via `user_not_found` | Password §3.3; deletion §5 | Specified; FV-B5 |
| M1 Session effects | Provider deletes other sessions in the password transaction; the current one continues; outstanding JWT window documented (≤ `jwt_expiry`) | Password §4.1 | Specified; FV-A6, OD-A8 |
| M2 Retention and restoration | Inventory R-1 to R-8 with no invented periods; isolated restore plus out-of-band ledger; external request runbook | Deletion §7 | Specified; OD-B4, OD-B5; periods unverified |
| M3 Abuse controls and failure UX | Provider versus app enforcement table; neutral recovery for 200 and 429; generic wrong-password errors; one disclosure plus password for deletion | Password §5; deletion §5.2 | Specified; OD-A7 |
| F1 64 characters versus byte maximum | At least 64 ASCII; 18 code points guaranteed for any script; minimum in code points, never silently bytes | Password §2.1, §2.3 | Blocked on OD-A1 |
| F2 Update and revocation failure semantics | Shown atomic in v2.197.0 when the request carries a session id; lost response = UpdateUnknown; `signOut({ scope: 'others' })` kept as an idempotent fallback if a future version changes this | Password §4.1 | Specified; FV-A6 |
| F3 Conditional compromised-password protection | Applicability rule: entitlement read-back, fail-open if enabled, recorded limitation otherwise; no purchase | Password §2.5 | Owner OD-A6; FV-A1 |

## 3. Provider assumptions requiring verification

Each needs separate authorization, in an isolated disposable environment unless it is a hosted read.

| ID | Assumption | Why it matters |
|---|---|---|
| FV-A1 | Hosted Auth version and settings (minimum, requirements, HIBP entitlement, rate limits, `jwt_expiry`, current-password setting) | Policy enforcement and parity. **Hosted read.** |
| FV-A2 | CLI v3.2.0 bundles Auth v2.198.0 (confirmed from the CLI's Dockerfile); P01–P04 pass against it in a disposable stack; project compatibility with CLI 3.x recorded | Local and CI enforcement of code points |
| FV-A3 | Overlapping recovery requests with auth-js 2.119.0 on React Native | Older-link outcome |
| FV-A4 | `amr` `recovery` present after the exchange, after a refresh and after a password update | Cold-start gating |
| FV-A5 | `update_password_require_current_password` configurable locally and on hosted | Stolen-session takeover |
| FV-A6 | Other-session deletion on password update; outstanding-JWT window | Session contract |
| FV-A7 | Signup enumeration behavior with confirmations enabled | Neutral copy |
| FV-B1 | `BEFORE DELETE` trigger on `auth.users` permitted on hosted; its exception aborts the Admin delete | Guard placement |
| FV-B2 | Lock semantics of the guard under the section 4.3 interleavings | Race safety |
| FV-B3 | Auth-schema FK cascades (identities, sessions, refresh tokens, factors, flow state) | Table contract |
| FV-B4 | Fresh isolated sign-in `amr` timestamp; Edge gateway exposes verified claims | Freshness proof |
| FV-B5 | Admin API error shape for the guard exception | Result mapping |
| FV-B6 | Rate-limit keying, direct versus from a function | OD-B1 rate-limit claim |

## 4. Owner decisions

| ID | Decision | Recommendation | Owner status (2026-11-19) |
|---|---|---|---|
| OD-A1 | How the 15 minimum is enforced, given v2.197.0 counts bytes | Require Auth ≥ v2.198.0 everywhere; ship the policy only after FV-A1 and FV-A2 confirm. No client-only check. | **Direction approved**; verify local, CI and hosted before rollout |
| OD-A2 | Maximum = 72 UTF-8 bytes (provider) with the stated guidance | Approve | **Approved** (provider-supported byte maximum) |
| OD-A3 | Reset link while signed in | Block the exchange; offer Stay signed in or Sign out plus a new link. An isolated-exchange variant was rejected: it depends on SDK-internal verifier storage. | **Approved**; native warm, cold and interruption runs required |
| OD-A4 | Enable `update_password_require_current_password` and ship the in-app Change password in Slice 3 | Approve both (the hosted change under separate authorization) | **Direction approved**; exemption verified by R15; no hosted change yet |
| OD-A5 | Hint for legacy short passwords | None in Slice 3 | Open |
| OD-A6 | Compromised-password protection | Read entitlement; enable fail-open if included; otherwise record the limitation; no purchase | Open (decision record: enable when included in the plan) |
| OD-A7 | CAPTCHA on auth forms | Not in Slice 3 | Open |
| OD-A8 | Access-token lifetime | Keep 3600 s and document the window | Open |
| OD-B1 | Freshness mechanism | B: fresh isolated sign-in plus a 300 s `amr` check | **Conditionally approved**: exact checks, temporary sessions, FV-B4 and FV-B6 |
| OD-B2 | Guard scope | Active only for self-service requests (keeps the existing author-deletion semantics and tests); alternative: unconditional guard and rewritten tests | **Conditionally approved**: trusted activation (deletion spec §2.1), concurrency tests |
| OD-B3 | Request limits | 5 per user per 24 h; 5-minute in-flight window | Open |
| OD-B4 | Auth audit-log and support-record retention | Owner and legal to set periods; until then "retained, period undecided" in the privacy notice | Open |
| OD-B5 | Restore ledger | UUID-plus-time notification per deletion to the owner mailbox, kept longer than backups | **Requirement approved**; ledger design in deletion spec §7 for review; OD-B5a: how often to check for `ledger_failed` |
| OD-B6 | Maintenance pause for self-service deletion | A flag row checked by the function (returns 503); used during privileged repairs | Open |

## 5. Implementation sequence

No step starts without owner approval of this package, the Codex follow-up review, and the authorization each step names.

| Step | Work | Depends on | Tickets |
|---|---|---|---|
| 0 | Feasibility verification FV-A1 to FV-B5 in a disposable stack, plus the hosted read-back | Separate authorizations (hosted read; disposable experiments) | KAN-80, KAN-57 |
| 1 | Provider prerequisites: CLI pin with Auth ≥ v2.198.0; hosted version confirmed; settings plan (minimum 15, current-password setting, HIBP per OD-A6); new redirect URL `auth/reset` in local and hosted allow-lists | Step 0; OD-A1, A4, A6. Hosted changes need separate authorization. | KAN-81, KAN-80 |
| 2 | Password policy in the app: shared rule matrix, form feedback, legacy handling, in-app Change password | Step 1 | KAN-80, KAN-81 |
| 3 | Recovery: request screen, `auth/reset` route, state machine, cold-start gating, markers | Step 2 | KAN-42, KAN-54, KAN-55 |
| 4 | Deletion database migration: request table, guard trigger; pgTAP plus deterministic race tests | Step 0 (FV-B1, FV-B2); OD-B2, B3 | KAN-58 |
| 5 | Deletion Edge Function and app flow, reconciliation, local cleanup; deployment under separate authorization | Step 4; OD-B1, B6 | KAN-58, KAN-59 |
| 6 | Retention and public text: privacy notice, external request runbook, restore runbook and ledger | OD-B4, B5; legal review | KAN-59, KAN-72, KAN-78 |
| 7 | Device acceptance (TalkBack, warm and cold recovery, deletion), then Codex and owner review of the implementation | Steps 2–6 | KAN-49 |

The usability work (UX-02, UX-04) proceeds independently and touches different files.
