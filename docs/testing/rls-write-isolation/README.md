# Priority 1 retained local execution evidence

Specification, commands and safety boundaries: [write-isolation protocol](../2026-11-24-rls-write-isolation.md). Independent AI review: [review record](INDEPENDENT-REVIEW.md).

The successful campaign was run on Windows with Node 26.10.0, the pinned Supabase CLI, actual PostgreSQL 17.11 and PostgREST v16.5. The [manifest](local/results.json) records the starting Git baseline and dirty implementation state, exact commands, raw working-file SHA-256 values and outcomes. Working-file hashes include platform line endings; they are not presented as Git-blob hashes or evidence that the baseline commit contained these new tests. The final PR head is validated separately in CI.

## Intact and permissive outcomes

Intact before and after: **23/23 pgTAP assertions and 7/7 HTTP tests passed**. Each mutant started from a reset local database and changed only the named policy. No migrations, product code or hosted policies were modified.

| Mutant | Bare SQL outcome | Minimal HTTP outcome |
|---|---|---|
| [items_update_member](local/items_update_member) | Foreign-state assertion fails: status becomes `out` | Gateway denies the unfiltered request with `21000`; not an RLS detector |
| [items_delete_member](local/items_delete_member) | Foreign-state assertion fails: row is missing | Same gateway boundary |
| [shopping_update_member](local/shopping_update_member) | Foreign-state assertion fails: completion state changes | Same gateway boundary |
| [shopping_delete_member](local/shopping_delete_member) | Foreign-state assertion fails: row is missing | Same gateway boundary |
| [profiles_update_own](local/profiles_update_own) | Foreign-state assertion fails: name changes | Same gateway boundary |
| [items_insert_member](local/items_insert_member) | Foreign row appears and the expected rejection fails | Foreign-state assertion fails: extra row is visible to its household owner |
| [shopping_insert_member](local/shopping_insert_member) | Foreign row appears and the expected rejection fails | Foreign-state assertion fails: extra row is visible to its household owner |

Each linked directory retains the ALTER SQL, a before/after policy snapshot, unified mutation diff and sanitized SQL/HTTP diagnostics. Fixture UUIDs/emails and the application path are redacted. Result values relevant to policy enforcement remain visible. These are seven deliberately chosen regressions, not a coverage percentage. Catchable failure paths restore the local database; uncatchable termination requires a fresh local reset before use.

Earlier parser/fixture-validation attempts remain ignored and are not counted as successful campaigns. The successful evidence here binds the final test inputs by hashes and contains the restored baseline, rather than crediting a setup error or arbitrary nonzero exit.
