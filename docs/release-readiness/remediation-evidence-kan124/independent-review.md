# KAN-124 independent review (2026-11-27)

Reviewer: an independent AI reviewer (Claude Sonnet), in its own disposable clone of commit `9d0a02a`, read-only. It was given the ticket's acceptance criteria and the code, not the author's conclusions. Its report, condensed to its findings and evidence:

**Verdict: approve.** No blocking or should-fix findings; two nits.

## Acceptance criteria

- **getSession() error and no session:** the fixture returns `{ data: { session: null }, error }`, the shape auth-js's `getSession` returns on its error paths (spot-checked, not every path).
- **Rejects with that error:** asserted by identity.
- **No exchange:** `calls.exchange` must stay empty.
- **State not replaced:** the mocked exchange stores its session; the test asserts it stays `null`.
- **Named failure:** with the check removed, the run failed in about 7 ms with `AssertionError: no code may be exchanged after a getSession() error`, actual `['link-code']`; no timeout, no cancellation.
- **No production change:** the diff touches only the test, docs and evidence.

## Reproduction

- Intact: 9 pass, 0 fail, 0 cancelled. Check removed: 8 pass, 1 fail, 0 cancelled. Restored: passes.
- `--test-randomize`, five seeds (2712558229, 3995017830, 1314938377, 3216723941, 3385397111): 9 of 9 each time.
- The new test alone (`--test-name-pattern`): passes.
- No leftover entry in the module's `exchanges` map affected other tests.
- `sha256sum -c SHA256SUMS` on a fresh checkout: all 13 files OK.
- Record counts match the logs (8/8 before, 9/9 after, 582 in the gate summary, 572 alone across 65 files). The full suite was not re-run.
- No personal names, user paths, tokens or secrets in the evidence.

## Reviewer's own mutants of `confirmEmail`

| # | Mutant | Result |
|---|---|---|
| 1 | Error check removed | Killed (exchange assertion) |
| 2 | Session check first, error check removed | Killed |
| 3 | `if (false) throw …` | Killed |
| 4 | `if (current.error && current.data.session) throw …` | Killed |
| 5 | Error check moved after the exchange | Killed (an existing test also failed) |
| 6 | `throw new Error('Already signed in')` instead | Killed (identity assertion) |
| 7 | `throw undefined` | Killed |
| 8 | `throw String(error)` | Killed |
| 9 | `throw new Error(error.message)` | Killed (identity assertion) |
| 10 | `return Promise.reject(current.error)` | Survived: equivalent (the async function still rejects with the same error before any exchange), not a test gap |

## Findings

1. **Nit:** the state assertion checks the mock's stored session, so it relies on the mock writing it; the record says so, and `calls.exchange` already shows the exchange never ran. No change.
2. **Nit:** the gate and isolated logs are filtered summaries and cannot be re-verified from the logs alone; the record says so. No change.

No overclaims found; the record's limits and the EMAIL-07 matrix row match the evidence.
