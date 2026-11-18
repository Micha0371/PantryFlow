# UX-01B (KAN-91): direct pantry status change, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** draft for the owner's review. No implementation starts before approval.

**Goal:** change a pantry item's status directly on the pantry list. Two taps; three when answering the D3 shopping prompt.

**Architecture:**
- **Data layer:** a concurrency-safe, status-only write in `lib/pantry-data.ts`. It is a compare-and-set on `status`, with one disambiguating read and at most one retry.
- **Provider:** `usePantryItems` exposes it under the existing per-item lock, scope guards and CR-01 recovery.
- **Shared prompt hook:** the D3 prompt sequence moves out of the edit screen into a small hook that both screens use.
- **List:** the pantry row splits into two sibling controls. The status control opens an anchored selector built on React Native `Modal`.

**Tech stack:** Expo SDK 58, React Native 0.88, expo-router, supabase-js and PostgREST. Tests use the Node test runner with react-test-renderer, Jest (`jest-expo`) with Testing Library, pgTAP and PostgREST integration on the local stack, and Maestro.

**Spec:** [2026-11-18-ux-01a-direct-status-change-design.md](2026-11-18-ux-01a-direct-status-change-design.md), approved on 2026-11-18. It is referred to below as *the design*, by section number. Also read the Jira ticket KAN-91.

## Global constraints

- **No new dependencies,** no migration, no database function, no state library and no visual redesign.
- **Rules that stay unchanged:** D1–D4, strict pantry uniqueness and RLS.
- **Edit screen:** keeps every function and its status buttons. Its existing tests keep **every assertion and test name**. Existing test files may change only in:
  - module-map wiring for the new hook;
  - fixture realism: saved rows carry `household_id`, as real rows always do.
- **Taps:** at most 2 for a normal change, and at most 3 when answering the prompt, whether accepting or declining.
- **Touch targets:** at least 48×48 dp for the status control and each selector option.
- **Strings (English):**
  - New keys in `lib/i18n/en.ts`: `status_change_hint` "Change status", `item_edit_hint` "Edit item", `status_group_label` "Status", `status_not_changed_title` "Status not changed".
  - List them for German (KAN-60) in the PR description.
  - Labels are joined from separately translated parts with ", ", because the translation function has no placeholders.
- **Announcements:** Android-only, the same policy as `announceError`. iOS is covered by KAN-47.
- **Privacy:** no pantry names, ids, tokens or account data in logs or committed evidence.
- **Branch:** work from `main` after PR #45 is merged. **Risk tier:** medium.

## Review Focus

The five failure modes most likely to bite a user that the design implies but doesn't spell out. Each is pinned by a test in the task named.

1. **Large font scale or long German labels push the menu off-screen.** The menu stays inside the window margins and opens centered when neither side fits. Task 3, `placeMenu` large-menu cases.
2. **A second item is changed while the first item's prompt is still pending (lost or slow dialog).** Answering the old prompt later adds nothing. Task 5, "a newer change invalidates an unanswered prompt".
3. **A list refresh removes the item while its selector is open.** The selector closes without a write. Task 5, "the selector closes when its item leaves the list".
4. **The item was renamed on another device before the prompt.** The prompt and the linked add use the returned name. Tasks 1 and 5, returned-row tests.
5. **The app is backgrounded during the write or the prompt.** No status control stays disabled. Task 5, "a lost prompt leaves the status controls usable".

---

### Task 1: Concurrency-safe status write (data layer and provider)

**Files:**
- Modify: `pantry-flow/lib/pantry-data.ts`
- Modify: `pantry-flow/hooks/usePantryItems.tsx`
- Create: `pantry-flow/tests/pantry-status.test.cjs`
- Create: `pantry-flow/tests/integration/pantry-status.integration.ts`
- Modify: `pantry-flow/package.json`: add the new integration file to the `test:integration` script only.

