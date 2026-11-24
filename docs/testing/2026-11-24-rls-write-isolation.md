# Independent RLS write isolation regressions

Scope: owner-authorized **Beta Remediation Priority 1**, from current main `76914a2`. The controlling specification is [the merged remediation plan](../release-readiness/BETA-REMEDIATION-PLAN-25499a6.md#priority-1-close-the-five-masked-write-restrictions). Production policies, application behavior and hosted configuration/data are unchanged. Development remains GO; supervised beta and public release remain NO-GO. This implementation is for owner review, not automatic merge.

## Assertion design

[write_isolation.test.sql](../../pantry-flow/supabase/tests/database/write_isolation.test.sql) adds 23 real-PostgreSQL pgTAP assertions without modifying the existing suites. Two ordinary user identities own separate households and distinct pantry/manual-shopping rows. The actor runs constant-value UPDATE and DELETE statements with **no WHERE or RETURNING**, using only permitted columns. After `RESET ROLE`, independent reads check the actor's permitted change and compare the foreign row's complete JSON state with a non-null pre-operation snapshot. DELETE takes a fresh snapshot so an earlier UPDATE failure cannot be misreported as a DELETE-policy failure. The entire SQL file rolls back its fixtures.

[write-isolation.integration.ts](../../pantry-flow/tests/integration/write-isolation.integration.ts) adds seven ordinary-user HTTP cases. Each creates its own account pair, seeds the actual rows, obtains the actor's ordinary session in memory, and reads foreign state through its actual owner. The service client is used for fixture lifecycle only. Writes explicitly request `Prefer: return=minimal`; bare PATCH/DELETE URLs have no query parameters, household filters, count preference or returned representation. Known-ID minimal own-data controls independently demonstrate permitted operations; they are deliberately **not** credited as independent write-policy detectors.

For both tables, non-returning foreign INSERT uses the actor's own `created_by` and the other household's real ID, valid names and allowed columns. The tests check an own insert succeeds and persists. Foreign insertion checks both rejection and actual absence of a foreign row. Under a permissive INSERT mutant the HTTP test checks foreign state before its status assertion, so the failure identifies admitted foreign data rather than just an unexpected status.

## Actual gateway boundary

The local PostgREST 16.5 gateway rejects unfiltered PATCH/DELETE with HTTP 400, SQLSTATE `21000`, and the operation-specific message `UPDATE requires a WHERE clause` or `DELETE requires a WHERE clause`. The HTTP tests recognize only that exact boundary, verify both own and foreign state remain unchanged, and emit an explicit diagnostic. Other HTTP errors fail the tests.

Consequently, an opened write policy is detected by the **bare SQL foreign-state assertion**, while the corresponding bare HTTP request remains blocked by the gateway. Those HTTP passes are not RLS detectors. Both foreign INSERT restrictions are independently challenged over SQL and HTTP. This evidence does not establish hosted gateway behavior or show that every possible API/RPC shape is safe.

## Local safety and isolation

[check-rls-mutations.cjs](../../pantry-flow/scripts/check-rls-mutations.cjs) accepts no project, URL or database argument. It requires the exact disposable `pantryflow-tests` project, API `http://127.0.0.1:54321`, loopback database port 54322/database `postgres`, a matching local Docker container label and PostgreSQL 17. Remote Docker endpoints and `DOCKER_HOST`/`DOCKER_CONTEXT` overrides are rejected. A linked project marker is rejected. CLI status keys stay in memory and are never retained in evidence or supplied as process arguments.

The mutation runner holds the same machine-wide lock as Android E2E. Supported `db:reset`, `test:db`, `test:integration` and `test:local` commands now hold that lock for their complete execution, and integration client construction checks ownership. Nested children inherit the holder PID without releasing the parent's lock. This excludes already-running supported suites as well as newcomers. Direct `supabase`, `docker psql` or `tsx` invocations bypass lifetime locking; do not run them concurrently against this stack. Abrupt machine/process termination can leave an interrupted mutant run: reset this disposable stack before further work; the next run can reclaim a dead process's lock.

Each mutant starts with a local reset, weakens exactly one named restriction, and records before/after policy metadata, exact ALTER SQL and a unified metadata diff. UPDATE mutants explicitly weaken effective WITH CHECK as well as USING. INSERT mutants retain authorship equality and remove only household membership. No migration file is edited. An intact baseline runs before and after the campaign; a finally path resets the database even after failure, then releases the lock.

The detector requires the corresponding pgTAP foreign-state failure diagnostic, not merely a nonzero exit, timeout, empty run or unrelated assertion. HTTP INSERT mutants must fail their foreign-state assertion. HTTP write survivors must have the specific `21000` diagnostic and an executed passing target test; they are reported as gateway boundaries. Unit tests challenge the detector, target/output guards and lock lifetime. Signals are handled for restoration; uncatchable termination cannot be guaranteed.

## Reproduction and retained evidence

With the dedicated local Docker stack available, from `pantry-flow`:

```powershell
npm ci
npm run db:start
npm run test:local
npm run test:rls-mutations
```

The mutation command destroys only the validated disposable database's fixtures. It refuses existing output folders; repeat with `npm run test:rls-mutations -- --out fresh-run-name`. Commands, file/migration hashes, actual server version, gateway image, sanitized logs and outcomes are written under `.verification/<name>/`. It does not collect hosted credentials or contact hosted projects.

The database CI job runs the same campaign after the unchanged positive regression suites and retains the sanitized directory in `database-test-diagnostics`. Android is required for this harness change on the exact implementation head; its debug-emulator result is separate from hosted or release-artifact evidence. Final head check/run links belong in the implementation PR so later CI observations do not rewrite earlier records.

The successful local campaign is retained in the [evidence directory](rls-write-isolation/README.md): all five write mutants fail their corresponding foreign-state SQL assertion; both INSERT mutants fail SQL and HTTP foreign-state assertions; intact SQL 23/23 and HTTP 7/7 pass before and after. The [independent AI reviewer](rls-write-isolation/INDEPENDENT-REVIEW.md) inspected the implementation, safety/isolation paths and actual diagnostics and passed this local scope with high confidence. The final PR head's CI results remain a separate acceptance requirement. An unexecuted or interrupted run is never labeled a passing regression.

The complete restored local suite then passed: **88 pgTAP assertions across four files and 41 API/email integration tests**, including all existing positive tests. Local fast-equivalent checks also passed: 533 Node tests, 18 component tests, type checking, independence scanning and local-target safety tests. See [validation summary](rls-write-isolation/fast-checks.json) and [restored full-suite log](rls-write-isolation/full-local.log). These are local executions, not invented CI results.
