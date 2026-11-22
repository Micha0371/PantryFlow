# KAN-61 Language Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the app starts in the phone's language (German phone → German, else English), the user can switch English/Deutsch in Settings, and the choice is saved on the device and in `profiles.language`, applying on sign-in.

**Architecture:**
- **`lib/language.ts`:** pure resolution helpers.
- **`I18nProvider`:** takes its initial locale from the saved device choice or the phone (`expo-localization`).
- **`lib/profile-language.ts`:** reads and writes the profile language, plus a per-user pending store.
- **`components/LanguageSync.tsx`:** mounted inside `AuthProvider`. It applies the account language on sign-in and flushes pending choices first.
- **Signup (approach A):** stores a pending language for the new user id, so the first session writes it to the profile.

**Tech Stack:** Expo SDK 58 / React Native 0.88, TypeScript, Supabase JS, `@react-native-async-storage/async-storage`, `expo-localization` (approved new dependency), `node:test` screen tests, local Supabase integration tests.

**Spec:** [KAN-61 design](2026-11-22-kan-61-language-selection-design.md) (owner-approved 2026-11-22, approach A), decision record Amendment 2 (S3-Q8).

## Global Constraints

- **Locales:** exactly `'en' | 'de'`. Phone rule: the first `getLocales()` entry with `languageCode === 'de'` (any region) → `'de'`, everything else → `'en'`.
- **Device storage:** the key stays `user_language`. The initial phone-detected locale is **not** written; only an explicit choice or an applied account language is written.
- **Precedence:**
  - signed out: saved device choice, else phone;
  - signed in: a pending choice for that user first (written to the profile, then applied), else `profiles.language`.
