# Phone session checklist: KAN-122, KAN-100, KAN-62

**Status:** prepared 2026-11-26, not run. Owner decision 2026-11-26: one combined phone session for the three device checks.

**Tickets:**
- KAN-122 (UX-09: Distinguish a connection failure from wrong credentials at sign-in)
- KAN-100 (A11Y-01: Expose selection chips and pantry rows to screen readers)
- KAN-62 (Validate bilingual layout, font scaling and native messages)

**Coverage rows this session closes:** AUTH-ERR-PHONE-01 (KAN-122) and A11Y-PHONE-01 (KAN-100) in [coverage-matrix.md](coverage-matrix.md). KAN-62 gets its own section from this session's results.

**Scope:** Android only, on the owner's POCO X6 (Android 16). Amendment 3 accepts Android evidence for beta line B7; iOS stays under KAN-69. Local stack only: no hosted call, mutation or account.

## 0. Preconditions (stop if one fails)

- [ ] Both PRs are merged into `main`, and the KAN-100 PR passed the Android e2e job on its exact commit. Write down the `main` SHA; every result below refers to it.
- [ ] Docker Desktop is running, and the local stack starts with `npm run db:start`.
- [ ] Free RAM is above about 3 GB, or close Opera and WSL first. Low memory has crashed builds and test runs.
- [ ] Phone:
  - transport is USB (check the driver binding first, see the device notes), or Wi-Fi debugging with a fresh `IP:port`
  - charging, so "stay awake" works
  - floating chat bubble or overlay closed
  - USB-debugging warning dismissed before the run
- [ ] Owner is present for the Xiaomi install prompt and AVG's warning on the test APK. Dismiss the warning; don't uninstall.

## 1. Build one APK from `main`

All three checks use the same APK. Build it from a short path (CMake fails over 260 characters), for example a detached worktree at `C:/pf` on the `main` SHA.

1. `npm ci --ignore-scripts`, then `node scripts/patch-expo-windows.cjs` (needed on a fresh Windows clone).
2. Delete `%TEMP%\metro-cache` and any stale `.verification/e2e-app/**/index.android.bundle`.
3. Set `PANTRY_TEST_TARGET=device`, then run `npm run e2e:prepare`. This writes the English build-time default; the language is switched in Settings later.
4. Set `PANTRY_TEST_ARCHITECTURES=arm64-v8a`, then run `npm run e2e:build`.
5. Check the build before installing:
   - [ ] the APK's mtime and SHA-256 changed; record the SHA-256
   - [ ] the bundle contains `login-submit` (screens present)
   - [ ] the bundle contains `Could not reach the server` (KAN-122 is in)
   - [ ] the bundle contains `New item for the shopping list` (KAN-100 is in)
6. `adb -s <serial> reverse tcp:54329 tcp:54329`, then `adb install -r <apk>`.
7. Start the test proxy on 54329 (forwards to the stack on 54321): `node scripts/e2e-proxy.cjs`. Seed the reserved fixture accounts with `npx tsx scripts/e2e-fixtures.ts seed:slice-3-status` (Alice: Milk, low; shopping rows Milk, linked, and Rye bread, checked). Add the long-named item for 4.2 in the app.

**Evidence rules (all sections):**
- Screenshots go only under the ignored `pantry-flow/.verification/phone-20261126/`.
- Fixture accounts and fixture data only. No real names, email addresses, tokens or links in screenshots or notes.
- Record each result as **PASS**, **FAIL** (with what was seen) or **NOT RUN** (with the reason). An unrun check is never PASS.

## 2. KAN-122: sign-in messages (signed out, English, then German)

Each probe replaces the proxy on port 54329 with a stub. Stop the proxy first, start the stub, run the probe, stop the stub, restart the proxy. Every stub binds to `127.0.0.1` only.

