# Phone session checklist: KAN-127 (DATA-TO-PHONE)

**Status:** prepared 2026-11-27, not run. Closes the DATA-TO-PHONE row of the [coverage matrix](coverage-matrix.md) (KAN-127 section). PR #86 (KAN-127) is merged; build from main once the household-lookup fix (DATA-TO-09) is merged too, so observation 4.1 checks it.

**Ticket:** KAN-127 (UX-10: End hung data requests with a connection error instead of waiting forever). Beta line B13 needs it.

**What the phone shows that the tests can't:** React Native's Android HTTP client has no timeouts of its own, so only a real device shows that the app's 20 s data timeout really ends a request that never answers. The unit and hook tests run the same code in Node.

**Scope:** Android only, on the owner's POCO X6 (Android 16), with the test APK (`com.pantryflow.test`) built from a main commit that contains PR #86 and the household-lookup fix. Local stack only: no hosted call, mutation or account.

## 0. Preconditions (stop if one fails)

- [ ] That main commit passed the Android e2e job (it runs on its own for every main push that changes the app). Write down the SHA; every result below refers to it.
- [ ] Docker Desktop is running, and the local stack starts with `npm run db:start`.
- [ ] Free RAM is above about 3 GB, or close Opera and WSL first. Low memory has crashed builds and test runs.
- [ ] Phone:
  - transport is USB (check the driver binding first, see the device notes), or Wi-Fi debugging with a fresh `IP:port`
  - charging, so "stay awake" works
  - floating chat bubble or overlay closed
  - USB-debugging warning dismissed before the run
