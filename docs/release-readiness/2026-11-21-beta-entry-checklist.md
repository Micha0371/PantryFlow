# Supervised Android beta — entry checklist (BETA-01, KAN-106)

**Status: NO-GO.** Drafted 2026-11-21 from KAN-106 and the owner's decisions. Three lines are met (B1, B6, B12); the rest are open.

## What this is

**The gate:** the owner signs this checklist before inviting anyone to the **supervised, invited Android beta**. Each line points to its evidence, or carries an explicit owner waiver with a reason. Any line without either keeps the beta at NO-GO.

**Rules from the [Slice 3 decision record](../planning/2026-11-19-slice-3-decision-record.md)** (S3-Q7 and §7), which rank above the ticket text:
- **No waiver can cover a mandatory security, privacy or artifact-trust line** (marked "no" in the table).
- **English and German localization must be complete before the beta.** This replaces the ticket's "English only unless KAN-44 is done".
- **Interim reset and deletion paths must be secure, documented and genuinely operational.**
- **The beta does not wait for** Slice 3 acceptance, French, Italian or iOS.

**What signing does not do:** it does not authorize invitations, uploads or distribution; each needs separate owner authorization (KAN-106 exclusions, S3-Q7). The decision is recorded against KAN-79.

## Checklist

Status as of 2026-11-21. "Waivable" says whether an owner waiver may close the line.

| # | Line | Source | Waivable | Evidence required | Status | Next step |
|---|---|---|---|---|---|---|
| B1 | Hosted database baseline re-verified, read-only | KAN-106 line 1; SEC-02 (KAN-103) | No (security) | A dated SEC-02 record against the hosted project | **Met 2026-11-21:** [SEC-02 record](../testing/2026-11-21-sec02-hosted-drift-check.md): match against 00001–00004; documented exceptions only | Re-check at sign-off only if a migration lands before then |
| B2 | Crash and error reporting active and disclosed to testers | Line 2; OPS-01 (KAN-104); decision record §3 | Yes, with reason; disclosure is required if active | An OPS-01 record: the service configured with EU storage and scrubbing, and the disclosure text | **Open:** KAN-104 Backlog; the comparison note is not written | OPS-01 comparison note, then owner confirmation |
| B3 | Password reset: KAN-42 delivered, **or** an interim support path that is secure, documented and operational | Line 3; §7 | No (security) | Either KAN-42 accepted, or a runbook covering: support contact, stated response time, how the requester's ownership of the account is verified (for example a request from the registered address), the reset steps, and one rehearsed request | **Open:** KAN-42 not delivered; no interim runbook | Write and rehearse the interim reset runbook |
| B4 | Account deletion: KAN-43 delivered, **or** an interim support path that is secure, documented and operational | Line 3; §7 | No (privacy) | Either KAN-43 accepted, or a runbook covering: support contact, response time, ownership verification, the deletion steps on the hosted project, a confirmation to the requester, and one rehearsed request on a test account | **Open:** KAN-43 not delivered (design reviewed; implementation not authorized); no interim runbook | Write and rehearse the interim deletion runbook |
| B5 | Minimum privacy notice and support contact published | Line 4; KAN-72 (beta subset) | No (privacy) | Published URL or in-app text: what is collected, where it is stored, retention, deletion on request, the contact | **Open:** KAN-72 Backlog | Prepare the beta subset of KAN-72 |
| B6 | Advisory register current | Line 5; SEC-01 (KAN-102) | No (security) | [`docs/security/tooling-advisories.md`](../security/tooling-advisories.md) within its review window on the sign-off date | **Met as of 2026-11-18** (KAN-102 Fertig); next review due 2026-12-01 | Re-check at sign-off if past 2026-12-01 |
| B7 | English and German complete | §7, S3-Q7 (replaces line 6's "English only") | No: a decision-record gate, changed only by a new owner decision | KAN-44 accepted: KAN-60, 61 and 62, the completeness test, and native layout checks; KAN-119 (catalogue encoding guard) | **Open:** all Backlog | KAN-119, then KAN-60, 61, 62 |
| B8 | Testers know how to give feedback | Line 6; KAN-73 or the support contact | Yes | Feedback channel named in the tester instructions (B9) | **Open** | Name the channel in B9 |
| B9 | Tester instructions, eligibility, stop criteria and data handling written | Line 7 | No for data handling (privacy); yes for the rest | A tester pack document; proposals below | **Open** | Owner confirms the proposals; then write the pack |
| B10 | Android beta artifact prepared | Line 7; KAN-77 | Yes, with reason | A signed release-configured APK or test-track build, its version and SHA-256 | **Open:** KAN-77 Backlog | KAN-77 |
| B11 | Artifact trust: DIST-01 done, with the owner's distribution-trust decision | Line 8; KAN-116 | No (artifact trust) | DIST-01 record (the antivirus warning investigated) and the owner's decision on the distribution channel | **Open:** KAN-116 Backlog | KAN-116 |
| B12 | Externally deleted pantry records handled | Line 9; KAN-115 | Yes | Fixed in PR #43 (`90a70b9`), KAN-115 Fertig | **Met** | — |

## Proposals for B9 (owner to confirm or change at sign-off)

These are drafted defaults, not decisions.

- **Eligibility:**
  - adults invited personally by the owner, with an Android phone;
  - a small group, with the number set by the owner;
  - each tester agrees to the instructions and the privacy notice (B5) before installing.
- **Instructions:**
  - how to install the beta build (B10) and what the antivirus warning means (B11);
  - the language scope (English and German);
  - what to try;
  - how to report problems and feedback (B8);
  - not to store sensitive personal information in item names.
- **Stop criteria:** pause the beta and stop new invitations on any of:
  - data loss;
  - data visible across households;
  - a security finding;
  - repeated crashes in the same place;
  - a reset or deletion request not handled within the stated response time.
- **Data handling** (verify the facts first: the hosted project's region and plan are part of the pending hosted read, FV-A1):
  - **stored:** account email, display name, household, pantry and shopping items;
  - **access:** the owner only;
  - **removal:** on request through B4, and, if the beta ends without a product launch, deletion of tester accounts at the end;
  - **logs:** crash reports per B2, with scrubbing.

## Broader, unassisted beta (not covered here)

A broader beta needs, in addition (KAN-106 refinement):
- KAN-42 and KAN-43 delivered, not only the interim paths;
- KAN-72 published;
- OPS-01 monitoring reviewed after the supervised phase;
- the UX-08B findings triaged.

## Sign-off

| Field | Value |
|---|---|
| Decision | GO / NO-GO |
| Date and commit | |
| Waivers (line, reason) | |
| Signed by | Owner |

Invitations then still need the owner's separate authorization.
