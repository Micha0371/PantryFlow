# Supervised Android beta — entry checklist (BETA-01, KAN-106)

**Status: NO-GO.** Drafted 2026-11-21 from KAN-106 and the owner's decisions. Two lines are met (B1, B12); the rest are open. B6 needs a reassessment before it counts as met again, and B4 was reopened on 2026-11-26 ([reassessment](#reassessment-2026-11-26-b4)).

## What this is

**The gate:** the owner signs this checklist before inviting anyone to the **supervised, invited Android beta**. Each line points to its evidence, or carries an explicit owner waiver with a reason. Any line without either keeps the beta at NO-GO.

**Rules from the [Slice 3 decision record](../planning/2026-11-19-slice-3-decision-record.md)** (S3-Q7 and §7), which rank above the ticket text:
- **No waiver can cover a mandatory security, privacy or artifact-trust line** (marked "no" in the table).
- **English and German localization must be complete before the beta.** This replaces the ticket's "English only unless KAN-44 is done".
- **Interim reset and deletion paths must be secure, documented and genuinely operational.**
- **The beta does not wait for** Slice 3 acceptance, French, Italian or iOS.

**What signing does not do:** it does not authorize invitations, uploads or distribution; each needs separate owner authorization (KAN-106 exclusions, S3-Q7). The decision is recorded against KAN-79.

## Checklist

Status as of 2026-11-21; B5, B6, B7, B10 and the Jira statuses of the open lines were updated on 2026-11-24, B4 on 2026-11-26, and B7 and B10 on 2026-11-27. "Waivable" says whether an owner waiver may close the line.