**Interfaces:**
- **Produces** (in `lib/pantry-data.ts`):
  - `export const PANTRY_STATUS_CONFLICT = 'PF_PANTRY_STATUS_CONFLICT'`
  - `export type StatusWriteResult = { kind: 'changed'; item: PantryItem; previous: StatusKey } | { kind: 'already'; item: PantryItem }`
  - `export async function writeItemStatus(client: SupabaseClient, householdId: string, id: string, previous: StatusKey, next: StatusKey): Promise<StatusWriteResult>`
  - On a confirmed missing row it throws a coded `PANTRY_MISSING` error (the existing constant). After a failed retry it throws a coded `PANTRY_STATUS_CONFLICT` error carrying `current: PantryItem`. It rethrows any API error unchanged.
- **Produces** (in `usePantryItems()`): `setItemStatus(id: string, next: StatusKey): Promise<StatusWriteResult>`.
- **Consumes:** the existing `isMissingPantryItem`, `parseItem`, `STATUSES` and the provider guards (`beginItemMutation`, `dropIfMissing`, `rereadIfUnloaded`, `isCurrent`).

**Algorithm** (the design, 5.11). The code isn't determined by the signature, so here it is:
1. Reject `next` or `previous` values outside `STATUSES` with `Invalid pantry item`.
2. Run `attempt(prev)`: `update({ status: next }).eq('id', id).eq('household_id', householdId).eq('status', prev).select().maybeSingle()`. On an error, throw it. If a row comes back, return `{ kind: 'changed', item: parseItem(row), previous: prev }`.
3. If no row matched, run `read()`: `select('*').eq('id', id).eq('household_id', householdId).maybeSingle()`.
   - On an error, throw it.
   - If there's no row, throw `PANTRY_MISSING`.
   - If `row.status === next`, return `{ kind: 'already', item }`.
   - Otherwise run `attempt(row.status)` once. If that matches nothing too, run `read()` again: no row throws `PANTRY_MISSING`; otherwise throw `PANTRY_STATUS_CONFLICT` with `current`.

**Provider behavior:**
- `previous` is the cached item's status. If it equals `next`, return `{ kind: 'already', item: cached }` with **no API call**.
- No cached item throws `Invalid pantry item`, with no call.
- Uses the same per-item lock as `updateItem` and `deleteItem`.
- **On success:** replace the row by id, only if `isCurrent(scope)`.
- **On a conflict:** replace the row with `error.current`, if current.
- **On `PANTRY_MISSING`:** the existing `dropIfMissing`, plus a re-read.
- **Any other error:** leaves the rows untouched and starts no re-read.

- [ ] **Step 1: Write the failing provider tests** in `tests/pantry-status.test.cjs`. Use a scripted Supabase mock: a queue of `{ data, error }` responses, with each call's method chain, `eq` filters and `update` payload recorded. Build the fixture like `pantry-state.test.cjs`: real provider, real `household-list`, stubbed household scope. Tests:
  - `a status change writes only status, filtered by id, household and the cached status`. Assert:
    - the payload deep-equals `{ status: 'low' }`;
    - the filters are `id=1, household_id=h, status=in_stock`;
    - the result is `{ kind: 'changed', previous: 'in_stock' }`;
    - the row status is `low`.
  - `the returned row replaces the cached one, including a name changed elsewhere`. The CAS row has name `Oat milk`, so the list shows `Oat milk`.
  - `selecting the cached status makes no API call and returns already`.
  - `a database already holding the new status returns already without a write or prompt data`. The CAS gives null, then the read gives status `low`. Assert `kind: 'already'`, 2 calls, and no second update.
  - `a stale cache retries once against the database status and reports it as previous`. The CAS gives null; the read gives `out`; the retry CAS (filter `status=out`) returns a `low` row. Assert `previous: 'out'` and 3 calls.
  - `a second mismatch throws a conflict and adopts the fresh row`. CAS null, read `out`, retry null, read `in_stock`. It rejects with code `PF_PANTRY_STATUS_CONFLICT`. The row shows `in_stock`, and no re-read starts.
  - `a confirmed missing row drops it and re-reads`. CAS null, then read null. It rejects with `PF_PANTRY_MISSING`, the row is gone, and `reads.length` increases by 1.
  - `an error at any step is rethrown, keeps the row and is never treated as missing`. Run 3 sub-cases: errors on the CAS, the read and the retry, using `new Error('offline')` and `{ code: '42501' }`. Each rejects with that same error object, the row is unchanged, and there's no re-read.
  - `the status write shares the per-item lock with updateItem`. While `setItemStatus` is pending, `updateItem('1', …)` rejects with `/pending/` and makes no API call.
  - `a status write that settles after a household change writes nothing into the new scope`. A deferred CAS; change to household `h2`; resolve the read; then resolve the CAS. The new list is unchanged.
