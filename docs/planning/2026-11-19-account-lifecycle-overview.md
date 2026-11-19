# Account lifecycle — overview, threat model and decisions

**Version 0.8, 2026-11-19.** This version responds to the Codex review of v0.7 (`1c0225e`; `docs/reviews/2026-11-19/specs-v0.7-review.md`, verdict "request changes"):

- **V7-1 (High):** same-account binding of the replacement sign-in.
- **V7-2 (Medium):** recovery when the replacement session is lost.
- **V7-3 (Low):** completion wording.
- **Tests:** R19, R20 and D20 extended; FV-B9 privileges detailed.

Codex: no further deletion-architecture redesign or product-policy decision is indicated. OD-A11 is recommended with the same-account binding, and it remains the owner's decision.

**Version 0.7, 2026-11-19.** This version responds to the Codex review of v0.6 (`4c71e12`; `docs/reviews/2026-11-19/specs-v0.6-review.md`): three High findings and two Medium. Codex judged that the request-bound deletion architecture and the restore selection need no redesign.

| Codex v0.6 finding | 0.7 correction | Where |
|---|---|---|
| V6-1 (High): `session_not_found` isn't a global logout | Only a 204 from `scope=global` with a live session counts. Otherwise **reauth_required**: sign in, then `scope=others` must return 204 [OD-A11, proposed] | Password §3.3, §4.1; decision record A1; R18, R20 |
| V6-2 (High): the marker is written after the crash boundary | `pf.auth.credential_op` is written **before** dispatch, with the phases dispatching → signout_pending → revoked or reauth_required, plus restart rules and interrupted cleanup | Password §3.3; R19 |
| V6-3 (High): the fence cutoff isn't monotonic or clock-safe | Admission needs a **single-use ticket**; every fence clears it. The proof is logical (equality under the row lock), with no clocks | Deletion §5.1; D20 |
| V6-4 (Medium): expiry is 403 `bad_jwt`, not 401 | Proactive refresh at `exp` − 60 s; `bad_jwt` with an expired `exp` → refresh and retry; otherwise the session is unusable | Password §3.3; deletion §3; R18, D23 |
| V6-5 (Medium): the private function isn't reachable over RPC | `public.pf_*` wrappers (`SECURITY INVOKER`, service-role-only `EXECUTE`) around the `private` implementations; the private schema stays unexposed | Deletion §2; FV-B9, FV-B10 |
| Test and verification alignment | D04, D07, D19, D20, D23, R18–R20, FV-A9 (provider and configuration bound with cancellation), FV-B9/B10 (exact boundary); FV-B11 retired | Both specs |

**Version 0.6, 2026-11-19.** This version responds to the Codex review of v0.5 (`ef89b30`; V5-1 to V5-8) and to the owner decisions of 2026-11-19, recorded as **Amendment 1** to the decision record:

- **OD-A10:** close the session.
- **OD-B9:** deletion through a request-bound database function.
- **OD-B8 and OD-B6:** accepted.

**Codex findings V5-1 to V5-8, where 0.6 addresses them:**

| Codex v0.5 finding | 0.6 correction | Where |
|---|---|---|
| V5-1 (High): fencing misses delayed admission and reactivation | `private.delete_own_account(p_user, p_request)` checks the request generation inside its one transaction, so old calls fail `STALE`. Admission requires a password sign-in newer than `fenced_at`. FENCE inserts the row, so there are no zero-row fences | Deletion §2, §4.2, §5.1; D20 |
| V5-2 (High): a pending password update commits after Confirmed | No confirmation after uncertainty: FinalSignOut, and the sign-in screen decides. A late commit is a documented residual, bounded by FV-A9 | Password §3.3; R10c |
| V5-3 (High): TransitionIncomplete restart and adoption retry | Transition removed. The `pf.auth.signout_pending` marker resumes the proven logout on restart, independently of `amr` | Password §3.3; R19 |
| V5-4 (High): SDK sign-out isn't evidence of a 204 | Raw logout, accepting only 204 or 403 `session_not_found`, for both the password and deletion temporary sessions | Password §3.3; deletion §3; R18, D23 |
| V5-5 (High): restore filtering by intent time | Selection by operation lifetime: every unresolved intent regardless of age, plus `deleted` outcomes at or after T − 24 h regardless of intent age; retention counts from the outcome | Deletion §7; V02b |
| V5-6 (High): maintenance admission race | A barrier row: admission and the function read it `FOR SHARE`, and the pause `UPDATE` waits for them and excludes later ones | Deletion §4.3, §5.1; D22 |
| V5-7 (Medium): status can't finish the ledger after deletion | Assigned to operator reconciliation; no automatic claim | Deletion §7 |
| V5-8 (Medium): local sign-out drops retry credentials | Tokens stay in memory, raw logout with retry, orphan documented | Deletion §3; D23 |
| Resend specifics | Bounded retries, an immutable payload with one captured timestamp, the 24 h idempotency window, distinct keys for later resolutions, duplicates tolerated | Deletion §7 |

