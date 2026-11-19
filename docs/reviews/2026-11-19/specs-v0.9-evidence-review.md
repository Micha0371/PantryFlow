# Codex evidence review of the account-lifecycle specifications v0.9 and feasibility round 2 (b86cc6c)

*Recorded verbatim as delivered to the owner on 2026-11-19. Version 0.10 responds to it.*

**Verdict: request changes before implementation authorization.** The evidence supports substantial local feasibility, but I found one High, two Medium and one Low issue.

I reviewed immutable commit `b86cc6c`, the committed prototype, and the surviving local scripts/results without executing them. The committed SQL matches the experimental SQL apart from its added warning header. No hosted access or changes were made.

1. **V9-1 — High: known-error handling can publish an unproven `not_deleted` outcome.**

   [Deletion spec, line 370](https://github.com/Micha0371/PantryFlow/blob/b86cc6c2d92d0391e5b9952f4dcf873041a9d946/docs/planning/2026-11-19-account-deletion-spec.md#L370) instructs the function to FENCE after a known error, then send `not_deleted`, without conditioning that outcome on the fence result.

   A delayed old-generation call can return `STALE` while a newer deletion is running. Its fence can time out—or discover that the newer deletion committed. The old call’s rollback proves only that **its own transaction** did not delete anything.

   **Required:** handle `deleted`, terminal `not_deleted`, and `unknown` from FENCE consistently on both error paths. Preserve request-generation attribution in ledger outcomes. Add cases where a stale call encounters a newer deletion that commits or remains unresolved past the fence timeout.

2. **V9-2 — Medium: FENCE can lose the previous generation when the row initially does not exist.**

   [Prototype SQL, lines 83–87](https://github.com/Micha0371/PantryFlow/blob/b86cc6c2d92d0391e5b9952f4dcf873041a9d946/docs/testing/evidence/2026-11-19-fv2-deletion-protocol.sql#L83) first selects the previous ID, then upserts.

   If that SELECT finds no row, another transaction can create and admit a request before the upsert. FENCE then invalidates that request but returns `NULL`, losing the generation needed for ledger reconciliation.

   **Required:** serialize first-row creation and fencing, or otherwise return the generation actually replaced. Add a deterministic initially-missing-row test with issuance/admission between FENCE’s SELECT and upsert. Existing D20 cases do not establish this property.

3. **V9-3 — Medium: the unified error contract differs from the tested prototype.**

   [Spec, line 275](https://github.com/Micha0371/PantryFlow/blob/b86cc6c2d92d0391e5b9952f4dcf873041a9d946/docs/planning/2026-11-19-account-deletion-spec.md#L275) says every barrier rejection uses `PF_DELETION_PAUSED`. [Prototype line 58](https://github.com/Micha0371/PantryFlow/blob/b86cc6c2d92d0391e5b9952f4dcf873041a9d946/docs/testing/evidence/2026-11-19-fv2-deletion-protocol.sql#L58) raises `PF_DELETION_MAINTENANCE` for admission; D22 records that exact result.

   Also, the retained evidence does not demonstrate the `RATE_LIMITED` prefix, so D25’s “every prefix confirmed” claim is too broad.

   **Required:** reconcile the taxonomy and test every retained prefix through PostgREST. Separate database-error propagation from Edge-response mapping, which this prototype does not implement.

4. **V9-4 — Low: gateway cancellation timing is overstated.**

   [Evidence, lines 84–88](https://github.com/Micha0371/PantryFlow/blob/b86cc6c2d92d0391e5b9952f4dcf873041a9d946/docs/testing/2026-11-19-account-lifecycle-feasibility-round2.md#L84) says the gateway lock wait disappeared at 3.0 seconds and cancellation occurred within approximately 0.5 seconds.

   The retained gateway logs still show a waiting backend at the 3.0-second sample; later samples show it gone. The unchanged password and sessions support cancellation in these experiments, but not that precise timing.

   **Required:** report the observed interval accurately. Keep the existing limitation that neither these observations nor the configured deadline prove a universal maximum late-commit window.

**What the evidence does support**

| Area | Assessment |
|---|---|
| FV-B9/B10 | Local wrapper invocation, permissions, private-schema exclusion and sampled error propagation supported. |
| D17/D24 | Guard persistence, stale-generation refusal and alternative-path blocking supported for tested fixtures. |
| D20 | Useful deterministic blocking evidence; concurrent-consumption protection supported. D20.7 remains limited, as disclosed. |
| D21 | Demonstrates the injected G2 eligibility failure; does not independently exercise every G1–G4 race. |
| D22 | Supports local barrier blocking and pause/drain behavior; some cases use direct SQL transactions. |
| R18/R20 | Server facts supported. App marker, routing, restart and replacement-session recovery behavior remain untested. |
| FV-A9 | Local configuration and lock-wait cancellation supported, subject to the timing correction and stated limitations. |

**Open gates**

- **Further local verification:** resolve V9-1–V9-3 and test their failure cases. Strengthen D20.7 before claiming exhaustive ordering proof.
- **Hosted:** FV-A1, B1, B3, B8, B9 and B10 remain open. Local results do not establish hosted permissions, schema parity, time budgets or configuration.
- **Toolchain:** FV-A2’s complete project-suite compatibility with CLI 3.x, including fresh Android regression.
- **Phone:** FV-A3 and TalkBack/native lifecycle checks.
- **Edge/provider integration:** FV-B4 verified claims, B6 limiter behavior, B7 ledger idempotency and B8 timeout behavior through an actual function.
- **Operational/privacy:** retention decisions, surviving `auth.flow_state` handling, restore/crash rehearsal and external-request verification.
- **Implementation:** separately reviewed migration and app/Edge code, automated regression coverage, then explicit owner authorization.

OD-A11 acceptance is recorded in `4947060`; it need not be reopened. The next step is a targeted correction and verification increment, rather than another general architecture redesign.
