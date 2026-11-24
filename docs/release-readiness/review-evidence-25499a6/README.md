# Reproducible assurance review evidence

Assessed source: `25499a656c1e419883d95b6e9ade8cd0fa4fc791`. Evidence is documentation material; it is not imported by the application or added to any CI/test runner. No hosted endpoint or live credential is needed for these probes.

This exact snapshot is excluded from SonarCloud source analysis in `.sonarcloud.properties`: it preserves author-supplied scripts, deliberate policy weakenings and duplicate reproductions as evidence, rather than maintained application/tooling source. This exclusion does not certify the archived drivers as secure or production-ready. Keep their disposable-clone restrictions and baseline checks when reproducing results. Application code, product tests, maintained scripts and other documentation remain in their existing analysis scope. Promotion of a probe into maintained tooling requires a separately reviewed implementation; do not run frozen evidence as a production tool.

## Evidence accounting

[probe-ledger.json](probe-ledger.json) accounts for **all 34 probes**: S1–S14, D1–D8, F1–F9 and A1–A3. There are 24 reported detections and 10 survivors. D2 changes both the legacy duplicate guard and the unique index and is excluded from the countable sample: **23 detections among 33 countable probes**. This is not a coverage percentage, a representative sample or proof of comprehensive assertion effectiveness.

**Follow-up correction:** the supplied, checksum-verified [complete kit](supplemental-kit/README.md) resolves those 23 nonzero outcomes into **22 assertion failures and one timeout-only outcome (S13)**. Ten survived. Do not count S13 as proof that a security assertion fails. C1–C7 and X1 are additional experiments outside the original 34; see the [follow-up independent review](../RELEASE-ASSURANCE-FOLLOWUP-25499a6.md). Historical captures and the original ledger remain unchanged.

[probe-ledger-followup.json](probe-ledger-followup.json) records the corrected current interpretation for every original probe and links C1–C7/X1 separately.

Each ledger entry links a reconstructed [mutation diff](mutation-diffs). These diffs were generated in memory from the inspected author transformations and the assessed Git object. They were not recovered from historical mutant worktrees and do not authenticate the old execution. No product source or test was changed to generate them.

## Independent reviewer evidence

- [independent-rls.cjs](independent-rls.cjs) and [captured output](independent-rls.out) reproduce the five masked write-policy cases, compare intact/open/absent policies, check foreign state independently and challenge non-returning foreign inserts. It reads migrations/tests from Git at the assessed SHA and uses PGlite, not a hosted server.
- [database-intact.tap](database-intact.tap), [database-items_update_member.tap](database-items_update_member.tap), [database-items_delete_member.tap](database-items_delete_member.tap): existing Node database tests remain green for either permissive pantry policy mutant (10 tests each). SQL/test inputs are copied into disposable OS temp directories. No product files are changed.
- [request-shapes.cjs](request-shapes.cjs) and [output](request-shapes.out) record unfiltered Supabase PATCH/DELETE request construction with an injected fetch recorder. The synthetic key is not a credential. No request reaches a server.
- [node-tests.log](node-tests.log), [component-tests.log](component-tests.log): reviewer baseline results, 526 and 18 passing tests respectively. The component baseline was repeated with direct subprocess capture to avoid PowerShell interpreting native stderr as a shell error; the retained run exited zero.
- [ci-observed.json](ci-observed.json), [ci-final-observation.json](ci-final-observation.json): historical GitHub run/job metadata observations. The latter filename means final observation of the **initial review**, not a completed Android result. Later observations are separate files linked in the [Android record](../ANDROID-RESULT-25499a6.md).

Run the independent scripts from the repository root with the assessed dependencies installed under `pantry-flow/node_modules`:

```powershell
node docs/release-readiness/review-evidence-25499a6/independent-rls.cjs
node docs/release-readiness/review-evidence-25499a6/request-shapes.cjs
```

The RLS script writes fresh TAP captures beside itself. Run from a disposable clone if preserving this package's historical captures; record new output separately. The request-shape script uses installed dependencies, so verify their versions match the assessed lockfile. Review executions used Node 26.10.0, PGlite 0.3.16 (engine reporting PostgreSQL 17.5) and Supabase JS 2.119.0. No local Supabase/pgTAP mutant suite or hosted behavior run is claimed.

## Author evidence and portability adaptations

These files were copied from the ignored author evidence folder after inspection:

