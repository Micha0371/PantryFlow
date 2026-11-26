# Beta remediation plan for approval

**Proposed plan only. Development remains GO; supervised beta and public release remain NO-GO.** Approval of this plan would authorize the agreed implementation and evidence work in separate changes. This documentation PR does not change product code, tests, Jira items, release status or the established beta gates, and does not authorize hosted writes or distribution.

Baseline: `25499a656c1e419883d95b6e9ade8cd0fa4fc791`. The [original assessment](RELEASE-ASSURANCE.md) is preserved byte-for-byte. The [independent review](RELEASE-ASSURANCE-INDEPENDENT-REVIEW-25499a6.md) supplies finding severity, confidence and claim dispositions; its findings, rather than its author's historical implementation involvement, drive this plan. [Probe ledger](review-evidence-25499a6/probe-ledger.json): **34 total, including compound D2; 33 countable, 23 reported detections and 10 survivors**. These are sample counts, not a coverage percentage. D2 changed two controls and supplies no isolated detection result.

**Evidence update:** the [follow-up review](RELEASE-ASSURANCE-FOLLOWUP-25499a6.md) resolves the 23 reported detections into **22 assertion failures and one timeout-only outcome, S13**. It also independently reproduces the pgTAP assertion gap in PGlite and verifies exact-commit Android success. C1–C7 and X1 are additional experiments, outside the original 34. Implementation approval remains pending; the order below is unchanged.

## Priority 1 Close the five masked write restrictions

**Addresses high-severity F01, SP-2 and SP-6. First implementation change after plan approval.** Keep intact production policies unchanged unless a separately reviewed defect warrants a fix; the demonstrated defect is missing independent regression assertions.

| Restriction | Required intact behavior | Deliberate weakening that must fail the new assertion |
|---|---|---|
| `items_update_member` | A non-returning UPDATE can change the caller's pantry fixture but cannot change the other household's fixture | Replace membership USING predicate with true, with an unrestricted effective UPDATE check |
| `items_delete_member` | A non-returning DELETE removes only the caller's pantry fixture; the other household's fixture survives | Replace membership USING predicate with true |
| `shopping_update_member` | A non-returning UPDATE changes the caller's shopping fixture but preserves the foreign fixture | Replace membership USING and WITH CHECK predicates with true |
| `shopping_delete_member` | A non-returning DELETE removes only the caller's shopping fixture | Replace membership USING predicate with true |
| `profiles_update_own` | A non-returning UPDATE changes only the caller's allowed profile fields | Replace own-user USING predicate with true and an unrestricted effective UPDATE check |

**Acceptance evidence required for each of the five, separately:**

1. On an isolated disposable Supabase/PostgreSQL 17 stack, seed two ordinary authenticated users, separate households, and populated fixtures owned by each. Use different names to avoid uniqueness errors hiding authorization failures. Record roles, migration hashes, engine/gateway versions and commands, without credentials.
2. Execute allowed-column writes without WHERE or RETURNING under an ordinary user. Check the foreign fixture afterward with an independent owner/admin read. Also show the caller's own permitted operation succeeds; an empty/dead fixture or a globally denied write must not count as isolation proof.
3. Preserve the filtered/returning regression cases, but add the non-returning checks that isolate write authorization. Demonstrate the corresponding HTTP PATCH/DELETE shapes locally with minimal responses; no app-side household filter can stand in for server authorization.
4. Weaken exactly one write restriction in the disposable database, run the corresponding new assertions, and retain a **specific assertion failure showing changed/deleted foreign data**. A setup error, permission error on the wrong column, unrelated suite failure, empty run or timeout is not a detected security regression. Restore/reset the disposable database between mutants and confirm the intact baseline passes again.
5. Retain a five-row intact-pass/mutant-fail result table, applied mutation diffs and sanitized assertion diagnostics in the follow-up PR. Independently review the assertion effectiveness before treating SP-2 as VERIFIED.

Also challenge the pantry and shopping INSERT household restrictions using inserts **without RETURNING**. An expected read-policy error on the returned representation is insufficient. Keep INSERT authorship, immutable-column privileges, SELECT isolation and absent-policy fail-closed cases distinct. The [independent PGlite evidence](review-evidence-25499a6/independent-rls.out) establishes the masking mechanism; it does not replace this local-stack/API evidence.

**Boundary:** never weaken hosted policies or issue hosted unfiltered writes. Any bounded hosted-shopping isolation check uses separately authorized disposable accounts and exact known fixture IDs. Implementation changes and test additions belong in a subsequent PR, not this documentation PR.