**Superseded in 0.5 by 0.6:**
- the Transition and Check design (N3/N4 are now addressed by FinalSignOut);
- the Admin-API execution path (N1/N2 are now addressed by request-bound execution). This version responds to the Codex review of baseline `f1028869` (`docs/reviews/2026-11-19/specs-v0.4-review.md`), whose verdict was NO-GO with five High findings, N1–N5.

- 0.5 corrects N1–N8 and the `ab83b0f` delta:
  - deletion guard without expiry;
  - fence-then-lookup quiescence;
  - the session transition after password updates;
  - a crash-safe intent/outcome ledger;
  - the external-request challenge;
  - controlled announcements;
  - one temporary-session lifecycle.
- It adds owner decisions OD-A10 and OD-B8, and updates OD-B6.
- 0.2 recorded the owner decisions; 0.3 added the runtime results from the [feasibility evidence](../testing/2026-11-19-account-lifecycle-feasibility.md).

**Codex findings N1–N8, where 0.5 addresses them:**

| Codex finding | 0.5 correction | Where |
|---|---|---|
| N1 (High) expiry disables the guard | No time condition: `pending` is always guarded, `fenced` is refused, and only users who never had a row are unguarded | Deletion §2, §4.2; D17, D21 |
| N2 (High) "user exists" isn't a rollback proof | FENCE(U) waits for a mid-commit delete (FOR SHARE vs UPDATE) before the lookup; the status request does app reconciliation; `GET /user` 200 is never terminal | Deletion §5.1, §5.2; D11, D20 |
| N3 (High) authentication doesn't prove update or revocation | Transition: an isolated password sign-in, adoption, then an explicit `signOut others`. Confirmed claims only "this password works, others are signed out"; failed checks stay unknown | Password §3.3, §4.1; R10, R10b, R10c, R11 |
| N4 (High) a stolen continuing recovery session | Transition revokes the recovery session server-side before Confirmed. Residuals (theft during RecoveryPending; offline TransitionIncomplete) go to the owner as [OD-A10] | Password §4.3; R15b |
| N5 (High) the ledger crash gap | Intent before dispatch (no intent, no dispatch), outcome after, Resend idempotency keys; unresolved intents block restoration [OD-B8] | Deletion §7; D19, V02 |
| N6 (Medium) external identity | A 128-bit, single-use, 7-day challenge sent to the account address; forged-sender and replay rejection | Deletion §7; V03 |
| N7 (Medium) live region versus announcement limits | A visual line without a live region, plus a controlled `announce()` on state changes; phone TalkBack check | Password §2.6; P13, P13b |
| N8 (Low) temporary-session contradiction | One lifecycle: in memory until a terminal result; orphan on app death documented | Deletion §3, §5.2; D23 |
| Delta `ab83b0f` | `validation_failed` means "too long" only with the over-72-byte context; unknown or post-send failures never say "not changed"; P17 covers SDK-normalized errors | Password §2.6 |

This page connects the two technical specifications:
- [password policy, recovery and sessions](2026-11-19-password-recovery-session-spec.md) ("password spec", items marked A);
- [account deletion, retention and privileged boundary](2026-11-19-account-deletion-spec.md) ("deletion spec", items marked B).

The authority is the [Slice 3 decision record](2026-11-19-slice-3-decision-record.md), sections 5 and 6.

**Implementation remains NO-GO** until the owner decides the items in section 4, the authorized feasibility items in section 3 are complete, and the Codex follow-up review is done.

## 1. Threat model

