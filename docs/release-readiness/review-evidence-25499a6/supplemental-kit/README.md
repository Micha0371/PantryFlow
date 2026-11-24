# Evidence kit for RELEASE-ASSURANCE.md (2026-11-24)

Evaluated commit: `25499a656c1e419883d95b6e9ade8cd0fa4fc791` (`main`). Everything here was run on that commit unless stated. Local paths, user and host names are replaced by `<clone>`, `<home>`, `<user>` and `<host>`.

## Contents

| Path | What |
|---|---|
| `run_probes.py` | Applies one breakage at a time to a throwaway clone, runs both suites, restores the file |
| `replay.cjs` | Policy replay and the unmodified pgTAP files, in memory |
| `collect_ci.py` | Public CI data, no token |
| `results/environment.json` | Versions, lockfile hash, exact commands |
| `results/results.json` | Per probe: exit codes, test counts, seed, failing tests, files, restore check |
| `results/summary.out` | Console output of the full run |
| `results/patches/*.patch` | The exact change of every probe |
| `results/logs/*.log` | Raw output of both suites per probe, and of both baselines |
| `results/replay/` | Replay output and JSON |
| `results/original-run/` | Outputs of the first run, on which the assessment was written |
| `ci/run-*.json` | Run, jobs, steps and artifact metadata |
| `SHA256SUMS` | Hashes of all files above |

## Reproduce

Node 26.1+, Python 3.12+, git. No Docker, device, database server or credentials.

```sh
git clone https://github.com/Micha0371/PantryFlow.git clone
cd clone && git checkout 25499a656c1e419883d95b6e9ade8cd0fa4fc791 && cd pantry-flow
npm ci --ignore-scripts --no-audit --no-fund
node scripts/patch-expo-windows.cjs        # does nothing outside Windows
cd ../..
python -X utf8 run_probes.py --repo clone/pantry-flow --out my-results          # about 25 minutes
python -X utf8 run_probes.py --repo clone/pantry-flow --out my-results-s2 S2    # one probe
node replay.cjs --repo clone/pantry-flow --json replay.json                     # about 1 minute; not while run_probes is running
python -X utf8 collect_ci.py --out my-ci 45374918480 45200604295 45312958112
```

`run_probes.py` refuses a wrong commit, a dirty clone, or a baseline that is not green. It was run on Windows only; **Linux is unverified**. Node test order is random; the seed is in `results.json`. Jest ran in its default order.

To apply a single change by hand: `git apply results/patches/S2.patch` in the clone.

## Results

**Baselines** before and after: 526 Node tests and 18 component tests passed. **34 probes:** 24 detected, 10 survived, the same verdicts as the first run. Every file was restored.

| Group | Detected | Survived |
|---|---|---|
| Security S1–S14 | S1, S4, S6, S7, S11, S13 (timeout only), S14 | S2, S3, S5, S8, S9, S10, S12 |
| Data D1–D8 | D1 to D8 (D2 confounded) | none |
| State F1–F9 | F1, F3, F5 to F9 | F2, F4 |
| Accessibility A1–A3 | A1, A3 | A2 |

**Combinations (`combo.py` is now C1–C7 in `run_probes.py`):** C2, C4, C6 detected; C1, C3, C5, C7 survived. Same verdicts as the first run. C4 and C6 detect the same loss as C2 (row filter plus clearing); removing the provider keys adds no failing test.

**Extra, not part of the 34:** X1 isolates what D2 confounded. The legacy duplicate guard alone is detected.

**Policy replay:** with intact policies the other user saw and changed nothing. Each opened read or insert policy is noticed by one shape. The five opened write policies (pantry and shopping UPDATE and DELETE, profile UPDATE) are noticed only by a bare write without `WHERE` and `RETURNING`.

**Unmodified pgTAP files in PGlite (new):** intact 21 of 21 and 43 of 43 pass. With any of the five write policies opened, all 64 still pass. Each opened read or insert policy makes at least one assertion fail.

## Android

| | Run 45374918480 | Run 45200604295 |
|---|---|---|
| Commit | `25499a6` (evaluated) | `501a792` |
| Trigger | Owner dispatch on `main`, attempt 1 | Schedule, attempt 1 |
| Jobs | `fast`, `isolated`, `database`, `windows-tooling`, `android`: success | Same: success |
| Android job | 10:30:56–11:03:51 UTC; emulator step 10:45:00–11:03:44 | 15:05:34–15:37:23 UTC |
| Artifact `android-e2e-diagnostics` | id 14914315833, 1,163,177 bytes, expires 2026-12-01 | id 14834841107, 1,157,960 bytes, expires 2026-11-30 |
| SHA-256 | `86b5decedbae6c254f0102afeaa84088f1f19b3aae21c19c7c839a88aaab0809` | `1bba17f1c8fd96fd8c74ac4ab2af5b9f462a76673630a72f6e85cdbde3d36583` |

