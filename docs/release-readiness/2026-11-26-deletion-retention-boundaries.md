# What an account deletion removes, and what remains (beta line B4)

**Status:** analysis, 2026-11-26. When written, nothing here was checked on the hosted project. **Update, same day:** the authorized rehearsal checked class 1 and part of class 2 on hosted ([record](2026-11-26-populated-deletion-rehearsal-record.md)); everything else is still unchecked there. No retention period is invented: a period appears only with its source, everything else is marked **unknown**. Not legal advice.

**Sources:**
- the migrations 00001–00004;
- the local feasibility rounds FV-B3 and FV-B9e ([round 1](../testing/2026-11-19-account-lifecycle-feasibility.md), [round 2](../testing/2026-11-19-account-lifecycle-feasibility-round2.md)), local Auth v2.198.0, 2026-11-19;
- the [hosted Auth read FV-A1](../testing/2026-11-21-hosted-auth-read-fv-a1.md), 2026-11-21, owner-performed: hosted Auth v2.198.0, Free plan, no backups;
- the Supabase Auth source at tag [v2.198.0](https://github.com/supabase/auth/tree/v2.198.0): `internal/models/cleanup.go`, `internal/models/flow_state.go`, `internal/api/middleware.go`, `internal/api/admin.go`, `internal/conf/configuration.go`, read 2026-11-26.

## How a deletion reaches each record

The support path deletes the Auth user in the Supabase dashboard ([runbook](2026-11-21-interim-reset-deletion-runbook.md), B4 step 2). The migrations then remove the application rows:

| Record | Foreign key (migration) | Effect of deleting the Auth user |
|---|---|---|
| `public.profiles` | `id → auth.users`, `ON DELETE CASCADE` (00001) | Deleted |
| `public.pantry_households` owned by the user | `owner_id → auth.users`, `CASCADE` (00001) | Deleted, **including any other member's data in it** |
| `public.pantry_household_members` | `user_id → auth.users`, `CASCADE`; `household_id → pantry_households`, `CASCADE` (00001) | Deleted |
| `public.pantry_items` of that household | `household_id → pantry_households`, `CASCADE` (00001) | Deleted |
| `public.pantry_shopping_items` of that household | `household_id → pantry_households`, `CASCADE`; link to a pantry item `ON DELETE SET NULL (pantry_item_id)` (00004) | Deleted |
| Rows in **other** households with `created_by` = the user | `created_by → auth.users`, `ON DELETE SET NULL` (00002, 00004) | Kept; attribution cleared |

**A shared household would lose its data:** a household is deleted with its owner, even if other members exist. Today's beta has no invitations, and the [protocol](2026-11-26-populated-deletion-rehearsal-protocol.md) and the corrected runbook check that the household has one member before deleting.

## Data classes

| Class | What it holds | Removed by the deletion? | Established | Unknown, and how to settle it |
|---|---|---|---|---|
| **1. PantryFlow application tables** | Profile, household, membership, pantry and shopping rows | Yes, by the cascades above | Migrations; pgTAP author and household deletion (`shopping.test.sql`); local FV-B9e with 2 items and 1 shopping row; hosted rehearsal 2026-11-21 **without items** (account, profile, household, membership removed) | Hosted removal of a populated household: **shown 2026-11-26** ([record](2026-11-26-populated-deletion-rehearsal-record.md)) |
| **2. Auth account and session records** | `auth.users`, identities, sessions, refresh tokens, MFA factors and claims, one-time tokens | Yes, by Auth's foreign keys | Local FV-B3 and FV-B9e (v2.198.0): all cascade; the Admin API deletes the user row (`tx.Destroy(user)`) unless a soft delete is requested | The 2026-11-26 rehearsal showed the dashboard's **Delete user** as a hard delete, cascading to `auth.identities` ([record](2026-11-26-populated-deletion-rehearsal-record.md)). Still open on hosted: sessions, refresh tokens and the other Auth keys, because the test account had none |
| **3. Auth flow states** (`auth.flow_state`) | One row per PKCE flow, for example sign-up confirmation: user id, sign-in method, PKCE code challenge, auth code, timestamps; provider token columns are for OAuth sign-in, which PantryFlow does not use | **No**: no foreign key, no deletion in Auth's user-delete code. Locally the row survived (FV-B3, FV-B9e) | Auth v2.198.0 has a cleanup that deletes flow states older than **24 hours**, at most 100 at a time; each successful write request runs one of its cleanup statements in turn, and only if `DB.CleanupEnabled` is set (**default false**) (`cleanup.go`, `middleware.go`, `configuration.go`) | Whether hosted Supabase enables that cleanup: not stated in the source or in documentation found. **The hosted retention of these rows is therefore unknown.** Settle by asking Supabase support, or by an authorized hosted read of the target's rows a day after the rehearsal |
| **4. Provider logs** | Auth and API request logs: account events, IP addresses | No; the provider keeps them for its log period | FV-A1 (dashboard setting): hosted Auth audit entries are not written to the database. Auth v2.198.0 writes a `user_deleted` audit entry with the user's email on deletion (`admin.go`), to the database unless database storage of audit entries is disabled (`DisablePostgres`); the rehearsal counts entries naming T to confirm the setting. Supabase's pricing page (fetched 2026-11-21): on Free, API and database logs are kept 1 day and Auth audit logs 24 hours | Whether other provider-side records exist (for example billing or abuse records): unknown, part of Supabase's data processing terms; legal review |
| **5. Email-provider records** | Recipient address, subject, delivery events of confirmation mails | No | Resend is the custom SMTP sender, confirmed by the owner on 2026-11-26 ([2026-11-09 record](2026-11-09.md); DKIM selector `resend` in the [sender check](2026-11-10-email-authentication.md)) | How long Resend keeps delivery records: unverified (Resend plan and terms); owner and legal review |
| **6. Support communications** | The request thread at the support mailbox; the support log (date and user UUID) | No; kept by the owner as proof of the request | Runbook steps 1, 5 | How long they are kept: owner decision OD-B4 / R-8 in the [deletion spec](../planning/2026-11-19-account-deletion-spec.md), open |
| **7. Backups and other copies** | Managed database backups; copies on testers' phones | Managed backups: **none exist** (FV-A1: Free plan, "No backups", no point-in-time recovery) | No backup can bring deleted data back, and none can restore data after a fault | Phones keep their own session and settings until sign-out or uninstall; whether Android device backups include them is unverified (SP-9). No other export or copy is known; none was searched for on hosted |

## What can be said to a tester today

- **Supported:** the account, profile, household, pantry items and shopping list are deleted (shown on hosted on 2026-11-26 for a single-member household, [record](2026-11-26-populated-deletion-rehearsal-record.md)). There are no backups from which they could be restored.
- **Not supported:** "all data is deleted" or "deleted at once". Flow-state rows in the app's own database, provider logs, mail delivery records and our own support correspondence remain for periods that are partly unknown.

## Owner decisions

**Owner decisions 2026-11-26:**
- **Rehearsal:** PASS accepted for its tested scope: a populated, single-member household created in the dashboard. It does not show the removal of sessions or flow states, which the test accounts did not have. No repeat is needed.
- **OD-B7, Auth flow states:** no additional privileged deletion. Unknown, possibly indefinite retention is **not accepted** as the final disposition. It needs confirmation of the hosted cleanup behaviour, or a separately authorized observation with an account created in the app, as part of the planned hosted sign-up work (KAN-77).
- **OD-B4, support correspondence:** recommended retention is **90 days after case closure** for the support thread and the minimal log (UUID, date, outcome), followed by deletion. This is **subject to legal review** and to any documented legal hold.
- **Supabase provider logs:** the distinction from application records is accepted. The provider's retention terms are verified before the privacy notice is published.
- **Resend delivery records:** retention and processing details are unverified. The applicable terms are obtained and reflected in B5.

**Originally listed as open:**

- **OD-B7, flow states:** accept until hosted cleanup is confirmed, or delete the user's `auth.flow_state` rows as a reviewed extra step (a hosted write, needing its own authorization).
- **OD-B4 / R-8:** retention of support records.
- **Email provider:** Resend, confirmed by the owner on 2026-11-26; its retention still needs recording.
