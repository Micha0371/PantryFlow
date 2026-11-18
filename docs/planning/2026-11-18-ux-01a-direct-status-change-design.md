# UX-01A: direct pantry status change (design)

**Status:** **approved by the owner on 2026-11-18**, with the clarifications in section 5.11 (see the decision record in section 8). UX-01B (KAN-91) follows its own reviewed implementation plan.

- **Jira:** KAN-90 (UX-01A), parent KAN-87 (T11).
- **Implemented by:** KAN-91 (UX-01B).
- **Sources:**
  - findings F-05 (status change takes 3–4 taps) and F-16 (prompt orchestration);
  - Codex QA-04;
  - PRD Flow 3 (target 2–3 taps);
  - the Slice 2 decision D3 ([slice-2-implementation-plan.md](slice-2-implementation-plan.md)).

## 1. Intent

The most frequent pantry action is noticing that something is running low and saying so. Today it costs a detour through the edit screen: open the item, tap a status, Save, then answer the shopping prompt. PantryFlow should take less effort than the household chore it replaces. A status change should therefore happen directly on the pantry list, in two taps, while keeping the explicit choice between In Stock, Low and Out.

**Usage scenarios (owner, 2026-11-18):**
- **Priority:** a spontaneous single change, made while cooking or on noticing an item running low.
- **Also convenient:** reviewing several items while standing at the pantry. This needs no separate mode; repeated single changes must simply stay quick.

## 2. Goals, non-goals, anti-goals

**Goals**
- A normal change takes at most 2 intentional taps. A change followed by the shopping prompt takes at most 3, whether the user accepts or declines.
- All three statuses are explicitly selectable.
- The list stays in place, so the next item can be changed at once.
- A failed change never looks saved.
- Screen-reader users can find, operate and confirm the change.

**Non-goals**
- No batch-editing mode or multi-select.
- No swipe gestures.
- No visual redesign of the list.
- No change to the edit screen's functions.
- No new dependencies.

**Anti-goals.** Any of these would make the design a failure even if it worked technically:
- blind status cycling;
- a row tap that sometimes edits and sometimes changes status;
- extra permanent controls on every row;
- a tutorial or coach mark to explain the control;
- a status shown as changed before the database confirmed it.

## 3. Constraints

- **D3 (unchanged).** After a successful change to Low or Out from a *different* status, the app asks "Add to shopping list?":
  - **Add** uses the same shopping add as a manual add, linked to the pantry item.
  - **Not now**, or dismissing the dialog, does nothing.
  - **No prompt** for an unchanged status or a change to In Stock.
  - **The pantry change is never rolled back** by the prompt's outcome. A failed add shows the existing translated notice, including the duplicate message for an already-open item (D1).
- **Existing guards stay intact:**
  - the per-item pending lock;
  - the provider's household and user scope guards;
  - stale-read protection;
  - CR-01 missing-record recovery (KAN-115);
  - the screen-level double-tap lock (`useItemMutation`);
  - the single-open navigation lock (`useSingleOpen`).
- **Household isolation stays enforced by the database** (RLS).
- **Accessibility:**
  - touch targets of at least 48×48 dp;
  - roles, labels and selected state for every control;
  - status never conveyed by color alone;
  - TalkBack evidence on the phone (KAN-45). VoiceOver follows KAN-47.
- **Strings:** English only in this slice; new keys are listed for German (KAN-60). The translation function has no placeholders, so labels are joined from separately translated parts.
- **Toolkit:** no popover or bottom-sheet library is installed. Any selector is built on React Native's `Modal`.

## 4. Approaches compared

All three keep the item name and details opening the edit screen.

| | A. Anchored selector (recommended) | B. Bottom-sheet selector | C. Permanent inline buttons |
| --- | --- | --- | --- |
| What it is | Tapping the status badge opens a small three-option menu next to the badge | Tapping the badge opens a panel from the bottom edge with the item name and three options | Every row shows In Stock / Low / Out as a segmented control |
| Normal change | 2 taps | 2 taps | **1 tap** |
| Change + prompt answer | 3 | 3 | 2 |
| Correct a mistaken change | 2 (+1 if the correction is to Low/Out) | 2 (+1) | 1 (+1) |
| Discoverability | Good, as long as the badge clearly looks tappable (chevron and button styling) | Same trigger as A | Best: options always visible |
| Screen space | None extra; the menu exists only while open | None extra; covers the lower part of the list while open | Large: three segments take about 60% of a phone-width row, so names truncate earlier and German labels wrap |
| Accessibility | Good with care: a modal radio group, focus moved in and back, Android Back closes it | Good: a modal radio group and the platform's standard pattern; the item name in the panel gives context | Weak for screen readers: each row gets three extra focus stops, which makes reading the list about four times longer |
| Repeated updates | Good: the list and its scroll position stay put, and the menu appears where the eye already is | Fair: each change slides a panel over the list and hides the row being changed | Best per item, but a mistap while scrolling saves at once and may prompt |
| Fit with "simplicity" | One new control per row, only visible when used | Same, plus heavier motion for a small choice | Adds two permanent controls to every row |

