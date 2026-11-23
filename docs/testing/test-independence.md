# Test independence

KAN-121 (TEST-04). Design: [2026-11-22-kan-121-test-independence-design.md](../planning/2026-11-22-kan-121-test-independence-design.md).

## The rule

No test may depend on execution order, on another test's result or side effects, on shared mutable state, or on anything outside the test (shell or CI environment, wall-clock time, machine speed, local files). Each test sets up its own starting state.

**What counts as one test:** one `test(...)` (node), one `it(...)` (jest), one pgTAP file, or one Maestro flow. Steps inside one test may build on each other; separate tests may not.

Nested subtests (`t.test`) are fine. They are a problem only when they share mutable state. Legitimate Unicode fixtures are fine too; only invisible or look-alike whitespace characters written literally in source are flagged.

## Guards

Static check: `npm run test:independence` (`pantry-flow/scripts/check-test-independence.cjs`, the first step of `test:fast`). It parses test sources with the TypeScript compiler API, so strings and comments are never matched as code.

| Rule | Catches |
| --- | --- |
| `module-state` | File-level, describe-level or parent-test bindings mutated inside a test or nested-subtest callback. Hooks such as `beforeEach` are not mutation regions. |
| `global-patch` | `global`, `globalThis` or `process.env` changed in a test without a restore in `finally`, `t.after` or `afterEach`. |
| `fake-timers` | File-level `mock.timers.enable` not directly followed by a `try` whose `finally` resets it; jest `useFakeTimers` without `useRealTimers` in `finally` or `afterEach`. `t.mock.timers` is always allowed. |
| `invisible-whitespace` | Literal U+00A0, U+00AD, U+2000-U+200F (except ZWJ/ZWNJ between two visible characters), U+2028/2029, U+202F, U+205F-U+2064, U+3000 and non-leading U+FEFF. Escapes and all other Unicode are allowed. |
| `focused-test` | `.only`. |

Dynamic checks catch what static rules cannot:

- Random order on every run: node (`--test-randomize`), jest (`--randomize --showSeed`) and the Jira Python tests (`tools/jira/run_tests.py`). Each prints its seed.
- Running each top-level test alone in CI.

### Known limits

- `Object.assign` and `Object.defineProperty` on `global` or `process.env` are not detected.
- Test callbacks passed by variable are not followed.
- Cross-file helpers are not followed.
- The jest fake-timer check is file-wide.
- A global patch restored in `finally` is accepted even if the test awaits while it is installed (node runs top-level tests in a file one at a time).
- The static rules are heuristics. Random order and running each top-level test alone are the dynamic backstops.

### Exemptions

Any rule can be waived on one line (or the line above) with:

```js
// independence-ok: <reason>
```

The reason is required. Exemptions and their reasons are printed in the check's summary.

## Reproducing a seed

A failing randomized run prints its seed first. Re-run with the same seed:

- node: `node --test --test-randomize --test-random-seed=<n> tests/*.test.cjs` (with `tsx` for TypeScript tests)
- jest: `jest --runInBand --randomize --seed=<n>`
- Python: `PF_TEST_SEED=<n> python tools/jira/run_tests.py`

## Reviewer checklist

Each test sets up its own state; it passes alone, in any order, and with the shell environment changed; no fake timers, globals or env changes outlive the test.
