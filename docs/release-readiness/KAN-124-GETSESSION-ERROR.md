# KAN-124 (AUTH-TEST-01): fail closed on getSession() errors in the confirmation callback

**Status:** test-only change, ready for review. Production code is unchanged; testing found no defect. Beta line B13 (owner decision 2026-11-27, [Amendment 4](../planning/2026-11-19-slice-3-decision-record.md#amendment-4--2026-11-27-beta-line-b13)) requires this.

## Problem

- **Guard:** `confirmEmail` in [`pantry-flow/lib/email-confirmation.ts`](../../pantry-flow/lib/email-confirmation.ts) reads the current session before exchanging the link's code, and stops if that read fails: `if (current.error) throw current.error;`. Without it, a failed read (`{ data: { session: null }, error }`) looks like "signed out", and the code is exchanged and replaces whatever session the app had.
- **Gap:** no test made `getSession()` fail. The independent review of the S13 change (PR #75, [report](remediation-evidence-s13/independent-review.md)) removed the guard, and the whole suite still passed.

## Change

Only [`pantry-flow/tests/email-confirmation.test.cjs`](../../pantry-flow/tests/email-confirmation.test.cjs):
- **Fixture:** `failGetSession(error)` makes the mocked `getSession()` return the error and no session, as supabase-js does. Other tests are unaffected.
- **New test** `a getSession() error stops the callback before any code exchange`. As in the S13 test, the exchange is settled with a session before the callback runs, and the outcome is collected with `Promise.allSettled`. A regression therefore fails an assertion at once instead of waiting on an unsettled promise.
- **Four assertions, each naming its contract:** no code exchanged; the authentication state not replaced; the callback rejected; rejected with the `getSession()` error itself.

## Evidence

Base: `main` at `30a3e4c7b40e2653aa915883ed774722a81f4c29`. Windows, Node 26.10.0. The mutants were applied to the production file in the branch's working tree and restored after each run; the script checked that `git diff` of `lib/` was empty afterwards. Run 1 used the test file from the base, copied next to the new one; run 4 used a copy of the new test without its first assertion. Command for every run: `node --test --test-reporter=spec <test file>`.

| # | Code and test | Result |
|---|---|---|
| [1](remediation-evidence-kan124/1-before-mutant-M1.log) | [M1](remediation-evidence-kan124/M1-mutation.diff) (the reviewer's mutant: the error check removed), test file from `main` | **Survives:** 8 of 8 passed |
| [2](remediation-evidence-kan124/2-after-intact.log) | Intact, new test | 9 of 9 passed |
| [3](remediation-evidence-kan124/3-after-mutant-M1.log) | M1, new test | Failed in about 8 ms: `no code may be exchanged after a getSession() error`, actual `['link-code']` |
| [4](remediation-evidence-kan124/4-after-mutant-M1-without-exchange-assertion.log) | M1, [test without the exchange assertion](remediation-evidence-kan124/M1b-test-variant.diff) | Failed: `the authentication state must not be replaced after a getSession() error`, actual `{ user: { id: 'from-link' } }` |
| [5](remediation-evidence-kan124/5-after-mutant-M2.log) | [M2](remediation-evidence-kan124/M2-mutation.diff): the error is swallowed and the callback resolves | Failed: `the callback must reject after a getSession() error` |
| [6](remediation-evidence-kan124/6-after-mutant-M3.log) | [M3](remediation-evidence-kan124/M3-mutation.diff): another error is thrown instead | Failed: `the callback must reject with the getSession() error itself` |
| [7](remediation-evidence-kan124/7-after-restore.log) | Mutants restored, new test | 9 of 9 passed |
| [Gate](remediation-evidence-kan124/gate-summary.log) | Branch | Independence check 0 findings in 104 files; 582 Node tests (581 on the base, plus the new one), 0 cancelled; 19 component tests; 1 safety test |
| [Isolated](remediation-evidence-kan124/isolated-summary.log) | Branch | `npm run test:isolated`: 572 top-level tests passed alone across 65 files; the new test also passed alone by name |

Hashes: [SHA256SUMS](remediation-evidence-kan124/SHA256SUMS). The folder's `.gitattributes` keeps the files' bytes (LF) stable across checkouts. The gate and isolated logs are filtered summaries, not full logs.

**Not run locally:** the database, integration and Android suites. No e2e harness file changed; CI runs the database job on the pull request.

## Independent review

An independent AI reviewer (Claude Sonnet, its own disposable clone of `9d0a02a`, read-only) **approved** with two nits; [report](remediation-evidence-kan124/independent-review.md).

- **Reproduced:** intact pass, the named failure of the removed check within about 7 ms, the restore, five randomized orders, the new test alone, and all evidence hashes on a fresh checkout.
- **Own mutants:** 9 of 10 failed an assertion. The survivor (`return Promise.reject(current.error)`) behaves the same as the guard, so it is not a test gap.
- **Nits, no change:** the state assertion relies on the mock storing its session, and the gate and isolated logs are filtered summaries; both are stated in this record.

## Limits

- **Mocked boundary:** the Supabase client is mocked. The test shows the guard's contract is asserted, not how the real client fails on a phone (for example, unreadable storage).
- **Out of scope:** the two other survivors of the S13 review, KAN-125 (concurrent callbacks with different codes) and KAN-126 (finished callbacks leaving the coalescing map).