**Dropped:**
- **The native three-button dialog:** it can't show which status is current, and Android reorders its buttons.
- **Long-press menus:** poorly discoverable, and awkward with TalkBack.
- **Status cycling:** excluded by KAN-90.
- **C:** fails the owner's simplicity rule. Its one-tap gain doesn't outweigh the permanent clutter, the screen-reader cost and the accidental-write risk.

**Recommendation: A, with B as a fallback with the same behavior.** A matches the owner's preference and works within React Native's `Modal`, with no dependency. Native rendering doesn't force B:
- `Modal` opens as a separate window on Android, so TalkBack focus stays inside the menu.
- Positioning needs only the badge's on-screen frame (`measureInWindow`) and a flip rule.

The rule for falling back to B: if the UX-01B phone check shows that A can't meet the focus or positioning criteria in section 6, switch only the *container* to a bottom sheet. The trigger, options, semantics, commit logic and tests stay identical. The switch is reported in the UX-01B PR as a recorded deviation.

## 5. Design

### 5.1 Row structure

The row becomes a card with **two sibling controls**, never nested:

```
┌────────────────────────────────────────────────┐
│ Milk                           ┌─────────────┐ │
│ Dairy · Fridge                 │ ● Low     ▾ │ │
│                                └─────────────┘ │
└────────────────────────────────────────────────┘
 └──── item content: opens edit ──┘ └─ status ─┘
```

**Item content** (name, category and location):
- Opens the edit screen, exactly as the whole row does today, through `useSingleOpen`.
- Role "button", labelled with the item name, category and location. This also fixes the unlabelled rows from F-13.

**Status control:**
- Shows the dot, the status text and a chevron (▾). A visible outline marks it as a button, unlike today's display-only badge.
- The touch target is at least 48×48 dp and covers the full row height on the right side.
- At least 8 dp separates it from the content area, so a tap goes to exactly one control.
- Tapping it never opens the edit screen.

The edit screen keeps all its functions, including its own status buttons.

### 5.2 The selector

Tapping the status control opens a small menu anchored to it. The current status is marked with a filled radio and a check mark, not color alone:

```
│ Milk                           [ ● Low     ▾ ] │
│ Dairy · Fridge                ┌──────────────┐ │
└───────────────────────────────│ ○ In Stock   │─┘
┌───────────────────────────────│ ◉ Low      ✓ │─┐
│ Eggs                          │ ○ Out        │ │
│ Dairy · Fridge                └──────────────┘ │
```

**Contents and layout:**
- Three options in fixed order (In Stock, Low, Out), each at least 48 dp tall and as wide as the longest label. That accommodates large font sizes and the longer German labels.
- A light scrim covers the rest of the screen, so tapping outside clearly closes the menu.

**Positioning:**
- Right-aligned to the status control, and kept at least 16 dp from the screen edges.
- Opens **below** the control when there's room above the bottom safe area; otherwise **above** it. This covers the last rows and the area by the add button.
- If neither fits (very large font size on a small screen), it opens centered.
- The list can't scroll while the menu is open, so its position never goes stale.

Near the bottom of the list:

```
                                ┌──────────────┐
                                │ ○ In Stock   │
                                │ ◉ Low      ✓ │
                                │ ○ Out        │
                                └──────────────┘
│ Rice                           [ ● Low     ▾ ] │
│ Grains · Pantry                                │
```

**Closing without a change:** tapping outside, Android Back, or selecting the **current** status closes the menu. None of these writes anything or prompts.

### 5.3 Committing a change

1. **Selecting a different status:**
   - closes the menu at once;
   - starts the save;
   - shows the **old** status on the badge with a small progress indicator (busy).
2. **On success:**
   - the badge shows the new status;
   - if D3 applies, the shopping prompt follows (5.4);
   - otherwise the result is announced (5.6).
3. **On failure:** the badge keeps the old status and a notice explains the result (5.5). The status is never shown as changed before the database confirmed it.

