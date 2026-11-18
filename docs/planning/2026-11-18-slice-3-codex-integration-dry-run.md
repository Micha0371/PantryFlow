# Slice 3 — independent Codex assessment integration (Jira dry run)

**Status: APPROVED by the product owner on 2026-11-18** ("approved with your recommendations"). The decisions in section E were accepted as recommended:
- **S3-C1:** apply this delta.
- **S3-C2:** fix CR-01 before the supervised beta.
- **S3-C3:** no upload of private APKs to public scanners without a separate authorization.
- **S3-C4:** mandatory GitHub approvals stay off; GOV-01 records in every PR whether its review was independent.
- **S3-C5:** session storage is decided through SEC-06 before public release, with no change before then.
- **S3-C6:** native "blocks" links are optional and added by hand.
- **S3-C7:** the Codex report is committed as a separate benchmark.

The text below is the approved dry run; the outcome is in the [creation record](2026-11-18-slice-3-codex-integration-created.md).

- **Operation ID:** `PF-S3-CODEX-INTEGRATION-20261118`
- **Drafts:** [2026-11-18-slice-3-codex-integration-drafts.json](2026-11-18-slice-3-codex-integration-drafts.json)
- **Builds on:** the approved [Claude-assessment integration](2026-11-18-slice-3-qa-integration-dry-run.md) (`PF-S3-QA-INTEGRATION-20261118`). That one was applied first; its creation record holds the key map.

**Sources:** two Slice 2 benchmarks of `ec0dbdd`, kept separate and **not averaged**:
- the Claude Code assessment, [2026-11-18-quality-assessment-baseline.md](../quality/2026-11-18-quality-assessment-baseline.md): B, 84.5, performance graded B− from static inspection;
- the independent Codex assessment, [2026-11-18-codex-quality-assessment.md](../quality/2026-11-18-codex-quality-assessment.md): B, 85.7, performance NOT VERIFIED and weights normalized to 96 %.

**What both assessments agree on:**
- continued development: GO;
- public production: NO-GO;
- usability is clearly weaker than engineering.

**The Slice 3 objective is unchanged:** Usability, Product Refinement and Launch Readiness. PantryFlow must reduce household administration, not become another administrative obligation.

## Verification performed for this plan

| Item | Result |
|---|---|
| Codex QA-01 (deleted pantry row) | **Confirmed in source.** `usePantryItems.updateItem` uses `.update().eq(id).eq(household).select().single()`. A row deleted elsewhere fails with PGRST116, the error is rethrown, the stale row stays, and no re-read starts. `deleteItem` throws "Item was not deleted" on zero rows with the same effect. ShoppingProvider has `dropIfMissing` plus a re-read. I didn't re-run the Codex probe; that is CR-01's first acceptance criterion. |
| Codex QA-07 (selection semantics) | **Confirmed, and wider than the Claude finding.** The edit screen's status selector is three plain Pressables in `app/edit-item/[id].tsx`, not `OptionChips`. A11Y-01 as drafted would have missed it, so it gets a scope correction. |
| Codex QA-11 (APK warning) | **Confirmed as recorded.** `coverage-matrix.md` records only "flagged … dismissed", with no detection name or hash. `docs/testing/README.md` tells operators to dismiss such warnings. |
| CR-06 (session storage) | `lib/supabase.ts` persists the session in AsyncStorage. That is a design choice, not a demonstrated disclosure. |
| Baseline (§9) | Slice 2 accepted by the owner on 2026-11-18. Tag `pantryflow/slice-2-baseline` → `ec0dbdd` pushed. KAN-6 Fertig; KAN-52 to Fertig as approved. KAN-41 stays open: KAN-51 scope decisions and KAN-53 dispositions. Codex named KAN-41 as the acceptance task; the actual acceptance subtask is KAN-52 under KAN-41. |
| Audit counts | 66 high (Claude) versus 67 high (Codex). The likely cause is environment differences: Node 26 versus 22, and CA handling. Both are propagated entries; SEC-01 records exact provenance. |

## A. Consolidated findings matrix

Keys in the form `PF-S3-…` were created by the first operation; the resolved Jira keys are in brackets. Items marked (new) are created by this operation.

**Disposition legend:**
- **covered:** an existing issue already carries the work;
- **refine:** this operation adds criteria to an existing issue;
- **new:** a new issue is created.

