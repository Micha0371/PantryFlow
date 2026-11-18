# Slice 3 — quality-assessment integration (Jira dry run)

**Status: APPROVED by the product owner on 2026-11-18** ("approved, slice 2 accepted, please tag, kan 6 approved for closure … slice 2 tag is current baseline for regression testing"). Backlog approval does not authorize implementation, an external beta or a public release; those remain separate decisions.

**Owner decisions recorded with the approval:**
- **S3-Q1:** this plan is approved.
- **S3-Q2:** Slice 2 is accepted. The annotated tag `pantryflow/slice-2-baseline` → `ec0dbdd` was created and pushed, and it is the current baseline for regression testing.
- **S3-Q14:** KAN-6 was moved to Fertig.

These decisions changed the approved drafts in two ways:
- The KAN-40, KAN-41 and KAN-52 refinement texts now record the acceptance and the tag.
- One refinement was added to KAN-49, recording the regression baseline. That makes 18 refinements instead of 17.

The baseline table below shows the state before approval.

- **Operation ID:** `PF-S3-QA-INTEGRATION-20261118`
- **Drafts:** [2026-11-18-slice-3-qa-integration-drafts.json](2026-11-18-slice-3-qa-integration-drafts.json), the exact payloads for section C.
- **Source assessment:** [2026-11-18 quality assessment baseline](../quality/2026-11-18-quality-assessment-baseline.md). Overall B (84.5); usability C (75); development GO, subject to Slice 2 acceptance; external beta CONDITIONAL GO; public production NO-GO.
- **Revised Slice 3 objective (owner brief, 2026-11-18):** PantryFlow — Slice 3: Usability, Product Refinement and Launch Readiness. The guiding principle is that PantryFlow must reduce household administration, not become another administrative obligation.

**Independence.** The assessment was written by the agent that implemented the Slice 2 follow-ups, and so was this plan. Every finding was therefore re-checked against the source before getting a disposition (section B, "Verified"). Recommendations stay recommendations: for example, F-05 says how many taps a status change takes, but it does not fix a design.

## Baseline (verified 2026-11-18)