| # | Line | Source | Waivable | Evidence required | Status | Next step |
|---|---|---|---|---|---|---|
| B1 | Hosted database baseline re-verified, read-only | KAN-106 line 1; SEC-02 (KAN-103) | No (security) | A dated SEC-02 record against the hosted project | **Met 2026-11-21:** [SEC-02 record](../testing/2026-11-21-sec02-hosted-drift-check.md): match against 00001–00004; documented exceptions only | Re-check at sign-off only if a migration lands before then |
| B2 | Crash and error reporting active and disclosed to testers | Line 2; OPS-01 (KAN-104); decision record §3 | Yes, with reason; disclosure is required if active | An OPS-01 record: the service configured with EU storage and scrubbing, and the disclosure text | **Open:** KAN-104 Backlog; the comparison note is not written | OPS-01 comparison note, then owner confirmation |
| B3 | Password reset: KAN-42 delivered, **or** an interim support path that is secure, documented and operational | Line 3; §7 | No (security) | Either KAN-42 accepted, or a runbook covering: support contact, stated response time, how the requester's ownership of the account is verified (for example a request from the registered address), the reset steps, and one rehearsed request | **Open:** interim path decided (option A, delete and re-register; [runbook](2026-11-21-interim-reset-deletion-runbook.md)); its deletion half rehearsed 2026-11-21, on an account without items (see the [B4 reassessment](#reassessment-2026-11-26-b4)); re-registration rehearsal waits for the hosted-configured beta build (B10) | Rehearse re-registration with the B10 build |
| B4 | Account deletion: KAN-43 delivered, **or** an interim support path that is secure, documented and operational | Line 3; §7 | No (privacy) | Either KAN-43 accepted, or a runbook covering: support contact, response time, ownership verification, the deletion steps on the hosted project, a confirmation to the requester, and one rehearsed request on a test account | **Open, reopened 2026-11-26 (owner).** Populated-data deletion **rehearsed on hosted 2026-11-26: PASS** ([record](2026-11-26-populated-deletion-rehearsal-record.md)); B4 waits for the owner to accept the remaining retention limits. It was recorded as Met on 2026-11-21: [runbook](2026-11-21-interim-reset-deletion-runbook.md) written; deletion rehearsed on the hosted project with a test account (all rows removed). That account held no pantry or shopping items, and the closing confirmation was not recorded | Populated deletion accepted (owner, 2026-11-26). Open: OD-B7 hosted flow-state cleanup confirmed, or observed with an app-created account (KAN-77); OD-B4 90 days after closure, after legal review; Supabase and Resend retention terms |
| B5 | Minimum privacy notice and support contact published | Line 4; KAN-72 (beta subset) | No (privacy) | Published URL or in-app text: what is collected, where it is stored, retention, deletion on request, the contact | **Open:** KAN-72 Backlog. Facts now known ([FV-A1](../testing/2026-11-21-hosted-auth-read-fv-a1.md)): EU storage (Frankfurt); no backups on the Free plan; Auth audit entries not stored in the database. The project's Site URL is still `http://localhost:3000` (no real page yet) | [Draft notice](2026-11-21-beta-privacy-notice-draft.md) (EN/DE) written; needs the remaining placeholder filled (web address; the person responsible, log retention and, on 2026-11-26, the email provider Resend, confirmed by the owner, are filled in), owner and legal review (including how the person responsible is named), and a publication channel; an Impressum for the Play Store presence and any web page, with the legal check confirming its content and place ([IHK Düsseldorf](https://www.ihk.de/duesseldorf/recht-und-steuern/recht/internetrecht/impressum-5109750) counts business presences on the Google Play Store); the trader declaration in the Play Console, which can make the address and phone number public; a real Site URL once the page exists |
| B6 | Advisory register current | Line 5; SEC-01 (KAN-102) | No (security) | [`docs/security/tooling-advisories.md`](../security/tooling-advisories.md) within its review window on the sign-off date | **Reassessment due** (was met as of 2026-11-18, KAN-102 Fertig): the register's trigger "any lockfile change" applied on 2026-11-22 and 2026-11-23 (`f082e67` added `expo-localization` and `rtl-detect`; `c8d0c5d` and `bc3b00b` changed the engines entry). No audit has been recorded since | Reassess and record it in the register; next scheduled review 2026-12-01; re-check at sign-off |
| B7 | English and German complete | §7, S3-Q7 (replaces line 6's "English only") | No: a decision-record gate, changed only by a new owner decision | KAN-44 accepted for Android (Amendment 3): KAN-60, 61 and 62, the completeness test, and native layout checks on Android; KAN-119 (catalogue encoding guard) | **Open:** KAN-60, KAN-61, KAN-62 and KAN-119 are Fertig; the completeness and encoding tests are on `main`, the language selection passed its Android phone check on 2026-11-23 (LANG-PHONE-01), and the Android layout, font-scaling and native-message checks passed on 2026-11-26 (KAN-62 section of the [coverage matrix](../testing/coverage-matrix.md); two layout defects fixed in PR #80; the back-arrow system label accepted by the owner as a language limitation on 2026-11-27). Open: KAN-44 is In Arbeit, not yet accepted. KAN-44 and KAN-62 also ask for iOS checks; for this line, Android evidence is enough ([Amendment 3](../planning/2026-11-19-slice-3-decision-record.md#amendment-3--2026-11-24-beta-line-b7-and-android-distribution)) | Owner acceptance of KAN-44 for Android |
| B8 | Testers know how to give feedback | Line 6; KAN-73 or the support contact | Yes | Feedback channel named in the tester instructions (B9) | **Open** | Name the channel in B9 |
| B9 | Tester instructions, eligibility, stop criteria and data handling written | Line 7 | No for data handling (privacy); yes for the rest | A tester pack document; proposals below | **Open** | Owner confirms the proposals; then write the pack |
| B10 | Android beta artifact prepared | Line 7; KAN-77 | Yes, with reason | A signed release-configured APK or test-track build, its version and SHA-256, plus a smoke test against the hosted project that includes signup confirmation (magic links and OTP are off since 2026-11-21) | **Open:** KAN-77 Backlog. The owner named a Play Store account and an upload key as needed and chose a personal account (2026-11-24, Amendment 3). The account exists; Google's identity verification is pending (2026-11-27). Step 1, the release configuration (version code, no backup of the saved session, unused permissions blocked, merged-manifest inspection), is in review (KAN-77 section of the [coverage matrix](../testing/coverage-matrix.md)) | Upload key, signed build and its inspection, then the hosted smoke test |
| B11 | Artifact trust: DIST-01 done, with the owner's distribution-trust decision | Line 8; KAN-116 | No (artifact trust) | DIST-01 record (the antivirus warning investigated) and the owner's decision on the distribution channel | **Open:** KAN-116 Backlog | KAN-116 |
| B12 | Externally deleted pantry records handled | Line 9; KAN-115 | Yes | Fixed in PR #43 (`90a70b9`), KAN-115 Fertig | **Met** | — |
| B13 | Owner additions: password policy, no hung requests, confirmation-callback test | Owner decision 2026-11-27 ([Amendment 4](../planning/2026-11-19-slice-3-decision-record.md#amendment-4--2026-11-27-beta-line-b13)) | No: a decision-record gate, changed only by a new owner decision | **KAN-80** for the beta scope: the policy approved (KAN-81), enforced by hosted Auth and the sign-up screen with EN/DE messages (KAN-82), and a weak password rejected when the app is bypassed, locally and on hosted (KAN-83); the reset and update screens follow with KAN-42. **KAN-127**: reads and writes end after a timeout with a message; a write with an unknown outcome is not shown as failed or lost and is re-read, and no retry adds a duplicate silently; checked on the phone. **KAN-124**: a getSession() error in the confirmation callback rejects without exchanging the code, pinned by a test that a mutant fails | **Open:** KAN-80, KAN-127 and KAN-124 Backlog | KAN-80 before KAN-77 step 5 and the B3 re-registration rehearsal, so the hosted smoke test runs under the final password policy |

## Reassessment 2026-11-26: B4

**Decision:** the owner reopened B4 on 2026-11-26, following the [independent review](RELEASE-ASSURANCE-INDEPENDENT-REVIEW-25499a6.md) (F06) and [remediation plan](BETA-REMEDIATION-PLAN-25499a6.md) Priority 2.

**Historical result:** the 2026-11-21 rehearsal stands as recorded. It shows that an account without items is removed (account, profile, household, membership). It does not show that a household with pantry and shopping data is removed, and the closing confirmation to the requester is not recorded.

**Until B4 can count as met again:**
- populated-data deletion is **PENDING** until an authorized [rehearsal](2026-11-26-populated-deletion-rehearsal-protocol.md) passes (passed 2026-11-26, see the update below);
- the owner then accepts the [retention limits](2026-11-26-deletion-retention-boundaries.md) that remain: `auth.flow_state` rows, provider logs, email-provider records, support records.

**Update 2026-11-26:** the authorized rehearsal ran the same day and **passed** ([record](2026-11-26-populated-deletion-rehearsal-record.md)). Populated-data deletion is therefore shown for the dashboard-and-SQL fixture path. Sessions, refresh tokens and flow states were not exercised, because the test accounts were created in the dashboard. B4 stays open until the owner accepts the remaining retention limits.

**Owner decisions 2026-11-26:**
- **Rehearsal:** PASS accepted for its tested scope: a populated, single-member household created in the dashboard. It does not show the removal of sessions or flow states, which the test accounts did not have. No repeat is needed.
- **OD-B7, Auth flow states:** no additional privileged deletion. Unknown, possibly indefinite retention is **not accepted** as the final disposition. It needs confirmation of the hosted cleanup behaviour, or a separately authorized observation with an account created in the app, as part of the planned hosted sign-up work (KAN-77).
- **OD-B4, support correspondence:** recommended retention is **90 days after case closure** for the support thread and the minimal log (UUID, date, outcome), followed by deletion. This is **subject to legal review** and to any documented legal hold.
- **Supabase provider logs:** the distinction from application records is accepted. The provider's retention terms are verified before the privacy notice is published.
- **Resend delivery records:** retention and processing details are unverified. The applicable terms are obtained and reflected in B5.

**B4 therefore stays OPEN.** Its populated-application-data deletion subclaim is accepted; OD-B7, OD-B4's legal review and the provider terms remain.

**No other line changes:**
- B3 still waits for its re-registration rehearsal;
- B5 still needs its placeholders, review and publication.

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
  - not to store sensitive personal information in item names;
  - that the beta runs on a free hosting plan without backups (data can be lost) and may pause after inactivity (owner decision 2026-11-21).
- **Stop criteria:** pause the beta and stop new invitations on any of:
  - data loss;
  - data visible across households;
  - a security finding;
  - repeated crashes in the same place;
  - a reset or deletion request not handled within the stated response time.
- **Data handling** (facts from the [FV-A1 read](../testing/2026-11-21-hosted-auth-read-fv-a1.md): EU storage in Frankfurt, Free plan without backups):
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