| Published file | Provenance and limit |
|---|---|
| [author-probes.py](author-probes.py) | All 34 original mutation definitions and Node/Jest driver. Hardcoded workstation path replaced by an explicit disposable-clone root and marker guard. Mutation logic unchanged. |
| [author-probes.out](author-probes.out) | Original reported baseline and per-mutant outcomes; line endings normalized. Full assertion diagnostics were not retained. Not a new independent campaign execution. |
| [author-replay.cjs](author-replay.cjs) | Original PGlite statement-shape replay, with dependency/migration path resolution adapted to the disposable clone. SQL logic unchanged. |
| [author-replay.out](author-replay.out) | Original reported replay output; line endings normalized. Not an actual pgTAP/API mutant-suite run. |
| [author-combo.py](author-combo.py) | Original combined-removal script, with root/marker adaptation. Its original output is **unavailable**, and no result is invented or inferred from the script. |

[author-evidence-provenance.json](author-evidence-provenance.json) records original file SHA-256 hashes, published hashes and transformations. The independent RLS output's local OS-temp path was replaced by a placeholder. Public GitHub IDs, synthetic fixture UUIDs and test names remain because they bind the evidence; no email/password/token values or workstation paths are required by this evidence package. The unchanged assessment retains its original historical references, including the now-ignored folder path.

To run the author's adapted mutation campaign, first create an **explicitly disposable clone**; these scripts temporarily rewrite files there. This PR does not execute them or modify the current product/tests. From the repository root, choose a fresh destination:

```powershell
$probeCopy = Join-Path $env:TEMP ('pantryflow-review-' + [guid]::NewGuid())
git clone --no-hardlinks . $probeCopy
git -C $probeCopy checkout --detach 25499a656c1e419883d95b6e9ade8cd0fa4fc791
Set-Content -LiteralPath (Join-Path $probeCopy '.review-probe-disposable') -Value 'disposable review clone'
$env:PANTRY_REVIEW_PROBE_ROOT = Join-Path $probeCopy 'pantry-flow'
Push-Location $env:PANTRY_REVIEW_PROBE_ROOT
npm ci --ignore-scripts
node scripts/patch-expo-windows.cjs
Pop-Location
python docs/release-readiness/review-evidence-25499a6/author-probes.py
python docs/release-readiness/review-evidence-25499a6/author-combo.py
node docs/release-readiness/review-evidence-25499a6/author-replay.cjs
```

Use fresh output filenames with date, assessed SHA and environment. The author driver treats any nonzero suite exit as detection and summarizes failing names; retain full assertion diagnostics before crediting a new execution. Portability adaptation and syntax checks do not make this historical campaign independently reproduced. Missing combined-run evidence remains missing until a separately identified execution supplies it.

**Windows correction and preferred driver:** the explicit Expo patch above is required after installing with scripts disabled; it is a no-op outside Windows. Its earlier omission was an error in this package's reproduction instructions. Run and verify an unmodified baseline before applying any mutant. The legacy adapters above are historical evidence and lack a baseline refusal guard. For newly credited runs, prefer [supplemental-kit/run_probes.py](supplemental-kit/run_probes.py), which checks the assessed SHA, a clean clone and a green baseline before starting, and rechecks the baseline after restoring all mutations. Follow its [reproduction instructions](supplemental-kit/README.md), including the Expo patch. Do not use a failing baseline to label mutants as detected.

## Follow-up evidence

- [supplied kit validation](supplemental-kit-validation.json): archive SHA-256 and all manifest files verified; all 44 raw Node summaries agree with recorded results; all 34 original mutation change-lines match reconstructed patches. This is independent evidence inspection, not a full independent campaign rerun.
- [reproduce-pgtap.cjs](reproduce-pgtap.cjs), [reviewer-pgtap.out](reviewer-pgtap.out): reviewer-authored execution of the two committed, unmodified pgTAP files in PGlite. All 64 pass intact and for each of five permissive write-policy replacements. No local Supabase server or HTTP mutant execution is claimed.
- [reviewer-full-replay.json](reviewer-full-replay.json), [output](reviewer-full-replay.out): the supplied replay script was also re-executed by the reviewer against disposable copies of committed SQL inputs; its statement shapes and pgTAP outcomes exactly match the supplied replay results.
- [terminal CI observation](ci-terminal-45374918480.json), [Android JUnit files](android-junit), [artifact summary](android-artifact-summary.json), [selected signed-in job-log lines](android-job-138380547744-selected.log): independently downloaded exact-commit evidence, including all six read-back confirmations. Raw artifact/logcat/screenshots stay ignored; only reviewed reports and allowlisted log lines are published.

The 145 supplied kit files are preserved exactly, including their own SHA256SUMS. The outer ZIP remains ignored; its verified digest is `0ca2ca4fcd177cb1a46678330c0c3c7088628568b339f3670241108767d061cd`. An integrity check binds the supplied files, but does not by itself authenticate every historical execution. The Android archive was downloaded independently and matched GitHub's artifact digest.