- [ ] **Step 2: Run** `node --test tests/pantry-status.test.cjs`. **Expected:** FAIL, because `setItemStatus` and `writeItemStatus` don't exist.
- [ ] **Step 3: Implement** `writeItemStatus` and `setItemStatus` as specified above.
- [ ] **Step 4: Run** `node --test tests/pantry-status.test.cjs tests/pantry-state.test.cjs tests/pantry-data.test.cjs`. **Expected:** PASS.
- [ ] **Step 5: Write** `tests/integration/pantry-status.integration.ts` against real PostgREST, using `localStack()` and `fixtures()`. Call `writeItemStatus` with each user's client. Tests:
  - `a matching compare-and-set returns the row and the previous status`;
  - `zero matched rows return null data without an error`. This pins the `maybeSingle()` assumption.
  - `a concurrent rename survives a status write`: user A renames the item through a second client, then writes the status with the stale previous status. Read back the new name and the new status.
  - `a database already at the target status returns already and leaves updated_at unchanged`;
  - `a stale previous status is retried against the database status`;
  - `a deleted row and a foreign household's row both throw PF_PANTRY_MISSING`.
- [ ] **Step 6: Run** `npm run test:local`. **Expected:** pgTAP passes, and the integration suites pass, including the new file.
- [ ] **Step 7: Commit:** `feat(pantry): concurrency-safe status-only write (UX-01B)`.

### Task 2: Shared D3 prompt hook, with the edit screen moved onto it

**Files:**
- Create: `pantry-flow/hooks/useShoppingPrompt.ts`
- Create: `pantry-flow/tests/shopping-prompt.test.cjs`
- Modify: `pantry-flow/app/edit-item/[id].tsx`: remove the module-private `ask` and `notice`, and the `prompting` state and orchestration, and use the hook instead.
- Modify, **wiring and fixtures only:** `pantry-flow/tests/edit-item-prompt.test.cjs`, `pantry-flow/tests/edit-item-remove.test.cjs`, `pantry-flow/tests/screens.test.cjs`.

**Interfaces:**
- **Produces:**
  - `export function useShoppingPrompt(): { prompting: boolean; offer(args: { saved: PantryItem; previous: StatusKey; current: () => boolean }): Promise<void>; invalidate(): void }`
  - `export function ask(title: string, message: string, addLabel: string, skipLabel: string): Promise<boolean>`
  - `export function notice(title: string, message: string, okLabel: string): Promise<void>`
  - `ask` and `notice` are moved unchanged and exported for the list's failure notice.
- **Consumes:** `offersShoppingAdd`, `useShoppingItems().addItem`, `useHouseholdScope().householdId` (read through a ref, updated on every render), `shoppingErrorKey` and `useTranslation`.

**Rules for `offer`** (the design, 5.4 and 5.11):
- **Return without asking** if `!current()`, or `!offersShoppingAdd(previous, saved.status)`, or `saved.household_id !== householdRef.current`.
- **Otherwise:**
  1. Take a new token and set `prompting` true.
  2. Ask, using `saved.name`.
  3. If the answer is Add and `valid()` holds, add `{ name: saved.name, pantryItemId: saved.id }`.
  4. If the add fails and `valid()` still holds, show `notice(t('shopping_prompt_failed_title'), t(shoppingErrorKey(e)), t('common_ok'))`.
  5. Clear `prompting` in `finally`, if mounted.
