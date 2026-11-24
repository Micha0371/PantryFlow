# Independent release assurance review

**Decision: beta remains NO-GO.** The write-isolation assertion gap is independently reproduced. Several VERIFIED labels exceed the scope of their detecting probes. The hosted signup, deletion, session-backup and release-artifact gaps remain material even if Android CI succeeds.

Reviewed 2026-11-24 against **`25499a656c1e419883d95b6e9ade8cd0fa4fc791`**. This is a separate review of [RELEASE-ASSURANCE.md](RELEASE-ASSURANCE.md), not an amendment or release approval. The assessment is an **untracked draft absent from that commit**; its SHA-256 at review was `cfe11b29fd27afcf6a97634ce459ab723a9a56c3cb99200e83aaa4cb2d1fc3f5`. Its original content was preserved. No product code, Jira state, hosted data or CI configuration was changed; no workflow was dispatched by this review.

The conclusions below come from fresh source inspection and reviewer-authored execution. Historical Codex and Claude mutation records are corroborating reports, not substitutes for this review's independent reproduction. Severity describes the release consequence; confidence describes the strength of the finding, not a probability of exploitation.

## Evidence available to this review

| Reference | Evidence and boundary |
|---|---|
| R1 | [Independent SQL probe](review-evidence-25499a6/independent-rls.cjs), [output](review-evidence-25499a6/independent-rls.out): reads migrations and database tests directly from the assessed Git object. Windows, Node 26.10.0, PGlite reporting PostgreSQL 17.5. Two users with populated pantry and shopping data; foreign state checked with an administrative read after each operation. No network. |
| R2 | Existing database tests executed from disposable committed-input copies: [intact](review-evidence-25499a6/database-intact.tap), [opened UPDATE](review-evidence-25499a6/database-items_update_member.tap), [opened DELETE](review-evidence-25499a6/database-items_delete_member.tap). All three: **10 passed, 0 failed, 0 skipped**. These are Node/PGlite tests, not pgTAP or PostgREST execution. |
| R3 | Fresh [Node baseline](review-evidence-25499a6/node-tests.log): **526 passed, 0 failed, 0 skipped**; [component baseline](review-evidence-25499a6/component-tests.log): **4 suites, 18 tests passed**. Tracked app/workflow inputs matched the assessed commit. Native React warnings are not test failures. No full fast-gate, isolated, pgTAP, integration or Android run was executed locally by this reviewer. |
| R4 | [Request-shape probe](review-evidence-25499a6/request-shapes.cjs), [output](review-evidence-25499a6/request-shapes.out): the installed Supabase client emits unfiltered PATCH/DELETE requests without representation preference. Fetch is replaced with a recorder; **no request reaches a server**. |
| R5 | [Observed CI summaries](review-evidence-25499a6/ci-observed.json). GitHub run and job metadata read independently. E1's four non-Android jobs succeeded; Android skipped. E2's Android job succeeded at `501a792`. Metadata alone does not establish individual test counts or assertions. |
| R6 | The ignored `pantry-flow/.verification/assurance-20261124/` folder **was present in this workspace**. Its `probes.py`, `probes.out`, `replay.cjs`, `replay.out`, and `combo.py` were inspected. They are author-supplied evidence outside Git, not immutable commit artifacts. `combo.py` output is absent. The full 34-probe campaign was **not rerun**; its reported outcomes are distinguished below from R1/R2. |

The sanitized evidence request remains relevant for portability: retain a commit-bound copy of the original scripts, mutation diffs, commands, full failure diagnostics and combined-probe output. Other ignored evidence cited by historical documents was not assumed available or authenticated. This review did not retrieve private CI logs or artifacts. Docker access was denied in this environment, so R1/R2 do not establish actual Supabase PostgreSQL/PostgREST mutant-suite outcomes.

Reproduce R1/R2 and R4 from the repository root after installing the assessed lockfile's dependencies:

```powershell
node docs/release-readiness/review-evidence-25499a6/independent-rls.cjs
node docs/release-readiness/review-evidence-25499a6/request-shapes.cjs
```

The first command writes only review evidence and disposable OS-temp test copies. Its migrations come from Git, not the draft assessment's replay script.

## Findings

### F01 Write isolation is not independently asserted

**High severity; high confidence. Claims SP-2 and SP-6; beta security evidence blocker.**

R1 confirms all five cases: `items_update_member`, `items_delete_member`, `shopping_update_member`, `shopping_delete_member`, `profiles_update_own`. With intact policies, bare writes affect only the actor's own fixture. Replacing each policy with an always-true policy allows the bare write to change/delete the other user's fixture. The same foreign-targeting write with `WHERE id=... RETURNING id` returns zero and leaves the foreign row unchanged in both configurations. The SELECT policy masks the weakened write policy. R2 additionally proves the **existing Node database suite stays green** for either opened pantry write policy.

This matches the statement shapes in [slice_1_1.test.sql](../../pantry-flow/supabase/tests/database/slice_1_1.test.sql), [shopping.test.sql](../../pantry-flow/supabase/tests/database/shopping.test.sql), and [behavior.integration.ts](../../pantry-flow/tests/integration/behavior.integration.ts). Shopping provider integration tests also use the caller's household filter, which can exclude a foreign row before RLS is challenged. Read-back of an untouched row after such a request does not isolate the write authorization control.

The insert blind spot is reproduced too: after removing the household restriction from either INSERT policy, a foreign-household insert without RETURNING succeeds; adding RETURNING fails with `42501` because the inserted row is unreadable. An expected RLS error from a representation-returning insert therefore does not establish that its INSERT policy rejected the row. pgTAP's inserts without RETURNING offer different evidence; they must not be conflated with the Node/API shapes.

Two corrections to the assessment are necessary:

