# KAN-81: password policy options and recommendation

**Status:** policy approved by the owner on 2026-11-27 (see [Owner decisions](#owner-decisions-2026-11-27)). This record does not authorize any change: the app, local and hosted Auth stay unchanged until KAN-82, and the hosted change needs its own owner approval. KAN-80 is part of beta line B13 ([Amendment 4](2026-11-19-slice-3-decision-record.md#amendment-4--2026-11-27-beta-line-b13)); the beta scope is the policy, sign-up, and a check that bypassing the app cannot set a weaker password. Reset and update screens follow with KAN-42.

## Today

- **Local Auth** (`pantry-flow/supabase/config.toml`): `minimum_password_length = 6`, no character requirements.
- **Hosted Auth:** not read back; the hosted minimum and requirements are unknown until a read-back.
- **App:** the sign-up button stays disabled below 6 characters (`password.length < 6`, which counts UTF-16 units, not characters); the placeholder says "At least 6 characters". A weak-password rejection from the server shows the generic "Could not create account". The password fields set no autofill hints (`autoComplete`), so password managers may not offer to generate or save a strong password.
- **Accounts:** only test fixtures and the owner's accounts exist; no beta tester has an account yet.

## Guidance (read 2026-11-27)

| Topic | NIST SP 800-63B Rev. 4 | OWASP (cheat sheet, ASVS 5.0) |
|---|---|---|
| Minimum length, password as the only factor (PantryFlow has no MFA) | **15 characters** ("SHALL") | Cheat sheet: under 15 is weak without MFA. ASVS L1: 8, 15 "strongly recommended" |
| Maximum length the service accepts | At least 64 ("SHOULD") | At least 64 (ASVS L2) |
| Composition rules (must contain digits, symbols …) | **Not allowed** ("SHALL NOT") | Not allowed |
| Blocklist of common or breached passwords at sign-up and change | **Required** ("SHALL") | ASVS L1: top 3000; L2: breached set |
| Periodic forced changes | Not allowed; only on evidence of compromise | Not allowed |
| Spaces and Unicode | Accept; count each code point as one character; normalize to NFC ("SHOULD") | Accept all characters |
| Truncation | Not allowed: verify the whole password | Not allowed |
| Paste and password managers | Allow | Allow |

Sources: [NIST SP 800-63B Rev. 4, 3.1.1](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [ASVS 5.0 V6](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md). The German BSI's consumer advice still suggests mixing character types (or 25+ characters); that is advice to users, not a rule for services, and NIST and OWASP forbid imposing it.

## What Supabase Auth can enforce (read 2026-11-27)

- **Minimum length:** configurable; counted in characters (code points). The open-source server's default is 6; the docs call anything under 8 not recommended.
- **Required character types:** configurable (digits, lowercase, uppercase, symbols). Not recommended here (composition rules).
- **Leaked-password check (HaveIBeenPwned):** **Pro plan and above only; not on the Free plan** ([password security](https://supabase.com/docs/guides/auth/password-security), [pricing](https://supabase.com/pricing)). PantryFlow's hosted project is on the Free plan.
- **Maximum length:** the server rejects passwords over **72 bytes** (bcrypt), with HTTP 400 `validation_failed` and a message that says "characters". It never truncates. 72 bytes are 72 ASCII characters, but fewer with umlauts or emoji (ä takes 2 bytes). Source: `internal/api/password.go` in the open-source server; that hosted projects run the same code is assumed, not confirmed.
- **Where it applies:** sign-up and password changes, including reset. Existing users can still sign in with a password that no longer meets the policy; supabase-js then reports `AuthWeakPasswordError` (code `weak_password`, `reasons` such as `length`, `characters`, `pwned`; confirmed in the installed auth-js 2.119.0). Whether a session is still issued in that case is not confirmed.
- **No server hook for sign-up passwords:** Auth hooks cannot add a custom blocklist on the Free plan; the only server-side blocklist is the Pro-plan leaked-password check. An app-side list could be bypassed through the API, so it would be a hint, not enforcement.

## Options

| | A. 15 characters, no rules (recommended) | B. 8 characters, no rules | C. 8+ characters with required character types |
|---|---|---|---|
| Fits NIST and OWASP | Length, composition, truncation, Unicode: yes. Blocklist: only with Pro | Below NIST's 15 for password-only; ASVS L1 minimum | No: composition rules are forbidden |
| Users | Encourages passphrases ("milk and eggs on tuesday"); password managers help | Familiar | Familiar but frustrating; pushes predictable patterns ("Password1!") |
| Effort | Small: one setting, app messages, tests | Same | Same plus a rule message |

**Blocklist, separately:**
- **B1. Upgrade the hosted project to Pro and turn on the leaked-password check** (meets NIST's "SHALL"; a recurring cost; HIBP outages either block sign-ups or let them through, depending on a fail-closed setting).
- **B2. Stay on Free and record the missing blocklist as a dated deviation** for the supervised beta; decide B1 before the public release (KAN-80 is also a public-release gate). The 15-character minimum and Supabase's sign-in rate limits reduce the risk but are not equivalent protection: a long password can still be a known breached one.

## Recommendation

**Option A with B2 for the supervised beta:**
- **Minimum 15 characters**, counted the way the server counts them (code points), in hosted Auth, local Auth and the app.
- **No character-type rules.**
- **Maximum: the server's 72 bytes.** The app checks the same limit before sending and explains it ("too long; use fewer characters, umlauts count double"), so the server's misleading "characters" message never reaches the user. This keeps below NIST's "at least 64 characters" only for passwords heavy in umlauts or emoji; recorded as a known limit of the platform.
- **Spaces and any characters allowed; the app never trims, truncates or changes a password.** No NFC normalization in the app; recorded as a known gap to NIST's "SHOULD". Whether the Auth server normalizes is not verified; KAN-83 tests a password typed in composed and decomposed form.
- **Paste and password managers:** allowed; add `autoComplete="password-new"` on sign-up and `"password"` on sign-in (Android autofill and iOS strong-password suggestions).
- **Blocklist:** B2 now, with the deviation recorded; B1 decided before the public release.
- **Existing accounts:** no forced reset and no session revocation. Only test fixtures and the owner's accounts exist; set the policy on hosted **before** any tester registers, and re-create disposable test accounts with compliant passwords. Requirement for KAN-82: an existing user whose password no longer meets the policy can still sign in. How supabase-js reports `weak_password` at sign-in (as an error, or alongside a session) is not verified; if it arrives as an error, today's sign-in screen would show it as a failure, so KAN-82 must check this before the hosted policy changes.

## Owner decisions (2026-11-27)

| Decision | Approved policy |
|---|---|
| 1. Minimum length | **15 Unicode code points** |
| 2. Character requirements | **None**: spaces, any Unicode characters and passphrases are allowed |
| 3. Blocklist of compromised passwords | **B2 for the supervised beta**: stay on Free with this documented deviation; decide the Pro upgrade (B1) before the public release |
| 4. Existing accounts | **No forced reset**, and no session revocation only because the policy changes |
| 5. Messages | Clear English and German guidance for the 15-character minimum and the 72-byte server limit; a length rejection reads differently from a failed sign-in |

- **Passwords stay exactly as typed:** the app never trims, truncates or silently normalizes them. Paste and password-manager autofill are allowed.
- **Recorded deviation: no blocklist.** Missing the breached-password check deviates from NIST's "SHALL". The longer minimum does not replace it (see B2). Supabase offers the check on Pro and above.
- **Recorded provider limit: 72 bytes.** The server's 72-byte maximum can reject some passwords of 64 characters or fewer when they contain umlauts or emoji. PantryFlow therefore does not claim full conformance with NIST's "accept at least 64 characters".
- **Before the hosted change, KAN-82 resolves the two open points:** whether the Auth server normalizes Unicode, and whether `AuthWeakPasswordError` blocks sign-in for an existing account whose password no longer meets the policy.
- **Not authorized by this record:** the hosted Auth configuration change (separate owner approval) and any release step.

## After the decision (KAN-82, KAN-83)

- **KAN-82:** local `config.toml` and hosted Auth set to the decision (hosted change with its own approval and a read-back); the sign-up screen enforces the same length in code points and the 72-byte limit; `weak_password` and the over-long rejection get their own messages in English and German; the placeholder and autofill hints change.
- **KAN-83:** a local Auth API test that a 14-character password is rejected with `weak_password` / `length` and a 15-character one accepted, called directly (bypassing the app); boundary, Unicode, passphrase, double-submit and interruption tests; a hosted read-back that does not leave accounts behind; the existing sign-up, confirmation and sign-in flows unchanged.
- **Order:** before the hosted smoke test of the signed build (KAN-77 step 5) and the B3 re-registration rehearsal.
