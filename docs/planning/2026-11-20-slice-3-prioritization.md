# Slice 3 prioritization — draft for owner review

**Status:** draft, 2026-11-20. Nothing in Jira has been changed. After approval, the labels and closures are applied through the Jira CLI with a preview first.

**Inputs:**
- the owner's phase order of 2026-11-18 (3.1 baseline … 3.8 final assessment; usability outranks engineering polish);
- the [Slice 3 decision record](2026-11-19-slice-3-decision-record.md), especially S3-Q7: the supervised, invited **Android** beta follows BETA-01 and English/German, waits for neither Slice 3 acceptance nor iOS, and allows **interim** recovery and deletion support paths if they are secure, documented and operational;
- a Jira snapshot of 2026-11-20: 76 issues labelled `slice-3`, 6 done, **70 open**.

The mapping below is based on each issue's summary, labels and parent, plus the decision record. Issue descriptions were not re-read for this draft.

## 1. Is the backlog disproportionate?

Partly, yes; but the raw count overstates it.

| Kind | Open | Issues |
|---|---|---|
| Containers (epic and parent tasks) | 15 | KAN-40 (epic); KAN-41–50, KAN-80, KAN-87–89 (tasks) |
| Product and usability | 11 | UX-03–08 (KAN-93–99), language selection (61), feedback (73), website (71), public content and deletion request path (72) |
| Account features required for launch | 9 | password recovery (54–56), password rules (81–83), deletion (57–59) |
| Localization and accessibility | 6 | KAN-60, 62, 63, 64, 100, 101 |
| Platform and release (Android, iOS, beta) | 11 | iOS (68–70), beta and release (77–79, 106, 116), regression and acceptance (74–76) |
| Security and operations | 6 | KAN-65, 66, 67, 103 (SEC-02), 104 (OPS-01), 117 (SEC-06) |
| Engineering process and test infrastructure | 12 | KAN-51, 53, 105, 107–114, 118 |

So of 55 actual work items, about **18 are hardening, process or test infrastructure**. The rest are product work, or launch obligations that any store release needs: account deletion (in-app, plus a web path), password recovery, privacy disclosures, two languages and platform qualification. The count is inflated by:
- **the hierarchy:** 15 containers;
- **approve/implement/verify triplets:** for example 57–59 and 81–83.

The concern is valid in two places:
- **Process tickets:** several duplicate work already done or add process without product value (section 3, tier D).
- **Design depth:** the account-lifecycle design for a pre-beta app took eleven spec versions and three local feasibility rounds. The rigor was justified by the destructive operation, but future designs of this size should stop at the first review that finds no High issue, unless the owner asks for more.

## 2. Priority tiers

Each tier maps to one label, replacing the mixed `p1`–`p3` labels:

| Tier | Label | Meaning |
|---|---|---|
| A | `p0` | **Blocks the supervised Android beta** (S3-Q7) |
| B | `p1` | Needed for Slice 3 acceptance or before a public release |
| C | `p2` | Should do in Slice 3 if capacity allows; never blocks a gate |
| D | `p3` / close | Close as done or duplicate, merge, or defer beyond Slice 3 |

## 3. Proposed mapping (open leaf issues)

### Tier A — beta gate (`p0`), in order

| # | Issue | Phase | Why A | Dependency or note |
|---|---|---|---|---|
| 1 | KAN-106 BETA-01: beta entry checklist | 3.7 | Named by S3-Q7 as the beta entry condition | Define early, so every A item has a checkable criterion; it should also record the interim recovery and deletion support paths |
| 2 | KAN-60 English/German catalogue | 3.4 | S3-Q7: beta after EN/DE | German strings must not grow (owner rule) |
| 3 | KAN-61 language selection and preference | 3.4 | EN/DE completion | Language and regional formatting stay separate (decision record §2) |
| 4 | KAN-62 bilingual layout, font scaling | 3.4 | EN/DE completion | After 60/61 |
| 5 | KAN-103 SEC-02: hosted baseline re-verify, read-only | 3.5 | Labelled "before beta" | Needs a separate hosted-read authorization |
| 6 | KAN-77 Android beta artifact prerequisites | 3.6 | Testers need an installable artifact | — |
| 7 | KAN-116 DIST-01: APK antivirus warning | 3.6 | The owner's own AVG flags the test APK; testers will hit it | — |

### Tier B — Slice 3 acceptance and before public release (`p1`), by phase

