# UX-02 Pantry Search Implementation Plan (KAN-92)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a name search field on the Pantry tab that filters the loaded household inventory locally.

**Architecture:**
- A pure `filterItemsByName` helper in `lib/pantry-search.ts` uses the existing `normalizedItemName` rule.
- The Pantry screen owns the query state and renders a search field above the list, plus a distinct no-match state.
- The provider, queries and database are unchanged: the provider already holds the household-scoped full list.

**Tech Stack:** Expo / React Native 0.88, TypeScript, `node:test` with react-test-renderer screen tests, Jest RNTL component tests, Maestro on the local stack.

**Spec:**
- [KAN-92](https://michaelwuerthner.atlassian.net/browse/KAN-92) acceptance criteria;
- D5 revision in the [Slice 3 decision record](2026-11-19-slice-3-decision-record.md), section 2;
- PRD Amendment 1.

**Process (owner, 2026-11-19):** Sonnet implementers and focused Sonnet reviews, then one final Opus branch review. Keep the process proportionate. Preserve existing behavioral regression assertions.

## Global Constraints

- **Filtering:** local only, over `usePantryItems().items` (already household-scoped). No new Supabase query, index, RPC, migration or state library.
- **Matching:**
  - case-insensitive substring match on `normalizedItemName(item.name)` against `normalizedItemName(query)`;
  - query whitespace trimmed;
  - no fuzzy matching, no diacritic folding, no saved searches.
- **Order:** list order is unchanged (newest first). Sort and filters are UX-03 (KAN-93).
- **Display only:** search never writes data, and it never hides the add action.
- **Strings:** new strings go into `lib/i18n/en.ts` only. The German suggestions are listed in the PR for KAN-60, no longer than the English. `t()` has no interpolation, so the query is rendered as its own text and never concatenated into a sentence.
- **Accessibility:** the field has an accessible label; the clear control has a label and a target of at least 48 dp; the result count is announced politely once typing pauses, never per keystroke.
- **Not in scope:** visual redesign, new dependencies, changes to D1–D4, strict pantry uniqueness or RLS.

## Review Focus

1. **Item renamed out of the match while the query is active:** the row disappears from the results at once; the count announcement reflects the new result.
2. **Status selector open while the query changes:** if the open item leaves the results, the selector closes (UX-01B's "never outlives its item" rule applies to the visible list).
3. **Household or user change with an active query:** the query clears, so the new household never starts filtered by the old household's term.
4. **Keyboard open:** a first tap on a result row opens it (no swallowed tap), dragging the list dismisses the keyboard, and the add button stays reachable.
5. **Whitespace-only query:** behaves as an empty query, so the full list shows and no no-match state appears.

---

### Task 1: Search helper

**Files:**
- Create: `pantry-flow/lib/pantry-search.ts`
- Test: `pantry-flow/tests/pantry-search.test.cjs`

**Interfaces:**
- Produces: `filterItemsByName<T extends { name: string }>(items: readonly T[], query: string): readonly T[]`. It returns the same array reference when the trimmed query is empty, so the FlatList data identity stays stable.

- [ ] **Step 1: Write the failing tests**:
  - `an empty or whitespace-only query returns the same array reference`;
  - `matching is a case-insensitive substring of the trimmed query` (`'  mIL '` matches `Milk`, `Buttermilk`; not `Rice`);
  - `German characters lower-case consistently` (`'äp'` matches `Äpfel`; `ae` does not, because there is no folding);
  - `order is preserved`.
- [ ] **Step 2: Run** `node --test tests/pantry-search.test.cjs` (from `pantry-flow/`). Expected: FAIL, module not found.
- [ ] **Step 3: Implement** with `normalizedItemName` from `lib/pantry-data.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(pantry): add the local name filter for pantry search (KAN-92)`.

### Task 2: Search on the Pantry screen

**Files:**
- Modify: `pantry-flow/app/(tabs)/index.tsx`
- Create: `pantry-flow/components/SearchField.tsx`
- Modify: `pantry-flow/lib/i18n/en.ts`
- Test: `pantry-flow/tests/pantry-search-screen.test.cjs`. Reuse the harness pattern of `tests/pantry-list-status.test.cjs`, extracted into `tests/helpers.cjs` only if both files need it.

**Interfaces:**
- Consumes: `filterItemsByName` (Task 1); `announce(message)` from `lib/accessibility.ts`; `usePantryItems()` → `{ householdId, items }`.
- Produces: testIDs `pantry-search`, `pantry-search-clear` and `pantry-search-no-match`, plus the no-match clear button `pantry-search-no-match-clear`.

**Behavior:**
- **When the field shows:** only when the household has at least one item. The empty-pantry state is unchanged and shows no search field.
- **Field:**
  - it sits above the FlatList and does not scroll away;
  - `accessibilityRole="search"` and `accessibilityLabel={t('pantry_search_label')}`;
  - placeholder `t('pantry_search_placeholder')`;
  - `returnKeyType="search"`, and Return only dismisses the keyboard;
  - a clear control appears only when the query is non-empty, labelled `t('pantry_search_clear')`.
- **Results:** FlatList `data={filterItemsByName(items, query)}`, with `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"`.
- **No match:** shown when the query is non-empty and there are no results. It reads `t('pantry_search_no_match_title')`, then the trimmed query as its own `Text` in quotes, then a button `t('pantry_search_clear')` that clears the query. It is visibly different from `EmptyState`.
- **Announcement:** 600 ms after the last query change, when the query is non-empty, announce `t('pantry_search_results_one')` or `${count} ${t('pantry_search_results_many')}`, or `t('pantry_search_no_match_title')` when there are none.
- **Clearing the query:** the household id changes, or the user clears it.
- **Selector:** closes when its item is not in the filtered results. Extend the existing effect from `items` to the visible results.

- [ ] **Step 1: Write the failing screen tests**:
  - `typing filters rows by name and clearing restores the full list`;
  - `a whitespace-only query shows the full list`;
  - `no match shows its own state with the query and a clear action, and no EmptyState`;
  - `an empty pantry shows EmptyState and no search field`;
  - `results follow add, rename, delete and status change while a query is active` (mutate the store, assert rows);
  - `a household change clears the query`;
  - `the selector closes when its item leaves the results`;
  - `the result count is announced once after typing pauses` (fake timers);
  - `search never calls a write` (no provider mutation called by typing or clearing).
- [ ] **Step 2: Run** `node --test tests/pantry-search-screen.test.cjs`. Expected: FAIL.
- [ ] **Step 3: Implement** `SearchField` (TextInput with a search icon and an `Ionicons` `close-circle` clear button, 48 dp target, existing theme tokens) and the screen wiring above. Add the en strings:

  | Key | English |
  |---|---|
  | `pantry_search_label` | Search pantry |
  | `pantry_search_placeholder` | Search items |
  | `pantry_search_clear` | Clear search |
  | `pantry_search_no_match_title` | No matching items |
  | `pantry_search_results_one` | 1 item found |
  | `pantry_search_results_many` | items found |

- [ ] **Step 4: Run** the new test file, then `npm run test:fast`. Expected: PASS. Existing assertions in `pantry-list-status.test.cjs` and `screens.test.cjs` stay unmodified apart from wiring and fixtures.
- [ ] **Step 5: Commit** `feat(pantry): search the pantry list by name (KAN-92)`.

### Task 3: Device journey, evidence and coverage

**Files:**
- Create: `pantry-flow/.maestro/slice-3-search.yaml`
- Modify: `pantry-flow/scripts/e2e-fixtures.ts` (a `search-seed` command)
- Modify: `pantry-flow/scripts/run-e2e.cjs`
- Modify: `docs/testing/coverage-matrix.md`

**Interfaces:**
- Consumes: the testIDs from Task 2.
- Starting state: after `status-verify`.

**Journey:**
1. `search-seed` inserts `Rice` and `Rye flour` for Alice through an ordinary signed-in client, never the admin key.
2. The flow:
   - type `ri` → `Rice` is visible; `Milk` and `Rye flour` are not (`ri` is a substring of 'rice' only);
   - type ` RI ` → the same (`Rice` visible; `Milk` and `Rye flour` not);
   - type `zz` → `pantry-search-no-match` is visible;
   - tap its clear button → `Milk` is visible;
   - tap `Rice` with the keyboard open → the edit screen opens on the first tap; go back.
3. `search-verify` asserts the pantry rows are exactly Milk, Rice and Rye flour, unchanged, because search wrote nothing.

- [ ] **Step 1: Write** the flow, the `search-seed` and `search-verify` commands, and the runner order: `… status-verify → search-seed → slice-3-search → search-verify → confirmation flows`.
- [ ] **Step 2: Coverage matrix:** add a "UX-02 coverage — KAN-92" section with SEARCH-01… rows (helper, screen states, mutation consistency, household reset, selector, announcement, keyboard) and SEARCH-E2E-01, plus A11Y-SEARCH-01 marked pending owner.
- [ ] **Step 3: Run** `npm run test:fast` and `npm run test:integration`. Expected: PASS. The device run (`npm run test:e2e` on the phone, built with `PANTRY_TEST_ARCHITECTURES=arm64-v8a`) and the TalkBack check happen with the owner present:
  - label, clear button and count announcement;
  - no-match focus;
  - keyboard not covering results or the add button.
- [ ] **Step 4: Commit** `test(pantry): device journey and coverage for pantry search (KAN-92)`.
