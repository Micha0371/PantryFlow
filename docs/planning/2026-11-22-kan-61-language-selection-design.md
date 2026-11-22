# KAN-61 — language selection and preference persistence (design)

**Status:** for owner approval, 2026-11-22.
**Decided by the owner (S3-Q8, 2026-11-22):**
- follow the phone's language on first start, with no extra first-launch screen;
- a choice made in Settings is saved on the device and in the account's profile;
- on sign-in, the account's saved choice applies;
- detection uses `expo-localization` (dependency approved).

**Intent:** make the German catalogue (KAN-60) reachable. German phones get German without asking; anyone can switch in Settings; the choice follows the account to another phone, and a second account on the same phone keeps its own language.

## Rules

| Situation | Language shown |
|---|---|
| First start, nothing saved | Phone language: German if the phone's first language is German (`de`, any region), otherwise English |
| Signed out, a choice was made on this phone | That choice (device storage, `user_language`) |
| Signed in | The account's `profiles.language`, applied once loaded and cached on the device |
| User picks a language in Settings | Applied at once; saved on the device; if signed in, written to `profiles.language` |

The display language and regional formatting stay separate (decision record §2): nothing here changes date or number formatting.

## The new-account problem, and the chosen fix

Today the database creates every profile with `language = 'en'`. Without a fix, a German phone that registers would switch to English at its first sign-in.

| Approach | Trade-off |
|---|---|
| **A. App writes the language on the account's first session (chosen)** | When signup signs the user in directly, or the confirmation link creates the first session, the app writes its current language to the new profile. **No database change.** Accounts created before KAN-61 keep `'en'` until changed in Settings (only test accounts exist today) |
| B. Migration: the signup trigger reads the language from signup metadata | Cleaner for the database, but a new migration plus a hosted deployment, each with its own authorization gate |

## Robustness (KAN-61 acceptance)

- **Account switch:** a profile read is tied to the user id it was started for. A result that arrives after the user changed is dropped, so user A's language never lands on user B. After sign-out the phone keeps showing the last language; that is display only, not account data.
- **Failed save:** if writing `profiles.language` fails:
  - the new language stays on screen and on the device;
  - Settings shows that it couldn't be saved to the account, with a retry;
  - the pending choice is remembered per user, and written before the profile value is applied at the next session start, so a restart doesn't revert it.
- **Permissions:** reuse the existing own-row update of `profiles.language` (migration 00002 grants only `name` and `language`). A user can't read or write another user's language; this is covered by a local API test.

## Settings UI

A "Language" row with two options, each labelled in its own language: **English** and **Deutsch**.
- They use the existing chip control, with radio semantics for TalkBack.
- The selected option is marked.
- A save error appears inline under the row.

## Verification

- **Unit and component tests:** the rule table (phone `de-DE` → German; `de-AT` → German; `fr-FR` → English; saved choice wins when signed out; profile wins when signed in); the stale profile read after an account switch is dropped; the failed save shows the error, keeps the language, and retries at the next session; the first session of a new account writes the language (both paths); the Settings selection.
- **Local API test:** own `profiles.language` update allowed; another user's row is not readable and not writable.
- **Device (owner):**
  - the German phone starts in German;
  - switching to English persists across a restart;
  - the second fixture account keeps its own language;
  - TalkBack reads the options.
- **Device build:** `expo-localization` is a native module, so a fresh device build is required.

## Not in scope

French and Italian; regional formatting; a first-launch screen; the KAN-62 layout pass (text expansion, font scaling), which follows this.
