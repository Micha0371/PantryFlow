# KAN-121 TEST-04 independent tests — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every test is independent of order, of other tests and of its environment, and guards keep it that way.

**Architecture:** five parts, one PR each, matching design packages P1–P5:
- Parts 1, 2, 3 and 5 are independent of each other. Part 4 (guards) starts only after Parts 1–3 are merged, because its independence check runs against the converted suite.
- Part 3 starts after KAN-61 (PR #60) is merged, because it converts `profile-language.integration.ts`.
- Each part branches from current `main` and runs as its own SDD pass: its own ledger, its own final review and its own PR.

**Tech Stack:**
- node:test (node 26, `--test-randomize`, `--test-random-seed`);
- tsx for the integration tests;
- jest (`--randomize`, `--seed`, `--showSeed`);
- PGlite with `clone()`;
- local Supabase stack with mailpit;
- Python unittest for `tools/jira`;
- Maestro.

**Spec:** [2026-11-22-kan-121-test-independence-design.md](2026-11-22-kan-121-test-independence-design.md) (owner-approved 2026-11-22, including D1, D2 and both owner calls). Ticket: KAN-121 (TEST-04).

## Global Constraints

- **The rule:** no test may depend on execution order, on another test's result or side effects, on shared mutable state, or on anything outside the test (shell or CI environment, wall-clock time, machine speed, local files). Each test sets up its own starting state.
- **What counts as one test:** one `test(...)` (node), one `it(...)` (jest), one pgTAP file, or one Maestro flow. Steps inside one test may build on each other; separate tests may not.
- **Behavior is preserved:** a converted file keeps every assertion it had. Splitting a scenario never drops a check, and a check that needs earlier steps keeps those steps inside its own test.
- **Credentials:** never read `pantry-flow/.env` or `.env.verification.local`; never print keys or tokens.
- **Local stack only:** integration and e2e code talks only to the local stack. `local-stack.ts` `validateLocalStatus` stays the entry check.
- **Account deletion:** delete only accounts a test created (by exact id) or the four reserved e2e emails. Never bulk-delete by pattern.
- **Low RAM machine:** run the node suite with `--test-concurrency=2`. Push only after a green gate.
- **Git:** no `git worktree remove --force`, no force-push without the owner.

## Review Focus

1. **A split that silently drops a check.** Each converted file is compared before and after by the number of `assert` calls; Tasks 4, 7, 8 and 9 record both counts in the report.
2. **Unique test accounts left behind after a failure.** The helper deletes them in `finally`. Task 5 has a test that removal deletes exactly the created accounts and keeps others.
3. **The independence check misfiring** (Part 4 as revised on 2026-11-23):
   - a false positive on legitimate structure: nested subtests that share no mutable state, code inside strings, escaped Unicode fixtures, file-level setup;
   - a false negative on a real violation from the project's history;
   - CRLF files.

   Task 10 covers all three: unit fixtures for true and false positives, and a corpus of real historical versions.
4. **A printed seed that doesn't reproduce the order.** Task 11 checks that running twice with the same seed gives the same order.
5. **A test fixed for order but still reading the shell environment.** Task 2's tests run with conflicting `EXPO_PUBLIC_*` values set in the shell.

---

## Part 1 (P1): unit and component tests

Branch `pantryflow/kan-121-test-independence` (holds the design and this plan).

### Task 1: Linear-time checks without a fixed time limit

**Files:**
- Modify: `pantry-flow/tests/email-confirmation.test.cjs` (test 'the email shape check runs in linear time')
- Modify: `tools/jira/test_safety.py` (`test_credential_email_check_runs_in_linear_time`)

**Interfaces:** Produces nothing shared.

- [ ] **Step 1: Rewrite the node check.** For each of the four existing shapes, compare 10× input sizes:
  - build each shape at n = 10 000 (small) and n = 100 000 (large), keeping the current shape strings;
  - `medianMs(fn, runs = 5)` is a local helper using `performance.now()`;
  - assert `large < 40 * small + 5`, with message `` `small ${small} ms, large ${large} ms` ``.

  Quadratic code grows about 100× and linear about 10×; the 5 ms floor absorbs sub-millisecond noise.
- [ ] **Step 2: Prove it catches quadratic behavior.**
  - Temporarily replace `isEmailShape` in the test with `s => { for (let i = 0; i < s.length; i++) s.indexOf('@', i); return true; }`.
  - Run `node --test tests/email-confirmation.test.cjs`. Expected: FAIL on the linear-time test.
  - Revert the stub.
  - Note (2026-11-22): this stand-in discards the `indexOf` result, so V8 removes the loop and it cannot fail the check; use a stand-in that consumes the result (for example accumulating `c += s.indexOf('@', i)` and returning `c >= 0`).
- [ ] **Step 3: Same change in Python.** Use `statistics.median` over 5 `time.perf_counter()` runs, with the same sizes and the same bound (`large < 40 * small + 0.005`).
  - Prove it fails with a quadratic stand-in passed to the same helper.
  - Run `python -m unittest discover -s tools/jira -p test_*.py`. Expected: all pass.
- [ ] **Step 4: Run under load.**
  - Run the node file 3 times while `node -e "for(;;){}"` runs in the background (stop it afterwards). Expected: PASS each time.
- [ ] **Step 5: Commit** `test: linear-time checks compare input sizes instead of a fixed time limit (KAN-121)`.

### Task 2: Hosted-runner tests with an explicit environment

**Files:**
- Modify: `pantry-flow/tests/hosted-runner.test.cjs`
- Modify: `pantry-flow/tests/hosted-validation-build.test.cjs`

**Interfaces:** Produces `childEnv(overrides: Record<string,string>): Record<string,string>`, local to each file. It returns only `PATH`, `SystemRoot` and `TEMP`/`TMP` (when present) plus the overrides.

- [ ] **Step 1: Show the dependence.**
  - Run `EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_secret_x node --test tests/hosted-runner.test.cjs tests/hosted-validation-build.test.cjs`.
  - Record the result in the report. Expected: at least one failure, or the children receiving the shell values. If it passes, record that, and keep Step 2 anyway because the children still inherit the shell.
- [ ] **Step 2: Change every `spawnSync`:**
  - `env: childEnv({...})` instead of `{ ...process.env, ... }`;
  - `timeout: 30000`;
  - the first hosted-runner test copies `scripts/verify-hosted.cjs` into a `fs.mkdtempSync` folder and runs from there, as the other two tests already do, so the app root's `.env` files are never read;
  - remove temp folders in `finally`;
  - `hosted-validation-build` gets the same `childEnv` and timeout; check whether `scripts/build-email-validation.cjs` reads files from the app root, and if so run a temp copy too.
- [ ] **Step 3: Rerun.** Run the Step 1 command and the plain `node --test` on both files. Expected: PASS for both.
- [ ] **Step 4: Commit** `test: hosted-runner tests use an explicit child environment and temp copies (KAN-121)`.

### Task 3: Restore globals, per-test state, temp files

**Files:**
- Modify: `pantry-flow/tests/form-footer.test.cjs`, `pantry-flow/tests/keyboard-overlap.test.cjs`: save `global.requestAnimationFrame` and `global.cancelAnimationFrame` before overriding, and restore them in `finally` (or `t.after`).
- Modify: `pantry-flow/tests/input.test.cjs`, `screens.test.cjs`, `shopping-edit.test.cjs`, `shopping-screen.test.cjs`:
  - the module-level `announced` / `pushes` arrays move into the per-test render or fixture function, which returns them;
  - remove the `.length = 0` resets.
- Modify: `pantry-flow/tests/native-tooling.test.cjs`: write to an `fs.mkdtempSync(path.join(os.tmpdir(), 'pf-native-tooling-'))` folder instead of the repo's `.verification/`, and remove it in `finally`. If the script under test needs `.verification` under the app root, pass the folder the way the script already allows, or copy the script into the temp folder as in Task 2.

**Interfaces:** none shared.

- [ ] **Step 1: Make the changes above.** Assertions stay unchanged.
- [ ] **Step 2: Run each touched file alone, in random order, with seeds 1, 2 and 3.**
  - Run `node --test --test-randomize --test-random-seed=<s> <file>`. Expected: PASS.
  - Run every top-level test of each touched file alone with `--test-name-pattern "^<exact name>$"`. Expected: PASS each.
- [ ] **Step 3: Check the repo is untouched.** Run `git status --short` after the native-tooling test. Expected: nothing under `.verification/` created by the test (compare a listing before and after).
- [ ] **Step 4: Commit** `test: restore globals, keep state per test, write to temp folders (KAN-121)`.

Part 1 gate: `npm run typecheck && node --test --test-concurrency=2 tests/*.test.cjs && npm run test:components && npm run test:safety` and the Python unittest command.

---

## Part 2 (P2): in-memory database tests

Branch `pantryflow/kan-121-database-tests` from `main`.

### Task 4: `database.test.cjs` as independent top-level tests

**Files:**
- Modify: `pantry-flow/tests/database.test.cjs`

**Interfaces:** Produces these helpers, local to the file:
- `freshDatabase({ through }: { through: '00002' | '00003' | '00004' }): Promise<Ctx>`, where `Ctx = { db, home(id): string, as(id, role?): Promise<void>, insert(name?, creator?, household?, category?, location?): Promise<{ rows: { id: string }[] }>, close(): Promise<void> }`.
  - The `auth` stub schema, the roles, `uuid_generate_v4`, the permissive grants before 00002, and users `alice`/`bob` are created exactly as today.
  - `as(alice)` is active when the context is returned.
- Optional template caching: a file-level map of promises holding one migrated PGlite per `through` value, from which each test gets `await template.clone()`. A template is never queried or changed by a test.

- [ ] **Step 1: Record the before state.** Count the `assert` calls and record the file's duration from one run, for the report.
- [ ] **Step 2: Split into top-level tests** with the current names. Each test calls `freshDatabase`, seeds exactly what it asserts on, and closes in `finally`. The tests:
  - '00003 aborts on legacy duplicate names without merging or deleting': `through: '00002'`, then the legacy-conflict steps that are setup today;
  - 'shopping migration preserves existing pantry and household data': `through: '00003'` plus a seeded item, then 00004;
  - the other seven: `through: '00004'`, each seeding its own `item` (and for 'duplicate add…', the `Oat milk` rename it depends on today, as its own first step);
  - no `t.test`, and no clean-up `DELETE` whose only job is resetting state for a later test.
- [ ] **Step 3: Run alone and in random order.**
  - Run each test alone with `--test-name-pattern`, then `--test-randomize` with seeds 1, 2 and 3. Expected: PASS.
  - The `assert` count is at least the Step 1 count. Report the duration change.
- [ ] **Step 4: Commit** `test: database tests run independently on their own PGlite (KAN-121)`.

---

## Part 3 (P3): integration tests with unique accounts (D1)

Branch `pantryflow/kan-121-integration-tests` from `main`, after PR #60 is merged. Needs Docker and the local stack (`npm run db:start`).

### Task 5: Unique test accounts helper

**Files:**
- Modify: `pantry-flow/tests/integration/local-stack.ts`
- Create: `pantry-flow/tests/integration/test-users.integration.ts`
- Modify: `pantry-flow/package.json` (`test:integration` gains the new file)

**Interfaces:** Produces:
- `type TestUser = { client: SupabaseClient; id: string; email: string; household: string }`.
- `createTestUsers(stack, count: number, label: string): Promise<TestUser[]>`:
  - email `pf.test.${label}.${randomUUID().slice(0, 8)}.${i}@example.com`;
  - confirmed, with the name metadata `Alice`/`Bob` by index (0 → Alice, 1 → Bob, more → `User ${i}`);
  - signed in, with `household` read the way `fixtures()` does today.
- `removeTestUsers(admin, users: { id: string }[]): Promise<void>`: deletes exactly those ids, and treats an already-deleted user as success.
- `withTestUsers(count, label, run: (users: TestUser[], stack) => Promise<void>)`: creates the users, runs, and always removes them.
- `fixtures()`, `cleanup()` and `emails` stay unchanged for the e2e script only.

- [ ] **Step 1: Write the failing test** `test-users.integration.ts`:
  - 'test users are unique per call and removal deletes exactly them':
    1. create two sets of 2;
    2. assert all four emails are distinct;
    3. remove the first set;
    4. the first set's emails can no longer sign in (an `error` on `signInWithPassword`);
    5. the second set still signs in;
    6. remove the second set in `finally`.
  - 'withTestUsers removes its users when the body throws': assert `rejects`, then that the user is gone (admin `getUserById` returns an error or null).
- [ ] **Step 2: Run it.** `npx tsx --test tests/integration/test-users.integration.ts`. Expected: FAIL (`createTestUsers` not exported).
- [ ] **Step 3: Implement the helpers** in `local-stack.ts`.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit** `test: unique per-test accounts for integration tests (KAN-121)`.

### Task 6: Convert profile-language and pantry-shopping

**Files:**
- Modify: `pantry-flow/tests/integration/profile-language.integration.ts`: `withUsers` becomes `withTestUsers(2, 'lang', …)`.
- Modify: `pantry-flow/tests/integration/pantry-shopping.integration.ts`: one linear test today; it uses `withTestUsers` instead of `fixtures()`/`cleanup()`.

- [ ] **Step 1: Convert.** Assertions unchanged.
- [ ] **Step 2: Run both files** with `--test-randomize` seeds 1 and 2. Expected: PASS.
  - `grep -n "fixtures(\|cleanup(" tests/integration/*.integration.ts` shows neither file.
- [ ] **Step 3: Commit.**

### Task 7: Convert `behavior.integration.ts`

**Files:** Modify `pantry-flow/tests/integration/behavior.integration.ts`.

- [ ] **Step 1: Record the `assert` count.**
- [ ] **Step 2: Split both outer tests into top-level tests** with the current subtest names. Each uses `withTestUsers` and creates its own rows:
  - the `Milk` row and `fridge` row it needs;
  - in the shopping group, its own `pantryA`, `milk` and the other rows.

  The test that moves `b` into `a`'s household and deletes `b` gets its own users. A test that needs a state an earlier subtest produced (for example `completed_at` set) produces it itself as its first steps.
- [ ] **Step 3: Run alone, then in random order.** Run each test alone with `--test-name-pattern`, then the file with `--test-randomize` seeds 1, 2 and 3. Expected: PASS; the `assert` count is at least Step 1's.
- [ ] **Step 4: Commit.**

### Task 8: Convert `shopping-data` and `pantry-status`

**Files:**
- Modify: `pantry-flow/tests/integration/shopping-data.integration.ts`: three top-level tests, each with `withTestUsers` and its own rows. 'exactly `[linked.id]`' then holds by construction.
- Modify: `pantry-flow/tests/integration/pantry-status.integration.ts`: `scenario()` uses `createTestUsers`/`removeTestUsers`, and the sign-ins at today's lines 54 and 104 use the user's own `email` instead of `emails[0]`.

- [ ] **Step 1: Convert.** Record the `assert` counts before and after.
- [ ] **Step 2: Run each test alone and in random order** (seeds 1, 2 and 3). Expected: PASS.
- [ ] **Step 3: Commit.**

### Task 9: Convert `email-confirmation`

**Files:**
- Modify: `pantry-flow/tests/integration/email-confirmation.integration.ts`
- Modify: `pantry-flow/tests/integration/confirmation-mail.ts`

**Interfaces:** Produces `otpExpirySeconds(): number` in `confirmation-mail.ts`:
- reads `[auth.email] otp_expiry` from `pantry-flow/supabase/config.toml` (a small line parser scoped to the `[auth.email]` section);
- throws if the value is missing or not a positive integer.

- [ ] **Step 1: Write the failing unit test.** In the same file as a top-level test: 'otp expiry is read from supabase/config.toml', asserting `otpExpirySeconds() === 60`, which is today's config value. Run it. Expected: FAIL (not exported).
- [ ] **Step 2: Implement `otpExpirySeconds`.** Then:
  - the expiry wait becomes `otpExpirySeconds() * 1000 + 5000` minus the time elapsed since the link was issued;
  - the mail poll deadline in `confirmationLink` becomes 30 000 ms;
  - signups use unique emails `pf.test.signup.${randomUUID().slice(0, 8)}@example.com` (and `confirm` the same way), and each test deletes exactly the user it signed up, by id, looked up by exact email in `finally`;
  - the post-subtest PKCE assertion (`challenges.length >= 3`, every `s256`) moves into each test, over that test's own challenges.
- [ ] **Step 3: Run each test alone, then the file in random order.** Expected: PASS.
- [ ] **Step 4: Commit.**

Part 3 gate: `npm run test:local` (database reset, SQL tests, integration tests). Expected: rc 0. Then `grep -n "fixtures(\|cleanup(\|emails\[" tests/integration/*.integration.ts`. Expected: no matches.

---

## Part 4 (P4): guards (revised 2026-11-23)

Branch `pantryflow/kan-121-guards` from `main` (`b9d0a69`; Parts 1–3 merged, baseline green).

**Owner correction (2026-11-23), binding for this part:**
- No blanket ban on nested node subtests. Target unintended shared state and order dependence, not legitimate test structure.
- Reproducible random seeds where supported.
- Address fake-timer leakage and accidental invisible whitespace, without prohibiting legitimate Unicode test fixtures.
- Demonstrate that each permanent guard detects actual violations without producing unacceptable false positives.

This replaces the earlier Tasks 10–12. The earlier "nested-subtest" rule is withdrawn.

**Guard design:**
- **Static checks** read the syntax tree through the TypeScript compiler API (`typescript`, already a dev dependency), not text patterns. Code inside strings or comments is never matched.
- **Exemptions:** any rule can be waived on one line with `// independence-ok: <reason>`. The reason is required and is printed in the check's summary.
- **Dynamic checks** catch what static rules can't: random order on every run, and each top-level test run alone in CI.

### Task 10: Static independence check, proven on real history

**Files:**
- Create: `pantry-flow/scripts/check-test-independence.cjs`
- Create: `pantry-flow/tests/test-independence-check.test.cjs`
- Modify: `pantry-flow/package.json`: add `"test:independence": "node scripts/check-test-independence.cjs"`, and make `test:fast` start with `npm run test:independence &&`.

**Interfaces:** Produces `findViolations(files: { path: string; text: string }[]): { path: string; line: number; rule: Rule; detail: string }[]`, exported. Run directly, the script:
- scans `pantry-flow/tests/**/*.{cjs,js,ts,tsx}` and the jest test paths from `jest.config.cjs`;
- skips helper modules that define no tests (for example `helpers.cjs`, `local-stack.ts`) for the `module-state` rule only;
- prints `path:line rule detail` per finding and the list of exemptions with their reasons;
- exits 1 on any finding.

Rules (`Rule`):
- **`module-state`:** a file-level `let`/`var` binding is reassigned, or a file-level array, `Map`, `Set` or object literal is mutated (`push`, `splice`, `set`, `delete`, `clear`, `length =`, property assignment), inside a `test`/`it` callback or in a function called from one. Read-only file-level constants, `require`s and pure helpers are allowed.
- **`global-patch`:** inside a test callback, an assignment to `global.X`, `globalThis.X` or `process.env.X`, or a `delete` of one, with no restore of the same property in that test's `finally`, `t.after` or `afterEach`, or a file-level `afterEach`.
  - File-level normalisation outside any test is allowed (for example `delete process.env.EXPO_PUBLIC_DEFAULT_LOCALE` at load).
- **`fake-timers`:**
  - node: `mock.timers.enable(…)` on the file-level `mock` from `node:test` must be directly followed by a `try` whose `finally` calls `mock.timers.reset()`. `t.mock.timers` is always allowed, because node resets it per test.
  - jest: `jest.useFakeTimers()` requires `jest.useRealTimers()` in a `finally` or `afterEach` of the same file.
- **`invisible-whitespace`:** a literal (not escaped) U+00A0, U+00AD, U+2000–U+200F, U+2028/2029, U+202F, U+205F–U+2064, U+3000, or a U+FEFF that isn't a leading BOM, anywhere in a test source. Escapes such as ` ` and every other Unicode character (umlauts, emoji, CJK) are allowed.
- **`focused-test`:** `test.only`, `it.only`, `describe.only` or `{ only: true }`.

Nested subtests (`t.test`) are not a rule. They are flagged only through `module-state` or `global-patch` when they actually share mutable state.

- [ ] **Step 1: Write the failing unit tests.** True and false positives per rule, each with fixture text in the test:
  - `module-state`:
    - flags `const announced = []; test('a', () => { announced.push(1); })`;
    - flags `let n = 0; test('a', () => { n++; })`;
    - does not flag `const theme = load(…); test('a', () => { use(theme); })`;
    - does not flag a per-test `const arr = []` inside the callback;
    - does not flag nested `t.test` subtests that share only read-only constants.
  - `global-patch`:
    - flags `test('a', () => { global.fetch = f; })`;
    - does not flag the same with `finally { global.fetch = original; }`;
    - does not flag with a file-level `afterEach` that restores the property;
    - does not flag `fs.writeFileSync(p, 'global.fetch = 1')`, because it's a string.
  - `fake-timers`:
    - flags `mock.timers.enable(); render(); try { … } finally { mock.timers.reset(); }`, because render runs outside the try;
    - does not flag `mock.timers.enable(); try { render(); … } finally { mock.timers.reset(); }`;
    - does not flag `t.mock.timers.enable()`.
  - `invisible-whitespace`:
    - flags a literal U+00A0 inside a string;
    - does not flag `' '`, `'Müsli 🥛'` or a leading BOM.
  - `focused-test`: flags `test.only(`.
  - Exemption:
    - an exempt line with a reason is not flagged and appears in the exemption list;
    - an exempt line without a reason is flagged;
    - CRLF fixtures report the same line numbers as LF fixtures.

  Run `node --test tests/test-independence-check.test.cjs`. Expected: FAIL (module missing).
- [ ] **Step 2: Implement** `findViolations` and the script. Run the unit tests. Expected: PASS.
- [ ] **Step 3: Detection on real history (true positives).** Run `findViolations` on these historical file versions, read with `git show <sha>:<path>`, and record the result in the report:

  | Version | Expected rule |
  |---|---|
  | `0de9678:pantry-flow/tests/input.test.cjs` | `module-state` (file-level `announced`) |
  | `0de9678:pantry-flow/tests/form-footer.test.cjs` | `global-patch` (`requestAnimationFrame` not restored) |
  | `30651e2:pantry-flow/tests/shopping-edit.test.cjs` | `fake-timers` (render outside the try) |
  | `9200940:pantry-flow/tests/integration/behavior.integration.ts` | `invisible-whitespace` |
  | `17c2419:pantry-flow/tests/integration/email-confirmation.integration.ts` | `global-patch` (`globalThis.fetch`) |

  Each must be flagged with the expected rule. If one isn't, fix the rule (not the expectation) or record why the history doesn't contain that violation.
- [ ] **Step 4: False-positive check on the current suite.** Run `npm run test:independence` on `main`'s tests.
  - Every finding is classified in the report as a real violation (fix it in this task, test-only change) or a false positive (fix the rule; exempt only if the rule can't express it, with the reason).
  - Target: zero findings, and no more than 3 exemptions across the suite, each with a reason the final review accepts.
  - Report the number of files scanned and the runtime.
- [ ] **Step 5: Commit.**

### Task 11: Random order everywhere, with a reproducible seed

**Files:**
- Modify: `pantry-flow/package.json`:
  - `test` and `test:legacy` become `node --test --test-randomize tests/*.test.cjs`;
  - `test:components` becomes `jest --runInBand --randomize --showSeed`;
  - `test:safety` and `test:integration` add `--test-randomize`.
- Create: `tools/jira/run_tests.py`:
  - discovers `test_*.py` in `tools/jira`, flattens the suite and shuffles it with `random.Random(seed)`;
  - takes the seed from env `PF_TEST_SEED`, or picks one at random;
  - prints `Randomized test order seed: <seed>` first; exits non-zero on failure;
  - puts `tools/jira` on `sys.path`, so `import jira` works from any working directory.
- Modify: `.github/workflows/jira-tooling.yml`: the test step runs `python tools/jira/run_tests.py`.
- Create: `docs/testing/test-independence.md`:
  - the rule and the definition of a test, from the design;
  - each guard, what it catches, and its known limits;
  - the exemption syntax;
  - how to reproduce a seed: node `--test-random-seed=<n>`, jest `--seed=<n>`, Python `PF_TEST_SEED=<n>`;
  - the reviewer checklist line: "Each test sets up its own state; it passes alone, in any order, and with the shell environment changed; no fake timers, globals or env changes outlive the test."
- Modify: `.github/pull_request_template.md`: under Validation add "Tests are independent ([test-independence](../docs/testing/test-independence.md)): no shared mutable state, no order, environment or timing dependence."

- [ ] **Step 1: Check tsx forwards the flag.** Run `npx tsx --test --test-randomize tests/integration/local-stack.test.ts`. Expected: output contains `Randomized test order seed`. If not, use `node --import tsx --test --test-randomize` and ledger the ruling.
- [ ] **Step 2: Apply the script and workflow changes.**
- [ ] **Step 3: Check seeds reproduce.**
  - Run `node --test --test-random-seed=7 --test-reporter=spec tests/language.test.cjs` twice and diff the test order. Expected: identical.
  - Same for jest (`--seed=7`, compare the order with `--verbose`) and for `run_tests.py` with `PF_TEST_SEED=7`.
- [ ] **Step 4: Gate.**
  - `npm run test:fast` and `python tools/jira/run_tests.py`. Expected: PASS, with seeds printed.
  - `npm run test:local`. Expected: PASS, seed printed.
  - `EXPO_PUBLIC_DEFAULT_LOCALE=de EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_secret_x npm run test:legacy`. Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 12: Every top-level node test alone, in CI

**Files:**
- Create: `pantry-flow/scripts/run-tests-alone.cjs`:
  - for each `tests/*.test.cjs`, run it once with `--test-reporter=junit` to collect top-level test names;
  - rerun each name alone with `--test-name-pattern "^<regex-escaped name>$"`;
  - print failures as `file :: name`; exit 1 if any fail.
- Create: `pantry-flow/tests/run-tests-alone.test.cjs`: unit tests for the exported `escapeName(name)` (names with `(`, `[`, `.`, `+`, `?`, `$` and quotes match only themselves) and `topLevelNames(junitXml)` (nested testcases excluded).
- Modify: `pantry-flow/package.json`: `"test:isolated": "node scripts/run-tests-alone.cjs"`.
- Modify: `.github/workflows/pantryflow-tests.yml`: the fast job runs `npm run test:isolated` after `test:fast`.

- [ ] **Step 1: Write the failing unit tests, run them.** Expected: FAIL (module missing).
- [ ] **Step 2: Implement.** The unit tests pass.
- [ ] **Step 3: Run it.** Run `npm run test:isolated` once locally (record the duration). Expected: exit 0.
- [ ] **Step 4: Demonstrate detection.** Temporarily add a scratch test file with two tests where the second depends on the first (shared module variable). `test:isolated` must fail on the second. The independence check's `module-state` rule must flag it too. Remove the scratch file.
- [ ] **Step 5: Commit.**

The CI workflow change runs only when the owner runs CI; report it as not run locally.

**Part 4 acceptance:**
- Every rule has true-positive and true-negative unit tests.
- The real-history corpus is flagged as expected.
- The current suite has zero findings and at most 3 justified exemptions.
- Seeds reproduce for node, jest and Python.
- `test:isolated` passes locally and catches the scratch dependency.

## Part 5 (P5): e2e flows with their own seed (D2)

Branch `pantryflow/kan-121-e2e-seeds` from `main`. Needs Docker, the local stack and the phone or emulator; device steps run with the owner, per the device-run memory.

### Task 13: Reserved-account run lock

**Files:**
- Create: `pantry-flow/scripts/e2e-lock.ts`
- Create: `pantry-flow/tests/e2e-lock.test.cjs`
- Modify: `pantry-flow/scripts/e2e-fixtures.ts`: `prepare` acquires the lock first; `cleanup` releases it.

**Interfaces:** Produces:
- `acquireRunLock(file: string, pid: number, isAlive: (pid: number) => boolean): void`. It throws `Error('Another e2e run is active (pid <n>)')` when the file holds a live pid. A dead pid's lock is replaced. It writes `{ pid, startedAt }`.
- `releaseRunLock(file: string, pid: number): void`. It removes the lock only if it holds `pid`.
- The lock file is `.verification/e2e-run.lock`.

- [ ] **Step 1: Write the failing tests** in a temp folder:
  - a fresh lock is written;
  - a live pid throws the exact message;
  - a dead pid is replaced;
  - release by another pid keeps the file;
  - release by the owner removes it.

  Run them. Expected: FAIL.
- [ ] **Step 2: Implement and wire the lock into `prepare`/`cleanup`.** Run the tests. Expected: PASS.
- [ ] **Step 3: Commit.**

### Task 14: A seed and a verify step per flow

**Files:**
- Modify: `pantry-flow/scripts/e2e-fixtures.ts`:
  - commands `seed:<flow>` and `verify:<flow>` for `slice-1-1`, `slice-2-shopping`, `slice-3-status`, `slice-3-search`, `slice-3-entry` and `confirmation`;
  - every seed starts by resetting the reserved accounts (today's `prepare` body without the env-file write) and then creates exactly what that flow's first steps expect (read each flow's header comment and first assertions);
  - every verify asserts only that flow's own effects relative to its seed.
- Modify: `pantry-flow/scripts/run-e2e.cjs`:
  - for each flow: `seed:<flow>`, then Maestro, then `verify:<flow>`;
  - `--flow <name>` runs one flow;
  - the env-file write stays in `e2e:prepare`.
- Modify: each `.maestro/*.yaml` header comment, to name its seed instead of "after flow X".

Ruling to confirm with the owner at the Part 5 PR: the confirmation flows (register, complete, reset, expired, resend) form **one** test, `confirmation`. The confirmation link must open the same app that registered, because PKCE binds it, so the flows can't run alone. The scenario as a whole runs alone from its own seed.

- [ ] **Step 1: Implement the seeds, verifies and runner changes.**
- [ ] **Step 2: Device runs (with the owner):**
  - `npm run test:e2e -- --flow <name>` for each flow on fresh fixtures. Expected: PASS each;
  - then the full `npm run test:e2e`. Expected: PASS;
  - then flows in a different order: `--flow slice-3-entry`, then `--flow slice-1-1`. Expected: PASS.
- [ ] **Step 3: Commit.** Record the runs in the coverage matrix.

**Controller note (2026-11-24), supersedes the Task 13 file and lock-path details above:**
- The lock is machine-wide, not per worktree: `os.tmpdir()`/`pantryflow-e2e-run.lock` (override `PANTRY_E2E_LOCK_FILE`), implemented as `scripts/e2e-lock.cjs` (not `.ts`, so `run-e2e.cjs` can use it). All worktrees share one local stack and the same four reserved accounts.
- `run-e2e.cjs` holds the lock for the whole run and releases it on exit, failure, Ctrl+C and termination. `e2e-fixtures.ts` does not acquire it: every command (prepare, seed, verify, cleanup, confirmation steps) refuses while another live run holds it, checked before any stack access or cleanup; the runner's own calls pass via `PANTRY_E2E_RUNNER_PID`. Standalone `e2e:cleanup` during a live run is therefore refused.
- Task 15 (added by the controller after the 2026-11-23 phone session; approved by the owner's "go with 121 part 5"): the login helper's email-typing retry over Wi-Fi; a note on running `node scripts/e2e-proxy.cjs` for manual phone checks; and three Task 14 review minors (the order-coupled verify message, a Bob read in `seed:slice-1-1`, and the proxy fault reset at the start of `slice-1-1.yaml`). After the final review, the device reruns owed are the confirmation scenario (its seed now gives Alice a row) and one flow that uses the login helper (narrowed retry).
- Part 5 final-review rulings: the login helper retries the email typing only (the exact-text assertion catches a doubled character); the password is typed once and sign-in submitted once, so a doubled password character or a failed sign-in fails the flow. `--flow` rejects extra arguments and repeats. The confirmation seed gives Alice one Milk row so the new user's "empty household" is checked against a real foreign row.

---

## Execution notes

- Subagents: Sonnet implementers and task reviewers; Opus for each part's final whole-branch review and for fix rounds 4–5. Always pass the model explicitly.
- Every implementer and reviewer brief includes the Global Constraints and names the smell: shared state, order, environment, timing.
- Each part's PR body lists the `assert` counts before and after for every converted file.
