# Codex review of the account-lifecycle specifications v0.7 (4c71e12..1c0225e)

*Recorded verbatim as delivered to the owner on 2026-11-19. Version 0.8 responds to it.*

**OD-A11 is technically reasonable, and I recommend it—with two narrow corrections to the new re-authentication path.** Its acceptance remains your owner decision.

**Review verdict: request changes.** I found **one High, one Medium and one Low finding**. The deletion-ticket and wrapper changes address the corresponding v0.6 findings at the specification level.

Reviewed immutable delta **`4c71e12..1c0225e96cf8507a5cf5b2b0aa2ae6e24209532a`**. No experiments, hosted access or modifications.

## Findings

### V7-1 — High: replacement authentication must be bound to the pending account

**Evidence:** password spec [lines 295–297](https://github.com/Micha0371/PantryFlow/blob/1c0225e96cf8507a5cf5b2b0aa2ae6e24209532a/docs/planning/2026-11-19-password-recovery-session-spec.md#L295).

The marker identifies a user, but ReauthRequired does not explicitly require the ordinary sign-in’s returned user ID to match it before revoking sessions and clearing the marker.

Counterexample:

1. Account A has unresolved revocation.
2. The ordinary sign-in authenticates account B.
3. `scope=others` for B returns 204.
4. The specified completion rule clears A’s marker, although A’s surviving sessions were untouched.

Logout operates on the authenticated user, not the marker’s user. [Versioned logout handler](https://raw.githubusercontent.com/supabase/auth/v2.198.0/internal/api/logout.go).

**Required correction:** require `returnedUser.id === credential_op.user_id` before adopting the replacement as cleanup authority or dispatching its revocation. On mismatch, preserve A’s marker and reject completion. Specify safe cleanup of B’s newly created session.

**Oracle:** re-authenticate as B while A’s marker exists. A’s marker remains, no “other devices signed out” claim appears, and A’s surviving session remains explicitly unresolved.

### V7-2 — Medium: replacement-session loss has no recovery transition

**Evidence:** password spec [line 297](https://github.com/Micha0371/PantryFlow/blob/1c0225e96cf8507a5cf5b2b0aa2ae6e24209532a/docs/planning/2026-11-19-password-recovery-session-spec.md#L297).

ReauthRequired says to retry until `scope=others` returns 204, but does not define what happens if that fresh session is itself revoked before completion. This is particularly relevant to the expressly accepted late-update residual.

Repeating logout with a permanently invalid session cannot finish revocation.

**Required correction:** distinguish:

- transient failure: retain the pending cleanup and retry;
- expired access token with usable refresh token: refresh and retry;
- revoked session or unusable refresh token: require another **same-account** authentication, preserving the marker and keeping tabs blocked.

Use the same raw-response discipline as FinalSignOut.

**Oracle:** authenticate the replacement session, revoke it before `scope=others`, then retry/restart. The app must request authentication again rather than retry dead credentials indefinitely or clear the marker.

### V7-3 — Low: the completion wording still overstates `scope=others`

**Evidence:** password spec [line 336](https://github.com/Micha0371/PantryFlow/blob/1c0225e96cf8507a5cf5b2b0aa2ae6e24209532a/docs/planning/2026-11-19-password-recovery-session-spec.md#L336).

“All devices are signed out” is inaccurate after the OD-A11 path, which deliberately keeps the fresh session.

**Correction:** distinguish “all sessions ended” after global logout from “all other sessions ended; this device is signed in afresh” after OD-A11. Retain the outstanding-access-token caveat.

## V6-1–V6-5 disposition

| Previous finding | v0.7 disposition |
|---|---|
| **V6-1 — missing session mistaken for global proof** | **Original inference corrected.** The new fallback needs V7-1/V7-2 before it is complete. |
| **V6-2 — marker after dispatch** | **Resolved in design:** write-ahead marker, phase conversion and cleanup recovery are specified. |
| **V6-3 — clock-dependent fence** | **Resolved in design:** ticket invalidation and equality checks under the row lock remove that clock comparison. |
| **V6-4 — expired-token status** | **Resolved for the specified global/local paths:** proactive refresh and expired `bad_jwt` handling are present. Apply that handling to OD-A11 too. |
| **V6-5 — unreachable private RPC** | **Resolved in design:** public service-only wrappers provide the callable boundary. Actual privileges and invocation remain FV-B9/B10 checks. |

The admission ticket is a better fit than a timestamp cutoff. Fencing invalidates an unconsumed ticket; consuming it produces a request generation; the destructive function checks that generation. Retiring **FV-B11** is appropriate for this admission mechanism.

## Tests and remaining gates

The revised tests have meaningful oracles. Add:

- **R20:** wrong-account authentication and replacement-session revocation.
- **R19:** restart after replacement sign-in but before `scope=others`, and after its 204 before marker cleanup.
- **D20:** replay a consumed ticket, concurrent attempts to consume one ticket, and issuance/admission/fence ordering.
- **FV-B9/B10:** verify exact wrapper invocation and required schema/function privileges, alongside client-role rejection.

FV-A9 now correctly asks about provider/configuration limits and cancellation propagation. It remains an open verification requirement—not evidence of a known bound.

**Recommended next step:** record owner acceptance of OD-A11 with same-account binding, correct these two fallback cases and the wording, then proceed to the separately authorized feasibility checks. **No further deletion-architecture redesign or additional product-policy decision is indicated by this review.**
