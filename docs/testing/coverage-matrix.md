# PF-TEST-001 behavioral coverage

Reference: validated commit `e6dbcf8f09bf43bc8dc0c08d7eac62eaf46a45a8`.
Harness branch: `pantryflow/pf-test-001`. The reference branch is unchanged.
Sources: approved Slice 1 plan E/F, approved strict-duplicate rules in the user
request, migrations 00001–00003, current app/hooks/lib and device findings in H.
Later user-approved hardening supersedes the old examples permitting client
timestamp writes or requiring permanently non-null authors.

“Automated” describes executable coverage, not an assertion that an unexecuted
suite passed. Execution results are recorded separately in README.md.

## Beta Priority 1 write isolation

Specification and evidence: [independent write-isolation regressions](2026-11-24-rls-write-isolation.md). Existing filtered/returning, attribution and immutable-column tests remain unchanged. New SQL assertions run against disposable PostgreSQL; HTTP uses ordinary users and owner read-back. Gateway denials are reported separately from policy detectors.

| ID | Restriction and observable outcome | Coverage and failability | Boundary |
|---|---|---|---|
| RLS-WRITE-01 | `items_update_member`: own bare status update persists; foreign full row unchanged | `write_isolation.test.sql`; one permissive USING/effective-check mutant must fail the matching foreign-state assertion | Unfiltered minimal HTTP PATCH separately checks actual gateway boundary |
| RLS-WRITE-02 | `items_delete_member`: own bare deletion persists; foreign row survives unchanged | Same SQL suite; DELETE predicate mutant must fail foreign-state assertion | Minimal HTTP DELETE is not credited as an RLS detector when gateway blocks it |
| RLS-WRITE-03 | `shopping_update_member`: own completion persists with timestamp; foreign full row unchanged | Same SQL suite; permissive USING/WITH CHECK mutant must fail foreign-state assertion | Manual fixtures avoid pantry-FK cascade masking |
| RLS-WRITE-04 | `shopping_delete_member`: own bare deletion persists; foreign row survives unchanged | Same SQL suite; DELETE predicate mutant must fail foreign-state assertion | Fresh pre-delete snapshot prevents cascading UPDATE diagnostics |
| RLS-WRITE-05 | `profiles_update_own`: own allowed name update persists; foreign full profile unchanged | Same SQL suite; permissive USING/effective-check mutant must fail foreign-state assertion | No premium/identity privilege changes; those controls keep separate tests |
| RLS-INSERT-01 | `items_insert_member`: own minimal insert persists; foreign insert with actor attribution is rejected and absent | SQL and `write-isolation.integration.ts`; household-only check removal must fail foreign-state assertions | No RETURNING, representation or invalid attribution to mask the policy |
| RLS-INSERT-02 | `shopping_insert_member`: same household boundary for manual shopping insert | Same SQL/API suites and household-only mutant | Valid columns/name, no pantry-link FK to cause an unrelated rejection |

`npm run test:rls-mutations` runs intact baselines before/after all seven mutations, checks actual foreign-state diagnostics and retains commands/diffs. The supported local database/integration commands and Android runner serialize via a shared machine-wide lock. These checks do not modify hosted policies or verify hosted behavior.

## Slice 2 coverage — KAN-6 (Shopping List MVP)

Contract: [approved D1/D2/D4 model](../planning/slice-2-shopping-database.md) and
the D3 prompt in [the implementation plan](../planning/slice-2-implementation-plan.md).
These cases cover the database, the shopping data/provider layer, the Shopping
screens, the low/out prompt and the Android journey (steps 1–5).

| ID | Observable outcome | Automated coverage | Limit |
| --- | --- | --- | --- |
| SHOP-DB-01 | Blank/null/overlong names fail; edge trim/case uniqueness applies only to open names; internal spaces remain significant | shopping.test.sql and shopping API group in behavior.integration.ts | Translated validation in the client: SHOP-STATE-01 and SHOP-UI-02 |
| SHOP-DB-02 | Manual/linked adds share a namespace; duplicate rename/reopen fails without overwriting | pgTAP and ordinary-user API read-back | No merge/rename on conflict |
| SHOP-DB-03 | Concurrent add, rename, reopen and add-versus-reopen produce one open winner | Separate authenticated clients through real PostgREST | PGlite is not used as concurrency evidence |
| SHOP-DB-04 | Completion is server-timed, retained and reopenable; edits preserve completion time; shopping does not change pantry state | pgTAP and API full pantry-row comparison | No bulk clear or automatic pantry synchronization |
| SHOP-DB-05 | Foreign/anonymous access, forged creators and client-owned timestamp/identity changes fail | Ordinary-role pgTAP and public-key API checks | Admin used only for fixture preparation/deletion |
| SHOP-DB-06 | Cross-household links fail; same-household relink preserves name/completion; deleting the former target preserves the new link, deleting the current target clears only the link | Composite-FK pgTAP and direct API add/update/relink/deletion | Optional links remain inside the same household |
| SHOP-DB-07 | Members may edit another author's item; author deletion nulls attribution; household deletion cascades rows | API shared-membership fixture plus pgTAP deletion assertions | No invitations or multi-household UI introduced |
| SHOP-DB-08 | 00004 preserves populated Slice 1.1 rows | PGlite upgrade regression in database.test.cjs | Supplemental actual local PG17 incremental-upgrade probe passed; not production populated-upgrade approval |
| SHOP-STATE-01 | Shopping names are validated and database/transport errors map to contract keys (duplicate, permission, missing, invalid name, missing pantry link, generic) | shopping-data.test.cjs (unit) | The screens show these keys: SHOP-UI-01, SHOP-UI-02 and SHOP-LINK-01 |
| SHOP-STATE-02 | Provider state follows household scope, guards stale and superseded writes, drops a missing row and re-reads, reconciles an add with a concurrent refresh by id, and surfaces mapped errors | shopping-state.test.cjs, list-provider-contract.cjs (unit) | Mounting and screens: SHOP-UI-01 and SHOP-UI-02; the low/out prompt: SHOP-LINK-01 |
| SHOP-STATE-03 | Ordinary members persist and read back insert, linked insert, rename, check, reopen and delete; bypassed client checks surface as the contract keys for duplicate, foreign-household, foreign-link, 121-character, hidden-id rename and hidden-id delete; completed names repeat and reopen into an open duplicate fails | shopping-data.integration.ts against real local Auth/PostgREST with ordinary clients | Local stack only; relinking from the client is not exposed in step 2 |
| SHOP-STATE-04 | Unmount, sign-out, household change and superseded reads do not apply stale results | Provider-level unit tests in shopping-state.test.cjs | Aborting an HTTP request mid-flight is not asserted, since it cannot show whether the server committed |
| SHOP-UI-01 | The Shopping tab is gated and placed between Pantry and Settings; loading, empty, error/retry and sectioned list states | navigation.test.cjs, shopping-screen.test.cjs (unit) | Android loading-failure/retry, empty and sectioned states: SHOP-E2E-01 |
| SHOP-UI-02 | Inline add, complete/reopen, rename and confirmed remove with locks, translated errors and keyboard-safe tap settings; an add error clears as soon as the field is edited; an add error that arrives after the field was edited names the submitted item ("Milk: …"), and stays plain when the field holds the submitted text again (KAN-37); a failed complete/reopen error names its item and disappears once that item is removed or changed; household changes reset drafts/locks/feedback and discard obsolete add/toggle completions, including leaving and returning to the same household | shopping-screen.test.cjs, shopping-edit.test.cjs, components/shopping-add.test.tsx; leaving the edit screen during a save or remove abandons its callbacks through the shared `useItemMutation` (mutation.test.cjs) | Android first taps with the keyboard open on Add, a row circle, edit Save and Remove; tab-switch draft; confirmed remove: SHOP-E2E-01. The named add error (KAN-37) is unit-tested only: reaching it on a device needs an add that is still pending while the field is edited |
| SHOP-UI-03 | A tap on a Pantry or Shopping row opens exactly one edit screen: further taps, on the same or another row, are ignored until the list is focused again, with a one-second fallback when no navigation took the focus away (KAN-33). The Pantry add actions (the empty-state Add Item button and the + button) share the Pantry list's lock, so a fast repeated tap opens one Add Item screen and a row tap right after an add is ignored (KAN-38) | single-open.test.cjs (hook rules, fake timers), shopping-screen.test.cjs and screens.test.cjs (repeated row taps; repeated add taps, + then row) | Android fast double tap on a Shopping and a Pantry row, then Cancel leaves no second edit screen: SHOP-E2E-01. The Shopping check was shown failing on the pre-fix APK; that run stopped there, so the Pantry check has only run green. Android fast double tap on the empty pantry's + button, then Cancel leaves no second Add Item screen (Slice 1.1 flow), shown failing on the pre-fix APK and passing on the fixed one; the empty-state button is unit-tested only. A tap after the fallback during a navigation slower than one second could still open a second screen |
| SHOP-UI-04 | A successful remove closes the Shopping or Pantry edit screen without rendering or announcing the "no longer available" state; a missing item, a remove failing after the row was dropped, and a remove failing otherwise (form, values and error kept) behave as before (KAN-35) | shopping-edit.test.cjs, edit-item-remove.test.cjs, with a successful delete that drops the row before it resolves, as both providers do. The "fails after the row was dropped" case is the providers' missing-row behavior, for Shopping and, since CR-01, for Pantry (STATE-04) | The flash lasts one dismissal animation and is not asserted on a device |
| SHOP-UI-05 | On Android, an error under a form field is announced by TalkBack when it appears or changes: the error text has the alert role inside an always-mounted polite live region (KAN-34). On iOS nothing announces it: React Native 0.88 maps the alert role to no VoiceOver trait and has no live regions, so this is part of PF-IOS-001 | input.test.cjs (unit: role, live region, region kept when empty, changed text) | Android TalkBack check by the owner: the Shopping duplicate add error is spoken on appear and again after an edit cleared it. Android only; no VoiceOver run. Screen-level errors and a repeated identical form error: SHOP-UI-06 |
| SHOP-UI-06 | On Android, TalkBack announces every screen-level error without the user moving focus (KAN-39). Errors that replace a screen (pantry and shopping list load, the Edit Item and shopping item detail screens) are announced while that screen is focused: for one second after focus nothing is spoken, so TalkBack's own tab announcement does not cut them off, then the error shown at that moment is; again on returning to the screen; and at once when they appear later on the visible screen; the session restore error (AuthGate) is announced when it appears. Errors inside a screen (shopping action, sign-out, Add Item load) use the same always-mounted live region as SHOP-UI-05. A failed submit that leaves the same field error is announced again (KAN-84): the six forms (Add Item, Edit Item, shopping add and rename, sign-in, registration) pass a new `announceKey` to `Input` on every failure. iOS is unchanged (PF-IOS-001) | error-announcement.test.cjs (hooks with fake focus and timers; `InlineError`), input.test.cjs, screens.test.cjs, shopping-screen.test.cjs, shopping-edit.test.cjs (unit: each site, the pre-mounted live regions, the repeated Add/Edit Item error, the `announceKey` wiring of sign-in, registration and Shopping add) | Android TalkBack checks by the owner: KAN-39 and KAN-84 evidence. The sign-out, session restore, item detail and action errors are unit-tested only; the test proxy cannot make them fail on a device |
| SHOP-LINK-01 | The low/out prompt fires only on a change to low or out; Yes adds once, linked; No or dismiss adds nothing; the pantry save is never reverted; no prompt, add or failure notice once the edit screen has closed or lost focus; Delete and Save do nothing while the prompt is open; Cancel stays usable while the prompt or its failure notice is pending, so a native alert that never answers cannot lock the form, and a late answer after Cancel adds nothing (KAN-36) | edit-item-prompt.test.cjs, mutation.test.cjs, pantry-shopping.test.cjs (unit) | Since UX-01B the same prompt also follows a status change from the Pantry list (STATUS-09: `shopping-prompt.test.cjs`, `pantry-list-status.test.cjs`); the edit screen's own prompt is unchanged. Android prompt wording, Back as Not now, Not now, Add and the duplicate notice: SHOP-E2E-01; the prompt reached from the status control, with a linked add and a duplicate notice: STATUS-E2E-01. A lost prompt (a save that returns while the app is in the background) locked the form on the pre-fix APK and is recovered by Cancel on the fixed one, checked once on the phone (KAN-32 and KAN-36 evidence); it is not part of the Maestro suite |
| SHOP-LINK-02 | Shopping rename/complete/reopen/remove never change pantry data; pantry status changes create no shopping items; open duplicates are rejected with the duplicate key, a completed duplicate does not block, reopening into an open duplicate fails; pantry deletion keeps a named standalone shopping item | pantry-shopping.integration.ts against real local Auth/PostgREST with ordinary clients | Local stack only |
| SHOP-E2E-01 | Android release-mode test APK: the low/out prompt (Back, Not now, Add, duplicate notice), a fast double tap on a Shopping and a Pantry row opening one edit screen, keyboard-open add, toggle, rename and remove, duplicate message cleared by editing, complete/reopen, remove cancel/confirm, tab-switch draft, cold restart, shopping load failure/retry and another household's empty list | `.maestro/slice-2-shopping.yaml` on real local Auth/PostgREST through the loopback proxy | Emulator in the CI Android job; physical phone results in the evidence section below |
| SHOP-E2E-02 | The journey's persisted outcome: exact shopping rows, the pantry link, completion state, the pantry row as last saved, and nothing for the other household | `e2e-fixtures.ts verify:slice-2-shopping` with ordinary clients after the flow | Local stack only |
| DB-ENV-02 | Every migration from 00004 on applies without `extensions` on search_path, as in the hosted CLI push session | migration-push-search-path.test.cjs (PGlite, fast job), with a negative control for an unqualified `uuid_generate_v4()` | Models only search_path resolution, not every hosted login-role privilege; added after the 2026-11-11 hosted 00004 push failed and rolled back |
| DB-ENV-01 | Running PostgreSQL major must be 17 | Separate environment.test.sql, plan(1), in existing database CI job | The identical assertion was demonstrated failing on separate local 15.19; update deliberately with future major upgrades |

