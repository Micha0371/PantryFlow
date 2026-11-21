# Authorization request: hosted Auth read-only inspection (FV-A1)

**Status:** requested 2026-11-19; **approved by the owner on 2026-11-20** (methods M1 and M2, as suggested; M3 not set up). Approval covers this read only, not any hosted change.
- **M1 executed 2026-11-19T23:15Z:** the unauthenticated `GET /auth/v1/health` returned **401** (the hosted gateway requires an API key even for the health route). No key was used, as this request specifies, so item 1 moves to M2: the dashboard's infrastructure page shows the Auth version.
- **M2:** performed by the owner on 2026-11-21. The values and evaluation are in the [FV-A1 evidence note](../testing/2026-11-21-hosted-auth-read-fv-a1.md). Only the access-token expiry was not captured.

**Purpose:** confirm the hosted provider facts that the [password spec](2026-11-19-password-recovery-session-spec.md) and the [deletion spec](2026-11-19-account-deletion-spec.md) depend on. These are the Auth version, the password and session settings, rate limits, plan entitlements and retention. Without them, rollout of the 15-code-point policy (OD-A1) and the retention text (R-2 to R-4) can't be completed.

## Target

Hosted project `PantryFlow_Emergent` (`oiqteedkfwmcertgxqga`), the only hosted project, as documented in `docs/testing/hosted-verification.md`.

## Exact read scope

| # | Item | Why | Method |
|---|---|---|---|
| 1 | Auth server version | OD-A1: v2.198.0 or later counts code points | M1 |
| 2 | Minimum password length and required characters | Current policy and parity | M2 (or M3) |
| 3 | Leaked-password protection: available on the plan? enabled? | OD-A6 / F3 | M2 |
| 4 | "Secure password change" (reauthentication) and "require current password" settings | OD-A4 | M2 (or M3) |
| 5 | Auth rate limits: emails sent, token refresh / sign-in, verify, recover; email minimum interval | Abuse controls, password spec §5; deletion FV-B6 | M2 (or M3) |
| 6 | Rate-limit client-address header (if shown) | FV-B6 | M3 only, if exposed |
| 7 | Access-token (JWT) expiry, sessions timebox and inactivity timeout | OD-A8, session window | M2 (or M3) |
| 8 | Redirect URL allow-list (to plan adding `pantryflow://auth/reset`) | Recovery route | M2 (or M3) |
| 9 | Plan name; database backup type and retention; PITR on or off; log retention per product | R-3, R-4, the restore ledger | M2 |
| 10 | Auth audit-log storage setting (in database or disabled) | R-2 | M2 (or M3) |

## Methods, in order of preference

- **M1, version (public endpoint):**
  - one unauthenticated `GET https://oiqteedkfwmcertgxqga.supabase.co/auth/v1/health` from this machine;
  - only `version` and `name` are recorded;
  - no key, token or account is used.
- **M2, owner-performed dashboard check (preferred for everything else):**
  - The owner opens the listed dashboard pages and reports the values, or shares screenshots cropped to the listed fields.
  - Required pages: Authentication settings, Rate limits, Sign In / Providers → Email, URL configuration, Billing / Plan, Database backups, Logs settings.
  - The agent never receives a dashboard session or an access token.
- **M3, Management API read (only if the owner prefers automation):**
  - `GET /v1/projects/oiqteedkfwmcertgxqga/config/auth` with a personal access token the owner stores as a Windows Generic Credential. The token is read inside a script and never printed or passed as an argument, the same pattern as the PR token.
  - The response contains secrets (SMTP password, provider secrets, hook secrets). The script therefore prints only an **allow-list** of the field names for items 2, 4, 5, 6, 7, 8 and 10, and never writes the raw body to the terminal, a file or a log.
  - It is a GET only.

## Explicitly excluded

- **No writes of any kind:**
  - no settings changes, saves or toggles;
  - no migrations;
  - no function deployment;
  - no user creation or deletion.
- **No sensitive data access:**
  - no viewing of the Users table, user records, emails or audit-log contents;
  - no SQL queries against hosted data;
  - no `supabase link`, `db push`, `db pull` or `secrets` commands;
  - no Management API calls besides the one GET in M3.
- **No raw output:** no printing of keys, tokens, SMTP credentials or any raw configuration body.

## Output

- **Evidence note:** a dated note in `docs/testing/` with:
  - the values of items 1–10;
  - the method used for each;
  - who performed it;
  - which items remain unverified.

  It contains no secrets.
- **Spec updates:**
  - FV-A1 in the overview is marked done or partial;
  - OD-A1 rollout readiness is updated:
    - hosted version ≥ v2.198.0: yes or no;
    - if no, the rollout stays blocked and the owner decides the next step.

## Approval requested

Approve which methods may be used. Suggested: M1 plus M2, with M3 optional.

Approval of this read does not authorize any hosted change. The later configuration changes (minimum 15, require current password, leaked-password protection, the redirect URL) need their own approval.