- **Profile writes:** only `profiles.language` of the signed-in user's own row (existing grant `UPDATE (name, language)` and policy `profiles_update_own`). No migration.
- **Ordering:** a profile read started for user A is never applied after the session user changed.
- **Test builds:** an optional build-time default, `EXPO_PUBLIC_DEFAULT_LOCALE` (`en` or `de`), replaces the phone detection when set. Production never sets it. `e2e:prepare` writes `EXPO_PUBLIC_DEFAULT_LOCALE: 'en'` into `.verification/e2e-env.json` (the e2e flows assert English text on the owner's German phone), unless `PANTRY_TEST_LOCALE=phone` is set; that build is for the owner's phone-language check.
- **Regional formatting:** unchanged (decision record §2).
- **UI labels:** `English` and `Deutsch` are always shown in their own language (not translated). New catalogue keys go into both `en.ts` and `de.ts` (key-parity test), German kept short, informal "du".
- **Scope:** no other new dependencies; existing testIDs unchanged.

## Review Focus

1. **Phone language changes after the first start, with no choice made:** the app follows the new phone language at the next start, because the detected locale is never written. → Task 1 test.
2. **Offline at session start:** the profile read fails; the current language stays, there's no error and no crash. → Task 2 test.
3. **Fast account switch:** A signs out and B signs in while A's read is in flight; A's language is never applied to B. → Task 2 test.
4. **Repeated taps in Settings during a pending save:** the last choice wins on screen and in the profile. → Task 3 test.
5. **Pre-KAN-61 account (`profiles.language = 'en'`) on a German phone:** English after sign-in, as the design accepts. → Task 2 test, documenting the accepted behavior.

---

### Task 1: Phone-language default in the i18n provider

**Files:**
- Create: `pantry-flow/lib/language.ts`
- Modify: `pantry-flow/lib/i18n/index.tsx`, `pantry-flow/scripts/e2e-fixtures.ts` (`prepare` writes `EXPO_PUBLIC_DEFAULT_LOCALE`)
- Test: `pantry-flow/tests/language.test.cjs`

**Interfaces:**
- Produces:
  - `export type Locale = 'en' | 'de'` (`lib/language.ts`; re-exported or imported by `lib/i18n/index.tsx`);
  - `isLocale(value: unknown): value is Locale`;
  - `phoneLocale(locales: ReadonlyArray<{ languageCode: string | null }>): Locale`;
  - `defaultLocale(override: string | undefined, locales: ReadonlyArray<{ languageCode: string | null }>): Locale`: a valid override wins, otherwise `phoneLocale`.
- `useTranslation()` keeps `{ locale, setLocale, t }`; `setLocale(next)` still applies the locale and writes `user_language`.

- [ ] **Step 1: Write the failing tests**
  - `phoneLocale maps a German first locale to de and anything else to en`: `[{languageCode:'de'}]` → `'de'`; `[{languageCode:'de'}]` with an Austrian region tag in other fields → `'de'`; `[{languageCode:'fr'}]` → `'en'`; `[{languageCode:null}]` → `'en'`; `[]` → `'en'`.
  - `without a saved choice the provider starts in the phone language and does not save it`: phone `de`, storage empty → `locale === 'de'`; `setItem` not called.
  - `a saved choice wins over the phone language`: phone `de`, `user_language = 'en'` → `'en'`.
  - `an invalid saved value falls back to the phone language`: `user_language = 'xx'`, phone `de` → `'de'`.
  - `a phone language change is followed while no choice was saved` (Review Focus 1): two provider mounts with storage empty, phones `en` then `de` → `'en'` then `'de'`.
  - `a valid build-time default replaces the phone language; an invalid one is ignored`: `defaultLocale('en', [{languageCode:'de'}])` → `'en'`; `defaultLocale('xx', [{languageCode:'de'}])` → `'de'`; `defaultLocale(undefined, …)` → `phoneLocale`.
  - `e2e prepare writes the English default unless the phone-language build is requested`: a unit check of the env object `prepare` writes (factor it into a small exported function if needed).

- [ ] **Step 2: Run** `node --test tests/language.test.cjs` (from `pantry-flow/`). Expected: FAIL, because `lib/language.ts` doesn't exist.
- [ ] **Step 3: Implement** `lib/language.ts`. In `I18nProvider`, the initial state is `defaultLocale(process.env.EXPO_PUBLIC_DEFAULT_LOCALE, Localization.getLocales())` (`import * as Localization from 'expo-localization'`); the saved valid choice replaces it after the AsyncStorage read, as today. Then the `e2e-fixtures.ts` `prepare` change.
- [ ] **Step 4: Run** the new file plus `tests/i18n.test.cjs` and `tests/i18n-catalogue.test.cjs` (add an `expo-localization` stub where those tests load the provider), then `npm run test:fast`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(i18n): start in the phone's language (KAN-61)`.

### Task 2: Account language: read, pending writes and sync

**Files:**
- Create: `pantry-flow/lib/profile-language.ts`, `pantry-flow/components/LanguageSync.tsx`
- Modify: `pantry-flow/lib/auth.tsx` (signUp), `pantry-flow/app/_layout.tsx` (mount `<LanguageSync />` inside `AuthProvider`)
- Test: `pantry-flow/tests/language-sync.test.cjs`

**Interfaces:**
- Consumes: `Locale` and `isLocale` (Task 1); `useTranslation().setLocale`; `useAuth().user`.
- Produces (`lib/profile-language.ts`):
  - `fetchProfileLanguage(userId: string): Promise<Locale | null>`: `select language from profiles where id = userId`; invalid or missing → `null`.
  - `saveProfileLanguage(userId: string, locale: Locale): Promise<void>`: update the own row; throws on error.
  - `getPendingLanguage(userId)`, `setPendingLanguage(userId, locale)`, `clearPendingLanguage(userId)`: AsyncStorage key `pending_language:<userId>`.
- `signUp`: after `supabase.auth.signUp` returns `data.user`, call `setPendingLanguage(data.user.id, <current locale>)` before returning, for both outcomes. `AuthProvider` reads the locale through `useTranslation()`; it sits inside `I18nProvider`.

- [ ] **Step 1: Write the failing tests** (stub supabase and AsyncStorage):
  - `on sign-in the account language is applied`: profile `de` → `setLocale('de')`.
  - `a pending choice is written to the profile before anything else and then applied`: pending `de`, profile `en` → `saveProfileLanguage(u,'de')` called, pending cleared, `setLocale('de')`, and no `setLocale('en')` at any point.
  - `a failed pending write keeps the pending choice and applies it`: save rejects → pending kept, `setLocale('de')`, no crash.
  - `an offline profile read keeps the current language` (Review Focus 2): fetch rejects → `setLocale` not called, no error state.
  - `a read for a previous user is dropped` (Review Focus 3): user A's fetch resolves `de` after the user changed to B (B's resolves `en`) → only `setLocale('en')`.
  - `signing out applies nothing`: user becomes null → no fetch, no `setLocale`.
  - `signUp stores the current locale as pending for the new user`: locale `de`, signUp returns `user.id = 'u1'` → `pending_language:u1 = 'de'`, in both the signed-in and the confirmation-required outcomes.
  - `a pre-KAN-61 account keeps its saved English` (Review Focus 5): phone `de`, profile `en`, no pending → `setLocale('en')`.