| Finding | Type | Existing Jira key | Current disposition | Required action (this operation) | Priority | Release impact |
|---|---|---|---|---|---|---|
| F-01 Password recovery | Public-release gap | KAN-42, KAN-54–56; KAN-80 | Covered (refined in op 1) | — | P1 | Public; beta via interim path (BETA-01) |
| F-02 Account deletion | Public-release gap | KAN-43, KAN-57–59 | Covered (refined in op 1) | — | P1 | Public; beta via interim path |
| F-03 iOS | Platform gap | KAN-47, KAN-68–70, A11Y-02 PF-S3-T7-S4 [KAN-101] | Covered | — | P1 iOS | iOS only |
| F-04 Chips inaccessible | Accessibility gap | A11Y-01 PF-S3-T5-S3 [KAN-100] | Covered | **Refine:** add the edit-screen status pills (from QA-07) | P1 | Public, Slice 3 acceptance |
| F-05 Status takes 3–4 taps | Product recommendation | UX-01A/B PF-S3-T11-S1 [KAN-90]/PF-S3-T11-S2 [KAN-91] | Covered | **Refine** UX-01B: declining the prompt counts too; depends on CR-01 | P1 | Slice 3 acceptance |
| F-06 No search, sort or filter | Product recommendation | UX-02 PF-S3-T11-S3 [KAN-92], UX-03 PF-S3-T11-S4 [KAN-93] | Covered | — | P1 / P2 | Slice 3 acceptance |
| F-07 Stale advisory register | Security risk (triage) | SEC-01 PF-S3-T6-S4 [KAN-102] | Covered | **Refine** with QA-02 / CR-03 | P1 | Beta and public |
| F-08 Android E2E not required | Evidence gap | TEST-02 PF-S3-T12-S2 [KAN-108] | Covered | — | P2 | Android production (recommended) |
| F-09 German | Public-release gap (D5 deferral) | KAN-44, KAN-60–62 | Covered | — | P1 | Public |
| F-10 PRD-versus-slice scope | Decision | KAN-51 | Covered (refined in op 1) | — (owner decision S3-Q3 still open) | P1 decision | Public |
| F-11 No crash reporting | Operations gap | OPS-01 PF-S3-T6-S6 [KAN-104] | Covered | — | P1 | Beta |
| F-12 No test timeout | Evidence gap | TEST-01 PF-S3-T12-S1 [KAN-107] | Covered | — | P2 | None |
| F-13 Pantry rows unlabeled | Accessibility gap | A11Y-01 PF-S3-T5-S3 [KAN-100] | Covered | — | P1 | Public |
| F-14 Return doesn't save | Product recommendation | UX-04 PF-S3-T11-S5 [KAN-94] | Covered | **Refine:** less modal navigation, keep input on every error | P1 / P2 | Slice 3 acceptance |
| F-15 Gradle flake | Infrastructure | CI-01 PF-S3-T12-S3 [KAN-109] | Covered | — | P3 | None |
| F-16 Prompt orchestration in screen | Maintainability (disputed by Codex) | UX-01A PF-S3-T11-S1 [KAN-90] | Covered | Owner rule (§6): extract only for a real second consumer. Recorded in the T11 refinement. | P3 | None |
| F-17 Hosted schema not re-verified | Evidence gap (recorded 2026-11-11) | SEC-02 PF-S3-T6-S5 [KAN-103] | Covered | — | P1 | Beta |
| F-18 Legacy scaffold | Maintainability | ARCH-02 PF-S3-T12-S6 [KAN-112] | Covered | — | P2 | None |
| F-19 DMARC `p=none` | Security hardening | KAN-66 | Covered (refined in op 1) | — | P2 | Public production |
| QA-01 Deleted pantry row not recovered | **Confirmed functional defect** (Medium) | none (KAN-32 is different and Fertig) | **New** | **New Task** CR-01 PF-S3-T14 (new), High | P1 | Beta (fix or disclose), public, before sharing |
| QA-02 67 high advisory entries | Security risk (triage, High) | SEC-01 PF-S3-T6-S4 [KAN-102]; KAN-66 | Overlaps F-07 | **Refine** SEC-01 (CR-03) | P1 | Beta and public |
| QA-03 Recovery, deletion, password policy | Public-release gap (High) | KAN-42, KAN-43, KAN-80–83 | Overlaps F-01/F-02 | **Refine** KAN-80 (CR-05: hosted read-only check, non-disclosing errors) | P1 | Public; supervised beta needs support arrangements |
| QA-04 Unvalidated setup and finding effort | Product risk | T11 PF-S3-T11 [KAN-87], UX-04, UX-08B | Overlaps F-05/F-06/F-14 | **Refine** T11, UX-04, UX-08B (observed versus source counts, administrative effort, repeat use) | P1 | Slice 3 acceptance; public judgment from evidence |
| QA-05 iOS and VoiceOver | Platform gap | KAN-47, A11Y-02, KAN-64 | Overlaps F-03 | — | P1 iOS | iOS only |
| QA-06 German absent | Public-release gap | KAN-44 | Overlaps F-09 | — | P1 | Public |
| QA-07 Selected-state semantics | Accessibility gap | A11Y-01 PF-S3-T5-S3 [KAN-100] | Overlaps F-04, wider | **Refine** A11Y-01 (status pills) | P1 | Public |
| QA-08 Release operations and data-lifecycle recovery | Public operations gap (High) | KAN-67, KAN-43, KAN-48, KAN-50 | Overlaps PF-DATA-001 | **Refine** KAN-67 (CR-07: plan-matched backups, restored-authorization checks, forward-fix) | P1 | Public; beta needs workable support and retention |
| QA-09 Review and PR evidence unenforced | Governance gap | GOV-01 PF-S3-T13-S1 [KAN-113]; KAN-52 (baseline done) | Partly new | **Refine and rename** GOV-01 (CR-04, combined) | P2 | None directly; release evidence quality |
| QA-10 No performance, user study or full native coverage | Evidence limit | PERF-01, UX-08A/B, KAN-74 | Partly covered | **New Subtask** NATIVE-01 PF-S3-T9-S5 (new) (CR-08) | P2 | Slice 3 acceptance; iOS parts gate iOS |
| QA-11 APK antivirus warning | Distribution-trust uncertainty | KAN-50, KAN-77 | **New** | **New Subtask** DIST-01 PF-S3-T10-S5 (new); **refine** KAN-77 and BETA-01 | P1 | Beta and public distribution |
| CR-06 Session storage (Codex category 7) | Security design decision | none | **New** | **New Subtask** SEC-06 PF-S3-T6-S7 (new) | P2 | Decision before public release |

