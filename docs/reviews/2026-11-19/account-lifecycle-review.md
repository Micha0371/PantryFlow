# PantryFlow account lifecycle: independent specification review

**Follow-up:** PR #48's decision record became available after this initial assessment. Read [the follow-up review](decision-record-followup-review.md) for the current verdict. It supersedes the open session-policy and hard-delete decisions below; the original technical analysis remains available as dated evidence.

Reviewed 2026-11-19. Reference: `33d45b0b3fbe9b57a8d4f0550a0d82881c11678f` in `Micha0371/PantryFlow`.

## 1. Executive summary

**NO-GO for implementation against the material currently available.** The approved product direction is reasonable, including a narrow Edge Function and Auth Admin API for deletion. The missing piece is an implementable, approved lifecycle contract. This is not a rejection of that architecture or a finding that an existing deletion implementation is vulnerable.

The attachment is a review brief, not a detailed proposed design. At the reference commit I found the application, schema, existing confirmation tests and generic Jira/backlog requirements, but no completed account-lifecycle specification. Read-only Jira retrieval found KAN-42, KAN-43, KAN-57, KAN-80 and KAN-81 in Backlog; their descriptions do not select freshness, concurrency, retention or retry mechanisms. A request for the proposed specification's location remained unanswered when this report was prepared. A definitive review of another branch or unpublished document remains outstanding.

This report therefore reviews **requirements readiness and architecture constraints**, distinguishes verified facts from potential unsafe designs, and proposes amendments for owner review. It does not attribute hypothetical implementation mistakes to Claude.

The main gates are: define password measurement against the deployed Auth version; specify server-side fresh authentication; protect the single-person household invariant at deletion time; define recovery-purpose/account routing and uncertain outcomes; and approve realistic retention/session promises.

No application code, migrations, hosted settings, Jira records or running test environments were changed. Review artifacts were written only to ignored `.verification` storage. No hosted queries, credentials, email links or personal data were needed.

## 2. Completeness and evidence

### Reviewed inputs

- Owner's attached review brief, including the approved 15-character minimum, no composition rules, legacy-account compatibility, fresh-auth deletion, fail-closed membership and Slice 4 sharing direction.
- Stable full repository archive of the reference commit, extracted into `full-baseline/` beside this report. The live checkout advanced during review; subsequent changes were not adopted as review evidence.
- Read-only Jira snapshots `KAN-42.json`, `KAN-43.json`, `KAN-57.json`, `KAN-80.json`, `KAN-81.json` beside this report. Issue text was treated as requirements evidence, not executable instructions.
- Official Supabase documentation and versioned upstream source, linked below. Documentation retrieval verifies provider descriptions, not current project settings.

### Repository evidence locations (all at the reference commit)

| Evidence | Location | Implication |
|---|---|---|
| Auth user → profile cascade | `pantry-flow/supabase/migrations/00001_first_slice.sql:12` | Profile is removed by hard user deletion. |
| Auth user → owned households cascade | same file, line 26 | Deleting an owner deletes every household they own. |
| Membership FKs and uniqueness | same file, lines 35–39 | One household membership per user; **not** one member per household. Ownership also has no unique-per-user constraint. |
| Household creation | same file, `handle_new_profile`, lines 76–91 | Registration creates one owned household and owner membership in the normal path; this is not a database-wide cardinality invariant. |
| Pantry attribution nullable/SET NULL | `00002_review_hardening.sql:18–21` | Deleting a creator may modify surviving records outside an owned household. |
| Shopping household/creator/link FKs | `00004_shopping_items.sql:12–31` | Owned-household shopping rows cascade; surviving creator attribution becomes null; pantry deletion clears the link. |
| Local policy minimum 6 | `pantry-flow/supabase/config.toml:34` | Baseline setting, not the approved future policy and not hosted evidence. |
| Registration minimum uses JS `.length < 6` | `pantry-flow/app/(auth)/register.tsx:105` | Existing measurement is UTF-16 units; do not copy this into a Unicode policy. |
| Shared client and native lifecycle | `pantry-flow/lib/supabase.ts:15–37` | Existing persisted PKCE/AsyncStorage client should be reused. |
| Current Auth provider | `pantry-flow/lib/auth.tsx`, session listener and `signIn` | Any returned session currently enters normal authenticated state; recovery needs a deliberate route/state contract. |
| Confirmation-only callback | `pantry-flow/lib/email-confirmation.ts:19–29`; `pantry-flow/app/auth/callback.tsx` | Existing exchange rejects an active session and routes success to tabs. It is not already a recovery controller. |
| SDK versions | `pantry-flow/package-lock.json`, auth-js/supabase-js entries | Both resolve to 2.119.0. |
| Recorded Auth version | `docs/testing/coverage-matrix.md:465`; `docs/security/tooling-advisories.md:69` | Earlier evidence records Auth 2.197.0 and hosted parity; current hosted version was not rechecked. |