| Item | State | How verified |
| --- | --- | --- |
| Repository | `origin/main` = `ec0dbdd` (merge of PR #40). That is the assessed commit, so main has not moved since the assessment. | `git fetch`, `git log` |
| Owner's main checkout | Branch `pantryflow/profile-baseline-reconciliation` at `f7a198f`, already merged into main. It holds three untracked Slice 3 planning files: the 2026-11-17 dry run, the creation record and the drafts JSON. Jira descriptions reference them, but they aren't on main (decision S3-Q12). | `git status`, `git merge-base` |
| Open PRs | None | GitHub API, unauthenticated |
| Tags | `pantryflow/slice-1.1-baseline` and `pantryflow/sdk58-validated` only. **No Slice 2 baseline tag.** | `git tag` |
| KAN-6 (Slice 2 epic) | Backlog, no comments | Jira CLI `get`, `comments` |
| KAN-51, KAN-52 | Backlog, no comments | Jira CLI |
| Slice 2 follow-ups | KAN-27, KAN-32 to KAN-39 and KAN-84 to KAN-86 are Fertig | Jira CLI, PRs #36–#40 |
| Slice 3 backlog | 44 issues, KAN-40 to KAN-83 (1 Epic, 11 Tasks, 32 Subtasks), all Backlog. The highest key is KAN-86. | Jira CLI `get` for KAN-40 to KAN-95 |
| KAN-40 title | The owner already renamed it to "[Slice 3] Usability, Product Refinement and Launch Readiness" on 2026-11-18. The description still says "hardening, not a feature-expansion slice". | Jira `updated` field |
| Stale text in existing issues | KAN-41, 45, 53, 63 and 64 say KAN-34 is "in CI" and that `Input.tsx` renders plain error text. Both are outdated. | Code on `ec0dbdd`, Jira |
| Hosted `00004` | Applied and verified on 2026-11-11 (`docs/testing/hosted-shopping-migration.md`). The assessment didn't re-verify it. | Repository record |
| Advisory register | Last assessed 2026-11-09 and says "zero high". `npm audit` on `ec0dbdd` showed a new high (picomatch). | `docs/security/tooling-advisories.md`, assessment log |
| CI | android runs only on dispatch, schedule or a `[full-e2e]` push. The required checks are fast, database and SonarCloud. | Workflow file, branch protection |
| Specs | PRD §2 lists sharing, the premium split and the 75-item limit as MVP; Flow 3 targets 2–3 taps. Slice 2 plan D3 (prompt) and D5 (filters, German and the language switcher deferred). There is no standalone Slice 3 spec. | Files on `ec0dbdd` |

**What the CLI can do.** The approved Jira CLI can:
- create issues: summary, type, parent, description, labels, plus priority for Tasks only;
- update an existing issue's summary, description and labels.

It cannot:
- set priority on Subtasks, because Jira's creation screen doesn't expose it, so it defaults to Medium;
- change parent or priority on existing issues;
- create native issue links.

The plan works within those limits:
- Subtask priority is carried in a `p1`, `p2` or `p3` label and stated in the description.
- Dependencies are descriptive references, as in the original Slice 3 import.

## A. Existing backlog assessment

- **Epic.** [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40) has the revised title. Its description needs the revised objective, the principle and the new workstreams (refinement).
- **Tasks and Subtasks.** KAN-41 to KAN-50 and KAN-80, with subtasks KAN-51 to KAN-79 and KAN-81 to KAN-83. They already cover most launch-readiness findings:
  - password recovery (KAN-42), deletion and retention (KAN-43), EN/DE (KAN-44);
  - accessibility qualification (KAN-45), security, migrations and recovery (KAN-46), iOS (KAN-47);
  - website and feedback (KAN-48), regression and GO/NO-GO (KAN-49), beta and public gate (KAN-50), password policy (KAN-80).
- **What they don't cover:** everyday usability (F-05, F-06, F-14), crash reporting (F-11), test and CI hygiene (F-08, F-12, F-15), legacy cleanup (F-18), performance evidence, process proportionality, and an explicit external-beta entry gate.
- **Slice 2 acceptance:**
  - not recorded: KAN-6 and KAN-52 are Backlog and no Slice 2 tag exists;
  - all Slice 2 follow-up work is merged and closed;
  - KAN-52 is the existing closure task, so it gets refreshed evidence rather than a duplicate.
- **Existing blockers:**
  - Public release: KAN-42, 43, 44, 45, 46, 50 and 80 (all marked mandatory public-release gates).
  - iOS: KAN-47.
  - Slice 3 acceptance: KAN-49.
  - Slice 3 implementation: KAN-41 (readiness).
  - External beta: no gate exists. This plan adds BETA-01 and its three security and operations prerequisites.

## B. Finding traceability matrix

"Verified" means the finding was re-checked on `ec0dbdd` in this planning pass.

| Finding | Current status (verified) | Existing Jira key | Proposed action | Priority | Release impact |
|---|---|---|---|---|---|
| F-01 Password recovery | Open. `lib/auth.tsx` has no recovery operation. | KAN-42, KAN-54–56; policy KAN-80–83 | **Covered; existing issue requires refinement** (KAN-42: enumeration and abuse protection, session handling, KAN-80 policy, interim beta path in BETA-01) | P1 | Public release; beta needs the interim path (BETA-01) |
| F-02 Account deletion and retention | Open. Settings has Sign out only. | KAN-43, KAN-57–59 | **Covered; refine** KAN-43: single-household contract that doesn't presume Slice 4 sharing, per-table attribution, interim beta request path | P1 | Public release; beta needs the interim path |
| F-03 iOS build and validation | Open; no iOS build. Also `announceError` is Android-only. | KAN-47, KAN-68–70 | **Covered**; **new Subtask** A11Y-02 (VoiceOver error announcements, PF-IOS-001) | P1 for iOS | iOS release only |
| F-04 Selection chips inaccessible | Confirmed: `OptionChips.tsx` Pressables have no role or state | KAN-45 / KAN-63 | **New Subtask** A11Y-01 under KAN-45 (KAN-63's own rule asks for a scoped follow-up for confirmed gaps). KAN-45, KAN-63 and KAN-64 are refined for stale context. | P1 | Public release, Slice 3 acceptance |
| F-05 Status change takes 3–4 taps | Confirmed: status changes only in the edit screen | — | **New Subtasks** UX-01A (design, owner approval) and UX-01B (implementation) under the new usability Task | P1 | Slice 3 acceptance |
| F-06 No search, sort or filter | Confirmed: no search or filter in `index.tsx` and `pantry-data.ts` | D5 (no Jira issue) | **New Subtasks** UX-02 (search, P1) and UX-03 (sort and filter evaluation, P2). **PO decision**: revise D5 (KAN-51 refinement). | P1 search / P2 sort | Slice 3 acceptance (search) |
| F-07 Stale advisory register | Confirmed: register dated 2026-11-09 says zero high; audit shows a picomatch high | KAN-66 (KAN-27 is unrelated: Sonar, Fertig) | **New Subtask** SEC-01 under KAN-46; KAN-66 refined so its advisory part moves to SEC-01 | P1 investigation | External beta |
| F-08 Android E2E not required | Confirmed: android `if:` limited to dispatch, schedule or `[full-e2e]` | — | **New Subtask** TEST-02 under the new engineering Task; branch-protection change separately approved | P2 | Recommended before Android production |
| F-09 German incomplete | Confirmed: `de.ts` is a stub | KAN-44, KAN-60–62 | **Covered**. New UX tasks list their strings for KAN-60; no change to KAN-44. | P1 | Public release |
| F-10 PRD-versus-slice scope | Confirmed: PRD §2 sharing, premium and 75 items; no slice schedules them | KAN-51 | **Requires product-owner decision**; **refine** KAN-51 with the proposed roadmap decision record (appendix 1) | P1 decision | Public release (decision) |
| F-11 No crash or error monitoring | Confirmed: no SDK in `package.json` | Not covered (KAN-66 is logging; KAN-73 is user feedback) | **New Subtask** OPS-01 under KAN-46 (vendor decision, then integration) | P1 | External beta |
| F-12 No test timeout | Confirmed: `node --test` without a timeout | — | **New Subtask** TEST-01 | P2 | Development quality |
| F-13 Pantry rows lack semantics | Confirmed: `PantryItem.tsx` Pressable has no role or label | KAN-63 | **New Subtask** A11Y-01, combined with F-04 | P1 (raised from Low: same fix, same gate) | Public release |
| F-14 Return doesn't save | Confirmed: `add-item.tsx` has only `autoFocus` | — | **New Subtask** UX-04 (Return-to-save plus a continuous-entry evaluation) | P1 workflow / P2 detail | Slice 3 acceptance |
| F-15 Gradle flake | One occurrence (run 44225392722 attempt 1); the re-run passed | — | **New Subtask** CI-01: investigate, and close as monitored without evidence | P3 | None |
| F-16 Prompt orchestration in the 307-line screen | Confirmed: 307 lines | — | **Folded into** UX-01A: extract only if the new status control reuses it (ARCH-01) | P3 | None |
| F-17 Hosted Slice 2 schema not verified | **Recorded as applied and verified 2026-11-11**; not re-verified since | KAN-29 (Fertig), KAN-46/67 | **Already addressed (recorded)**; **new Subtask** SEC-02 refreshes it read-only before beta | P1 before beta | External beta |
| F-18 Legacy Emergent scaffold | Confirmed: `frontend/`, `backend/`, root `tests/`, `test_reports/`, `test_result.md`; no workflow references | PF-LEGACY-001 (no Jira issue) | **New Subtask** ARCH-02 | P2 | None (Sonar accuracy) |
| F-19 DMARC `p=none` | Confirmed in `production-follow-ups.md` (PF-EMAIL-002) | KAN-66 | **Covered; refine** KAN-66 with a staged enforcement plan, no automatic change | P2 | Before public production |

No finding is dropped. No finding is fully deferred. F-15 and F-16 are conditional: each can end in "no change", with the reason recorded.

**Other items from the brief:**

| Item | Disposition |
|---|---|
| SEC-03 (PF-DATA-001) | KAN-67 refined |
| SEC-04 (PF-PREMIUM-001) | KAN-65 refined |
| SEC-05 | Is F-19 (KAN-66) |
| TEST-04 | KAN-74 refined |
| ARCH-03 | Exclusion text in the engineering Task |
| Performance (§11) | PERF-01 |
| Operational readiness (§12) | OPS-01, BETA-01, KAN-48/72/73/77/67 |
| §14 | New governance Task with GOV-01 and GOV-02 |
| §15 | QA-01 under KAN-49 |

## C. Proposed Jira changes

No new Epic: KAN-40 already carries the revised objective. Summary:

- **New Tasks (3):** PF-S3-T11 usability (High), PF-S3-T12 engineering (Medium), PF-S3-T13 governance (Medium), all under KAN-40.
- **New Subtasks (25):** 10 under PF-S3-T11, 6 under PF-S3-T12, 2 under PF-S3-T13, and 7 under existing Tasks: A11Y-01 (KAN-45), A11Y-02 (KAN-47), SEC-01, SEC-02 and OPS-01 (KAN-46), QA-01 (KAN-49), BETA-01 (KAN-50).
- **Refinements (18):** existing descriptions are kept verbatim and a dated block is appended.
- **Links:** none native (see S3-Q13).
- **Deferred:** see section G.

The owner asked to use Subtasks wherever reasonable, so:

- gated pieces with their own release class are separate Subtasks rather than edits to existing ones (SEC-01, SEC-02, OPS-01, BETA-01, A11Y-02);
- design and implementation are split (UX-01A/B);
- preparing and running the study are split (UX-08A/B).

### C.1 New issues (28: 3 Tasks, 25 Subtasks)

Parent `PF-S3-T11`-style IDs are local placeholders; they resolve to the Jira keys created earlier in the same run. Every new issue also gets the labels `pantryflow`, `slice-3`, its backlog-ID label and `qa-2026-11-18`. Each description ends with this footer:

```text
Operation ID: PF-S3-QA-INTEGRATION-20261118
Plan: docs/planning/2026-11-18-slice-3-qa-integration-dry-run.md
Source assessment: docs/quality/2026-11-18-quality-assessment-baseline.md (assessed main ec0dbdd, 2026-11-18). Assessment findings are evidence, not verified fact; the assessor also implemented Slice 2 follow-ups.
Dependencies are description references, not native Jira links: the approved CLI has no link operation.
```

#### PF-S3-T11 — [Slice 3] Simplify everyday household workflows

Task under `KAN-40`, priority High. Extra labels: `p1`, `slice3-acceptance`, `usability`.

```text
Backlog ID: PF-S3-T11
Source findings: F-05, F-06, F-14, F-16 (via UX-01A), usability category C (75) of the 2026-11-18 assessment.
Priority: P1 (High). Release classification: Slice 3 acceptance blocker for UX-01, UX-02, UX-04 and UX-07; UX-03 and UX-05 are discovery; UX-08A/B gate public release.

Problem: the technical foundation is stronger than everyday usability. Changing a status takes 3 taps (4 with the shopping prompt; PRD Flow 3 targets 2-3), the pantry list has no search, the Return key does not save a new item, and nothing has been validated with ordinary household users.
Impact: frequent small actions cost more effort than the product promises; PantryFlow risks becoming another administrative obligation.
Principle: reduce household administration. Prefer fewer interactions, understandable behavior, reliable data, predictable navigation and low cognitive load. Do not add features to match competitor lists. This is not a visual redesign.

Scope: the subtasks UX-01A to UX-08B. Accessibility (roles, labels, selected states, announcements) and EN/DE strings are part of each subtask's acceptance, not deferred to KAN-45/KAN-44; new strings are listed for KAN-60.
Exclusions: no visual redesign, no new backend or search service, no state library, no change to D1-D4, strict pantry uniqueness or RLS, no sharing or premium behavior.
References: PRD section 2 and Flow 3; Slice 2 plan D3 and D5 (docs/planning/slice-2-implementation-plan.md); assessment section C1 interaction table.
Dependencies: KAN-41 readiness (Slice 2 acceptance KAN-52, scope decisions KAN-51 including the D5 revision for search). Coordinate with KAN-44 (German), KAN-45 (accessibility audit), KAN-49 (regression).

Acceptance criteria:
- Each subtask meets its own criteria; interaction counts before and after are recorded for status change, add-to-list and initial item entry.
- No regression in D1-D4, strict pantry uniqueness, duplicate messages, double-tap and lost-dialog guards (existing Node, Jest, pgTAP, integration and Maestro suites green).
- New interactions are reachable and understandable with TalkBack; VoiceOver evidence follows KAN-47.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T11-S1 — UX-01A: Design the direct pantry status change

Subtask under `PF-S3-T11`. Extra labels: `p1`, `slice3-acceptance`, `usability`, `discovery`.

```text
Backlog ID: PF-S3-T11-S1 (UX-01A)
Source findings: F-05 (status change takes 3-4 taps), F-16 (prompt orchestration in app/edit-item/[id].tsx). Priority: P1. Release classification: gates UX-01B; design only.

Problem: status is changed only through the edit screen (row, chip, Save; plus Add in the shopping prompt).
Scope: compare at most three explicit-selection designs, for example a status badge that opens a three-option inline selector, a long-press action menu, or a compact segmented control in an expanded row. Count taps for: normal change, change plus accepting the prompt, and correcting a mistaken change. Describe TalkBack semantics for each (role, label, selected state or accessibility actions). Recommend one with a low-fidelity mock in the repository.
Decide whether the D3 orchestration (save, prompt, add, notice, focus guards) moves into a focused hook shared by the edit screen and the new control (F-16 / ARCH-01). Extract only if the new control reuses it; do not refactor for line count alone.
Exclusions: no blind status cycling only to reduce taps; no implementation.
Dependencies: KAN-41 readiness.

Acceptance criteria:
- The recommended design reaches a normal change in at most 2 intentional interactions and change plus prompt acceptance in at most 3; all three statuses (In stock, Low, Out) stay explicitly selectable.
- The D3 rules are restated against the design: prompt only on a change to Low or Out, never on unchanged or In stock; a failed shopping add never rolls back the pantry change.
- Discoverability for first-time users and the screen-reader interaction are described.
- The owner approves the design, or chooses another, before UX-01B starts.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T11-S2 — UX-01B: Implement the approved direct status change on the pantry list

Subtask under `PF-S3-T11`. Extra labels: `p1`, `slice3-acceptance`, `usability`.

```text
Backlog ID: PF-S3-T11-S2 (UX-01B)
Source finding: F-05. Priority: P1. Release classification: Slice 3 acceptance blocker. Risk tier: medium (UI workflow, state, business rule reuse).

Problem: see UX-01A. Impact: the most frequent pantry action costs 3-4 taps.
Scope: implement the design approved in UX-01A, reusing the existing pantry update operation, offersShoppingAdd, the shopping add operation and the existing mutation guards (useItemMutation/current(), useSingleOpen). Apply the F-16 extraction decision from UX-01A.
Exclusions: no visual redesign, no new backend or search service, no state library, no change to D1-D4, strict pantry uniqueness or RLS, no sharing or premium behavior.
Dependencies: UX-01A approved; KAN-41 readiness.

Acceptance criteria:
- Users change status without opening the edit screen; In stock, Low and Out remain explicitly selectable; the edit screen keeps all its functions.
- A normal change takes at most 2 intentional interactions; change plus accepting the shopping prompt at most 3.
- The prompt appears only for the D3 transitions (to Low or Out from a different status); a failed shopping add does not roll back the pantry change and shows an understandable, recoverable error; an open duplicate shows the existing translated duplicate message.
- Repeated or fast taps cause no duplicate mutation, prompt or navigation; a change pending while the household or user changes cannot write into the new scope.
- The control is accessible: role, label with item name and current status, selected state, and the result announced to TalkBack.
- Strings exist in en.ts and are listed for German (KAN-60).

Verification: failing-before Node/Jest screen and provider tests (transition matrix, prompt suppression, failed add, double tap, scope change); extended Maestro journey with database read-back; TalkBack check on the phone; full test:fast and test:local.
Security/privacy: no pantry or shopping contents, account identifiers, tokens or recovery links in logs or committed evidence; household authorization stays database-enforced (RLS); fixtures only in screenshots.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T11-S3 — UX-02: Search the pantry list by name

Subtask under `PF-S3-T11`. Extra labels: `p1`, `slice3-acceptance`, `usability`.

```text
Backlog ID: PF-S3-T11-S3 (UX-02)
Source finding: F-06. Priority: P1. Release classification: Slice 3 acceptance blocker. Risk tier: medium (new UI workflow).

Problem: the pantry list is a flat list, newest first (app/(tabs)/index.tsx, lib/pantry-data.ts); beyond about 30 items users must scroll to find an item.
Scope: a name search field on the Pantry tab that filters the already loaded household inventory locally. The provider already loads the full household list, so no query or index change is needed.
Exclusions: no search service, database search, fuzzy matching or saved searches; sort and filters are UX-03; no visual redesign, new backend, state library, or change to D1-D4, strict pantry uniqueness or RLS.
Dependencies: KAN-51 records the D5 revision (search moves into Slice 3; filters stay with UX-03). KAN-41 readiness.

Acceptance criteria:
- Search matches item names case-insensitively, consistent with the pantry name normalization (trim, lower-case); leading and trailing whitespace in the query is ignored.
- Results update predictably while typing; clearing the query restores the complete inventory.
- A no-match state ("No items match ...") is visibly different from the empty-pantry state and offers clearing the search.
- Search never changes stored data and shows only the current household's items (filtering happens on the provider's household-scoped list).
- Results stay correct after adding, editing, deleting and status-changing items, and after a household or user change.
- The keyboard does not cover the field, results or the add action; the field has an accessible label and the result count is announced.
- Works in English and German (strings listed for KAN-60).

Verification: failing-before screen tests for normal, empty-pantry, no-match, clear and post-mutation states; Maestro search step with a fixture inventory; TalkBack check.
Security/privacy: no pantry or shopping contents, account identifiers, tokens or recovery links in logs or committed evidence; household authorization stays database-enforced (RLS); fixtures only in screenshots.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T11-S4 — UX-03: Evaluate simple pantry ordering and status filtering

Subtask under `PF-S3-T11`. Extra labels: `p2`, `discovery`, `usability`.

```text
Backlog ID: PF-S3-T11-S4 (UX-03)
Source finding: F-06 (sort and filter part). Priority: P2. Release classification: discovery; implementation needs a separate owner decision.

Problem: the list is ordered newest first only. D5 deferred pantry filters to the localization slice.
Scope: evaluate whether alphabetical ordering, Low/Out items first, or a single status filter reduces effort beyond what UX-02 search achieves. Define one sensible default. Reconcile with D5 and record the outcome in KAN-51.
Exclusions: no filter panel, no multiple configuration options, no implementation in this item.
Dependencies: UX-02 delivered or at least designed, so the evaluation measures the remaining gap.

Acceptance criteria:
- The most useful one or two options and a default order are proposed with the reasoning (frequency of the "what do I need to buy" question versus "where is X").
- The evaluation states whether search alone solves the main problem.
- The proposed behavior is documented and approved or rejected by the owner; D5's status is updated in KAN-51.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T11-S5 — UX-04: Faster pantry item creation (Return to save, continuous entry)

Subtask under `PF-S3-T11`. Extra labels: `p1`, `slice3-acceptance`, `usability`.

```text
Backlog ID: PF-S3-T11-S5 (UX-04)
Source finding: F-14 (Return does not save in app/add-item.tsx). Priority: P1 for the workflow, P2 for individual small changes. Release classification: Slice 3 acceptance (Return-to-save); continuous entry only if shown easier. Risk tier: medium.

Problem: each new item costs 2-4 taps plus typing; 20 items take about 40-80 taps.
Scope: Return-to-save on the name field; evaluate a simple continuous-entry option (for example "Save and add another" or staying on the form after save). Measure taps before and after.
Exclusions: no extra buttons unless the measured workflow is easier; bulk entry is UX-05.
Dependencies: KAN-41 readiness.

Acceptance criteria:
- Return saves when the input is valid; invalid input shows the existing translated error without navigation or data loss.
- Strict duplicate prevention is unchanged (client check and database index).
- A failed save keeps the entered name and selected category, location and status.
- Double submission (Return plus Save, or repeated Return) creates at most one item.
- Optional category and location never block a quick name-only add.
- The single-item add stays straightforward; tap counts before and after are recorded.

Verification: failing-before screen tests (Return valid/invalid/duplicate, double submit, failed save keeps values); Maestro add step via Return; phone keyboard check.
Security/privacy: no pantry or shopping contents, account identifiers, tokens or recovery links in logs or committed evidence; household authorization stays database-enforced (RLS); fixtures only in screenshots.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T11-S6 — UX-05: Discover whether bulk inventory entry is worth building

Subtask under `PF-S3-T11`. Extra labels: `p2`, `discovery`, `usability`.

```text
Backlog ID: PF-S3-T11-S6 (UX-05)
Source: assessment weakness "no bulk entry"; owner usability brief. Priority: P2. Release classification: discovery; full implementation needs a separate owner decision.

Problem: initial inventory setup may be an abandonment risk.
Scope: evaluate a lightweight one-item-per-line entry against continuous single-item entry (UX-04). A prototype is allowed. Cover duplicate detection against existing items and within the batch, whitespace normalization, invalid entries, partial failures, per-item feedback (added or rejected and why) and safe retry.
Exclusions: no silent merging, automatic renaming or duplicate insertion; uniqueness stays database-enforced; no implementation in the app without approval.
Dependencies: UX-04 measurements; UX-08A/B observations if available.

Acceptance criteria:
- Evidence or a reasoned estimate shows whether setup effort is a meaningful abandonment risk.
- A recommendation states whether continuous entry suffices or bulk entry adds substantial value, with draft acceptance criteria for a possible implementation.
- The owner decision is recorded.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T11-S7 — UX-06: Review interaction consistency across Pantry and Shopping

Subtask under `PF-S3-T11`. Extra labels: `p2`, `slice3-acceptance`, `usability`.

```text
Backlog ID: PF-S3-T11-S7 (UX-06)
Source: assessment section C1; owner usability brief. Priority: P1 or P2 per confirmed finding. Release classification: review is Slice 3 acceptance; each fix is scoped separately.

Scope: review Pantry and Shopping together for add/edit form consistency; Save, Cancel and Remove behavior; keyboard handling; back and navigation behavior; duplicate navigation prevention; error presentation; preservation of input after failures; loading and retry states; unnecessary dialogs; accidental destructive actions. Investigate whether undo would help.
Exclusions: do not reopen resolved findings (KAN-32 to KAN-39, KAN-84 to KAN-86) without new evidence of a regression; keep confirmation for destructive actions; no soft delete or extra database complexity without a separate decision.
Dependencies: UX-01B and UX-02 designs, so the review covers the new interactions.

Acceptance criteria:
- A findings list with reproduction, severity and proposed fix is recorded in the repository.
- Confirmed P1 inconsistencies are fixed with failing-before tests or receive an owner disposition; others are dispositioned.
- The undo investigation ends in a recorded recommendation, not an implementation.

Verification: walkthrough on the phone and in tests; fixes follow the normal test-first rule.
Security/privacy: no pantry or shopping contents, account identifiers, tokens or recovery links in logs or committed evidence; household authorization stays database-enforced (RLS); fixtures only in screenshots.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T11-S8 — UX-07: Simplify the first-use experience and Settings

Subtask under `PF-S3-T11`. Extra labels: `p1`, `slice3-acceptance`, `usability`.

```text
Backlog ID: PF-S3-T11-S8 (UX-07)
Source: assessment section C1 (registration about 7 taps plus email round-trip; Settings has only Sign out). Priority: P1. Release classification: Slice 3 acceptance blocker.

Scope: review registration, email confirmation, first login, empty pantry, initial inventory and the first shopping-list interaction. Place account recovery (KAN-42), language (KAN-61), account deletion (KAN-58), support and feedback (KAN-72/KAN-73) in Settings as they are delivered, without accumulating options.
Exclusions: no lengthy tutorial; no mandatory exhaustive inventory entry; no marketing screens.
Dependencies: KAN-42, KAN-43, KAN-44 and KAN-48 deliver the Settings entries; this item owns their placement and wording.

Acceptance criteria:
- A first-time user understands what PantryFlow does without external instructions (checked in UX-08B).
- The empty pantry offers one clear next action; registration and confirmation states say what happens next, including a resend path.
- Users can find recovery, language, deletion, support and feedback once implemented; Settings stays short and grouped.
- Initial inventory setup is presented as optional and incremental.

Verification: screen tests for empty and confirmation states; phone walkthrough of the full first-use path in EN and DE; TalkBack check of Settings.
Security/privacy: no pantry or shopping contents, account identifiers, tokens or recovery links in logs or committed evidence; household authorization stays database-enforced (RLS); fixtures only in screenshots.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T11-S9 — UX-08A: Prepare the external usability study

Subtask under `PF-S3-T11`. Extra labels: `p1`, `public-release-gate`, `usability`.

```text
Backlog ID: PF-S3-T11-S9 (UX-08A)
Source: assessment confidence note (no external-user validation). Priority: P1 before public release. Release classification: public-release gate (preparation).

Scope: a study plan for about five to eight ordinary household users (not developers or the owner), subject to availability. Tasks: register and begin; enter an initial inventory; find an item; mark an item Low or Out; add it to the shopping list; complete an item while shopping; reopen a wrongly completed item; edit or remove an item; recover from a failed operation. Measures: completion, interaction count, time, requests for help, navigation errors, misunderstood terms, accidental operations, self-reported effort, willingness to continue. Separate observed behavior from opinion.
Privacy: written consent; no recordings of real household data or account credentials; participants use fixture or beta accounts; results stored without personal identifiers.
Dependencies: none for preparation; running the study needs a build with UX-01B, UX-02 and UX-04 (UX-08B).

Acceptance criteria:
- Protocol, task script, observation sheet, consent text and analysis template are in the repository.
- Recruitment approach and the build/account setup are agreed with the owner.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T11-S10 — UX-08B: Run the usability study and triage findings

Subtask under `PF-S3-T11`. Extra labels: `p1`, `public-release-gate`, `usability`.

```text
Backlog ID: PF-S3-T11-S10 (UX-08B)
Priority: P1 before public release. Release classification: public-release gate; may run during the closed beta.

Scope: run the UX-08A protocol with real participants, analyze results and record an opportunity backlog.
Exclusions: no claim of external usability validation before participants have completed the study; no implementation issues before triage.
Dependencies: UX-08A; a build containing UX-01B, UX-02 and UX-04; BETA-01 if run with beta testers.

Acceptance criteria:
- Per-task results (completion, interactions, time, assistance, errors, terminology, accidental operations, effort, continuation) are reported with the number of participants and limits.
- Observations and opinions are separated; findings are triaged with the owner; implementation issues are created only after that triage and with approval.
- Results feed the Slice 3 assessment (QA-01) as external-user evidence, kept distinct from expert inspection.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T5-S3 — A11Y-01: Expose selection chips and pantry rows to screen readers

Subtask under `KAN-45`. Extra labels: `p1`, `public-release-gate`, `slice3-acceptance`, `accessibility`.

```text
Backlog ID: PF-S3-T5-S3 (A11Y-01)
Source findings: F-04 (components/OptionChips.tsx renders Pressable chips without role or selected state), F-13 (components/PantryItem.tsx row without role or label). Re-verified on main ec0dbdd. Priority: P1. Release classification: public-release accessibility gate; Slice 3 acceptance.

Problem: TalkBack users cannot tell which status, category or location is selected, and pantry rows are read as loose text without "button".
Impact: blind users cannot reliably set or read an item's status.
Scope: chips get a radio or button role, accessibilityState.selected and a group label; rows get a button role and a combined label (name, status, category, location) with a hint to open. Reuse the KAN-63 audit rules.
Exclusions: no visual change beyond what touch-target criteria require; no web-only roles.
Dependencies: none; independent of other Slice 3 work. Coordinate with UX-01B so the new status control follows the same contract.

Acceptance criteria:
- Every chip exposes role, label and selected state; the group has a label (Status, Category, Location).
- Every pantry row exposes a button role and one combined label; Shopping rows keep their existing checkbox and button roles.
- TalkBack reads "Low, selected" (or equivalent) and the row summary on the phone.

Verification: failing-before Jest/Node prop tests for chips and rows; TalkBack walkthrough of add, edit and list screens.
Security/privacy: no pantry or shopping contents, account identifiers, tokens or recovery links in logs or committed evidence; household authorization stays database-enforced (RLS); fixtures only in screenshots.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T7-S4 — A11Y-02: Announce form and screen errors to VoiceOver on iOS

Subtask under `KAN-47`. Extra labels: `p1`, `ios-gate`, `accessibility`.

```text
Backlog ID: PF-S3-T7-S4 (A11Y-02)
Source: F-03; PF-IOS-001 (docs/testing/production-follow-ups.md) notes that KAN-34 covers Android only. On main ec0dbdd, lib/accessibility.ts announceError runs only when Platform.OS is android, and InlineError relies on an Android live region. Priority: P1 for iOS. Release classification: iOS release gate only.

Problem: on iOS, field and screen-level errors are not announced to VoiceOver.
Scope: make announceError and the focused-announcement hook work on iOS (AccessibilityInfo.announceForAccessibility is available there), and verify timing against VoiceOver focus changes.
Dependencies: KAN-68 iOS build; KAN-64 VoiceOver acceptance records the device evidence.

Acceptance criteria:
- Form errors, repeated identical form errors and screen-level load errors are announced by VoiceOver on a physical iPhone.
- Android behavior and its tests are unchanged.

Verification: unit tests per platform; VoiceOver walkthrough on a physical iPhone with build and iOS versions recorded.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T6-S4 — SEC-01: Reassess the picomatch advisory and refresh the advisory register

Subtask under `KAN-46`. Extra labels: `p1`, `beta-gate`, `security`.

```text
Backlog ID: PF-S3-T6-S4 (SEC-01)
Source finding: F-07. On ec0dbdd npm audit reported 66 high and 6 moderate, from one new high root advisory (picomatch ReDoS, GHSA-fc5q-39xc-vjpf, <= 4.0.7) reached through Expo CLI, Metro and Jest. docs/security/tooling-advisories.md (last assessed 2026-11-09) still says zero high and requires escalation when severity turns high. Priority: P1 investigation. Release classification: external-beta gate (assessment section H condition 5).

Scope: re-run npm ci, npm audit --json and npm ls --all against the current lockfile; separate root advisories from propagated counts; trace dependency paths; assess runtime, build-time and CI exposure and whether vulnerable code processes untrusted input; evaluate compatible remediation (SDK-matched updates, overrides) with compatibility analysis; update the register with evidence, residual-risk owner and review date; apply its escalation rule.
Exclusions: no broad dependency upgrade without compatibility analysis; no npm audit fix --force; do not assume harmlessness because a package is tooling.
Dependencies: none.

Acceptance criteria:
- The register shows current counts, each root advisory with path, exposure and decision, and the next review date.
- Any remediation runs the full fast, local and Android suites; any accepted risk has an owner and date.
- KAN-27 (Sonar cleanup, Fertig) is noted as unrelated to advisories.

Verification: committed register diff; audit artifacts kept as ignored evidence.
Security/privacy: no tokens or registry credentials in artifacts.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T6-S5 — SEC-02: Re-verify the hosted database baseline read-only before beta

Subtask under `KAN-46`. Extra labels: `p1`, `beta-gate`, `security`.

```text
Backlog ID: PF-S3-T6-S5 (SEC-02)
Source finding: F-17 (hosted Slice 2 schema not verified by the assessor). Recorded evidence exists: 00004 was applied and verified on 2026-11-11 (docs/testing/hosted-shopping-migration.md execution record) after the profile baseline reconciliation. Priority: P1 before external beta. Release classification: external-beta gate (assessment section H condition 1).

Scope: an authorized, read-only drift check of the hosted project: migration history exactly 00001-00004, PostgreSQL major 17, tables, columns, grants, policies, constraints, indexes and functions against a local 00004 reference, and the documented hosted-only exceptions (for example the RLS auto-enable event trigger).
Exclusions: no hosted migration, repair or data change; any drift found is reported and dispositioned, not fixed in this item.
Dependencies: owner authorization for the hosted read at execution time; reuse the existing catalog comparison procedure.

Acceptance criteria:
- A dated record states match or each drift item with disposition; existing data is unchanged (read-only access only).
- Credentials are never printed; the record contains no user data.

Verification: catalog comparison output kept as ignored evidence; summary committed.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T6-S6 — OPS-01: Select and add privacy-conscious crash and error reporting

Subtask under `KAN-46`. Extra labels: `p1`, `beta-gate`, `operations`.

```text
Backlog ID: PF-S3-T6-S6 (OPS-01)
Source finding: F-11 (no crash or error monitoring SDK in pantry-flow/package.json, re-verified). Priority: P1 before external beta. Release classification: external-beta gate (assessment section H condition 2). Risk tier: high (new data flow to a third party).

Problem: defects on beta devices would be invisible.
Scope: 1) a decision note comparing at most three services on privacy, data residency, cost, maintenance, Expo compatibility and source-map handling; owner selects. 2) Integrate the selected SDK with crash and unhandled-error capture only.
Exclusions: no analytics, behavioral tracking, session replay or performance tracing without a separate product and privacy decision.
Dependencies: owner selection (decision S3-Q6); KAN-72 privacy notice must disclose it before beta.