**Disposition totals:**

| Assessment | Covered | Refined | New |
|---|---|---|---|
| Claude (F-01 to F-19) | All 19 remain covered by op 1 | 3 get small additions here: F-04, F-05, F-14 | 0 |
| Codex (QA-01 to QA-11, plus CR-06) | 2 unchanged: QA-05, QA-06 | 6 overlapping findings refined | 4: QA-01, QA-11, CR-06, plus NATIVE-01 for QA-10 |

No finding is deferred.

**§7 checklist, Claude-specific items still covered:**
- test timeout including M4 (TEST-01);
- risk-based Android E2E (TEST-02);
- Gradle flake (CI-01);
- crash reporting (OPS-01);
- DMARC (KAN-66);
- hosted schema (SEC-02);
- premium entitlement review (KAN-65);
- legacy scaffold (ARCH-02);
- German (KAN-44);
- recovery and deletion (KAN-42/43);
- PRD scope (KAN-51).

No duplicates are proposed.

## B. Delta relative to the Slice 3 backlog after operation 1

| Change | Items |
|---|---|
| New Tasks (1) | CR-01 PF-S3-T14 (new) — [Slice 3] Recover from externally deleted pantry records (High) |
| New Subtasks (3) | DIST-01 PF-S3-T10-S5 (new) under KAN-50; SEC-06 PF-S3-T6-S7 (new) under KAN-46; NATIVE-01 PF-S3-T9-S5 (new) under KAN-49 |
| Refinements (13) | KAN-40, KAN-67, KAN-77, KAN-80; and from op 1: SEC-01, BETA-01, GOV-01 (renamed), ASSESS-01 (renamed from "QA-01" to avoid a clash with Codex QA-01), A11Y-01, T11, UX-01B, UX-04, UX-08B |
| New dependency links | 0 native: the CLI has no link operation. Recommended manual "blocks" links are listed in section E. |
| Findings already covered | All Claude findings except the three small additions, plus Codex QA-05 and QA-06 |
| Deferred findings | None |

## C. Detailed issue proposals

### C.1 New issues (4)

Each also gets the labels `pantryflow`, `slice-3`, its backlog-ID label and `qa-codex-2026-11-18`, and ends with this footer:

