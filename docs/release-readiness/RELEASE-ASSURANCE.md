# PantryFlow release assurance — baseline 2026-11-24

**Status:** draft for independent review. No finding here has been reviewed, and nothing here changes a release criterion.

## 1. Scope

- **Evaluated commit:** `main` at `25499a6` (2026-11-24). No open pull requests.
- **Question:** which critical properties of the implemented product are shown to hold, by which evidence, and could that evidence have failed?
- **Method:** reading code, tests, workflows, records and Jira; public CI results; 34 deliberate breakages in a throwaway clone; one in-memory database replay. The database and Android suites were **not** run for this assessment.
- **Not used:** hosted project, local database stack, devices, `npm audit` (reassessment on hold by the owner), Jira writes.
- **Assessor independence:** limited. The assessor (Claude Code) also wrote pull requests #69 to #71 and earlier tests.
- **Not duplicated:** behavior lists are in the [coverage matrix](../testing/coverage-matrix.md), beta lines in the [beta entry checklist](2026-11-21-beta-entry-checklist.md), graded opinions in the [two quality assessments](../quality/).

**Implemented:** sign-up with email confirmation, sign-in, pantry (add, edit, delete, status, search), shopping list, low/out prompt, English and German. **Planned, not assessed as product claims:** password recovery, in-app deletion, stronger password rules, iOS, crash reporting, feedback, website, sharing, premium.

## 2. Evidence model

| Status | Meaning here |
|---|---|
| VERIFIED | Executed evidence for the stated scope, and at least one demonstration that the assertion fails when the property breaks |
| PARTIALLY VERIFIED | Executed evidence, but a stated part of the scope or the ability to fail is not shown |
| UNVERIFIED | No applicable executed evidence |
| FAILED | Shown not to hold, or the capability does not exist |

**Evidence sources:**

