# Hosted Auth and project read (FV-A1) — 2026-11-21

**What this is:** the evidence note required by the [hosted Auth read request](../planning/2026-11-19-hosted-auth-read-request.md). The owner approved the request on 2026-11-20.
- **M1** (the public health endpoint) returned 401 and was not used further.
- **M2**: the owner read the dashboard of project `oiqteedkfwmcertgxqga` on 2026-11-21 and shared cropped screenshots; the controller transcribed the values below.

**Not recorded:** no keys, SMTP settings or user data were shared or recorded. Account email addresses visible on the project-access page are deliberately left out.

## Values

| # | Item | Value (2026-11-21) |
|---|---|---|
| 1 | Auth server version | **2.198.0** |
| — | PostgREST / Postgres | 14.5 / 17.6.1.104 (an upgrade to 17.12 is offered) |
| 2 | Minimum password length; required characters | **6**; none selected |
| 3 | Leaked-password protection | **Off**; "only available on Pro plan and above" |
| 4 | Secure password change; require current password when updating | **Off; off** |
| — | Secure email change | On |
| — | Magic links and email OTP | **Enabled**; email OTP expiry 3600 s, length 8 |
| 5 | Rate limits | Emails 30/h; token refreshes 150 per 5 min per IP; token verifications 30 per 5 min per IP; sign-ups and sign-ins 30 per 5 min per IP; minimum interval per user 60 s (applies with custom SMTP) |
| 6 | Rate-limit client-address header | Not shown |
| 7 | JWT signing keys; access-token expiry; sessions | Current signing key ECC (P-256); the previous HS256 shared secret is still listed as verifying tokens. **Access-token expiry: not captured.** Sessions: time-box 0 and inactivity timeout 0 (never), configurable on Pro only |
| 8 | Site URL; redirect allow-list | Site URL **`http://localhost:3000`**; redirect URLs `pantryflow://auth/callback`, `pantryflowtest://auth/callback` (no recovery route yet) |
| 9 | Plan; backups; PITR; region | **Free** plan, Nano compute; **"No backups"**, so no PITR; region **eu-central-1 (Frankfurt)** |
| 10 | Auth audit log storage | **Not written to the database**; events available through the Auth logs |

## Evaluation

**Settled by this read:**
- **OD-A1 rollout readiness:** the hosted Auth version is v2.198.0, which counts code points for the minimum length. The version precondition is **met**. The rollout still needs FV-A2 and the owner's separate approval of the hosted change (minimum 15).
- **Privacy notice (beta line B5):**
  - data is stored in the EU (Frankfurt);
  - the project keeps **no backups**, so deleted data is not retained in backups;
  - Auth audit entries are not stored in the database.
  - Platform log retention for the Free plan is still to be confirmed from Supabase's plan documentation before publication.

**Risks for the supervised beta** (owner decisions; each change to hosted settings needs separate authorization):
1. **Free plan without backups:** a database loss would lose all tester data. Free projects are also paused after a period of inactivity, which would interrupt a quiet beta. Options: accept and disclose, or upgrade to Pro.
2. **Site URL `http://localhost:3000`:** it is the default redirect and an email-template variable, so a fallback link would point testers to a dead address. It should point to a real page or the app's scheme.
3. **Magic links and email OTP enabled but unused by the app:** the app only exchanges the signup-confirmation code. Per the password spec, a magic-link session counts as a recovery session that can change the password without the current one. Turning it off reduces that surface; confirm first that signup confirmation is unaffected.

**Inputs for later decisions** (no action now):
- the minimum length 6 vs the approved 15 (KAN-81);
- leaked-password protection is unavailable on Free (OD-A6);
- secure password change and require-current-password are off (aligned when KAN-42/81 ship);
- sessions never expire, and configuring that needs Pro (OD-A8);
- the legacy HS256 key still verifies tokens: revoke only after confirming no client uses a legacy key.

**Remaining:** the access-token (JWT) expiry, from the dashboard's legacy JWT settings, is the only item not captured.