- **Opening a policy is different from deleting it.** R1 also drops each write policy without replacement: writes fail closed, including bare writes. Describe this as loss of the ownership predicate or an overly permissive replacement/additional policy, rather than five missing policies allowing foreign writes.
- **API reachability must not be minimized because the app uses filters.** R4 shows that the client can form the dangerous unfiltered, non-returning requests. PostgREST documents minimal write responses and warns about full-table deletes; see [return preferences](https://docs.postgrest.org/en/v12/references/api/preferences.html) and [table writes](https://docs.postgrest.org/en/v12/references/api/tables_views.html). This supports a plausible API attack path if policies regress; actual deployed gateway behavior is still unverified. No current hosted exploit is asserted.

**Minimum before beta:** add independent write-policy checks on a disposable local Supabase stack, retaining intact success controls and owner read-back of foreign rows. Demonstrate that each of these five permissive mutants fails the appropriate checks. Exercise non-returning, unfiltered API writes locally, including foreign inserts without representation. Retain logs and mutation diffs. Do not weaken hosted policies or perform hosted full-table writes. Hosted shopping isolation needs a separately authorized, bounded test against disposable accounts, or remains unverified.

### F02 VERIFIED labels sometimes credit the wrong detector

**Medium severity; high confidence. Claims FC-1, DI-1, DI-2, DI-3, SP-4.**

The claim model requires an executed assertion that can fail for the stated property. A failed test somewhere in a changed build does not prove that for every linked claim:

- **FC-1:** F5 challenges the mutation lock; D6 challenges zero-row pantry deletion reporting. Neither breaks persistence or screen/database agreement. E2's read-back functions are meaningful evidence for the journey's final state, but not a read after every screen action. Keep that local/debug/journey scope explicit and demonstrate a lost/no-op persistence write is detected before using this detector pair to call persistence VERIFIED.
- **DI-1:** D1 removes the **pantry** unique index. It does not challenge the shopping partial unique index or true PostgreSQL transaction overlap. Completed shopping names are deliberately allowed to repeat. Narrow the claim to pantry names and **open** shopping names, with separate supporting assertions. A unique index is strong implementation evidence; PGlite Promise concurrency is not demonstrated concurrent PostgreSQL transactions.
- **DI-2:** D4 removes `.eq('status', prev)`. The update payload remains `{ status: next }`, so a concurrent rename is still preserved. D4 demonstrates stale-status/CAS detection, not detection of name clobbering. The integration test `a concurrent rename survives a status write` is relevant positive execution evidence, but the stated failability for this exact property is not demonstrated. Under the assessment's own definition: **PARTIALLY VERIFIED**, or supply a mutation that writes a stale name and makes that assertion fail.
- **DI-3:** D6 and D8 challenge pantry delete and profile-language save, not every zero-row write. D7 challenges a short page when a count says more rows remain, not snapshot consistency under concurrent changes. Use those exact scopes; do not retain the universal wording.
- **SP-4:** S11 tests AuthGate behavior; S13 and S14 test already-signed-in callbacks and error-link parsing. This is useful component-level evidence. It does not verify the actual Supabase client's PKCE configuration, secure storage or hosted confirmation journey. S12 survived; keep the broader session-link claim qualified.

**Minimum before beta:** correct the claim-to-assertion mapping and narrow or downgrade these VERIFIED labels. For properties relied on as mandatory gates, retain a relevant failing mutant in the same environment as the claimed evidence. No release decision should treat 23 detections as coverage of all critical claims.

### F03 The probe campaign supports narrower conclusions than its headline

**Medium severity; high confidence in script inspection and arithmetic; medium confidence in unreproduced historical outcomes. Claims E3/E4/E5, FC-2, SP-5, UA-1.**

The output contains **34 attempted mutants, 24 reported detections including compound D2, and 10 survivors**. Excluding D2 yields the stated **23/33**. Every Jest invocation reported exit 0; all reported detections are in Node. The campaign does not supply new Android, integration, hosted or pgTAP mutation execution.

The driver labels any nonzero suite exit as DETECTED. Its output retains selected failing names and counts rather than full assertion diagnostics or applied mutation diffs. Setup, parsing or tooling failures could otherwise be mistaken for property detection. The listed names generally make sense, but cannot independently authenticate every failure reason. `combo.py` has no retained output; its no-output claims remain **UNVERIFIED by execution** in this review. Source inspection establishes that filter, effect clearing and provider keys coexist; it does not prove all combinations or the pre-effect render interval are safe.

**Minimum before beta:** publish sanitized, portable scripts and full assertion failures for security/gate claims; capture combined-run output or remove that execution claim. Distinguish static accessibility props, mocked announcement calls and actual TalkBack speech. A3's missing alert-role detector does not demonstrate a lost Android announcement, as the repository's own error-announcement test explains.

### F04 Android evidence must match the exact harness commit

**Medium severity; high confidence in historical mismatch. Claims E2, TI-3, section 4 and next action 3.**

The assessment's product-code equivalence check is correct: `git diff 501a792 25499a6` over the named app, component, hook, library, migration, app.json and lockfile paths is empty. E2 is useful historical debug-emulator evidence for unchanged app code. It cannot prove that the changed harness works.

Relative to `89812e7`, five runtime harness files changed: `e2e-fixtures.ts`, `e2e-flows.cjs`, `e2e-lock.cjs`, `e2e-logcat.cjs`, `run-e2e.cjs` (ten scripts total including test tooling). The [testing rule](../testing/README.md) requires fast, database and Android jobs to pass for the exact commit. E1 skipped Android; the phone runs at `57ef1ab` and `89812e7` do not satisfy it for `25499a6`.

A newer [manual workflow 45374918480](https://github.com/Micha0371/PantryFlow/actions/runs/45374918480) was discovered on the **exact assessed SHA**, started 2026-11-24 at 10:27:09 UTC. At the [final observation](review-evidence-25499a6/ci-final-observation.json), **11:36:15 Berlin time**, fast, database, isolated and windows-tooling had succeeded; Android was **still building**, and its emulator-test step was pending. **It had not yet closed TI-3.** Do not count queued, running, skipped or merely overall-green runs as Android passes.

**Minimum before beta:** retain a final successful Android job plus successful fast/database jobs on this SHA (or the eventual beta source SHA), identifying the emulator test step and flow/verification evidence. Such a result closes the harness-execution gap for that local-stack debug environment. It does **not** retroactively satisfy earlier merge gates, prove live lock races/Ctrl+C, or close hosted signup, release signing or real-network recovery.

### F05 Hosted signup remains unverified after the setting change

**High severity for beta availability; high confidence. Claims SP-7, OR-2, OR-4; B3/B10.**

Agree with SP-7 **UNVERIFIED**. The [hosted Auth read and owner follow-up](../testing/2026-11-21-hosted-auth-read-fv-a1.md) explicitly require confirmation testing after magic links and email OTP were disabled. Earlier successful signup, local-stack confirmation and a catalog match cannot establish today's hosted email/link behavior. `localhost` as Site URL adds a real fallback/configuration risk, but does not itself prove the explicit mobile redirect is broken.

**Minimum before beta:** on the signed hosted-configured beta artifact, record fresh registration, actual delivered confirmation link, native callback, established session, signout/signin and same-address re-registration for interim recovery. Include build hash, commit, date and sanitized results; verify the actual release scheme/redirect. This needs authorized disposable hosted accounts, not destructive hosted testing. It was not performed by this review.

### F06 Deletion is overstated beyond application cascades

**High severity; high confidence in the evidence gap; medium confidence in its hosted Auth-retention extent. Claims SP-8; B4.**

The [runbook rehearsal](2026-11-21-interim-reset-deletion-runbook.md) had **0 pantry and 0 shopping items** before deletion. It establishes disappearance of the account/profile/household/membership fixture, not deletion of populated inventory. Closing confirmation and same-address re-registration are not recorded. B4's "Met" and the runbook's broad cascade conclusion are too strong for this rehearsal. D3 detects preservation of another household's item on author deletion, not removal of the deleted owner's inventory.

There is a further boundary the assessment misses: [FV-B3](../testing/2026-11-19-account-lifecycle-feasibility.md) records a PKCE `auth.flow_state` row surviving hard deletion because it has no FK; [the deletion specification](../planning/2026-11-19-account-deletion-spec.md) acknowledges that retention problem. This is local feasibility evidence, not proof of current hosted residue, but it directly defeats treating public-table cascades as verification of **all user data**. Provider logs, mail and support records also have retention outside those cascades. The [privacy draft](2026-11-21-beta-privacy-notice-draft.md) says both "deleted data is gone immediately" and "all its data" while also describing logs kept about a day.

**Minimum before beta:** reopen B4's evidence gap in the release decision; rehearse the authorized support path with populated pantry/shopping rows, preserve before/after counts and closing confirmation, and scope the privacy promise accurately. Document known Auth/log/support retention and its expiry; investigate the hosted flow-state boundary with authorized, sanitized evidence. Do not imply that implementing the entire planned self-service deletion feature is already mandatory for this supervised beta: an accurately scoped, genuinely operational interim path is the existing gate.

### F07 Server recovery and device session backups are separate risks

**High severity for session exposure; medium severity for accepted beta data-loss risk. High confidence in configuration gap; release-artifact exposure unverified. Claims DI-5 and SP-9.**

Agree with DI-5 **FAILED** as a demonstrated recovery capability: no restore rehearsal or operational recovery path is recorded. The hosted read reports no managed backups/PITR, and the owner accepted and disclosed possible loss. That decision does not make recovery verified. Nor does "no managed database backups" prove absence of every export, provider log or phone backup.

Runbook step 4 promises backup retention despite the no-backup plan. Conversely, the privacy draft infers immediate disappearance from the absence of server backups. Both require correction consistent with F06.

[lib/supabase.ts](../../pantry-flow/lib/supabase.ts) persists the session in AsyncStorage; [app.json](../../pantry-flow/app.json) does not explicitly control Android backup. The draft reports `allowBackup=true` in a generated test manifest, but that ignored manifest was not independently authenticated here. **UNVERIFIED is correct for actual release backup exposure**, not a finding that tokens have already leaked. Deferring the investigation solely to public release incorrectly minimizes a privacy risk to beta credentials.

**Minimum before beta:** inspect the merged manifest and data-extraction/backup rules of the actual signed artifact and demonstrate that session material is excluded or appropriately protected. Record the security disposition before distribution. Keep server-backup risk acceptance separate, dated and disclosed; align the runbook and notice. A restore rehearsal is required before claiming recovery, but the existing supervised-beta policy can explicitly accept absent recovery.

### F08 Test integrity labels need runner and timeout boundaries

**Medium severity; high confidence. Claims TI-1, TI-2, TI-4.**

The new inventory, empty-run checks and assertion tests are substantial improvements. They establish specific protections; they do not prove every gate executes every intended test on every platform. Inventory checks file selection/declaration, not complete runtime assertion execution. The skip-rule gaps for pgTAP/Python remain acknowledged. Android being skipped must remain distinct from tests being absent.

`run-tests-alone.cjs` runs **top-level** named Node tests/suites alone; nested subtests/describe contents remain together. TI-2 can say the top-level Node cases passed independently, not that every possible test-order dependency is absent. Static rules supplement that result rather than prove independence.

TI-4's "no timeout is configured" is overbroad: [jest.config.cjs](../../pantry-flow/jest.config.cjs) sets `testTimeout: 30000`; workflows have job limits. The real unresolved gap is Node/integration per-test hang control and demonstrated process termination. The assessment's probe command itself adds `--test-timeout=60000`, which normal `npm test` does not add. That probe environment is different from the ordinary gate.

**Minimum before beta:** scope TI-1/TI-2 to the demonstrated runner guarantees and correct TI-4. Retain a bounded deliberate-hang check for any gate whose prompt failure is a release requirement. Do not reinterpret this documentation correction as a product change made by this review.

## What each of the 34 probes supports

Results below are the **author's reported Node/Jest campaign**, except S2/S3 are independently corroborated by R2. D = reported detected; S = reported survived. All Jest runs returned zero. The table evaluates the mutant actually applied, rather than its descriptive label.

| ID | Result | Supported conclusion and limit |
|---|---|---|
| S1 | D | Node assertion detects opened pantry SELECT policy on an existing foreign row; not all table read policies. |
| S2 | S; reproduced | Open pantry UPDATE predicate survives existing Node DB tests. Bare foreign modification reproduced in R1. |
| S3 | S; reproduced | Open pantry DELETE predicate survives existing Node DB tests. Bare foreign deletion reproduced in R1. |
| S4 | D | Pantry INSERT creator equality is challenged, with valid own-household setup; not shopping attribution. |
| S5 | S | INSERT household predicate loss masked by RETURNING/SELECT in Node. Bare insert vulnerability under this mutant reproduced in R1; pgTAP-shaped detection is not a mutant pgTAP-suite run. |
| S6 | D | Users gaining UPDATE privilege on `is_premium` is detected; no audit of existing hosted premium values. |
| S7 | D | Pantry creator-column UPDATE privilege regression detected; not all table identity columns. |
| S8 | S | No Node detection of opened profile SELECT; replay count shapes show sensitivity, not actual pgTAP mutant execution. |
| S9 | S | Same limitation for household SELECT; does not test membership SELECT loss. |
| S10 | S | Node misses opened shopping SELECT. Historical E6 is a separate reported pgTAP detection at another commit. |
| S11 | D | AuthGate mounts no protected children for the tested signed-out/restoration states; not server authorization. |
| S12 | S | PKCE-to-implicit configuration regression unasserted by these Node/component runs. Native confirmation is separate evidence. |
| S13 | D | Existing-session confirmation callback guard detected in a stubbed Auth environment. |
| S14 | D | Error-bearing confirmation URLs rejected before exchange; not the whole redirect/session threat model. |
| D1 | D | Pantry unique-index removal detected; not shopping's open-name index or forced SQL concurrency. |
| D2 | D; excluded | Alters both legacy duplicate guard and unique index. No isolated conclusion about either control. Excluding it from 23/33 is correct. |
| D3 | D | Pantry author deletion must preserve another household's item and null attribution. Does not verify a populated account-deletion runbook. |
| D4 | D | Removing cached-status CAS filter detected. Rename remains safe because payload is still status-only. |
| D5 | D | Uncoded status-write failures must become unknown outcomes. Does not cover add/edit/delete lost responses. |
| D6 | D | Zero-row pantry delete must reject in the provider; not every mutation or Android persistence. |
| D7 | D | Short page with outstanding count must error; not a stable snapshot across concurrent page changes. |
| D8 | D | Zero-row language save must reject; not all profile writes. |
| F1 | D | Current-scope guard on asynchronous list results is exercised for tested races. Shared implementation gives useful pantry/shopping evidence, within hook tests. |
| F2 | S | Row filter removal alone undetected. Redundancy is plausible; combined detection is unverified without retained combo output. No proof of synchronous pre-effect privacy from this result. |
| F3 | D | Removing generation checks detects stale-read application in tested interleavings; not every device lifecycle race. |
| F4 | S | Pantry provider key removal undetected. Single probe does not remove household/shopping keys; separate combo script output absent. |
| F5 | D | Immediate submit lock matters in hook/screen tests; not a persistence detector. |
| F6 | D | Unconditional completion callback after abandonment detected in tested screen/hook interleavings. |
| F7 | D | Signout errors propagate and identity stays in the stubbed Auth test; does not model server logout commit followed by lost response. |
| F8 | D | Restore failure exposes error/retry rather than silently settling signed out. |
| F9 | D | Missing German key detected by catalogue parity; not translation quality, layout or large fonts. |
| A1 | D | Radio-chip checked-state prop detected; not native TalkBack correctness by itself. |
| A2 | S | Missing pantry row button role unasserted by the sampled suites. |
| A3 | D | Removing InlineError's alert-role prop detected. It does not remove the separate announcement hook or establish actual spoken output. |

R1's shopping INSERT/UPDATE/DELETE and profile UPDATE experiments extend beyond the 34 source mutants. They must be counted separately, not folded into the campaign's score. The replay's intact profile bare update affects the actor's own profile; that is not a foreign-write failure. R1 checks foreign state explicitly to avoid this ambiguity.

## Classification disposition

| Claims | Independent disposition |
|---|---|
| FC-1 | **PARTIALLY VERIFIED** for the broad persistence statement under its failability definition; meaningful historical emulator journey/read-back evidence, unchanged app code, mismatched detector scope. |
| FC-2 | Accept **VERIFIED only for the tested component/hook race scenarios**. Literal "never" across every response/device state is not established. |
| FC-3 | Agree sign-in failure reporting is FAILED; retain PARTIAL for other action reporting, including unknown add/edit/delete outcomes. |
| FC-4 | Agree PARTIAL; key parity and owner phone checks do not close layout/font/translation-quality scope. |
| DI-1 | Narrow to pantry and open-shopping namespaces; separate index detectors and PostgreSQL concurrency evidence. Broad original wording not VERIFIED. |
| DI-2 | **PARTIALLY VERIFIED** until a rename-clobber detector is shown, or revise evidence model to distinguish positive execution from proven failability. |
| DI-3 | VERIFIED only for the enumerated unit contracts, not every write/list consistency case. |
| DI-4 | Agree PARTIAL; one-item upgrade and PGlite snapshots are not representative recovery/rollback evidence. |
| DI-5 | Agree FAILED as an operational recovery capability; beta risk acceptance is separate. |
| SP-1 | Local positive evidence plus targeted pantry/shopping read detectors; do not extend VERIFIED automatically to every protected table/policy or hosted behavior. Replay shapes are weaker than mutant suite execution. |
| SP-2 | Agree PARTIAL, with F01 treated as a high-priority security assertion gap rather than a minor test issue. Intact tested policies protect foreign fixtures. |
| SP-3 | Local tested grants/attribution paths have detecting tests; keep pantry versus shopping and hosted-existing-values boundaries explicit. |
| SP-4 | Accept component guard subclaims; broader client/link configuration remains PARTIAL because S12 survived and hosted confirmation is unverified. |
| SP-5 | Retain PARTIAL at most. Historical two-user journey supports observed separation; combined mutations without output are unverified. |
| SP-6 | Agree PARTIAL: dated catalog equality is structural evidence; no hosted shopping behavior proof located. |
| SP-7 | Agree UNVERIFIED after hosted Auth change. |
| SP-8 | PARTIAL for recorded application-table cascades; **UNVERIFIED as "all user data"**; B4's Met is not adequately supported. |
| SP-9 | Agree UNVERIFIED actual release exposure; investigate before beta distribution. |
| SP-10 | Agree UNVERIFIED for reassessment at this lockfile; no audit was invented or run. |
| TI-1 | Specific empty-run and inventory guarantees supported; broader gate-completeness statement PARTIAL. |
| TI-2 | Support independent execution of top-level Node cases from CI metadata/reported local evidence; nested and other runners remain qualified. No isolated run independently repeated here. |
| TI-3 | Exact-commit result required; historical Android run alone does not close it. See F04 and final CI observation. |
| TI-4 | Split configured Jest/job limits from missing Node/integration per-test timeout and unverified termination behavior. |
| OR-1 / OR-2 / OR-3 | Agree FAILED / UNVERIFIED / UNVERIFIED respectively on available evidence. Owner reports are no substitute for crash visibility, signed artifact or real network/expiry execution. |
| OR-4 / OR-5 | Agree PARTIAL: re-registration untested; observed merge refusal does not expose or prove complete branch-rule enforcement. No current protection settings were inferred from historical narrative. |
| UA-1 / UA-2 / UA-3 | Agree PARTIAL / UNVERIFIED / UNVERIFIED; static roles/announcement mocks cannot establish native speech or external usability. |

## Minimum corrections before supervised beta

1. Resolve the security evidence gap in F01 on an isolated local stack with assertion failures for all five permissive write-policy mutants. Retain bounded, authorized hosted-shopping evidence separately; never use a hosted full-table mutation to prove safety.
2. Correct the overbroad VERIFIED statements and retain portable failure diagnostics for relied-on claims. Preserve the original assessment and attach these disagreements rather than silently rewriting its history.
3. Obtain the exact-commit Android result required by F04. Preserve its scope as debug emulator/local stack; continue to require a trusted, signed beta artifact and hosted smoke evidence.
4. Complete hosted signup and the interim recovery re-registration journey on that artifact after the Auth setting change (F05).
5. Complete a populated deletion rehearsal and closing confirmation, scope retention promises to the evidence, and reconcile the runbook's contradictory backup statement (F06/F07).
6. Resolve the actual release artifact's session-storage/backup exposure before tester distribution. Separately record accepted lack of server recovery; do not classify it as verified recovery.
7. Satisfy the remaining nonwaivable lines in [BETA-01](2026-11-21-beta-entry-checklist.md), including current advisory review, privacy publication, localization checks and artifact trust. Apply explicit dated waivers only where the established checklist permits them.

These are necessary corrections, not sufficient release approval. An internally consistent document, a passing baseline and even a successful exact-commit Android workflow do not close the outstanding beta gates.