Acceptance criteria:
- Events contain no pantry or shopping contents, item names, emails, tokens, recovery URLs or credentials; scrubbing is configured and tested.
- Test builds (com.pantryflow.test) and release builds report to separate environments or reporting is off in tests.
- A forced test crash reaches the service from a release-configured build; the DSN or key handling follows the repository's secret rules.

Verification: payload inspection of a test event; unit test of the scrubbing hook; phone smoke.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T9-S4 — QA-01: Run an independent Slice 3 quality assessment against the 2026-11-18 baseline

Subtask under `KAN-49`. Extra labels: `p2`, `slice3-acceptance`, `quality`.

```text
Backlog ID: PF-S3-T9-S4 (QA-01)
Source: assessment section G (first graded baseline). Priority: P2. Release classification: Slice 3 acceptance input; grades never replace release criteria.

Scope: repeat the A+ to F rubric (12 weighted categories, AI subcategories) on the final Slice 3 head, compared with docs/quality/2026-11-18-quality-assessment-baseline.md. Use an assessor who did not implement the evaluated changes where practical.
Improvement targets (indicators, not gates): usability C toward B+; functional correctness B+ toward A-; accessibility demonstrably improved per platform; test effectiveness kept (mutation sensitivity); security/privacy public blockers closed; operational readiness C+ toward B+; AI engineering efficiency with less ceremony; performance from measurements (PERF-01) instead of static assumptions.
Dependencies: Slice 3 mandatory work done; UX-08B results; PERF-01 measurements.

Acceptance criteria:
- The report states assessor independence, evidence types (executed, recorded, static, inferred) and the comparison per category.
- External-user evidence (UX-08B) is kept distinct from expert inspection.
- The report is committed under docs/quality/ and referenced from KAN-76.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T10-S4 — BETA-01: Define and verify the external beta entry checklist

Subtask under `KAN-50`. Extra labels: `p1`, `beta-gate`, `operations`.

```text
Backlog ID: PF-S3-T10-S4 (BETA-01)
Source: assessment section H (closed Android beta: CONDITIONAL GO). Priority: P1. Release classification: external-beta gate.