| # | Setup on 54329 | Action on the phone | Expected | Result |
|---|---|---|---|---|
| 2.1 | Proxy running (stack up) | Sign in as Alice with a wrong password | "Invalid email or password." | |
| 2.2 | **Nothing listening** (proxy stopped, `adb reverse` still set) | Sign in as Alice with the **correct** password | "Could not reach the server. Check your connection and try again." Not the credential message. This is the ticket's acceptance check | |
| 2.3 | Stub answering 503 with an HTML body: `node -e "require('http').createServer((q,r)=>{r.writeHead(503,{'Content-Type':'text/html'});r.end('<html>down</html>')}).listen(54329,'127.0.0.1')"` | Sign in, correct password | "Sign-in is not available right now. Please try again later." | |
| 2.4 | Stub answering 429: `node -e "require('http').createServer((q,r)=>{r.writeHead(429,{'Content-Type':'application/json','x-supabase-api-version':'2024-01-01'});r.end('{\"code\":\"over_request_rate_limit\",\"msg\":\"rate\"}')}).listen(54329,'127.0.0.1')"` | Sign in | "Too many sign-in attempts. Please wait a moment and try again." | |
| 2.5 | Proxy running. Register `pf.test.signup@example.com` in the app and don't confirm it | Sign in with that address and its password | "Confirm your email address first. You can request a new confirmation email below." | |
| 2.6 | **Survivorship probe.** Stub that accepts the connection and never answers: `node -e "require('net').createServer(()=>{}).listen(54329,'127.0.0.1')"` | Sign in, then wait up to 1 minute with a stopwatch | After about **15 s** the spinner stops and the connection message appears (the Auth form timeout; the Android HTTP client has none of its own). Record the time. FAIL if the spinner is still there after 30 s | |
| 2.6b | Same stub | Register a new `pf.test.signup@example.com` account | After about 15 s: the connection message, not "Could not create account." | |
| 2.6c | Nothing listening (as 2.2) | Register | The connection message | |
| 2.7 | Repeat 2.1 and 2.2 with the app in **Deutsch** (Settings → language, then sign out) | as above | "E-Mail oder Passwort ist falsch." / "Der Server ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut." | |
| 2.8 | With TalkBack on (from section 3), repeat 2.2 | Submit | TalkBack speaks the connection message without moving focus (KAN-84 behaviour unchanged) | |

After 2.6: stop the stub and restart the proxy. Confirm with 2.1 that sign-in works again before continuing.

## 3. KAN-100: TalkBack walkthrough (signed in as Alice)

The owner turns TalkBack on (Bedienungshilfen → Sehen → TalkBack). Also turn on Erweiterte Einstellungen → Entwicklereinstellungen → "Sprachausgabe anzeigen", so screenshots show the spoken text. Typing goes through `adb shell input text`. Run it once with the app in English and repeat 3.2 and 3.5 in German.

| # | Screen and action | Expected (German phone, so TalkBack's role words are German) | Result |
|---|---|---|---|
| 3.1 | Pantry list: swipe through one row | Open button reads "<name>, <category>, <location>" plus the edit hint; the status button reads "<name>, <status>" plus the status hint. The status is read once per row (owner decision: keep two buttons) | |
| 3.2 | Add Item: swipe into the category chips, then the location chips | Each chip reads "<option>, Optionsfeld, ausgewählt / nicht ausgewählt" (or similar). The group is announced as "Category" / "Location" (German: "Kategorie" / "Lagerort", in the app language) when focus enters it | |
| 3.3 | Edit Item: swipe through the status pills, double-tap another status | Pills read as radio buttons inside a group named "Status"; after the double-tap the new pill reads as selected and the old one as not selected | |
| 3.4 | Edit Item: category and location chips | Same as 3.2 | |
| 3.5 | Shopping: focus the empty add field, type "Milk", focus away and back | Empty field: reads "New item for the shopping list" and the field role. **With text: TalkBack must still read "Milk".** If it reads only the label and not the typed text, record FAIL: the label is then reverted (known Android risk) | |
| 3.6 | Touch targets: with TalkBack **off**, tap each chip and status pill near its top and bottom edge | Each tap selects the chip or pill (48 dp target) | |

