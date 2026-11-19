# UX-04 Faster Item Entry Implementation Plan (KAN-94)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return on the Add Item name field saves the item and keeps the form open for the next one, so adding several items needs no repeated navigation.

**Architecture:**
- The change stays within `app/add-item.tsx`.
- `onSave` gains a mode: `close`, used by the Add Item button and unchanged, or `next`, used by Return.
- The existing `useItemMutation` lock and the provider's `addItem` (client duplicate check plus database index) stay the only write path.

**Tech Stack:** Expo / React Native 0.88, TypeScript, `node:test` screen tests, Maestro on the local stack.

**Spec:**
- [KAN-94](https://michaelwuerthner.atlassian.net/browse/KAN-94) acceptance criteria, plus the Codex QA-04 refinement: stay on the form after a save, and preserve entered information on every error.
- Owner choice of 2026-11-19: **Return saves and stays.**

**Order:** implement after UX-02 (KAN-92). Task 2's device journey runs after the search journey and counts its rows.

**Process (owner, 2026-11-19):** Sonnet implementers and focused Sonnet reviews, then one final Opus branch review. Proportionate process. Preserve existing behavioral regression assertions.

## Global Constraints

- **Return on the name field** (`returnKeyType="next"`, `submitBehavior="submit"`, as on the Shopping tab):
  - saves with the current category and location;
  - on success, clears the name, keeps category, location and focus, and shows a confirmation line;
  - announces the save.
- **The Add Item button** saves and closes, exactly as today.
- **Cancel** reads **Done** once at least one item was saved in this visit. Both close without a prompt, because nothing unsaved is lost.
- **Errors:**
  - Invalid input (empty, too long, no household) shows the existing translated error, with no navigation and no data loss.
  - A failed save (duplicate, network) keeps the entered name, category and location.
  - The confirmation line is replaced by the error.
- **At most one item per intent:** Return plus button, repeated Return, or Return during a pending save. This uses the existing `busy` guard and the `run` lock.
- **Defaults:** category and location stay optional with the existing defaults (`other`, `pantry`), so a name-only add never blocks.
- **Status:** new items stay `in_stock`. The Add form has no status field, so KAN-94's "keeps selected status" does not apply; record that as a deviation.
- **Duplicates:** strict duplicate prevention is unchanged, and items saved earlier in the same visit count as duplicates.
- **Strings:** new strings go into `lib/i18n/en.ts` only. German suggestions go in the PR for KAN-60. `t()` has no interpolation, so the saved name is its own text.
- **Not in scope:** new buttons, bulk entry (UX-05), redesign or new dependencies.

## Review Focus

1. **The save resolves after the screen closed** (Done tapped mid-save): no state update after unmount, no navigation, and the item exists once.
2. **The save resolves after the user typed the next name:** a success must not clear text typed during the pending save. Clear only if the field still holds the submitted text, or keep the field read-only while busy, as today (`editable={!busy}`). If the field stays read-only, verify on the phone that this doesn't close the keyboard or drop focus between items. If it does, keep the field editable and use the "still holds the submitted text" rule instead.
3. **Duplicate of an item saved seconds earlier in the same visit:** the existing duplicate error appears and the name stays.
4. **Hardware or IME Return sending submit twice:** one item.
5. **TalkBack after a Return save:** focus stays in the name field, and the announcement is spoken once.

---

### Task 1: Return saves and stays

**Files:**
- Modify: `pantry-flow/app/add-item.tsx`
- Modify: `pantry-flow/lib/i18n/en.ts`
- Test: `pantry-flow/tests/add-item-entry.test.cjs` (screen harness as in `tests/screens.test.cjs`, which loads `app/add-item.tsx` with stubs)

**Interfaces:**
- Consumes: `usePantryItems().addItem`, `useItemMutation().run(operation, success, failure)`, `announce(message)`.
- Produces: testID `add-item-saved` for the confirmation line. Existing testIDs `add-item-name`, `add-item-save` and `add-item-cancel` are unchanged; the cancel button's label changes to Done.

**Behavior detail:**
- The confirmation line shows `t('item_added_prefix')` followed by the saved name as separate text. It sits in a polite live region, and `announce` speaks `${name}, ${t('item_added_announcement')}`.
- After success the name input is re-focused.

- [ ] **Step 1: Write the failing screen tests**:
  - `Return with a valid name adds once, clears the name, keeps category and location, stays open and shows the confirmation`;
  - `Return with an empty or overlong name shows the existing error and adds nothing`;
  - `a duplicate (including one saved earlier in this visit) shows the duplicate error and keeps the name`;
  - `a failed save keeps name, category and location`;
  - `Return then the Add Item button while busy creates one item`;
  - `repeated Return while busy creates one item`;
  - `the Add Item button still saves and closes`;
  - `Cancel reads Done after a Return save and closes without adding`;
  - `a save resolving after close does not navigate or update state`.
- [ ] **Step 2: Run** `node --test tests/add-item-entry.test.cjs` (from `pantry-flow/`). Expected: FAIL.
- [ ] **Step 3: Implement** `onSave(mode: 'close' | 'next')` with Return wired to `next`. Add the en strings:

  | Key | English |
  |---|---|
  | `item_added_prefix` | Added: |
  | `item_added_announcement` | added |
  | `common_done` | Done |

  Check first whether `common_done` already exists, and reuse it if so.
- [ ] **Step 4: Run** the new test file, then `npm run test:fast`. Expected: PASS. Existing add-item assertions in `screens.test.cjs` stay unmodified apart from wiring.
- [ ] **Step 5: Commit** `feat(pantry): Return saves and keeps Add Item open for the next item (KAN-94)`.

### Task 2: Device journey, tap counts and coverage

**Files:**
- Create: `pantry-flow/.maestro/slice-3-entry.yaml`
- Modify: `pantry-flow/scripts/e2e-fixtures.ts` (an `entry-verify` command)
- Modify: `pantry-flow/scripts/run-e2e.cjs`
- Modify: `docs/testing/coverage-matrix.md`

**Journey** (after `search-verify`):
1. Tap the add button.
2. Type `Oats` and press Return → `add-item-saved` is visible and the name field is empty.
3. Type `Tea` and press Return.
4. Type `Rice` and press Return → the duplicate error is shown and `Rice` stays in the field.
5. Tap Done → the list shows Oats and Tea.

`entry-verify` asserts:
- the pantry rows are exactly Milk, Rice, Rye flour, Oats and Tea;
- Oats and Tea have the default category and location and status `in_stock`;
- nothing was written for the other household.

- [ ] **Step 1: Write** the flow, `entry-verify` and the runner order: `… search-verify → slice-3-entry → entry-verify → confirmation flows`. The keyboard stays open throughout. Return is sent with Maestro `pressKey: Enter`; do not use `hideKeyboard` (see the device notes: it may act as Back).
- [ ] **Step 2: Record tap counts** before and after in the coverage matrix. Count taps beyond typing:
  - one item: before, add + save, plus a keyboard dismiss where the keyboard covers Save; after, add + Return + Done, or add + the Add Item button;
  - five items: before 10–15; after 7.
- [ ] **Step 3: Coverage matrix:** add a "UX-04 coverage — KAN-94" section with ENTRY-01… rows and ENTRY-E2E-01, plus a phone keyboard check marked pending owner (Return key label, focus kept, TalkBack announcement).
- [ ] **Step 4: Run** `npm run test:fast` and `npm run test:integration`. Expected: PASS. The device run and keyboard check happen with the owner present.
- [ ] **Step 5: Commit** `test(pantry): device journey, tap counts and coverage for faster entry (KAN-94)`.