```text
Operation ID: PF-S3-CODEX-INTEGRATION-20261118
Plan: docs/planning/2026-11-18-slice-3-codex-integration-dry-run.md
Sources: independent Codex assessment docs/quality/2026-11-18-codex-quality-assessment.md (B, 85.7) and Claude Code assessment docs/quality/2026-11-18-quality-assessment-baseline.md (B, 84.5), both of main ec0dbdd. Findings are evidence to verify, not accepted facts.
Dependencies are description references, not native Jira links: the approved CLI has no link operation.
```

#### PF-S3-T14 — [Slice 3] Recover from externally deleted pantry records

Task under `KAN-40`, priority High. Extra labels: `p1`, `beta-gate`, `defect`.

```text
Backlog ID: PF-S3-T14 (CR-01)
Source: Codex QA-01 (Medium functional defect), reproduced by Codex with a provider probe (pantry-flow/.verification/quality-20261118/pantry-missing-probe.cjs, local and ignored). Re-checked in source on ec0dbdd: usePantryItems updateItem uses .update().eq(id).eq(household).select().single(), so a row deleted by another client fails with PGRST116, the error is rethrown, the stale row stays in the list and no re-read starts; deleteItem throws "Item was not deleted" on zero rows with the same effect. ShoppingProvider already drops a missing row (dropIfMissing) and re-reads.
Priority: P1 (High). Release classification: external-beta gate (fix preferred before beta; otherwise disclose and mitigate in BETA-01); public-release gate; must be fixed before household sharing (Slice 4) makes concurrent edits common. Risk tier: medium.
Not a reopening of KAN-32 (a different first-load recovery defect, Fertig).

Problem: after another device deletes a pantry item, editing or deleting it shows a generic error repeatedly; the item stays in the list and the edit screen until a refresh or restart.
Impact: a dead-end form and a stale list; no cross-household exposure or server-side corruption is demonstrated.
Scope: a targeted fix in hooks/usePantryItems.tsx, lib/pantry-data.ts and app/edit-item/[id].tsx: an explicit missing-record error contract for pantry update and delete, removal of the stale row, an authoritative household-scoped re-read, and an actionable message on the edit screen (reuse the existing missing-item state).
Exclusions: no generic CRUD framework or shared provider abstraction; no change to strict pantry uniqueness, D1-D4 or shopping links; do not reopen KAN-32.
Dependencies: none; schedule before UX-01B, which changes the same update path.

Acceptance criteria:
- The defect is reproduced independently (Codex probe or an equivalent test) and a failing-before regression test exists.
- The missing-record contract is explicit: which responses count as "not found for this household" (zero rows from an id-and-household-filtered write) and which do not (transport, permission, server errors).
- On a missing record during update or delete, the provider removes the stale row and starts a household-scoped re-read; the edit screen shows the existing missing-item message with a way back, and further edits of the nonexistent item are prevented.
- Transport or permission failures keep valid cached rows and show the existing retry or error behavior.
- The user is never told whether an inaccessible record exists in another household.
- Identity, household-scope and stale-response guards stay intact: a late recovery read cannot overwrite a newer successful mutation or write into a new household scope.

Verification: provider tests (missing update, missing delete, failed recovery read, transport failure keeps rows, household change during recovery, mutation and recovery-read ordering); screen test of the edit-screen missing path; an API-level or Maestro check where practical; test:fast and test:local green.
Security/privacy: no item names or ids of other households in messages or logs.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T10-S5 — DIST-01: Investigate the APK antivirus warning and qualify the distribution artifact

Subtask under `KAN-50`. Extra labels: `p1`, `beta-gate`, `security`.

```text
Backlog ID: PF-S3-T10-S5 (DIST-01, CR-02)
Source: Codex QA-11. docs/testing/coverage-matrix.md records that AVG on the owner's phone flagged the sideloaded test APK (com.pantryflow.test, KAN-39/84 runs) as suspicious and that the warning was dismissed; no detection name, hash or analysis exists. docs/testing/README.md tells operators to dismiss such warnings.
Priority: P1 before any external distribution. Release classification: external-beta gate; public-release gate.

Scope:
1. Recover what exists about the original warning: detection name, warning details, screenshots in ignored .verification evidence, and the flagged APK if it still exists; record its SHA-256, signing certificate and build provenance (commit, dependencies, build environment).
2. Investigate the detection with appropriate independent analysis; private artifacts go to public scanning services only with explicit owner authorization.
3. Qualify the intended external distribution artifact separately: release signing configuration, SHA-256, reproducible source-to-build relationship, and a scan of that exact artifact.
4. Replace the "dismiss it" guidance with an instruction to record the detection details first.
Exclusions: do not disable antivirus protection; do not assume a false positive; do not claim malware without evidence; do not distribute an unresolved artifact.
Dependencies: KAN-77 (beta artifact); BETA-01 checklist.

