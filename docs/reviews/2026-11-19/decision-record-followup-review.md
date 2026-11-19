# Account lifecycle review: follow-up on merged PR #48

Reviewed 2026-11-19 against `5f34a78bf2b1da0c2393d541e699bbbc5aad6202`.

## Executive verdict

**CONDITIONAL GO for completing the technical designs; NO-GO for implementation yet.** The newly available decision record is a sound product-direction document with one material password-support ambiguity. It explicitly requires technical designs before implementation and does not purport to supply those designs. Missing mechanisms should therefore be treated as the next design deliverables, rather than defects in a supposedly completed design.

This follow-up supersedes the first report's statements that session policy and hard-delete mode were unresolved. The first report's schema analysis, threat model, recovery/deletion state analysis and proposed test matrix remain applicable with the amendments below. No application, database, Jira or hosted changes were made.

## Inputs and scope

The new evidence is `docs/planning/2026-11-19-slice-3-decision-record.md`, merged in PR #48, especially sections 5, 6 and 9. A stable copy is saved beside this report as `decision-record-reviewed.md`. The PR changes planning/PRD documents, not the account implementation or schema. The relevant database remains migrations 00001–00004 reviewed in the original report.

Searching the current repository's Markdown and file inventory did not locate a separate detailed password/recovery/deletion design. Section 9 explicitly lists those technical designs as next packages. I did not change branches, fetch into another agent's checkout, start a database or inspect hosted settings.

## What is now settled

| Decision | Authoritative location | Effect on first review |
|---|---|---|
| Minimum 15; no composition; spaces/passphrases/paste/autofill; no periodic changes or silent trimming/truncation | Section 5, lines 84–90 | Approved direction; not an open product choice |
| Passwords of at least 64 characters supported; byte limits must be verified | Section 5, line 85 | Adds a compatibility issue needing precise resolution below |
| One approved matrix for signup/reset/change | Section 5, line 91 | Server/UI parity explicitly required |
| Existing accounts remain usable; new rules apply on change; weakness response verified | Section 5, lines 93–95 | Rollout direction settled; behavioral verification still needed |
| Current valid session continues; other sessions revoked | Section 5, lines 101–103 | Original M1 is narrowed to mechanism/failure semantics and token-window verification |
| Narrow Edge Function preferred, direct DB function only with technical advantage | Section 6, line 110 | Architecture preference settled |
| Hard Auth deletion, caller-only targeting, race protection, duplicate/uncertain outcomes and retention | Section 6, lines 114–129 | Explicit requirements, not yet selected mechanisms |
| Detailed threat model/deletion contract before implementation | Section 6, line 112; section 9 | Supports a design-first gate; no implementation authorization |

The session choice should not be reopened without an actual incompatibility. The design must show how to implement it and what happens if part of the operation fails.

## Findings on the newly available record

### F1 — High: 64-character support and the byte maximum need a compatible definition

**Evidence:** section 5 line 85 promises support for passwords of at least 64 characters while acknowledging a potential bcrypt 72-byte ceiling and requiring multi-byte verification. These statements are not jointly satisfiable for all 64-code-point strings under that ceiling.

Static examples, calculated locally without invoking Auth:

| Password shape | Unicode code points | JavaScript UTF-16 units | UTF-8 bytes |
|---|---:|---:|---:|
| 64 ASCII letters | 64 | 64 | 64 |
| 64 `ä` characters | 64 | 64 | 128 |
| 64 four-byte emoji | 64 | 128 | 256 |

The recorded Auth version 2.197.0 measures minimum length in bytes and caps input at 72 bytes. Current upstream uses rune count for the minimum but retains the byte maximum. Neither upstream source nor older repository evidence establishes today's deployed version. [Versioned Auth source](https://raw.githubusercontent.com/supabase/auth/v2.197.0/internal/api/password.go), [current upstream](https://raw.githubusercontent.com/supabase/auth/master/internal/api/password.go).

**Consequence:** an implementer could silently narrow the 64-character promise to ASCII, enforce only UI length, or silently reinterpret 15 characters as bytes. None is an approved solution.

**Required correction before implementation:** define minimum measurement and a supported maximum with explicit Unicode examples. Prefer code-point measurement for the minimum, subject to owner approval and server support. If universal 64-code-point support is required, demonstrate a supported provider configuration/version that actually provides it. Otherwise obtain an explicit amendment acknowledging the maximum byte limit and narrower long-Unicode support. Do not prehash passwords in the client, add unsupported Auth wrappers, normalize, truncate or silently downgrade the requirement to make tests pass. Then verify direct signup, reset/update and existing-user login against the actual provider version.