## Priority 2 Establish truthful deletion and retention evidence

**Addresses high-severity F06 and F07, SP-8, B4/B5.**

Prepare a populated-account rehearsal protocol before requesting its hosted execution authorization. Cover an owned pantry item, linked shopping item, manual shopping item and completed shopping item. Record before/after counts by disposable user/household/known item IDs, account/profile/membership removal and the requester-verification and closing-confirmation steps. Keep emails, tokens, item content and personal details out of retained evidence. Verify unrelated fixtures are untouched. Same-address re-registration is part of Priority 3's interim recovery check.

Investigate the known `auth.flow_state` retention boundary and record its applicable version, expiry and hosted scope. Distinguish application-table deletion from Auth remnants, provider logs, email and support records. Align the runbook and privacy notice: remove the contradictory managed-backup promise, and do not infer instant deletion of all data from the absence of managed backups. Do not claim B4's prior empty-account rehearsal proves populated deletion.

**Done when:** an authorized populated rehearsal and closing confirmation are recorded, retained-data boundaries and expiry are truthful, and an independent reviewer accepts the evidence against the interim support gate. Full planned self-service deletion is not silently added as a supervised-beta prerequisite. No rehearsal is authorized by this plan alone.

## Priority 3 Verify the actual hosted signup and recovery path

**Addresses high-severity F05, SP-7, OR-2/OR-4, B3/B10/B11.**

Prepare the trusted, signed release-configured Android beta artifact with source SHA, version, signer identity, SHA-256, hosted target and disposition of the antivirus/distribution-trust finding. Inspect its merged manifest and backup/data-extraction rules; demonstrate exclusion or appropriate protection of persisted session material before distribution. Do not substitute a debug test manifest for the release artifact.

With separate authorization for disposable hosted accounts, exercise registration after the hosted magic-link/OTP setting change, actual email delivery, confirmation redirect and native callback in that artifact, established session, signout and subsequent sign-in. Record the deployed redirect scheme and fallback behavior; the remaining localhost Site URL requires a documented disposition. Rehearse the interim delete-and-re-register recovery path with the same address and its data-loss disclosure. Use the artifact hash in the execution record.

**Done when:** these actions pass against the real hosted configuration on the identified signed artifact. Local Auth tests, catalog equality, earlier emails and Android emulator CI do not close this evidence. Failures lead to a separate approved fix and repeat evidence, not a VERIFIED label based on intent.

## Priority 4 Complete remaining release critical evidence

| Evidence | Minimum disposition before supervised beta | Existing gate or review finding |
|---|---|---|
| Exact-commit harness | **Completed for assessed SHA `25499a6` in the debug emulator/local-stack environment**, including artifact and read-backs. Preserve earlier observations and repeat required checks for a changed beta source SHA. See the [append-only Android record](ANDROID-RESULT-25499a6.md). | TI-3, F04 |
| Effective security assertions | Correct S13's unresolved mocked exchange in a separate approved test change so weakening the callback guard produces a prompt assertion failure under the normal command; do not count an extra probe-only timeout as assertion effectiveness | SP-4, TI-4; follow-up review |
| Hosted shopping isolation | Bounded two-account read/write checks using only authorized disposable fixture IDs, plus a dated catalog baseline or drift disposition | SP-6, F01; B1 |
| Dependency exposure | Reassess the actual beta lockfile and record advisories, affected runtime/tooling scope and approved dispositions; do not invent or reuse an obsolete audit | SP-10; B6 |
| Network, background and expiry | Define and execute representative device scenarios; retain resulting state/error behavior, including lost committed-write responses. Record remaining unknown add/edit/delete outcomes explicitly | FC-3, OR-3 |
| Error visibility and support | Meet crash/error reporting gate or its permitted named waiver; publish support/feedback channel, response time and stop/escalation criteria | OR-1; B2/B8/B9 |
| Language and accessibility | Complete Android EN/DE layout and font-scaling evidence; disposition inaccessible controls and error announcements using native checks rather than props alone | UA-1/UA-3, FC-4; B7 |
| Privacy and tester information | Publish accurate notice/support information and tester instructions, fill required provider/contact/channel details, obtain required owner/legal review | B5/B9 |
| Recovery and availability | Keep the dated, explicit acceptance/disclosure of no managed backups and possible pauses separate from security evidence. Define who watches for interruptions. No recovery claim without a restore rehearsal | DI-5, F07 |