- **`valid()`** means `current()`, the token unchanged, and the household unchanged.
- **The token changes on:** `invalidate()`, every new `offer`, and unmount.

- [ ] **Step 1: Write the failing hook tests** in `tests/shopping-prompt.test.cjs`, using a host component and the existing loader with stubbed `react-native` `Alert`, shopping and household-scope stubs. Tests:
  - `offers only for the four D3 transitions`: across all 9 previous→next pairs, `Alert.alert` is called exactly for in_stock→low, in_stock→out, low→out and out→low.
  - `adds the saved name and id, not any caller value`;
  - `a saved item from another household is never offered or added`;
  - `current() false before or after the answer prevents the prompt or the add`;
  - `invalidate() before the answer makes a later Add do nothing`;
  - `a failed add shows the translated shopping notice; the hook never touches pantry state`;
  - `prompting is true exactly while the dialog or its notice is unanswered`;
  - `an answer after unmount adds nothing and shows no notice`.
- [ ] **Step 2: Run** `node --test tests/shopping-prompt.test.cjs`. **Expected:** FAIL, because the module is missing.
- [ ] **Step 3: Implement** `hooks/useShoppingPrompt.ts`.
- [ ] **Step 4: Move the edit screen onto the hook.** `onSave` calls `offer({ saved, previous, current })` after `updateItem`, and **awaits** it, so Save stays locked until the prompt is answered. That keeps today's behavior. Cancel's rule uses `prompting` from the hook.
- [ ] **Step 5: Update existing tests, wiring and fixtures only:**
  - **Wiring:** add `'@/hooks/useShoppingPrompt': load('hooks/useShoppingPrompt.ts', {…the same stubs, plus '@/hooks/household-scope': { useHouseholdScope: () => ({ householdId: 'h' }) }})` to each map that loads the edit screen.
  - **Fixtures:** add `household_id: 'h'` to the saved and base fixtures.
  - **The check:** `git diff` of these three files shows no changed `assert` line and no renamed or removed `test(` line.
- [ ] **Step 6: Run** `npm run test:fast`. **Expected:** PASS. All existing edit-screen tests pass unchanged, plus the new hook tests.
- [ ] **Step 7: Commit:** `refactor(pantry): share the D3 prompt sequence with a household check (UX-01B)`.

### Task 3: Anchored status selector

**Files:**
- Create: `pantry-flow/lib/status-menu.ts`, the pure positioning logic.
- Create: `pantry-flow/components/StatusSelector.tsx`
- Create: `pantry-flow/tests/status-menu.test.cjs`
- Create: `pantry-flow/tests/components/status-selector.test.tsx`
- Modify: `pantry-flow/lib/i18n/en.ts`: `status_group_label`.

**Interfaces:**
- **Produces:**
  - `export type Frame = { x: number; y: number; width: number; height: number }`
  - `export function placeMenu(anchor: Frame, menu: { width: number; height: number }, screen: { width: number; height: number }, insets: { top: number; bottom: number }, margin = 16, gap = 4): { top: number; left: number; placement: 'below' | 'above' | 'center' }`
  - `export function StatusSelector(props: { anchor: Frame | null; itemName: string; current: StatusKey; onSelect(next: StatusKey): void; onDismiss(): void; returnFocusTo?: React.RefObject<View> }): JSX.Element | null`. It renders nothing when `anchor` is null.
- **Behavior** (the design, 5.2 and 5.6):
  - a transparent `Modal` with `onRequestClose={onDismiss}`;
  - a full-screen scrim `Pressable` that dismisses;
  - the container has `accessibilityRole="radiogroup"` and `accessibilityLabel={`${t('status_group_label')}, ${itemName}`}`;
  - three options in the order In Stock, Low, Out, each a `Pressable` with `accessibilityRole="radio"`, `accessibilityState={{ checked }}`, `minHeight: 48`, testID `status-option-<status>`, and a check icon on the current one;
  - **selecting the current option calls `onDismiss`,** not `onSelect`;
  - **focus:** after layout, accessibility focus moves to the current option. On close, it returns to `returnFocusTo`.
  - The menu is measured with `onLayout` and stays invisible until placed.

