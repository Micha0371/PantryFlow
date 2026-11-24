# Independent AI review of Priority 1

Reviewer: a separate AI agent with a fresh conversation context, read-only access to the implementation/specification and retained local evidence. The reviewer did not implement the changes or mutate the database. Review completed 2026-11-24 before owner review and CI sign-off.

**Verdict: PASS for Priority 1's local assertion-effectiveness scope. High confidence; no unresolved material source findings.**

The reviewer inspected each applied policy mutation and actual failure diagnostic, not just exit codes:

| Weakened restriction | Independent observation |
|---|---|
| `items_update_member` | Foreign status changed to `out` |
| `items_delete_member` | Foreign row was deleted |
| `shopping_update_member` | Foreign shopping row became checked with a completion timestamp |
| `shopping_delete_member` | Foreign shopping row was deleted |
| `profiles_update_own` | Foreign name changed to `Updated profile` |
| `items_insert_member` | Foreign inserted-row count became one instead of zero |
| `shopping_insert_member` | Foreign inserted-row count became one instead of zero |

Both INSERT mutants also failed HTTP foreign-state assertions showing an extra foreign-household row. The five HTTP UPDATE/DELETE mutants survived only because the gateway rejected bare writes with exact `21000` diagnostics. These are correctly classified as gateway boundaries, not RLS detectors.

The reviewer verified intact baselines before and after the campaign: SQL 23/23, HTTP 7/7, on PostgreSQL 17.11/PostgREST v16.5. The [result manifest](local/results.json) truthfully records source baseline `76914a2`, a dirty implementation working tree, and test/migration byte hashes. This local record does not claim that the new tests existed at the baseline commit. Final implementation-head CI is required separately.

## Security and isolation review

The reviewed design uses ordinary-user writes, independent privileged/owner reads, positive own-data controls, populated non-null snapshots, operation-specific comparisons, separate mutants, restoration paths, Docker target guards and shared lock lifetimes for supported commands. Production migrations remain unchanged.

Review findings resolved before the final campaign:

- Refuse Docker target environment overrides before any Docker operation, so context inspection cannot validate a different target from the mutation command.
- Hold the shared lock throughout normal reset/database/integration suite execution, as well as mutation/Android runs; propagate nested ownership without releasing the parent lock.
- Recognize the real pg_prove assertion diagnostics while rejecting unrelated failures; take fresh DELETE snapshots so an UPDATE failure is not misattributed to DELETE.
- Require INSERT mutants to fail HTTP foreign-state assertions, rather than accepting the write gateway-boundary alternative.

The original high-severity assertion gap is closed for the five enumerated local SQL restrictions. This does not verify hosted behavior, RPC paths, other server/gateway versions or broader SP-2 coverage. Direct CLI/tsx bypasses remain unsupported concurrently. The review does not approve hosted operations, a merge, beta or public release.