### Readiness assessment

| Area | Present | Missing before implementation |
|---|---|---|
| Password policy | Minimum 15, no composition; legacy access preserved | Definition of character, byte maximum, version parity, legacy warning handling and rollout/read-back steps |
| Recovery | Generic privacy, link and native acceptance requirements | Recovery state machine, account-switch policy, interrupted update reconciliation, exact session effects |
| Deletion | Fresh-auth and narrow server boundary directions | Verifiable authentication mechanism, exact affected-row predicate, race protection, hard/soft mode and uncertain-result handling |
| Retention | Requirement to tell the truth | Data/processor inventory, actual periods, backup restoration and external-request procedure |
| Testability | Existing reusable harness | Concrete oracles for freshness, concurrency barriers, provider boundaries and lifecycle transitions |

## 3. Findings register

**Severity describes the risk of implementing with the gap unresolved.** No Critical defect is established in a supplied detailed design, because none was available. Eight material gaps follow: five High, three Medium.

### H1 — The deletion freshness requirement has no server-verifiable contract

**Evidence:** brief and KAN-57 require recent authentication but do not select how it is proven. A signed JWT, `getUser()`, recent token `iat`, client confirmation flag or another session's `last_sign_in_at` is not sufficient evidence of a fresh password check by this caller. Refresh can issue a new token without password entry. Supabase `reauthenticate()` sends an OTP; its mere invocation is not a deletion authorization proof. [Session semantics](https://supabase.com/docs/guides/auth/sessions), [reauthenticate reference](https://supabase.com/docs/reference/javascript/auth-reauthenticate).

**Consequence:** an implementer could accidentally allow a stolen old bearer token to delete the account through direct invocation.

**Correction:** select a mechanism and define subject/session binding, accepted method, age, replay rules, rate limits and revoked-session behavior. The smallest password-account candidate is a password check performed by the deletion Edge Function against Auth, using the validated caller's identity, verifying the returned user ID equals that caller, and deleting within that request. Use a separate non-persisting Auth client for verification so temporary sessions never replace the caller/admin client. Define cleanup of any temporary verification session. Fail closed when Auth is unavailable. Do not log passwords or return verification tokens. Alternatives require an equally explicit proof contract; a client assertion is insufficient. Define how a just-recovered user becomes eligible, without inventing another account-recovery system.

### H2 — Single-person household safety and deletion transaction boundaries are unspecified

**Evidence:** 00001's `UNIQUE(user_id)` permits multiple users in one household. Owner deletion cascades every owned household. No proposed transaction/locking mechanism is in KAN-57. Normal authenticated clients currently have no membership-write policy, reducing today's exposure, but privileged tools and future sharing can create unexpected state.

**Consequence:** a count performed by Edge followed by `admin.deleteUser()` has a time-of-check/time-of-use gap. A second member introduced in between could lose data. A separate RPC transaction/lock does not extend into the later Admin API request.

