# Independent review of commit 605a5c0 (2026-11-26)

Reviewer: Claude Opus, dispatched by the author's session as a separate agent, with read-only instructions. It worked in its own disposable clone of `605a5c055f104e503f2087406e96a12c249e0ea6`. The report below is reproduced as received. Only the local folder names in its cleanup note are shortened.

## Verdict: approve with nits

I couldn't refute the change. It does what the owner's acceptance criteria ask, and the problems I found are minor or were already there before this commit.

## Evidence by check

**1. Diff scope.** `git diff 8fa694f 605a5c0 --name-status` shows 16 files: 14 new under `docs/release-readiness/` (the remediation record plus the `remediation-evidence-s13/` folder), one modified `docs/testing/coverage-matrix.md` (+1 row, EMAIL-06), and one modified `pantry-flow/tests/email-confirmation.test.cjs`. No other file under `pantry-flow/` changed. Production is unchanged: `git rev-parse` of `pantry-flow/lib/email-confirmation.ts` gives blob `72748a331e549d64a5a72210bb0833a886bda2b5` on both commits. That is also the `index 72748a3` line in the recorded mutation diffs.

**2. Assertions.** None weakened or removed.
- Old combined test: `rejects(attempt,/expired/)`, then for the signed-in case `rejects(..., /Already signed in/)` and `deepEqual(calls.exchange, [])`.
- New "expired codes remain recoverable" keeps the expired assertion word for word.
- New "a callback cannot replace an already signed-in account" keeps `exchange == []` and the rejection with `/Already signed in/` (now `status === 'rejected'` plus `match(reason.message)`). It adds one assertion: the session is still the existing one.
- Fixture change (the mocked exchange stores the session on success): `load()` compiles a fresh module for each fixture, so there is no shared state. Of the other tests, only the coalescing test sees a successful exchange, and it never reads the session afterwards. The expired and missing-session cases resolve with `session: null`, so the session is untouched. The change makes the mock closer to supabase-js and doesn't hide anything I could construct.

**3. Intact commit.** `node --test tests/email-confirmation.test.cjs` gives tests 8, pass 8, fail 0, cancelled 0, skipped 0, about 0.6 s. The base file had 7 `test(` calls; it now has 8.

**4. S13 mutant (guard line deleted with sed, no `--test-timeout`, under `timeout 120`).**
- Exit 1 after 597 ms: `✖ a callback cannot replace an already signed-in account`, `AssertionError [ERR_ASSERTION]: no code may be exchanged while an account is signed in`, actual `['attacker-code']`, expected `[]`. pass 7, fail 1, cancelled 0.
- Through the normal full runner (`node scripts/run-node-tests.cjs --test-concurrency=2`) with the mutant: exit 1 in 33 s, tests 534, pass 533, fail 1, cancelled 0, same AssertionError.
- Restored (`git checkout`, status clean) and reran: 8 of 8 pass.
- I also confirmed the original problem: the base test file plus the S13 mutant ran until my external limit killed it (`timeout 60`, exit 124, about 60 s), with no AssertionError. That matches log 1.

**5. My own guard regressions.** 16 variants, each applied, run and restored. All 13 that touch the guard fail an assertion within about 0.6 s, with 0 cancelled:
- **Fail on "no code may be exchanged":** guard removed; wrong field (`data.user`); guard moved after the exchange (two placements); fire-and-forget exchange then throw; exchange awaited, result ignored, then throw; signOut then exchange; rejection created but not returned; session check replaced by a hardcoded null session.
- **Fail on "the callback must report…" (status):** guard returns quietly.
- **Fail on the regex:** wrong error message.
- **Negated guard:** 3 tests fail.

Three variants survive. None of them is the S13 guard:
- **Ignoring `getSession().error`** (removing `if (current.error) throw current.error;`): no test makes `getSession` return an error. If it errors with a null session, the exchange goes ahead. This branch is related to the same authentication contract. Low severity, existing before this commit; worth a follow-up ticket.
- **Coalescing map never deletes finished requests:** the source comment "Completed codes/session tokens are not cached" is not tested. Low severity, existing before this commit.
- **Coalescing returns whichever request is active, whatever its code:** not tested. Low severity, existing before this commit, outside S13.

