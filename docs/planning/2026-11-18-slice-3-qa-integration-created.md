# Slice 3 QA-integration — Jira changes applied and verified

Operation `PF-S3-QA-INTEGRATION-20261118`, approved by the owner on 2026-11-18. Applied with the secured CLI: one writer, each write previewed, then applied with exact `--apply`, then read back (parent, type, labels, priority, description). The journal is kept as ignored local evidence. No issue was deleted, re-parented or re-prioritized, and no native links were created (the CLI has none).

**Result: 28 issues created, 18 refined. Final read-back: all verified.**

Separately, on the owner's explicit approval: KAN-6 and KAN-52 were moved to Fertig, and the annotated tag `pantryflow/slice-2-baseline` → `ec0dbdd` was created and pushed.

## Key map and hierarchy

| Backlog ID | Key | Summary | Parent | Priority |
|---|---|---|---|---|
| PF-S3-T11 | [KAN-87](https://michaelwuerthner.atlassian.net/browse/KAN-87) | [Slice 3] Simplify everyday household workflows | KAN-40 | High |
| PF-S3-T11-S1 | [KAN-90](https://michaelwuerthner.atlassian.net/browse/KAN-90) | UX-01A: Design the direct pantry status change | KAN-87 | Medium |
| PF-S3-T11-S2 | [KAN-91](https://michaelwuerthner.atlassian.net/browse/KAN-91) | UX-01B: Implement the approved direct status change on the pantry list | KAN-87 | Medium |
| PF-S3-T11-S3 | [KAN-92](https://michaelwuerthner.atlassian.net/browse/KAN-92) | UX-02: Search the pantry list by name | KAN-87 | Medium |
| PF-S3-T11-S4 | [KAN-93](https://michaelwuerthner.atlassian.net/browse/KAN-93) | UX-03: Evaluate simple pantry ordering and status filtering | KAN-87 | Medium |
| PF-S3-T11-S5 | [KAN-94](https://michaelwuerthner.atlassian.net/browse/KAN-94) | UX-04: Faster pantry item creation (Return to save, continuous entry) | KAN-87 | Medium |
| PF-S3-T11-S6 | [KAN-95](https://michaelwuerthner.atlassian.net/browse/KAN-95) | UX-05: Discover whether bulk inventory entry is worth building | KAN-87 | Medium |
| PF-S3-T11-S7 | [KAN-96](https://michaelwuerthner.atlassian.net/browse/KAN-96) | UX-06: Review interaction consistency across Pantry and Shopping | KAN-87 | Medium |
| PF-S3-T11-S8 | [KAN-97](https://michaelwuerthner.atlassian.net/browse/KAN-97) | UX-07: Simplify the first-use experience and Settings | KAN-87 | Medium |
| PF-S3-T11-S9 | [KAN-98](https://michaelwuerthner.atlassian.net/browse/KAN-98) | UX-08A: Prepare the external usability study | KAN-87 | Medium |
| PF-S3-T11-S10 | [KAN-99](https://michaelwuerthner.atlassian.net/browse/KAN-99) | UX-08B: Run the usability study and triage findings | KAN-87 | Medium |
| PF-S3-T5-S3 | [KAN-100](https://michaelwuerthner.atlassian.net/browse/KAN-100) | A11Y-01: Expose selection chips and pantry rows to screen readers | KAN-45 | Medium |
| PF-S3-T7-S4 | [KAN-101](https://michaelwuerthner.atlassian.net/browse/KAN-101) | A11Y-02: Announce form and screen errors to VoiceOver on iOS | KAN-47 | Medium |
| PF-S3-T6-S4 | [KAN-102](https://michaelwuerthner.atlassian.net/browse/KAN-102) | SEC-01: Reassess the picomatch advisory and refresh the advisory register | KAN-46 | Medium |
| PF-S3-T6-S5 | [KAN-103](https://michaelwuerthner.atlassian.net/browse/KAN-103) | SEC-02: Re-verify the hosted database baseline read-only before beta | KAN-46 | Medium |
| PF-S3-T6-S6 | [KAN-104](https://michaelwuerthner.atlassian.net/browse/KAN-104) | OPS-01: Select and add privacy-conscious crash and error reporting | KAN-46 | Medium |
| PF-S3-T9-S4 | [KAN-105](https://michaelwuerthner.atlassian.net/browse/KAN-105) | QA-01: Run an independent Slice 3 quality assessment against the 2026-11-18 baseline | KAN-49 | Medium |
| PF-S3-T10-S4 | [KAN-106](https://michaelwuerthner.atlassian.net/browse/KAN-106) | BETA-01: Define and verify the external beta entry checklist | KAN-50 | Medium |
| PF-S3-T12 | [KAN-88](https://michaelwuerthner.atlassian.net/browse/KAN-88) | [Slice 3] Strengthen test infrastructure, CI and engineering hygiene | KAN-40 | Medium |
| PF-S3-T12-S1 | [KAN-107](https://michaelwuerthner.atlassian.net/browse/KAN-107) | TEST-01: Add timeouts so hanging regression tests fail fast | KAN-88 | Medium |
| PF-S3-T12-S2 | [KAN-108](https://michaelwuerthner.atlassian.net/browse/KAN-108) | TEST-02: Make Android E2E a risk-based gate for app changes | KAN-88 | Medium |
| PF-S3-T12-S3 | [KAN-109](https://michaelwuerthner.atlassian.net/browse/KAN-109) | CI-01: Investigate the Gradle plugin download flake | KAN-88 | Medium |
| PF-S3-T12-S4 | [KAN-110](https://michaelwuerthner.atlassian.net/browse/KAN-110) | TEST-03: Reduce repeated React Native stub maps in tests where it helps | KAN-88 | Medium |
| PF-S3-T12-S5 | [KAN-111](https://michaelwuerthner.atlassian.net/browse/KAN-111) | PERF-01: Measure a performance baseline on a real device | KAN-88 | Medium |
| PF-S3-T12-S6 | [KAN-112](https://michaelwuerthner.atlassian.net/browse/KAN-112) | ARCH-02: Remove the obsolete Emergent frontend and backend scaffolding | KAN-88 | Medium |
| PF-S3-T13 | [KAN-89](https://michaelwuerthner.atlassian.net/browse/KAN-89) | [Slice 3] Introduce risk-based engineering governance | KAN-40 | Medium |
| PF-S3-T13-S1 | [KAN-113](https://michaelwuerthner.atlassian.net/browse/KAN-113) | GOV-01: Document the risk tiers and verification-claim rules | KAN-89 | Medium |
| PF-S3-T13-S2 | [KAN-114](https://michaelwuerthner.atlassian.net/browse/KAN-114) | GOV-02: Review the tiered process after the first Slice 3 packages | KAN-89 | Medium |

Subtask priority is Jira's default (Medium); the planned P-level is in the `p1`/`p2`/`p3` label and the description.

## Refined existing issues

| Key | Summary |
|---|---|
| [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40) | [Slice 3] Usability, Product Refinement and Launch Readiness |
| [KAN-41](https://michaelwuerthner.atlassian.net/browse/KAN-41) | [Slice 3] Approve scope, baseline and carried-finding dispositions |
| [KAN-51](https://michaelwuerthner.atlassian.net/browse/KAN-51) | Reconcile Slice 3 scope and obtain product decisions |
| [KAN-52](https://michaelwuerthner.atlassian.net/browse/KAN-52) | Assemble the Slice 2 baseline acceptance record using existing closure issues |
| [KAN-49](https://michaelwuerthner.atlassian.net/browse/KAN-49) | [Slice 3] Extend regression coverage and record Slice 3 GO/NO-GO |
| [KAN-53](https://michaelwuerthner.atlassian.net/browse/KAN-53) | Reassess existing functional and tooling findings for release impact |
| [KAN-42](https://michaelwuerthner.atlassian.net/browse/KAN-42) | [Slice 3] Implement and qualify password recovery |
| [KAN-43](https://michaelwuerthner.atlassian.net/browse/KAN-43) | [Slice 3] Define and implement secure account deletion and retention |
| [KAN-45](https://michaelwuerthner.atlassian.net/browse/KAN-45) | [Slice 3] Qualify native accessibility using the existing remediation tickets |
| [KAN-63](https://michaelwuerthner.atlassian.net/browse/KAN-63) | Audit accessibility contracts and reconcile existing error fixes |
| [KAN-64](https://michaelwuerthner.atlassian.net/browse/KAN-64) | Record physical TalkBack and VoiceOver acceptance |
| [KAN-46](https://michaelwuerthner.atlassian.net/browse/KAN-46) | [Slice 3] Qualify security, migrations and operational recovery |
| [KAN-65](https://michaelwuerthner.atlassian.net/browse/KAN-65) | Review and test authorization, lifecycle and unused premium exposure |
| [KAN-66](https://michaelwuerthner.atlassian.net/browse/KAN-66) | Reassess dependencies, logging and sender operational risks |
| [KAN-67](https://michaelwuerthner.atlassian.net/browse/KAN-67) | Rehearse populated migrations and backup/recovery procedures |
| [KAN-50](https://michaelwuerthner.atlassian.net/browse/KAN-50) | [Slice 3] Prepare platform beta distribution and enforce the public-release gate |
| [KAN-72](https://michaelwuerthner.atlassian.net/browse/KAN-72) | Prepare approved public content and account-deletion request path |
| [KAN-74](https://michaelwuerthner.atlassian.net/browse/KAN-74) | Extend the living behavioral matrix and isolated fixture coverage |

Each refinement kept the existing description verbatim, appended a dated block, and added the label `qa-2026-11-18`.


The approved inputs, the [dry run](2026-11-18-slice-3-qa-integration-dry-run.md) and the [drafts JSON](2026-11-18-slice-3-qa-integration-drafts.json), stay frozen as approved. Their pre-creation status text ("DRY RUN") is historical; this record holds the outcome.