Scope: one checklist the owner signs before inviting testers, each line pointing at its evidence:
1. Hosted baseline re-verified (SEC-02).
2. Crash and error reporting active and disclosed (OPS-01).
3. Password reset and account deletion: KAN-42 and KAN-43 delivered, or an interim support path (support contact handles reset and deletion requests within a stated time) documented and tested.
4. Minimum privacy notice and support contact published (KAN-72 beta subset).
5. Advisory register current (SEC-01).
6. Testers told the language scope (English only unless KAN-44 is done) and how to give feedback (KAN-73 or the support contact).
7. Tester instructions, eligibility, stop criteria and data handling written; Android beta artifact prepared (KAN-77).
Exclusions: no invitations, uploads or distribution without separate owner authorization.
Dependencies: SEC-01, SEC-02, OPS-01, KAN-72, KAN-77; Slice 3 acceptance is not required for a closed beta unless the owner decides so (decision S3-Q7).

Acceptance criteria:
- Every line has evidence or an explicit owner waiver with reason; missing lines keep the beta NO-GO.
- The checklist is committed and referenced from KAN-79.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T12 — [Slice 3] Strengthen test infrastructure, CI and engineering hygiene

Task under `KAN-40`, priority Medium. Extra labels: `p2`, `engineering`.

```text
Backlog ID: PF-S3-T12
Source findings: F-08, F-12, F-15, F-18, assessment category 5 weakness (repeated stub maps) and category 9 (performance not measured). Priority: P2 (Medium). Release classification: not a release gate, except PERF-01 which feeds Slice 3 acceptance evidence.

Problem: a regression can hang the Node suite; Android E2E can be skipped for app changes; one Gradle download flake; legacy Emergent scaffolding distorts SonarCloud; performance grade rests on static inspection.
Scope: subtasks TEST-01, TEST-02, CI-01, TEST-03, PERF-01, ARCH-02.
Exclusions: no comprehensive mutation-testing infrastructure; no custom backend, repository or service layer, global state library, HouseholdKit framework or shared provider abstraction without demonstrated need (ARCH-03); no weakening of required checks or write guards.
Dependencies: none for TEST-01, CI-01 and ARCH-02; PERF-01 measures before and after T11 changes.

Acceptance criteria:
- Each subtask meets its criteria; required checks (fast, database, SonarCloud) stay intact; branch-protection changes only with separate approval.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T12-S1 — TEST-01: Add timeouts so hanging regression tests fail fast

Subtask under `PF-S3-T12`. Extra labels: `p2`, `engineering`.

```text
Backlog ID: PF-S3-T12-S1 (TEST-01)
Source finding: F-12 (assessment mutation M4 hung the Node suite until killed; package.json test scripts have no timeout). Priority: P2. Release classification: development quality. Risk tier: low.