Acceptance criteria:
- A dated record lists the original warning's details or states that they are unrecoverable, and keeps the old test APK and the new distribution artifact clearly separate.
- The distribution artifact's hash, signer and source commit are recorded and the analysis result is documented with remaining uncertainties.
- An explicit owner distribution-trust decision exists before external testers receive an APK; qualifying a new artifact is not presented as proof that the original warning was harmless.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item unless the decision approves it.
```

#### PF-S3-T6-S7 — SEC-06: Review the mobile session-storage threat model

Subtask under `KAN-46`. Extra labels: `p2`, `public-release-gate`, `security`.

```text
Backlog ID: PF-S3-T6-S7 (SEC-06, CR-06)
Source: Codex security assessment (category 7). lib/supabase.ts persists the Supabase session in AsyncStorage (autoRefreshToken, persistSession, PKCE). This is not evidence of a token disclosure.
Priority: P2 investigation. Release classification: decision required before public release.

Scope: identify the session data stored on the device; assess device-at-rest exposure on Android and iOS; review Expo SecureStore, Keychain/Keystore-backed options and Supabase storage adapters, including size limits; consider token refresh, session restoration, account switching and migration of existing persisted sessions.
Exclusions: no storage change in this item; implement a change only after an approved decision where the security benefit justifies the complexity and compatibility risk.
Dependencies: none; coordinate with KAN-43 (session clearing after deletion) and KAN-42 (sessions after password reset).

Acceptance criteria:
- A short threat model and architecture decision record states what is stored, the realistic threats, the options with constraints, and the decision (keep, change, or change later), approved by the owner.
- If a change is approved, a separate implementation item with migration and regression criteria is proposed.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item unless the decision approves it.
```

#### PF-S3-T9-S5 — NATIVE-01: Close native lifecycle verification gaps

Subtask under `KAN-49`. Extra labels: `p2`, `slice3-acceptance`, `testing`.

```text
Backlog ID: PF-S3-T9-S5 (NATIVE-01, CR-08)
Source: Codex behavioral-coverage and robustness assessment (categories 6 and 10); Claude assessment category 10 (session expiry only via restore). Priority: P2. Release classification: Slice 3 acceptance evidence; iOS parts gate iOS release.

Scope: on a physical Android device (and on iOS once KAN-68 exists): session expiry during active use; extended backgrounding and foreground restoration; real network interruption and reconnection; network transitions where reproducible; app restart after a failed mutation; the complete physical-device email-confirmation journey (the latest phone run completed its last steps only on the CI emulator); password-recovery deep links once KAN-42 exists.
Exclusions: no offline synchronization; proxy faults remain the deterministic layer but are not reported as real network evidence.

Acceptance criteria:
- Each scenario has a recorded result with device, OS, build and configuration; controlled proxy faults and real native network conditions are distinguished.
- Household isolation holds across session and identity changes; failed operations never show a success state; the app recovers into a consistent usable state, or a defect is filed.
- Incomplete device journeys are reported as incomplete, not passed; the coverage matrix is updated.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item unless the decision approves it.
```

### C.2 Refinements (13)

`{PF-S3-…}` keys refer to issues created by the first operation (key map in its creation record). The existing description stays verbatim, the block below is appended, and the label `qa-codex-2026-11-18` is added. Two summaries change, as noted.

#### KAN-40

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Second source: the independent Codex assessment (docs/quality/2026-11-18-codex-quality-assessment.md, B 85.7) is retained as a separate Slice 2 benchmark next to the Claude Code assessment (B 84.5); the scores are not averaged.
Additional work: PF-S3-T14 (new) (CR-01, externally deleted pantry records, P1 defect), PF-S3-T10-S5 (new) (DIST-01 APK warning and artifact trust), PF-S3-T6-S7 (new) (SEC-06 session-storage threat model), PF-S3-T9-S5 (new) (NATIVE-01 native lifecycle gaps).
Gate criteria for implementation authorization, Slice 3 completion, supervised and broader Android beta, Android and iOS public release: section G of the plan named below.
Usability remains the primary objective; the added engineering findings do not displace it.
```