### F2 — Medium: password-update and other-session revocation failure semantics remain unspecified

**Evidence:** section 5 lines 101–103 selects the outcome but does not specify its transaction boundary or behavior if password update succeeds and a separate revocation operation fails. Supabase documents an `others` sign-out scope, but that alone does not prove the complete reset/update sequence for this version. Issued JWTs remain valid until expiry. [Official sign-out semantics](https://supabase.com/docs/guides/auth/signout).

**Consequence:** the app might announce full completion while old refresh sessions still work, or revoke the intended current session through a default global sign-out.

**Required correction in technical design:** identify the current session for warm and cold recovery, verify which sessions the password-update endpoint itself revokes, and name any remaining supported revocation call. Specify committed password change with incomplete/uncertain revocation, safe retry of revocation and user feedback. Retrying revocation must not replay or persist the password. Distinguish revocation of refresh capability from immediate invalidation of outstanding JWTs. Preserve the approved current-valid-session rule.

### F3 — Medium: conditional compromised-password protection needs a testable applicability rule

**Evidence:** section 5 lines 97–99 enables protection when the approved plan offers it and requires rate-limit review. No current plan inspection is authorized here, and no read-back has been performed.

**Consequence:** “conditional” could become an undocumented skip, or an implementation might introduce cost/availability changes without approval.

**Required correction in the design/rollout record:** document verified entitlement, applicable configuration, enabled/disabled state, degraded-provider behavior and the evidence required for completion. If unavailable on the approved plan, record that limitation and its owner disposition. Do not purchase an upgrade, change hosting, or enable features under this review. Exact rate-limit values and enforcement boundaries belong in the reviewed design too.

## Carry-forward design requirements

The record now explicitly asks for these controls. The technical package must select mechanisms and evidence for them; it must not claim the product checklist already proves safety:

1. **Fresh authentication:** distinguish verified identity from fresh credential verification; reject client-only flags, refreshed `iat` alone and unrelated-session sign-in timestamps. Bind any proof to the caller and operation, and define replay/expiry/rate-limit behavior.
2. **Commit-time household safety:** specify the exact allowed ownership/membership graph. `UNIQUE(user_id)` means one membership per user, not one user per household. A separate membership read/RPC followed by Admin deletion is not atomic. Define a proven database guard/locking or equivalent exclusion protocol, including privileged competing writers.
3. **Recovery lifecycle:** define trusted recovery purpose, current-versus-other-account callbacks, warm/cold routing, missing/overwritten verifier and interrupted update states. Existing confirmation callback behavior is not already a recovery controller.
4. **Deletion uncertainty:** explicitly use hard deletion, immutable caller UUID and a safe reconciliation path. Avoid separate application-data erasure before Auth deletion. A new registration with the same email must not be affected by an old retry.
5. **Retention and restoration:** name live tables, audit/log records, backups, delivery provider, local caches and external requests; verify actual periods and restoration behavior. No invented universal erasure promise.

The first report's narrow Edge/Auth Admin recommendation and test matrix still fit the approved direction. There is no reason to add a general backend or implement Slice 4 sharing now.

## Test-matrix amendments

- P02/P03 must now include 64 ASCII, 64 two-byte characters and 64 four-byte emoji, with owner-approved expected outcomes. These examples expose the compatibility question; they are not all asserted to be accepted today.
- R11 now has a selected oracle: current valid session continues, other refresh sessions cannot refresh, and outstanding JWT behavior matches the documented window. Include at least two pre-existing sessions and the recovery session.
- Add a password-committed/revocation-failed case and a revocation-response-lost case. Neither may be reported as fully completed without evidence.
- P07 must record plan applicability and compromised-password-protection state, together with actual Auth versions/settings. Such hosted inspection needs separate authorization.
- Deletion fixtures must assert hard deletion, as now explicitly selected. Existing concurrency and cross-household preservation cases remain required.

## Corrected readiness conclusion

The owner has supplied substantially more product decisions than the initial review could see. The record is **suitable input for technical design**, with F1 resolved or explicitly carried as a decision gate. It is **not yet an implementation specification**, by its own wording.

Next deliverables are a versioned password/recovery design and a versioned deletion/threat-model contract, referencing this record and closing the mechanism-level questions above. Independent review can then assess those actual mechanisms. This review grants no implementation, hosted-inspection, deployment or destructive-test authorization.