Scope: a per-test timeout for the Node suites (node --test --test-timeout) and suitable separate limits for the integration suite.
Acceptance criteria:
- A deliberately broken asynchronous test fails within the limit with the test name in the output.
- Legitimately slow integration tests keep a sufficient, separate limit; existing suites stay deterministic.
- The M4 scenario (an unchanged status also prompts) is re-run as verification and fails instead of hanging.

Verification: test:fast and test:local green; M4 mutation in a throwaway worktree, reverted.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T12-S2 — TEST-02: Make Android E2E a risk-based gate for app changes

Subtask under `PF-S3-T12`. Extra labels: `p2`, `engineering`.

```text
Backlog ID: PF-S3-T12-S2 (TEST-02)
Source finding: F-08 (.github/workflows/pantryflow-tests.yml runs android only on workflow_dispatch, schedule or a [full-e2e] push; it is not a required check). Priority: P2. Release classification: recommended before Android production. Risk tier: medium (CI policy).

Scope: define which changes need Android E2E (for example app/, components/, hooks/, lib/, native config, package files) and propose how to enforce it without path filters silently skipping a required check (for example an always-running gate job that decides internally), plus how a nightly failure becomes visible.
Exclusions: documentation-only changes must not need native builds; macOS/iOS runners are out of scope; branch-protection changes need separate owner approval.
Dependencies: CI-01 findings on flakiness; Actions minutes budget.

Acceptance criteria:
- The rule set and enforcement design are documented and approved; once implemented, an app-code PR cannot merge without a passing or explicitly dispositioned Android run.
- Failed or flaky runs are visible and dispositioned; cost per PR is estimated.

Verification: test PRs (docs-only and app-code) show the intended behavior.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T12-S3 — CI-01: Investigate the Gradle plugin download flake

Subtask under `PF-S3-T12`. Extra labels: `p3`, `engineering`.

```text
Backlog ID: PF-S3-T12-S3 (CI-01)
Source finding: F-15 (run 44225392722 attempt 1 failed resolving foojay-resolver-convention 1.0.0; the re-run passed). Priority: P3. Release classification: development quality.

Scope: check recent android runs for recurrence and identify the actual cause before changing Gradle, caching or repositories.
Exclusions: one historical failure is not a persistent defect; no speculative Gradle changes.
Acceptance criteria:
- Recurrence data and the likely cause are recorded; a targeted fix is proposed only with supporting evidence, otherwise the item closes as monitored with a recorded reason.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T12-S4 — TEST-03: Reduce repeated React Native stub maps in tests where it helps

Subtask under `PF-S3-T12`. Extra labels: `p3`, `engineering`.

```text
Backlog ID: PF-S3-T12-S4 (TEST-03)
Source: assessment category 5 (large inline stub maps repeated across files); PR #40 deferred minor (announcement-recording stub repeated six times in four files). Priority: P3. Release classification: optional.

Scope: introduce shared test helpers only where they reduce meaningful duplication, keep behavioral assertions, improve readability and do not hide scenario differences.
Acceptance criteria:
- Helpers replace the repeated stubs without changing what the tests assert; targeted mutations on two or three key tests still fail after the change.
- Suites stay green and deterministic.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T12-S5 — PERF-01: Measure a performance baseline on a real device

Subtask under `PF-S3-T12`. Extra labels: `p2`, `slice3-acceptance`, `performance`.

```text
Backlog ID: PF-S3-T12-S5 (PERF-01)
Source: assessment category 9 (B-, low confidence, static inspection only). Priority: P2. Release classification: Slice 3 acceptance evidence.

