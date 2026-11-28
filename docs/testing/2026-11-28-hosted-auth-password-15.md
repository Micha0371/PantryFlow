# Hosted Auth password minimum 15: read-back and check (KAN-82)

**Date:** 2026-11-28. **Project:** `PantryFlow_Emergent`, `oiqteedkfwmcertgxqga`. **Procedure:** [hosted CLI 3 guide](hosted-cli3.md), section 4.

## What was done

- **Change, by the owner in the dashboard:** minimum password length 6 → **15**, and no required characters. The change was made before a fresh "before" read-back, so the [FV-A1 read of 2026-11-21](2026-11-21-hosted-auth-read-fv-a1.md) serves as the "before" record. Nothing records the period between 2026-11-21 and the change.
- **After read-back:** cropped dashboard screenshots shared by the owner (Authentication → Sign In / Providers → Email; Attack Protection; Project Settings → Infrastructure → Service versions). The values below were transcribed from them. No keys or user data were visible.
- **Check (step 5), by the agent with the owner's go:** two sign-ups through the public sign-up API with the app's anon key, which was not printed.

## Read-back

| Setting | Before (FV-A1, 2026-11-21) | After (2026-11-28) |
|---|---|---|
| Auth version | 2.198.0 | **2.199.0** (upgraded by Supabase in between) |
| Minimum password length | 6 | **15** |
| Password requirements | none | none |
| Prevent use of leaked passwords | Off (Pro plan only) | Off (Pro plan only; Attack Protection shows "disabled") |
| Secure password change | Off | Off |
| Require current password when updating | Off | Off |
| Secure email change | On | On |
| Magic links and email OTP | turned off by the owner after FV-A1 | Off |
| PostgREST, Postgres | not recorded | 14.18; 17.11.0.003 |

Only the minimum changed among the settings this procedure covers. The Auth version difference was checked in the source before step 5: v2.199.0 counts the minimum in code points (`utf8.RuneCountInString` in `internal/api/password.go`), like v2.198.0. v2.197.0 counted bytes. Sign-up checks the password in `validateSignupParams`, before the user is created.

## Check (step 5)

| Sign-up password | Code points / bytes | Result |
|---|---|---|
| 14 ASCII | 14 / 14 | **422 `weak_password`, reasons `["length"]`** |
| 8 × `ä` | 8 / 16 | **422 `weak_password`, reasons `["length"]`**: hosted counts code points, so the byte-count bypass is closed |

Both used reserved `pf.test.kan82.hosted.*` addresses (run `8468414a`). A refused sign-up creates no account and sends no email, so nothing needed cleaning up. The accepted-side check (step 6) was not run, because it would create an account. The script is in the ignored `.verification/kan82-hosted-step5.cjs`.

## Findings for the owner

- **Local and hosted Auth differ:** CLI 3.2.0 runs Auth v2.198.0 locally, while hosted now runs v2.199.0. The password logic is the same in both. The local pin follows the tested baseline. Revisit it when the CLI is next updated.
- **PostgREST:** hosted shows 14.18. The local stack started by CLI 3.2.0 reported a PostgREST 16 image on 2026-11-28. That parity gap is not verified here; compare it in the next hosted drift check (SEC-02) before relying on PostgREST-specific behaviour.

## Status

KAN-82 hosted part: **done** for the policy, pending the owner's acceptance of this record. Per password spec §2.6, a release build with the new registration hint may now go to testers as far as the password policy is concerned; KAN-77's other gates still apply.
