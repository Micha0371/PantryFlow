# Slice 3 Jira backlog — dry run, awaiting approval

Date: 2026-11-17. **No Jira writes have been made. No application changes, hosted queries/migrations, DNS/SMTP changes, deployments, purchases or distribution occurred.**

The complete owner brief (section 8) requires: “Do not make Jira writes until I approve the dry-run report.” This report is the approval checkpoint, not approval to implement or launch.

## Current baseline and evidence

- Existing workspace branch: `pantryflow/profile-baseline-reconciliation` at `f7a198f`, clean before planning. It is not current main. Planning used a separate source snapshot of `origin/main` **2186d50414c6f7ea8a78c938f973efede3f7192e**, merge of PR #35.
- Approved Slice 1.1 tag: `pantryflow/slice-1.1-baseline` → **df57e2f**. Remote tags contain no validated Slice 2 baseline tag. Latest merged main is a candidate reference, not a newly approved/tagged baseline.
- Current-main [scheduled full CI 43871390297](https://github.com/Micha0371/VSCode-Environment/actions/runs/43871390297) passed, including Android. [Push CI 43357560354](https://github.com/Micha0371/VSCode-Environment/actions/runs/43357560354) passed. Sonar analysis on this head passed. Evidence was inspected through GitHub; suites were not rerun by this planning task.
- GitHub currently reports **zero open PRs**. Jira reports 37 visible issues, one complete page. KAN-7/11/15/19/23 and their core subtasks are Fertig. **KAN-6 remains Backlog**, so final Slice 2 acceptance is not inferred. T1 reuses KAN-6/KAN-23 evidence rather than creating replacement Slice 2 closure issues.
- Current migrations are 00001–00004; local/CI config expects PostgreSQL 17. Hosted adoption/reconciliation/00004 execution are documented, not newly verified here. Fresh hosted operations remain separately authorized and require drift/ledger checks.
- **Owner update during this audit:** KAN-34 is currently in CI and final review. Jira's inspected status was Backlog and current-main `components/Input.tsx` still has plain error Text; these reflect pending integration, not missing or abandoned implementation. KAN-39 cites field-error device evidence from `fc22508`. T1/T5 reuse KAN-34 and require its final checks/review/merge evidence before declaring it delivered. KAN-39 remains the separate screen-level announcement follow-up. The earlier zero-open-PR snapshot is time-specific and must be refreshed before backlog creation.

## Sources and precedence

Read current-main PRD (`docs/A_PantryFlow_PRD.md`), historical architecture/reuse documents B/C/F, Slice 2 D1–D6 implementation plan and step 3/4/5 plans, shopping database decision record, current auth/locale/settings/providers/data modules/components/app config/migrations, behavioral matrix, testing/hosted migration/baseline records, production follow-ups, tooling advisory register and the secured Jira README/implementation. Existing KAN-6/23/27/32/34/36/37/38/39 descriptions were inspected read-only.

The full owner brief of 2026-11-17 is the proposed Slice 3 planning scope. **No standalone approved Slice 3 specification was found.** Historical statements about greenfield implementation, shopping removal-on-check, sharing, premium, post-MVP password recovery or FlutterFlow must not override current implementation and later decisions. Detailed implementation choices remain approval gates.

## Architecture that the backlog reuses

| Current implementation | Consequence for Slice 3 |
| --- | --- |
| `lib/auth.tsx`, `lib/supabase.ts`, AuthGate; native PKCE/callback/intent recovery | Extend existing recovery/session paths; no parallel auth client or server. |
| `household-scope`, `household-list`, Pantry/Shopping providers, `useItemMutation.current()`, `useSingleOpen` | Reuse identity/focus guards and navigation locks; preserve existing business logic separation. |
| `00001` owner-household cascade; `00002` pantry creator SET NULL; `00004` shopping creator/link SET NULL | Approve deletion semantics from actual FKs before implementation; do not invent shared-household UI or ownership transfer. |
| `lib/i18n/index.tsx`, EN catalogue, empty DE stub; `profiles.language` en/de own-column grant | Extend locale content/preferences and resolve device/profile precedence; preserve language-independent domain values. |
| Existing Node/Jest, pgTAP/local Auth/PostgREST, Android Maestro, proxy and fixtures | Extend the current harness and matrix; no second test platform. |
| iOS bundle `com.pantryflow.app`; Android-only CI; test package `com.pantryflow.test` | Create separate iOS evidence and keep test/production identities and credentials isolated. |

## Proposed creation totals and supported fields

**40 new issues: 1 Epic, 10 Tasks, 29 Subtasks.** Every item has a deterministic PF-S3 identifier. Subtasks are independently verifiable activities, not one ticket per trivial edit. Complete payload drafts and dependencies are in [slice-3-backlog-drafts.json](slice-3-backlog-drafts.json); the detailed descriptions below are generated from the same draft.

Target instance/project verified by the approved CLI: PantryFlow / KAN. Live metadata: Epic `10006` (level 1), Task `10008` (0), Subtask `10007` (-1). Tasks/Epic expose priority: High `2`, Medium `3`; Subtask creation does not expose priority, so none will be sent. Subtasks inherit the parent's release classification in text; this does not claim native priority inheritance. No fabricated custom fields, owners, dates or dependency types will be sent.

**Native issue links are unsupported by the secured CLI.** Proposed creation uses native parent fields for Epic → Task → Subtask and explicit dependency/reference text in descriptions, as in Slice 2. Approval of this plan accepts that limitation; it does not authorize bypassing/extending the CLI. Existing issues are not reparented, edited, reprioritized or closed.

## Task overview

| Alias | Task | Priority | Release classification |
| --- | --- | --- | --- |
| T1 | [Slice 3] Approve scope, baseline and carried-finding dispositions | High | Blocks Slice 3 implementation; planning/discovery may proceed |
| T2 | [Slice 3] Implement and qualify password recovery | High | Mandatory public-release authentication gate; platform-specific link evidence |
| T3 | [Slice 3] Define and implement secure account deletion and retention | High | Mandatory public-release data lifecycle gate; policy/design approval blocks implementation |
| T4 | [Slice 3] Complete English/German launch content and language preferences | High | Mandatory EN/DE public-release gate; filters/extra languages are not automatically included |
| T5 | [Slice 3] Qualify native accessibility using the existing remediation tickets | High | Public-release accessibility gate; separate Android TalkBack and iOS VoiceOver gates |
| T6 | [Slice 3] Qualify security, migrations and operational recovery | High | Mandatory public-release security/data/operations gate; hosted execution separately authorized |
| T7 | [Slice 3] Prepare and validate iOS builds and TestFlight readiness | High | Blocks iOS release only; Android may be assessed independently |
| T8 | [Slice 3] Decide and prepare HouseholdKit website and privacy-safe feedback | Medium | Independent proposed website/feedback stream; required public information gates public release |
| T9 | [Slice 3] Extend regression coverage and record Slice 3 GO/NO-GO | High | Mandatory Slice 3 acceptance gate; not public-release authorization |
| T10 | [Slice 3] Prepare platform beta distribution and enforce the public-release gate | High | Mandatory general public-release gate; Android and iOS decisions separate |

## Existing issues reused without replacement or modification

| Issues | Disposition in this plan |
| --- | --- |
| KAN-6; KAN-23/24/25/26 | Reuse Slice 2 closure, test and device evidence. Explicit final acceptance remains a development prerequisite. |
| KAN-27 | Reassess existing non-security tooling findings through that ticket. It is not automatically a release blocker. |
| KAN-32 | Reassess the latent PantryProvider write-before-load defect against current read/write code. Do not duplicate it or infer it was fixed by shopping handling. |
| KAN-34; KAN-39 | Reuse form and screen error announcement fixes. KAN-34 is actively in CI/final review per owner; require final review/check/merge evidence and separate TalkBack/VoiceOver qualification. |
| KAN-36 | Reuse Save-then-Delete/lost-alert follow-ups; classify reachability before deciding whether a fix blocks release. |
| KAN-37; KAN-38 | Reuse stale shopping-add feedback and repeated Pantry-add navigation fixes. Severity/gates are reassessed rather than silently changed. |
| KAN-33; KAN-35 (Fertig) | Already merged navigation/remove-flash fixes: regression references only. |
| KAN-5 | Existing single-writer Jira tooling debt remains unrelated; no duplicate concurrency ticket. |

PF-AUTH-001, PF-IOS-001, PF-I18N-001 and PF-DATA-001 are document identifiers, not existing Jira keys; T2/T7/T4/T6 provide their planned Jira ownership. Old audit counts are historical exposure records, not new measurements.

## Dependencies and recommended order

1. **T1 first:** approve/reconcile Slice 3 scope, final Slice 2 acceptance and exact baseline; triage existing findings. Discovery can proceed while approval is pending; application implementation cannot.
2. **T2/T3/T4/T6 in parallel where contracts permit:** reset and locale work share existing Auth/i18n paths; approve deletion/retention/security design before any destructive implementation. T6 reviews the resulting privileged boundaries.
3. **T5** reuses KAN-34/39 and verifies actual delivery; UI localization and accessibility should develop together. Existing KAN-32/36/37/38 fixes remain in those tickets with their own review/evidence.
4. **T7** can resolve Apple/build/device prerequisites early; final native iOS evidence follows integrated features. Unavailable iOS prerequisites do not falsely invalidate an independently approved Android-only beta.
5. **T8** starts with decisions, not implementation. Public content follows lifecycle/privacy decisions; website/feedback builds remain conditional on approval of detailed scope and architecture.
6. **T9** plans coverage from the start, runs final native/full-suite validation after mandatory work, and records Slice 3 GO/NO-GO.
7. **T10** prepares distribution early but records separate Android, iOS and public-release decisions only after evidence. Uploads, tester invitations and launch require new explicit execution authorization.

## Mandatory gates, decisions and exclusions

- Mandatory Slice 3: approved scope/readiness, approved free-app hardening, EN/DE delivery, security/privacy review, meaningful regression matrix and final slice acceptance. Account deletion design, first-launch/profile locale precedence and platform commitment must be decided before affected implementation.
- Mandatory general public release: password recovery, secure lifecycle/deletion, required public/privacy/support information and request routes, security/data/operations qualification, applicable accessibility/content requirements and an explicit publication decision. Store/legal requirements must be checked against current official sources during execution, not assumed from this planning brief.
- Android gate: fresh correct-environment artifact, full Android/Maestro and physical TalkBack/keyboard/font/navigation evidence plus approved distribution prerequisites.
- iOS gate: Apple/build/signing/iPhone prerequisites, actual native build/device behavior and VoiceOver/TestFlight readiness. Android evidence cannot close it. Paid accounts/build services need separate approval.
- Independent proposals: Astro + TypeScript + Cloudflare Pages and separate website repository; detailed feedback categories/channel; Settings Send feedback. Essential public information can block public release even if a particular website technology is not selected.
- Scope decisions still needed: whether deferred pantry filters/profile-name UI belong here, first-launch language behavior, profile/device preference conflict, deletion and backup retention, beta platform/audience/costs, website/feedback architecture, recovery targets and required external request mechanism.
- Deferred candidate opportunities only: quick-add/bulk entry/undo/export and extra languages. Excluded without further approval: premium/payments/gating, sharing/invitations, quantities/expiry/reminders, barcode/recipes/advanced analytics, other HouseholdKit apps, custom backend, generic framework and architectural rewrite. No silently approved offline queue, telemetry or redesign.

## Safe creation procedure after approval

Re-read Jira and reconcile PF-S3 IDs/operation identifier before writes. Use one writer, create Epic then Tasks then Subtasks, materialize only verified native parent keys, preview each payload through the existing CLI, inspect it, then invoke exact `--apply` once. Journal the attempt before the mutation and read back canonical key, content, type, parent, labels and supported priority. Stop on ambiguity or unexpected results; inspect Jira by operation/backlog ID before considering a manual retry. Never automatically retry writes. Final verification must compare the approved plan and all issue contents/hierarchy. No unrelated edits/notifications/bulk import or project changes are authorized.

## Detailed proposed descriptions and hierarchy


### EPIC — PantryFlow — Slice 3: Production Hardening and Launch Readiness

Backlog ID: PF-S3-EPIC
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Development readiness; general public release; platform-specific gates recorded separately

Objective: Prepare the free PantryFlow application for a controlled beta and an explicit launch decision, preserving validated Pantry and Shopping behavior. This is hardening, not a feature-expansion slice.

Baseline: Slice 1.1 annotated tag pantryflow/slice-1.1-baseline -> df57e2f. Latest merged reference is main 2186d50 (PR #35). Exact-head scheduled full CI 43871390297 and push CI 43357560354 passed; Sonar gate is green. No Slice 2 baseline tag exists and KAN-6 remains Backlog, although KAN-7/11/15/19/23 and their core subtasks are Fertig. Reuse KAN-6/KAN-23/KAN-24/25/26 acceptance evidence; do not create duplicate Slice 2 closure work or claim acceptance from status alone.

Scope: approve source/decision reconciliation; password recovery; secure account/data lifecycle; English/German launch content and preference UX; accessibility acceptance using existing fixes; security/privacy/migration/recovery review; independent iOS readiness; conditional website/feedback planning; complete regression and beta/readiness evidence. All Slice 3 implementation depends on T1 approval and explicit Slice 2 acceptance. Website stack, feedback behavior, deletion retention, first-launch/profile-locale precedence and platform/beta choice remain decisions, not silently approved implementations.

Exit criteria: approved scope traced to acceptance cases; mandatory requirements implemented and reviewed; core automated gates green on exact final head and protected main; Android native/device evidence; iOS evidence or explicitly separate iOS NO-GO; security/privacy/operations blockers resolved or explicitly dispositioned where permissible; reproducible fixture cleanup; final Slice 3 GO/NO-GO record; separate public-release decision. No unresolved confirmed blocking defect may be waived by a green test count. Account deletion cannot destroy unrelated household data. Strict pantry uniqueness and shopping D1–D4 remain unchanged.

Reuse existing open KAN-27/32/34/36/37/38/39; completed KAN-33 and KAN-35 are regression references, not new implementation work. No existing issue reparenting, status/priority changes or native dependency writes are included. Dependencies will be explicit descriptions because the approved CLI has no native issue-link operation.

Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.


### T1 — [Slice 3] Approve scope, baseline and carried-finding dispositions

Backlog ID: PF-S3-T1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Blocks Slice 3 implementation; planning/discovery may proceed

Problem/objective: Reconcile historical specifications with current implementation before treating Slice 3 work as approved.

Scope: Produce the Slice 3 decision register and readiness record. Reuse KAN-6/KAN-23 closure evidence; triage existing debt, not replacement fix tickets.

Technical context: main 2186d50; docs/planning/slice-2-implementation-plan.md; docs/testing/coverage-matrix.md; existing KAN-6/23/27/32/34/36/37/38/39.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: KAN-6/KAN-23 evidence; owner final Slice 2 acceptance

Acceptance criteria:
- Scope precedence resolves old sharing/premium/post-MVP-password wording in favor of later approved decisions and this hardening brief.
- Slice 2 acceptance is explicitly recorded using existing issues; exact baseline commit and any authorized tag are recorded, not invented.
- No open PR is overlooked; current merged-main CI evidence and hosted/local environment evidence are referenced with limits.
- Existing KAN-27/32/34/36/37/38/39 each receives an assessed severity, reachability, owner and development/Android/iOS/public-release disposition in the record; do not alter them without approval.
- Owner reports KAN-34 is in CI and final review on 2026-11-17; reuse it and record final checks, review and merge evidence before treating it as delivered in main.
- Owner decides filters, profile-name editing, first-launch language behavior, deletion policy, beta platform and proposed website/feedback scope before related implementation.

Required tests/evidence: Read-only repository/Jira/CI audit; compare evidence and exact commits, not new duplicate tests or hosted queries without authorization.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Blocks Slice 3 implementation; planning/discovery may proceed, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: KAN-6, KAN-23–27, KAN-32–39; PR #35; D1–D6
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T1-S1 — Reconcile Slice 3 scope and obtain product decisions

Backlog ID: PF-S3-T1-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Blocks Slice 3 implementation; planning/discovery may proceed

Objective: Reconcile Slice 3 scope and obtain product decisions.
Parent scope: Approve scope, baseline and carried-finding dispositions.
Technical context: main 2186d50; docs/planning/slice-2-implementation-plan.md; docs/testing/coverage-matrix.md; existing KAN-6/23/27/32/34/36/37/38/39.

Observable acceptance criteria:
- A versioned scope register identifies mandatory, conditional, proposed and excluded requirements.
- No standalone approved Slice 3 spec is claimed; current brief and source precedence are recorded.
- Filters/localization boundary and older sharing/premium conflicts have explicit decisions.

Validation: Owner review of the traceability/decision register; no runtime change.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T1; KAN-6, KAN-23–27, KAN-32–39; PR #35; D1–D6

#### T1-S2 — Assemble the Slice 2 baseline acceptance record using existing closure issues

Backlog ID: PF-S3-T1-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Blocks Slice 3 implementation; planning/discovery may proceed

Objective: Assemble the Slice 2 baseline acceptance record using existing closure issues.
Parent scope: Approve scope, baseline and carried-finding dispositions.
Technical context: main 2186d50; docs/planning/slice-2-implementation-plan.md; docs/testing/coverage-matrix.md; existing KAN-6/23/27/32/34/36/37/38/39.

Observable acceptance criteria:
- Reuse KAN-6/KAN-23–26 outcomes rather than recreate execution tickets.
- Record main 2186d50, full run 43871390297, phone/emulator evidence and any limitations; verify no outstanding PR.
- Obtain final Slice 2 acceptance; tag only if separately authorized.

Validation: Read-only evidence comparison; any new validation uses the existing harness and disposable environment.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T1; KAN-6, KAN-23–27, KAN-32–39; PR #35; D1–D6

#### T1-S3 — Reassess existing functional and tooling findings for release impact

Backlog ID: PF-S3-T1-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Blocks Slice 3 implementation; planning/discovery may proceed

Objective: Reassess existing functional and tooling findings for release impact.
Parent scope: Approve scope, baseline and carried-finding dispositions.
Technical context: main 2186d50; docs/planning/slice-2-implementation-plan.md; docs/testing/coverage-matrix.md; existing KAN-6/23/27/32/34/36/37/38/39.

Observable acceptance criteria:
- Reference KAN-27/32/34/36/37/38/39 with owners, reachability and release classifications; no duplicate fixes.
- Retain KAN-33/35 as fixed regressions; KAN-34 is actively in CI/final review per owner, with final delivery evidence pending.
- Candidate quick-add/bulk/undo/export stays proposed, not implementation scope.

Validation: Inspect current code and existing reproductions; record failing-before evidence in original tickets when actual fixes are later authorized.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T1; KAN-6, KAN-23–27, KAN-32–39; PR #35; D1–D6


### T2 — [Slice 3] Implement and qualify password recovery

Backlog ID: PF-S3-T2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release authentication gate; platform-specific link evidence

Problem/objective: Users cannot recover a forgotten password in the current AuthProvider/UI.

Scope: Add request, native reset, password update and translated recovery feedback through Supabase Auth; preserve confirmation/session flows.

Technical context: lib/auth.tsx lacks recovery/update-password operations; reuse lib/email-confirmation.ts, app/auth/callback.tsx, app/+native-intent.tsx, lib/native-auth-crypto.ts, AuthGate and existing SMTP/deep-link configuration.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T1 approved readiness; T4 translation contract; T7 for iOS release qualification

Acceptance criteria:
- A user requests recovery without disclosing whether an email exists and can set a new password through the intended native flow.
- Valid, invalid, expired, reused and wrong-purpose links are handled safely on warm/cold start; failure recovers without exposing tokens or unintended account replacement.
- Restart, logout, session restoration and original confirmation journeys still pass; actual delivered recovery email is verified separately from mocks.
- Redirect/template/SMTP changes are separately authorized at execution; no token in logs or source.

Required tests/evidence: Node/Jest screen and auth tests; local Auth/API tests with isolated fixtures; Android native warm/cold link and actual mail receipt; iOS via T7.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Mandatory public-release authentication gate; platform-specific link evidence, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: PF-AUTH-001; PF-EMAIL-001; existing confirmation/native-link tests
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T2-S1 — Define recovery routing and implement request/update-password operations

Backlog ID: PF-S3-T2-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release authentication gate; platform-specific link evidence

Objective: Define recovery routing and implement request/update-password operations.
Parent scope: Implement and qualify password recovery.
Technical context: lib/auth.tsx lacks recovery/update-password operations; reuse lib/email-confirmation.ts, app/auth/callback.tsx, app/+native-intent.tsx, lib/native-auth-crypto.ts, AuthGate and existing SMTP/deep-link configuration.

Observable acceptance criteria:
- Approved design distinguishes recovery from signup-confirmation callbacks and checks allowed redirects.
- Extend the existing AuthProvider/Supabase client; add no parallel auth client or backend.
- Request and update failures have safe translated retry behavior.

Validation: Unit/component tests of operations, route parsing, privacy-preserving request responses and invalid-link handling.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T2; PF-AUTH-001; PF-EMAIL-001; existing confirmation/native-link tests

#### T2-S2 — Build the password-reset screens and interruption recovery

Backlog ID: PF-S3-T2-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release authentication gate; platform-specific link evidence

Objective: Build the password-reset screens and interruption recovery.
Parent scope: Implement and qualify password recovery.
Technical context: lib/auth.tsx lacks recovery/update-password operations; reuse lib/email-confirmation.ts, app/auth/callback.tsx, app/+native-intent.tsx, lib/native-auth-crypto.ts, AuthGate and existing SMTP/deep-link configuration.

Observable acceptance criteria:
- Request, password entry and success/recovery screens are gated appropriately.
- Save locks, field validation, keyboard handling and accessibility reuse existing patterns.
- Leaving a screen or changing identity cannot cause stale navigation or session replacement.

Validation: Behavioral tests for successful/rejected/interrupted requests and duplicate submits; native selectors independent of translation.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T2; PF-AUTH-001; PF-EMAIL-001; existing confirmation/native-link tests

#### T2-S3 — Verify real recovery delivery, deep links and authentication regressions

Backlog ID: PF-S3-T2-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release authentication gate; platform-specific link evidence

Objective: Verify real recovery delivery, deep links and authentication regressions.
Parent scope: Implement and qualify password recovery.
Technical context: lib/auth.tsx lacks recovery/update-password operations; reuse lib/email-confirmation.ts, app/auth/callback.tsx, app/+native-intent.tsx, lib/native-auth-crypto.ts, AuthGate and existing SMTP/deep-link configuration.

Observable acceptance criteria:
- Delivered recovery link works on Android warm and force-stopped start and permits authentication with the new password.
- Expired/invalid/replayed links, resend/retry and restart have recorded outcomes; signup confirmation still works.
- iOS results are recorded under T7, not inferred from Android; fixture cleanup is verified.

Validation: Local integration plus controlled hosted mail/device test with separately authorized settings and disposable accounts; restore temporary settings.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T2; PF-AUTH-001; PF-EMAIL-001; existing confirmation/native-link tests


### T3 — [Slice 3] Define and implement secure account deletion and retention

Backlog ID: PF-S3-T3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release data lifecycle gate; policy/design approval blocks implementation

Problem/objective: No supported account-deletion UI exists; existing owner cascades make an unspecified delete operation dangerous.

Scope: Agree lifecycle/retention semantics first, then implement least-privilege deletion of the authenticated account, in-app confirmation and required external request path.

Technical context: 00001: profiles and owner households cascade from auth.users; membership cascades. 00002: pantry created_by is nullable ON DELETE SET NULL. 00004: shopping created_by SET NULL, household rows cascade, pantry link SET NULL. No invitation/sharing UI exists.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T1 scope; approved deletion/retention/security-boundary decision before implementation; T6 review; T8 external request content

Acceptance criteria:
- A lifecycle table explicitly describes auth/profile/membership/owned household/pantry/shopping/link/creator and backup-retention outcomes.
- Owner consents to destructive outcomes; cancellation changes nothing; identity/re-authentication requirements are defined and enforced server-side.
- Only the authenticated account can be targeted; no service-role/admin key reaches the app, browser, CI logs or public artifacts.
- Unrelated accounts/households remain byte-for-byte unaffected; missing/expired sessions and repeated/interrupted requests have predictable outcomes.
- Synthetic shared-membership cases are handled only under an approved policy; stop on unexpected shared ownership, do not silently cascade or invent sharing semantics.
- The account cannot log back in after completed deletion; cached profile/pantry/shopping/auth data is cleared; any retention exceptions are disclosed.

Required tests/evidence: Real local PostgreSQL/Auth authorization, cascade and no-loss comparisons with ordinary users; UI cancel/confirm/error tests; Android and iOS device evidence; external-path verification when required.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Mandatory public-release data lifecycle gate; policy/design approval blocks implementation, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: PF-DATA-001; migrations 00001/00002/00004; existing author-deletion fixtures; T8/T10
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T3-S1 — Approve the deletion, retention and privileged-boundary design

Backlog ID: PF-S3-T3-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release data lifecycle gate; policy/design approval blocks implementation

Objective: Approve the deletion, retention and privileged-boundary design.
Parent scope: Define and implement secure account deletion and retention.
Technical context: 00001: profiles and owner households cascade from auth.users; membership cascades. 00002: pantry created_by is nullable ON DELETE SET NULL. 00004: shopping created_by SET NULL, household rows cascade, pantry link SET NULL. No invitation/sharing UI exists.

Observable acceptance criteria:
- Document actual foreign-key effects and proposed sole-household deletion outcomes.
- Decide recent-auth, backup/log retention, unexpected membership handling and required external requests.
- Approve a narrow Supabase-managed privileged boundary; no custom app server or secrets in clients.

Validation: Review a threat model and table-by-table lifecycle matrix before destructive implementation.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T3; PF-DATA-001; migrations 00001/00002/00004; existing author-deletion fixtures; T8/T10

#### T3-S2 — Implement authenticated deletion and in-app confirmation

Backlog ID: PF-S3-T3-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release data lifecycle gate; policy/design approval blocks implementation

Objective: Implement authenticated deletion and in-app confirmation.
Parent scope: Define and implement secure account deletion and retention.
Technical context: 00001: profiles and owner households cascade from auth.users; membership cascades. 00002: pantry created_by is nullable ON DELETE SET NULL. 00004: shopping created_by SET NULL, household rows cascade, pantry link SET NULL. No invitation/sharing UI exists.

Observable acceptance criteria:
- Only current validated identity is deletable; fabricated user IDs, anonymous/expired tokens and cross-account requests fail.
- Confirmation explains owned data consequences; cancellation is non-destructive.
- Success clears local state; failure/interruption has safe read-back and recovery without blind destructive retries.

Validation: Failing-before unit/component and local Auth/API tests; deterministic disposable fixtures only.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T3; PF-DATA-001; migrations 00001/00002/00004; existing author-deletion fixtures; T8/T10

#### T3-S3 — Verify deletion isolation, retention disclosures and external requests

Backlog ID: PF-S3-T3-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release data lifecycle gate; policy/design approval blocks implementation

Objective: Verify deletion isolation, retention disclosures and external requests.
Parent scope: Define and implement secure account deletion and retention.
Technical context: 00001: profiles and owner households cascade from auth.users; membership cascades. 00002: pantry created_by is nullable ON DELETE SET NULL. 00004: shopping created_by SET NULL, household rows cascade, pantry link SET NULL. No invitation/sharing UI exists.

Observable acceptance criteria:
- Before/after snapshots prove intended cascades and preservation of unrelated data and surviving attribution.
- Repeat/interrupted request semantics and post-delete authentication are tested.
- Approved external path from T8 is usable and matches the policy; evidence excludes personal payloads and secrets.

Validation: Local two-household authorization/no-loss tests, native-device checks and controlled external workflow verification.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T3; PF-DATA-001; migrations 00001/00002/00004; existing author-deletion fixtures; T8/T10


### T4 — [Slice 3] Complete English/German launch content and language preferences

Backlog ID: PF-S3-T4
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory EN/DE public-release gate; filters/extra languages are not automatically included

Problem/objective: de.ts is a stub and Settings only signs out; PRD language selection and EN/DE launch content are not delivered.

Scope: Complete EN/DE content, language settings and approved device/profile preference behavior; reconcile first-launch requirements before building UX.

Technical context: lib/i18n/index.tsx has locale/setLocale/t, AsyncStorage user_language and English fallback; de.ts empty; profiles.language allows en/de and own-column updates in 00002; app/(tabs)/settings.tsx has no language selector.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T1 localization/first-launch/profile-precedence decision; T2/T3 new-string inventory

Acceptance criteria:
- All shipped screens, auth flows, alerts, validation and state errors have reviewed EN/DE strings; no raw translation keys reach user-visible UI.
- Changing language updates visible UI and survives restart; approved profile/device conflict, offline failure and account-switch semantics are tested.
- Native alerts/labels and German text expansion work at supported font sizes without clipping actionable controls.
- Database enum/name semantics remain unchanged; pantry filters or extra languages require an explicit separate scope decision.

Required tests/evidence: Key-parity/missing-key and i18n lifecycle tests; settings component tests; German native screenshots and keyboard/font-size checks on Android and iOS.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Mandatory EN/DE public-release gate; filters/extra languages are not automatically included, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: PF-I18N-001; PRD §13; D5; lib/i18n; profiles_language_valid
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T4-S1 — Complete and review the English/German translation catalogue

Backlog ID: PF-S3-T4-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory EN/DE public-release gate; filters/extra languages are not automatically included

Objective: Complete and review the English/German translation catalogue.
Parent scope: Complete English/German launch content and language preferences.
Technical context: lib/i18n/index.tsx has locale/setLocale/t, AsyncStorage user_language and English fallback; de.ts empty; profiles.language allows en/de and own-column updates in 00002; app/(tabs)/settings.tsx has no language selector.

Observable acceptance criteria:
- Cover current and new approved screens/alerts/errors with matching EN/DE keys.
- Fix verified encoding/copy defects without changing domain rules.
- A reproducible missing-key check prevents internal keys being shown.

Validation: Automated key coverage and representative error rendering; human German copy review.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T4; PF-I18N-001; PRD §13; D5; lib/i18n; profiles_language_valid

#### T4-S2 — Implement language selection and approved preference persistence

Backlog ID: PF-S3-T4-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory EN/DE public-release gate; filters/extra languages are not automatically included

Objective: Implement language selection and approved preference persistence.
Parent scope: Complete English/German launch content and language preferences.
Technical context: lib/i18n/index.tsx has locale/setLocale/t, AsyncStorage user_language and English fallback; de.ts empty; profiles.language allows en/de and own-column updates in 00002; app/(tabs)/settings.tsx has no language selector.

Observable acceptance criteria:
- Reuse I18nProvider/setLocale and existing profile own-column permission.
- Language selection and any first-launch step follow the owner-approved rule.
- Restore/profile/device races and account switches cannot leak another user preference; failed persistence recovers.

Validation: Unit/component/local API checks of EN/DE selection, restart, fallback and profile boundaries.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T4; PF-I18N-001; PRD §13; D5; lib/i18n; profiles_language_valid

#### T4-S3 — Validate bilingual layout, font scaling and native messages

Backlog ID: PF-S3-T4-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory EN/DE public-release gate; filters/extra languages are not automatically included

Objective: Validate bilingual layout, font scaling and native messages.
Parent scope: Complete English/German launch content and language preferences.
Technical context: lib/i18n/index.tsx has locale/setLocale/t, AsyncStorage user_language and English fallback; de.ts empty; profiles.language allows en/de and own-column updates in 00002; app/(tabs)/settings.tsx has no language selector.

Observable acceptance criteria:
- German labels, forms, section headings and alerts remain usable with text expansion.
- Keyboard-open actions and screen-reader labels use the selected language.
- Record native evidence separately by platform and language.

Validation: Android physical/automated checks and iOS checks via T7; screenshots contain only fixtures.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T4; PF-I18N-001; PRD §13; D5; lib/i18n; profiles_language_valid


### T5 — [Slice 3] Qualify native accessibility using the existing remediation tickets

Backlog ID: PF-S3-T5
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Public-release accessibility gate; separate Android TalkBack and iOS VoiceOver gates

Problem/objective: Role-only errors are not sufficient TalkBack evidence; KAN-34 and KAN-39 already own the fixes.

Scope: Audit and verify accessibility across existing/new flows; reuse KAN-34/39 implementation, do not recreate error-announcement fixes.

Technical context: components/Input.tsx on inspected main still renders plain error Text. Owner confirms KAN-34 is currently in CI and final review (2026-11-17); use its final review/check/merge evidence when available. KAN-39 is the distinct screen-level announcement follow-up. Row checkbox/button roles and useSingleOpen already exist.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T1 existing-finding reconciliation; KAN-34 and KAN-39 remediation/read-back; T4 translations; T7 iOS

Acceptance criteria:
- The screen/control inventory covers labels, focus order, checked/disabled/busy states, touch targets, font scaling and contrast.
- Existing form-error and screen-level announcement tickets are reused and verified on merged code.
- TalkBack actually announces representative form and whole-screen errors without manual focus; VoiceOver has separate evidence before iOS release.
- Password reset, account deletion and locale/feedback UX participate in the audit; automated props alone are not claimed device evidence.

Required tests/evidence: Jest/native-prop regressions plus physical TalkBack and VoiceOver walkthroughs; exact build/platform/version and limitations recorded.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Public-release accessibility gate; separate Android TalkBack and iOS VoiceOver gates, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: KAN-34; KAN-39; existing SHOP-UI coverage; components/Input and AuthGate
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T5-S1 — Audit accessibility contracts and reconcile existing error fixes

Backlog ID: PF-S3-T5-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Public-release accessibility gate; separate Android TalkBack and iOS VoiceOver gates

Objective: Audit accessibility contracts and reconcile existing error fixes.
Parent scope: Qualify native accessibility using the existing remediation tickets.
Technical context: components/Input.tsx on inspected main still renders plain error Text. Owner confirms KAN-34 is currently in CI and final review (2026-11-17); use its final review/check/merge evidence when available. KAN-39 is the distinct screen-level announcement follow-up. Row checkbox/button roles and useSingleOpen already exist.

Observable acceptance criteria:
- Inventory current/new routes and native controls with labels, states, focus and touch-target criteria.
- Reuse KAN-34 (currently in CI/final review) and KAN-39; record final delivery evidence and do not open duplicate fix work.
- Any newly confirmed gap has a specific reproduction and scoped follow-up rather than blanket redesign.

Validation: Component/state assertions and code audit against merged main; no unsupported web-only roles.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T5; KAN-34; KAN-39; existing SHOP-UI coverage; components/Input and AuthGate

#### T5-S2 — Record physical TalkBack and VoiceOver acceptance

Backlog ID: PF-S3-T5-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Public-release accessibility gate; separate Android TalkBack and iOS VoiceOver gates

Objective: Record physical TalkBack and VoiceOver acceptance.
Parent scope: Qualify native accessibility using the existing remediation tickets.
Technical context: components/Input.tsx on inspected main still renders plain error Text. Owner confirms KAN-34 is currently in CI and final review (2026-11-17); use its final review/check/merge evidence when available. KAN-39 is the distinct screen-level announcement follow-up. Row checkbox/button roles and useSingleOpen already exist.

Observable acceptance criteria:
- TalkBack checks shopping load error plus another screen-level error and an Input error.
- VoiceOver covers equivalent flows on an actual supported iOS build/device.
- Focus, language, error announcements, checkbox state and destructive confirmation are usable; failures keep the relevant platform NO-GO.

Validation: Dated physical-device acceptance with exact commit/build and assistive-technology versions; fixture-only screenshots.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T5; KAN-34; KAN-39; existing SHOP-UI coverage; components/Input and AuthGate


### T6 — [Slice 3] Qualify security, migrations and operational recovery

Backlog ID: PF-S3-T6
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release security/data/operations gate; hosted execution separately authorized

Problem/objective: Existing security coverage and development DB evidence must be extended to new lifecycle paths and a production operating model.

Scope: Review RLS/grants/constraints, auth lifecycle, premium exposure, secrets/logging, dependency exposure, migration upgrades and practical recovery.

Technical context: Reuse migrations 00001–00004, catalog-snapshot.sql, baseline-inventory.sql, guarded hosted procedures, PG17 assertion, redacted diagnostics and local integration fixtures. Hosted oiqteedkfwmcertgxqga remains documented non-production; no fresh hosted verification in this planning assignment.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T1 readiness; T3 approved lifecycle; KAN-27 tooling issue reused; T10 deployment/environment decision

Acceptance criteria:
- Independent ordinary users cannot cross household/profile/lifecycle boundaries or escalate profiles.is_premium; strict pantry uniqueness and shopping D1–D4 remain enforced under direct API/concurrent tests.
- Unused premium flags receive an exposure review; authorized data audit/correction, if any, is separately approved; no premium feature is implemented.
- Current dependency/advisory exposure and log/artifact redaction are reassessed with owner/date; dated 23-moderate/one-low counts are not treated as current.
- A real PG17 populated-upgrade test detects invalid/duplicate existing rows and proves no unintended loss; catalog/ledger exceptions and before/after artifacts are retained.
- MVP backup/restore, rollback/forward-fix, recovery ownership and justified recovery targets are documented and rehearsed with disposable data.

Required tests/evidence: pgTAP/ordinary Auth/PostgREST and meaningful concurrent tests; secret-redaction tests; current audit/typecheck/gates; isolated populated-upgrade and restore rehearsal.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Mandatory public-release security/data/operations gate; hosted execution separately authorized, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: PF-DATA-001; PF-PREMIUM-001; PF-EMAIL-002; KAN-27/28/29/30/31; docs/security/tooling-advisories.md
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T6-S1 — Review and test authorization, lifecycle and unused premium exposure

Backlog ID: PF-S3-T6-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release security/data/operations gate; hosted execution separately authorized

Objective: Review and test authorization, lifecycle and unused premium exposure.
Parent scope: Qualify security, migrations and operational recovery.
Technical context: Reuse migrations 00001–00004, catalog-snapshot.sql, baseline-inventory.sql, guarded hosted procedures, PG17 assertion, redacted diagnostics and local integration fixtures. Hosted oiqteedkfwmcertgxqga remains documented non-production; no fresh hosted verification in this planning assignment.

Observable acceptance criteria:
- Extend existing two-household RLS/grant/direct-API cases to reset/deletion/preference operations.
- Preserve creator and timestamp restrictions, pantry/shopping unique rules and no client admin secrets.
- Record premium exposure and any anomalous data as a decision, never silently reset entitlement flags.

Validation: Threat review plus local ordinary-user SQL/API tests; management reads only with execution authorization.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T6; PF-DATA-001; PF-PREMIUM-001; PF-EMAIL-002; KAN-27/28/29/30/31; docs/security/tooling-advisories.md

#### T6-S2 — Reassess dependencies, logging and sender operational risks

Backlog ID: PF-S3-T6-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release security/data/operations gate; hosted execution separately authorized

Objective: Reassess dependencies, logging and sender operational risks.
Parent scope: Qualify security, migrations and operational recovery.
Technical context: Reuse migrations 00001–00004, catalog-snapshot.sql, baseline-inventory.sql, guarded hosted procedures, PG17 assertion, redacted diagnostics and local integration fixtures. Hosted oiqteedkfwmcertgxqga remains documented non-production; no fresh hosted verification in this planning assignment.

Observable acceptance criteria:
- Recompute advisories and document reachability/remediation decisions; reuse KAN-27 for its existing non-security findings.
- Diagnostic artifacts redact secrets and no user list contents or reset URLs are logged.
- Review sender/auth domain operation and DMARC reporting/enforcement options without changing policy automatically.

Validation: Existing redaction/CI checks; current audit evidence from primary upstream sources at implementation; DNS/SMTP changes remain separately authorized.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T6; PF-DATA-001; PF-PREMIUM-001; PF-EMAIL-002; KAN-27/28/29/30/31; docs/security/tooling-advisories.md

#### T6-S3 — Rehearse populated migrations and backup/recovery procedures

Backlog ID: PF-S3-T6-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory public-release security/data/operations gate; hosted execution separately authorized

Objective: Rehearse populated migrations and backup/recovery procedures.
Parent scope: Qualify security, migrations and operational recovery.
Technical context: Reuse migrations 00001–00004, catalog-snapshot.sql, baseline-inventory.sql, guarded hosted procedures, PG17 assertion, redacted diagnostics and local integration fixtures. Hosted oiqteedkfwmcertgxqga remains documented non-production; no fresh hosted verification in this planning assignment.

Observable acceptance criteria:
- PG17 migration rehearsal includes representative existing rows and invalid/duplicate preconditions.
- Retain before/after schema/ledger/row evidence; preserve reviewed hosted helper exceptions and stop on unexpected drift.
- A disposable restore/recovery rehearsal records owners, time/data-loss targets and tested recovery steps.

Validation: Real isolated Supabase/PostgreSQL upgrade/restore tests; never reset or restore hosted user data during qualification.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T6; PF-DATA-001; PF-PREMIUM-001; PF-EMAIL-002; KAN-27/28/29/30/31; docs/security/tooling-advisories.md


### T7 — [Slice 3] Prepare and validate iOS builds and TestFlight readiness

Backlog ID: PF-S3-T7
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Blocks iOS release only; Android may be assessed independently

Problem/objective: Android/Windows evidence does not establish iOS build, native link, usability or release readiness.

Scope: Identify Apple/build/device prerequisites; prepare an iOS test build, native behavior and practical existing-harness extension; document TestFlight readiness without distributing automatically.

Technical context: app.json: ios.bundleIdentifier com.pantryflow.app and scheme pantryflow. Existing CI builds Android only; no verified iOS build pipeline or signing setup. Reuse Expo configuration, auth callback/native-link logic and Maestro flows where supported.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T1 platform/budget decision; Apple membership/signing/build access and iPhone availability; T2/T3/T4/T5 feature contracts

Acceptance criteria:
- Prerequisites, credential ownership, bundle identity, schemes and environment separation are documented; paid services/purchases require separate approval.
- A fresh native iOS build from an exact reviewed commit runs on the selected device; no simulator-only or Android evidence is presented as physical iOS acceptance.
- Signup/confirmation/recovery warm/cold links, restart/session/logout, pantry/shopping CRUD/duplicates/prompts and interruptions pass on iOS.
- Safe areas, keyboard-first-tap, navigation, icons/fonts, EN/DE and VoiceOver have platform-specific evidence.
- TestFlight signing, metadata, testers and distribution procedure are prepared; beta upload/invites/release need separate explicit authorization.

Required tests/evidence: iOS build validation; reusable Maestro scenarios where practical plus documented manual gaps; physical iPhone smoke and VoiceOver; auth delivery evidence.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Blocks iOS release only; Android may be assessed independently, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: PF-IOS-001; app.json; existing .maestro and run-e2e.cjs; T2/T5/T10
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T7-S1 — Resolve iOS prerequisites and produce an isolated native test build

Backlog ID: PF-S3-T7-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Blocks iOS release only; Android may be assessed independently

Objective: Resolve iOS prerequisites and produce an isolated native test build.
Parent scope: Prepare and validate iOS builds and TestFlight readiness.
Technical context: app.json: ios.bundleIdentifier com.pantryflow.app and scheme pantryflow. Existing CI builds Android only; no verified iOS build pipeline or signing setup. Reuse Expo configuration, auth callback/native-link logic and Maestro flows where supported.

Observable acceptance criteria:
- Record Apple/build-machine or EAS access, costs, signing ownership and available iPhone.
- Verify com.pantryflow.app identity and approved test/development scheme/environment separation.
- Produce a fresh exact-commit iOS build without exposing signing or management credentials.

Validation: Build logs and install/read-back evidence; remain explicitly blocked if external prerequisites are unavailable.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T7; PF-IOS-001; app.json; existing .maestro and run-e2e.cjs; T2/T5/T10

#### T7-S2 — Extend native regression coverage and validate iPhone behavior

Backlog ID: PF-S3-T7-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Blocks iOS release only; Android may be assessed independently

Objective: Extend native regression coverage and validate iPhone behavior.
Parent scope: Prepare and validate iOS builds and TestFlight readiness.
Technical context: app.json: ios.bundleIdentifier com.pantryflow.app and scheme pantryflow. Existing CI builds Android only; no verified iOS build pipeline or signing setup. Reuse Expo configuration, auth callback/native-link logic and Maestro flows where supported.

Observable acceptance criteria:
- Reuse or adapt existing Maestro scenarios when practical; document unsupported automation explicitly.
- Physical iOS checks cover auth cold/warm links, Pantry/Shopping operations, keyboard/navigation, safe areas, fonts and EN/DE.
- VoiceOver evidence is coordinated with T5 and no iOS gate is closed from Android results.

Validation: Fresh iOS build, device walkthrough, automated reports where supported and explicit manual evidence/cleanup.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T7; PF-IOS-001; app.json; existing .maestro and run-e2e.cjs; T2/T5/T10

#### T7-S3 — Prepare TestFlight and iOS beta-validation requirements

Backlog ID: PF-S3-T7-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Blocks iOS release only; Android may be assessed independently

Objective: Prepare TestFlight and iOS beta-validation requirements.
Parent scope: Prepare and validate iOS builds and TestFlight readiness.
Technical context: app.json: ios.bundleIdentifier com.pantryflow.app and scheme pantryflow. Existing CI builds Android only; no verified iOS build pipeline or signing setup. Reuse Expo configuration, auth callback/native-link logic and Maestro flows where supported.

Observable acceptance criteria:
- Document distribution/signing/metadata/privacy prerequisites, tester selection and beta feedback/exit criteria.
- Create a dry-run distribution checklist and record unresolved external requirements.
- Do not upload, invite users or publish without separate authorization.

Validation: Review checklist and exact-build evidence; approved beta run is later execution, not this planning activity.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T7; PF-IOS-001; app.json; existing .maestro and run-e2e.cjs; T2/T5/T10


### T8 — [Slice 3] Decide and prepare HouseholdKit website and privacy-safe feedback

Backlog ID: PF-S3-T8
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Independent proposed website/feedback stream; required public information gates public release

Problem/objective: Public product/support/privacy/deletion information and a feedback channel need an independent owned workstream.

Scope: First approve website/feedback decisions; only then build approved pages/channels in a separate website workstream and minimal approved Settings entry.

Technical context: householdkit.app is owned; auth.householdkit.app serves authentication mail. No website implementation/repository/hosting approval is established in current app repo. Astro + TypeScript + Cloudflare Pages in a separate repository is a proposal, not a selected architecture.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T1 scope approval; separate owner confirmation of stack/repository/feedback; T3 deletion policy; T6 data/privacy inventory

Acceptance criteria:
- A decision brief confirms or rejects the proposed stack, repo, hosting costs and feedback mechanism before implementation.
- Approved landing/product/privacy/support/FAQ/deletion/beta/release-note/legal content has an owner and review status, with URLs usable before public release.
- Any required external deletion request route is genuine, secure and testable rather than merely a broken mailto or empty form.
- If Send feedback is approved, Settings distinguishes bug/usability/feature feedback and requests only user-approved diagnostics; no automatic content/token/credential upload.
- This issue does not change DNS, SMTP, infrastructure, accounts or hosting until explicitly authorized.

Required tests/evidence: Content/link/form accessibility tests and privacy payload inspection after design approval; external request round-trip with fixtures; platform Settings tests only if approved.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: Medium (Jira ID 3); gate classification is Independent proposed website/feedback stream; required public information gates public release, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: Owner Slice 3 brief H; householdkit.app; T3 deletion policy; T10 release gate
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T8-S1 — Approve website architecture, repository and feedback scope

Backlog ID: PF-S3-T8-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Independent proposed website/feedback stream; required public information gates public release

Objective: Approve website architecture, repository and feedback scope.
Parent scope: Decide and prepare HouseholdKit website and privacy-safe feedback.
Technical context: householdkit.app is owned; auth.householdkit.app serves authentication mail. No website implementation/repository/hosting approval is established in current app repo. Astro + TypeScript + Cloudflare Pages in a separate repository is a proposal, not a selected architecture.

Observable acceptance criteria:
- Compare proposed Astro/TypeScript/Cloudflare Pages with budget and existing domain/mail setup.
- Owner selects repository/hosting/channel and approves or defers Send feedback detail.
- Document essential public information versus optional marketing/feedback extras; no setup or purchases yet.

Validation: Owner-reviewed decision document and requirement/owner/cost table.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T8; Owner Slice 3 brief H; householdkit.app; T3 deletion policy; T10 release gate

#### T8-S2 — Prepare approved public content and account-deletion request path

Backlog ID: PF-S3-T8-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Independent proposed website/feedback stream; required public information gates public release

Objective: Prepare approved public content and account-deletion request path.
Parent scope: Decide and prepare HouseholdKit website and privacy-safe feedback.
Technical context: householdkit.app is owned; auth.householdkit.app serves authentication mail. No website implementation/repository/hosting approval is established in current app repo. Astro + TypeScript + Cloudflare Pages in a separate repository is a proposal, not a selected architecture.

Observable acceptance criteria:
- After decisions, implement only approved pages and required request routes in the selected independent website repository.
- Privacy/support/deletion/beta and legal content matches actual app collection/retention and has review ownership.
- Verify public URLs, accessibility and request routing before release without touching authentication DNS/SMTP implicitly.

Validation: Website/link/content and secure request round-trip tests; legal/policy requirements verified against current applicable sources during execution.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T8; Owner Slice 3 brief H; householdkit.app; T3 deletion policy; T10 release gate

#### T8-S3 — Implement approved Settings feedback with diagnostic consent

Backlog ID: PF-S3-T8-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Independent proposed website/feedback stream; required public information gates public release

Objective: Implement approved Settings feedback with diagnostic consent.
Parent scope: Decide and prepare HouseholdKit website and privacy-safe feedback.
Technical context: householdkit.app is owned; auth.householdkit.app serves authentication mail. No website implementation/repository/hosting approval is established in current app repo. Astro + TypeScript + Cloudflare Pages in a separate repository is a proposal, not a selected architecture.

Observable acceptance criteria:
- Blocked until feedback behavior is approved; otherwise retain as explicitly deferred.
- Separate bug/usability/feature categories and make sending user initiated.
- No pantry/shopping contents, auth URLs, tokens, credentials or identifiable logs are included automatically.

Validation: Component/native link and payload-redaction tests; device check on each supported release platform.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T8; Owner Slice 3 brief H; householdkit.app; T3 deletion policy; T10 release gate


### T9 — [Slice 3] Extend regression coverage and record Slice 3 GO/NO-GO

Backlog ID: PF-S3-T9
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory Slice 3 acceptance gate; not public-release authorization

Problem/objective: A new hardening slice needs reproducible behavioral evidence and a slice acceptance decision separate from publication.

Scope: Extend PF-TEST-001, execute full isolated regressions and native acceptance, then publish an exact-head acceptance/limitations record.

Technical context: Reuse tests/*.test.cjs, tests/components, tests/integration, supabase/tests/database, .maestro/slice-1-1.yaml, .maestro/slice-2-shopping.yaml, scripts/run-e2e.cjs, e2e-fixtures and .github/workflows/pantryflow-tests.yml.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T1 and all approved mandatory feature/review tasks; existing carried release blockers dispositioned; T7 for iOS GO

Acceptance criteria:
- Every approved Slice 3 outcome maps to an executable test or a named manual gate; known defects receive failing-before regressions.
- TypeScript/Node/Jest, PG17 pgTAP, local Auth/API and Sonar checks pass on the final head and protected main.
- Fresh Android build, complete Maestro journeys, database read-back, cleanup and physical-device smoke pass; keyboard/font/navigation/network-recovery limits are honest.
- iOS evidence or an explicit iOS NO-GO/exclusion is recorded without blocking an independently approved Android-only decision.
- Final Slice 3 GO requires closed mandatory requirements, no unresolved blocking security/privacy/data-loss defect, reviewed limitations and exact evidence; incomplete gates produce NO-GO.
- A release tag is created only when separately authorized; slice acceptance alone never publishes the app.

Required tests/evidence: Existing fast/database/API/native suites plus actual-device lifecycle, keyboard, TalkBack/VoiceOver and bilingual checks; fixture cleanup failures fail the run.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Mandatory Slice 3 acceptance gate; not public-release authorization, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: PF-TEST-001; KAN-23/24/25/26 reused as baseline; docs/testing/README.md and coverage matrix
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T9-S1 — Extend the living behavioral matrix and isolated fixture coverage

Backlog ID: PF-S3-T9-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory Slice 3 acceptance gate; not public-release authorization

Objective: Extend the living behavioral matrix and isolated fixture coverage.
Parent scope: Extend regression coverage and record Slice 3 GO/NO-GO.
Technical context: Reuse tests/*.test.cjs, tests/components, tests/integration, supabase/tests/database, .maestro/slice-1-1.yaml, .maestro/slice-2-shopping.yaml, scripts/run-e2e.cjs, e2e-fixtures and .github/workflows/pantryflow-tests.yml.

Observable acceptance criteria:
- Map recovery, deletion, locale, accessibility and all approved hardening outcomes to existing harness layers.
- Add meaningful failing-before regressions for confirmed defects and deterministic fixtures/cleanup.
- Document interrupted and ambiguous-write behavior without claiming forced DB overlap from merely parallel requests.

Validation: Review matrix against approved scope; run fast/local suites; credentials and production data stay out of fixtures.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T9; PF-TEST-001; KAN-23/24/25/26 reused as baseline; docs/testing/README.md and coverage matrix

#### T9-S2 — Run exact-head Android regression and physical-device qualification

Backlog ID: PF-S3-T9-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory Slice 3 acceptance gate; not public-release authorization

Objective: Run exact-head Android regression and physical-device qualification.
Parent scope: Extend regression coverage and record Slice 3 GO/NO-GO.
Technical context: Reuse tests/*.test.cjs, tests/components, tests/integration, supabase/tests/database, .maestro/slice-1-1.yaml, .maestro/slice-2-shopping.yaml, scripts/run-e2e.cjs, e2e-fixtures and .github/workflows/pantryflow-tests.yml.

Observable acceptance criteria:
- Fresh Android build passes Slice 1.1, shopping, confirmation and new approved auth/lifecycle flows.
- Independent DB read-back and font/asset gate pass; fixtures/proxy/ADB cleanup is verified.
- Physical checks include first-tap keyboard behavior, bilingual layout, navigation and TalkBack; record unsupported network/offline scenarios.

Validation: Full workflow_dispatch on exact head plus physical phone acceptance; isolate test APK and local stack.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T9; PF-TEST-001; KAN-23/24/25/26 reused as baseline; docs/testing/README.md and coverage matrix

#### T9-S3 — Record final Slice 3 acceptance and platform-specific limitations

Backlog ID: PF-S3-T9-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory Slice 3 acceptance gate; not public-release authorization

Objective: Record final Slice 3 acceptance and platform-specific limitations.
Parent scope: Extend regression coverage and record Slice 3 GO/NO-GO.
Technical context: Reuse tests/*.test.cjs, tests/components, tests/integration, supabase/tests/database, .maestro/slice-1-1.yaml, .maestro/slice-2-shopping.yaml, scripts/run-e2e.cjs, e2e-fixtures and .github/workflows/pantryflow-tests.yml.

Observable acceptance criteria:
- Record exact final-head and merged-main CI/quality evidence and fulfilled acceptance outcomes.
- State Slice 3 GO or NO-GO with owners for limitations, and independent Android/iOS readiness.
- Keep public release behind T10 and require separate authorization for any tag or publication.

Validation: Evidence review and reproducible report, not an unchecked completion checklist.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T9; PF-TEST-001; KAN-23/24/25/26 reused as baseline; docs/testing/README.md and coverage matrix


### T10 — [Slice 3] Prepare platform beta distribution and enforce the public-release gate

Backlog ID: PF-S3-T10
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory general public-release gate; Android and iOS decisions separate

Problem/objective: Slice acceptance and test APKs do not establish public-store, privacy, distribution or operational readiness.

Scope: Prepare Android beta artifact/configuration and a separately reviewed platform/public release checklist; do not release automatically.

Technical context: Current app.json uses com.pantryflow.app/pantryflow while test harness uses com.pantryflow.test and local test configuration; maintain this separation. Use T7 for iOS/TestFlight and T8 for required public URLs, not parallel implementations.
Reuse pantry-flow and its existing Expo Router, lib/auth.tsx, lib/supabase.ts, AuthGate, household-scope, household-list, data modules, useItemMutation/current(), useSingleOpen, theme/components/i18n, migrations 00001–00004, Node/Jest-RNTL, pgTAP, local Auth/PostgREST and Maestro harness. Do not build parallel auth, authorization, CRUD or test frameworks.

Dependencies: T9 Slice 3 GO; T2/T3/T4/T5/T6 public gates; T8 required public content; T7 before iOS beta/release

Acceptance criteria:
- Android signed beta artifact, identifiers/versioning, production environment, permissions and distribution prerequisites are documented and verified without test keys/endpoints.
- Current store/platform requirements, privacy disclosures, deletion requests, support, consent and operational ownership are verified against actual shipped behavior before submission.
- Beta tester eligibility, feedback handling, rollback/incident contacts and success/stop criteria are approved; no invites or uploads without authorization.
- Decision record independently states Android GO/NO-GO, iOS GO/NO-GO and general public-release GO/NO-GO with missing prerequisites.
- Publication occurs only after explicit owner authorization of a concrete release artifact and checklist; no automated release from ticket closure.

Required tests/evidence: Artifact/configuration inspection; signed-install smoke on target platform; public-policy/support/request links; current store checklist and release evidence review.

Security/privacy: no secrets, recovery links, pantry/shopping contents or account identifiers in public logs; use isolated fixtures and exact cleanup. Destructive behavior requires approved lifecycle semantics and authorization at execution.

Release priority: High (Jira ID 2); gate classification is Mandatory general public-release gate; Android and iOS decisions separate, independent of priority.

Exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.

Definition of done: criteria and child activities have independently reviewable evidence on an exact commit; required checks pass; limitations/deferred findings have an owner and disposition; relevant docs/matrix are updated. A ticket marked done does not authorize publication.

References: PF-IOS-001/PF-AUTH-001/PF-I18N-001/PF-DATA-001; T7/T8/T9; app.json and environment separation
Sources: current main 2186d50414c6f7ea8a78c938f973efede3f7192e; docs/A_PantryFlow_PRD.md; docs/F_Final_Corrected_Analysis.md (historical scope only); docs/planning/slice-2-implementation-plan.md D1–D6; docs/testing/coverage-matrix.md; docs/testing/production-follow-ups.md; owner Slice 3 planning brief received 2026-11-17. No standalone approved Slice 3 specification was found; scope/implementation decisions below remain gated.

#### T10-S1 — Prepare Android beta artifact and distribution prerequisites

Backlog ID: PF-S3-T10-S1
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory general public-release gate; Android and iOS decisions separate

Objective: Prepare Android beta artifact and distribution prerequisites.
Parent scope: Prepare platform beta distribution and enforce the public-release gate.
Technical context: Current app.json uses com.pantryflow.app/pantryflow while test harness uses com.pantryflow.test and local test configuration; maintain this separation. Use T7 for iOS/TestFlight and T8 for required public URLs, not parallel implementations.

Observable acceptance criteria:
- Verify approved production/test identity, version/build numbers, signing ownership and endpoint/public-key configuration.
- Inspect permissions and ensure no test fixtures, management secrets or loopback endpoints enter the release artifact.
- Prepare current Android-store beta prerequisites and rollback instructions; submission/upload remains separately authorized.

Validation: Fresh signed-artifact inspection and Android install smoke; review current official store requirements during execution.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T10; PF-IOS-001/PF-AUTH-001/PF-I18N-001/PF-DATA-001; T7/T8/T9; app.json and environment separation

#### T10-S2 — Verify public privacy, support, deletion and operational readiness

Backlog ID: PF-S3-T10-S2
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory general public-release gate; Android and iOS decisions separate

Objective: Verify public privacy, support, deletion and operational readiness.
Parent scope: Prepare platform beta distribution and enforce the public-release gate.
Technical context: Current app.json uses com.pantryflow.app/pantryflow while test harness uses com.pantryflow.test and local test configuration; maintain this separation. Use T7 for iOS/TestFlight and T8 for required public URLs, not parallel implementations.

Observable acceptance criteria:
- Public documents and disclosures match actual collection/retention and approved lifecycle behavior.
- Verify required external deletion route, support ownership, incident response and backup/recovery evidence.
- Confirm proposed website extras are not confused with mandatory release information or undisclosed telemetry.

Validation: Cross-check T3/T6/T8 outputs and actual URLs/request round-trips; document applicable policy review and any blocker.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T10; PF-IOS-001/PF-AUTH-001/PF-I18N-001/PF-DATA-001; T7/T8/T9; app.json and environment separation

#### T10-S3 — Obtain separate Android, iOS and public-release decisions

Backlog ID: PF-S3-T10-S3
Planning status: DRAFT — creation requires owner approval of the dry-run report.
Release classification: Mandatory general public-release gate; Android and iOS decisions separate

Objective: Obtain separate Android, iOS and public-release decisions.
Parent scope: Prepare platform beta distribution and enforce the public-release gate.
Technical context: Current app.json uses com.pantryflow.app/pantryflow while test harness uses com.pantryflow.test and local test configuration; maintain this separation. Use T7 for iOS/TestFlight and T8 for required public URLs, not parallel implementations.

Observable acceptance criteria:
- Provide exact artifacts/build IDs, beta plan, test evidence and unresolved decisions to the owner.
- Record distinct GO/NO-GO for Android, iOS and public publication; unavailable Apple/iPhone prerequisites keep iOS NO-GO.
- No uploads, tester invitations, DNS/SMTP changes or public launch without explicit execution authorization.

Validation: Owner review of concrete readiness dossier; ticket completion does not execute distribution.
Dependencies: parent prerequisites and any approval identified above; execute in the parent's documented order.
Security/exclusions: No premium/payment/gating, invitations or household-management UI, quantity/expiry/barcode/recipes, analytics expansion, offline queue, other suite apps, custom application server, generic framework, architectural rewrite or whole-app redesign. No publication, hosted mutation, DNS/SMTP change or paid purchase is authorized by this issue.
Definition of done: independently reviewed output/evidence, exact commit or dated decision recorded; cleanup verified where fixtures are used.
References: parent PF-S3-T10; PF-IOS-001/PF-AUTH-001/PF-I18N-001/PF-DATA-001; T7/T8/T9; app.json and environment separation

