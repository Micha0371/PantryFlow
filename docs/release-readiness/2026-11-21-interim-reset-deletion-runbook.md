# Interim password-reset and account-deletion support (beta lines B3, B4)

**Status:** owner decided option A for B3 on 2026-11-21. The deletion rehearsal passed on 2026-11-21 on an account without pantry or shopping items; a rehearsal with data passed on 2026-11-26 ([record](2026-11-26-populated-deletion-rehearsal-record.md); [correction 2026-11-26](#correction-2026-11-26)); the re-registration half of option A waits for a hosted-configured build (KAN-77). These are the interim support paths the [beta entry checklist](2026-11-21-beta-entry-checklist.md) allows until KAN-42 (password recovery) and KAN-43 (account deletion) are delivered. The decision record requires them to be **secure, documented and genuinely operational**; each needs one rehearsed request before the beta.

- **Support contact:** contact@mwsoftworks.com (owner, 2026-11-21).
- **Response time:** within **3 days** (owner, 2026-11-21). Testers are told this in the tester instructions and the privacy notice.
- **Who acts:** the owner only, on the hosted project (`oiqteedkfwmcertgxqga`).

## Verifying the requester (both procedures)

A request is acted on only when the requester has shown control of the account's registered email address:
1. The request arrives at the support contact.
2. The owner replies **to the registered address in the account** (looked up by the owner, never taken from the request), asking the requester to confirm the request by replying.
3. The owner acts only on a confirming reply from that registered address.

A request from any other address gets the same confirmation mail to the registered address, never an action on the requester's word. No user data is sent in these mails beyond what the requester already knows.

## B4 — account deletion (interim)

1. Verify the requester (above).
   - **Added 2026-11-26:** check that the requester's household has no other member (a read-only count of `pantry_household_members` for the household). Deleting an owner deletes the whole household, including another member's data. If there is another member, stop and ask the owner.
2. In the Supabase dashboard of the hosted project: Authentication → Users → find the user by the registered email → **Delete user**.
3. The database's foreign-key cascades remove the user's profile, household membership, owned household and its pantry and shopping items. Today's beta has no shared households, so no other user's data is affected.
   - **Added 2026-11-26:** before confirming, check with a read-only count by the user's UUID that the user, profile, household and membership are gone; if any remains, do not confirm and tell the owner.
4. Confirm the deletion to the registered address. State that the account, profile, household, pantry items and shopping list were deleted. Say that they cannot be restored, because the beta has no backups. Also say that some technical records stay for a time, such as sign-in records and records of the emails sent, and that the support correspondence is kept. *(Corrected 2026-11-26: the earlier text promised backup retention, but the plan has no backups.)* **[Owner and legal review: the exact wording, and whether to name each record.]**
5. Record the date and the user UUID only (no email, no names) in the owner's support log.

**Rehearsal (required before the beta; authorized by the owner on 2026-11-21):** create a disposable test account on the hosted project with an address the owner can receive, run steps 1–5 against it, and check that its rows are gone (a read-only query by the test account's UUID), then re-register with the same address (option A). Record the date and UUID only.

**Rehearsal record (2026-11-21):** test account `94d0dc13-b3a2-498b-9916-02eb36fd4366`, created by the owner in the dashboard (auto-confirmed). The owner ran the requester-verification mail exchange (request to the support contact from the test address, confirmation mail to the registered address, confirming reply) before deleting. A read-only count before the deletion showed auth user 1, profile 1, owned household 1, membership 1, pantry items 0, shopping items 0. The owner deleted the user in the dashboard. The same read-only count afterwards (01:05 UTC) showed 0 in every column. The cascades work on the hosted project. Both counts ran in `BEGIN READ ONLY` and returned counts only.

**Limitation (added 2026-11-26):** the rehearsed account held 0 pantry and 0 shopping items. The record shows that the account, profile, household and membership are removed, not that a household with data is. The closing confirmation (step 4) is not recorded. The rehearsal with data is the [populated-account protocol](2026-11-26-populated-deletion-rehearsal-protocol.md), and needs its own authorization.

**Rehearsal with data (2026-11-26):** an authorized rehearsal on hosted deleted a test account whose household held a pantry item and linked, manual and completed shopping items. All its counted records were removed, the records outside it read by the check were unchanged, and the closing confirmation was sent with the corrected step 4 wording: **PASS** ([record](2026-11-26-populated-deletion-rehearsal-record.md)).

## Correction 2026-11-26

Earlier wording, kept here so the history stays visible:
- **Step 4 said:** "state that backups keep data until they expire under the plan's backup retention (exact period from the pending hosted read, FV-A1)". The hosted read then found **no backups** on the Free plan, so that statement was wrong.

What does and does not remain after a deletion is listed in the [retention boundaries](2026-11-26-deletion-retention-boundaries.md):
- **Removed:** the application rows and the Auth account records, as shown locally (FV-B3) and for an account without items on hosted (2026-11-21). For a household with data on hosted it was shown on 2026-11-26 ([record](2026-11-26-populated-deletion-rehearsal-record.md)). Sessions and flow states were not part of that rehearsal.
- **Not removed by the deletion:** `auth.flow_state` rows, provider logs, email-provider records and the support thread. Some of their periods are unknown.

**Without managed backups:**
- deleted data cannot be restored, also not after a deletion by mistake;
- a fault in the service can lose data with no recovery;
- a support action therefore cannot be undone, which is why the member check and the requester check come first.

**Support records (owner, 2026-11-26):** the support thread and the minimal log (date, UUID, outcome) are to be kept for 90 days after the case is closed, then deleted. This is subject to legal review and any documented legal hold, so it is not applied yet.

## B3 — password reset (interim): option A decided (owner, 2026-11-21)

The app has no recovery screen yet (KAN-42). A Supabase recovery email would open a link nothing in the app handles, so it is **not** an operational path. Three options:

| Option | How it works | Security | Effort | Trade-off |
|---|---|---|---|---|
| **A. Delete and re-register (recommended for the supervised beta)** | After verification, the B4 procedure deletes the account; the tester registers again with the same address | Uses only the verified deletion path; no password ever leaves the user | None beyond B4 | The tester loses their pantry and shopping data; disclosed in the tester instructions. Acceptable for a short, supervised beta with few items per tester |
| B. Owner-set temporary password | After verification, the owner sets a random temporary password with a small local admin script (service-role key read from Windows Credential Manager, never printed) and mails it to the registered address | A password travels by email, and the app has no change-password screen, so the tester keeps it | A new reviewed script, plus a hosted-change authorization per use | More moving parts and a credential in a mailbox |
| C. Deliver KAN-42 before the beta | Real in-app recovery | Best | Large; KAN-42's remaining gates (hosted read M2, implementation authorization) | Delays the beta |

**Decision: A** for the supervised beta (owner, 2026-11-21), with C before any broader beta (as the checklist already requires). **Rehearsal for A** is the B4 rehearsal plus one re-registration with the same address.

## What the testers are told (goes into the tester instructions and the privacy notice)

- "To delete your account, or if you can't sign in, email contact@mwsoftworks.com from your registered address. We reply within 3 days and confirm by replying to your registered address."
- With option A: "During the beta, a forgotten password is handled by deleting the account; you can then register again with the same address. Your beta pantry data is lost in that case."
