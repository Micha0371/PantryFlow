# KAN-121 TEST-04 — independent tests (design)

**Status:** for owner approval, 2026-11-22.

## Rule (owner, 2026-11-22)

No test may depend on:
- execution order;
- another test's result or side effects;
- shared mutable state;
- anything else outside the test: the shell or CI environment, wall-clock time, machine speed, local files.

Each test sets up its own starting state.

A test is one `test(...)` (node), one `it(...)` (jest), one pgTAP file, or one Maestro flow. Steps inside one test may build on each other; separate tests may not.

## Decisions

| # | Question | Decision (owner, 2026-11-22) |
|---|---|---|
| D1 | Integration tests share four reserved accounts and one mail inbox | **Unique accounts per test.** Each test creates its own accounts with unique emails and deletes exactly the accounts it created. The e2e fixtures keep their reserved accounts, plus a guard that fails fast when a second run is active. |
| D2 | Maestro flows build on data left by earlier flows | **Own seed per flow.** The fixture script seeds what each flow needs, so any flow can run alone. `npm run test:e2e` still runs them all. |

## Approaches considered

- **Fix the findings only:** fast, but nothing stops the smell from coming back. The owner asked for a review for this smell, so this is rejected.
- **Guards only:** random order would stay green, because node shuffles only top-level tests and the shared state sits in subtests.
- **Chosen:** fix the findings, then enforce the rule with guards that can expose it:
  - random order everywhere;
  - a ban on nested subtests;
  - the smell named in reviewer briefs.

## Work packages (in order, one PR each)

| Package | Content | Runs without Docker or phone? |
|---|---|---|
| **P1 Unit and component tests** | Linear-time checks compare a large input against a small one, with no fixed time limit (`email-confirmation.test.cjs`, `tools/jira/test_safety.py`); hosted-runner tests get a minimal explicit environment, a temp working directory and a longer timeout; restore `requestAnimationFrame`; per-render arrays instead of module-level ones; `native-tooling` writes to a temp directory | Yes |
| **P2 In-memory database tests** | `database.test.cjs`: each test gets its own database state, rows and role; no nested subtests | Yes |
| **P3 Integration tests** | The D1 helper in `local-stack.ts`: unique emails, deleting exactly the created ids, mail filtered by recipient. Convert every integration file to top-level tests with their own accounts. `email-confirmation` reads `otp_expiry` from `supabase/config.toml` | Needs Docker |
| **P4 Guards** | `--test-randomize` (seed printed) for node unit and integration tests, and `jest --randomize`, in the npm scripts used by the local gate and CI. A check script fails on nested subtests (`t.test(` inside a test) and runs in `test:fast` and CI. A reviewer-brief line for this smell is added to the repo's review checklist | Partly (the integration run needs Docker) |
| **P5 E2E flows** | Per-flow seed steps in `scripts/e2e-fixtures.ts`; each flow's header lists its seed; a reserved-account lock against a second run. Verified by running each flow alone once, then the full suite | Needs Docker and the phone or emulator |

## Owner calls (proposed; not yet confirmed)

- pgTAP files (`supabase/tests/database/*.sql`) count as one test each: steps run in one transaction that is rolled back. They meet the rule as written.
- `environment.test.sql` asserts Postgres 17 on purpose, as a guard on the local stack, so it stays.

## Acceptance (from KAN-121)

- Every review finding is fixed or recorded as an owner-accepted exception.
- Unit, component and integration suites pass in random order with several seeds, and the seed is printed in CI logs.
- The nested-subtest check runs in the local gate and in CI, and passes.
- Tests that touch `EXPO_PUBLIC_*` or other environment values pass whatever those values are set to in the shell.
- Every Maestro flow passes when run alone on fresh fixtures.

## Not in scope

New test coverage, test speed, and the TEST-01 timeouts (KAN-107).
