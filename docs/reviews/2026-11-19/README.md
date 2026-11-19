# Codex account-lifecycle reviews — 2026-11-19

The independent Codex reviews that the account-lifecycle specifications (`docs/planning/2026-11-19-*-spec.md`, `docs/planning/2026-11-19-account-lifecycle-overview.md`) respond to. The files are unmodified copies of the reports.

- `account-lifecycle-review.md`: the initial review at `33d45b0`, with findings H1–H5 and M1–M3, the threat model and the test matrix.
- `decision-record-followup-review.md`: the follow-up after PR #48 at `5f34a78`, with findings F1–F3. Where the two conflict, this one wins.
- `decision-record-reviewed.md`: Codex's frozen copy of the decision record it reviewed. It is identical to `docs/planning/2026-11-19-slice-3-decision-record.md` as merged.

The reports mention material "beside this report" (a source archive and Jira JSON snapshots). That material is deliberately not committed; the repository history and Jira hold the originals.
- `specs-v0.4-review.md`: the Codex review of baseline `f1028869` (v0.4) plus the `ab83b0f` delta. Verdict NO-GO, with findings N1–N8; version 0.5 of the specifications responds to it.
- `specs-v0.6-review.md`: the Codex review of v0.6 (`ef89b30..4c71e12`), with findings V6-1 to V6-5; version 0.7 responds to it. The intermediate review of v0.5 (V5-1 to V5-8) was delivered to the owner directly and is summarised in the overview.
- `specs-v0.7-review.md`: the Codex review of v0.7 (`4c71e12..1c0225e`), verdict "request changes", with findings V7-1 to V7-3; version 0.8 responds to it.
- Codex review of v0.8 (`916b28f`, delivered to the owner): V7-1 to V7-3 resolved in design; proceed to disposable feasibility verification, with implementation still blocked. One clarification (no stored session during `reauth_cleanup`) is added in v0.8.1. For FV-A9, demonstrated behaviour must be reported separately from any provider- or configuration-backed bound, and local results separately from hosted ones.
- `specs-v0.9-evidence-review.md`: the Codex evidence review of v0.9 and feasibility round 2 (`b86cc6c`), verdict "request changes", with findings V9-1 to V9-4 and the open-gate list; version 0.10 responds to it.
- Codex review of v0.10 (`0ecad1e`, delivered to the owner): V9-3 and V9-4 addressed. Three inconsistencies remained: maintenance blocked draining (High), contradictory ledger attribution with a resolver race (Medium), and an impossible missing-row interleaving (Medium). Version 0.11 corrects them. Round 3 is the next step; it should include paused draining, competing resolvers, both first-row orders, all prefixes and logged ordering.
- Codex review of v0.11 (`d706d49`, delivered to the owner): core corrections sound. Two consistency fixes, applied in v0.11.1: restore selection still used removed outcome names (High), and D20 kept a contradictory ledger expectation (Medium). Round 3 recommended afterwards, with a restore-selection check.
- Codex review of v0.11.1 (`072e60a`, delivered to the owner): both findings resolved in design, no new blocking finding. Technical clearance for local round 3 including V02c, with reproducible scripts, sanitized results, explicit expected outcomes and cleanup evidence. Not owner authorization; implementation and the hosted, phone, toolchain, retention and operational gates remain open.