- [ ] **Step 1: Write the failing tests.** `tests/status-menu.test.cjs`:
  - `opens below when there is room above the bottom inset`;
  - `flips above for the last row near the bottom`;
  - `keeps a 16 dp margin from the right and left edges`;
  - `opens centered when neither side fits (large font scale)`, using a menu height greater than the free space on both sides;
  - `never overlaps the top inset`.

  `tests/components/status-selector.test.tsx` (Testing Library):
  - `renders a radio group labelled with the item name`;
  - `marks only the current status as checked`;
  - `each option has at least 48 dp height`;
  - `choosing another status calls onSelect once`;
  - `choosing the current status, the scrim or Android back calls onDismiss and never onSelect`;
  - `renders nothing without an anchor`.
- [ ] **Step 2: Run** `node --test tests/status-menu.test.cjs`, then `npx jest tests/components/status-selector.test.tsx`. **Expected:** FAIL.
- [ ] **Step 3: Implement** `placeMenu` and `StatusSelector`.
- [ ] **Step 4: Run** both commands. **Expected:** PASS.
- [ ] **Step 5: Commit:** `feat(pantry): anchored status selector (UX-01B)`.

### Task 4: Pantry row with sibling controls

**Files:**
- Modify: `pantry-flow/components/PantryItem.tsx`
- Create: `pantry-flow/tests/components/pantry-item-row.test.tsx`
- Modify: `pantry-flow/lib/i18n/en.ts`: `status_change_hint`, `item_edit_hint`.

**Interfaces:**
- **Produces:**
  - `PantryItem(props: { item: PantryItem; onPress(): void; onStatusPress(anchor: Frame, ref: React.RefObject<View>): void; editDisabled?: boolean; statusDisabled?: boolean; statusBusy?: boolean; statusExpanded?: boolean })`
  - The card is a `View` containing two sibling `Pressable`s:
    - **content:** testID `pantry-item-${id}` (unchanged, used by Maestro), role "button", label `${name}, ${t(cat_…)}, ${t(loc_…)}`, hint `t('item_edit_hint')`, `disabled={editDisabled}`;
    - **status:** testID `pantry-item-status-${id}`, role "button", label `${name}, ${t(status_…)}`, hint `t('status_change_hint')`, `accessibilityState={{ disabled, busy, expanded }}`, `minWidth` and `minHeight` of 48, stretched to the row height, with an outlined badge, a chevron, and a small spinner when busy. It shows the **current** status even when busy.
  - The status press runs `measureInWindow` on its own ref, then calls `onStatusPress(frame, ref)`.
- **Consumes:** `Frame` from Task 3.

- [ ] **Step 1: Write the failing tests:**
  - `content and status are sibling controls, the status control is not inside the content control`;
  - `pressing status never calls onPress`;
  - `labels carry name, details and the current status`;
  - `the status control is at least 48 by 48 dp`;
  - `busy shows the old status with busy state; disabled props reach accessibilityState`;
  - `editDisabled disables only the content control`.
- [ ] **Step 2: Run** `npx jest tests/components/pantry-item-row.test.tsx`. **Expected:** FAIL.
- [ ] **Step 3: Implement** the row.
- [ ] **Step 4: Run** the Jest suite, then `npm run test:fast`. **Expected:** PASS. Existing `screens.test.cjs` list tests still pass; they stub `PantryItem`.
- [ ] **Step 5: Commit:** `feat(pantry): split the pantry row into edit and status controls (UX-01B)`.

### Task 5: List wiring: commit, prompt, failures and lifecycle

**Files:**
- Modify: `pantry-flow/app/(tabs)/index.tsx`
- Modify: `pantry-flow/lib/accessibility.ts`: `export function announce(message: string): void`, Android-only like `announceError`.
- Modify: `pantry-flow/lib/i18n/en.ts`: `status_not_changed_title`.
- Create: `pantry-flow/tests/pantry-list-status.test.cjs`