**Correction:** define an exact allowed graph, preferably one owned household, exactly the caller's owner membership, no other members, and explicit rules for missing/extra households and foreign creator attribution. Inspect the full graph with server privileges; the caller's RLS membership view cannot establish absence of other members. Put the fail-closed predicate in the destructive database transaction, or provide an equivalent proven exclusion protocol spanning all ownership/membership writers. A tightly scoped database guard invoked by Auth's hard delete is a candidate; its locks and concurrent insert/update behavior need proof. A trigger that only counts rows is not automatically race-safe. Concurrent privileged repair operations must obey the protocol or run under an explicit maintenance exclusion.

### H3 — Fifteen “characters” is version-dependent, and the maximum is byte-limited

**Evidence:** Auth 2.197.0's `checkPasswordStrength` uses Go `len(password)` for the minimum and the 72 maximum, which counts UTF-8 bytes. Current upstream `master` uses Unicode rune count for the minimum but still bytes for the maximum. JS `.length` measures UTF-16 units. Therefore setting a minimum of 15 cannot be assumed to mean the same thing in all environments. [Versioned source](https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/password.go), [current upstream source](https://raw.githubusercontent.com/supabase/auth/master/internal/api/password.go).

**Consequence:** on the recorded older version, five four-byte emoji exceed 15 bytes while containing only five code points. UI-only code-point validation could be bypassed through direct Auth calls. Conversely 19 such emoji exceed the 72-byte maximum despite being fewer than 72 visible characters. Upstream code is not proof of hosted deployment.

**Correction:** explicitly choose Unicode code points (recommended interpretation for approval), or another clearly explained metric, and record the actual supported byte maximum. Verify deployed and disposable Auth versions and direct signup/reset/update enforcement. If the current provider cannot enforce the chosen minimum, resolve provider/version support before implementation; do not silently redefine the approved requirement as bytes or add a bypassable UI-only check. No trimming, truncation, normalization or composition rule is implied. Document the unavoidable supported maximum clearly in EN/DE. Test boundary values rather than copying provider error wording.

### H4 — Recovery purpose, active-account handling and restart states are not specified

**Evidence:** KAN-42 lists outcomes but no routing/session protocol. The current callback accepts a code, exchanges it, and opens tabs; its active-session guard is confirmation-specific. The shared Auth listener treats sessions uniformly.

**Consequence:** blindly reusing confirmation behavior can reject recovery for an existing session, expose the pantry before password update, or replace another signed-in account unexpectedly. A query parameter alone is not trusted proof of recovery purpose.

**Correction:** define recovery-pending state, its trusted source and restoration, the account shown on password update, and behavior when A is signed in and a link for B arrives. Specify same-user session behavior too. A dedicated reset route can share PKCE primitives and existing UI components; it need not duplicate the Auth provider. Wrong-purpose links must not trigger a reset. Require provider/SDK-derived recovery evidence and define cold-start handling when the transient event is not observed. Do not assume a route name secures Auth's password-update API: document what the provider permits for any authenticated user, separately from recovery-screen gating. Test public-API behavior and UI behavior independently.

### H5 — Destructive and credential-changing requests lack uncertain-outcome contracts

**Evidence:** KAN-42/43 require retry/interruption coverage but do not define committed-with-lost-response states, duplicate deletion serialization or reconciliation after credentials cease to work.

**Consequence:** retries could target a re-registered account if keyed by email, report deletion failure after successful removal, or leave a live account without its data if app cleanup precedes Auth deletion.

**Correction:** bind deletion to the immutable validated user UUID, never an email lookup or request-body target. Select hard deletion explicitly. Keep application cascades and Auth deletion in the same database transaction; do not first erase household rows in separate calls. Define duplicate calls and a minimal reconciliation/support path after a lost response. No automatic destructive retry after ambiguity. If a retained operation receipt is chosen, define its access control, retention and privacy cost; a generic job service is not required. A new UUID for the same email must never be affected by an old operation. Password update needs an uncertain state too: don't keep plaintext for retry, assert failure, or silently submit it again after restart.

