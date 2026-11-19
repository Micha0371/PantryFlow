# Codex review of the account-lifecycle specifications v0.6 (ef89b30..4c71e12)

*Recorded verbatim as delivered to the owner on 2026-11-19. Version 0.7 responds to it. The earlier review of v0.5 (`4d9bd9a..ef89b30`, findings V5-1 to V5-8) was delivered to the owner directly and is summarised in the overview's version notes.*

**Verdict: NO-GO for implementation, with a substantially smaller correction set.** The request-bound deletion transaction is a sound improvement. I found **three High and two Medium findings** remaining.

Reviewed only **`ef89b30..4c71e123435369ea8d8975d75a18843aa4924931`**, including Amendment 1. No experiments, hosted access or changes were performed.

## Findings

### V6-1 — High: `session_not_found` does not prove global logout

**Evidence:** password spec [line 285](https://github.com/Micha0371/PantryFlow/blob/4c71e123435369ea8d8975d75a18843aa4924931/docs/planning/2026-11-19-password-recovery-session-spec.md#L285); decision record [line 194](https://github.com/Micha0371/PantryFlow/blob/4c71e123435369ea8d8975d75a18843aa4924931/docs/planning/2026-11-19-slice-3-decision-record.md#L194).

`session_not_found` proves that **the presented session** no longer exists. Other sessions may still exist.

For example, revoke session A locally while B remains active. A’s subsequent global-logout request is rejected during authentication; the global logout handler never runs. Accepting that response as completion violates Amendment A1’s all-device requirement. The versioned [authentication middleware](https://raw.githubusercontent.com/supabase/auth/v2.198.0/internal/api/auth.go) and [logout handler](https://raw.githubusercontent.com/supabase/auth/v2.198.0/internal/api/logout.go) establish this distinction.

Likewise, `refresh_token_not_found` is not proof that every session ended.

**Required correction:** distinguish current-session absence from successful account-wide revocation. A missing current session must leave global revocation unresolved unless independent evidence establishes it. Define the approved recovery/re-authentication path for that case.

**Oracle:** create A and B, revoke only A, then attempt global logout using A. B must not be reported revoked while it still refreshes.

This does **not** invalidate `session_not_found` as evidence for deleting the isolated **local** temporary session.

### V6-2 — High: the restart marker is written after the mutation’s crash boundary

**Evidence:** password spec [lines 284–285](https://github.com/Micha0371/PantryFlow/blob/4c71e123435369ea8d8975d75a18843aa4924931/docs/planning/2026-11-19-password-recovery-session-spec.md#L284); R19 tests only after marker creation.

The marker is written upon entering FinalSignOut, after receiving a response or detecting uncertainty.

A kill **after sending the update but before processing its result** leaves no marker:

- Recovery restarts in RecoveryPending rather than FinalSignOut.
- An in-app change can restart into normal authenticated navigation, despite an unresolved update.

**Required correction:** persist a user/session-bound pending-operation marker **before dispatch**. Define how confirmed rejection, confirmed success and restart convert or clear it. Also define cleanup recovery when the session has been removed but marker removal was interrupted.

**Oracle:** kill immediately after dispatch, before either response handling or timeout handling, in both flows. Restart must recover the unresolved operation without exposing tabs or silently permitting another update.

### V6-3 — High: the fence cutoff is neither monotonic nor reliably ordered against authentication

**Evidence:** deletion spec [lines 265–280](https://github.com/Micha0371/PantryFlow/blob/4c71e123435369ea8d8975d75a18843aa4924931/docs/planning/2026-11-19-account-deletion-spec.md#L265), with admission at lines 289–298.

There are two problems:

1. `now()` is the **transaction-start timestamp**. Fence transactions completing out of start-time order can overwrite a newer `fenced_at` with an older value. A previously rejected authentication timestamp can then become admissible again. PostgreSQL documents this timestamp behavior explicitly. [Date/time functions](https://www.postgresql.org/docs/17/functions-datetime.html).
2. The spec acknowledges that positive Auth/database clock skew can admit an invocation authenticated before the fence, but applies a margin only when skew is deemed non-negligible. A one-time measurement does not establish a lasting safety bound.

**Required correction:** make fence cutoffs monotonic and define their effective ordering point. Specify conservative cross-clock handling with a defensible bound and fail-closed behavior, or use a logical post-fence proof. “Negligible skew” must not permit the very delayed-admission counterexample being excluded.

**Oracles:** reverse the completion order of two fence transactions; then test delayed admission with Auth ahead of the database. Neither may reactivate authentication already invalidated by a completed fence.

### V6-4 — Medium: expired-token handling assumes the wrong HTTP status

**Evidence:** password spec [line 285](https://github.com/Micha0371/PantryFlow/blob/4c71e123435369ea8d8975d75a18843aa4924931/docs/planning/2026-11-19-password-recovery-session-spec.md#L285); deletion spec [lines 172–176](https://github.com/Micha0371/PantryFlow/blob/4c71e123435369ea8d8975d75a18843aa4924931/docs/planning/2026-11-19-account-deletion-spec.md#L172).

Both refresh only on “401, expired access token.” Auth v2.198.0 maps JWT parsing/validation failures—including expiry—to **403 `bad_jwt`**. [Versioned source](https://raw.githubusercontent.com/supabase/auth/v2.198.0/internal/api/auth.go).

**Consequence:** after a sufficiently long interruption, logout can repeatedly submit an expired access token while a usable refresh token remains available.

**Required correction:** define proactive expiry handling and the actual provider error mapping. Expired-token recovery must remain distinct from invalid signatures and session revocation.

**Oracle:** expire the access token while retaining a valid refresh token, then resume both global and temporary-session cleanup. Revocation must complete without an endless retry loop.

### V6-5 — Medium: the specified private function is not reachable through the proposed RPC call

**Evidence:** deletion spec defines `private.delete_own_account` at [line 94](https://github.com/Micha0371/PantryFlow/blob/4c71e123435369ea8d8975d75a18843aa4924931/docs/planning/2026-11-19-account-deletion-spec.md#L94), but calls `rpc('delete_own_account', …)` at line 301.

The repository’s API configuration exposes only `public` and `graphql_public`. Service-role privileges do not make an unexposed schema available through PostgREST. [PostgREST schema rules](https://docs.postgrest.org/en/v14/references/api/schemas.html).

**Required correction:** specify the callable boundary—for example, a narrowly granted public wrapper around the private implementation—and its schema/EXECUTE privileges. Do not silently expose the entire private schema.

**Oracle:** invoke the exact service-role RPC through PostgREST, prove the private implementation runs, and prove anonymous/authenticated callers cannot invoke the destructive boundary.

## V5-1–V5-8 disposition

“Resolved in design” remains conditional on the proposed verification actually passing.

| Previous finding | v0.6 disposition |
|---|---|
| **V5-1 — delayed admission/reactivation** | **Partial:** request-bound execution fixes stale RPC generations; pre-admission fencing still depends on V6-3. |
| **V5-2 — late password commit** | **Addressed through an explicit policy/residual change**, rather than quiescence. FV-A9 remains open. Remove the blanket claim that a late commit can only cause another sign-out: across another reset it can also replace that later password. |
| **V5-3 — Transition restart/adoption** | **Partial:** Transition is removed, but V6-2 leaves a pre-marker crash gap. |
| **V5-4 — SDK-null revocation proof** | **Partial:** raw responses remove SDK suppression; V6-1 still confuses local absence with global completion. |
| **V5-5 — restore selection** | **Resolved in design:** operation-lifetime selection and unresolved-intent retention address the counterexample. |
| **V5-6 — maintenance admission race** | **Resolved in design:** shared barrier locks span admission/execution; pause waits before draining. |
| **V5-7 — missing post-deletion outcome** | **Resolved in design:** explicitly assigned to operator reconciliation. |
| **V5-8 — temporary revocation credentials** | **Resolved in design:** explicit in-memory tokens and raw local logout address SDK credential removal; correct expiry handling under V6-4. |

## Amendment 1 assessment

- **A1 / OD-A10:** signing out after recovery or uncertainty is a justified simplification. Its evidence clause needs correction under V6-1. Local-session absence cannot satisfy an all-device promise.
- **A2 / OD-B9:** the documented technical advantage is genuine. Passing the generation into the destructive transaction resolves an important limitation of the Admin path. The accepted audit trade-off is explicit; hosted permission, cascade parity and the actual RPC boundary remain gates.
- **A3 / OD-B8 and OD-B6:** consistent with the revised design. Per-account owner approval, validity checking and an audit record appropriately constrain default completion. The maintenance barrier is materially stronger than the prior scan-only drain.

No additional broad product-policy decision is necessary for V6-2 through V6-5. **A1 does need an explicit disposition of the case where the current session is gone but global revocation remains unproven.**

## Test and feasibility corrections

The new D20–D25 and V02b generally have meaningful boundary oracles. Before execution:

- Extend **R19** to the pre-marker dispatch window and interrupted local cleanup.
- Correct **R18**: `session_not_found` cannot mean proven global logout; include a surviving second session and real expired-token behavior.
- Extend **D20/FV-B11** to monotonic fences and positive clock skew. Clock measurement alone is insufficient.
- Make **FV-B9/B10** exercise the exact deployed RPC boundary, privileges and schema configuration.
- Align **D07**’s remaining “Admin API end-to-end” wording with option X.
- Align **D19**’s “at most one outcome” with §7’s deliberate tolerance of duplicate messages.
- Treat **FV-A9** as a provider/configuration-bound verification, including cancellation behavior—not merely a client timeout measurement.

The next revision should concentrate on these five corrections. The request-bound deletion architecture and revised restore selection do not need another redesign.
