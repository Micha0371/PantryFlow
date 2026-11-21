# SEC-02 hosted drift check — 2026-11-21 (KAN-103)

**Result: match.** The hosted project's migration history and application schema match migrations 00001–00004. The only differences are the documented hosted-only exceptions plus one platform-managed event-trigger detail outside the application schema.

**Authorization:** the owner approved the SEC-02 read on 2026-11-21.

**Access:** read-only throughout:
- every query ran in an explicit `BEGIN READ ONLY` transaction and selected catalog metadata only;
- no user row was read and no data was changed;
- no credential was supplied in a command or printed.

## Method

The [read-only hosted catalog comparison](hosted-verification.md#read-only-hosted-catalog-comparison), with the isolated workdir from the [KAN-29 baseline procedure](hosted-baseline-adoption.md).

- **Reviewed commit:** `main` at `7b05ce4`. Migrations 00001–00004 were copied byte-identical into a fresh, ignored workdir (`.verification/sec02-hosted`, config from `ops/hosted-baseline`).
- **Tools:** the pinned Supabase CLI 2.122.1 and its existing local login; target project `oiqteedkfwmcertgxqga`.
- **Local reference:** `npm run db:reset` on the local test stack (local only), then `scripts/catalog-snapshot.sql` and `scripts/baseline-inventory.sql` through `psql` in the local database container.
- **Hosted:** the same two files plus `ops/hosted-baseline/read-back.sql` through `db query --linked --project-ref oiqteedkfwmcertgxqga --workdir .verification/sec02-hosted`. All three exited 0. stderr held only the CLI's login-role and update notices.
- **Comparison:** semantic JSON comparison (key order and list order ignored, CRLF normalized to LF, as the procedure requires). Outputs and the comparison script stay in ignored `.verification/sec02/`.
- **Side effects:** as documented for KAN-29, the CLI wrote `linked-project.json` in the isolated workdir only. The test stack's `supabase/.temp` still contains only `cli-latest`.

## Findings

| Check | Result |
|---|---|
| Migration history | Exactly `00001` first_slice, `00002` review_hardening, `00003` strict_duplicate_prevention, `00004` shopping_items |
| PostgreSQL major | 17 on both (hosted 17.6, local 17.11; documented since KAN-28) |
| Application catalog: tables, RLS, columns, table and column privileges, constraints, indexes, policies, functions (definitions, settings, execute grants), triggers | **0 differences** after line-ending normalization |
| Inventory: relations, routines, triggers, types, uuid extension, migration ledger | Same, apart from the items below |

**Remaining differences, with their disposition:**
1. **`public.rls_auto_enable()` and event trigger `ensure_rls` (hosted only).** A documented hosted-only exception ([KAN-29](hosted-baseline-adoption.md)). Unchanged: same owner, `SECURITY DEFINER`, `search_path pg_catalog`, ACL, and the normalized definition SHA-256 `dd9ce3fd3905d621…`; `ensure_rls` has the same tags. **No action.**
2. **Server version 17.6 hosted vs 17.11 local.** Documented; the major version matches. **No action.**
3. **Platform event trigger `issue_pg_graphql_access`** (owner `supabase_admin`, function `extensions.grant_pg_graphql_access`) fires on `CREATE FUNCTION` on hosted, on `CREATE EXTENSION` locally. This is managed by the Supabase platform outside the application schema and reflects platform-version differences; not previously recorded. **No action;** it is noted here so later comparisons recognize it.

No drift needs a fix. No migration, repair or data change was made.
