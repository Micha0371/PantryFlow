# Authorization request: populated-account deletion rehearsal on hosted (beta line B4)

**Status:** requested 2026-11-26, **not approved**. Nothing here has been run. Approval would cover exactly the actions below, once.

**Purpose:** run the [populated-account deletion protocol](2026-11-26-populated-deletion-rehearsal-protocol.md), so that B4 can be judged on a household with data. The [retention boundaries](2026-11-26-deletion-retention-boundaries.md) list what it does not settle.

## Target

Hosted project `PantryFlow_Emergent` (`oiqteedkfwmcertgxqga`), as in [hosted verification](../testing/hosted-verification.md).

## Actions requested

| # | Action | Kind | Who |
|---|---|---|---|
| 1 | Create two disposable accounts (T, O) on owner-controlled addresses, preferably by sign-up in the hosted-configured beta build (B10) | Hosted write: two accounts | Owner |
| 2 | Add the fixtures: in T, one pantry item, one linked, one manual and one completed shopping item; in O, one pantry and one shopping item | Hosted write: test rows only | Owner, in the app |
| 1b, 2b | **Alternative, only if chosen instead of 1 and 2:** owner creates T and O in the dashboard and inserts the fixture rows with a reviewed SQL script | Hosted write: two accounts and test rows | Owner. Unverified: whether dashboard-created users get an `auth.identities` row; without one the protocol STOPs before deleting |
| 3 | Run `readback.sql` read-only before and after, through the pinned CLI and the existing local login, as in SEC-02 | Hosted read: counts and hashes only | Agent or owner |
| 4 | Run the requester check by email, delete T in the dashboard, send the closing confirmation | Hosted write: one account deletion | Owner |
| 5 | Delete O the same way, with its own read-back | Hosted write: one account deletion | Owner |
| 6 | Optional: one day later, read T's `auth.flow_state` count once | Hosted read: one count | Agent or owner |

## Not covered

- Any change to hosted configuration, policies, migrations or other accounts.
- Repairing leftover rows after a FAIL; that needs a new request.
- Deleting T's flow-state rows (OD-B7).
- Inviting testers or distributing a build.

## Stop rules

- The protocol's STOP and FAIL rules apply.
- **Any change to O or to the rest of the project stops all hosted work.** After checking whether known activity explains it (for example an unplanned sign-up), it is reported to the owner as an incident, because there are no backups.

## Evidence

As in protocol section 5: counts, hashes, times and UUIDs of the disposable accounts. The read-back also counts audit entries naming T, to confirm that hosted keeps them out of the database (FV-A1). No addresses, passwords, tokens, item names or screenshots with personal data.

## Dependency

Actions 1 and 2 need the hosted-configured beta build (KAN-77, B10). Without it, actions 1b and 2b replace them. That skips the flow-state and session records, and the evidence must say so.