| ID | Source | Commit and environment | Result and limit |
|---|---|---|---|
| E1 | [CI run 45312958112](https://github.com/Micha0371/PantryFlow/actions/runs/45312958112) | `25499a6`, Linux, Node 26, local Supabase (PostgreSQL 17) | `fast`, `isolated`, `database`, `windows-tooling` passed; **`android` skipped**. Job logs are not publicly readable, so test counts are not confirmed from CI |
| E2 | [CI run 45200604295](https://github.com/Micha0371/PantryFlow/actions/runs/45200604295) (scheduled) | `501a792`, Android emulator API 35, test package, local stack | All jobs passed, including Android. `app`, `components`, `hooks`, `lib`, migrations, `app.json` and the lockfile are identical at `25499a6`; **the e2e harness is not** |
| E3 | Local run in a throwaway clone | `25499a6`, Windows, Node 26.10 | 526 Node tests and 18 component tests passed |
| E4 | Detection probes (section 5) | Clone of `25499a6`; Node, Jest and PGlite only | 23 of 33 countable breakages detected; survivors explained |
| E5 | Policy replay (section 5) | Migrations at `25499a6`, PGlite | Intact policies blocked every cross-user statement tried; five policy losses would go unnoticed |
| E6 | Earlier mutations: [M1–M7](../quality/2026-11-18-quality-assessment-baseline.md), [three by Codex](../quality/2026-11-18-codex-quality-assessment.md) | `ec0dbdd`, 2026-11-18 | All detected. M7 (shopping read policy) was caught by pgTAP on a local stack |
| E7 | [SEC-02 hosted catalog comparison](../testing/2026-11-21-sec02-hosted-drift-check.md) | Hosted, 2026-11-21, migrations 00001–00004 | Match. Structure only, no behavior. No migration has changed since |
| E8 | [Hosted behavior run](../H_Slice_1_1_Verification.md) | Hosted, 2026-11-08 | 13 groups passed, **before** the shopping table (00004) existed |
| E9 | [Hosted Auth read](../testing/2026-11-21-hosted-auth-read-fv-a1.md) and [support runbook](2026-11-21-interim-reset-deletion-runbook.md) | Hosted, 2026-11-21, owner-performed | Settings and one deletion rehearsal |
| E10 | Phone runs, coverage matrix [E2E-IND-01 to 07, LANG-PHONE-01](../testing/coverage-matrix.md) | `501a792`, `57ef1ab`, `89812e7`; one phone model, Android 16, local stack | Passed as recorded, with the recorded reruns |

Probe scripts and raw outputs: ignored folder `pantry-flow/.verification/assurance-20261124/` (`probes.py`, `probes.out`, `replay.cjs`, `replay.out`, `combo.py`). The results for combined removals (F2, F4) come from a run of `combo.py` whose output file was not kept.

## 3. Critical claims

"Detects" names a breakage that made a test fail. IDs S, D, F and A refer to `probes.out`.

### Functional correctness

| Claim | Status | Evidence and detection | Limits and unknowns |
|---|---|---|---|
| **FC-1** Pantry and shopping actions persist what the screen shows | **VERIFIED**: local stack, Android emulator | E1, E2 with database read-back after each journey. Detects: double submit (F5), zero-row delete (D6) | App code unchanged since E2. Not shown on hosted or in a release-signed build |
| **FC-2** A late response never replaces newer state or navigates an abandoned screen | **VERIFIED**: component level | E3: `pantry-state`, `shopping-state`, `mutation` tests. Detects F1, F3, F6 | Network interruption on a real device is untested (OR-3) |
| **FC-3** A failed action is reported truthfully | **FAILED** for sign-in; **PARTIALLY VERIFIED** otherwise | Sign-in shows "wrong password" for every failure (`app/(auth)/login.tsx:42`), reproduced on a phone (KAN-122). Status change with a lost response: E1 `pantry-status.integration`, detects D5. Failed sign-out: detects F7 | Add, edit and delete have no "unknown outcome" path. By reading the code, a lost response reports failure for a committed write, and retrying an add then reports a duplicate. No test covers this |
| **FC-4** English and German are complete | **PARTIALLY VERIFIED** | Catalogue parity detects F9; LANG-PHONE-01 (E10) | Layout, text expansion and font scaling: KAN-62 |

### Data integrity

| Claim | Status | Evidence and detection | Limits and unknowns |
|---|---|---|---|
| **DI-1** No duplicate names within a household, also under concurrent writes | **VERIFIED**: PostgreSQL 17 | E1: pgTAP, API tests; E3: `database.test.cjs`. Detects D1 | Overlap inside PostgreSQL is not forced; the unique index is the authority |
| **DI-2** A status change never overwrites a concurrent rename | **VERIFIED**: status path only | E1 `pantry-status.integration`; detects D4 | The edit form writes the whole row. Last write wins is the accepted requirement (PRD, conflict rule) |
| **DI-3** A list is never silently truncated and a zero-row write is never a success | **VERIFIED**: unit level | E3; detects D6, D7, D8 | Rows shifting between pages during a concurrent delete are untested |
| **DI-4** Migrations preserve existing data | **PARTIALLY VERIFIED** | 00004 upgrade on PGlite, and once on local PostgreSQL 17 with one existing item (2026-11-11) | Representative populated upgrade and rollback: PF-DATA-001, KAN-67 |
| **DI-5** User data can be recovered after loss | **FAILED** | E9: no backups, no point-in-time recovery; no restore rehearsal exists | Owner accepted and discloses this for the beta (2026-11-21). That is risk acceptance, not verification |

### Security and privacy

| Claim | Status | Evidence and detection | Limits and unknowns |
|---|---|---|---|
| **SP-1** A user cannot read another household's data | **VERIFIED**: local | E1; detects S1 in PGlite and the shopping policy in pgTAP (E6); E5 shows the pgTAP shapes notice all four read-policy losses tested | Only S1 was run against a whole suite in this assessment |
| **SP-2** A user cannot change or delete another household's data | **PARTIALLY VERIFIED** | Holds in E1, E2 and E5, including bare writes. Insert policies: E5 shows the pgTAP shape notices their loss | **Loss of five UPDATE or DELETE policies would go unnoticed** (section 5). The Node and API foreign-insert tests pass for the wrong reason: the read policy raises the same error |
| **SP-3** Users cannot forge authorship or grant themselves premium | **VERIFIED**: local | E1, E3; detects S4, S6, S7 | Existing hosted premium values unaudited (PF-PREMIUM-001) |
| **SP-4** Signed-out users reach no protected screen, and a confirmation link cannot replace a session | **VERIFIED**: component level | E3; detects S11, S13, S14 | The client's PKCE setting itself is asserted by no Node or component test (S12). The confirmation journey should notice; not demonstrated |
| **SP-5** A previous user's data is never shown to the next | **PARTIALLY VERIFIED** | Redundant protections; a household change with both the row filter and the clearing removed is detected. Journey with two users: E2 | No test fails when the per-user provider reset is removed (F4; household and shopping providers alike). The other layers still protect |
| **SP-6** The hosted project enforces what the local tests show | **PARTIALLY VERIFIED** | E7 structure; E8 behavior of the pantry tables | No recorded behavior check of the hosted shopping table; `verify-hosted.cjs` has none |
| **SP-7** Sign-up with confirmation works on hosted today | **UNVERIFIED** | Passed 2026-11-09/10; magic links and email OTP were disabled on 2026-11-21 | FV-A1 asks for this check with the first beta build (B10). Site URL is still `localhost` |
| **SP-8** A deletion request removes all of a user's data | **PARTIALLY VERIFIED** | E9 rehearsal; cascades in pgTAP; detects D3 (author deletion) | The rehearsed account had **0 pantry and 0 shopping items**. The closing confirmation to the requester is not recorded. Runbook step 4 tells requesters that backups keep their data; E9 says there are none |
| **SP-9** Session data on the phone is protected appropriately | **UNVERIFIED** | Stored in AsyncStorage; the generated test manifest has `allowBackup="true"` and `app.json` does not set it | Whether a release build lets device backups include the session is unknown. KAN-117 |
| **SP-10** Shipped dependencies carry no unaccepted exposure | **UNVERIFIED** at this lockfile | Register assessed 2026-11-18; lockfile changed 2026-11-22/23 | B6: reassessment due |

### Test integrity

| Claim | Status | Evidence and detection | Limits and unknowns |
|---|---|---|---|
| **TI-1** The gates run the tests they claim to run | **VERIFIED** from `080ad3b` (#70) | Empty runs fail; 20 deliberate breakages detected while building #70 | **Before #70** an empty component run passed. Earlier CI runs cannot be shown to have run those tests, though no reason is known why Linux CI would have skipped them |
| **TI-2** Tests are independent of each other | **VERIFIED** for Node tests; **PARTIALLY VERIFIED** otherwise | E1 `isolated`; 516 tests alone locally at #70; static rules shown against real history | Integration tests use own accounts and random order but are not run alone; pgTAP and components likewise |
| **TI-3** The Android harness at this commit works | **UNVERIFIED** | E10 ran `57ef1ab` (full) and two flows at `89812e7` | Five harness files changed after `89812e7`; the current harness has not been executed. The project's own rule, "accepted only after fast, database and Android jobs pass for its exact commit" ([testing README](../testing/README.md)), was not met by #66, #67 and #70 |
| **TI-4** A hanging test fails quickly | **FAILED** as of the last test of it | M4 hung without a limit (E6); no timeout is configured (KAN-107) | CI job limits bound the delay |

### Operational reliability

| Claim | Status | Evidence | Limits and unknowns |
|---|---|---|---|
| **OR-1** Defects on tester devices become visible | **FAILED** (capability absent) | No crash reporting (KAN-104, B2) | Relies on testers writing in |
| **OR-2** A release artifact with known signer and hash exists and works | **UNVERIFIED** | None exists; only a debug-signed test package | KAN-77, KAN-116; the antivirus warning has no disposition |
| **OR-3** The app recovers from real network loss, backgrounding and session expiry | **UNVERIFIED** | Proxy faults and a short background check only | KAN-118 |
| **OR-4** Locked-out testers can be helped | **PARTIALLY VERIFIED** | Requester verification by mail was rehearsed (E9) | Re-registration was not (B3) |
| **OR-5** `main` cannot take unchecked changes | **PARTIALLY VERIFIED** | Observed 2026-11-24: GitHub refused to merge #70 until three required checks passed on the updated branch | Rule details are not publicly readable. Android is not required (KAN-108) |

### Usability and accessibility

| Claim | Status | Evidence and detection | Limits and unknowns |
|---|---|---|---|
| **UA-1** Errors are announced and choices readable by TalkBack | **PARTIALLY VERIFIED** | Detects A1 (chip state) and A3 (error announcement); owner TalkBack checks (E10) | **FAILED parts:** Edit Item status pills have no role or state; category and location groups are unnamed; the shopping add field has only a placeholder. Losing a pantry row's button role is not detected (A2) |
| **UA-2** Ordinary users complete everyday tasks unaided | **UNVERIFIED** | No external user study (KAN-98, KAN-99) | Owner checks only |
| **UA-3** German is usable at larger font sizes | **UNVERIFIED** | None | KAN-62 |

## 4. Verification infrastructure and KAN-121

| State | Items |
|---|---|
| **Fixed and on `main`** | KAN-121 independence work (#61 to #64, #66, #67) and its follow-up #68; empty-run gates, test inventory and skip rule (#70) |
| **Completed but on a branch** | None for test integrity. Unmerged branches hold older material: `pantryflow/ux-06-form-consistency-plan` (one docs commit), `archive/pre-slice-1.1-main`, `origin/pantryflow/kan-11-household-scope` |
| **Pending CI verification** | None of the jobs that run on `main`. **Android for the current harness** (TI-3); next scheduled run Monday 2026-11-30 |
| **Known and unresolved** | Write-policy assertions (SP-2); timeouts (KAN-107); Android not required for app changes (KAN-108); Ctrl+C lock release and simultaneous lock takeover never exercised (E2E-IND-04); skips in Jira Python tests and pgTAP not seen by the skip rule |

KAN-121 is Fertig in Jira. That status does not cover TI-3.

## 5. What the probes showed

**Breakages:** 34 single changes. D2 also removed the unique index, so it is not counted. Of the 33 others, 23 made a test fail. The count describes this sample only; it is not a coverage estimate.

| Survivor | Reading |
|---|---|
| S2, S3: pantry UPDATE or DELETE policy open | **Real blind spot**, see below |
| S5, S8, S9, S10: pantry insert, profile, household and shopping read policies | Not noticed by the Node suite. E5 shows the pgTAP statement shapes notice them (E6 ran S10) |
| S12: PKCE setting | Not asserted in Node or component tests |
| F2: row filter removed | Redundant with clearing on change; removing both is detected |
| F4: per-user reset removed | No dedicated test; other layers protect |
| A2: pantry row role removed | Not asserted |

**Write policies.** PostgreSQL also applies the read policy to any UPDATE or DELETE that has a `WHERE` on columns or a `RETURNING` of columns. Every isolation assertion in pgTAP and the API tests has one or the other, so the read policy hides the loss of the write policy. With each policy opened in turn, only a bare write noticed: pantry UPDATE and DELETE, shopping UPDATE and DELETE, profile UPDATE.

- **The policies are correct today:** with them intact, bare writes changed 0 foreign rows.
- **Not shown:** this was replayed in PGlite with the tests' statement shapes. The pgTAP and API suites themselves were not run against broken policies. Whether a bare write can reach the hosted database through the API is unknown.

## 6. Release-readiness recommendation

| Stage | Recommendation | Main reasons |
|---|---|---|
| Development | **Continue** | Core behavior and integrity claims hold with detecting tests |
| Supervised Android beta | **NO-GO** (unchanged) | Open checklist lines; SP-7 and OR-2 unverified; SP-8 weaker than its "met" line; TI-3 |
| Public release | **NO-GO** (unchanged) | Also recovery, in-app deletion, DI-5, SP-9, OR-1, OR-3, accessibility, iOS |

### Provisional gates

Established criteria stay as they are. Items marked **(proposed)** need owner approval.

| Gate | Factual verification | Owner risk acceptance |
|---|---|---|
| **Development merge** | Required checks green on the updated branch; for harness changes, the Android job on the exact commit (existing rule) | A named exception to the Android rule, recorded per change **(proposed)** |
| **Limited beta** | BETA-01 lines B1 to B12. **(Proposed)** clarifications: B4 evidence includes an account with items and the closing confirmation; B10 evidence includes hosted sign-up, and shopping isolation between two accounts | Only lines marked waivable. Already accepted: no backups, possible pauses |
| **Public release** | Existing gates in the [production follow-ups](../testing/production-follow-ups.md) and Slice 3 records (KAN-42, 43, 67, 75, 76, 78, 79, 117) | Residual items, each with owner, reason and date. **(Proposed)** no acceptance for a FAILED security or privacy claim |

## 7. Next actions

Ordered by potential production impact. They gather evidence or decisions; implementation proposals wait for the review.

1. **Produce the release-signed beta build and check it against hosted** (KAN-77; SP-7, OR-2, OR-4, B3, B10). If hosted sign-up broke on 2026-11-21, no tester can start, and nothing would show it.
2. **Confirm the write-policy finding independently, and check shopping isolation on hosted** (SP-2, SP-6). Household isolation is the most damaging property to lose, and five of its policies have no test that can fail.
3. **Run the full Android workflow on `main`** (TI-3). It is the only evidence for real-device behavior; its harness has not run in its current form, and the project's own rule is unmet. Starting it is the owner's decision.
4. **Repeat the deletion rehearsal with real items, and correct the backup statement** (SP-8, B4). It is a privacy commitment to testers, and the line is marked met on an account that held no items.
5. **Reassess dependencies, and record the open risk acceptances** (SP-10/B6, DI-5, OR-1/B2, hosted minimum password length 6 against the approved 15, SP-9). Each is now open or accepted without one dated place that says which.

## 8. Review checkpoint

Suggested attempts to refute this assessment:
- Run `replay.cjs`, then open one UPDATE policy on a disposable local stack and run `supabase test db` and the integration tests. Any failure refutes the SP-2 finding.
- Check E2's claim: `git diff 501a792 25499a6 -- pantry-flow/app pantry-flow/components pantry-flow/hooks pantry-flow/lib pantry-flow/supabase/migrations pantry-flow/app.json pantry-flow/package-lock.json` must be empty.
- Check TI-3: `git diff 89812e7 25499a6 -- pantry-flow/scripts pantry-flow/.maestro`.
- Compare SP-8 with the rehearsal record and step 4 of the runbook.
- Look for hosted shopping evidence after 2026-11-11 that this assessment missed.