**Interfaces:**
- **Consumes:**
  - `setItemStatus` and `StatusWriteResult` (Task 1);
  - `useShoppingPrompt`, `notice` (Task 2);
  - `StatusSelector` and `Frame` (Task 3);
  - the `PantryItem` props (Task 4);
  - `useItemMutation`, `itemSaveErrorKey` and `offersShoppingAdd`.

**Screen behavior** (the design, 5.3–5.6 and 5.11):

*Screen state:*
- one list-wide `useItemMutation()`;
- `pendingId: string | null`;
- `open: { id; anchor; ref } | null`;
- `const prompt = useShoppingPrompt()`.

*While a write is in flight:* every status control is disabled, and the content of the item with `pendingId` is disabled.

*Selector:*
- It opens from `onStatusPress`, unless the mutation is busy.
- It closes automatically if its item is no longer in `items`.

*`onSelect(next)`:*
1. Close the selector and call `prompt.invalidate()`.
2. Inside `run(current => …)`:
   1. Set `pendingId`.
   2. `await setItemStatus`.
   3. Clear `pendingId` in `finally`.
   4. If `!current()`, return.
   5. For `changed` with `offersShoppingAdd(result.previous, result.item.status)`, call `void prompt.offer({ saved: result.item, previous: result.previous, current })`. It is **not awaited**, so the list lock covers only the write.
   6. Otherwise, call `announce(`${result.item.name}, ${t('status_' + result.item.status)}`)`.

*Failure callback:* `void notice(t('status_not_changed_title'), t(itemSaveErrorKey(e)), t('common_ok'))`. `useItemMutation` only calls it while the screen is current.

*Focus cleanup:* invalidate the prompt.

- [ ] **Step 1: Write the failing screen tests** in `tests/pantry-list-status.test.cjs`, using the existing loader with stubbed native primitives (`Modal` as a host component), a stubbed provider whose `setItemStatus` the test controls, stubbed shopping and household scope, and a focus callback like `edit-item-prompt.test.cjs`. Tests:
  - **D3 matrix:**
    - `changing to the same status closes the selector without any call`;
    - `in stock to low, in stock to out, low to out and out to low prompt; changes to in stock do not`. Drive `setItemStatus` to return `changed` with the matching previous status. Assert the `Alert.alert` titles.
    - `an already result never prompts and announces the database status`.
    - `the prompt uses the returned name and id`: cached `Milk`, returned `Oat milk`, so Add sends `{ name: 'Oat milk', pantryItemId: '1' }`.
  - **Honest state:** `the badge keeps the old status while saving and after a failure`. Assert the row's status label before resolution and after rejection.
  - **Error distinction:**
    - `a failed status write shows Status not changed with the mapped reason`, for `err_save_item`, and for `err_item_missing` with a `PF_PANTRY_MISSING` error.
    - `a failed shopping add after a successful change shows the shopping notice and keeps the new status`.
  - **Locks and lifecycle:**
    - `a double tap on an option or a second status control writes once`;
    - `other status controls are disabled only while the write is in flight`;
    - `the changed item's edit action is disabled while its write is in flight and re-enabled after success, failure and a missing record`;
    - `a lost prompt leaves the status controls usable`: never answer the dialog; another item's change still works.
    - `a newer change invalidates an unanswered prompt`: answering the first prompt's Add afterwards adds nothing.
    - `a completion after the list lost focus shows no prompt and no notice`;
    - `the selector closes when its item leaves the list`.
  - **Accessibility:**
    - `the result is announced only when no prompt follows`: `announce` is called for in_stock and `already`, never together with a prompt.
    - `opening the selector passes the status control's ref for focus return`.
- [ ] **Step 2: Run** `node --test tests/pantry-list-status.test.cjs`. **Expected:** FAIL.
- [ ] **Step 3: Implement** the list wiring and `announce`.
- [ ] **Step 4: Run** `npm run test:fast`, then `npm run test:local`. **Expected:** both PASS.
- [ ] **Step 5: Commit:** `feat(pantry): change pantry status directly from the list (UX-01B)`.

