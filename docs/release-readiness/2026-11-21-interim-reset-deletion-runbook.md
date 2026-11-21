# Interim password-reset and account-deletion support (beta lines B3, B4)

**Status:** draft for owner decision, 2026-11-21. These are the interim support paths the [beta entry checklist](2026-11-21-beta-entry-checklist.md) allows until KAN-42 (password recovery) and KAN-43 (account deletion) are delivered. The decision record requires them to be **secure, documented and genuinely operational**; each needs one rehearsed request before the beta.

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
2. In the Supabase dashboard of the hosted project: Authentication → Users → find the user by the registered email → **Delete user**.
3. The database's foreign-key cascades remove the user's profile, household membership, owned household and its pantry and shopping items. Today's beta has no shared households, so no other user's data is affected.
4. Confirm the deletion to the registered address, and state that backups keep data until they expire under the plan's backup retention (exact period from the pending hosted read, FV-A1).
5. Record the date and the user UUID only (no email, no names) in the owner's support log.

**Rehearsal (required before the beta):** create a disposable test account on the hosted project, run steps 1–5 against it, and check that its rows are gone. **This is a hosted change and needs separate owner authorization.**

## B3 — password reset (interim): owner decision needed

The app has no recovery screen yet (KAN-42). A Supabase recovery email would open a link nothing in the app handles, so it is **not** an operational path. Three options:

| Option | How it works | Security | Effort | Trade-off |
|---|---|---|---|---|
| **A. Delete and re-register (recommended for the supervised beta)** | After verification, the B4 procedure deletes the account; the tester registers again with the same address | Uses only the verified deletion path; no password ever leaves the user | None beyond B4 | The tester loses their pantry and shopping data; disclosed in the tester instructions. Acceptable for a short, supervised beta with few items per tester |
| B. Owner-set temporary password | After verification, the owner sets a random temporary password with a small local admin script (service-role key read from Windows Credential Manager, never printed) and mails it to the registered address | A password travels by email, and the app has no change-password screen, so the tester keeps it | A new reviewed script, plus a hosted-change authorization per use | More moving parts and a credential in a mailbox |
| C. Deliver KAN-42 before the beta | Real in-app recovery | Best | Large; KAN-42's remaining gates (hosted read M2, implementation authorization) | Delays the beta |

**Recommendation: A** for the supervised beta, with C before any broader beta (as the checklist already requires). **Rehearsal for A** is the B4 rehearsal plus one re-registration with the same address.

## What the testers are told (goes into the tester instructions and the privacy notice)

- "To delete your account, or if you can't sign in, email contact@mwsoftworks.com from your registered address. We reply within 3 days and confirm by replying to your registered address."
- With option A: "During the beta, a forgotten password is handled by deleting the account; you can then register again with the same address. Your beta pantry data is lost in that case."