## 4. KAN-62: bilingual layout, font scaling and native messages

Run 4.1–4.4 four times:
- **A:** app English, default font size
- **B:** app Deutsch, default font size
- **C:** app English, largest font size and display size (Einstellungen → Display → Schriftgröße / Anzeigegröße, maximum)
- **D:** app Deutsch, largest font size and display size

Take one screenshot per screen per pass.

| # | Screens and states | Check in every pass | A | B | C | D |
|---|---|---|---|---|---|---|
| 4.1 | Signed out: sign-in (with the KAN-122 connection message from 2.2 shown), registration, "Check your email", confirm email | No clipped or overlapping text; every button label fully visible. Watch `Button`: its height is fixed at 48 dp, so labels are likely to clip at the largest font size. All text is in the app language | | | | |
| 4.2 | Pantry: empty state, list with rows, the status menu open, search active, an item with a long German name (for example "Tiefkühl-Gemüsemischung") | Row name and meta are cut with "…" (one line), not overlapping; the status menu fits on screen | | | | |
| 4.3 | Add Item and Edit Item, **keyboard open** on the name field | Save/Cancel (Add) and Save (Edit) visible above the keyboard; Delete reachable by scrolling; chips scroll horizontally without clipping their labels | | | | |
| 4.4 | Shopping: list, add field with the **keyboard open**, item detail, an add error | Add field and Add button visible above the keyboard; detail Save/Cancel visible | | | | |

| # | Native messages (passes A and B only) | Expected | Result |
|---|---|---|---|
| 4.5 | Edit Item → Delete | System dialog title, message and both buttons in the app language | |
| 4.6 | Shopping item detail → Remove | Same | |
| 4.7 | Set a status to Low → the "add to shopping list" prompt and its failure notice | Same (`useShoppingPrompt` alerts) | |
| 4.8 | Settings → Sign out | Settings screen and any sign-out error in the app language | |
| 4.9 | Back arrow on the modal screens with TalkBack on | Record what TalkBack says. The back button's label may come from the phone language, not the app language: with the app in English on a German phone this is a mixed-language finding to record, not a failure, unless the owner decides otherwise | |

## 5. Cleanup (always, even after a failure)

- [ ] Stop any stub and the proxy; `npx tsx scripts/e2e-fixtures.ts cleanup` (removes only the reserved `pf.test.*` accounts).
- [ ] Restore the phone's font and display size. TalkBack off, "Sprachausgabe anzeigen" off.
- [ ] `adb reverse --remove tcp:54329`.
- [ ] Remove the `C:/pf` worktree without `--force`: delete its junctions with plain `rmdir` first (`cmd /c "dir /AL /S C:\pf"` lists them).
- [ ] Clear `%TEMP%\metro-cache`.

## 6. After the session

- **Results:** fill AUTH-ERR-PHONE-01 and A11Y-PHONE-01 with the `main` SHA, the APK SHA-256, the date and the transport. Add a KAN-62 section to the coverage matrix with the pass table.
- **Fixes:** each FAIL becomes its own small PR, tested first, then rechecked on the phone. Candidates the session may confirm:
  - `Button` with a fixed 48 dp height clipping at large font sizes (change it to a minimum height)
  - the Shopping field label (revert it if 3.5 fails)
- **Known remaining gap:** data requests (pantry and shopping lists, saves) still have no timeout. Sign-in, sign-up and resend got one in KAN-122. If 4.x shows a list that never stops loading on a bad connection, that is this gap.
- **Jira:** KAN-122, KAN-100 and KAN-62 move to Done only with the owner's approval for each ticket, after their rows are PASS on the recorded commit.