### Task 6: Android journey, coverage matrix and device acceptance

**Files:**
- Create: `pantry-flow/.maestro/slice-3-status.yaml`
- Modify: `pantry-flow/scripts/e2e-fixtures.ts`: add the `status-verify` command and include it in the error message's command list.
- Modify: `pantry-flow/scripts/run-e2e.cjs`: run the new flow after `shopping-verify`, then `status-verify`.
- Modify: `docs/testing/coverage-matrix.md`: new UX-01B rows; update STATE-04, SHOP-LINK-01 and A11Y notes where behavior changed.

**Starting state** (left by `slice-2-shopping.yaml` and checked by `shopping-verify`):
- pantry: Milk, Low;
- shopping: Milk open and linked; Rye bread completed.

**The journey:**
1. Log in as Alice.
2. Tap `pantry-item-status-<Milk>`, then `status-option-out`. The prompt appears; tap **Add**. Assert the duplicate notice ("Not added to the shopping list"), dismiss it, and assert Milk shows **Out**. This is the failed-add path: the status stays changed.
3. Tap the status, then `status-option-in_stock`. Assert no prompt and **In Stock**.
4. Tap the status, then `status-option-low`. The prompt appears; tap **Not now**. Assert **Low**.
5. Tap the status, then `status-option-low` (the current one). Assert no prompt and still **Low**.
6. Tap the item name. The edit screen opens, so the content control still works. Go back.

**`status-verify` asserts:**
- pantry: exactly one row, Milk, `status = 'low'`, name and category unchanged;
- shopping: unchanged from `shopping-verify` (Milk open and linked, Rye bread completed, no new row);
- Bob still sees nothing.

- [ ] **Step 1: Write** the flow and `status-verify`.
- [ ] **Step 2: Run** `npm run test:e2e` locally against the emulator or the test phone (`com.pantryflow.test` only). **Expected:** all flows and verify steps pass. Keep the JUnit and debug output in ignored `.verification/maestro/`.
- [ ] **Step 3: Update** the coverage matrix.
- [ ] **Step 4: Physical-device acceptance** (the owner switches TalkBack on and off). Record the results in the PR:
  - **Touch targets:** the status control and the options are easy to hit. Measure them with the layout bounds overlay, or with the Maestro hierarchy dump: at least 48 dp.
  - **Positioning:** the selector stays fully on screen for the first row, the last row above the add button, at the largest system font, and on the phone's small-window or split-screen mode if available.
  - **TalkBack:** the content reads name, details and "Edit item". The status reads name, status and "Change status". Opening moves focus into the radio group onto the checked option. Back and the scrim close it, with focus back on the status control. Selecting an option commits. The prompt is read once; with no prompt, "Milk, In Stock" is announced once.
  - **No accidental edit:** tapping the status control never opens the edit screen.
  - **Lost dialog:** background the app while the prompt shows, then return. The status controls stay usable.
  - **Decision:** if positioning or TalkBack focus fails, apply the design's section 4 fallback (a bottom-sheet container, with identical semantics and tests), re-run steps 2 and 4, and record the deviation.
- [ ] **Step 5: Run the final gate** on the exact head: `npm run test:fast`, `npm run test:local`, `npm run test:e2e`. **Expected:** all PASS. The owner may dispatch the full Android CI run.
- [ ] **Step 6: Commit:** `test(pantry): Android status journey, read-back and coverage (UX-01B)`.

## Interaction counts to record in the PR

| Task | Before | After (target) |
| --- | --- | --- |
| Change status, no prompt | 3 | 2 |
| Change to Low/Out and answer the prompt | 4 | 3 |
| Correct a mistaken change | 3 (+1) | 2 (+1) |

## Out of scope

- a batch mode, coach marks, onboarding or hints;
- edit-screen layout changes;
- the A11Y-01 status-pill semantics on the edit screen (KAN-100);
- German translations (KAN-60);
- iOS VoiceOver (KAN-47).