#### PF-S3-T6-S4 [KAN-102]

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Source added: Codex QA-02 (High triage requirement). Codex counted 67 high and 6 moderate affected entries from three root advisory objects (picomatch 4.0.7 and 2.3.2 locked; GHSA-fc5q-39xc-vjpf listed no patched version at assessment time); Claude counted 66 high. These are propagated entries, not independent vulnerabilities.
Additional criteria: record the audit date, environment (Node version, npm, CA settings) and commit; list every root advisory with paths and versions; separate runtime, development, build and CI exposure; check whether attacker-controlled input can reach glob evaluation; review current upstream remediation; document any time-bounded risk acceptance with owner and expiry; define reassessment triggers (lockfile change, new advisory, exposure change, monthly date). A reviewed disposition is required before any external beta or distribution.
```

#### KAN-80

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Source added: Codex QA-03 (and Claude F-01). Additional criteria: verify the current hosted Auth password policy through authorized read-only inspection before changing anything; signup, reset and update error messages must not reveal whether an account exists or more than the policy requires; existing accounts below the new policy follow the KAN-81 rollout decision. Requirements are not invented without a documented security and usability decision.
```

#### KAN-67

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Source added: Codex QA-08 (CR-07). Additional criteria: establish a backup strategy that matches the actual Supabase plan (for example what daily backups or point-in-time recovery the plan provides) and document its limits; after the isolated restore rehearsal, verify restored data, schema, constraints and authorization behavior (RLS and grants, household isolation) by re-running the pgTAP and integration checks against the restored database; define forward-fix procedures for a failed migration; record operational responsibilities. No destructive test against hosted data; keep the operating model proportionate to the MVP.
```

#### KAN-77

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Added: the intended Android distribution artifact is qualified in PF-S3-T10-S5 (new) (DIST-01): signer, SHA-256, source commit and an analysis of that exact artifact, separate from the old test APK that AVG flagged (Codex QA-11). No tester receives an APK before the owner's distribution-trust decision.
```

#### PF-S3-T10-S4 [KAN-106]

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Additional checklist lines (Codex assessment):
8. Artifact trust: DIST-01 (PF-S3-T10-S5 (new)) completed with an owner distribution-trust decision.
9. Externally deleted pantry records: PF-S3-T14 (new) fixed, or the known limitation disclosed to testers with a workaround (pull to refresh or restart).
Supervised versus broader beta: this checklist admits a supervised Android beta (invited testers, direct support contact). A broader, unassisted beta additionally needs KAN-42 and KAN-43 delivered (not only interim support paths), KAN-72 published, OPS-01 monitoring reviewed after the supervised phase, and the UX-08B findings triaged.
```

#### PF-S3-T13-S1 [KAN-113]

New summary: **GOV-01: Define risk tiers, PR evidence format and review requirements**

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Scope extended with Codex QA-09 (CR-04), combined here rather than in a new issue:
- A concise mandatory PR description: objective and Jira references (key and subject); summary of actual changes; relevant specification decisions; verification performed with results; checks not run and known limitations; material review findings with dispositions; remaining risks.
- Review requirements per risk tier; independent review (a separate reviewer or a fresh model instance that did not implement the change) is distinguished from self-review by the implementing agent, and the PR states which happened.
- Material review evidence is durable and linked from the PR (in the PR body or a committed file), not only in ignored local folders.
- Unverified claims are not presented as completed verification.
- Existing CI checks, branch protection and write-safety mechanisms stay unchanged. Mandatory GitHub human approvals are not enabled automatically; that is a separate owner decision for a solo-developer project.
- Keep it short: one PR template and a few lines in AGENTS.md, no new framework.
```

#### PF-S3-T9-S4 [KAN-105]

New summary: **ASSESS-01: Run an independent Slice 3 quality assessment against both Slice 2 benchmarks**

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Renamed from "QA-01" to avoid confusion with Codex finding QA-01.
Methodology (both Slice 2 reports are kept as separate benchmarks; scores are not averaged):
- Keep the categories, weights and grading scale.
- Mark unmeasured categories (for example performance without measurements) as NOT VERIFIED and mechanically normalize the remaining weights; record completeness.
- Measure representative performance (PERF-01) before assigning a confident performance grade.
- Separate external-user evidence (UX-08B) from expert usability inspection.
- State whether the assessor is independent or the implementing agent.
- Grade AI engineering efficiency only with adequate evidence (for example delivery and rework records); otherwise NOT VERIFIED.
- Release-blocking findings override the aggregate grade.
```

#### PF-S3-T5-S3 [KAN-100]

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Scope correction (Codex QA-07): the edit screen's status selector (app/edit-item/[id].tsx, three Pressable status pills, not OptionChips) also lacks role and selected state; it is in scope. The new direct status control (UX-01B) follows the same contract.
```