| Actor or capability | Asset | Control | Where |
|---|---|---|---|
| Unauthenticated direct API caller | Deletion Edge Function, deletion database function | Gateway JWT verification, then `getUser` (user and session exist). The database function has `EXECUTE` for `service_role` only, and the service key lives only in the Edge Function | Deletion §2, §3 |
| Holder of a stolen or refreshed bearer | Account existence | Fresh `amr` password entry (≤ 300 s) on a live session; a refresh can't create one | Deletion §3 |
| Holder of a stolen session | Password, the owner's other sessions | `update_password_require_current_password` (OD-A4); without it, takeover is possible | Password §4.3 |
| Authenticated A targeting B | B's account and data | Target is always the verified caller; any body field → 400 | Deletion §3 |
| Overlapping, delayed or replayed deletions | Re-registered account, partial state | Request generations (`request_id`) checked inside the deletion transaction; admission newer than the last fence; FENCE quiescence; immutable UUID; no automatic retry | Deletion §4, §5 |
| Concurrent privileged membership or ownership writer | Other members' data | G1–G4 with row locks inside the deletion function's transaction; maintenance barrier with pause-and-drain; trigger refuses other paths for users with a request row | Deletion §2, §4 |
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
| H2 Household safety and transaction boundary | G1–G4 with row locks inside `private.delete_own_account`'s single transaction, bound to the request generation (OD-B9); maintenance barrier; trigger backstop | Deletion §2, §4, §5.1 | Specified (Codex 0.5: N1 resolved in design); FV-B9 and D20–D22 to prove |
| H3 Fifteen characters is version-dependent; byte maximum | Code points for the minimum and 72 UTF-8 bytes for the maximum; v2.198.0 or later required (v2.197.0 counts bytes); full boundary table | Password §2 | Blocked on OD-A1, FV-A1, FV-A2 |
| H4 Recovery purpose, active account, restart | State machine; trusted purpose = local recovery verifier plus `amr`; no exchange while signed in; cold-start rule via `amr` and a completion marker | Password §3 | Specified; OD-A3, FV-A3, FV-A4 |
| H5 Uncertain outcomes | 0.6:<ul><li>**Password:** an uncertain outcome claims nothing; FinalSignOut, and the sign-in decides (OD-A10).</li><li>**Deletion:** FENCE (row inserted, generation replaced, waits for an in-flight call) before any terminal "not deleted".</li></ul>No automatic destructive or credential resend | Password §3.3; deletion §5 | Specified; R10, R10b, R10c, D20 |
| M1 Session effects | A recovery or uncertain outcome ends every session with a proven global logout; a confirmed in-app change keeps the current session, with the update's 200 (atomic revocation) as evidence; the outstanding-JWT window is documented | Password §4.1, §4.3 | Specified; R11, R15b, R18, R19 |
| M2 Retention and restoration | Inventory R-1 to R-8; crash-safe intent/outcome ledger with blocking unresolved intents (N5); external challenge (N6) | Deletion §7 | Specified; periods unresolved (OD-B4); OD-B8 |
| M3 Abuse controls and failure UX | Provider versus app enforcement table; neutral recovery for 200 and 429; generic wrong-password errors; one disclosure plus password for deletion | Password §5; deletion §5.2 | Specified; OD-A7 |
| F1 64 characters versus byte maximum | At least 64 ASCII; 18 code points guaranteed for any script; minimum in code points, never silently bytes | Password §2.1, §2.3 | Blocked on OD-A1 |
| F2 Update and revocation failure semantics | Atomic in the provider when the request carries a session id. "Changed" is claimed only on a 200; lost responses go to FinalSignOut `unknown` | Password §4.1 | Specified |
| F3 Conditional compromised-password protection | Applicability rule: entitlement read-back, fail-open if enabled, recorded limitation otherwise; no purchase | Password §2.5 | Owner OD-A6; FV-A1 |

## 3. Provider assumptions requiring verification

Each needs separate authorization, in an isolated disposable environment unless it is a hosted read.

Status after the 2026-11-19 experiments: **done** A2 (Auth behavior), A4, A5 (local), A6, A7, B1 (local), B2, B3 (local), B4 (Auth), B5. **Open:** A1 (hosted read, awaiting authorization), A2 (project suites on CLI 3.x, including a fresh Android regression), A3 (phone), B1 and B3 on hosted (the hosted-read request excludes SQL, so this needs its own scope), B4 at the Edge gateway, B6, and new B7 (Resend idempotency) and B8 (fence lock-timeout inside a function).

**Experiments the Codex review asked for**, proposals only, not run:
- **Guard lifetime:** late delivery with an eligibility change (D21).
- **Delayed-mutation reconciliation:** a held delete against the fence (D20).
- **Password reconciliation:** a lost `same_password`, and a delayed update (R10b, R10c).
- **Ledger crash boundaries** (V02).
- **Auth-operation race** (R17).
- **Admin-path concurrency** beyond B2's direct SQL: membership moves, owner changes, attribution updates (D07, D08).

