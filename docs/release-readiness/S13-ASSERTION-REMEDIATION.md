# Beta remediation PR A: S13 assertion effectiveness

**Status:** test-only change, ready for review. Production code is unchanged. **SP-4 stays PARTIALLY VERIFIED**: this closes only the callback-guard subclaim's detection gap.

Earlier S13 observations stay as recorded in the [follow-up review](RELEASE-ASSURANCE-FOLLOWUP-25499a6.md) and the [supplemental kit](review-evidence-25499a6/supplemental-kit/README.md). This record adds new evidence; it changes none of them.

## Problem and root cause

- **Guard:** `confirmEmail` in [`pantry-flow/lib/email-confirmation.ts`](../../pantry-flow/lib/email-confirmation.ts) rejects a confirmation link while a session exists (`if (current.data.session) throw new Error('Already signed in')`), so a link cannot replace the signed-in account.
- **Mutation S13** removes that line.
- **Why it timed out:** the test's mocked `exchangeCodeForSession` returned a deferred promise that the signed-in case never settled. With the guard intact it is never called. Without the guard, `confirmEmail` waited on it forever, so `assert.rejects` never settled. The check that no exchange happened came after that wait and was never reached.
- **Under the normal command** (`node --test`, no per-test timeout), the file did not finish. It was stopped by an external 180-second limit ([log 1](remediation-evidence-s13/1-before-mutant.log)). The earlier probe saw a cancellation only because it added `--test-timeout=60000`.

## Change

Only [`pantry-flow/tests/email-confirmation.test.cjs`](../../pantry-flow/tests/email-confirmation.test.cjs):
- **Fixture:** like supabase-js, a successful mocked exchange now stores its session (`currentSession()` reads it). Other tests in the file are unaffected.
- **Split:** the signed-in case is its own test, `a callback cannot replace an already signed-in account`. The expired-code case keeps its assertions as `expired codes remain recoverable`.
- **No waiting on an unsettled promise:** the exchange is settled with an attacker session before the callback runs, and the outcome is collected with `Promise.allSettled`.
- **Three assertions, each naming its contract:** no code exchanged while signed in; the existing session kept; the callback rejected with "Already signed in".

## Evidence

Base: `main` at `8fa694f684ed8f94de7dddd8d881e5eacf86e7b5`. Windows, Node 26.10.0. The mutants ran in a disposable clone of the base: production code from the base, plus this branch's test file from run 3 on (log 1 uses the old test). Production code is identical on base and branch (blob `72748a3`). The intact runs ran on this branch. The gate and isolated logs are filtered summaries of the console output, not full logs.

| # | Code and test | Command | Result |
|---|---|---|---|
| [1](remediation-evidence-s13/1-before-mutant.log) | S13 mutant, old test | `node --test tests/email-confirmation.test.cjs` | Did not finish; stopped after 180 s; no assertion failed |
| [2](remediation-evidence-s13/2-after-intact.log) | Intact, new test | same | 8 of 8 passed |
| [3](remediation-evidence-s13/3-after-mutant-S13.log) | [S13 mutant](remediation-evidence-s13/S13-mutation.diff), new test | same | Failed after 1 s: `AssertionError: no code may be exchanged while an account is signed in`, actual `['attacker-code']` |
| [4](remediation-evidence-s13/4-after-mutant-S13-without-exchange-assertion.log) | S13 mutant, [test without the exchange assertion](remediation-evidence-s13/M1b-test-variant.diff) | same | Failed: `the signed-in account must keep its session` |
| [5](remediation-evidence-s13/5-after-mutant-M2.log) | [M2](remediation-evidence-s13/M2-mutation.diff): guard returns quietly instead of rejecting | same | Failed: `the callback must report that an account is already signed in` |
| [6](remediation-evidence-s13/6-after-restore.log) | Mutant restored, new test | same | 8 of 8 passed |
| [Gate](remediation-evidence-s13/gate-summary.log) | Branch | `npm run test:independence`, `npm run typecheck`, `npm test -- --test-concurrency=2`, `npm run test:components`, `npm run test:safety` | 0 findings in 100 files; 534 Node tests (533 on the base, plus the split), 18 component tests, 1 safety test passed |
| [Isolated](remediation-evidence-s13/isolated-summary.log) | Branch | `npm run test:isolated` | 524 top-level tests passed alone across 62 files |

Hashes: [SHA256SUMS](remediation-evidence-s13/SHA256SUMS).

**Not run locally:** the database and integration suites (`npm run test:local` resets the shared local stack) and the Android suite. CI runs the database job on the pull request.

## Limits

- **Mocked boundary:** the test uses a mocked Supabase client. It shows that the guard's contract is asserted, not how the real client or a phone behaves.
- **Still separately gated:** the PKCE setting itself (S12 still survives), hosted confirmation after the 2026-11-21 Auth change (SP-7), and session storage on the device (SP-9).
- **Remaining hang risk:** a future unsettled mock can still hang the normal command, because Node tests have no per-test timeout (TI-4, KAN-107).

## Independent review

An independent AI reviewer (Claude Opus, in its own disposable clone, read-only) **approved with nits**; [report](remediation-evidence-s13/independent-review.md).

- **Reproduced:** the hang before the change, the prompt assertion failure after it (also under the full runner), the restore, five randomized orders, the new test alone, the independence check, `test:isolated` (524), 534 Node and 18 component tests, and the evidence hashes.
- **Own mutants:** 13 of 16 guard regressions fail an assertion within about 0.6 s. Three survive, all outside S13 and present before this change:
  - a `getSession()` error being ignored;
  - finished requests never leaving the coalescing map;
  - coalescing returning another code's request.
- **Nits handled:** wording about where the mutants ran; summaries labelled. **Not changed:** a non-Error rejection would end the test in a TypeError rather than an AssertionError, but it still fails; changing the test would have invalidated the recorded runs. **Not done:** follow-up tickets for the three survivors, which need the owner.

## CI

Recorded in the pull request.