KAN-7 / step-1 local validation on 2026-11-11: 53 Node checks, Jest/RNTL, typecheck and target
safety passed; 21 original + 1 environment + 43 shopping pgTAP assertions passed;
six original API groups, six shopping groups and two real-email cases passed.
The actual PostgreSQL 17.11 incremental-upgrade probe started from 00001–00003
with one existing pantry item and its profile/household/membership. Migration up
applied only 00004; saved before/after snapshots of all four original tables
matched exactly, then the fixture was removed. Ignored local evidence includes
`kan7-upgrade-{before,after,result}.json` and `kan30-negative-result.json`.
CI and Android results on the exact PR head remain separate required checks.
Step 2 local validation (shopping data module and provider, after the PR #26 review fixes): 100 Node tests and 1 Jest/RNTL test from `npm run test:fast`; 65 pgTAP assertions in 3 files and 21 integration tests from `npm run test:local`.
Step 4 local validation (low/out prompt and pantry/shopping independence): 166 Node tests and 2 Jest/RNTL tests from `npm run test:fast`; 65 pgTAP assertions in 3 files and 22 integration tests from `npm run test:local`.

Concurrency limit: the API tests dispatch requests together from separate
authenticated clients, but do not force or prove overlapping execution inside
PostgreSQL. The one-winner outcomes remain valid in either serialization; the
partial unique index is the authoritative protection. These cases are not
evidence that a particular lock interleaving was exercised.

### Slice 2 Android evidence (KAN-25, KAN-26)

On 2026-11-12 one full `npm run test:e2e` run on a physical phone exited 0.

- Device: Xiaomi 23122PCD1G, Android 16 (API 36), arm64-v8a, over Wi-Fi ADB,
  charging with "Stay awake" on.
- App: release-mode test APK `com.pantryflow.test` 0.1.0, arm64-v8a, built from
  cc57ad4 (SHA-256 `2B06821F4670C48772FE4BC4C29CE670E73751A7558DBDEA96788127DC740DF9`).
  Runner and flows at f2fdb97, which changes no app code. The local stack is
  reached only through the loopback proxy and `adb reverse`.

| Stage | Result |
| --- | --- |
| Slice 1.1 journey, then `e2e-fixtures.ts verify` | Passed (9m 36s), verified |
| Slice 2 shopping journey (SHOP-E2E-01), then `shopping-verify` (SHOP-E2E-02) | Passed (9m 13s), verified |
| Confirmation-required registration, PKCE confirmation and restart persistence | Passed |
| Expired email link recovery and resend, then confirmation | Passed |
| logcat check for native font/asset failures | Passed |
| Cleanup of the reserved local test accounts | Done |

The owner and the agent reviewed the four screenshots: the pantry list with
icons, the confirmation-required screen, the completed shopping state and the
list after a cold restart. They show the completed item's strikethrough and
filled check, and the rename and completion persisting across the restart.
Screenshots stay in ignored `.verification`.

[CI run 43218155689](https://github.com/Micha0371/PantryFlow/actions/runs/43218155689) on fd47ba6 passed all four jobs, including the emulator
Android job. That run predates the KAN-17 add-error fix and the review
assertions added to the shopping flow after the phone run (Bread back under
"To buy" after reopen, Rye bread back after retry, a single Milk after the
rejected prompt add). [CI run 43300263994](https://github.com/Micha0371/PantryFlow/actions/runs/43300263994) on 0cc3bf0, which includes all of
them, passed all four jobs, including the emulator Android job. Later commits
only change documentation.

The low/out prompt itself has no screenshot; its title, its message naming the
item and each button's outcome are asserted in the flow instead.

Two earlier phone runs are not counted.
- In one, another app came to the foreground during the journey.
- In the other, Wi-Fi ADB dropped after 11 minutes.

Neither failed inside the app.

Limits: no iOS run. A lost native alert (a save that returns while the app is
in the background) was reproduced and fixed later; see the KAN-32 and KAN-36
evidence below.
No network loss or handover was tested during a mutation. The evidence comes
from one device over Wi-Fi ADB, against the local stack only, not hosted. It is
not a production-readiness claim.

Still open beyond Slice 2:
- Production gates in [production follow-ups](production-follow-ups.md),
  including PF-IOS-001 (iOS build and physical behavior), PF-AUTH-001 (password
  recovery), PF-I18N-001 (English/German launch content) and PF-DATA-001
  (populated-database migration upgrade test).
- Hosted use of the Slice 2 schema, which follows the tracked hosted migration
  path (KAN-29, adopt the hosted migration-history baseline).
- Low-priority follow-ups:
  - KAN-85 (KAN-32/36 review follow-ups (minors));
  - KAN-86 (KAN-27 review follow-ups (minors)).

  KAN-37 was fixed by the KAN-34, KAN-37 and KAN-38 change (PR #36); see its
  Android evidence below. KAN-39 and KAN-84 are covered by SHOP-UI-06 and their
  evidence below.

### KAN-33 and KAN-35 Android evidence

On 2026-11-13 the same phone (Xiaomi 23122PCD1G, Android 16, arm64-v8a) ran
over USB ADB; Wi-Fi ADB had dropped the Maestro driver twice that night.

- **Red:** the pre-fix APK from the step 5 evidence (SHA-256 starting
  `2B06821F`) with the new flow. Slice 1.1 passed; the shopping journey failed
  at the double-tap check, because after Cancel a second "Edit item" screen for
  Milk was still open.
- **Green:** an APK built from e8a6995 (SHA-256
  `ad1786f6d125336003ee3fc5aa4680414780c646a2065cc090786eddeba7f847`) with the
  flow from the KAN-33/KAN-35 evidence commit. `npm run test:e2e` exited 0:
  Slice 1.1 with verify, the shopping journey (both double taps) with
  shopping-verify, the four confirmation flows, the logcat check and cleanup.

Two earlier red attempts over Wi-Fi ADB broke inside Slice 1.1 (a retry that
could not reach the stack while a build ran in parallel, then a stalled Maestro
driver) and are not counted.

After the green phone run, the final review raised both "no second edit screen"
waits from 5 s to 15 s. That change has not run on the phone; it ran on the
emulator in [CI run 43334319720](https://github.com/Micha0371/PantryFlow/actions/runs/43334319720)
on 50352d3, which passed all four jobs, including the Android job with both
double taps. The Pantry double tap stays on
the name text "Milk", which the phone run showed opening the row; the row's
pressable combines several texts into one label, so `id` plus `text: Milk`
would not match it.

### KAN-34, KAN-37 and KAN-38 Android evidence

The same phone (Xiaomi 23122PCD1G, Android 16, arm64-v8a) ran over Wi-Fi ADB,
against the local stack through the loopback proxy and `adb reverse`.

- **Red (2026-11-13):** the KAN-33/KAN-35 APK from e8a6995 (SHA-256 starting
  `ad1786f6`) with the first version of the new Slice 1.1 step. The journey failed at the add double
  tap: after Cancel, a second "Add Item" screen was still open.
- **Green (2026-11-14, with the first version of the step):** an APK built from fc22508 (SHA-256
  `c7f8afe03b9a8cbcbcdc5eb6e180cc5a7877931bd0ff6fc38bd2fd1549290035`).
  `npm run test:e2e` exited 0: Slice 1.1 with the add double tap, then verify
  (8m 59s); the shopping journey with both KAN-33 double taps, then
  shopping-verify (7m 16s); the five confirmation flows with their verify
  steps; and cleanup.
- **TalkBack (KAN-34, 2026-11-17):** TalkBack 17.1 with a German system
  language and "Display speech output" on. Alice's Shopping list held Milk. Adding
  "Milk " showed the duplicate error, and TalkBack's speech caption read "This
  item is already on your shopping list.. Warnhinweis" ("Warnhinweis" is the
  alert role in German).
  A backspace cleared the error; adding again showed it and TalkBack spoke it
  again. The owner operated the phone; the agent typed the text over ADB and took
  the screenshots.
- **Screen-level error (optional check):** with shopping reads failing, the
  Shopping tab showed "Could not load the shopping list.", but TalkBack only
  said "Shopping ausgewählt". That error used only the alert role; KAN-39
  fixed it later (see its evidence below).

Earlier attempts are not counted: three red attempts that never reached the
check (missing Maestro path, Java 8, characters dropped over Wi-Fi ADB), a green
attempt that lost Wi-Fi ADB at the shopping cold restart after the double taps
had passed, a red re-run that started while the phone's screen was locked, and
a TalkBack attempt without the speech display, where only the
owner's hearing recorded the announcement. Screenshots stay in ignored
`.verification`.

The first CI run on fc22508 ([run 43979888156](https://github.com/Micha0371/PantryFlow/actions/runs/43979888156))
failed in the Android job at the new step: on the emulator's shorter screen
the focused name field's keyboard covers Save, so waiting for Save timed out.
The step now waits for the name field, closes the keyboard with a tap on the
plain "Category" label, taps Cancel and requires the name field to be gone
(09b489b). An intermediate version used `hideKeyboard` and passed on the
pre-fix APK on the phone, so it would have missed the defect; it was replaced.
The final step was shown failing on the pre-fix APK on the phone (a second
Add Item screen after Cancel), and Slice 1.1 passed with it on the fixed APK.
In that phone run the shopping journey's cold restart tapped the home screen's
"Shopping" icon before the app came forward; that run is not counted.
[CI run 43988001632](https://github.com/Micha0371/PantryFlow/actions/runs/43988001632)
on 09b489b passed all four jobs, including the emulator Android job with the
add double tap and both KAN-33 double taps.

Limits: Android only, one device, local stack only. The KAN-37 named error and
the empty-state Add Item button are covered by unit tests only. With the final
step, the full suite has passed on the emulator only; on the phone, Slice 1.1
passed and the unchanged shopping journey last passed on 2026-11-14.

### KAN-32 and KAN-36 evidence

KAN-32's two defects are unreachable through the current UI, so the evidence is
unit tests only (STATE-03). Four of the five new cases were shown failing on the
previous code (a stuck spinner, a missing re-read, a hidden load error, and
`['new', 'new', 'a']` for the duplicated row); the fifth, a write on a loaded
list issuing no re-read, guards unchanged behavior and passed before and after. KAN-36's Delete-and-Save test pins existing guards; it
was shown failing with `onDelete`'s busy guard removed.

The lost-alert check ran on 2026-11-17 on the same phone (Xiaomi 23122PCD1G,
Android 16) over Wi-Fi ADB, with the owner at the phone and the developer
option "Don't keep activities" on:

- **Pre-fix APK** (SHA-256 `c7f8afe0…0035`): the prompt opened over a busy edit
  screen (Save spinning, Cancel and Delete disabled). After Home and back,
  Android recreated the activity and React Native rebuilt the whole UI: a fresh
  edit screen without the prompt, every button enabled, Milk saved as Low and
  nothing added to the shopping list.
- **Fixed APK** from d9e5cd5 (SHA-256
  `1eeb6682631d348801f795c38f2dea8001acc55a3f2f3b28b5e2f7b5ae711115`): Cancel was
  enabled while the prompt was open, Delete stayed disabled and Save kept its
  spinner. After Home and back, the same rebuild as before.

So this trigger doesn't lock the form on either build.

The final review found the likely trigger: in React Native 0.88's
`DialogModule`, an alert requested while the app is in the background is parked
on a helper object that is created anew on each call, so it is never shown when
the app returns. A save that returns while the person is in another app
therefore loses the prompt. The agent reproduced this on the phone with a Maestro
check (`.verification/i1-check.yaml`, "Don't keep activities" off): the proxy
delays the pantry save by 30 s, the flow presses Home, waits for the save and
returns to the app.

- **Pre-fix APK:** no prompt, Save spinning, Cancel, Save and Delete all
  disabled, unchanged 15 s later. The form is locked; only the system back
  gesture leaves it.
- **Fixed APK:** no prompt, Cancel enabled, Save and Delete disabled. Cancel
  closed the screen, and the list showed Milk as Low.

Screenshots stay in ignored `.verification`.

[CI run 43998165097](https://github.com/Micha0371/PantryFlow/actions/runs/43998165097)
on d9e5cd5 passed all four jobs, including the emulator Android job.

Limits: no iOS run (PF-IOS-001); the Maestro flows are unchanged.

### KAN-39 and KAN-84 Android evidence

The same phone (Xiaomi 23122PCD1G, Android 16, arm64-v8a, TalkBack on, German
system language) ran over Wi-Fi ADB, against the local stack through the
loopback proxy and `adb reverse`. The owner operated TalkBack.

- **Tracer (2026-11-18), APK from 0c0615c (SHA-256 starting `67750b6b`):** with
  shopping reads failing from app start, opening the Shopping tab gave only
  "Shopping ausgewählt"; activating Try again, which shows the error on the
  visible screen, was announced. So the announcement reaches TalkBack on
  Android 16, but on a tab switch the tab announcement cut it off. A first
  attempt does not count: the fault was switched on after sign-in, when the
  shopping list had already loaded.
- **Fix, APK from ed07f54 (SHA-256 starting `edd34a47`):** the announcement
  waits one second after focus. Opening the Shopping tab gave "Shopping
  ausgewählt", then the error; Pantry and back to Shopping announced it again.
- **Final build, APK from 78a409c (SHA-256 starting `71a1c9c6`):**
  - with pantry reads failing from app start, the error appeared on the
    Pantry tab after the client's retries and TalkBack read it without a tap;
  - with shopping reads failing from app start, opening Shopping, and Pantry
    then Shopping again, read the error both times;
  - Add Item with an empty name, Add Item pressed twice: "Name is required."
    was read both times (KAN-84 item 3).
- **Maestro on the phone (same APK, TalkBack off):** all six flows passed,
  including the shopping journey with both cold-restart waits (KAN-84 item 5),
  with the Slice 1.1 and shopping database checks. The run then stopped at the
  check after the resend flow: Maestro hung 135 seconds inside its own
  `launchApp` step (the app itself started in 0.6 s), so the 60-second
  disposable link had expired when the check opened it. The two remaining
  confirmation steps ran on the CI emulator, not on the phone. An earlier
  attempt does not count: the phone canceled the unattended install of
  Maestro's driver app.

An antivirus app on the phone (AVG) flagged the sideloaded test APK as
suspicious and offered to uninstall it; it was dismissed. Screenshots stay in
ignored `.verification`.

### KAN-27 quality cleanup (no behavior change)

KAN-27 closed the open SonarCloud bugs and Critical/Major findings in
`pantry-flow/` and `tools/jira/` (48 findings). It changes no tested behavior;
the evidence is equivalence, not new coverage:

- **Startup redaction:** byte-identical output on a 7,240-case corpus; the old
  pattern took about 9 s on a 100,000-character line, the new scan is linear.
  A test pins 12,000 CR-separated labels on one line (the final review found
  that an earlier recursive version overflowed the stack there).
- **Catalog and inventory SQL:** identical parsed JSON before and after on the
  local stack, still read-only.
- **pgTAP:** 3 files, 65 tests before and after; wrong error codes in the new key
  tables fail exactly the 22 checks that use them.
- **Email checks (app and Jira CLI):** identical results on a 23-case table and
  200,000 random strings; the old patterns took 5 s (JS) and 31 s (Python) on
  `a@b.b.…b. `.
- **verify-hosted.cjs:** a failure after the run is reported and exits 1
  instead of crashing as an unhandled rejection.
- **App code:** new tests pin Button colors and opacity, the confirmation
  screen's states, every `fetchAllPages` exit, the tab icons, and stable auth and
  i18n context values; the test proxy's control, PKCE, delayed-write and 502
  paths; the Jira CLI suite grew from 45 to 47 tests (the new email-shape cases).

### KAN-85 and KAN-86 review minors

These close the review minors from the KAN-32/36 and KAN-27 packages and three
from the KAN-39/84 package (PR #39). Nothing in the app's behavior changes.

- **Pinned with new tests**, each shown failing with a deliberate mutation:
  - a pantry write that settles after the same user changes household does not
    re-read for the new household, so its list is not stranded loading
    (`isCurrent` guard, pantry-state.test.cjs);
  - a successful write on a loaded list clears an earlier refresh error;
  - a failure notice answered late, after Cancel, navigates, alerts and adds
    nothing (edit-item-prompt.test.cjs);
  - a Pantry load error on an unfocused tab is announced only once the tab is
    focused (screens.test.cjs).
- **Fixed:** the proxy's 502 test uses an upstream that drops connections
  instead of a closed port; `get_issue` marks its unused argument `_args`; the
  Jira suite count above; `announceError` lives in `lib/accessibility.ts`, so
  `Input` no longer depends on the router.
- **Declined:**
  - Cancel stays enabled during the shopping add after a pantry save, so nothing can lock the form (KAN-36). A failure notice missed after an explicit Cancel is the same outcome as a late answer.
  - After a write on a list that never loaded, the re-read briefly shows only the new row, and the end state is correct. For the pantry list this is unreachable through the UI. The shopping list can show it once, when the low/out prompt adds to a shopping list that never loaded; both providers stay alike.
  - AuthGate announces the session restore error as soon as it appears. That error comes seconds after start, when the request fails, and the phone showed such a late error is read correctly.

## UX-01B coverage — KAN-91 (change pantry status from the list)

Contract: the status control on each Pantry row opens an anchored selector;
choosing a status writes it with a conditional update (compare-and-set on the
cached status) and offers the D3 shopping prompt. Files are under
`pantry-flow/tests/`. The Android journey follows owner amendment A4.

| ID | Observable outcome | Automated coverage | Limit |
| --- | --- | --- | --- |
| STATUS-01 | A successful change writes only `status`, filtered by id, household and the cached status; the returned row replaces the cached one and reports the previous status | `pantry-status.test.cjs` (writes only status, returned row replaces the cached one); `integration/pantry-status.integration.ts` (matching compare-and-set returns the row and the previous status) | Local stack only |
| STATUS-02 | A concurrent rename survives a status write: the update touches only `status` | `integration/pantry-status.integration.ts` (concurrent rename); `pantry-status.test.cjs` (name changed elsewhere) | Separate authenticated clients, not a PGlite connection |
| STATUS-03 | A database already at the target status returns `already`: no write, `updated_at` unchanged, no prompt | `pantry-status.test.cjs`; `integration/pantry-status.integration.ts`; `pantry-list-status.test.cjs` (already never prompts, announces the database status) | None |
| STATUS-04 | A stale cache retries once against the database status; a second mismatch throws a conflict, and the provider adopts the fresh row, shows "Status not changed" with the conflict reason and the reconciled status | `pantry-status.test.cjs` (retry success, second mismatch conflict); `integration/pantry-status.integration.ts` (stale previous status retried); `pantry-list-status.test.cjs` (conflict message) | Exactly one retry by design; the conflict path is not driven on a device |
| STATUS-05 | A deleted row, or another household's row, gives the same `PF_PANTRY_MISSING` result: the row is dropped and the list re-read; edit is disabled while the write is pending and afterwards re-enabled | `pantry-status.test.cjs` (confirmed missing row drops and re-reads); `integration/pantry-status.integration.ts`; `pantry-list-status.test.cjs` (edit action disabled in flight, re-enabled after success, failure and a missing record) | Missing record is STATE-04's contract; no device run |
| STATUS-06 | An uncertain outcome (a thrown update, or an error with `code: ''`) throws `PF_PANTRY_STATUS_UNKNOWN`, keeps the cached row, marks it unconfirmed and starts a re-read; a confirmed coded error (e.g. `42501`) is rethrown unchanged with no mark; the mark clears on an accepted list read or an authoritative row, and survives a later write that discards the reconciling read; an unconfirmed item selecting its cached status still asks the database | `pantry-status.test.cjs` (uncertain cases, mark lifecycle, unconfirmed shortcut); `integration/pantry-status.integration.ts` (lost response after a committed write holds the new status) | Fault injection only; the lost-response case uses a fetch wrapper, not a real network drop |
| STATUS-07 | An uncertain outcome shows "Status change not confirmed", never prompts, and keeps the item's edit action disabled until confirmed, so the edit screen opens only on a confirmed record | `pantry-list-status.test.cjs` (uncertain outcome test); `components/pantry-item-row.test.tsx` (editDisabled disables only the content control) | Not run on a device |
| STATUS-08 | Household or identity change during a write or while the prompt is open: a write settling after the change writes nothing into the new scope, a later Add does nothing, and a late answer to an obsolete offer does not clear a newer prompt; the offer requests the native dialog synchronously, and a second selection inside the locked operation makes no call | `pantry-status.test.cjs` (household change); `shopping-prompt.test.cjs` (invalidate, household change, late answer, synchronous offer); `pantry-list-status.test.cjs` (household change with open prompt, lock gap, completion after losing focus, selector closes when its item leaves) | Unit/provider level; not driven by a real household switch on a device |
| STATUS-09 | The D3 prompt fires only for in stock to low, in stock to out, low to out and out to low; never for a change to in stock; Add uses the saved name and id and one linked add; a failed add shows the shopping notice and keeps the new status; Not now adds nothing | `shopping-prompt.test.cjs` (four D3 transitions, saved name and id, other household's item, failed add, prompting state); `pantry-list-status.test.cjs` (prompting transitions, failed add notice) | Android wording and buttons: STATUS-E2E-01 |
| STATUS-10 | Selecting the current status changes nothing: the selector closes and no call, write or prompt happens | `pantry-list-status.test.cjs` (same status closes without any call); `components/status-selector.test.tsx` (current option, scrim or Back dismiss, never select); `pantry-status.test.cjs` (cached status makes no API call) | None |
| STATUS-11 | The selector places itself: below the row when there is room, flipped above for the last row, a 16 dp edge margin, centered when neither side fits (large font), never over the top inset; a double tap or a second control writes once | `status-menu.test.cjs`; `pantry-list-status.test.cjs` (double tap, other controls disabled while in flight) | Real positioning at the largest font and in split screen: A11Y-STATUS-01 |
| STATUS-E2E-01 | Android journey, owner amendment A4: Out and Add hits the open Milk (duplicate notice, status stays Out); In Stock with no prompt; complete the open Milk on the Shopping tab; Low and Add creates a new open linked Milk with no notice; Out and Not now adds nothing; Out again changes nothing; the name still opens the edit screen. Taps: status change without prompt 2, with the prompt answered 3 | `.maestro/slice-3-status.yaml` on real local Auth/PostgREST through the loopback proxy, from its own seed (`seed:slice-3-status`) in `run-e2e.cjs` | Passed on the phone (2026-11-19): see the UX-01B Android evidence below |
| STATUS-E2E-02 | The journey's persisted outcome: Milk `out` with name and category unchanged, exactly three shopping rows (Milk completed and linked, Milk open and linked, Rye bread completed and unlinked), and nothing for the other household | `e2e-fixtures.ts verify:slice-3-status` with ordinary clients after the flow | Local stack only |
| A11Y-STATUS-01 | The content control reads name, details and "Edit item"; the status control reads name, status and "Change status" and is at least 48 dp; each option is at least 48 dp, the group is labelled with the item name and only the checked option is checked; tapping the status never opens the edit screen | `components/pantry-item-row.test.tsx` (labels, 48 dp, pressing status never calls onPress); `components/status-selector.test.tsx` (radio group label, checked option, 48 dp options) | Owner acceptance on the phone (2026-11-19), see the UX-01B Android evidence below: selector placement on the first and last rows, TalkBack focus into the menu and back to the status control, one announcement, no accidental edit, a dialog interrupted by backgrounding leaving the controls usable. Touch size is unit-tested at 48 dp and judged on the phone, not measured. Split screen was not checked |

### UX-01B Android evidence

The phone (Xiaomi 23122PCD1G, Android 16, arm64-v8a, German system language)
ran over Wi-Fi ADB, against the local stack through the loopback proxy and
`adb reverse`.

- **Maestro (2026-11-19), APK from 595b16d:** `npm run test:e2e` exited 0. All
  eight flows passed, including the Slice 3 status journey (3m 8s) and
  `status-verify`, after the Slice 1.1 and shopping journeys with their checks
  and the five confirmation flows. TalkBack was off.
- **Badge alignment:** during that run the owner saw the status badge sitting
  at the top of its row. `StatusBadge` kept `alignSelf: 'flex-start'` inside the
  new full-height status control. 4cf9841 removes it, with a row test that
  failed first.
- **Owner acceptance, APK from 4cf9841 (SHA-256 starting `059f5c09`):** the
  reserved account Alice had twelve local pantry items, including a long name,
  so the list scrolled. The screenshot shows every badge centred. The owner
  reported every step working:
  - the menu opens below the first row and above the last;
  - a tap outside closes it without a change;
  - with TalkBack on:
    - the row reads as two controls, edit and change status;
    - focus moves into the menu with the selected option announced;
    - choosing a status returns focus to the status control and announces it once;
    - Back closes the menu without a change;
    - the Milk prompt is read and Not now adds nothing;
    - backgrounding during a prompt leaves the badges usable.
  The step at the largest font was optional. Split screen was not checked. The
  owner operated TalkBack.

## UX-02 coverage — KAN-92 (search the pantry)

Contract: a search field above the Pantry list filters the loaded rows by name,
locally. A query is a case-insensitive substring of the trimmed text; nothing is
written. Files are under `pantry-flow/tests/`. The device run and the TalkBack
check are pending an owner session, so nothing below is claimed as run on a phone.

| ID | Observable outcome | Automated coverage | Limit |
| --- | --- | --- | --- |
| SEARCH-01 | The helper returns the same array for an empty or whitespace-only query, matches a case-insensitive substring of the trimmed query, lower-cases German characters consistently (no folding of umlauts) and keeps the list order | `pantry-search.test.cjs` | Pure function |
| SEARCH-02 | Screen states: typing filters rows and clearing restores the list; the field is a labelled search input that keeps taps and dismisses the keyboard on drag; a whitespace-only query shows the full list; no match shows its own state with the query and a clear action and no EmptyState; an empty pantry shows EmptyState and no field | `pantry-search-screen.test.cjs` (first five cases) | Component level |
| SEARCH-03 | Mutation consistency: results follow add, rename, delete and status change while a query is active, and search never calls a write | `pantry-search-screen.test.cjs` (results follow mutations; search never calls a write) | Component level |
| SEARCH-04 | A household change clears the query | `pantry-search-screen.test.cjs` (household change) | Provider level; no real household switch on a device |
| SEARCH-05 | The status selector closes when its item leaves the results; an emptied pantry drops the stale query | `pantry-search-screen.test.cjs` (selector closes; emptied pantry) | Component level |
| SEARCH-06 | The result count is announced once after typing pauses | `pantry-search-screen.test.cjs` (announcement) | Announcement call only; what TalkBack speaks is A11Y-SEARCH-01 |
| SEARCH-07 | Keyboard: results taps are kept with the keyboard open, a drag dismisses it, and a row, status or add press calls `Keyboard.dismiss`; while the keyboard is shown the add button and the list's bottom padding lift by the keyboard's overlap with the screen and return when it hides, and the listeners are removed on unmount (the Android phone hid the add button behind the keyboard) | `pantry-search-screen.test.cjs` (labelled search input, keyboard dismissed and keyboard-lift cases); `keyboard-overlap.test.cjs` | Phone (APK from c959e0e): the add button stays above the keyboard while searching, opens Add Item with the keyboard closed, and returns when the keyboard hides (owner check, 2026-11-19). The first build (fb053b3) showed the defect, which d4112c0 and c959e0e fixed |
| SEARCH-E2E-01 | Android journey: `ri` leaves Rice only, ` RI ` the same, `zz` shows the no-match state, its clear button restores Milk, Rice and Rye flour, and tapping Rice with the keyboard open opens the edit screen on the first tap, and the query survives the return | `.maestro/slice-3-search.yaml` from its own seed (`seed:slice-3-search`) in `run-e2e.cjs` | Passed on the phone (2026-11-19, APK from c959e0e): see the UX-02 Android evidence below |
| SEARCH-E2E-02 | Search wrote nothing: the pantry rows are exactly Milk (dairy, out), Rice and Rye flour (in stock), and the other household has none | `e2e-fixtures.ts seed:slice-3-search` (ordinary client insert) and `verify:slice-3-search` with ordinary clients | Local stack only; runs with the device journey |
| A11Y-SEARCH-01 | TalkBack reads the field label, the clear button and the result count; focus lands sensibly on the no-match state; the keyboard covers neither the results nor the add button | None automated | Owner TalkBack check on the phone (2026-11-19). The field is read as "Search items" (the placeholder) rather than its label "Search pantry", accepted as a meaningful name. The count is announced once after a pause, the clear control is read and easy to hit, and the no-match message and button are reachable. Keyboard: see SEARCH-07 |

### UX-02 Android evidence

Phone: Xiaomi 23122PCD1G, Android 16, arm64-v8a, German system language. It ran over Wi-Fi ADB against the local stack through the loopback proxy and `adb reverse`.

- **APK from fb053b3, first build:**
  - It crashed at launch with "No routes found". Metro's shared `%TEMP%/metro-cache` reused a router transform from another worktree, so the bundle held no screens. Not an app defect.
  - After the cache was cleared and the app rebuilt, two runs failed only because WhatsApp took the foreground mid-run. With it silenced, all nine flows passed, including the search journey and `search-verify`.
  - The owner's checks found the add button hidden behind the keyboard while searching (SEARCH-07). Everything else passed.
- **APK from c959e0e, final build (SHA-256 starting `8348181f`):** `npm run test:e2e` exited 0. All nine flows passed: Slice 1.1, Slice 2, the status and search journeys with their database checks, and the five confirmation flows. The owner then confirmed that the add button stays above the keyboard, opens Add Item, and returns afterwards.

Not checked: iOS (PF-IOS-001).

## UX-06 coverage — KAN-96 (High findings)

Contract: the High findings of the [form layout evaluation](../quality/2026-11-19-form-layout-evaluation.md), per the [UX-06 plan](../planning/2026-11-19-ux-06-form-consistency-plan.md). Medium and Low findings are dispositioned in KAN-96 afterwards. Files are under `pantry-flow/tests/`.

| ID | Observable outcome | Automated coverage | Limit |
| --- | --- | --- | --- |
| FORM-01 | Add Item, Edit Item and the shopping item keep Cancel and Save in a footer outside the ScrollView. The footer is the in-flow last child of the KeyboardAvoidingView column (not an overlay), and the ScrollView ends at its top, so the last field scrolls above it | `form-footer.test.cjs` (per screen: footer outside the ScrollView, in-flow, not absolute) | Component level |
| FORM-02 | On Android the footer lifts by the keyboard overlap and returns when the keyboard hides; iOS keeps KeyboardAvoidingView `padding` and applies no overlap | `form-footer.test.cjs` (lifts and returns; iOS no overlap); `keyboard-overlap.test.cjs` | iOS not run on a device (PF-IOS-001) |
| FORM-03 | A form opened while the keyboard is already visible lifts its footer: the hook seeds the overlap on the next frame, and a stale seed is dropped | `keyboard-overlap.test.cjs` (seed at mount; seed dropped if hidden); `form-footer.test.cjs` (per screen, visible at mount) | Seed measures once; an unsettled layout corrects at the next keyboard event |
| FORM-04 | The footer adds the bottom safe-area inset when the keyboard is hidden (3-button navigation), and the overlap when it exceeds the inset | `form-footer.test.cjs` (inset hidden; overlap shown; iOS inset only) | On iOS the inset also stays while the keyboard is up (cosmetic gap) |
| FORM-05 | Delete (Edit Item) and Remove (shopping item) stay inside the scroll content, never next to Save | `form-footer.test.cjs` (destructive actions stay in the scroll content) | Component level |
| FORM-06 | A shopping row press dismisses the keyboard before it opens the editor, and a fast double tap still opens it once (KAN-33) | `shopping-screen.test.cjs` (dismiss before push; fast-tap single push) | Component level |
| FORM-07 | Sign-in and registration add the keyboard overlap to their ScrollView bottom padding on Android, so the submit button can be scrolled above the keyboard | `auth-layout.test.cjs` | Component level |
| FORM-08 | The post-registration "Check your email" view stacks message, Resend and Go to sign in with 12 dp gaps, Resend first, with confirm-email's title spacing; Go to sign in is the secondary variant on all three confirmation screens (owner approval 2026-11-20) | `auth-layout.test.cjs` (stack and order; title spacing; secondary variant) | — |
| FORM-09 | The missing-item states (Edit Item, shopping item) stack the message, Retry and Back with 12 dp gaps and full-width buttons; the loading spinner keeps its own centered style | `missing-state-layout.test.cjs` | Not triggered on the phone; screen tests only |
| A11Y-FORM-01 | TalkBack reads the "Check your email" view as message, Resend, Go to sign in | None automated | Owner TalkBack check on the phone (2026-11-20) |

### UX-06 Android evidence

Phone: Xiaomi 23122PCD1G, Android 16, arm64-v8a, 3-button navigation (`navigation_mode` 0), against the local stack through the loopback proxy and `adb reverse`, over Wi-Fi ADB (USB ADB was not recognized during the session).

- **Local gates at `aaf74a2`:** `npm run test:fast` exited 0 (typecheck, 372 node tests, 18 jest, 1 safety); `npm run test:integration` 30/30.
- **APK from `aaf74a2`** (arm64-v8a, SHA-256 starting `137cabdc`; the bundle was checked for `login-submit` and `form-footer`):
  - First attempt: the phone dropped off ADB before the first flow; no flow ran.
  - Second run: Slice 1.1, Slice 2, the status and search journeys and the first four confirmation flows passed. The final confirmation pass failed with "device offline" mid-tap (a Wi-Fi drop; the router was later found to have been reset), not an app assertion.
  - Rerun of the whole confirmation block (the same commands and fixtures as `run-e2e.cjs`): all five confirmation flows passed. Together, every e2e flow passed on this APK. The logcat asset scan was not repeated in the rerun.
- **Owner checks (2026-11-20):** Add Item with the keyboard open on entry: Cancel and Add item visible, clear of the navigation buttons. Edit Item: Save visible with the keyboard open; Delete reachable by scrolling. Shopping item opened from a row with the add-field keyboard up: the keyboard closes and Save and Cancel are visible; Save stays visible with the name field's keyboard open. Sign-in → registration with the keyboard up: the keyboard closes on navigation; everything is reachable. "Check your email": spacing and order correct, TalkBack order correct. A first registration attempt failed only because the router was down; the retry passed.

Not checked: iOS (PF-IOS-001); the missing-item states on a device. **The owner accepted the iOS risk for merging PR #53 on 2026-11-20** (no Mac or iPhone available); the iOS keyboard and footer check (FORM-02, FORM-04) is tracked under KAN-69 for the first iOS simulator or TestFlight run.

## Slice 1.1 baseline coverage

| ID | Approved behavior / observable outcome | Reused automated coverage | Additional coverage | Manual / deferred limit |
| --- | --- | --- | --- | --- |
| AUTH-01 | Registration creates profile, household and one membership | `auth.test.cjs`; PGlite signup triggers | Local integration fixtures and real signup; pgTAP; Maestro confirmation-required signup | Real mail delivery is PF-EMAIL-001 |
| AUTH-02 | Signed-in vs confirmation-required outcomes route correctly | `auth.test.cjs`, `screens.test.cjs` | Maestro against local confirmation-enabled Auth | Hosted auto-confirm path historically tested on phone |
| AUTH-03 | Login succeeds, wrong credentials reject, feedback permits retry | Auth identity tests; historical device group 21 | Local integration rejects invalid/unconfirmed credentials; Maestro login | Maestro asserts translated wrong-password feedback and successful retry |
| AUTH-04 | Logout clears protected state; failed logout stays recoverable | `auth.test.cjs`, `screens.test.cjs` | Local refresh-token invalidation; Maestro signed-out deep link | Access JWTs are not claimed to revoke immediately |
| AUTH-05 | Saved session/cold restart restores identity and inventory | Auth restoration/race tests | Maestro process restart without clearing storage | Real device history retained |
| CRUD-01 | Empty state offers add, list opens correct item | `screens.test.cjs` | Maestro empty → add → edit | Empty-state art remains visual review |
| CRUD-02 | Add trimmed name/category/location; default in_stock persists | Pantry data/state tests | Local CRUD; Maestro + direct DB assertion of exactly one Milk/Dairy record | No quantity/batch model introduced |
| CRUD-03 | Edit name/category/location/status updates shared list immediately | `pantry-state.test.cjs`; validation tests | Maestro all stock states and delayed rename; local persistence reads | Schema keys remain language-independent |
| CRUD-04 | Cancel edits/deletes preserves data, confirm deletes only target | Provider delete/state tests | Maestro native alert cancel/confirm; local deletion readback | Native confirmation uses Android system button IDs |
| DUP-01 | Same household rejects exact/case/edge-space duplicates | `pantry-data.test.cjs`, `database.test.cjs` | Local HTTP and pgTAP; Maestro duplicate add | Unicode edge whitespace covered in existing DB tests |
| DUP-02 | Duplicate rename rejected; self edit allowed | Existing SQL/client/screen checks | Local API, pgTAP, Maestro | Existing record ID excluded client-side |
| DUP-03 | Category/location/status do not change uniqueness | Existing SQL checks | Local direct API and pgTAP | No silent merge/rename/delete |
| DUP-04 | Different names and different households allowed | Existing SQL checks | Two local households; Maestro distinct names | Internal whitespace intentionally remains significant |
| DUP-05 | Database enforces uniqueness with UI bypass and concurrency | Existing PGlite checks (single connection) | Local overlapping HTTP insert/update transactions; exactly one winner | Real multi-connection test complements PGlite |
| DUP-06 | 23505 uses existing translated validation without navigation | Existing add/edit screen tests | Maestro duplicate messages | English-visible Slice 1 assertions use approved text |
| ERR-01 | Blank/overlong/invalid values cannot persist | Existing data/SQL tests | Local HTTP and pgTAP constraints | Native text length limit remains platform behavior |
| ERR-02 | Loading/error differ from empty; retry recovers correct household | Household/provider/screen tests | Maestro real REST 503 through local proxy, retry succeeds | No offline queue or offline success promised |
| STATE-01 | Shared consumers observe add/edit/delete; stale reads cannot undo writes | `pantry-state.test.cjs` | Maestro list updates | Detailed timing stays in deterministic hook tests |
| STATE-02 | Account/household identity changes discard stale results and clear cache | Household/provider/auth tests | Maestro switches to empty second household | Switching households inside one account is outside Slice 1 |
| STATE-03 | A pantry write before the first successful read keeps the load error, re-reads after it settles and never leaves a spinner or a partial list; a write on a loaded list issues no re-read; an added row that a read already returned appears once (KAN-32) | `pantry-state.test.cjs` (five cases) | None: no current flow writes before the list has loaded | Unreachable through today's UI; mirrors the ShoppingProvider fix (SHOP-STATE-02) |
| STATE-04 | An item deleted on another device: a pantry update or delete that finds no row for this household (zero rows from the id-and-household-filtered write, `PGRST116` or `PF_PANTRY_MISSING`) drops the stale row at once, starts a household re-read and shows the edit screen's existing "no longer available" state with Back instead of the form. Transport, permission and server errors keep the cached row and issue no re-read; a failed re-read shows the load error with retry; a later write or a household change wins over the re-read, and a missing result that settles after a household change starts no re-read (CR-01, KAN-115) | `pantry-data.test.cjs` (contract), `pantry-state.test.cjs` (six cases), `edit-item-remove.test.cjs` (save path) | `behavior.integration.ts`: the provider's exact update and delete against a row deleted elsewhere and another household's row through real PostgREST return the same missing result, so nothing reveals a foreign row | Not run on a device or in Maestro: a second client deleting mid-edit needs a timed external delete; mirrors the ShoppingProvider recovery (SHOP-STATE-02). Since UX-01B the status write reuses this missing-record path (`PF_PANTRY_MISSING`, drop and re-read) and adds the uncertain-outcome mark and reconciliation: STATUS-05 and STATUS-06 |
| RACE-01 | Double submit locked immediately, failure unlocks retry | `mutation.test.cjs`, provider failed-write tests | Retained, not duplicated in Maestro | Synchronous race best covered in hook test |
| RACE-02 | Cross-screen save/delete exclusion and abandoned completion | Existing mutation/provider tests | Maestro delayed real PATCH, disabled delete, Back/new modal stays open | Proxy affects only local test transport |
| SEC-01 | All four tables isolate households/users | Existing SQL tests; 13 historical hosted groups | Local API both directions; pgTAP ordinary authenticated roles | Hosted runner excluded from CI |
| SEC-02 | No creator spoof/null, immutable identity/household/time | Existing SQL tests | Local HTTP + pgTAP creator/privilege checks | Author deletion may deliberately clear creator |
| SEC-03 | Profile name/language allowed; premium escalation denied | Existing SQL tests | Local API + pgTAP | Existing premium data audit remains operational |
| SEC-04 | Anonymous clients cannot access or create inventory | Existing SQL tests | Local anonymous client HTTP assertions | Admin client used only for fixture lifecycle |
| DATA-01 | Migrations apply in order on empty real Supabase | PGlite real SQL (UUID adapter) | Local `db reset --local` then pgTAP/API | No hosted migration is applied by this harness |
| DATA-02 | Legacy invalid/duplicate rows abort migration without data loss | Existing `database.test.cjs` transactional rollback fixture | Retained | Real upgrade fixture against populated Supabase remains deferred |
| DATA-03 | Author deletion preserves another owner's household item | Existing SQL case | Retained | Local API fixture cleanup also verifies owner cascades |
| DATA-04 | Paging beyond 1000 does not truncate or conceal failed pages | `pantry-data.test.cjs` | Retained | Native 1000-row scroll performance deferred |
| NAV-01 | Pantry/settings, modals, Back and signed-out deep links | Existing screen/AuthGate/mutation checks | Maestro deep links, cancel, Android Back | Visual tab icon appearance still needs screenshot review |
| LIFE-01 | Foreground starts token refresh; background stops it | New `lifecycle.test.cjs` | Maestro Home/foreground + cold restart | Long-duration expiry/background OS eviction deferred |
| LIFE-02 | Device connectivity loss recovers after reconnect | Existing failed-read/write retry tests | Native REST 503/recovery through local proxy | Actual airplane-mode/network handover remains manual/deferred; no offline queue is approved |
| I18N-01 | English, persisted locale, fallback and language-independent keys | Screen translated errors; i18n provider checks; `i18n-catalogue.test.cjs` (EN/DE key parity, missing keys); `i18n-encoding.test.cjs` | Local DB rejects translated enum values | Language selection: LANG-01 to LANG-10 and LANG-PHONE-01. German layout and font scaling are not yet checked (KAN-62) |
| DEVICE-01 | First category tap works with keyboard open | New RNTL native-primitives case | Maestro leaves keyboard open and DB verifies Dairy | Catches the confirmed first-tap failure |
| DEVICE-02 | Native fonts/assets initialize without prior AppDirectories failure | SDK-compatible dependency retained | Separate native APK; native autolink prerequisite and Android logcat error gates; screenshots | Pixel-perfect glyph rendering remains manual; absence of errors alone is insufficient |

Excluded product features remain excluded: shopping, invitations, multi-household
selection, premium limits, quantities/expiry/batches, filters, pull-to-refresh,
offline queue, password reset and OAuth. Tests must not add them to make a
scenario pass. A discovered behavioral defect gets its own reproducible failing
case and separate reviewable fix; it must not silently alter this reference.

## SDK upgrade compatibility gates (PF-SDK-001)

| ID | Behavior | Coverage | Execution status |
| --- | --- | --- | --- |
| SDK-01 | Existing acceptance scenarios survive SDK 52 → 58 | Original Node, RNTL, pgTAP, API and Maestro suites retained | Fast, local database/API and two fresh Android/Maestro CI runs pass |
| SDK-02 | Category first tap remains handled with keyboard open | `keyboard-contract.test.cjs`, async RNTL case, existing Maestro flow | Node/component, Maestro and physical keyboard-open first tap pass |
| SDK-03 | Windows prebuild relocates native package correctly | `native-tooling.test.cjs` exercises actual Expo config plugin; Windows CI job | Original-module replay fails; corrected regression passes locally and on Windows CI |
| SDK-04 | Fresh native fonts/icons and lifecycle work on SDK 58 | Existing Maestro native font/error checks and physical ARM64 smoke | Maestro and physical Android 16 pass; native icons visually verified |

## Email confirmation release gate (PF-EMAIL-001)

| ID | Behavior | Automated coverage | Remaining acceptance |
| --- | --- | --- | --- |
| EMAIL-01 | Confirmation-enabled signup has no session until valid link | Auth regressions; real local Auth/Mailpit integration; first-signup Maestro path separate from resend | Controlled custom-SMTP first signup passed on physical Android at 23:38 Berlin on 2026-11-09, with backend session verification |
| EMAIL-02 | S256 PKCE callback exchanges once and survives restart | Native Crypto RFC 7636 vector; callback component tests; real Auth integration | Maestro and physical hosted callback passed |
| EMAIL-03 | Expired/replayed/invalid links cannot authenticate | Parser and screen regressions; actual local Auth expiry and replay | Physical expired-link recovery passed |
| EMAIL-04 | Resend creates a usable replacement; overlap and rate limits recover | Resend screen tests; actual local Auth/Mailpit resend | Hosted resend receipt and Android completion passed |
| EMAIL-05 | Confirmation session restores after restart and isolates household | Real local session restore; Maestro confirmation-complete and fixture verification | Native suite passed in full run 42599010616; physical hosted callback session survived cold restart |
| EMAIL-06 | A confirmation link cannot replace an already signed-in account: no code is exchanged, the existing session is kept, and the callback rejects | `tests/email-confirmation.test.cjs` (a callback cannot replace an already signed-in account); removing the guard fails an assertion within a second ([S13 remediation](../release-readiness/S13-ASSERTION-REMEDIATION.md)) | Mocked Supabase client; the PKCE setting and hosted confirmation are separate (SP-4 partial) |

Local email integration passed against Auth 2.197.0, matching hosted Auth.
The pinned CLI 2.122.1 replaces the older local Auth that ignored resend PKCE
challenges. This change is separate from the validated SDK baseline.

### Custom SMTP investigation (2026-11-09)

Resend delivered mail from `noreply@auth.householdkit.app`. A fresh signup
link, after click/open tracking were disabled, confirmed the controlled account
but did not establish a hosted session (`last_sign_in_at` remained empty), and
the Android app showed login. The earlier successful physical acceptance used
a resent confirmation. It does not establish that initial custom-SMTP signup
works. That initial failure was kept open until the final acceptance below.

The native runner now exercises a valid first signup before resetting only the
reserved local confirmation account and exercising expiry/resend. It checks
the backend sign-in timestamp before any independent password login, explicitly
stops/relaunches the app for session persistence, and retains separate first-link
reports. Maestro receives an explicit device argument when `ANDROID_SERIAL` is
set, since that ADB environment variable alone did not restrict Maestro's target.

The first local investigation run used an outdated emulator APK lacking the
current callback screen. Its failure is not evidence about the current source.
After rebuilding, valid first-signup native confirmation, force-stop/relaunch
persistence, logout and deliberately invalid callback recovery passed. The
backend sign-in timestamp was verified before resetting that reserved fixture.
Current local API integration (including first-link PKCE exchange, restart and
replay) and fast checks also pass. These local results were kept separate from
the hosted email/browser acceptance completed below.

The focused fresh-APK native rerun also passed the existing actual expiry,
resend, confirmation, force-stop/relaunch and invalid-link recovery path. Local
fixture cleanup completed. This was the confirmation subset, not a new claim
that the whole CRUD suite or hosted SMTP flow passed. Local reports are
`.verification/maestro/confirmation-first-complete.xml`,
`confirmation-resend.xml` and `confirmation-complete.xml` in the same directory.

### Android initial-link startup race

The diagnostic hosted signup used S256 and returned HTTP 200. Opening its email
confirmed the account without a sign-in timestamp. Android recorded a VIEW
launch into the test app, but the restarted Router received the root without
the callback/code. The installed Router's Android initial-URL implementation
uses a 150 ms timeout before substituting that root.

`native-confirmation-link.test.cjs` executes that installed timeout boundary with
a delayed React Native bridge and an already cached native confirmation. It
failed with the original identity routing, and passes with `+native-intent.tsx`.
The fallback uses Expo's native link cache only for initial Android root startup,
accepts only the configured app's exact confirmation route, and clears that
cache after handoff. Tests also cover foreign links, other navigation, expired
callbacks, cache replay, unavailable native API and unchanged iOS behavior.
The attempted emulator background-kill reproduction refused to proceed because
Android had not actually killed the process; it is not counted as evidence.

The startup fix is commit `85d0114`, separate from the harness commits. Local
fast checks pass (50 Node checks, one RNTL case, target safety and typecheck).
A fresh ARM64 build passed and the patched diagnostic test APK is installed.
A token-free native error callback displayed translated recovery. Full CI run
[42709533982](https://github.com/Micha0371/PantryFlow/actions/runs/42709533982)
passed fast, database, Windows tooling and fresh Android/Maestro at `85d0114`.
The real confirmation sent at 23:17 Berlin time was opened at 23:33. The patched
app reached the actual callback and displayed invalid/expired recovery rather
than login. Auth recorded confirmation at that click but no sign-in. This does
not establish successful valid-link exchange or the precise expiry stage; a
prompt live retry was needed. That consumed fixture was removed with
exact relational and aggregate checks, and its obsolete password was removed.
The fresh retry sent at 23:37 was opened at 23:38: the callback carried a code,
the token request carried its stored verifier, and Auth returned HTTP 200 and
recorded an actual sign-in. The protected empty pantry survived force-stop and
relaunch. Logout returned to login, and exact fixture cleanup preserved the
three manual-test accounts, three households and single pantry item. The
successful callback was warm (`recovered: false`), so it verifies the real
SMTP flow on the patched APK without proving that the fallback caused that
success. The fallback is independently covered by the failing-before/passing-after
delayed-bridge regression. Subsequent integration and sender-authentication
verification are recorded in the [2026-11-10 evidence](../release-readiness/2026-11-10-email-authentication.md), including public DNS and fresh Gmail SPF/DKIM/DMARC PASS. The initial recipient test alone did not establish those results.

## UX-04 coverage — KAN-94 (faster item entry)

Contract: Return on the Add Item name field saves and stays for the next item; the Add item button saves and closes; Cancel reads Done after a Return save. Files are under `pantry-flow/`.

| ID | Observable outcome | Automated coverage | Limit |
| --- | --- | --- | --- |
| ENTRY-01 | Return with a valid name adds once, clears the name, keeps category and location, stays open and shows the confirmation line | `tests/add-item-entry.test.cjs` (Return save) | Component level |
| ENTRY-02 | Return with an empty or overlong name shows the existing error and adds nothing | `tests/add-item-entry.test.cjs` (invalid input) | Component level |
| ENTRY-03 | A duplicate, including an item saved earlier in the same visit, shows the duplicate error and keeps the name; any failed save keeps name, category and location | `tests/add-item-entry.test.cjs` (duplicate; failed save) | Component level |
| ENTRY-04 | At most one item per intent: Return plus the button, or repeated Return, while a save is pending | `tests/add-item-entry.test.cjs` (busy guard) | Component level; a hardware or IME double submit is covered only through the same guard |
| ENTRY-05 | The Add item button still saves and closes; Cancel reads Done after a Return save and closes without adding | `tests/add-item-entry.test.cjs` (button; Done) | Component level |
| ENTRY-06 | A save resolving after the screen closed neither navigates nor updates state; text typed during a pending save is not cleared | `tests/add-item-entry.test.cjs` (late resolve; typed text kept) | Component level |
| ENTRY-07 | A Return save is announced once (the confirmation line is not a live region) | `tests/add-item-entry.test.cjs` (announce once) | The spoken output is not asserted; see the phone check |
| ENTRY-E2E-01 | Journey: add button, `Oats` + Return (confirmation, empty field), `Tea` + Return, `Rice` + Return (duplicate error, name stays), Done; the list shows Oats and Tea. `verify:slice-3-entry` reads back exactly Milk, Rice, Rye flour, Oats and Tea, with Oats and Tea at the default category `other`, location `pantry` and status `in_stock`, and nothing for the other household | `.maestro/slice-3-entry.yaml` from its own seed (`seed:slice-3-entry`); `verify:slice-3-entry` in `scripts/e2e-fixtures.ts` | Proves the name field keeps focus between items (typing lands without a tap); does not claim keyboard retention, which is a phone check. **Passed on the phone** (run 5, 2026-11-21, below) |
| ENTRY-PHONE-01 | On the phone: the Return key label, focus and keyboard kept between items (checked with the on-screen keyboard's own Return key, not adb or Maestro, whose key-event Enter hides the soft keyboard), and the TalkBack announcement spoken once per save | None automated | **Owner check passed on the phone (2026-11-21)**, below |

### Tap counts (beyond typing)

Before is measured against main with UX-06, where Save is already visible above the keyboard.

| Task | Before | After |
| --- | --- | --- |
| One item | add + Add item = 2 | add + Return + Done = 3, or add + Add item = 2 |
| Five items | 5 × (add + Add item) = 10 | add + 5 × Return + Done = 7 |

### Deviation

KAN-94's "keeps selected status" does not apply: the Add form has no status field, and new items stay `in_stock`. Category and location are kept between items.

### UX-04 Android evidence

Phone: Xiaomi 23122PCD1G, Android 16, arm64-v8a, against the local stack through the loopback proxy and `adb reverse`, over Wi-Fi ADB. USB ADB wasn't usable: Windows bound the phone's ADB interface to the generic WinUSB driver, which adb doesn't see.

- **Local gates at `746a4c1`:** `npm run test:fast` exited 0 (typecheck, 388 node tests, 18 jest, 1 safety); `npm run test:integration` 30/30; `git diff --check` clean.
- **APK from `746a4c1`** (arm64-v8a, SHA-256 starting `2eaff733`; the bundle was checked for `login-submit`, `add-item-saved`, `add-item-name` and `pantry-fab-add`):
  - Runs 1–4 failed for reasons outside the app, each confirmed from its screenshot: an overlay bubble caught the password-field tap; Maestro typed a doubled first character in the shared login step; the system USB-debugging dialog opened mid-run; a messaging app came to the foreground. None reached a UX-04 step with a failure.
  - **Run 5: `npm run test:e2e` exited 0.** Every flow passed: Slice 1.1, Slice 2, the status and search journeys, the new faster-entry journey (ENTRY-E2E-01) with `entry-verify`, and the five confirmation flows.
- **Owner checks with the on-screen keyboard (2026-11-21):**
  - the Return key shows the "next" arrow;
  - after `Oats` + Return and `Tea` + Return, the keyboard stays open and the cursor stays in the field, with the confirmation line shown;
  - `Rice` + Return shows the duplicate error and keeps the name, and typing clears the error;
  - the footer button reads Done and closes to a list with Oats and Tea;
  - TalkBack speaks "<name>, added" once, not cut off;
  - a quick double Return adds one item.

All passed.

Not checked: iOS (PF-IOS-001).

## KAN-61 coverage — language selection

Contract: the app starts in the saved device choice, else the phone language (German phones get German, everything else English); signed in, a pending choice for that user is written to `profiles.language` first, else the account language is applied. Settings has an English / Deutsch radio row. Files are under `pantry-flow/`.

| ID | Observable outcome | Automated coverage | Limit |
| --- | --- | --- | --- |
| LANG-01 | The phone rule: a German first locale (any region) gives `de`, anything else `en`; without a saved choice the app starts in the phone language and does not save it, so a phone language change is followed at the next start | `tests/language.test.cjs` (phoneLocale; phone start, not saved; phone change followed) | Unit level; the real device locale is the owner check |
| LANG-02 | A saved device choice wins over the phone language; an invalid saved value falls back to the phone language | `tests/language.test.cjs` (saved choice; invalid value) | Unit level |
| LANG-03 | The build-time default `EXPO_PUBLIC_DEFAULT_LOCALE` replaces phone detection when valid and is ignored when invalid, and a saved choice wins over it; `e2e:prepare` writes the English default unless `PANTRY_TEST_LOCALE=phone` | `tests/language.test.cjs` (build-time default; saved choice over the default; e2e prepare) | Production never sets it; the built APK is not inspected |
| LANG-04 | On sign-in the account language is applied; a pre-KAN-61 account (`en`) stays English on a German phone, as the design accepts | `tests/language-sync.test.cjs` (account language; pre-KAN-61 account) | Component level |
| LANG-05 | A pending choice is written to the profile before anything else, with no profile read, and then applied; a failed write keeps it pending and still applies it; sign-up stores the current locale as pending for the new user; a newer Settings choice is never overridden by the startup sync (late read; choice during or before the pending flush) | `tests/language-sync.test.cjs` (pending first; failed pending write; signUp pending; late read vs choice; choice during flush; choice before save); `tests/settings-language.test.cjs` (choice noted) | Mocked Supabase; the real write is LANG-09 |
| LANG-06 | An offline profile read keeps the current language without error; a read for a previous user is never applied to the new one; signing out applies nothing; a user change or sign-out during a pending flush, a user change during the pending read, and a sign-out during the profile read apply nothing for the old user; a late storage read does not overwrite an explicit choice | `tests/language-sync.test.cjs` (offline read; stale user; sign out; stale user and sign-out during flush; user change during pending read; sign-out during read; storage read vs setLocale) | Ordering is simulated with controlled promises; each guard test was checked to fail with the user guard removed |
| LANG-07 | Settings shows English and Deutsch in their own language with the current one checked; choosing a language applies at once and saves to the profile when signed in, or only on the device when signed out | `tests/settings-language.test.cjs` (language row; choose Deutsch; signed out) | Component level |
| LANG-08 | A failed profile save keeps the choice, shows the error and remembers it as pending, and Retry saves; the last of two quick choices wins on screen and in the profile, saved in order with one pending clear after the last save; leaving Settings mid-save still finishes it; a language change from outside Settings or a user change drops a failed save's error and Retry, so it is never written to another account; an update that touches no row is a failure | `tests/settings-language.test.cjs` (failed save and Retry; last tap wins; leaving mid-save; outside change; user change; no-row update is a failure); `tests/language-sync.test.cjs` (profile-language read, validate, write) | Component level |
| LANG-09 | Database boundary: a profile defaults to `en` (00001); a user updates and reads back their own language (00002 grant); another user's language is neither readable nor updatable, 0 rows (00001 policies); `fr` is rejected by `profiles_language_valid` (00002) | `tests/integration/profile-language.integration.ts` (ordinary authenticated clients, local stack; each test creates its own fixture users and starting state, so order does not matter) | Local stack only, not the hosted project |
| LANG-10 | The chips expose radio semantics with the checked state inside a radio group; the language group is named "Language" | `tests/settings-language.test.cjs` (radio semantics; radio group named Language) | Props only; the spoken output is the TalkBack check |
| LANG-PHONE-01 | On the owner's phone: the German phone starts in German (build with `PANTRY_TEST_LOCALE=phone`); a chosen language persists across a restart; the second fixture account keeps its own language; TalkBack reads the radio chips and the "Language" group | Device run 2026-11-23, POCO X6 (Android 16, phone locale `de-DE`), main at `501a792`, Wi-Fi ADB, local stack. **E2E:** the English e2e build (arm64) passed `npm run test:e2e`, all 11 flows (a first attempt failed in the shopping flow's login on a keyboard-doubled character, `ppf.test…`; the rerun passed). **Owner checks**, on the `PANTRY_TEST_LOCALE=phone` build with app data cleared: (1) the fresh app started in German (login screen); (2) Alice's server-created account (language `en`) switched the app to English at sign-in, and Deutsch chosen in Settings stayed after a full restart, with `profiles.language = de` on the server; (3) Bob signed in in English and Alice again in German; (4) TalkBack announced the language group and the radio options with their state (owner: "works flawless") | **Passed.** Fixture accounts are created on the server, so they start in English; the "starts in German" check is the fresh app before sign-in |

## KAN-121 Part 5 coverage — e2e flows run alone (TEST-04, D2)

Contract: every Maestro flow seeds its own starting state (`e2e-fixtures.ts seed:<flow>`) and checks only its own effects (`verify:<flow>`); `npm run test:e2e -- --flow <name>` runs one flow; one run at a time per machine (lock in `os.tmpdir()`). The confirmation flows form one test (`confirmation`), because the PKCE link only opens in the app that registered.

| ID | Observable outcome | Automated coverage | Limit |
| --- | --- | --- | --- |
| E2E-IND-01 | Each flow passes alone from its own seed: slice-1-1, slice-2-shopping, slice-3-status, slice-3-search, slice-3-entry, confirmation | Device runs 2026-11-23/24, POCO X6 (Android 16), Wi-Fi ADB, local stack, branch `pantryflow/kan-121-e2e-seeds` at `57ef1ab`: all six passed with `--flow` (shopping on a rerun: the first attempt never started: the app install failed with `INSTALL_FAILED_USER_RESTRICTED`, "Install canceled by user") | Device-only. The owner reports seeing the Xiaomi install prompt once in the whole session; why that single install was refused is not established |
| E2E-IND-02 | The full suite passes with per-flow seeds | Same session: `npm run test:e2e`, all 10 Maestro flows passed (31 min) | Device-only |
| E2E-IND-03 | Order does not matter: slice-3-entry, then slice-1-1, each alone after the full suite | Same session: both passed | Two orders sampled, not all permutations |
| E2E-IND-04 | One e2e run per machine (machine-wide lock in the OS temp folder, held by `run-e2e.cjs`): every `e2e-fixtures.ts` command (prepare, seed, verify, cleanup, confirmation steps) refuses while another live run holds it, before any stack access or cleanup; the runner's own calls pass via `PANTRY_E2E_RUNNER_PID`; a dead or corrupt holder is taken over without a window in which the file is empty, and a live racer's lock is put back, not destroyed | Unit-tested: `tests/e2e-lock.test.cjs` (the lock functions: live holder refused, dead/corrupt/empty holder taken over, racer displaced) and `tests/e2e-fixtures-lock.test.cjs` (the real command code against a stubbed stack: a refused seed calls neither `fixtures` nor `cleanup`; every command refused; runner pid and a released or dead lock allowed). Manual proof only: the cross-worktree refusal, shown once in the Task 13 report. Untested: the Ctrl+C release in `run-e2e.cjs` (reasoned and reviewed, never exercised), `run-e2e.cjs` setting the runner pid, and two truly simultaneous takeovers (a narrow rename-to-relink window remains) |
| E2E-IND-05 | `--flow` selects exactly one flow; an unknown name fails with the list of valid names; an extra argument or a repeated `--flow` fails (`npm run test:e2e --flow x` without `--` is refused, not run as all flows); every flow header names its seed (the confirmation files name `seed:confirmation`) and every flow has a seed and a verify command | `tests/run-e2e-flows.test.cjs` | — |
| E2E-IND-06 | The login helper retries only the email typing (max 3 attempts) when the Wi-Fi keyboard doubles a character, keeping the exact-email assertion; the password is typed once and sign-in is submitted once outside the retry, so a doubled password character or a failed sign-in fails the flow at once | YAML parsed (js-yaml); review of `.maestro/helpers/login.yaml` (Maestro `retry`) | Success path rerun on the phone after the narrowing: slice-3-entry passed 2026-11-24 at `89812e7`. Not exercised on a failing attempt: no doubling occurred |
| E2E-IND-07 | The confirmation scenario's empty household is checked against a real foreign row: `seed:confirmation` gives Alice one Milk row, "Your pantry is empty" and `verify:confirmation` must hold for the new user while it exists, and `verify:confirmation` reads back that Alice still has exactly that row | `scripts/e2e-fixtures.ts` `seed:confirmation` and `verify:confirmation` (seed and verify assertions run only against the local stack) | Rerun on the phone with the new seed 2026-11-24 at `89812e7`: the whole `confirmation` scenario passed, with Alice's row present. Not shown to fail on a real leak (no leak was introduced) |
