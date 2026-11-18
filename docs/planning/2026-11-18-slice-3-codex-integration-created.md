# Slice 3 Codex-assessment integration — Jira changes applied and verified

Operation `PF-S3-CODEX-INTEGRATION-20261118`, approved by the owner on 2026-11-18 with the recommended decisions S3-C1 to S3-C7. Applied with the secured CLI: one writer, each write previewed, then applied with exact `--apply`, then read back (parent, type, labels, priority, description). The journal is kept as ignored local evidence. No issue was deleted, re-parented or re-prioritized, and no native links were created (the CLI has none).

**Result: 4 issues created, 13 refined. Final read-back: all verified.**

## Key map and hierarchy

| Backlog ID | Key | Summary | Parent | Priority |
|---|---|---|---|---|
| PF-S3-T14 | [KAN-115](https://michaelwuerthner.atlassian.net/browse/KAN-115) | [Slice 3] Recover from externally deleted pantry records | KAN-40 | High |
| PF-S3-T10-S5 | [KAN-116](https://michaelwuerthner.atlassian.net/browse/KAN-116) | DIST-01: Investigate the APK antivirus warning and qualify the distribution artifact | KAN-50 | Medium |
| PF-S3-T6-S7 | [KAN-117](https://michaelwuerthner.atlassian.net/browse/KAN-117) | SEC-06: Review the mobile session-storage threat model | KAN-46 | Medium |
| PF-S3-T9-S5 | [KAN-118](https://michaelwuerthner.atlassian.net/browse/KAN-118) | NATIVE-01: Close native lifecycle verification gaps | KAN-49 | Medium |

Subtask priority is Jira's default (Medium); the planned P-level is in the `p1`/`p2`/`p3` label and the description.

## Refined existing issues

| Key | Summary |
|---|---|
| [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40) | [Slice 3] Usability, Product Refinement and Launch Readiness |
| [KAN-102](https://michaelwuerthner.atlassian.net/browse/KAN-102) | SEC-01: Reassess the picomatch advisory and refresh the advisory register |
| [KAN-80](https://michaelwuerthner.atlassian.net/browse/KAN-80) | [Slice 3] Define and enforce stronger password rules |
| [KAN-67](https://michaelwuerthner.atlassian.net/browse/KAN-67) | Rehearse populated migrations and backup/recovery procedures |
| [KAN-77](https://michaelwuerthner.atlassian.net/browse/KAN-77) | Prepare Android beta artifact and distribution prerequisites |
| [KAN-106](https://michaelwuerthner.atlassian.net/browse/KAN-106) | BETA-01: Define and verify the external beta entry checklist |
| [KAN-113](https://michaelwuerthner.atlassian.net/browse/KAN-113) | GOV-01: Define risk tiers, PR evidence format and review requirements |
| [KAN-105](https://michaelwuerthner.atlassian.net/browse/KAN-105) | ASSESS-01: Run an independent Slice 3 quality assessment against both Slice 2 benchmarks |
| [KAN-100](https://michaelwuerthner.atlassian.net/browse/KAN-100) | A11Y-01: Expose selection chips and pantry rows to screen readers |
| [KAN-87](https://michaelwuerthner.atlassian.net/browse/KAN-87) | [Slice 3] Simplify everyday household workflows |
| [KAN-91](https://michaelwuerthner.atlassian.net/browse/KAN-91) | UX-01B: Implement the approved direct status change on the pantry list |
| [KAN-94](https://michaelwuerthner.atlassian.net/browse/KAN-94) | UX-04: Faster pantry item creation (Return to save, continuous entry) |
| [KAN-99](https://michaelwuerthner.atlassian.net/browse/KAN-99) | UX-08B: Run the usability study and triage findings |

Each refinement kept the existing description verbatim, appended a dated block, and added the label `qa-codex-2026-11-18`; KAN-113 and KAN-105 also got the approved new summaries.


The approved inputs, the [dry run](2026-11-18-slice-3-codex-integration-dry-run.md) and the [drafts JSON](2026-11-18-slice-3-codex-integration-drafts.json), stay frozen as approved. The drafts' status text ("DRY RUN") is historical; this record holds the outcome.