**One status change at a time on the list:**
- While a status **write** is in flight, the other status controls are disabled: dimmed, and reported as disabled to screen readers.
- A save usually takes well under a second, so a pantry sweep isn't slowed.
- The prompt that may follow is a native modal dialog, which blocks the list while it's visible.
- Section 5.11 defines what happens when that dialog is lost, and why a lost dialog can never leave the controls disabled.
- The changed item's **content** (its edit action) is also disabled while its write is in flight (5.11).

**Status-only write (recommended, needs approval because it narrows KAN-91's "reuse the existing update operation"):**
- **The problem:** today's `updateItem` writes name, category, location and status together. Called from a list that hasn't refreshed yet, it would silently undo a rename or recategorization made on another device.
- **The fix:** a status change from the list writes **only `status`**. It goes through the same provider, with the same pending lock, scope guards, CR-01 recovery and household filter. Only the payload is narrower.
- **Approved by the owner on 2026-11-18.** The write is also concurrency-safe; the exact contract is in 5.11.

**Validation and errors for the status-only write** (designer's call):
- It validates only that the status is one of In Stock, Low and Out.
- It runs no name-uniqueness check, because no name is written.
- Errors map exactly as today through `itemSaveErrorKey`:
  - a missing record (CR-01) gives "This item is no longer available.";
  - everything else, including the provider's "Item change is already pending" lock error, gives "Could not save item.".

**Which status counts as "previous" for D3:** the status the database held at the moment of the write, not merely the cached one. Section 5.11 shows how this is established.

### 5.4 D3 shopping prompt, restated for the list

The rule, by transition:

| From → to | Write | Prompt |
| --- | --- | --- |
| Any → the same status | none | none |
| Low or Out → In Stock | yes | none |
| In Stock → Low, In Stock → Out | yes | yes |
| Low → Out, Out → Low | yes | yes |

The prompt is the existing native dialog: title "Add to shopping list?", the item name, then **Not now** and **Add**.

```
┌───────────────────────────────┐
│ Add to shopping list?         │
│ Milk                          │
│              Not now     Add  │
└───────────────────────────────┘
```

- **Add** calls the shopping add, linked to the item.
- **When an add fails** (offline, or a duplicate open item per D1), the existing notice appears. The pantry status stays changed.
- **Conditions for the prompt (and the add).** The prompt, and the add, happen only while **all** of these hold:
  - the pantry list is still the focused screen (`useItemMutation`'s `current()`);
  - the saved item's household is still the current household;
  - the user is unchanged.
- **Why the household check is new:** without it, a household change during the save could offer to add the item to the *new* household's list. The edit screen's prompt gets the same check.
- **How the check works** (designer's call, no provider API change):
  - The saved item already carries its `household_id`.
  - The shared prompt hook compares it with the current household from the existing household-scope hook. It reads the latest value through a ref, both before asking and again before adding.
  - The user check is implicit: both providers are keyed by user, so a user change remounts them and ends the screen's `current()`.

### 5.5 Failures

| Situation | What the user sees |
| --- | --- |
| Network, permission or server error | The badge keeps the old status. Notice: "Status not changed" / "Could not save item." / OK. Retry by tapping the badge again (2 taps). These errors are never treated as a missing record. |
| Status changed on another device first | Handled by the concurrency-safe contract (5.11): no wrong prompt, and the list adopts the database's status. |
| Item deleted on another device (CR-01) | The row disappears and the list refreshes. Notice: "This item is no longer available." |
| The same item is already being changed (pending lock) | Can't happen from the list, because other status controls are disabled. A change from the edit screen at the same moment fails safely with the generic notice. |
| User or household changed, or screen left mid-save | The provider discards the result for the new scope. No prompt, no add, no notice on the new screen. |
| Shopping add fails after a successful status change | The existing "Not added to the shopping list" notice with the translated reason. The status stays changed. |

All notices use the existing native dialog, which TalkBack reads by itself.

### 5.6 Accessibility (TalkBack walk-through)

1. **Item content:** "Milk, Dairy, Fridge, button", with the hint "Edit item". Double-tap opens the edit screen.
2. **Status control:** "Milk, Low, button, collapsed", with the hint "Change status". It's labelled with the item name and current status. It reports `expanded` while the menu is open, `busy` while saving, and `disabled` during another change.
3. **Opening:** double-tap opens the menu, and focus moves into it, onto the current option.
4. **The menu:** a radio group labelled "Status, Milk". Its options read "In Stock, radio button, not checked", "Low, radio button, checked", "Out, radio button, not checked".
5. **Choosing:** double-tapping an option commits it (5.3). Android Back or the scrim closes the menu without a change. Focus returns to the status control.
6. **Result:**
   - With a prompt: the native dialog takes focus and is read.
   - Without one: the app announces "Milk, In Stock".
   - On failure: the notice dialog is read.

Statuses are told apart by their text label, the radio state and the check mark; color is only a supplement.

**The success announcement** (designer's call):
- It joins the item name and the existing status label ("Milk, In Stock"), so it needs no new string.
- It uses a small general announce helper next to the existing `announceError` in `lib/accessibility.ts`, with the same Android-only policy.
- iOS VoiceOver behavior is verified under KAN-47.

### 5.7 Interaction counts

| Task | Before (edit screen) | After |
| --- | --- | --- |
| Change status (no prompt) | 3: row, status, Save | **2**: badge, option |
| Change to Low/Out and answer the prompt (Add or Not now) | 4 | **3** |
| Correct a mistaken change | 3 (+1 prompt) | **2** (+1 if the correction is to Low/Out) |
| Sweep through N items | 3N plus prompts | 2N plus prompts, without leaving the list |
| Edit name, category or location | 3+ | unchanged |

A mistaken "Add" is undone on the Shopping tab as before. D3 never removes shopping items automatically.

These counts come from the source and are not proof of better usability. Observed use in UX-08B decides that.

### 5.8 Discoverability

The chevron and button outline make the badge read as a control. A first-time user who taps the row instead still reaches the edit screen, where status works as before, so nothing is lost. No hint text, onboarding or coach mark is added. If UX-08B shows users miss the control, that's a follow-up decision.

### 5.9 Prompt orchestration (F-16 / ARCH-01 decision)

The list becomes a **real second consumer** of the D3 sequence: offer, ask, add, failure notice, with focus and scope guards. Extract **only that sequence** into one focused hook shared by the edit screen and the list. It exposes:
- a "pending prompt" flag, which the edit screen needs for its Cancel rule (KAN-36);
- the offer function.

The edit screen's module-private `ask` and `notice` dialog helpers move with the sequence.

Leave out the save itself (each screen saves different fields), the layout and any generic abstraction. The list screen gets its own `useItemMutation` instance for the double-tap lock and `current()`. The edit screen's behavior must stay identical; its existing prompt tests are the regression net.

### 5.10 Strings (English; listed for German, KAN-60)

New keys, with the builder naming them:

| Purpose | English |
| --- | --- |
| status control hint | "Change status" |
| item content hint | "Edit item" |
| selector group label prefix | "Status" |
| failure notice title | "Status not changed" |

Existing keys are reused: the status labels, `err_save_item`, `err_item_missing`, the shopping prompt and notice keys, and `common_ok`.

### 5.11 Concurrency, navigation and lifecycle (owner clarifications, 2026-11-18)

**Concurrency-safe status contract**

The list holds a cached status P for the item, and the user selects S, with S ≠ P (S = P is a no-op in the client, 5.2). The write is a compare-and-set on the status, using only the existing table and PostgREST:

1. **Update** `status = S` where `id`, `household_id` **and `status = P`** match, returning the row. Use `maybeSingle()`, so "no row matched" is a normal result, not an error.
2. **A row is returned:** the database held P at the write, so P is the authoritative previous status. D3 applies to P → S.
3. **No row matched:** one read of `id` and `household_id` disambiguates:
   - **No row:** the item is missing for this household. The existing CR-01 recovery applies: drop the row, re-read the list, and show "This item is no longer available.".
   - **The row's status A equals S:** someone already set it. There is no write and no prompt; the list adopts the returned row and reports success.
   - **A differs from S:** retry the compare-and-set once with A as the previous status. On success, D3 applies to A → S. If the retry also matches nothing, the list adopts a fresh read and shows "Status not changed" / "Could not save item.". There is no further retry.
4. **Any error** (network, permission, server) at any step is a failed status update. The old status stays, and it is never treated as missing.

**Why this contract:**
- **Rejected, a database function** returning the old and new status: it needs a migration and the hosted migration process, which is unnecessary infrastructure.
- **Rejected, an unconditional write with the cached status:** it gives a wrong prompt decision whenever the cache is stale.

**The prompt and the link** use the returned row: its name, its id and its `household_id`. Never use the cached values.

**Navigation during a pending write**
- **The per-item lock** lives in the shared provider (`pendingItems`), so it covers both entry points.
- **The real risk is a stale edit screen,** not a double write. The edit screen loads the item once. Opened during a pending status write, it would show the old status, and a later Save (a full-item write) would undo the status change.
- **So the changed item's content is disabled while its status write is in flight.** This is the simple guarantee the owner allowed. Its edit action returns as soon as the write settles: on success, failure, or a confirmed missing record.
- **Prompts and notices** appear only while the pantry list is the focused screen (`current()`), with the household unchanged (5.4). A completion that arrives after the user switched tabs or opened another item updates the list silently: no prompt, no notice and no add. After a failure, the badge already shows the true, old status.

**Operation lifecycle and the lost-dialog rule**
- **The list-wide lock covers the status write only.** It is released in every outcome: success, failure, missing record, a redundant selection, and unmount.
- **While the shopping prompt is visible,** the native modal dialog blocks the list by itself.
- **Why a lost dialog can't disable the controls:** a lost dialog (KAN-36: a native alert that never answers after the app was backgrounded) holds no lock.
- **Each prompt carries a token.** The token is invalidated by any of: a newer status change, the list losing focus, a household or user change, or unmount.
- **A late answer from an invalidated prompt** does nothing: no add and no notice.
- **Obsolete callbacks** (an old household, user or screen) can't change the current screen or start a shopping add. They are blocked by the provider's scope guards, the household check, `current()` and the prompt token.

**Error distinction**
- **The status update failed:** title "Status not changed", the old status stays.
- **The status update succeeded but the shopping add failed:** the existing "Not added to the shopping list" notice with its reason, and the new status stays.

The CR-01 contract (merged in #43, `isMissingPantryItem`) is reused only after the disambiguating read confirms the item is absent.

## 6. Criteria UX-01B must prove (in addition to KAN-91)

- **The D3 transition matrix in 5.4:** no write and no prompt for the same status; a prompt exactly for the four prompting transitions.
- **Honest status:** the old status stays visible until success and returns on failure; the network and CR-01 paths behave as in 5.5.
- **Double and fast taps:** only one menu, one write and one prompt. Other status controls are disabled during a change.
- **Scope:** a change that resolves after a household, user or screen change writes nothing into the new scope and prompts nothing.
- **Status-only payload:** the write sends only `status`. A concurrent rename made elsewhere survives (provider test, plus an integration read-back).
- **The concurrency contract in 5.11:**
  - cached status equal to the database status;
  - a stale cache with a different database status: a single retry, with D3 decided from the database status;
  - the database already holding S: no write, no prompt;
  - a missing row, confirmed by the read;
  - an error at each step, never treated as missing.

  This is proven through real PostgREST in the integration suite.
- **Lifecycle:**
  - the item's edit action is disabled exactly while its write is in flight;
  - the list-wide lock is released in every outcome;
  - a lost or late prompt answer adds nothing after the prompt is invalidated;
  - no prompt or notice appears over another screen.
- **Edit screen:** its D3 prompt tests pass unchanged after the extraction.
- **Positioning:** the menu stays fully on screen for the first and last rows, on a small screen and at the largest font scale. TalkBack focus moves into the menu and back. This is checked on the phone, with the fallback rule in section 4 if it fails.
- **TalkBack walk-through (5.6):** checked on the phone and recorded, with an extended Maestro journey and database read-back.

## 7. Left to the builder

- component and hook names and file layout;
- exact spacing, animation (none or a short fade) and scrim opacity within the existing theme;
- how the menu measures and flips;
- whether the new status write is a separate provider function or an option of the existing one, as long as section 6 holds.

## 8. Decision record

| Date | Decision | By |
| --- | --- | --- |
| 2026-11-18 | Usage scenarios, the owner's preferred direction (anchored selector, sibling controls, commit on select, D3 prompt after success, no batch mode) and the constraints in sections 2–3 | Owner |
| 2026-11-18 | **Approved:** approach A with fallback B. The fallback keeps identical interaction semantics and tap-count targets, and the final choice rests on native positioning and TalkBack evidence from the phone. | Owner |
| 2026-11-18 | **Approved:** the status-only write (5.3), preferred over a full-item update that could overwrite concurrently modified fields | Owner |
| 2026-11-18 | **Approved:** household checks before the shopping prompt and the shopping add, at both entry points (5.4) | Owner |
| 2026-11-18 | **Clarifications** (5.11): the concurrency-safe contract, using the database's previous status for D3 and the returned row for the prompt and link; navigation safety, disabling the item's edit action while its write is pending; lock release in every outcome, with lost or late dialogs unable to block or add; the error distinction; the CR-01 integration; accessibility verification; preserving the edit screen's behavior and tests; no batch mode, coach marks, onboarding or hints | Owner |
| 2026-11-18 | **Designer's calls in 5.11:** compare-and-set with one disambiguating read and at most one retry; the list-wide lock covers the write, and the native dialog's own modality covers the prompt. The owner accepted locking during the prompt as well, but a write-only lock is simpler and can't be stranded by a lost dialog. | Designer |