Scope: measure cold start, time to usable pantry screen, inventory load, search responsiveness (after UX-02), direct status mutation (after UX-01B), shopping completion, and network requests per common workflow, for a small and a larger household inventory (for example 20 and 150 items). Record device, build type, network conditions and fixture data. Measure once before and once after the T11 changes.
Exclusions: no speculative optimizations and no arbitrary thresholds without evidence.
Acceptance criteria:
- A dated measurement record with method and raw numbers is committed; any real problem gets a scoped follow-up proposal.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T12-S6 — ARCH-02: Remove the obsolete Emergent frontend and backend scaffolding

Subtask under `PF-S3-T12`. Extra labels: `p2`, `engineering`.

```text
Backlog ID: PF-S3-T12-S6 (ARCH-02)
Source findings: F-18; PF-LEGACY-001. The repository root still holds frontend/, backend/ and Emergent test artifacts (tests/, test_reports/, test_result.md); SonarCloud's three bugs and reliability D come from frontend/. Priority: P2. Release classification: optional cleanup.

Scope: verify the folders are not used by the Expo app, CI workflows, documentation, deployment, development tooling or any retained experiment; then remove them in one separately reviewable change (git history keeps them) and update references such as PF-LEGACY-001.
Exclusions: no change to pantry-flow/, tools/ or docs content beyond references.
Acceptance criteria:
- A reference search shows no remaining dependency; CI and SonarCloud pass afterwards and the Sonar metrics cover the actual product.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T13 — [Slice 3] Introduce risk-based engineering governance

Task under `KAN-40`, priority Medium. Extra labels: `p2`, `process`.

```text
Backlog ID: PF-S3-T13
Source: assessment subcategory 12.7 (C+, 78: heavy ceremony for small packages) and category 8 (process and documentation overhead). Priority: P2 (Medium). Release classification: process; not a release gate.

Problem: every package, including 11 minor fixes, got a full plan, ledger, Opus review and several CI runs.
Scope: subtasks GOV-01 and GOV-02. Risk tiers:
- Low (styling, minor layout, translation corrections, documentation): concise task description, targeted verification, normal CI.
- Medium (new UI workflows, state management, navigation, business-rule adjustments): implementation plan, behavioral tests, appropriate independent review.
- High (authentication, account deletion, RLS, database constraints, hosted migrations, credential handling): detailed plan, security analysis, independent review, explicit authorization, complete relevant regression verification.
Exclusions: no weakening of security, write guards, branch protection or regression requirements in the name of efficiency.

Acceptance criteria:
- Process requirements are proportionate to risk; verification claims stay traceable to executed commands; failed checks cannot be reported as passed; material deviations get an explicit disposition; validated baselines stay preserved; unnecessary plan documents, review loops and ledgers are reduced.
Definition of done: acceptance criteria met with evidence on an exact commit; required checks green; every test named under Verification ran and its output was read; coverage matrix updated where behavior changed; deviations recorded with a disposition. Done does not authorize a release.
```

#### PF-S3-T13-S1 — GOV-01: Document the risk tiers and verification-claim rules

Subtask under `PF-S3-T13`. Extra labels: `p2`, `process`.

```text
Backlog ID: PF-S3-T13-S1 (GOV-01)
Priority: P2. Release classification: process.
Scope: a short repository document (for example in AGENTS.md or docs/) defining the three tiers, what each requires, who decides the tier, and the rules that never relax (required checks, write guards, no red-suite commits, evidence for every claim).
Acceptance criteria:
- The owner approves the document; each Slice 3 issue's tier can be stated in one line when work starts.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

#### PF-S3-T13-S2 — GOV-02: Review the tiered process after the first Slice 3 packages

Subtask under `PF-S3-T13`. Extra labels: `p3`, `process`.

```text
Backlog ID: PF-S3-T13-S2 (GOV-02)
Priority: P3. Release classification: process.
Scope: after about three Slice 3 packages, compare effort (documents, review rounds, CI runs) and escaped defects with Slice 2 packages of similar size.
Acceptance criteria:
- A short retrospective records what changed, any defect that the lighter process let through, and adjustments approved by the owner.
Definition of done: findings, options and a recommendation are documented in the repository, and the owner's decision is recorded. No implementation is part of this item.
```

### C.2 Refinements of existing issues (18)

The existing description stays verbatim; the text below is appended, and the label `qa-2026-11-18` is added to the existing labels. Summary, parent, priority and status are not changed.