**Scope of the existing evidence, per Codex:**
- B2 proves direct-SQL lock behaviour for three patterns, not the full Auth/API/function protocol.
- B4 proves Auth's timestamp behaviour, not Edge validation.

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
| FV-B5 | Admin API error shape for the guard exception | Done; superseded by option X (relevant only to the trigger backstop) |
| FV-A9 | The provider's server-side request and statement lifetime (bounds the late-commit residual) | Password §3.3 |
| FV-B9 | A `postgres`-owned function may delete from `auth.users` (local and hosted); `set_config` local scope reaches the trigger | Deletion §2 |
| FV-B10 | PostgREST RPC returns `P0001` code and message to the service-role caller, through the exact `public.pf_*` boundary | Deletion §2, §4.2 |
| FV-B11 | Retired in 0.7 (ticket replaces the clock comparison) | — |
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
| OD-A9 | Signup enumeration (FV-A7: the API reveals existing confirmed accounts) | Accept for Slice 3 and document; keep it explicit and separate from neutral UI wording; revisit with OD-A7 | Open |
| OD-A10 | Session after a password reset or an uncertain outcome | **Close the session:** a proven global logout, then sign-in with the new password; a confirmed in-app change keeps this device signed in | **Accepted 2026-11-19** (decision record Amendment 1) |
| OD-B8 | Unresolved ledger intents at restore | Restoration blocked per unresolved intent. Default completion only with explicit owner approval per UUID, after a request-validity check, with an auditable resolution record | **Accepted 2026-11-19** (Codex conditions included) |
| OD-B9 | Deletion execution path (Codex V5-1) | **Option X:** one service-only database function bound to the request id, instead of the Auth Admin API | **Accepted 2026-11-19** (decision record Amendment 1) |
| OD-A11 | Current session gone before global logout is proven (Codex V6-1, A1 disposition) | A **same-account** sign-in, then `logout?scope=others` from the new session must return 204; stay signed in on that fresh password session; if the replacement is lost, sign in again; no tabs until it's done | **Accepted 2026-11-19, as specified** (decision record Amendment 1, A1) |
| OD-B7 | Orphaned `auth.flow_state` rows after deletion (FV-B3) | Accept until provider expiry is verified; otherwise delete them in the function after a confirmed deletion | Open |
| OD-B6 | Maintenance pause for self-service deletion | Pause plus drain through the admission barrier (deletion §4.3) | **Accepted 2026-11-19** (the requirement; the mechanism is part of v0.6 review) |

## 5. Implementation sequence

No step starts without owner approval of this package, the Codex follow-up review, and the authorization each step names.

| Step | Work | Depends on | Tickets |
|---|---|---|---|
| 0 | Feasibility verification in a disposable stack (the open FV items, including A9, B7–B10, and the Codex-requested interleavings D20–D22, R10c, R18, R19), plus the hosted read-back | Separate authorizations (hosted read; disposable experiments) | KAN-80, KAN-57 |
| 1 | Provider prerequisites: CLI pin with Auth ≥ v2.198.0; hosted version confirmed; settings plan (minimum 15, current-password setting, HIBP per OD-A6); new redirect URL `auth/reset` in local and hosted allow-lists | Step 0; OD-A1, A4, A6. Hosted changes need separate authorization. | KAN-81, KAN-80 |
| 2 | Password policy in the app: shared rule matrix, form feedback, legacy handling, in-app Change password | Step 1 | KAN-80, KAN-81 |
| 3 | Recovery: request screen, `auth/reset` route, state machine, cold-start gating, FinalSignOut with raw logout and the `pf.auth.signout_pending` marker | Step 2 | KAN-42, KAN-54, KAN-55 |
| 4 | Deletion database migration: request table, admission barrier, `private.delete_own_account`, backstop trigger; pgTAP plus deterministic race tests through the function | Step 0 (FV-B1, B2, B9, B10); OD-B2, B3, B9 | KAN-58 |
| 5 | Deletion Edge Function and app flow, reconciliation, local cleanup; deployment under separate authorization | Step 4; OD-B1, B6 | KAN-58, KAN-59 |
| 6 | Retention and public text: privacy notice, external request runbook, restore runbook and ledger | OD-B4, B5; legal review | KAN-59, KAN-72, KAN-78 |
| 7 | Device acceptance (TalkBack, warm and cold recovery, deletion), then Codex and owner review of the implementation | Steps 2–6 | KAN-49 |

The usability work (UX-02, UX-04) proceeds independently and touches different files.
