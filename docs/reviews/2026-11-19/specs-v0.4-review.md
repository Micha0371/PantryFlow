# Codex review of the account-lifecycle specifications (baseline f1028869)

*Recorded verbatim as delivered to the owner on 2026-11-19. Baseline `f1028869de9a09779172b3485d2461fb277a3857` plus the `ab83b0f` delta. Version 0.5 of the specifications responds to it.*

**Verdict: NO-GO for implementing the account-lifecycle package as currently specified.** The architecture is reasonable, but five High findings remain in the selected mechanisms. Correct these, resolve the applicable owner decisions, and complete the outstanding feasibility checks before implementation approval.

Reviewed immutable baseline **`f1028869de9a09779172b3485d2461fb277a3857`**, plus the short `ab83b0f` delta. I inspected the specifications, migrations, relevant application/SDK code, previous reviews and committed experiment summaries. I did **not** run experiments, inspect credentials, query hosted resources or modify anything. The raw disposable-stack evidence was not independently reproduced.

## 1. Findings register

No Critical finding established. These are specification defects, not claims of vulnerabilities in an existing implementation.

### N1 — High: expiration turns the deletion guard off

**Evidence:** deletion specification [lines 71–78](https://github.com/Micha0371/PantryFlow/blob/f1028869de9a09779172b3485d2461fb277a3857/docs/planning/2026-11-19-account-deletion-spec.md#L71), request handling at lines 227–234, and D17 explicitly accepting an expired marker as unguarded.

A self-service request delayed beyond five minutes becomes indistinguishable from an exempt administrative deletion. The same problem arises if reconciliation resets the marker while the original request can still execute.

**Consequence:** an originally guarded deletion can execute without G1–G4, potentially cascading another member’s data.

**Required correction:** separate request expiration from guard activation. An expired or unresolved self-service operation must remain guarded or fail closed. Administrative exemptions need a deliberate, distinguishable path; elapsed time must not grant that exemption.

### N2 — High: “user exists” does not prove a deletion rolled back

**Evidence:** deletion specification [line 241](https://github.com/Micha0371/PantryFlow/blob/f1028869de9a09779172b3485d2461fb277a3857/docs/planning/2026-11-19-account-deletion-spec.md#L241) and app reconciliation at line 276.

After a timeout, the original deletion may still be queued or uncommitted. A normal lookup can see the existing user while that operation remains capable of committing. PostgreSQL’s snapshot semantics explicitly permit this. [PostgreSQL 17 isolation documentation](https://www.postgresql.org/docs/17/transaction-iso.html).

**Consequence:** the function can clear serialization/guard state and report “not deleted,” followed by a late deletion. The app can similarly clear its unknown flag too early.

**Required correction:** retain Unknown while an earlier mutation could still execute. A positive existence lookup is not a terminal operation result. Define a terminal-status or quiescence protocol before clearing the marker or permitting another deletion.

### N3 — High: password authentication does not prove update completion or revocation

**Evidence:** password specification [lines 237–252](https://github.com/Micha0371/PantryFlow/blob/f1028869de9a09779172b3485d2461fb277a3857/docs/planning/2026-11-19-password-recovery-session-spec.md#L237).

Concrete counterexample:

1. Recovery submits the account’s **existing** password.
2. Auth rejects it as `same_password`, but the response is lost.
3. Isolated sign-in with that password succeeds.
4. The spec declares Confirmed and claims other sessions were revoked.

No password update or associated revocation occurred. Rejecting `same_password` as evidence does not remove this equivalent ambiguity. Conversely, an authentication failure before a delayed update commits does not prove the update failed. The upstream handler rejects matching passwords before the password transaction. [Auth v2.198.0 handler](https://raw.githubusercontent.com/supabase/auth/v2.198.0/internal/api/user.go).

**Required correction:** distinguish “this password currently authenticates” from “the update and session contract completed.” Provide independent completion/revocation evidence and preserve uncertainty around potentially pending mutations.

### N4 — High: a stolen continuing recovery session retains the password-change exemption

**Evidence:** password specification [lines 292–297](https://github.com/Micha0371/PantryFlow/blob/f1028869de9a09779172b3485d2461fb277a3857/docs/planning/2026-11-19-password-recovery-session-spec.md#L292), together with the recorded persistence of recovery AMR after refresh and password update.

The argument considers who can **create** a recovery session, but overlooks theft of one already created. The design deliberately keeps that session after successful recovery. Its recovery AMR continues to exempt it from current-password verification. The provider’s `IsRecovery()` checks method membership without a freshness condition. [Session implementation](https://raw.githubusercontent.com/supabase/auth/v2.198.0/internal/models/sessions.go).

**Consequence:** a holder of that stolen session can change the password without fresh mailbox control or the current password, contrary to the broader stolen-session protection claim.

**Required correction:** explicitly assess and obtain owner disposition of this residual. If protection must cover these continuing sessions, demonstrate a server-enforced solution or approve a session-transition policy. Client screen checks cannot fix direct API access.

### N5 — High: the deletion ledger has an undetectable crash gap

**Evidence:** deletion specification [lines 336–351](https://github.com/Micha0371/PantryFlow/blob/f1028869de9a09779172b3485d2461fb277a3857/docs/planning/2026-11-19-account-deletion-spec.md#L336).

Deletion can commit and the function can terminate **before attempting the email or writing `ledger_failed`**. Neither the mailbox nor Resend then contains the deletion. The stated failure-handling mechanism cannot detect this case.

**Consequence:** restoration can reopen a deleted account while the runbook appears to have processed every available ledger entry.

**Required correction:** define durable evidence spanning that failure boundary—for example, an independently durable intent/completion protocol with unresolved intents blocking restoration. Also define idempotency: three send attempts do not establish D19’s exactly-one-message oracle. Resend offers [idempotency keys](https://resend.com/changelog/idempotency-keys), but none is specified.

### N6 — Medium: external-request identity verification is underspecified

**Evidence:** deletion specification [lines 353–359](https://github.com/Micha0371/PantryFlow/blob/f1028869de9a09779172b3485d2461fb277a3857/docs/planning/2026-11-19-account-deletion-spec.md#L353).

“Replying to our acknowledgement” does not define what proves receipt rather than merely matching a sender address or subject.

**Required correction:** specify an unpredictable, expiring challenge bound to the pending request and UUID, with explicit verification and replay handling. V03 must include a forged-sender and replay rejection case.

### N7 — Medium: the live-region mechanism conflicts with announcement limits

**Evidence:** password specification [lines 151–159](https://github.com/Micha0371/PantryFlow/blob/f1028869de9a09779172b3485d2461fb277a3857/docs/planning/2026-11-19-password-recovery-session-spec.md#L151).

The visible remaining-count text changes every keystroke inside a polite live region. Polite controls interruption priority; it does not itself enforce state-change-only announcements. [React Native accessibility documentation](https://reactnative.dev/docs/accessibility#accessibilityliveregion-android).

**Required correction:** distinguish continuously updated visual feedback from controlled announcement text. Supplement P13’s mocked timer test with actual TalkBack verification, including pause, deletion, paste and threshold crossings.

### N8 — Low: temporary-session handling contradicts itself

Deletion §3 says Unknown retains the isolated client until reconciliation; §5.2 says Unknown drops it immediately.

**Required correction:** choose one lifecycle and consistently specify cleanup, restart/orphan behavior and tests. Neither description guarantees server revocation when offline.

## 2. Earlier finding dispositions

“Resolved” below means adequately specified, subject to the declared rollout checks—not independently runtime-certified.

| Earlier finding | Disposition | Reason |
|---|---|---|
| H1 Fresh authentication | **Partial** | Mechanism B is credible; gateway verification and rate-limit claims remain unverified. |
| H2 Household safety | **Partial** | G1–G4 and locking improve the design; N1/N2 defeat the complete safety argument. |
| H3 Password measurement | **Resolved in design** | Code-point minimum and byte maximum are explicit; hosted parity remains a rollout gate. |
| H4 Recovery lifecycle | **Partial** | Purpose, active-session policy and restart routing are specified; native concurrency/overlap evidence remains open. |
| H5 Uncertain outcomes | **Not resolved** | N2/N3 invalidate the selected completion inferences. |
| M1 Session effects | **Partial** | Atomic provider revocation is supported; reconciled completion and recovery-session residual remain problematic. |
| M2 Retention/restoration | **Partial** | Useful inventory, but N5 prevents the restoration guarantee; periods remain unresolved. |
| M3 Abuse/failure UX | **Partial** | Concrete controls exist; rate-limit keying, N6 and N7 need completion. |
| F1 Unicode maximum compatibility | **Resolved in design** | The documented byte ceiling and narrower Unicode support address the ambiguity under the recorded approval. |
| F2 Update/revocation atomicity | **Resolved for confirmed updates** | Provider transaction supports it; N3 still prevents extending that guarantee to inferred completion. |
| F3 Conditional breached-password protection | **Resolved as applicability rule** | Entitlement, degraded behavior and completion evidence are specified; actual read-back remains open. |

## 3. Owner-decision assessment

| Decision | Assessment |
|---|---|
| OD-A1 | Sound: require demonstrated code-point enforcement everywhere. |
| OD-A2 | Sound under the recorded byte-limit approval; retain explicit Unicode examples. |
| OD-A3 | Sound UX choice; add overlapping auth-operation tests. |
| OD-A4 | Sound for ordinary password sessions; incomplete without N4’s disposition. |
| OD-A5 | Reasonable to omit the legacy hint in Slice 3. |
| OD-A6 | Sound conditional approach; no purchase implied. |
| OD-A7 | Defensible scoped choice; CAPTCHA is not a complete enumeration remedy. |
| OD-A8 | Explicit risk decision; one-hour outstanding-token exposure must remain visible. |
| OD-A9 | Enumeration acceptance must remain explicit and separate from neutral UI wording. |
| OD-B1 | Prefer B provisionally: avoids the extra password hop. Rate-limit advantage remains conditional; IP is not attacker identity. |
| OD-B2 | Conditional guard concept is viable; the expiring activation mechanism is not. |
| OD-B3 | Numerical limits are plausible proposals; five minutes cannot determine whether safety checks apply. |
| OD-B4 | Keep unresolved until actual retention decisions exist; “period undecided” is not completion of public privacy text. |
| OD-B5 | External ledger requirement is sound; proposed delivery protocol needs N5 fixed. |
| OD-B6 | A pause must address already-running deletions, not merely reject new ones. Specify draining/quiescence before privileged repairs. |
| OD-B7 | Do not treat flow-state expiry as established. Verify cleanup or specify a bounded cleanup mechanism. |

Additional explicit decisions are needed for **continuing recovery-session risk**, **crash-safe deletion accounting**, and **maintenance handling of in-flight operations**. OD-B5a’s monitoring cadence cannot eliminate N5’s pre-log crash gap.

## 4. Feasibility gaps and exact proposed oracles

These are proposals only; none was executed.

| Experiment | Required oracle |
|---|---|
| FV-A1 hosted read | Dated, authorized version/settings/entitlement read-back; unresolved values remain unresolved. |
| FV-A2 CLI compatibility | Existing project suites pass against the pinned CLI/Auth combination, including fresh Android regression. Applying migrations alone is insufficient. |
| FV-A3 native overlap | Two reset requests: record each link’s actual outcome; no wrong-purpose recovery or unexpected account replacement. |
| Auth-operation race | Pause exchange, attempt competing sign-in/sign-out, then release: the selected session cannot be silently overwritten by late exchange completion. |
| FV-B1/B3 hosted | Verify permitted guard placement and deployed FK behavior through separately approved scope. The current hosted-read request excludes SQL and cannot alone establish these. |
| FV-B4 Edge gateway | Real signed tokens accepted only for correct project, claims, live session and allowed AMR age; forged, revoked, wrong-project and future-dated cases rejected. |
| FV-B6 limiter keying | Controlled direct/function requests establish actual bucket behavior; client-supplied forwarding headers cannot bypass the trusted boundary. |
| Guard lifetime/late deletion | Delay dispatch beyond expiry and inject eligibility changes: deletion stays guarded or aborts; another user’s graph remains intact. |
| Delayed mutation reconciliation | Hold a real mutation before commit while checking status: no premature terminal failure or released serialization; exactly one destructive dispatch. |
| Password reconciliation | Lose the `same_password` response with multiple sessions present: no false completed/revoked claim. Also test a delayed successful update. |
| Ledger crash boundaries | Terminate before/after commit, send and acknowledgement: restoration either accounts for the deletion or remains closed because of a detectable unresolved record. |

**Existing evidence:** the recorded A2/A4/A5/A6 results are consistent with upstream source. B2 establishes useful direct-SQL lock behavior for the **three tested patterns**, not the full Auth/API/function protocol or every listed update interleaving. B4 proves Auth timestamp behavior, not Edge validation. Those distinctions must remain in completion claims.

## 5. Test-matrix gaps

The matrix covers the normal paths well, but needs these additions:

- **R10:** unchanged-current-password ambiguity and checks performed while the update remains pending.
- **R11/R15:** continued recovery-session exemption, including theft/refresh after successful reset.
- **R06/R16:** concurrent sign-in during exchange and competing distinct callbacks.
- **D07/D08:** actual Admin-path deterministic concurrency, membership moves, owner changes and applicable attribution updates.
- **D09/D11/D17:** expiry, late arrival, early positive existence lookup, request-state fencing and maintenance draining.
- **D19/V02:** crash-before-ledger, provider acceptance with lost acknowledgement, idempotency and detectable restoration gaps.
- **V03:** challenge binding, forged sender, expiration and replay.
- **P12/P13:** native cursor/autofill/TalkBack behavior; component props and fake timers are insufficient proof.

Database races, Auth semantics, gateway validation and native announcements need real boundary tests. Mocked function tests remain useful for branching and message mapping.

## 6. Delta `ab83b0f`

The localized mapping table is useful, but needs two corrections:

1. **`validation_failed` is not uniquely “too long.”** Map that message only with reliable operation/input context; otherwise use a generic validation failure.
2. **Unknown errors cannot universally say “Your password was not changed.”** Preserve uncertain outcomes whenever commit cannot be excluded.

P17 should test the SDK-facing normalized error representation as well as raw provider fixtures, multiple weakness reasons, and those ambiguous cases.

The inline evaluator otherwise correctly separates code points from bytes and excludes sign-in/current-password/deletion re-authentication. The source confirms the minimum changed between [v2.197.0](https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/password.go) and [v2.198.0](https://raw.githubusercontent.com/supabase/auth/v2.198.0/internal/api/password.go); that does not establish hosted deployment.

**Next step:** correct N1–N5 first, update their test oracles, then perform the separately authorized feasibility work. No additional general backend or broad architecture redesign is justified by this review.