- [ ] Owner is present for the Xiaomi install prompt and AVG's warning on the test APK. Dismiss the warning; don't uninstall.
- [ ] A stopwatch (the phone's clock app on a second device, or a PC timer).

## 1. Build the APK from that main commit

Build from a short path (CMake fails over 260 characters): a detached worktree, for example `git worktree add --detach C:/pf7 <SHA>`, with a `node_modules` junction to the main checkout.

1. `npm ci --ignore-scripts`, then `node scripts/patch-expo-windows.cjs` (needed on a fresh Windows clone; skip both with the junction).
2. Delete `%TEMP%\metro-cache` and any stale `.verification/e2e-app/**/index.android.bundle`.
3. Set `PANTRY_TEST_TARGET=device`, then run `npm run e2e:prepare`.
4. Set `PANTRY_TEST_ARCHITECTURES=arm64-v8a`, then run `npm run e2e:build`.
5. Check the build before installing:
   - [ ] the APK's mtime and SHA-256 changed; record the SHA-256
   - [ ] the bundle contains `login-submit` (screens present)
   - [ ] the bundle contains `Check the list once it loads` (KAN-127 is in, with the corrected wording)
   - [ ] the bundle does **not** contain `The list has been refreshed` (the old wording is gone)
6. `adb -s <serial> reverse tcp:54329 tcp:54329`, then `adb install -r <apk>`.
7. Start the **phone fault proxy** on 54329 (forwards to the stack on 54321): `node scripts/phone-fault-proxy.cjs` from this checklist's PR branch (or `main` once it is merged). It prints `phone fault proxy on 127.0.0.1:54329 -> 127.0.0.1:54321`. Do not run the e2e proxy at the same time; both use 54329.
8. Seed the reserved fixture accounts: `npx tsx scripts/e2e-fixtures.ts seed:slice-3-status` (Alice: Milk, low; shopping rows Milk, linked, and Rye bread, checked). Sign in as Alice; the Pantry list shows Milk.

**Switching faults** (from a second terminal on the PC; each prints the proxy's state):

| Command | Effect |
|---|---|
| `curl -s http://127.0.0.1:54329/__test/hang-reads?table=pantry_items` | Pantry list reads get no answer; the household read and everything else still answer |
| `curl -s http://127.0.0.1:54329/__test/hang-reads` | Every data read gets no answer (Auth still answers) |
| `curl -s http://127.0.0.1:54329/__test/swallow-writes` | Data writes reach the stack and commit, but the app gets no answer (the answer is lost) |
| `curl -s http://127.0.0.1:54329/__test/hang-writes` | Data writes get no answer and never reach the stack (nothing commits) |
| `curl -s http://127.0.0.1:54329/__test/state` | Shows the switches, how many requests are held, and each swallowed write's table and stack status (201 = committed) |
| `curl -s http://127.0.0.1:54329/__test/restore` | Everything answers again; held requests are dropped |

Sign-in and token refresh (`/auth/v1/`) are always forwarded.

**Evidence rules (all sections):**
- Screenshots go only under the ignored `pantry-flow/.verification/phone-20261127/`.
- Fixture accounts and fixture data only. No real names, email addresses, tokens or links in screenshots or notes.
- Record each result as **PASS**, **FAIL** (with what was seen) or **NOT RUN** (with the reason). An unrun check is never PASS.
- For every timed check, record the seconds from the tap (or app start) to the message. Expect about 20 s; **FAIL if the spinner is still there after 40 s.**
- Run `restore` after every check, and confirm the next check starts from a list that loads.

## 2. The four KAN-127 checks (app in English)

| # | Setup | Action on the phone | Expected | Result |
|---|---|---|---|---|
| 2.1 | **Hung pantry list read.** Signed in, Pantry list loaded. Run `hang-reads?table=pantry_items` | Force-stop the app (`adb shell am force-stop com.pantryflow.test`), then open it again from the launcher; start the stopwatch | The spinner stops after about 20 s, then "Could not load items." with **Try again**. Run `restore`, tap Try again: the list shows Milk | |
| 2.2 | **Hung pantry save, committed.** Pantry list loaded. Open Add Item, type `Phone check eggs`, pick a category and location. Then run `swallow-writes` | Tap **Add Item**; start the stopwatch | After about 20 s, on Add Item: "The change could not be confirmed. Check the list once it loads before trying again." Never "Could not save item." `state` shows one swallowed `POST pantry_items` with status 201 | |
| 2.2b | Same, continue | Run `restore`. Go back to the Pantry list | The list shows `Phone check eggs` **exactly once** (the re-read after the write found the committed row) | |
| 2.2c | Same, continue | Open Add Item, add `Phone check eggs` again with the same choices | "An item with this name already exists in your household. Please use a different name." No second copy in the list | |
| 2.3 | **Hung shopping add, committed.** Shopping tab loaded. Run `swallow-writes` | Type `Phone check bread` in the add field, tap Add; start the stopwatch | After about 20 s, under the field: the same could-not-be-confirmed message, never a failure message. Run `restore`; the list shows `Phone check bread` exactly once (switch tabs and back if it has not appeared yet) | |
| 2.4 | **Failed reconciliation.** Pantry list loaded. Open Add Item, type `Phone check flour`, pick a category and location. Then run `swallow-writes` **and** `hang-reads` | Tap **Add Item**; start the stopwatch | After about 20 s: the could-not-be-confirmed message. | |
| 2.4b | Same, continue (faults still on) | Go back to the Pantry list; keep the stopwatch running | The re-read after the write also gets no answer: within about 20 s more, "Could not load items." with **Try again**. Never the old list presented as current, and never a message saying the list was refreshed | |
| 2.4c | Same, continue | Run `restore`, tap **Try again** | The list shows `Phone check flour` exactly once | |

## 3. German wording

| # | Setup | Action | Expected | Result |
|---|---|---|---|---|
| 3.1 | Settings → Deutsch. Pantry list loaded. Open Add Item, type `Phone check rice`, pick choices. Run `hang-writes` | Tap the add button | After about 20 s: "Die Änderung konnte nicht bestätigt werden. Prüfe die Liste, sobald sie geladen ist, bevor du es erneut versuchst." `state` shows no swallowed write (nothing was sent) | |
| 3.2 | Same, continue | Run `restore`, go back to the list | `Phone check rice` is **not** in the list (the write never reached the stack). Adding it again now saves it once | |

## 4. Observation (record what happens; not a pass/fail check of KAN-127's tested scope)

| # | Setup | Action | Record |
|---|---|---|---|
| 4.1 | App in English, signed in. Run `hang-reads` (every data read, including the household read) | Force-stop the app and open it again; start the stopwatch | The seconds until a message appears (about 20 s expected), and the message. Expected: "Could not load items." with Try again, **not** "No household found. Please sign out and back in." (DATA-TO-09; before the fix every failed household read showed that). Run `restore` and tap Try again: does the list load? |

## 5. Cleanup (always, even after a failure)

- [ ] `restore`, then stop the phone fault proxy; `npx tsx scripts/e2e-fixtures.ts cleanup` (removes only the reserved `pf.test.*` accounts).
- [ ] App back to English if the session ends in German.
- [ ] `adb reverse --remove tcp:54329`.
- [ ] Remove the build worktree without `--force`: delete its junctions with plain `rmdir` first (`cmd /c "dir /AL /S C:\pf7"` lists them).
- [ ] Clear `%TEMP%\metro-cache`.

## 6. After the session

- **Results:** fill DATA-TO-PHONE with the main SHA, the APK SHA-256, the date, the transport and each check's time to the message.
- **Fixes:** each FAIL becomes its own small change, tested first, then rechecked on the phone.
- **Observation 4.1:** if the household timeout still shows "No household found", the APK does not contain the fix; check the recorded SHA before anything else.
- **Jira:** KAN-127 moves to Done only with the owner's approval, after DATA-TO-PHONE is PASS on the recorded commit.
