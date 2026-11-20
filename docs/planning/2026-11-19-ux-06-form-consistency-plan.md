# UX-06 Form Consistency, High Findings — Implementation Plan (KAN-96)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fix the three High findings of the [form layout evaluation](../quality/2026-11-19-form-layout-evaluation.md):
- **H1:** the keyboard hides primary actions on Android.
- **H2:** the post-registration "Check your email" layout.
- **H3:** the missing-item states.

This lands before UX-04, whose continuous entry keeps the keyboard open on Add Item.

**Architecture:**
- Reuse `hooks/useKeyboardOverlap.ts` from UX-02.
- The three modal forms (Add Item, Edit Item, shopping item) get one small shared footer: `components/FormFooter.tsx`, holding Cancel | Save. It sits outside the ScrollView and is lifted by the keyboard overlap, so Save stays visible.
- The sign-in and registration forms get overlap bottom padding on their ScrollView, so the button can be scrolled above the keyboard.
- The register confirmation view and the missing-item states adopt the stacked action layout the other confirmation screens already use: `gap: spacing.md`, full-width buttons.

**Tech Stack:** Expo SDK 58 / React Native 0.88 (Android edge-to-edge, so the window doesn't resize), TypeScript, `node:test` screen tests, Maestro on the local stack.

**Spec:**
- [KAN-96](https://michaelwuerthner.atlassian.net/browse/KAN-96) (UX-06), whose scope the owner extended on 2026-11-19 to the sign-in, registration and email-confirmation screens;
- owner decisions of 2026-11-19 on the "Check your email" screen: align the button gap, the button order, and the gap between text and the first button with the other confirmation screens;
- owner approval of 2026-11-20: "Go to sign in" uses the secondary button variant on all three confirmation screens;
- the evaluation's proposed convention, section 3.

**Process:** Sonnet implementers and focused Sonnet reviews, then one final Opus review. Proportionate. Preserve existing behavioral regression assertions. A phone check with the owner is required (keyboard behavior can't be proven off-device).

## Global Constraints

- **No new dependencies, state libraries or global layout rewrites.** Only the screens named here change.
- **Theme tokens:** gaps use `spacing.md` (12) between stacked actions and between text and the first control; the action block's top distance is `spacing.xl` (24).
- **Footer (modal forms):** Cancel (secondary, left) | Save (primary, right), each `flex: 1`, 12 between them, the same as today's row.
  - It moves out of the ScrollView into a footer view at the bottom of the screen.
  - Its bottom offset is the keyboard overlap from `useKeyboardOverlap`, so it sits just above the keyboard when the keyboard is open, and at the normal padding otherwise.
  - The ScrollView's bottom padding grows by the footer height plus the overlap, so the last field can scroll above the footer.
- **Destructive actions** (Delete on Edit Item, Remove on the shopping item) stay **inside the scroll content**, below the fields, never in the lifted footer, so they can't sit under the thumb next to Save.
- **Existing testIDs stay unchanged:** `add-item-save`, `add-item-cancel`, `edit-item-*`, `shopping-item-*`, `register-resend-confirmation`, `confirmation-*`, `login-*`, `register-*`. The Maestro flows rely on them.
- **"Check your email" after registration:**
  - container `gap: spacing.md`;
  - the message is directly followed by the actions with 12 dp;
  - order: **Resend confirmation email first, then Go to sign in**;
  - title spacing as on `confirm-email.tsx`.

  **Approved by the owner on 2026-11-20:** "Go to sign in" uses the secondary variant on all three confirmation screens (register "Check your email", `confirm-email.tsx`, `auth/callback.tsx`); the other action stays primary.
- **Missing-item states** (Edit Item, shopping item): text, Retry and Back stacked with `gap: spacing.md`, buttons full width (no content-width shrink), no 0 dp contact.
- **Not in this package:** the Medium and Low findings. They're dispositioned in KAN-96 after this package.

## Review Focus

1. **Keyboard opens while the name field has focus** (Add Item `autoFocus`): Save and Cancel are visible above the keyboard without scrolling. Tapping Save submits once.
2. **Keyboard hides:** the footer returns to the normal bottom position; no stuck offset after backgrounding (inherits the UX-02 guard).
3. **Edit Item with a long form:** the fields scroll above the footer; Delete is reachable by scrolling and never ends up lifted next to Save.
4. **Sign-in and registration:** with the keyboard open, the submit button can be scrolled into view.
5. **Register confirmation:** TalkBack reads the message, then Resend, then Go to sign in; the 48 dp buttons don't touch.

---

### Task 1: FormFooter and the three modal forms (H1)

**Files:**
- Create: `pantry-flow/components/FormFooter.tsx`
- Modify: `pantry-flow/app/add-item.tsx`, `pantry-flow/app/edit-item/[id].tsx`, `pantry-flow/app/shopping-item/[id].tsx`
- Test: `pantry-flow/tests/form-footer.test.cjs`, plus focused additions to the existing screen tests for each modal (wiring and stubs only in existing files; new assertions in new tests)

**Interfaces:**
- Consumes: `useKeyboardOverlap(ref)` from `hooks/useKeyboardOverlap.ts` (returns the overlap in dp; Android did-show/hide, iOS will-show/hide; token-guarded).
- Produces: `FormFooter({ children, overlap, onLayoutHeight? })`, a View pinned to the bottom with `paddingHorizontal: spacing.xl`, `paddingBottom: spacing.xl + overlap`, `paddingTop: spacing.md`, background `colors.bg`, a top hairline border `colors.border`, and children laid out in a row with `gap: spacing.md`.

- [ ] **Step 1: Failing tests:**
  - `the footer lifts by the keyboard overlap and returns when it hides` (stubbed keyboard events);
  - `Add Item, Edit Item and the shopping item render Cancel and Save inside the footer, outside the ScrollView`;
  - `Delete and Remove stay in the scroll content`;
  - `the ScrollView bottom padding includes the footer height and the overlap`.
- [ ] **Step 2: Run** the new tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep `KeyboardAvoidingView` behavior `'padding'` on iOS, as today. On Android, rely on the overlap.
- [ ] **Step 4: Run** the new tests, then `npm run test:fast`. Expected: PASS. Existing assertions are unchanged.
- [ ] **Step 5: Commit** `fix(ui): keep Save and Cancel above the keyboard in item forms (KAN-96)`.

### Task 2: Sign-in, registration and the "Check your email" view (H1 auth, H2)

**Files:**
- Modify: `pantry-flow/app/(auth)/login.tsx`, `pantry-flow/app/(auth)/register.tsx`, and `pantry-flow/app/(auth)/confirm-email.tsx` and `pantry-flow/app/auth/callback.tsx` (secondary variant, approved 2026-11-20)
- Test: `pantry-flow/tests/auth-layout.test.cjs`

- [ ] **Step 1: Failing tests:**
  - `sign-in and registration add the keyboard overlap to the ScrollView bottom padding`;
  - `the post-registration view stacks message, Resend and Go to sign in with gap 12, Resend first`;
  - `the post-registration title spacing equals confirm-email's`;
  - `Go to sign in uses the secondary variant on all three confirmation screens` (testIDs unchanged).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The confirmation view gets its own styles (`confirmContainer` with `gap: spacing.md`, and a `message` style), so the registration form keeps its current look.
- [ ] **Step 4: Run** the new tests, then `npm run test:fast`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(ui): align the registration confirmation layout and keyboard-safe auth forms (KAN-96)`.

### Task 3: Missing-item states (H3)

**Files:**
- Modify: `pantry-flow/app/edit-item/[id].tsx` and `pantry-flow/app/shopping-item/[id].tsx` (the `centered` missing views)
- Test: additions to `pantry-flow/tests/form-footer.test.cjs` or a new `missing-state-layout.test.cjs`

- [ ] **Step 1: Failing test:** `missing states stack message, Retry and Back with gap 12 and full-width buttons`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Container `gap: spacing.md`, `alignItems: 'stretch'` (or `alignSelf: 'stretch'` on the buttons), remove `marginTop: spacing.lg`.
- [ ] **Step 4: Run.** Expected: PASS, and `npm run test:fast` passes.
- [ ] **Step 5: Commit** `fix(ui): consistent spacing in the missing-item states (KAN-96)`.

### Task 4: Phone check, evidence and KAN-96 dispositions

- [ ] **Step 1:** Run `npm run test:fast` and `npm run test:integration` and record them. Build the arm64 test app per the device notes: clear `%TEMP%/metro-cache` first, and grep the bundle for `login-submit`.
- [ ] **Step 2:** Run `npm run test:e2e` on the phone with the owner present, with WhatsApp silenced. All flows must pass unchanged, which proves the testIDs and the Maestro taps still work.
- [ ] **Step 3: Owner checks:**
  - Add Item (keyboard open on entry): Save and Cancel visible;
  - Edit Item: Save visible with the keyboard open; Delete reachable by scrolling;
  - shopping item: the same;
  - sign-in and registration with the keyboard open;
  - the "Check your email" view: spacing, order, TalkBack order;
  - a missing-item state, if it can be triggered (otherwise screen tests only, recorded as such).
- [ ] **Step 4:** Coverage matrix: a "UX-06 coverage — KAN-96 (High findings)" section with rows FORM-01… and the device evidence.
- [ ] **Step 5:** Commit `docs(testing): record UX-06 High-finding fixes and phone evidence (KAN-96)`.
