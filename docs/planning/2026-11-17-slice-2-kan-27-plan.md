# Slice 2 quality: clean up the important Sonar findings in PantryFlow code and tooling — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (recommended here) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** close every open SonarCloud **bug** and every **Blocker, Critical or Major** finding in PantryFlow's own code (`pantry-flow/` and `tools/jira/`) without changing what the app, the scripts or the tests do. No rule suppression, exclusion or quality-gate change.

**Ticket (Package 4):** KAN-27, Low.
- The owner first approved the ten findings in the redaction script and the catalog snapshot.
- On 2026-11-17 the owner extended it: "please plan for all more important ones … change ticket accordingly".

**Spec:**
- KAN-27 as updated on 2026-11-17;
- `docs/planning/slice-2-implementation-plan.md`: engineering constraints;
- the project's existing tests as the behavior contract.

**Baseline:** `main` at `9a6f2f6` (PR #37). Branch `pantryflow/kan-27-sonar-tooling`, worktree `build/s9`.

## What exists (SonarCloud public API, 2026-11-17; quality gate OK)

The project has 176 open findings: 4 bugs, 27 Critical, 54 Major and 95 Minor.
- **Not in scope:**
  - `frontend/` and `backend/`, a template scaffold from the repository's first commit. The root README says the app lives in `pantry-flow/`. This also excludes 2 of the 4 bugs.
  - All 95 Minor findings.
- **In scope:** 48 findings in 21 files, including the remaining 2 bugs.

| Area | File | Findings |
| --- | --- | --- |
| Startup diagnostics | `scripts/redact-startup-log.cjs` | S8786 (backtracking regex, line 6), S5843 (regex complexity 45 of 20, line 7) |
| Catalog tooling (SQL) | `scripts/catalog-snapshot.sql` | 9 × S1192: `'public'`, the five table names, the keys `'table'` and `'definition'`, `'authenticated'` |
| | `scripts/baseline-inventory.sql` | 3 × S1192 (lines 7, 8, 10) |
| pgTAP tests | `supabase/tests/database/shopping.test.sql` | 4 × S1192 (lines 6, 7, 23, 48) |
| | `supabase/tests/database/slice_1_1.test.sql` | 4 × S1192 (lines 6, 7, 18, 28) |
| Bugs and regexes | `scripts/verify-hosted.cjs:252` | **S9383 bug:** the top-level async IIFE has no rejection handler |
| | `lib/email-confirmation.ts:37` (app) | S8786: `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| | `tools/jira/jira.py:153` | S8786: the same email pattern |
| App readability | `components/Button.tsx:38,53`, `app/auth/callback.tsx:41`, `lib/shopping-data.ts:143`, `tests/integration/behavior.integration.ts:40` | 5 × S3358 (nested ternaries) |
| | `lib/pagination.ts:5` | S3776 (cognitive complexity 17 of 15, `fetchAllPages`) |
| App rendering | `app/(tabs)/_layout.tsx:27,36,45` | 3 × S6478 (`tabBarIcon` components defined inside the layout) |
| | `lib/auth.tsx:82`, `lib/i18n/index.tsx:51` | 2 × S6481 (context value object recreated on every render) |
| Test proxy | `scripts/e2e-proxy.cjs:12` | S3776 (complexity 19 of 15, the request handler) |
| Jira CLI | `tools/jira/jira.py` | S1192 (`"/browse/"` × 4), 2 × S3776 (`input_fields` 30, `execute` 48) |
| | `tools/jira/test_jira.py`, `test_hierarchy.py`, `test_safety.py` | 8 × S5778 (more than one call that can raise inside `assertRaises`) |

**Existing coverage and runners:**
- `npm run test:fast` (typecheck, Node and Jest);
- `npm run test:local` (pgTAP, integration);
- `python -m unittest discover -s tools/jira -p "test_*.py"`, with its own `jira-tooling.yml` workflow;
- the Maestro suite in the Android CI job.

Also:
- the redaction is used only by failure-only workflow steps;
- the snapshot and inventory SQL are also run against hosted for baseline evidence, which this package doesn't do.

## Decisions for the owner

- **D1, scope boundary. Recommended:** as above. `frontend/` and `backend/` stay out; deleting the scaffold would be its own ticket. The 95 Minor findings stay out.
- **D2, one PR. Recommended:** one PR with one commit per task, so each area can be reviewed on its own. Alternative: two PRs, tooling and tests first, app code second.
- **D3, phone check. Recommended: yes, about 15 minutes.** Tasks 5 and 6 change app code (tab icons, button styles, context values). The emulator CI runs every flow but doesn't assert visuals. The owner looks at the tab bar, the buttons and sign-in on the phone, with a new build.

## Global constraints

- **No behavior change:**
  - the app renders and behaves the same;
  - the scripts produce the same output;
  - the tests assert the same things, with the same pgTAP plan counts and the same unittest cases.
- **No suppression:** no `NOSONAR`, `# noqa`-style markers, rule exclusions, `sonar-project` or quality-gate changes.
- **Scope:**
  - no new dependency;
  - no schema, migration, hosted-configuration, workflow or baseline-tag change;
  - no fix for Minor findings, even nearby ones.
- **The read-only SQL stays read-only:** `BEGIN READ ONLY … COMMIT`, catalog reads only, no application user rows.
- **Test first** wherever behavior is pinned:
  - before/after equivalence (an oracle saved before the change) where a rewrite must be identical;
  - a timing test for every regex Sonar flags as backtracking.
- **The local stack only.** No hosted query.

## Review focus

1. **Regex equivalence (Tasks 1 and 4):**
   - each rewritten pattern accepts and rejects exactly what the old one did, including empty strings, a missing `@`, several `@`, leading or trailing dots, whitespace, Unicode and the 254-character cap for email;
   - each runs in linear time on a 100,000-character adversarial input.
2. **SQL identity (Tasks 2 and 3):**
   - the snapshot and inventory JSON are equal before and after on the same database;
   - the pgTAP files keep their `plan(n)` and pass;
   - a constant moved into a CTE or psql variable never changes which rows a test inserts or checks.
3. **Context memoization (Task 6):** after memoizing, a consumer still sees new values when `session`, `loading`, `error` or `locale` change. Functions that read state through refs stay correct. A stale closure after memoization is the main risk.
4. **Tab icons (Task 6):** the moved icon components still get `focused`, `size` and the same colors. The tab names, titles and order are unchanged.
5. **Jira CLI refactors (Task 8):**
   - `execute` and `input_fields` keep every guard: preview by default, exact `--apply`, the write guard, the project lock and input validation;
   - each split-out exception test still asserts the same exception from the same call.

---

### Task 1: startup redaction without a backtracking or oversized regex

**Files:** `pantry-flow/scripts/redact-startup-log.cjs`; test `pantry-flow/tests/startup-diagnostics.test.cjs`.

- [ ] **Step 1: Oracle.**
  - Write `.verification/kan27/redaction-corpus.txt`, ignored. It holds every label variant (15 labels × `_`, `-`, space or none × `:`, `=`, `|` × casing), the URL userinfo forms (`user@`, `user:pass@`, `user:@`, none), the existing test's lines and plain diagnostic lines.
  - Save the current output to `redaction-before.txt`.
- [ ] **Step 2: Tests:**
  - `'every secret label form is redacted'`, as a table;
  - `'URL userinfo is redacted in every form and other URLs are untouched'`;
  - `'adversarial lines redact in linear time'`: 100,000 characters, under 100 ms.

  Run them. The tables pass, because they pin today's behavior. Record whether the timing test fails on the old code, and at what length.
- [ ] **Step 3: Implement.**
  - **URL userinfo:** a single non-overlapping pattern (`([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@`).
  - **Labels:** find each `[:=|]`, normalize the word run before it (lowercase, separators removed) and match it against a set of the 12 normalized labels. No single big alternation.
  - Keep the ANSI, JWT and `sb_` handling, and CRLF.
- [ ] **Step 4:** tests and `npm run test:fast` pass. The corpus diff is empty; record it in the ledger.
- [ ] **Step 5: Commit** `KAN-27: startup redaction without a backtracking or oversized regex`.

### Task 2: catalog tooling SQL without repeated literals

**Files:** `pantry-flow/scripts/catalog-snapshot.sql`, `pantry-flow/scripts/baseline-inventory.sql`.

- [ ] **Step 1: Before output.**
  - With the local stack migrated (disposable local data), run both files with `npx --no-install supabase db query --local --file <file> --output-format json`.
  - Save them to `.verification/kan27/{catalog,inventory}-before.json`.
- [ ] **Step 2: Refactor.**
  - One leading CTE of constants per file: schema, table names as `name[]`, roles.
  - `= ANY(...)` or a join to the CTE instead of repeated literals.
  - Object keys come from column aliases through `to_jsonb(row)` where the same key literal repeats.
  - Keep `BEGIN READ ONLY … COMMIT`, section names, `ORDER BY` and privilege checks. No literal may repeat three or more times.
- [ ] **Step 3: After output and comparison.**
  - Compare the parsed JSON for equality, and print any differing paths.
  - Expected: equal. If not, fix the SQL.
  - Then a probe in `.verification`: a write inside the same transaction fails as read-only.
- [ ] **Step 4:** `npm run test:fast` passes.
- [ ] **Step 5: Commit** `KAN-27: catalog tooling SQL without repeated literals`.

### Task 3: pgTAP tests without repeated literals

**Files:** `pantry-flow/supabase/tests/database/shopping.test.sql`, `slice_1_1.test.sql`.

- [ ] **Step 1:** run `npm run test:local` and record the pgTAP totals (files, plans, assertions).
- [ ] **Step 2: Refactor** the flagged literals, which are fixture ids, emails and names, into one definition each: a psql variable (`\set`) if `supabase test db` runs the files through psql, otherwise a temporary table or CTE read by the assertions. `plan(n)` and the assertion text stay unchanged.
- [ ] **Step 3:** `npm run test:local` passes with the same totals as Step 1.
- [ ] **Step 4: Commit** `KAN-27: pgTAP fixtures defined once`.

### Task 4: the unhandled promise and the email patterns

**Files:**
- `pantry-flow/scripts/verify-hosted.cjs`;
- `pantry-flow/lib/email-confirmation.ts` and its test (find it with `grep -rl email-confirmation pantry-flow/tests`, or create `tests/email-confirmation.test.cjs`);
- `tools/jira/jira.py` and `tools/jira/test_safety.py` (or the file that holds the credential checks).

- [ ] **Step 1: Failing or pinning tests:**
  - **`verify-hosted.cjs`:** a test that loads it with `run()` rejecting asserts a nonzero exit and a printed message, with no unhandled-rejection warning. If the script can't be loaded without network access, ledger a ruling and pin the handler by a static check instead.
  - **Email, both languages:** an accept/reject table, the same in both. Accepted: `a@b.c`, `first.last@sub.example.com`, Unicode local parts. Rejected: `''`, `a@b`, `a@@b.c`, `a@b.`, `@b.c`, `a b@c.d`, `a@b c.d`, `a@.c` (check what the old pattern does), plus `a:b@c.d` for Jira, whose local part excludes `:`. Generate the expected values from the **old** pattern before changing it.
  - **Timing:** a 100,000-character string under 100 ms in both languages. This runs before the 254-character cap in the app, so it tests the function the regex sits in.
- [ ] **Step 2: Run.** Expected: the tables pass on the old code; the timing and `verify-hosted` tests fail, or are recorded as not observable.
- [ ] **Step 3: Implement.**
  - **`verify-hosted.cjs`:** `.catch` (or `await` inside a `main().catch`) that prints the message and sets `process.exitCode = 1`. The output is otherwise unchanged.
  - **Email:** split on `@` (exactly two parts, no whitespace), then check that the domain has a dot that is neither first nor last, using non-overlapping checks. The result must equal the old pattern on the table.
- [ ] **Step 4:** `npm run test:fast` and the Jira unittest suite pass.
- [ ] **Step 5: Commit** `KAN-27: handle verify-hosted's rejection and check emails without backtracking`.

### Task 5: app readability (nested ternaries, pagination)

**Files:** `components/Button.tsx`, `app/auth/callback.tsx`, `lib/shopping-data.ts`, `tests/integration/behavior.integration.ts`, `lib/pagination.ts`, and their existing tests.

- [ ] **Step 1: Pin first where nothing covers it:**
  - a `Button` style test for `primary`, `secondary` and `danger` × disabled and pressed (background, border, text color, opacity);
  - a `callback` title and button-label test for the `working`, `already` and `invalid` phases, if the screen tests don't already assert them;
  - `shopping-data`'s completed sort order and `pagination`'s six exits (count reached, empty page with complete/incomplete count, short page without count, short page with count, error) are probably covered; find the tests and add only missing cases.

  Run them on the old code. Expected: pass.
- [ ] **Step 2: Refactor.**
  - Replace nested ternaries with lookup objects or small helper functions.
  - Split `fetchAllPages`'s end-of-data decision into a helper so the loop body stays under the complexity limit.
- [ ] **Step 3:** `npm run test:fast` passes; `behavior.integration.ts` passes under `npm run test:local`.
- [ ] **Step 4: Commit** `KAN-27: flatten nested conditions in app code`.

### Task 6: tab icons and context values

**Files:** `app/(tabs)/_layout.tsx`, `lib/auth.tsx`, `lib/i18n/index.tsx`; tests `tests/navigation.test.cjs` (tabs) and the auth and i18n tests.

- [ ] **Step 1: Pin:**
  - the tab layout renders three tabs in the order `index`, `shopping`, `settings`, with their titles, and each `tabBarIcon` gives the right Ionicons name and colors for focused and unfocused states;
  - an auth consumer re-renders with new values when the session, loading or error change;
  - an i18n consumer gets a `t` that translates in the new locale after `setLocale`.

  Run them. Expected: pass.
- [ ] **Step 2: Implement.**
  - The three icons become module-level components (or a factory outside the layout) that receive `focused` and `size`.
  - `auth.tsx` and `i18n` wrap their callbacks in `useCallback` and the value in `useMemo`, with complete dependency lists. No other logic change.
- [ ] **Step 3:** `npm run test:fast` passes.
- [ ] **Step 4: Commit** `KAN-27: stable tab icons and context values`.

### Task 7: test-proxy request handler

**Files:** `pantry-flow/scripts/e2e-proxy.cjs`; its unit test (find it with `grep -rl e2e-proxy pantry-flow/tests`).

- [ ] **Step 1:** confirm that the existing proxy test covers the control endpoints, the read faults, the delayed write, the PKCE guard and pass-through. Add only missing cases, and run them. Expected: pass.
- [ ] **Step 2:** split the handler into small functions (control endpoint, fault reply, PKCE check, forwarding) under the complexity limit, with the same responses, status codes and timing.
- [ ] **Step 3:** the tests and `npm run test:fast` pass. The Android CI in Task 9 exercises the proxy end to end.
- [ ] **Step 4: Commit** `KAN-27: split the test proxy's request handler`.

### Task 8: Jira CLI

**Files:** `tools/jira/jira.py`, `tools/jira/test_jira.py`, `test_hierarchy.py`, `test_safety.py`.

- [ ] **Step 1:** run `python -m unittest discover -s tools/jira -p "test_*.py"` and record the count.
- [ ] **Step 2: Refactor:**
  - add a `browse_url(site, key)` helper for the four `"/browse/"` uses;
  - split `input_fields` and `execute` by command or validation step, under complexity 15, keeping every check and message;
  - in the 8 flagged tests, build inputs outside `assertRaises`, so that only the call under test runs inside it.
- [ ] **Step 3:** the suite passes with the same count. `python tools/jira/jira.py check` still works from a temporary worktree (read-only).
- [ ] **Step 4: Commit** `KAN-27: smaller Jira CLI functions and single-call exception tests`.

### Task 9: Sonar, CI, phone and docs

- [ ] **Step 1:** push the branch (owner approval); the owner opens the PR.
- [ ] **Step 2: SonarCloud PR analysis** (public API, `pullRequest=<n>`). Expected:
  - none of the 48 findings remains;
  - no new Blocker, Critical or Major findings, and no bugs in changed files;
  - the quality gate is OK.

  Check the main branch after the merge.
- [ ] **Step 3: CI.** The owner dispatches the PantryFlow workflow; the Jira tooling workflow runs on the path change. Expected: all jobs pass, including the emulator Android job.
- [ ] **Step 4 (D3):**
  - Build the ARM64 test APK from the head.
  - The owner checks on the phone: the tab bar icons and colors, primary, secondary and danger buttons (disabled and pressed), sign-in, and switching the language, if the app has a switcher.
  - Then a `npm run test:e2e` run, if the owner wants the full suite on the phone.
- [ ] **Step 5: Docs.**
  - **`docs/testing/hosted-verification.md`:** a note that the snapshot and inventory SQL were refactored under KAN-27 and shown identical on the local stack.
  - **`docs/testing/coverage-matrix.md`:** a short KAN-27 note: no behavior change; the evidence is the equivalence checks, CI and the phone check.
  - Commit `KAN-27: record equivalence evidence`.

## Rulings and risks carried into execution

- **48 findings:** bugs plus Blocker, Critical and Major in `pantry-flow/` and `tools/jira/`. The ticket's original ten were part of this set; the eleventh S1192 in the snapshot came from a 2026-11-11 change.
- **Execution mode: inline,** with an Opus final review. The tasks are independent and each one is gated by tests that pin behavior before the change.
- **Oracles stay out of the repository:** old regexes and old SQL output live only in ignored `.verification`, so no flagged pattern is reintroduced into analyzed code.
- **Backtracking may not be observable** for capped inputs, such as the app's 254-character email. The rewrite is still justified by the finding, and the timing tests guard the new code.
- **Biggest risks:**
  - Task 6's memoization: a stale closure, guarded by Review focus 3;
  - Task 8's split of `execute`: a lost guard, guarded by the full unittest suite and Review focus 5.
- **No hosted run.** The SQL's hosted use stays as documented.
- **Jira:** KAN-27's summary and description are updated to this scope before execution (owner, 2026-11-17). It moves to Done only with the owner's approval after the merge.
