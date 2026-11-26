# Independent review of commit bfea852 (2026-11-26)

**Reviewer:** Claude Opus, a separate agent with read-only instructions, working in its own disposable clone. It ran the dry run, 20 adversarial scenarios of its own, and an `evaluate.cjs` input matrix, and it read the Auth v2.198.0 sources. It did not contact the hosted project, Jira or GitHub, and started no database stack.

**Verdict: approve with nits.** Nothing blocks. The PR is docs-only, nothing in it claims the rehearsal ran, the Auth-source claims are accurate, and the dry run reproduced byte for byte. Four medium findings weaken what a PASS would mean and should be fixed before the hosted rehearsal is authorized.

## Findings and what the follow-up commit did

| Finding | Summary | Follow-up |
|---|---|---|
| **M1** | Some damage outside T gave PASS: the control account's identities or sessions deleted; a third household's item changed; a third user's profile deleted. O's Auth records were not counted, and "rest" covered only four counts, without hashes | Fixed. O's identities and sessions are counted. "Rest" covers identities, profiles, households, memberships, pantry and shopping counts, plus hashes of the application rows. The five scenarios were added to the dry run and FAIL. The protocol's claim is narrowed to what is read |
| **M2** | The Auth checks could pass on empty data: nothing required identities or sessions before the deletion | Fixed. The precondition requires at least one identity for T and for O. The evaluator prints the before value of every target count. The protocol states the expected Auth rows on the app sign-up path. A dry-run scenario without identities STOPs |
| **M3** | The privacy draft and runbook step 4 did not mention support records, or flow states in the app's own database | Fixed. Both now name the support correspondence and sign-in records, and the review note lists support-record retention (OD-B4) |
| **M4** | Admin deletion writes an audit entry with the user's email; hosted's "not in the database" rests on one dashboard reading | Fixed. The read-back counts audit entries naming T (recorded, not judged). The retention boundaries and the request explain it |
| **L1** | Deleting O could not be evaluated with the tools | Fixed. The protocol describes a manual check of the read-back for O's cleanup |
| **L2** | Filling the control account's IDs with the target's gave READY | Fixed. Precondition `distinct_accounts`; the dry-run scenario STOPs |
| **L3** | False alarms from benign activity; timestamps in hashes depend on the session settings | Fixed. The read-back sets `TimeZone` and `DateStyle`. O's app stays closed between read-backs, and a FAIL outside T is checked against known activity before it is called an incident |
| **L4** | Overclaims: all class-2 records; a post rule that always passes; "they expire"; custom SMTP stated as fact | Fixed. The protocol lists the Auth tables that are and are not read; the always-passing post rule is removed; the retention wording is corrected |
| **L5** | The runbook correction stated removal as fact; real requests had no check before the confirmation | Fixed. Removal is qualified with its evidence, and step 3 adds a read-only check before confirming |
| Nits | Runbook "1a." did not render; checklist status date; evaluator exit codes undocumented; privacy draft replaced in place; fallback fixture path missing from the request | Fixed: nested list item; status line; header comment; dated correction with the old wording; request rows 1b and 2b |
| Pre-existing | Privacy draft line 11 says "magic links off" while FV-A1's table says Enabled; `RELEASE-ASSURANCE.md` SP-8 still describes the old step 4 | **Not changed.** FV-A1's owner follow-up of 2026-11-21 records that the owner disabled magic links and email OTP, so "off" is current. The assessment is a frozen historical record |

## Reviewer's checks, in short

- **Fixture graph:** meets the requirements.
- **Foreign keys:** every FK and delete action in 00001–00004 matches the documents, including the composite `SET NULL (pantry_item_id)` and the owner cascade for shared households.
- **Read-back:**
  - read-only, rejecting writes with 25006;
  - returns counts and MD5 values only;
  - two consecutive runs are identical;
  - a leftover placeholder fails with 22P02;
  - the Auth tables and columns exist at v2.198.0.
- **Evaluator:** fails closed on missing, duplicate or empty input.
- **Auth cleanup claims:** verified against `cleanup.go`, `middleware.go`, `api.go`, `configuration.go` and `admin.go`.
- **German text:** correct and consistent with the English.
- **Checklist:** only B4 changed; the counts and anchors are consistent.
- **Files:** nothing outside `docs/` changed. No secrets, paths or personal data.

## Could not verify

- the Supabase CLI's JSON output for this query;
- whether the hosted role can read every Auth table listed;
- whether hosted enables the Auth cleanup;
- whether the dashboard's **Delete user** is a hard delete;
- hosted audit storage and hosted Auth foreign-key parity;
- the real Supabase Auth schema on PostgreSQL 17. Only PGlite with the stub was tested.

## Delta re-review of ec48990

**Verdict: approve with nits.** Every finding above is fixed and works; none of the reviewer's 28 round-two scenarios gives a wrong PASS, READY or STOP, and nothing outside `docs/` changed. The four remaining wording points were fixed in the next commit:
1. **Protocol:** session MFA claims are created and cascade from the counted sessions. The earlier text wrongly said PantryFlow creates none.
2. **Retention class 4:** the audit-storage condition is stated the right way round (`DisablePostgres`).
3. **Protocol:** O is signed out before the first read-back or kept closed, and nobody signs it in or out in between; a sign-out between the read-backs would change O's session count.
4. **Protocol:** the coverage list now matches the read-back. **German privacy text:** "Aufzeichnungen über Anmeldungen" instead of "Anmeldedaten", which reads as login credentials.

**Accepted gaps:**
- the control account's refresh tokens are not counted, and the protocol does not claim they are;
- filling O's placeholders with another valid account cannot be detected;
- whether dashboard-created users get an identity row (request rows 1b and 2b) is unverified.

Also unverified: whether the CLI runs the whole read-back on one connection and returns its rows; and the hosted role's access to every Auth table, including `audit_log_entries`.
