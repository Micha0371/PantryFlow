# Slice 3 Jira backlog — created and verified

Owner approved the dry-run report on 2026-11-17 by replying “approved”. Creation completed 2026-11-17T00:17:52.293189+00:00.

[KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40) — **PantryFlow — Slice 3: Production Hardening and Launch Readiness**

**40 issues: 1 Epic, 10 Tasks and 29 Subtasks.** Parent, type, full description, labels and every supported priority were read back after creation and again in independent final verification. Parent Tasks and the Epic were additionally previewed/updated/read back to include the completed Jira dependency/reference index.

This operation did not change, move, close or duplicate any pre-existing Jira issue. No application code, hosted data/schema, DNS, SMTP, infrastructure or distribution was changed. No Slice 3 implementation started.

## Verified hierarchy

### [KAN-41](https://michaelwuerthner.atlassian.net/browse/KAN-41) — [Slice 3] Approve scope, baseline and carried-finding dispositions

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Blocks Slice 3 implementation; planning/discovery may proceed.
Dependencies: KAN-6/KAN-23 evidence; owner final Slice 2 acceptance.

- [KAN-51](https://michaelwuerthner.atlassian.net/browse/KAN-51) — Reconcile Slice 3 scope and obtain product decisions (parent KAN-41).
- [KAN-52](https://michaelwuerthner.atlassian.net/browse/KAN-52) — Assemble the Slice 2 baseline acceptance record using existing closure issues (parent KAN-41).
- [KAN-53](https://michaelwuerthner.atlassian.net/browse/KAN-53) — Reassess existing functional and tooling findings for release impact (parent KAN-41).
### [KAN-42](https://michaelwuerthner.atlassian.net/browse/KAN-42) — [Slice 3] Implement and qualify password recovery

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Mandatory public-release authentication gate; platform-specific link evidence.
Dependencies: T1 approved readiness; T4 translation contract; T7 for iOS release qualification.

- [KAN-54](https://michaelwuerthner.atlassian.net/browse/KAN-54) — Define recovery routing and implement request/update-password operations (parent KAN-42).
- [KAN-55](https://michaelwuerthner.atlassian.net/browse/KAN-55) — Build the password-reset screens and interruption recovery (parent KAN-42).
- [KAN-56](https://michaelwuerthner.atlassian.net/browse/KAN-56) — Verify real recovery delivery, deep links and authentication regressions (parent KAN-42).
### [KAN-43](https://michaelwuerthner.atlassian.net/browse/KAN-43) — [Slice 3] Define and implement secure account deletion and retention

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Mandatory public-release data lifecycle gate; policy/design approval blocks implementation.
Dependencies: T1 scope; approved deletion/retention/security-boundary decision before implementation; T6 review; T8 external request content.

- [KAN-57](https://michaelwuerthner.atlassian.net/browse/KAN-57) — Approve the deletion, retention and privileged-boundary design (parent KAN-43).
- [KAN-58](https://michaelwuerthner.atlassian.net/browse/KAN-58) — Implement authenticated deletion and in-app confirmation (parent KAN-43).
- [KAN-59](https://michaelwuerthner.atlassian.net/browse/KAN-59) — Verify deletion isolation, retention disclosures and external requests (parent KAN-43).
### [KAN-44](https://michaelwuerthner.atlassian.net/browse/KAN-44) — [Slice 3] Complete English/German launch content and language preferences

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Mandatory EN/DE public-release gate; filters/extra languages are not automatically included.
Dependencies: T1 localization/first-launch/profile-precedence decision; T2/T3 new-string inventory.

- [KAN-60](https://michaelwuerthner.atlassian.net/browse/KAN-60) — Complete and review the English/German translation catalogue (parent KAN-44).
- [KAN-61](https://michaelwuerthner.atlassian.net/browse/KAN-61) — Implement language selection and approved preference persistence (parent KAN-44).
- [KAN-62](https://michaelwuerthner.atlassian.net/browse/KAN-62) — Validate bilingual layout, font scaling and native messages (parent KAN-44).
### [KAN-45](https://michaelwuerthner.atlassian.net/browse/KAN-45) — [Slice 3] Qualify native accessibility using the existing remediation tickets

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Public-release accessibility gate; separate Android TalkBack and iOS VoiceOver gates.
Dependencies: T1 existing-finding reconciliation; KAN-34 and KAN-39 remediation/read-back; T4 translations; T7 iOS.

- [KAN-63](https://michaelwuerthner.atlassian.net/browse/KAN-63) — Audit accessibility contracts and reconcile existing error fixes (parent KAN-45).
- [KAN-64](https://michaelwuerthner.atlassian.net/browse/KAN-64) — Record physical TalkBack and VoiceOver acceptance (parent KAN-45).
### [KAN-46](https://michaelwuerthner.atlassian.net/browse/KAN-46) — [Slice 3] Qualify security, migrations and operational recovery

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Mandatory public-release security/data/operations gate; hosted execution separately authorized.
Dependencies: T1 readiness; T3 approved lifecycle; KAN-27 tooling issue reused; T10 deployment/environment decision.

- [KAN-65](https://michaelwuerthner.atlassian.net/browse/KAN-65) — Review and test authorization, lifecycle and unused premium exposure (parent KAN-46).
- [KAN-66](https://michaelwuerthner.atlassian.net/browse/KAN-66) — Reassess dependencies, logging and sender operational risks (parent KAN-46).
- [KAN-67](https://michaelwuerthner.atlassian.net/browse/KAN-67) — Rehearse populated migrations and backup/recovery procedures (parent KAN-46).
### [KAN-47](https://michaelwuerthner.atlassian.net/browse/KAN-47) — [Slice 3] Prepare and validate iOS builds and TestFlight readiness

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Blocks iOS release only; Android may be assessed independently.
Dependencies: T1 platform/budget decision; Apple membership/signing/build access and iPhone availability; T2/T3/T4/T5 feature contracts.

- [KAN-68](https://michaelwuerthner.atlassian.net/browse/KAN-68) — Resolve iOS prerequisites and produce an isolated native test build (parent KAN-47).
- [KAN-69](https://michaelwuerthner.atlassian.net/browse/KAN-69) — Extend native regression coverage and validate iPhone behavior (parent KAN-47).
- [KAN-70](https://michaelwuerthner.atlassian.net/browse/KAN-70) — Prepare TestFlight and iOS beta-validation requirements (parent KAN-47).
### [KAN-48](https://michaelwuerthner.atlassian.net/browse/KAN-48) — [Slice 3] Decide and prepare HouseholdKit website and privacy-safe feedback

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **Medium**. Classification: Independent proposed website/feedback stream; required public information gates public release.
Dependencies: T1 scope approval; separate owner confirmation of stack/repository/feedback; T3 deletion policy; T6 data/privacy inventory.

- [KAN-71](https://michaelwuerthner.atlassian.net/browse/KAN-71) — Approve website architecture, repository and feedback scope (parent KAN-48).
- [KAN-72](https://michaelwuerthner.atlassian.net/browse/KAN-72) — Prepare approved public content and account-deletion request path (parent KAN-48).
- [KAN-73](https://michaelwuerthner.atlassian.net/browse/KAN-73) — Implement approved Settings feedback with diagnostic consent (parent KAN-48).
### [KAN-49](https://michaelwuerthner.atlassian.net/browse/KAN-49) — [Slice 3] Extend regression coverage and record Slice 3 GO/NO-GO

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Mandatory Slice 3 acceptance gate; not public-release authorization.
Dependencies: T1 and all approved mandatory feature/review tasks; existing carried release blockers dispositioned; T7 for iOS GO.

- [KAN-74](https://michaelwuerthner.atlassian.net/browse/KAN-74) — Extend the living behavioral matrix and isolated fixture coverage (parent KAN-49).
- [KAN-75](https://michaelwuerthner.atlassian.net/browse/KAN-75) — Run exact-head Android regression and physical-device qualification (parent KAN-49).
- [KAN-76](https://michaelwuerthner.atlassian.net/browse/KAN-76) — Record final Slice 3 acceptance and platform-specific limitations (parent KAN-49).
### [KAN-50](https://michaelwuerthner.atlassian.net/browse/KAN-50) — [Slice 3] Prepare platform beta distribution and enforce the public-release gate

Parent: [KAN-40](https://michaelwuerthner.atlassian.net/browse/KAN-40). Priority: **High**. Classification: Mandatory general public-release gate; Android and iOS decisions separate.
Dependencies: T9 Slice 3 GO; T2/T3/T4/T5/T6 public gates; T8 required public content; T7 before iOS beta/release.

- [KAN-77](https://michaelwuerthner.atlassian.net/browse/KAN-77) — Prepare Android beta artifact and distribution prerequisites (parent KAN-50).
- [KAN-78](https://michaelwuerthner.atlassian.net/browse/KAN-78) — Verify public privacy, support, deletion and operational readiness (parent KAN-50).
- [KAN-79](https://michaelwuerthner.atlassian.net/browse/KAN-79) — Obtain separate Android, iOS and public-release decisions (parent KAN-50).

## Recommended execution order

1. [KAN-41](https://michaelwuerthner.atlassian.net/browse/KAN-41): approve scope/readiness and final Slice 2 acceptance using KAN-6/KAN-23 evidence; reconcile in-progress KAN-34 integration. Current planning reference is main 2186d50, not a newly approved/tagged Slice 2 baseline.
2. [KAN-42](https://michaelwuerthner.atlassian.net/browse/KAN-42), [KAN-43](https://michaelwuerthner.atlassian.net/browse/KAN-43), [KAN-44](https://michaelwuerthner.atlassian.net/browse/KAN-44), [KAN-46](https://michaelwuerthner.atlassian.net/browse/KAN-46): recoverable authentication, approved deletion/retention, EN/DE and security/operations; contract-compatible activities can proceed in parallel after readiness approval.
3. [KAN-45](https://michaelwuerthner.atlassian.net/browse/KAN-45): verify accessibility through reused KAN-34/KAN-39 and actual native evidence. Existing KAN-27/32/36/37/38 remain their own remediation tickets.
4. [KAN-47](https://michaelwuerthner.atlassian.net/browse/KAN-47): resolve Apple/build/iPhone prerequisites early; iOS acceptance follows integrated feature builds. Android results never close the iOS gate.
5. [KAN-48](https://michaelwuerthner.atlassian.net/browse/KAN-48): approve website/feedback architecture and scope first. Proposed Astro/TypeScript/Cloudflare Pages, separate repo and detailed Settings feedback behavior are not implicitly approved for implementation.
6. [KAN-49](https://michaelwuerthner.atlassian.net/browse/KAN-49): exact-head full regression/physical validation and final Slice 3 GO/NO-GO.
7. [KAN-50](https://michaelwuerthner.atlassian.net/browse/KAN-50): independent Android, iOS and general-public/beta release decisions with explicit owner distribution authorization.

## Gates and remaining decisions

- Mandatory public gates: password recovery, secure account/data lifecycle, EN/DE content, accessibility, authorization/privacy/security, populated migration/recovery qualification and required public information/support/deletion mechanism.
- Android: fresh correctly configured build, full regression/physical/TalkBack evidence and distribution prerequisites.
- iOS: signing/build/Apple-account/iPhone access, real native warm/cold auth and app workflows, VoiceOver and TestFlight prerequisites. It can remain NO-GO independently of Android.
- Owner decisions remain: deletion/backup retention and privileged boundary; first-launch/profile/device language precedence; filters/profile-name scope; beta platform/audience/cost; website stack/repository/feedback channel; operational recovery targets.
- Reused, not copied/reparented: KAN-6, KAN-23/24/25/26, KAN-27/32/34/36/37/38/39. KAN-33/35 remain completed regression references; KAN-5 is unrelated tooling debt.
- Excluded without separate approval: premium/payments/gating, sharing/invitations, quantities/expiry/reminders, barcode/recipes/advanced analytics, other suite apps, custom backend/framework/rewrite. Quick-add/bulk/undo/export/extra languages remain proposals.
- Slice 3 acceptance is not publication approval. No tester invitations, uploads, deployments, purchases or hosted/infrastructure changes were performed.

## Execution and safety evidence

- Operation ID: `PF-S3-BACKLOG-20261117`. Approved draft SHA-256: `67d7ea6a851f2a07da74db879fecfa379bcc75f078840e57d2c799174333c3c4`.
- Only the existing secured CLI was used. Every mutation had an inspected preview followed by exact `--apply`, one sequential writer and a durable pre-mutation attempt record.
- Jira omits empty paragraph content arrays on read-back. The first Epic read-back stopped on this formatting-only difference. The existing KAN-40 was inspected/reconciled without another create; semantic content verification then passed. No failed/ambiguous write was retried.
- A KAN-57 read-back interruption was resolved by inspecting the already-created key and repeating only the read. T5-S1 and T6-S3 invocations failed during read-only connection/metadata preflight: the CLI source distinguishes this exact network Failure from post-mutation write_outcome_unknown. The operator checked the full paginated Jira inventory and confirmed no matching issue before explicitly starting fresh preview/apply operations. These reconciliations are recorded in the operation journal; no ambiguous mutation was retried.
- During execution, another actor renamed KAN-40 to `[Slice 3] Production Hardening and Launch Readiness`. The operation stopped its update, read back the Epic, verified all other selected fields/content were unchanged and preserved the external title. The rename is recorded as an observed external change; it was not overwritten.
- Creation order: Epic, all Tasks, then Subtasks. Native parents use metadata-confirmed Epic 10006 / Task 10008 / Subtask 10007. High priority ID 2 / Medium ID 3 were verified where supported. Subtask priority was not sent because its creation screen does not expose it; actual defaults remain Jira-owned.
- Dependencies are explicit descriptions/reference indexes, **not native Jira issue links**: the approved CLI does not support native dependency-link mutations. This limitation was disclosed in the approved dry run.
- Final paginated Jira search found exactly the 40 expected PF-S3-labelled keys, without extra matches. Each of all 40 issues was independently read back and compared to its materialized payload.
- Ignored local evidence: `pantry-flow/.verification/slice3/execution.json`, per-item preview/attempt/payload/read-back files, metadata and final paginated search. Credentials were never exported.

Frozen approved planning inputs: [dry-run report](2026-11-17-slice-3-backlog-dry-run.md) and [draft definitions](slice-3-backlog-drafts.json). Their pre-creation status text is historical; this execution record records the approved outcome.

## Additional approved password-policy work — 2026-11-17

The owner subsequently requested stronger password rules and explicitly approved a High-priority public-release ticket. This is a separate addition to the frozen initial 40-issue import.

[KAN-80](https://michaelwuerthner.atlassian.net/browse/KAN-80) — **[Slice 3] Define and enforce stronger password rules**. Parent KAN-40; native High priority (ID 2).

- [KAN-81](https://michaelwuerthner.atlassian.net/browse/KAN-81) — Approve password policy and existing-account rollout.
- [KAN-82](https://michaelwuerthner.atlassian.net/browse/KAN-82) — Enforce the approved password policy in Auth and signup/reset UX.
- [KAN-83](https://michaelwuerthner.atlassian.net/browse/KAN-83) — Verify password-policy bypass protection and auth regressions.

All four were previewed, created and independently read back through the secured CLI. Operation ID: `PF-AUTH-PASSWORD-POLICY-20261117`. Dependencies reference KAN-41/42/44/46/49/50 in descriptions; no native dependency links or edits to those existing tickets were made. Exact rules and existing-account rollout remain owner decisions before implementation. No password/configuration/Auth setting was changed.

Combined Slice 3 backlog after this addition: **44 issues — 1 Epic, 11 Tasks, 32 Subtasks**. The original approved planning JSON and dry-run remain historical inputs for the initial 40 items.