- **Commands** (workflow at that commit): `npm ci --ignore-scripts`, `npm run db:start`, `npm run db:reset`, `npm run e2e:prepare`, `npm run e2e:build`, then `npm run test:e2e` in the emulator, then `npm run e2e:cleanup`.
- **Environment from the workflow file:** `ubuntu-latest`, Node 26, Temurin 17, Android API 35 x86_64 `pixel_2`, Maestro 2.12.0, debug-signed test package, local Supabase.
- **What success means by reading `run-e2e.cjs`:** all six flows ran in order, each followed by its database read-back (`verify:<flow>`), and any failing command fails the job.

## Unavailable: treat as unverified

| Item | Why | How to obtain |
|---|---|---|
| Test counts and names inside any CI job | Job logs return 403 without sign-in | Signed-in view; `fast-test-diagnostics` (ids 14909863928 and 14831187205) and `database-test-diagnostics` (14910314656, 14831846650) |
| Per-flow Maestro results, screenshots, logcat | Artifact contents need sign-in. The assessor's token approval does not cover it | Download the two `android-e2e-diagnostics` artifacts before they expire and compare the SHA-256 |
| Exact runner image, emulator and tool versions as resolved | Only in the logs | Same |
| Whether the emulator flows could fail for each claim | No breakage was run on Android | Needs separate approval |
| API integration tests against broken policies | Would need the local database stack | Needs separate approval |
| Phone runs E10 | Recorded in the coverage matrix; raw output is not in this kit | Owner's local `.verification` |
| Whether a bare write can reach the hosted database | Hosted was not touched | Needs separate approval |

## Corrections to RELEASE-ASSURANCE.md

The assessment file is unchanged so the review copy stays stable. These points differ from it:

1. **S13 was not detected by an assertion.** The test hung until the probe's 60-second limit, which the project's normal command does not set. Of the 33 countable probes, **22 were detected by a failing assertion, 1 only by the timeout**, 10 survived. SP-4's "detects S13" is therefore weaker, and it is a second, current example for TI-4.
2. **SP-2 is now shown for pgTAP**, not only for its statement shapes. It remains by shape only for the API tests.
3. **TI-3:** the harness at `25499a6` has now run in CI and the job succeeded (run 45374918480). Per-flow results stay unverified until the artifact is read. The run was after the merges, so the rule "exact commit before acceptance" was still not met for #66, #67 and #70.
4. **FC-1 and E2:** same-commit Android evidence now exists, with the same limit.
5. **Method:** "the Android suite was not run for this assessment" is superseded by the owner's dispatch. The assessor did not start it.
6. **Counting:** the first run counted distinct failing test names; `results.json` has both the names and the suite's own counts, so some numbers differ (for example F3: 8 names, 9 tests). F5 ran 523 tests because three subtests did not start after their parent failed.

## Relation to the independent review package

Written against branch `pantryflow/release-assurance-independent-review` at `440fd9d`, which this kit did not change.

| Open in the review package | Provided here |
|---|---|
| Combined-run output unavailable | C1–C7: patches, raw logs, results |
| Full assertion diagnostics not retained | `results/logs/` for every probe |
| Reconstructed diffs do not authenticate the old execution | All 34 of them change exactly the same lines as `results/patches/`, which were captured during this new run. The old run itself still cannot be authenticated |
| No pgTAP mutant run | Unmodified pgTAP files in PGlite (`results/replay/`). Not a Supabase stack run |
| D2 confounded | X1 |
| No terminal Android result | `ci/run-45374918480.json`: success, emulator step success, attempt 1, job 138380547744 |

**Reproduction warning for that package on Windows.** Its steps use `npm ci --ignore-scripts` without `node scripts/patch-expo-windows.cjs`. In this kit's first trial on a fresh Windows clone, that left a `native-tooling` test failing on the unmodified baseline (2 failed with S1 applied, 1 with C7, which is a survivor). A driver that reads any nonzero exit as a detection then reports every probe as detected. That trial's output was not kept; running the two commands on a fresh Windows clone shows it.
