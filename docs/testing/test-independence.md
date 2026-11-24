# Test independence

KAN-121 (TEST-04). Design: [2026-11-22-kan-121-test-independence-design.md](../planning/2026-11-22-kan-121-test-independence-design.md).

## The rule

No test may depend on execution order, on another test's result or side effects, on shared mutable state, or on anything outside the test (shell or CI environment, wall-clock time, machine speed, local files). Each test sets up its own starting state.

**What counts as one test:** one `test(...)` (node), one `it(...)` (jest), one pgTAP file, or one Maestro flow. Steps inside one test may build on each other; separate tests may not.

Nested subtests (`t.test`) are fine. They are a problem only when they share mutable state. Legitimate Unicode fixtures are fine too; only invisible or look-alike whitespace characters written literally in source are flagged.

## Guards

Static check: `npm run test:independence` (`pantry-flow/scripts/check-test-independence.cjs`, the first step of `test:fast`). It parses test sources with the TypeScript compiler API, so strings and comments are never matched as code. It scans the test files with every rule below and, with the `invisible-whitespace` rule only, `pantry-flow/scripts/**/*.{cjs,js,mjs,ts,cts,mts,tsx}`. Scripts are not tests, so the other rules do not apply to them; the same `// independence-ok: <reason>` exemption works there. The scripts scan exists because PR #64 put literal invisible characters (U+200B, U+200F, U+FEFF, U+200D, U+200C) into `check-test-independence.cjs` itself and only a reviewer caught it. The summary line's file count includes the scripts.

| Rule | Catches |
| --- | --- |
| `module-state` | File-level, describe-level or parent-test bindings mutated inside a test or nested-subtest callback. Hooks such as `beforeEach` are not mutation regions. |
| `global-patch` | `global`, `globalThis`, `process.env` or a member of the unshadowed built-ins `console`, `Date`, `Math`, `JSON`, `Intl` assigned or deleted in a test, or the file-level `mock.method(<one of those>, ...)` from `node:test`, without a restore in `finally`, `t.after` or a describe-level/file-level `afterEach` (for `mock.method`: `<result>.mock.restore()`, `mock.restoreAll()` or `mock.reset()`). A file-level `after`/`afterAll` is not a restore (it runs once, after all tests). `t.mock.method` is always allowed. |
| `fake-timers` | File-level `mock.timers.enable` not directly followed by a `try` whose `finally` resets it; jest `useFakeTimers` without `useRealTimers` in `finally` or `afterEach`. `t.mock.timers` is always allowed. |
| `invisible-whitespace` (tests and `pantry-flow/scripts/`) | Literal U+00A0, U+00AD, U+2000-U+200F (except ZWJ/ZWNJ between two visible characters), U+2028/2029, U+202F, U+205F-U+2064, U+3000 and non-leading U+FEFF. Escapes and all other Unicode are allowed. |
| `focused-test` | `.only`. |

Dynamic checks catch what static rules cannot:

- Random order on every run: node (`--test-randomize`), jest (`--randomize --showSeed`) and the Jira Python tests (`tools/jira/run_tests.py`). Each prints its seed.
- Running each top-level test alone in CI (`npm run test:isolated`).
- A component run that matches no test fails, also in a checkout below a dot folder such as `.verification` (`pantry-flow/tests/jest-config.test.cjs`). The `jest-expo` preset would let an empty run pass.

### Known limits

- Only `invisible-whitespace` looks beyond tests (`pantry-flow/scripts/`); `module-state`, `global-patch`, `fake-timers` and `focused-test` check test files only. Other source folders are not scanned.
- `Object.assign` and `Object.defineProperty` on `global`, `process.env` or the built-ins are not detected, nor are writes through an alias (`const c = console; c.error = f`) or to nested members such as `Date.prototype`.
- Global writes inside hooks (for example a describe-level `beforeEach` that patches a global) are not scanned.
- Test callbacks passed by variable are not followed.
- Cross-file helpers are not followed.
- The jest fake-timer check is file-wide.
- A global patch restored in `finally` is accepted even if the test awaits while it is installed (node runs top-level tests in a file one at a time).
- The static rules are heuristics. Random order and running each top-level test alone are the dynamic backstops.

### Exemptions

Any rule can be waived on the finding's own line, or on a comment-only line directly above it, with (a trailing waiver covers only its own line):

```js
// independence-ok: <reason>
```

The reason is required. Exemptions and their reasons are printed in the check's summary.

## Reproducing a seed

A failing randomized run prints its seed first. Re-run with the same seed:

- node: `node --test --test-random-seed=<n> <same files>`
- TypeScript tests: `npx tsx --test --test-random-seed=<n> <same files>`
- jest: `npx jest --runInBand --randomize --seed=<n>` (the seed may be negative)
- Python: `PF_TEST_SEED=<n> python tools/jira/run_tests.py`

A node seed reproduces the order only with the same file list.

Supported node range: `^24.16.0 || ^26.1.0 || >=27.0.0` (`--test-randomize` and `--test-random-seed` need node 26.1, or 24.16 on the 24 line). CI runs node 26.

## Reviewer checklist

Each test sets up its own state; it passes alone, in any order, and with the shell environment changed; no fake timers, globals or env changes outlive the test.