#### PF-S3-T11 [KAN-87]

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Source added: Codex QA-04 (initial inventory and finding items have unvalidated everyday effort). Both assessments rate usability well below engineering; this workstream is not downgraded.
Principles added: source-derived tap counts are not proof of better usability; observed user behavior (UX-08B) decides. Fix the externally deleted record defect (PF-S3-T14 (new)) before UX-01B. Extract the D3 prompt orchestration only when the direct status control is a real second consumer; no generic provider abstraction because Pantry and Shopping providers look alike.
```

#### PF-S3-T11-S2 [KAN-91]

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Additional criteria: the interaction targets count both answers to the shopping prompt, accepting and declining (at most 3 interactions either way). Depends on PF-S3-T14 (new), which changes the same update path and must land first.
```

#### PF-S3-T11-S5 [KAN-94]

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Additional criteria (Codex QA-04): reduce repeated modal navigation during initial entry where practical (for example staying on the add form after a save); entered information is preserved on every error.
```

#### PF-S3-T11-S10 [KAN-99]

```text
Refinement 2026-11-18 - independent Codex assessment integration (PF-S3-CODEX-INTEGRATION-20261118); the text above is unchanged.
Additional measures (Codex QA-04 and the owner brief): perceived administrative effort, repeated usage over the study period and willingness to continue. Report source-derived interaction counts separately from observed behavior; fewer taps alone is not reported as a usability improvement.
```

## D. Updated implementation sequence

1. **Immediate investigations.** No code involved; they can start once the backlog is approved.
   - SEC-01 (advisories, CR-03);
   - DIST-01 (APK warning, CR-02): recover the evidence while it still exists;
   - SEC-02 (hosted read-only re-check, needs authorization);
   - CI-01.
2. **Owner decisions.** All in parallel:
   - KAN-51 roadmap and D5;
   - UX-01A design;
   - KAN-81 password policy;
   - KAN-57 deletion;
   - OPS-01 vendor;
   - GOV-01 tiers and PR format;
   - SEC-06 storage decision.
3. **Correctness fix first.** CR-01 (deleted pantry records). It is small, test-first, and changes the update path UX-01B builds on.
4. **Quick, independent work:**
   - TEST-01;
   - A11Y-01, including the status pills;
   - UX-04 Return-to-save;
   - ARCH-02;
   - PERF-01 "before" measurement.
5. **Core usability:** UX-02 search → UX-01B direct status (after CR-01 and the UX-01A approval) → UX-06 → UX-03.
6. **Account lifecycle and language:** KAN-80/42, KAN-43, then KAN-44 once the UX strings settle; UX-07 places the entries in Settings.
7. **Beta preparation:**
   - OPS-01;
   - KAN-72 beta subset;
   - KAN-77 plus DIST-01 artifact qualification;
   - BETA-01 sign-off;
   - TEST-02 design.
8. **Supervised Android beta and evidence:** UX-08A/B; NATIVE-01 on the phone (it can share a device session with PERF-01); TalkBack audit (KAN-45/64).
9. **Acceptance:**
   - KAN-74/75;
   - KAN-67/65/66 for public release;
   - PERF-01 "after";
   - ASSESS-01;
   - KAN-76 GO/NO-GO;
   - KAN-78/79.

**Independent tracks:**
- iOS (KAN-47 + A11Y-02);
- website (KAN-48);
- governance (GOV-01/02);
- engineering hygiene (T12).

## E. Decisions requiring owner approval

| ID | Decision | Recommendation |
|---|---|---|
| S3-C1 | Approve this delta: 1 Task, 3 Subtasks, 13 refinements, including two summary renames | Approve |
| S3-C2 | CR-01 timing | Fix before the supervised beta; it's small and the beta otherwise needs a disclosed workaround |
| S3-C3 | DIST-01: may private APKs be uploaded to public multi-engine scanners? | Decide when DIST-01 starts; default is no, and use local or owner-run analysis |
| S3-C4 | Mandatory GitHub approvals for a solo project | Don't enable them; GOV-01 records whether review was independent in every PR |
| S3-C5 | Session storage (SEC-06) | Decide from SEC-06's threat model before public release; no change before then |
| S3-C6 | Native Jira "blocks" links (the CLI can't create them) | Optional, by hand. The useful ones: CR-01 → UX-01B; UX-01A → UX-01B; SEC-01, SEC-02, OPS-01, DIST-01 → BETA-01; KAN-57 → KAN-58; KAN-81 → KAN-82 |
| S3-C7 | Commit the Codex report as a separate benchmark file | Yes. Its linked logs (`fast.log`, probe log, `audit.json`) stay in the ignored local evidence folder, as its adoption note says. |
| Still open from op 1 | S3-Q3 roadmap, S3-Q4 D5, S3-Q5 to S3-Q11, S3-Q13, S3-Q15 | Unchanged |

## F. Proportionality review

**Combined instead of new issues:**

| Requirement | Combined into |
|---|---|
| CR-03 | SEC-01 |
| CR-04 | GOV-01 |
| CR-05 | KAN-80 |
| CR-07 | KAN-67 |
| QA-07 | A11Y-01 |
| QA-04 | The existing UX items |

Only four items are new.

**Could be simplified or deferred** without weakening correctness, security or usability:
- **TEST-03** (stub helpers, P3) and **GOV-02** (process retrospective, P3): leave in Backlog. Do them only if the stub duplication or the process actually hurts.
- **CI-01** (P3): close as "monitored" if no further Gradle failure appears before TEST-02.
- **UX-05** (bulk-entry discovery): start only after UX-04 and UX-08B data exist.
- **NATIVE-01 and PERF-01:** run in the same physical-device session.
- **SEC-06:** a decision record only; no storage change unless the threat model justifies one.

**Deliberately not proposed:**
- a generic provider or CRUD abstraction;
- offline sync;
- a mutation-testing platform;
- mandatory human approvals;
- additional review layers.

## G. Updated gate criteria

| Gate | Criteria |
|---|---|
| **Slice 3 implementation authorization** | Slice 2 accepted and tagged (done 2026-11-18). KAN-51 scope decisions recorded (roadmap S3-Q3, D5 S3-Q4). Both backlog operations applied and read back. The owner authorizes implementation of named packages; each package states its risk tier (GOV-01). |
| **Slice 3 completion (GO)** | **Mandatory items delivered:** CR-01, UX-01B, UX-02, UX-04, UX-07, A11Y-01, KAN-42/80, KAN-43, KAN-44 (or an explicit owner scope revision). **Checks green on the exact head and protected main:** fast, database, API, SonarCloud; full Android E2E and phone qualification (KAN-75). **Evidence recorded:** NATIVE-01 results, including incomplete items reported as incomplete; PERF-01 before and after; ASSESS-01 report. **Outstanding work:** no unresolved confirmed blocking defect; limitations owned (KAN-76). |
| **Supervised external Android beta** | BETA-01 lines 1–9 signed: SEC-02, OPS-01, interim or real reset and deletion paths, KAN-72 beta subset, SEC-01 disposition, language and feedback disclosure, tester instructions and KAN-77 artifact, DIST-01 trust decision, CR-01 fixed or disclosed. Explicit owner authorization to invite named testers. Slice 3 GO is not required (S3-Q7). |
| **Broader external beta** | Supervised-beta criteria plus: KAN-42 and KAN-43 delivered; KAN-72 full content published; OPS-01 data reviewed after the supervised phase; UX-08B findings triaged; CR-01 fixed (no workaround). |
| **Android public release** | Slice 3 GO plus: KAN-44 German; KAN-45/64 TalkBack acceptance; KAN-46 subtasks closed (KAN-65 premium disposition, KAN-66 redaction and DMARC plan, KAN-67 populated migration and restore with authorization checks, SEC-06 decision); KAN-48/72/78 public information and deletion route; KAN-77 signed release artifact with DIST-01; UX-08B evidence-based usability judgment; KAN-79 Android GO. |
| **iOS public release** | Every Android public-release criterion that applies, plus: KAN-68 build, KAN-69 iPhone validation, A11Y-02 and KAN-64 VoiceOver acceptance, KAN-70 TestFlight, iOS-specific NATIVE-01 items; KAN-79 iOS GO, decided separately from Android. |

## Apply procedure (after approval)

This follows the same procedure as operation 1:
1. **Preconditions:** run only after operation 1 completed and was read back.
2. **Preflight:** check timestamps and duplicate backlog-ID labels.
3. **Creates:** the Task first, then the Subtasks. Each is previewed, applied with exact `--apply`, and read back.
4. **Refinements:** existing text verbatim plus the appended block, the added label, and the two summary renames. Each is read back.
5. **Record:** a final hierarchy read-back and a creation record.