**6. Independence.**
- 5 runs with `--test-randomize` (seeds 3504086146, 3793156036, 822278382, 2203512412, 1504156550): all 8 of 8 pass.
- The new test alone with the given name pattern: tests 1, pass 1, skipped 0.
- `node scripts/check-test-independence.cjs`: "Checked 100 files: 0 finding(s)", exit 0.
- `node scripts/run-tests-alone.cjs`: "ran 524 top-level tests alone across 62 files", exit 0. This matches `isolated-summary.log`.

**7. Full suites.**
- Node: tests 534, pass 534, fail 0, cancelled 0, skipped 0.
- Jest (`--runInBand`): 4 of 4 suites, 18 of 18 tests.
- `tsc --noEmit`: exit 0.
- These match the author's 534 and 18. I did not run the base suite myself. 533 on the base is inferred: one test was split into two and nothing else changed.

**8. Record and evidence.**
- `sha256sum -c SHA256SUMS`: all 11 files OK.
- A grep for personal paths and usernames (micha, Users\, C:\, AppData, Temp) in the evidence and the record finds nothing. Stack paths are redacted to `<mutant-clone>`.
- Logs 2, 3 and 6 match my runs line for line, apart from timings. Logs 4 and 5 match the stated variants, and I reproduced log 5 (M2, quiet return) independently. Log 1 has the same shape as my base reproduction (tests 3, pass 2, fail 1 = the file being killed, no assertion).
- The claims are not overstated. SP-4 is stated to stay **PARTIALLY VERIFIED**. The mocked boundary is stated, and the PKCE setting (S12), hosted confirmation (SP-7) and device storage (SP-9) are listed as separately gated. Not running DB, integration or Android locally is reported as not run, not as passed. The remaining hang risk (TI-4, KAN-107) is disclosed.
- The claim that the earlier probe only saw a cancellation because of `--test-timeout=60000` is consistent with `supplemental-kit/results/environment.json` and the independent review doc. The record does not imply that `npm test` has a per-test timeout, which is correct.

## Nits (none blocking)
1. **Ambiguous wording** in `S13-ASSERTION-REMEDIATION.md`: "Mutants ran in a disposable clone of that commit" points to base `8fa694f`, but logs 3 to 5 use the new test file. Reword to "base production code plus this branch's test file". Production is byte-identical, so the result is unaffected.
2. **Curated evidence:** `gate-summary.log` and `isolated-summary.log` are filtered excerpts, not raw output. That is fine, but they could be labelled as summaries.
3. **Stale status elsewhere:** `BETA-REMEDIATION-PLAN-25499a6.md:81` still says "S13 only times out" and nothing points to the new record. Leaving earlier records alone is deliberate, but a reader of the plan won't find the fix.
4. **Edge case in the new test:** `outcome.reason.message` assumes the rejection is an Error. A rejection with something that isn't an Error would throw a TypeError instead of a clean AssertionError, though the test still fails.
5. **Follow-up tickets** for the three surviving variants in point 5 (the `getSession` error branch matters most).

## Could not verify
- The CI result for this PR, and the database, integration and Android suites. I did not run them, as instructed.
- `npm run test:safety`, which I did not run.
- The base suite total of 533, which is inferred, not run.
- Real supabase-js and hosted behaviour, which is out of scope by design.

## Cleanup
I deleted the disposable clone (`<scratchpad>/review`) with plain `rm -rf`, after `find -type l` found no links. Its `node_modules` came from my own `npm ci`. I left my scratch outputs in place: the mutation harness `<scratchpad>/mut/run-mutants.cjs`, and the `.out` logs in that scratchpad folder (`s13-mutant.out`, `base-mutant.out`, `full-node.out`, `full-mutant.out`, `jest.out`, `isolated.out`). Nothing in the main checkout was modified, committed or pushed. No GitHub, Jira or hosted calls were made.