#### KAN-40

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Revised objective (owner, 2026-11-18): PantryFlow - Slice 3: Usability, Product Refinement and Launch Readiness. The title was already changed by the owner; this replaces the earlier "hardening, not a feature-expansion slice" objective.
Slice 3 shall: resolve relevant findings of the 2026-11-18 quality assessment; reduce the effort of everyday household use; complete missing user-facing workflows; resolve accessibility, security and privacy requirements; prepare a meaningful external beta; improve release and operational readiness; preserve the Slice 1.1 and Slice 2 foundation.
Product principle: PantryFlow must reduce household administration, not become another administrative obligation. Usability simplification is an explicit objective; it is not a visual redesign, and features are not added to match competitor lists. Sharing and premium remain excluded (see KAN-51 for the proposed roadmap).
Baseline correction: the owner accepted Slice 2 on 2026-11-18. Annotated tag pantryflow/slice-2-baseline -> ec0dbdd (merge of PR #40) is the current baseline for regression testing; KAN-6 is Fertig. Slice 2 follow-ups KAN-27, KAN-32 to KAN-39 and KAN-84 to KAN-86 are Fertig.
Finding traceability F-01 to F-19: see the plan named below.
Additional workstreams:
T11 = {PF-S3-T11} - [Slice 3] Simplify everyday household workflows
T12 = {PF-S3-T12} - [Slice 3] Strengthen test infrastructure, CI and engineering hygiene
T13 = {PF-S3-T13} - [Slice 3] Introduce risk-based engineering governance
New subtasks under existing Tasks: {PF-S3-T5-S3} (A11Y-01, KAN-45), {PF-S3-T7-S4} (A11Y-02, KAN-47), {PF-S3-T6-S4} (SEC-01), {PF-S3-T6-S5} (SEC-02), {PF-S3-T6-S6} (OPS-01, all KAN-46), {PF-S3-T9-S4} (QA-01, KAN-49), {PF-S3-T10-S4} (BETA-01, KAN-50).
```

#### KAN-41

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Corrections: current reference is tag pantryflow/slice-2-baseline (main ec0dbdd), not 2186d50; the owner accepted Slice 2 on 2026-11-18 and KAN-6 is Fertig. KAN-34 was merged (PR #36) and is Fertig, as are KAN-27, KAN-32 to KAN-39 and KAN-84 to KAN-86; the carried-finding dispositions can cite their merged evidence.
Added input: the finding dispositions F-01 to F-19 in the plan below. The owner decisions now also include the F-10 roadmap (KAN-51), the D5 revision for pantry search (UX-02) and the UX-01A interaction design.
```

#### KAN-51

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Source finding: F-10 (PRD section 2 lists shared households, the free/premium split and a 75-item free limit as MVP; no slice schedules them).
Additional acceptance criteria:
- A product decision record is prepared for the proposed roadmap: Slice 3 usability, refinement, hardening and beta readiness; Slice 4 basic household sharing; PantryFlow 1.0 free public application; premium as a separate later milestone based on validated demand. The owner approves, changes or rejects it.
- The authoritative PRD is not silently modified; the decision is recorded in a decision log and the PRD gets an explicit, approved amendment note if needed.
- Any operational inventory safety limit is distinguished from a monetization limit.
- D5 is revised explicitly: pantry name search moves into Slice 3 ({PF-S3-T11-S3}, UX-02); sort and status filters follow the UX-03 evaluation ({PF-S3-T11-S4}); German and the language switcher stay in KAN-44.
- Sharing and premium are not introduced into Slice 3.
```

#### KAN-52

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Current evidence (verified 2026-11-18): main is ec0dbdd (PR #40). All Slice 2 follow-ups (KAN-27, KAN-32 to KAN-39, KAN-84 to KAN-86) are Fertig with PRs #36 to #40; CI runs 44211292067, 44216675581 and 44225392722 (manual, including android) passed, the last on attempt 2 after a Gradle download flake; phone, TalkBack and Maestro evidence is recorded in those PRs. No open PRs. Push CI on ec0dbdd (run 44230970219) and the SonarCloud main gate are green; ec0dbdd's tree is identical to 505ab2b, which passed the full android run.
Acceptance: the owner accepted Slice 2 on 2026-11-18. Annotated tag pantryflow/slice-2-baseline -> ec0dbdd was created and pushed on the owner's instruction; it is the current baseline for regression testing. KAN-6 was moved to Fertig with the owner's approval.
The 2026-11-18 quality assessment (docs/quality/2026-11-18-quality-assessment-baseline.md) was an input to the acceptance, not a substitute for it.
```

#### KAN-49

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Regression baseline (owner decision 2026-11-18): tag pantryflow/slice-2-baseline -> ec0dbdd replaces main 2186d50 and the KAN-23 to KAN-26 evidence as the reference for Slice 3 regression comparisons. Its full android evidence is run 44225392722 on the tree-identical 505ab2b.
Added subtask: {PF-S3-T9-S4} (QA-01) runs an independent assessment against docs/quality/2026-11-18-quality-assessment-baseline.md.
```

#### KAN-53

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Corrections: KAN-34 is merged and Fertig (not in CI). Candidate scope update: quick-add is now UX-04 ({PF-S3-T11-S5}); bulk entry is discovery UX-05 ({PF-S3-T11-S6}); undo is an investigation inside UX-06 ({PF-S3-T11-S7}); export remains a proposal. Implementation of bulk entry and undo still needs separate owner decisions.
```

#### KAN-42

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Source finding: F-01 (High). Additional acceptance criteria:
- Recovery requests are protected against account enumeration (identical response for known and unknown emails) and abuse (rely on and document Supabase Auth rate limits; verify the user-visible behavior when a limit is hit).
- Session handling after a password change is decided and tested (current session continues; whether other sessions are revoked follows the KAN-81 decision).
- The new password must satisfy the KAN-80 policy; reset and signup share the rules.
- Until this ships, the external beta uses the interim support path defined in BETA-01 ({PF-S3-T10-S4}).
```

#### KAN-43

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Source finding: F-02 (High). Additional acceptance criteria:
- The deletion contract (KAN-57) is approved before implementation and is written for today's single-household model; it must not presume Slice 4 sharing semantics, and it names what has to be revisited when sharing arrives.
- Creator attribution (created_by ON DELETE SET NULL) and household cleanup outcomes are listed per table.
- Until this ships, the external beta uses the interim deletion-request path defined in BETA-01 ({PF-S3-T10-S4}), disclosed in the beta privacy notice.
```

#### KAN-45

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Corrections: KAN-34 (form errors, PR #36), KAN-39 (screen-level errors, PR #39) and KAN-84 (repeated errors) are merged and Fertig; components/Input.tsx now renders InlineError with a polite live region, and announcements were confirmed with TalkBack on the phone.
Added scope: confirmed gaps F-04 (selection chips) and F-13 (pantry rows) are fixed in {PF-S3-T5-S3} (A11Y-01); VoiceOver error announcements in {PF-S3-T7-S4} (A11Y-02). The audit includes the new usability controls (UX-01B direct status change, UX-02 search, UX-04 Return-to-save) and Settings entries (UX-07).
```

#### KAN-63

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Correction: the technical context above is outdated. Input.tsx renders InlineError (live region) and announceError lives in lib/accessibility.ts (Android only); KAN-34, KAN-39 and KAN-84 are Fertig. The confirmed chip and row gaps are scoped in {PF-S3-T5-S3} (A11Y-01); the audit covers the new UX controls.
```

#### KAN-64

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Correction: KAN-34, KAN-39 and KAN-84 are Fertig, and their phone evidence (TalkBack 17.1, Android 16) already covers a shopping load error, a pantry load error, an Input error and a repeated error. Reuse it and add the new controls (A11Y-01, UX-01B, UX-02) and German. VoiceOver needs A11Y-02 ({PF-S3-T7-S4}) first.
```

#### KAN-46

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Source findings: F-07, F-11, F-17, F-19, plus PF-DATA-001 and PF-PREMIUM-001. Three new subtasks are external-beta gates, earlier than this Task's public-release classification: {PF-S3-T6-S4} (SEC-01 advisory reassessment), {PF-S3-T6-S5} (SEC-02 hosted baseline re-verification) and {PF-S3-T6-S6} (OPS-01 crash and error reporting).
```

#### KAN-65

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Source: SEC-04 / PF-PREMIUM-001. Additional acceptance criterion: document whether the unused profiles.is_premium field should remain, be isolated or be removed, as a recommendation for a separately approved change. The free application must stay secure without premium functionality; no payment handling, subscriptions, item-count limits or premium gating.
```

#### KAN-66

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Change of scope: the advisory reassessment (F-07, new high picomatch advisory) moved to {PF-S3-T6-S4} (SEC-01) because it gates the external beta. This subtask keeps log and artifact redaction and the sender review.
Source finding for the sender part: F-19 / PF-EMAIL-002 (DMARC p=none without aggregate reporting). Additional criteria: review reporting evidence and legitimate sender alignment, propose a staged enforcement plan (reporting, then quarantine, then reject) that protects confirmation and recovery mail delivery; no policy change without separate authorization. Release classification for this part: before public production.
Correction: KAN-27 is Fertig and concerned Sonar findings, not advisories.
```

#### KAN-67

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Source: SEC-03 / PF-DATA-001. Additional acceptance criteria: the populated rehearsal covers existing users and memberships, pantry and shopping rows with links, normalized-duplicate conflicts, foreign-key relationships, legacy or invalid values where they can exist, migration failure behavior (stop and roll back), data preservation and the recovery procedure. The pre-beta hosted drift check is {PF-S3-T6-S5} (SEC-02).
```

#### KAN-50

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Added: the external beta has its own entry checklist, {PF-S3-T10-S4} (BETA-01), derived from the assessment's CONDITIONAL GO (hosted baseline, crash reporting, reset and deletion path, privacy notice, advisory register, language scope and tester instructions). A closed beta does not require Slice 3 GO unless the owner decides so; public release still does.
```

#### KAN-72

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Added: a beta subset is needed before the external beta (BETA-01, {PF-S3-T10-S4}): a minimum privacy notice that matches actual collection (including OPS-01 crash reporting) and the interim deletion-request path, plus a support contact. The full public content stays a public-release gate.
```

#### KAN-74

```text
Refinement 2026-11-18 - quality assessment integration (PF-S3-QA-INTEGRATION-20261118); the text above is unchanged.
Added coverage gaps to prioritize (TEST-04): session expiry during active use; native backgrounding and foregrounding; lost dialogs; accessibility (A11Y-01/02); localization; iOS; the new usability interactions (UX-01B, UX-02, UX-04); account recovery and deletion; performance-sensitive workflows (PERF-01). Keep automated, manual, deferred and unverified scenarios distinct in the matrix.
```

## D. Usability improvement backlog

All items sit under the new Task **PF-S3-T11, "[Slice 3] Simplify everyday household workflows"**.

| Item | Class | Interaction design | Expected effort reduction | Depends on | Required accessibility and regression tests |
|---|---|---|---|---|---|
| UX-01A design / UX-01B implementation | **Mandatory** (P1) | Explicit selection of all three statuses from the list. Candidates: a status badge that opens a three-option selector, a long-press menu, or a segmented control in an expanded row. No blind cycling. The owner picks a design before implementation. | Status change: 3 → ≤ 2 taps. Change plus add to list: 4 → ≤ 3. | KAN-41; D3 rules (`offersShoppingAdd`, shopping add operation, mutation guards); F-16 decision | Role, label, selected state and a result announcement; transition matrix, prompt suppression, failed add, double tap, scope-change tests; Maestro with database read-back; TalkBack |
| UX-02 search | **Mandatory** (P1) | Search field on the Pantry tab that filters the loaded household list locally; distinct no-match state with a clear action | Finding an item: scrolling → typing a few letters | KAN-51 D5 revision | Labelled field, announced result count; normal, empty, no-match, clear and post-mutation tests; Maestro step |
| UX-03 ordering and filter | Discovery (P2) | Evaluate alphabetical order, Low/Out first, or one status filter; one default; no filter panel | To be measured after UX-02 | UX-02 | — (decision only) |
| UX-04 faster creation | **Mandatory** for Return-to-save (P1); continuous entry only if measured easier | Return saves; a possible "stay on form after save" or "Save and add another" option | 20 items: about 40–80 taps → about 20–40, plus typing | KAN-41 | Valid, invalid and duplicate Return; double submit; failed save keeps values; Maestro add via Return |
| UX-05 bulk entry | Discovery (P2) | One item per line, with per-item added or rejected feedback; prototype allowed | To be determined; compared with UX-04 | UX-04 measurements | — (decision only) |
| UX-06 consistency review | Review is mandatory; fixes depend on severity | Pantry and Shopping forms, Save/Cancel/Remove, navigation, errors, retry, dialogs; undo is investigated only | Removes friction points found in the review | UX-01B and UX-02 designs | Test-first per confirmed fix |
| UX-07 first use and Settings | **Mandatory** (P1) | Clear empty-state action, understandable confirmation states with resend, short grouped Settings for recovery, language, deletion, support and feedback | Fewer dead ends on first use | KAN-42, 43, 44, 48 deliver the entries | Empty and confirmation screen tests; EN/DE first-use walkthrough; TalkBack on Settings |
| UX-08A prepare / UX-08B run usability study | Public-release gate (P1); can run during the closed beta | 5–8 ordinary household users, the 9 workflows from the brief, observed versus reported | Evidence, not a reduction | UX-01B, UX-02, UX-04 in a build; BETA-01 if run with beta testers | — (the study is the evidence) |

Accessibility is built into each item's acceptance rather than postponed. A11Y-01 (chips and rows) is independent of all of them and can go first.

## E. Dependency-ordered implementation plan

**Risk tiers** follow the proposed governance Task (PF-S3-T13): L (low), M (medium), H (high).

| Phase | Work | Tier | Blocking dependencies | Parallel with |
|---|---|---|---|---|
| 0. Decisions (no code) | KAN-52 Slice 2 acceptance and tag decision; KAN-51 roadmap and D5; UX-01A design; KAN-57 deletion design; KAN-81 password policy; OPS-01 vendor choice; KAN-71 website; GOV-01 tiers; KAN-68 iOS prerequisites inventory | — | Owner availability | Everything in phase 0 runs in parallel |
| 1. Quick, independent | TEST-01 timeouts; SEC-01 advisory reassessment; A11Y-01 chips and rows; UX-04 Return-to-save; ARCH-02 legacy cleanup; PERF-01 "before" measurement | L–M | KAN-41 readiness, for app changes | Each other |
| 2. Core usability | UX-02 search → UX-01B direct status (after UX-01A approval) → UX-06 review → UX-03 evaluation | M | Phase 0 decisions D5 and UX-01A | Phase 3 data work |
| 3. Account lifecycle and language | KAN-80/42 recovery and policy; KAN-43 deletion; then KAN-44 German, after the new UX strings settle; UX-07 places the Settings entries | H (auth, deletion), L–M (strings) | KAN-81, KAN-57 decisions | Phase 2 (different files); iOS prerequisites |
| 4. Beta preparation | OPS-01 integration; SEC-02 hosted re-verification; KAN-72 beta subset; KAN-77 Android beta artifact; BETA-01 checklist; TEST-02 E2E gate (design); CI-01 | M–H | OPS-01 vendor; hosted-read authorization | Phase 3 |
| 5. Closed beta and external evidence | Closed Android beta, once BETA-01 is signed; UX-08A then UX-08B; KAN-45/64 TalkBack audit including new controls; iOS: KAN-68 → A11Y-02 → KAN-69/70 | M | BETA-01 owner sign-off; Apple prerequisites | iOS runs on its own track |
| 6. Acceptance | KAN-74 matrix (TEST-04); KAN-67 populated migration and restore; KAN-65 premium review; KAN-66 redaction and DMARC plan; PERF-01 "after"; KAN-75 exact-head Android; QA-01 independent assessment; KAN-76 GO/NO-GO; KAN-78/79 platform decisions | M–H | All mandatory items | — |

**Independent workstreams:**
- iOS (KAN-47 + A11Y-02);
- website and public content (KAN-48);
- engineering hygiene (PF-S3-T12);
- governance (PF-S3-T13);
- usability (PF-S3-T11);
- account lifecycle (KAN-42/43/80).

The main serial chain is: decisions → UX-01A → UX-01B → German (KAN-44) → TalkBack audit → regression → GO/NO-GO.

## F. Decisions requiring approval

| ID | Decision | Recommendation | Where it lands |
|---|---|---|---|
| S3-Q1 | Approve this dry run, then apply 28 creates and 18 refinements | **Approved 2026-11-18** | This operation |
| S3-Q2 | Accept Slice 2, and authorize a `pantryflow/slice-2-baseline` tag on `ec0dbdd` | **Accepted 2026-11-18; tag created and pushed** | KAN-52, KAN-6 |
| S3-Q3 | Roadmap: Slice 4 basic sharing; 1.0 as a free public app; premium later on validated demand; any item-count safety limit kept separate from monetization | Approve as proposed (appendix 1); amend the PRD only by an explicit note | KAN-51 |
| S3-Q4 | Revise D5: pantry search moves into Slice 3; sort and filter follow the UX-03 evaluation | Approve | KAN-51, UX-02, UX-03 |
| S3-Q5 | Direct status interaction design | Decide after UX-01A presents the options | UX-01A |
| S3-Q6 | Crash and error reporting service (privacy, EU residency, cost, maintenance) | Decide from OPS-01's comparison; crash and errors only, no analytics | OPS-01 |
| S3-Q7 | Beta platform, audience and timing: closed Android beta before Slice 3 GO and before German? | Closed Android beta after BETA-01, without waiting for German or Slice 3 GO | BETA-01, KAN-50 |
| S3-Q8 | Existing open decisions: password policy and rollout; deletion and retention boundary; first-launch and language precedence; website stack, repository and feedback channel | Unchanged | KAN-81, KAN-57, KAN-61, KAN-71 |
| S3-Q9 | Make Android E2E a required check for app-code PRs (branch protection) | Decide after TEST-02's design and cost estimate | TEST-02 |
| S3-Q10 | Remove the legacy scaffold (git history keeps it) or move it to an archive branch | Remove | ARCH-02 |
| S3-Q11 | Adopt risk-tiered governance | Approve after GOV-01 | GOV-01 |
| S3-Q12 | Commit the three untracked 2026-11-17 Slice 3 planning files from the main checkout. Jira descriptions cite them, but they exist only locally. | Commit them unchanged in this PR | Repository |
| S3-Q13 | Native Jira dependency links: the CLI can't create them | Keep descriptive references; add native "blocks" links by hand only if you want them on the board | Jira |
| S3-Q14 | Close KAN-6 | **Approved and done 2026-11-18** | KAN-6 |
| S3-Q15 | Usability-study recruitment and consent (UX-08) | Decide when UX-08A is ready | UX-08A |

## G. Issue counts

| Measure | Count |
|---|---|
| Existing Slice 3 issues reused (KAN-40 to KAN-83) | 44: 18 refined, 26 unchanged |
| Existing issues requiring changes (description append and one label) | 18: KAN-40, 41, 42, 43, 45, 46, 49, 50, 51, 52, 53, 63, 64, 65, 66, 67, 72, 74 |
| New Tasks | 3: PF-S3-T11 usability, PF-S3-T12 engineering, PF-S3-T13 governance |
| New Subtasks | 25: UX-01A, UX-01B, UX-02 to UX-07, UX-08A, UX-08B (10); A11Y-01 (KAN-45); A11Y-02 (KAN-47); SEC-01, SEC-02, OPS-01 (KAN-46); QA-01 (KAN-49); BETA-01 (KAN-50); TEST-01, TEST-02, CI-01, TEST-03, PERF-01, ARCH-02 (T12); GOV-01, GOV-02 (T13) |
| New native dependency links | 0. Not supported by the CLI; dependencies are written into descriptions (S3-Q13). |
| Deferred findings | 0 fully deferred. F-15 and F-16 are conditional and may close with no change. F-17 is already addressed and gets a refresh. |
| Issues deleted, reparented or re-prioritized | 0. KAN-6 was transitioned to Fertig separately, on the owner's explicit approval. |

**Deferred functionality** (unchanged exclusions, or decisions still outstanding):
- household sharing (proposed for Slice 4);
- premium, payments and item limits;
- offline queue;
- barcode, recipes and expiry;
- bulk-entry implementation (after UX-05);
- undo implementation (after UX-06);
- export;
- extra languages;
- a custom backend, generic HouseholdKit framework, repository or service layer, or global state library.

## Apply procedure (after approval)

1. Re-read every target issue and confirm it hasn't changed since this dry run: compare `updated` timestamps with the baseline. If one has changed, stop and reconcile before writing.
2. Check the project for the new backlog-ID labels (for example `pf-s3-t11`). Skip any create whose label already exists, and reconcile partial writes before any retry.
3. Create the 3 Tasks first, then the 25 Subtasks. For each: write the input to `tools/jira/*.local.json`, preview, apply with the exact `--apply` flag, then read it back (parent, type, labels, priority, description).
4. Resolve the `{PF-S3-…}` placeholders to the created keys. Apply the 18 refinements: the new description is the existing description verbatim plus the appended block; the labels are the existing labels plus `qa-2026-11-18`. Preview, apply, read back.
5. Run a final paginated read-back of the whole Slice 3 hierarchy, and write a creation record next to this file.
6. One writer, sequential. No automatic retries. Credentials are never printed.

## Appendix 1 — Draft product decision record for F-10 (proposed, not approved)

**Context.** PRD v1.1 §2 defines these as MVP scope:
- a shared household: invite one other user, 2 members free;
- a free/premium split: 75 items free.

The implemented slices are:
- Slice 1.1: pantry;
- Slice 2: shopping list, with D1–D6.

The planned Slice 3 also schedules neither sharing nor premium. The database already has `households`, `household_members` with `UNIQUE(user_id)`, and an unused `profiles.is_premium`.

**Proposed decision:**
1. **Slice 3:** usability, product refinement, hardening and beta readiness (KAN-40).
2. **Slice 4:** basic household sharing (invite, membership, permissions per PRD §11). Account deletion in Slice 3 is specified for single-member households and names what Slice 4 must revisit.
3. **PantryFlow 1.0:** a free public application without premium gating.
4. **Premium:** a separate future milestone, started only on validated user demand. It requires the PF-PREMIUM-001 audit and a pricing decision first.
5. **Limits:** any inventory safety limit (for example against abuse or performance) is an operational limit with its own rationale. It is not the PRD's 75-item monetization limit.

**Consequences:**
- The PRD stays authoritative and unchanged until the owner approves an explicit amendment note.
- 1.0 marketing and store text must not promise sharing.
- KAN-65 records the `is_premium` disposition.

**Status:** awaiting owner decision (S3-Q3).