| Phase | Issues, in order | Note |
|---|---|---|
| 3.2 usability | KAN-96 UX-06 (PR #53 open) → KAN-94 UX-04 → KAN-97 UX-07 → KAN-93 UX-03 | UX-03 evaluates ordering and status filters (decision record §2); kept in B because usability is the Slice 3 priority |
| 3.3 auth | KAN-54, 55, 56 password recovery → KAN-81, 82, 83 password rules | Beta may use the interim recovery path (S3-Q7). The policy rollout waits for the hosted Auth read (M2, owner-performed) |
| 3.3 deletion | KAN-57 design (local feasibility closed; remaining gates listed in the spec) → KAN-58 implement → KAN-59 verify | Beta may use the interim deletion path; full in-app deletion plus a web path are store requirements before public release |
| 3.4 accessibility | KAN-100 A11Y-01 → KAN-63 contract audit → KAN-64 TalkBack/VoiceOver acceptance | VoiceOver depends on D1 |
| 3.5 operations | KAN-104 OPS-01 (after the comparison note and owner confirmation) → KAN-65 → KAN-66 → KAN-67 | — |
| 3.5 website and feedback | KAN-71 → KAN-72 (includes the account-deletion request path) → KAN-73 | KAN-72 overlaps the store's web-deletion requirement |
| 3.6 Android qualification | KAN-74 → KAN-75 | — |
| 3.7 validation | KAN-98 UX-08A → KAN-99 UX-08B | External testers need separate owner authorization |
| 3.8 / release | KAN-76 acceptance record → KAN-78 public readiness → KAN-79 separate Android, iOS and public decisions | — |

### Tier C — should, never blocks a gate (`p2`)

| Issue | Why C |
|---|---|
| KAN-107 TEST-01: test timeouts | Cheap; prevents hung CI |
| KAN-108 TEST-02: Android E2E as a risk-based gate | Useful, but the owner already dispatches Android CI by hand |
| KAN-118 NATIVE-01: native lifecycle gaps | Partly covered by the account-lifecycle phone checks still to come |
| KAN-117 SEC-06: session-storage threat model | Read-mostly review |
| KAN-111 PERF-01: device performance baseline | No reported performance problem |
| KAN-112 ARCH-02: remove obsolete Emergent scaffolding | Small cleanup; architecture refinement is not a Slice 3 goal |
| KAN-105 ASSESS-01: independent Slice 3 assessment | The owner's phase 3.8; it scores the targets, so it stays, scoped to one pass |
| KAN-113 GOV-01: risk tiers and PR evidence format | Formalizes what PRs already do; keep it short |

### Tier D — close, merge or defer (`p3` / close)

| Issue | Proposal | Verify before closing |
|---|---|---|
| KAN-51 reconcile Slice 3 scope | **Close as done:** decision record (#48) and PRD Amendment 1 | That its acceptance criteria are met by those records |
| KAN-53 reassess carried findings | **Close as done** if the 2026-11-18 QA integration covered it | Its description against the QA dry-run plan |
| KAN-41 (parent) | Close once 51 and 53 are closed | — |
| KAN-114 GOV-02: review the tiered process | **Merge into GOV-01** as its last step, or close | — |
| KAN-110 TEST-03: reduce stub maps | **Close**; handle it in normal work when a test is touched | — |
| KAN-109 CI-01: Gradle download flake | **Close** unless it recurs; reopen with evidence | — |
| KAN-95 UX-05: bulk entry discovery | **Defer beyond Slice 3** (`deferred` label) | — |
| KAN-47, 68, 69, 70, 101 (iOS and VoiceOver) | **Owner decision D1** | — |

## 4. Owner decisions

- **D1 — iOS in Slice 3?** The beta is Android-only (S3-Q7). The owner has no Mac or iPhone; a rented Mac, GitHub macOS workflows and volunteer iPhone testers are possible (owner, 2026-11-20).
  - **Option a:** keep iOS in phase 3.6 as tier B, with no build route decided.
  - **Option b:** move KAN-47, 68–70 and 101 to a later slice, and record "Android only" in the Slice 3 acceptance.
  - **Option c (recommended):** keep iOS in Slice 3 as **tier B, outside the beta gate**, using three layers:
    1. a GitHub macOS workflow that builds for the iOS simulator and runs the Maestro flows. Free on standard runners for this public repository (to be checked on the billing page); every macOS dispatch still needs explicit owner approval.
    2. TestFlight with volunteer iPhone testers for real-device and VoiceOver checks (KAN-69, 70, 101, 64). Needs the Apple Developer Program ($99/year); device builds can be made in the cloud. External testers need separate owner authorization.
    3. a rented Mac only if a native failure can't be diagnosed from CI.
  - **PR #53:** the owner accepted the iOS risk for its merge on 2026-11-20; the check is tracked under KAN-69 for the first simulator or TestFlight run.
- **D2 — the tier D closures and merges** above.
- **D3 — label scheme:** replace `p1`–`p3` with the tier labels `p0`–`p3` on all open Slice 3 issues, and keep the Jira priority field unchanged (it carries no information today).
- **D4 — design-depth rule** from section 1: future designs stop at the first review without a High finding unless the owner asks for more.

## 5. Next packages after approval

1. Merge PR #53 (UX-06) once its conditions are met; then **UX-04**, whose plan is already merged.
2. **BETA-01**, so the beta gate becomes checkable.
3. **English/German localization:** KAN-60, then 61 and 62.
4. In parallel, the owner-side items: the hosted Auth dashboard values (M2) and the SEC-02 authorization.
