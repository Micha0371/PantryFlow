# Slice 3 decision record — 2026-11-19

The owner reviewed the consolidated Slice 3 decision briefing on 2026-11-19 and approved the decisions below, with amendments. This record is authoritative for them. Each affected Jira issue gets a dated comment that points here; descriptions are not rewritten.

The decisions resolve:
- S3-Q3, S3-Q4 (D5) and S3-Q7 in [the QA integration plan](2026-11-18-slice-3-qa-integration-dry-run.md), section F;
- S3-Q6, which is OPS-01 ([KAN-104](https://michaelwuerthner.atlassian.net/browse/KAN-104));
- [KAN-81](https://michaelwuerthner.atlassian.net/browse/KAN-81);
- [KAN-57](https://michaelwuerthner.atlassian.net/browse/KAN-57).

**Previously approved and unchanged:**
- S3-Q1 (backlog plan);
- S3-Q2 (Slice 2 accepted; tag `pantryflow/slice-2-baseline`);
- S3-Q5 (UX-01A, delivered in #47);
- S3-Q14 (KAN-6 closed);
- the Slice 3 development authorization and phase order 3.1–3.8 of 2026-11-18.

**Still open:** S3-Q8 (first-launch and language precedence, KAN-61; website stack, KAN-71) and S3-Q9 to S3-Q13 and S3-Q15.

This record authorizes none of the following. Each needs its own separate approval:
- an implementation of authentication or account-deletion changes, before its technical design is reviewed;
- hosted configuration inspection or changes;
- deploying a privileged function;
- inviting testers;
- distribution or publication.

## 1. S3-Q3 — Roadmap and scope (approved, option A)

- **Slice 3:** usability, product refinement, hardening and beta readiness (KAN-40). No sharing and no premium.
- **Slice 4:** basic household collaboration (invite, membership and permissions per PRD section 11).
- **PantryFlow 1.0:** a free public application, including basic sharing. The public release therefore follows Slice 4 (see section 7).
- **Premium:** deferred until product discovery and validated user demand support it. It then needs the PF-PREMIUM-001 audit and a pricing decision.
- **Limits:** there is no monetization-related inventory limit. Any operational safety limit is a separate decision with its own rationale.
- **PRD:** the PRD is amended explicitly (Amendment 1, 2026-11-19). It supersedes the 75-item monetization requirement and the related premium gating.
- **Store and website text:** describes only functionality actually delivered (KAN-72, KAN-78).
- **KAN-65:** stays open for the disposition of the unused `profiles.is_premium` field.

## 2. S3-Q4 / D5 — Search, filters and languages (approved, options A and L2)

The original D5 (Slice 2 plan) is revised.

**Search and filters:**
- Pantry name search belongs to Slice 3 (UX-02, [KAN-92](https://michaelwuerthner.atlassian.net/browse/KAN-92)). It filters the already-loaded household inventory locally, with no new query or backend change.
- Sorting and further filters follow the UX-03 evaluation ([KAN-93](https://michaelwuerthner.atlassian.net/browse/KAN-93)).

**Languages:**
- English and German are mandatory (KAN-44, KAN-60 to KAN-62).
- French and Italian are conditional Slice 3 candidates. They start only after German has shipped and the strings are stable.
- Spanish is deferred.
- Optional languages never block Slice 3 completion or the initial beta.
- No partially translated or insufficiently reviewed language ships. Each shipped language has a reviewed, complete catalogue.

**Required checks:**
- an automated translation completeness test that fails when a shipped language misses a key;
- native layout verification per shipped language, covering text expansion in the status badge, buttons and dialogs.

**Language and formatting:** the display language and regional formatting (dates, numbers) are separate concepts. Choosing a display language does not by itself change regional formatting. KAN-61 defines how each is chosen and where it is stored.

## 3. S3-Q6 / OPS-01 — Crash and error reporting (conditional approval)

Sentry with EU data storage in Frankfurt is the preferred service. The integration starts only after the OPS-01 comparison note is complete and the owner confirms it.

Requirements:
- Capture crashes and unhandled errors only. No behavioral analytics, session replay or performance tracing.
- No automatic paid overages. Verify the current quotas and commercial terms.
- Review the DPA, retention periods, subprocessors and international data transfers.
- Scrub sensitive data from events, exception messages, breadcrumbs and request context. Events carry no pantry or shopping contents, email addresses, credentials, tokens or sensitive URLs.
- Keep test and release environments separate.
- Verify actual JavaScript and native-crash payloads from release-configured builds.
- Keep the source-map upload token in CI secret handling.
- Never describe the processing as entirely EU-only merely because the EU storage region is selected; some account and organization metadata may be stored elsewhere.

## 4. S3-Q7 — Beta timing (approved, option B)

- **What:** a supervised, invited Android beta.
- **When:** after BETA-01 and after English and German localization are complete. It does not wait for Slice 3 acceptance, French, Italian or iOS.
- **Interim paths:** interim recovery and deletion support paths are acceptable for supervised testing only if they are secure, documented and genuinely operational.
- **No convenience waivers:** BETA-01 waivers cannot cover mandatory security, privacy or artifact-trust requirements.
- **Authorization:** inviting external testers requires separate owner authorization.

## 5. KAN-81 — Password policy (approved with change, option C)

> **Amended 2026-11-19:** the session rule for password recovery and uncertain outcomes; see Amendment 1, A1.

**Rules:**
- A minimum of 15 characters.
- Passwords of at least 64 characters are supported. The actual server behavior and any byte-length limit (for example bcrypt's 72-byte input) are verified, including multi-byte characters.
- No mandatory composition rules. Spaces and passphrases are allowed.
- Password managers, autofill and paste are supported.
- No mandatory periodic changes.
- Passwords are never trimmed or silently truncated.
- The same policy applies at signup, reset and password change. The client rule and the server configuration come from one approved rule matrix.

**Existing accounts:**
- They remain usable. The new requirements apply when a password is changed.
- Supabase's `WeakPasswordError` handling for an existing account is verified.

**Further controls:**
- Compromised-password protection is enabled when the approved hosting plan offers it. Supabase documents it for Pro and above.
- Authentication rate limiting is reviewed.

**Sessions:**
- After a password change or recovery, the current valid session continues and other sessions are revoked.
- Actual refresh-token revocation and outstanding access-token behavior are verified.

**Limits of this decision:**
- No claim of full NIST SP 800-63B-4 compliance rests on the length requirement alone.
- Hosted configuration inspection and changes require separate authorization.

## 6. KAN-57 — Account deletion (recommendation changed to option B)

> **Amended 2026-11-19:** the deletion execution path; see Amendment 1, A2.

The preferred design is a narrowly scoped Supabase Edge Function that uses the supported Auth Admin API. It is not a general-purpose custom backend. A direct database function remains an alternative only with a documented technical advantage.

**Before implementation:** a threat model and a detailed deletion contract are reviewed.

**The design must include:**
- explicit destructive confirmation;
- server-verifiable fresh authentication;
- caller identity derived only from the verified authentication context; no target user ID accepted from the client;
- service-role credentials confined to the server-side execution environment;
- verified sole-household ownership and membership preconditions; it fails closed if unexpected household membership exists;
- protection against concurrent membership changes between validation and deletion;
- verified foreign-key cascade effects and table-by-table deletion semantics;
- hard deletion of the Auth account;
- refresh-token revocation and verified outstanding-JWT behavior;
- local session and household-cache cleanup;
- safe handling of duplicate requests, replay and uncertain network outcomes;
- verified backup and log retention;
- an external deletion-request mechanism for users without app access.

**Negative tests:**
- direct API invocation;
- bypassing client-side re-authentication;
- cross-account deletion;
- unexpected household members;
- stale tokens;
- concurrent operations.

**Slice 4 must revisit these rules:**
- deleting an account that owns a shared household (ownership transfer or household deletion);
- deleting a non-owner member (leaving the household; their attributed rows keep `created_by` set to null);
- invitations pending for or from the deleted account;
- the fail-closed membership precondition, which becomes a real branch once sharing exists.

## 7. Release gates (amended)

These amend section G of [the Codex integration plan](2026-11-18-slice-3-codex-integration-dry-run.md). Unlisted gates are unchanged.

| Gate | Change |
|---|---|
| Slice 3 completion (GO) | KAN-44 means English and German complete, with the completeness test and native layout verification. French and Italian are not required. |
| Supervised external Android beta | Adds English and German localization complete (S3-Q7). Interim reset and deletion paths must be secure, documented and operational. Mandatory security, privacy and artifact-trust lines cannot be waived for convenience. |
| Android public release (1.0) | Adds the Slice 4 basic sharing delivered and accepted (S3-Q3). Store and website text match delivered functionality. Premium-related criteria are limited to the KAN-65 disposition. |
| iOS public release | Follows the Android 1.0 criteria above, plus its own existing criteria. |

## 8. Jira reconciliation

Each issue below gets a dated comment pointing here; descriptions stay unchanged.

| Issue | What the comment records |
|---|---|
| KAN-51 | S3-Q3 and the D5 revision; the PRD amendment; the scope boundaries. |
| KAN-44 | Language scope; the completeness test; native layout checks; language versus formatting. |
| KAN-104 | The OPS-01 conditional approval and its requirements. |
| KAN-106 | The S3-Q7 timing, the interim-path conditions and the waiver limits. |
| KAN-50 | The amended public-release gate (Slice 4 sharing for 1.0). |
| KAN-72 | Public and store text match delivered functionality; no sharing or premium claims before delivery. |
| KAN-81 | The approved password policy. |
| KAN-57 | Option B and its design requirements; the threat model and contract come before implementation. |

## 9. Next packages

1. Focused implementation plans for UX-02 pantry search and UX-04 faster entry (phase 3.2), for owner review.
2. Technical designs, for review before any implementation:
   - KAN-81, with KAN-80 and KAN-42;
   - KAN-57, with KAN-43.
3. The OPS-01 comparison note, then the owner's confirmation.

## Amendment 1 — 2026-11-19 (after the Codex reviews of the account-lifecycle specifications)

**Status:** decided by the owner on 2026-11-19 and recorded here for approval through PR #50.
- **Basis:** the Codex reviews in `docs/reviews/2026-11-19/`, which found counterexamples N3/N4 and V5-1 to V5-4.
- **Specifications:** the specs at v0.6 implement this amendment.
- **Authorization:** none for implementation, hosted changes or deployment.

### A1. Session after password recovery or an uncertain outcome (OD-A10); amends §5

- **Replaced:** §5's "after a password change or recovery, the current valid session continues and other sessions are revoked", for **recovery** and for **uncertain outcomes**.
- **Recovery:** a reset ends with sign-out on **every** device, including the current one. The user then signs in with the new password.
- **Uncertain outcome** (no response) in either flow: sign out everywhere, and the sign-in screen decides. The app claims neither "changed" nor "not changed".
- **Confirmed in-app change:** §5 stands. The current session continues, and other sessions are revoked by the update's own transaction.
- **Sign-out evidence (corrected after the Codex review of v0.6, V6-1):**
  - All devices count as signed out only on an HTTP **204** from a global logout made with a live session.
  - `session_not_found` proves only that the presented session is gone.
  - **Disposition of that case, OD-A11: accepted by the owner as specified on 2026-11-19** (recommended by the Codex review of v0.7):
    - the user signs in again with **the same account** (the returned user id must match the pending operation);
    - a logout of all *other* sessions from the new session must return 204;
    - the user then stays signed in on that fresh, ordinary password session;
    - if the replacement session is lost before that, another same-account sign-in is required.
- **Why:** this meets §5's condition "no reopening without a demonstrated provider incompatibility":
  - the provider's recovery exemption from the current-password check has no freshness limit, and the recovery session keeps it through refresh and password update (verified in source and in FV-A4);
  - a continuing recovery session would therefore keep reset capability (Codex N4);
  - the SDK's sign-out result can't prove revocation (Codex V5-4).
- **Residuals accepted:**
  - a recovery credential stolen before completion grants reset capability until the session ends;
  - an earlier update request that outlives its client timeout may still commit (bounded by the provider's request lifetime, to be verified).

### A2. Deletion execution path (OD-B9, option X); amends §6

- **Replaced:** §6's preference for "a narrowly scoped Supabase Edge Function that uses the supported Auth Admin API".
- **Now:** the Edge Function stays narrow, and the destructive step is **one service-only database function**, `private.delete_own_account(user, request_id)`. In a single transaction it:
  - checks the maintenance barrier and the current request generation;
  - locks and checks the household graph;
  - hard-deletes the `auth.users` row, whose cascades remove sessions, refresh tokens, identities and app data.
- **Why:** this is the "documented technical advantage" §6 requires. The Admin API receives only the user id, so an old or delayed request can't be distinguished from a new one, and fencing can't be bound to one operation (Codex V5-1). The database function receives the request id.
- **Unchanged:**
  - fresh authentication;
  - caller-only targeting;
  - no service credentials in the app;
  - hard deletion;
  - fail-closed eligibility;
  - the external request path, which now also uses the function.
- **Accepted costs:**
  - Auth's own deletion audit entry is not written; the ledger and the function log are the audit;
  - hosted permission for the function to delete from `auth.users` must be verified (FV-B9).

### A3. Restore ledger (OD-B8) and maintenance pause (OD-B6)

- **Restoration:** stays blocked for every unresolved deletion intent.
- **Default completion** of a requested deletion, when production can't answer, needs:
  - the owner's explicit approval per account;
  - a request-validity check;
  - an auditable resolution record.
- **Maintenance:** it pauses and **drains** self-service deletion through an admission barrier before privileged repairs.

### Records to update after approval

Corrective comments on **KAN-81** (session rule) and **KAN-57** (execution path), previewed before posting.