- [ ] **Step 2: Run** `node --test tests/language-sync.test.cjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the module, `LanguageSync` (renders `null`; keeps a ref of the current user id and checks it before every `setLocale`), the `signUp` change and the mount.
- [ ] **Step 4: Run** the new file, `tests/auth.test.cjs` and `tests/screens.test.cjs` (add stubs only), then `npm run test:fast`. Expected: PASS, with existing assertions unchanged.
- [ ] **Step 5: Commit** `feat(i18n): sync the language with the account profile (KAN-61)`.

### Task 3: Language row in Settings

**Files:**
- Modify: `pantry-flow/app/(tabs)/settings.tsx`, `pantry-flow/components/OptionChips.tsx` (radio semantics), `pantry-flow/lib/i18n/en.ts`, `pantry-flow/lib/i18n/de.ts`
- Test: `pantry-flow/tests/settings-language.test.cjs`

**Interfaces:**
- Consumes: `setLocale`, `useAuth().user`, `saveProfileLanguage`, `setPendingLanguage`, `clearPendingLanguage` (Task 2).
- Produces:
  - testIDs `settings-language-en` and `settings-language-de` (through `testIDPrefix="settings-language"`), `settings-language-error`;
  - keys `settings_language` (`Language` / `Sprache`) and `err_language_save` (`Could not save your language to your account.` / `Die Sprache konnte nicht in deinem Konto gespeichert werden.`).
- `OptionChips`: every chip gets `accessibilityRole="radio"` and `accessibilityState={{ checked: selected }}`; this helps all chip rows (KAN-100 L1, partly).

- [ ] **Step 1: Write the failing tests**:
  - `the language row shows English and Deutsch in their own language with the current one checked`;
  - `choosing Deutsch applies it at once and saves it to the profile when signed in`;
  - `a failed profile save keeps Deutsch, shows the error and remembers it as pending; Retry saves and clears the error`;
  - `signed out, choosing a language saves only on the device`;
  - `the last of two quick choices wins on screen and in the profile` (Review Focus 4: the first save resolves after the second choice → the final profile write is the second choice);
  - `chips expose radio semantics with the checked state`.
- [ ] **Step 2: Run** `node --test tests/settings-language.test.cjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the row (above Sign Out, gap `spacing.md`), the error with Retry (the existing `InlineError`, plus a secondary Retry `Button` while the error shows), the strings and the chip semantics. A save started for an older choice must not overwrite a newer one: track the latest requested locale in a ref and write only that.
- [ ] **Step 4: Run** the new file plus `tests/i18n-catalogue.test.cjs`, then `npm run test:fast`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(settings): choose English or Deutsch (KAN-61)`.

### Task 4: Profile boundary test, coverage and device check

**Files:**
- Create: `pantry-flow/tests/integration/profile-language.integration.ts`
- Modify: `pantry-flow/package.json` (add the file to `test:integration`), `docs/testing/coverage-matrix.md`

- [ ] **Step 1: Write the integration test** against the local stack, following the existing integration files' fixture pattern:
  - a user updates their own `profiles.language` to `de` and reads it back;
  - another user's `language` is neither readable nor updatable (0 rows);
  - `'fr'` is rejected by `profiles_language_valid`.
- [ ] **Step 2: Run** `npm run test:integration`. Expected: PASS, with the new tests included.
- [ ] **Step 3: Coverage matrix:** a "KAN-61 coverage — language selection" section, LANG-01…, plus a pending owner device check:
  - the German phone starts in German;
  - English persists across a restart;
  - the second fixture account keeps its own language;
  - TalkBack reads the radio chips.
- [ ] **Step 4: Commit** `test(i18n): profile language boundary and coverage (KAN-61)`.
- [ ] **Step 5 (controller, with the owner):**
  - a fresh device build (new native module);
  - `npm run test:e2e` on the phone with the default (English) build: all flows unchanged.
  - A second build with `PANTRY_TEST_LOCALE=phone` for the owner's phone-language check.
  - the owner's checks.