### M1 — Session effects and immediate-access promises are undefined

**Evidence:** KAN-42 explicitly leaves other-session handling to the policy. Provider deletion removes refresh capability, but an already issued JWT remains cryptographically valid until expiry. [User-management guidance](https://supabase.com/docs/guides/auth/managing-user-data).

**Consequence:** “signed out everywhere immediately” would overpromise; recovery may leave an attacker with a usable session if the policy is not selected.

**Correction:** approve current versus other refresh-session behavior after reset/update, define the outstanding-token window, and require a current server session check for deletion. For this schema, removed memberships should deny pantry/shopping access even with an old token; verify it directly, including profiles and the Edge endpoint. Review each API surface instead of assuming all signed JWTs fail immediately. Don't add broad per-request infrastructure without a demonstrated gap.

### M2 — Retention promises lack an inventory and restoration contract

**Evidence:** KAN-57 asks for a matrix; none was supplied. The Auth deletion implementation itself creates an audit entry containing user identifiers, so hard deletion alone cannot promise removal from every diagnostic record. [Versioned Admin handler](https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/admin.go).

**Consequence:** user-facing wording may promise immediate, universal erasure while backups, audit records, delivery processors or offline app storage retain data. Restoring a backup can restore deleted rows.

**Correction:** document live tables, Auth audit/configured logs, application telemetry, Resend delivery data, backups, local persistence and support requests. Assign a verified period or explicitly unresolved owner to each. Define backup expiry, restore quarantine/reapplication of deletions, and deletion-ledger retention if used. Distinguish local cleanup on the current device from another offline device's cache. An external request requires identity verification without demanding an inaccessible account. Legal obligations and acceptable periods require owner/legal verification; this report supplies no legal-compliance conclusion or invented number of days.

### M3 — Abuse controls and user-visible failure behavior lack measurable criteria

**Evidence:** KAN-42/80 ask for privacy-preserving responses, localization and interruption coverage, but do not specify server throttles, cooldown semantics or accessible destructive UX.

**Consequence:** recovery can disclose existence through different UI states or become a mail-abuse channel; password verification can become a brute-force oracle; a destructive action may appear to succeed while offline.

**Correction:** define endpoint-side limits, provider-limit handling, neutral known/unknown recovery replies, generic wrong-password failures and actionable service-unavailable errors. A client timer is feedback, not enforcement. Do not claim constant-time enumeration resistance without measuring provider behavior. Preserve paste/autofill, do not trim passwords, announce errors, retain safe form input, and localize EN/DE. One clear destructive disclosure plus the necessary authentication action is sufficient; extra typed phrases or repeated dialogs require justification. Cancel before submission changes nothing; cancel after dispatch cannot promise rollback.

## 4. Threat model

| Actor/capability | Asset/boundary | Required control |
|---|---|---|
| Unauthenticated caller/direct API client | Edge/Admin access | Validate bearer server-side; reject absent/invalid identity; no privileged key in bundle |
| Stolen old or refreshed bearer | Account existence | Independent fresh authentication, session validity, subject binding |
| Malicious authenticated A sends B's ID/email | B's account/household | Server derives target solely from authenticated subject; reject/ignore targeting fields by explicit contract |
| Replayed or overlapping delete requests | Re-registered account, operation state | Immutable UUID binding, serialization/reconciliation, no blind retry |
| Concurrent privileged membership/ownership edit | Other household users' data | Commit-time predicate plus proven locking/exclusion, fail closed |
| Forged, replayed, wrong-purpose or intercepted email link | Password/session | PKCE and trusted recovery context; no URL logging; safe active-account policy |
| Automated reset/password-guess traffic | Mail quota, account privacy | Server/provider throttling and neutral replies |
| Operator restoring backup or inspecting logs | Deleted identifiers | Retention/restore runbook, restricted access, minimal diagnostics |

Password theft, compromised mailboxes, a compromised server secret and rooted phones cannot be eliminated by these flows. Keep those trust limits explicit without weakening the controls above. A recovery email authorizes only the documented provider-supported recovery flow; it is not automatically a general deletion approval.

## 5. Lifecycle and state transitions

### Recovery

`signed out / signed in → request pending → neutral sent-or-unavailable → valid recovery callback → recovery pending → password update pending → confirmed success`.

Alternative transitions must be explicit:

- Unknown address: same public sent response; no local user-existence flag.
- Invalid/expired/replayed/wrong-purpose callback: recovery instructions, no password update and no unintended account replacement.
- Cold start: restore verifier and trusted recovery context, or show a recoverable failure; never infer authorization from route parameters alone.
- Missing verifier/different installation/overlapping requests: explain requesting a new link on this device. Do not disable PKCE to make old links work.
- Cancel/restart before update: leave password unchanged; decide whether the recovery session remains and what screens it can reach.
- Connection loss during update: show uncertain outcome and a safe login/recovery route; no automatic password replay or plaintext persistence.
- Confirmed update: new password accepted, old password rejected; current/other sessions follow the approved contract.

### Deletion

`authenticated → disclosure/consent → fresh authentication → eligibility validation → atomic hard deletion → local cleanup → signed-out completion`.

- Rejected freshness, unexpected graph, revocation or Auth outage: no destructive writes.
- Graph changes during operation: serialize safely or reject/rollback; do not delete another member's data.
- Definite transaction rejection: account and application data remain as before.
- Timeout after dispatch: **unknown**, not successful or safely failed; use the chosen bounded reconciliation path.
- Committed deletion: Auth user and owned live-data graph absent; unrelated users/households preserved; refresh credentials unusable. A stale JWT is tested against actual authorization.
- Restart/offline device: clear that installation's credentials/data when deletion is confirmed or invalidation is detected; do not promise remote offline erasure.
- Re-registration: new UUID and new household; no historical operation can target it.

### Per-table deletion contract to approve

| Data | Current hard-delete consequence | Required decision |
|---|---|---|
| Auth user and linked Auth records | Provider hard-delete lifecycle | Explicit hard mode; verify sessions/identities/factors and relevant provider version |
| Own profile | Cascade | Must be absent after commit |
| All owned households | Cascade | Permit only approved graph; don't assume ownership cardinality |
| Household memberships | User and household cascades | Detect unexpected other members before allowing destructive commit |
| Pantry and shopping in deleted household | Cascade | Delete as part of same transaction |
| Pantry/shopping created by caller elsewhere | Creator becomes NULL | Fail closed on unexpected graph or explicitly approve this effect; unrelated row contents must survive |
| Shopping links to removed pantry entries | Link becomes NULL | Verify surviving rows are preserved; do not describe this as deleting the shopping row |
| Audit/logs/backups/vendor mail/local cache | Not established by FKs | Separate verified retention/cleanup rules |

Slice 4 must replace this single-person eligibility contract before enabling sharing. Owner transfer, member departure, owner deletion with remaining members and attribution preservation require separate decisions. Do not implement sharing now or silently relax the deletion guard later.

## 6. Requirements-to-test traceability

These are **proposed tests**, not a claim that they currently pass. Reuse Node/component, disposable Supabase/API/pgTAP and native Maestro/device layers. Run future destructive/concurrency tests in a separate disposable environment, not Claude's stack or the hosted project. “A/B” below are isolated fixture accounts.

| ID | Requirement/scenario | Observable oracle | Layer / finding |
|---|---|---|---|
| P01 | 14/15 ASCII, no composition | Signup/update rejects 14, accepts approved 15-character passphrase | Direct Auth + UI / H3 |
| P02 | Unicode length metrics | Code points, UTF-16 units and UTF-8 byte boundary cases match approved contract, including emoji and combining marks | Unit + direct Auth / H3 |
| P03 | Supported maximum | 72/73 UTF-8 bytes and multi-byte equivalents accepted/rejected as specified; no truncation | Direct Auth / H3 |
| P04 | Direct bypass | Signup, recovery update and authenticated update cannot bypass policy using raw public API | Auth / H3 |
| P05 | Legacy compatibility | Existing short password still logs in; optional weakness warning does not become login failure; new password must comply | Auth + component / H3 |
| P06 | Password manager/whitespace | Paste/autofill and exact leading/trailing spaces preserved; EN/DE guidance accurate | Component + native / M3 |
| P07 | Environment parity | Recorded versions/settings and boundary behavior agree locally and in separately authorized staging | Config + API / H3 |
| R01 | Known/unknown request | Same neutral response/state, no existence flag; legitimate user receives mail | API + UI / M3 |
| R02 | Throttling/outage | Repeated/direct requests bounded; cooldown and retry work; no false sent/success claim on explicit outage | API + component / M3 |
| R03 | Warm/cold valid recovery | Correct account reaches update screen, password changes, session behavior matches policy | Integration + physical native / H4 |
| R04 | Expired, malformed, replayed | No unauthorized update; recovery instructions shown; unrelated active session preserved per contract | Auth + native / H4 |
| R05 | Wrong purpose | Signup/login/email-change links don't authorize recovery UI; actual provider update permissions documented | Auth + component / H4 |
| R06 | Active A receives B link | No silent replacement of A or update of wrong account | Integration + native / H4 |
| R07 | Active A recovers A | Defined reset route; not rejected by confirmation-only guard | Component + native / H4 |
| R08 | Multiple requests/missing verifier | Older/overwritten verifier and other installation fail safely; newest usable flow works | Integration + native / H4 |
| R09 | Background/kill before submit | Recovery context restores safely or asks for new link; no accidental pantry routing | Native / H4 |
| R10 | Lost update response | Simulate server commit then response loss; no blind replay or misleading failure; login proves resulting credential | Fault-injection API + UI / H5 |
| R11 | Session effects | Current/other refresh tokens and outstanding access JWT behave exactly as selected policy | Multi-client Auth/API / M1 |
| D01 | No/malformed/expired bearer | Direct Edge calls perform no deletion | Edge integration / H1 |
| D02 | Old/refreshed stolen bearer | Fresh JWT `iat` alone cannot delete; client flags cannot bypass fresh authentication | Edge/Auth / H1 |
| D03 | Wrong password/Auth outage | No deletions, bounded attempts, safe errors, no temporary session leak | Edge/Auth / H1/M3 |
| D04 | A targets B | Body/query IDs cannot redirect operation; B's graph remains byte-for-byte unchanged | Edge + DB / H1/H5 |
| D05 | Expected graph | Hard-delete removes A/profile/household/items/membership and refresh ability; B unaffected | Real Auth + DB / H2 |
| D06 | Unexpected graph | Extra member, missing/extra ownership, mismatched membership and foreign attribution each follow fail-closed rules | Fixture graph + Edge/DB / H2 |
| D07 | Actual overlapping membership race | Controlled barriers force interleaving at validation/deletion; other member's data never lost; no partial commit | Separate DB connections + real Auth / H2 |
| D08 | Ownership race/deadlock | Forced competing ownership/write paths serialize or abort safely, with no stranded partial state | DB + Edge / H2 |
| D09 | Duplicate/replay | Simultaneous/delete-again requests have documented outcomes and cannot harm another UUID | Edge/Auth / H5 |
| D10 | Failure before destructive commit | Auth/database guard failure leaves full live graph intact | Auth + DB fault injection / H5 |
| D11 | Commit then lost response | Safe uncertain state/reconciliation; retry cannot target new registration with same email | Edge + UI / H5 |
| D12 | Stale tokens after deletion | Refresh fails; pantry, shopping, profile and privileged endpoint access denied as specified | Multi-client API / M1 |
| D13 | Local lifecycle | Restart, offline/online and late in-flight responses cannot repopulate deleted user's UI/cache | Component + native / M2 |
| D14 | Consent/cancel/accessibility | Disclosure accurate; cancel before dispatch has no effect; errors announced; EN/DE and keyboard navigation work | Component + native / M3 |
| V01 | Data/log minimization | Passwords, tokens, callback URLs and authorization headers absent from captured diagnostics | Edge/UI diagnostic inspection / H1/M2 |
| V02 | Backup restore | Disposable restore rehearses reapplying completed deletions before reopening access | Operational exercise / M2 |
| V03 | External requests | Identity-check, fulfillment and retention record tested without exposing another user | Manual procedure / M2 |
| G01 | Existing functionality | Signup/confirmation, legacy login/logout, session restoration, CRUD, household isolation and navigation stay intact | Existing full harness / all |

Freshness, exact graph eligibility, reset revocation and retention tests cannot have final pass/fail oracles until the missing decisions are approved. Simultaneous HTTP calls alone do not prove database overlap; D07/D08 require deterministic barriers. A mocked Admin call alone cannot establish actual Auth/FK atomicity.

## 7. Unresolved owner decisions

1. Confirm minimum measurement, preferably Unicode code points, and the supported byte maximum; approve a compatible provider/version plan if needed. Minimum 15 and no composition are already settled.
2. Approve the deletion freshness mechanism, allowed authentication method, freshness interval if reusable proof is used, and how recently recovered users proceed.
3. Approve the exact eligible household graph and treatment of unexpected ownership/membership/foreign attribution. Unexpected other members must remain fail closed.
4. Select recovery active-account switching behavior and recovery-context restoration after restart.
5. Select current/other refresh-session behavior and describe the residual access-token window.
6. Select uncertain-result reconciliation, duplicate-request behavior and any minimal retained operation evidence.
7. Approve the retention inventory, verified periods, restore behavior and external deletion procedure with separate legal review where needed.

These decisions should become one versioned KAN-57/KAN-81 contract, with KAN-42/43/80 acceptance criteria referencing it. They do not require a new general backend or a separate authentication architecture.

## 8. Provider assumptions: verified and still unverified

| Assumption | Review result | Remaining verification |
|---|---|---|
| Minimum length always means Unicode characters | **False across versions.** 2.197.0 uses UTF-8 byte count; current upstream minimum uses rune count. | Identify actual runtime versions and prove approved boundaries directly. |
| “72 characters” is an accurate maximum | **Misleading for Unicode.** Both inspected versions cap bytes at 72. | Confirm deployed behavior and translate usable guidance. |
| Stronger policy necessarily blocks legacy login | **Not the documented behavior.** Existing passwords may still sign in; SDK 2.119.0 exposes successful-response `data.weakPassword` separately from an error. [Password guidance](https://supabase.com/docs/guides/auth/password-security), [versioned SDK](https://raw.githubusercontent.com/supabase/supabase-js/v2.119.0/packages/core/auth-js/src/GoTrueClient.ts). | Test actual old-account login and warning handling after policy change. |
| Recovery supports PKCE | **Documented.** Reset request and password update are separate actions; the SDK documents `PASSWORD_RECOVERY`. [Reset API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail). | Trusted warm/cold recovery context for this native app, including active-session cases. |
| PKCE link works on any device | **False without the verifier.** Verifier storage ties exchange to the initiating context; overlapping flows may overwrite the verifier. [PKCE guide](https://supabase.com/docs/guides/auth/sessions/pkce-flow). | Exact installed SDK/storage behavior; do not adopt experimental overlap options without review. |
| Reauthentication OTP is automatically deletion proof | **Not established.** The API sends an OTP; deletion needs explicit server verification and binding. | Select and test a supported mechanism. |
| Edge check + Admin deletion is one transaction | **False.** The versioned Admin handler wraps its own deletion/audit work in a transaction; preceding HTTP operations are outside it. | Prove commit-time predicate and all competing writers in the disposable stack. |
| Hard delete equals soft delete | **False.** Admin has an explicit soft-delete option; do not rely on that for cascade promises. [Admin reference](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser). | Select hard mode and assert actual resulting graph. |
| Deleted/logout JWT instantly fails everywhere | **False.** Signature validity survives until expiry; actual access depends on session/resource authorization. | Check every relevant API; no broad “instant logout everywhere” promise. |
| Hard deletion clears all retention | **Not established.** Audit records, logs, backups and processors are separate. Storage object ownership can also block deletion if Storage is introduced. | Inventory actual enabled services and retention; today's app does not require a speculative Storage cleanup subsystem. |

No current hosted configuration, plan entitlement, Auth deployment version, log retention or backup schedule was independently queried. Prior repository evidence is dated evidence, not a current settings read-back.

## 9. Recommended specification amendments and proportional architecture

Adopt the following normative clauses after owner review:

1. New signup and password reset/update enforce the approved minimum on the server; login never applies the new-account minimum. All environments use verified compatible semantics. Password values remain exact and support paste/autofill; no composition requirement is added.
2. Recovery is an explicit lifecycle with a trusted purpose/account context. Callback routing is not the authorization boundary. Unknown-address requests are neutral, and every rejected/interrupted state has a safe next action.
3. Deletion accepts no target identity from the client. The server validates current identity and independently verifies fresh authentication. Privileged credentials remain in the function environment; user credentials and Auth artifacts are never logged or returned.
4. The eligible ownership/membership graph is checked under a mechanism that remains valid through the destructive commit. Any unsupported graph causes a no-change rejection. This invariant must be revisited before Slice 4 sharing is enabled.
5. Hard Auth deletion and application cascades are one destructive transaction. Failure rolls back the live-data changes. Separate HTTP checks are not described as atomic; uncertain results are reconciled without automatic destructive replay.
6. Session behavior and outstanding-token limitations are stated explicitly and tested. Local cleanup covers the active installation; offline devices, logs and backups have separate promises.
7. Retention wording names live data versus retained operational copies and reflects verified configuration. Restore and external-request procedures are included before public release.
8. Implementation PRs add the corresponding matrix tests and evidence. They do not complete the design by silently choosing omitted product/security decisions.

**Smallest defensible architecture:** keep recovery and policy inside the existing Auth client/provider, routing and i18n structure. Add one narrow deletion Edge Function for caller verification, fresh authentication and the Admin API lifecycle. Add only the database safeguard needed to protect the deletion invariant at commit, after proving concurrency behavior. Use existing migrations and test infrastructure. A direct SECURITY DEFINER RPC deleting `auth.users` is not a shortcut: it still needs freshness, narrowly restricted EXECUTE permissions, fixed search path, provider-lifecycle equivalence and the same concurrency proof. It also creates a second privileged public surface if exposed to clients. Prefer the selected Edge/Admin direction unless a reviewed provider limitation makes it insufficient.

No queue, generic service layer, token broker, custom password database or framework is justified by the current requirements. Even the narrow design is not ready until its deletion guard and freshness proof are specified.

## 10. Implementation-readiness verdict

**NO-GO against the currently available specifications.** The directions are suitable for design completion; the detailed specification and several security/data-integrity contracts are missing. No evidence establishes a Critical flaw in an actual proposed mechanism, and this review does not claim current production exploitation.

Recommended order: supply/version the actual proposed design; resolve H3 password semantics and H1 freshness; define H2 transaction/concurrency protection and H5 uncertain outcomes; complete H4 recovery transitions; settle session/retention/UX details; then independently review the amended contract and approve implementation through the owner. Existing automated tests do not substitute for these decisions.

This report provides review findings and proposed corrections only. It does **not** authorize implementation, hosted changes or destructive tests.