For remaining operational scenarios whose exact coverage is not yet specified, agree the bounded protocol during implementation review. Where the existing checklist permits a waiver, a named owner must record scope, reason, date and tester disclosure. Mandatory privacy/security/artifact-trust lines cannot be closed by a generic risk acceptance. Public-release recovery, self-service lifecycle and other follow-ups remain separately gated.

## Documentation corrections accompanying remediation

The original assessment remains a historical artifact. Use an addendum or successor assessment when claims change, with dates, environment and the evidence that changed each disposition. The independent review already challenges these VERIFIED labels:

| Claim | Review disposition to carry forward |
|---|---|
| FC-1 | PARTIALLY VERIFIED for broad persistence; submit-lock and zero-row-delete mutants do not demonstrate persistence failability |
| FC-2 | VERIFIED only for tested component/hook races, not universal device/network behavior |
| DI-1 | Narrow to pantry names and open-shopping namespace; require separate shopping-index and real PostgreSQL concurrency scope |
| DI-2 | PARTIALLY VERIFIED until a stale-name-clobber mutant fails the relevant assertion; CAS removal is a different property |
| DI-3 | VERIFIED only for the enumerated unit contracts, not every mutation or stable multi-page snapshot |
| SP-1 / SP-3 | Retain local, table-specific detector boundaries; do not extend automatically to every policy or hosted data |
| SP-4 | PARTIAL: PKCE configuration mutation survives, and S13 only times out rather than failing its callback assertion; retain supported component guard evidence separately |
| TI-1 / TI-2 | Specific empty-run/inventory guarantees and top-level Node independence only; broader runtime completeness/independence qualified |

Also correct TI-4's timeout scope, distinguish policy deletion from permissive policy weakening, and keep unknown combined-probe results unverified. The complete dispositions remain in the independent review, including claims already correctly marked FAILED, PARTIAL or UNVERIFIED.

## Approval requested

Approve or amend **this ordered scope and its acceptance evidence**, beginning with Priority 1 in a separate implementation/test PR. Hosted mutations, distribution, issue creation, release sign-off and status transitions require their own authorization where applicable. This documentation PR can be reviewed and merged independently of approving implementation. No beta approval follows from either action.

**Update 2026-11-26 (appended; the text above is unchanged):** the S13 assertion gap is addressed in [S13-ASSERTION-REMEDIATION.md](S13-ASSERTION-REMEDIATION.md). SP-4 remains PARTIALLY VERIFIED.

## Status 2026-11-26 (appended; the text above is unchanged)

| Item | State | Record |
|---|---|---|
| Priority 1, five masked write restrictions (and both INSERT household restrictions) | **Delivered** in PR #73, merged as `f815b49` (2026-11-25): bare-write assertions on a local Supabase stack, each of the seven policy mutants failing its assertion | [Write-isolation evidence](../testing/rls-write-isolation/README.md); [post-#73 regression baseline](../testing/regression-baselines/2026-11-25-post-73-f815b49.md) |
| Priority 4, S13 assertion effectiveness | **Delivered** in PR #75, merged as `3a4f955` (2026-11-26). SP-4 stays PARTIALLY VERIFIED | [S13 record](S13-ASSERTION-REMEDIATION.md) |
| Follow-ups from the S13 review | **Created** (owner-authorized): KAN-124 AUTH-TEST-01 (p1), KAN-125 AUTH-TEST-02 (p2), KAN-126 AUTH-TEST-03 (p2), under KAN-88 | Jira |
| Priority 2, deletion and retention | **Prepared** in PR #76 (merged as `31b004b`). B4 reopened (owner, 2026-11-26). **Hosted rehearsal executed 2026-11-26: PASS** ([record](2026-11-26-populated-deletion-rehearsal-record.md)). B4 waits for the owner to accept the retention limits | [Protocol](2026-11-26-populated-deletion-rehearsal-protocol.md), [retention boundaries](2026-11-26-deletion-retention-boundaries.md), [request](2026-11-26-hosted-deletion-rehearsal-request.md) |
| Priority 3, hosted sign-up and recovery on a signed build | **Open**; waits for KAN-77 (Play account and upload key) | — |
| Priority 4, remaining rows | **Open**, except the exact-commit harness row: Android passed on `25499a6` and `f815b49` | [Android record](ANDROID-RESULT-25499a6.md) |

Development remains GO; the supervised beta and the public release remain NO-GO.
