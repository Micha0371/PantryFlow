# PantryFlow — Product and Engineering Quality Assessment

> **QA baseline.** Committed on 2026-11-18 as PantryFlow's first graded quality baseline, at Slice 2 completion on `main` `ec0dbdd`. The assessment text below is unchanged from the delivered report. Its findings F-01 to F-19 are reconciled into the Slice 3 backlog in the [QA integration dry run](../planning/2026-11-18-slice-3-qa-integration-dry-run.md). Later assessments (QA-01) are compared against this file.

**Date:** 2026-11-18
**Assessed reference:** `Micha0371/VSCode-Environment`, `origin/main` at `ec0dbddc2b4e6ca08f19605cde6e2e7892b7aba1`. This is the merge of PR #40, the last Slice 2 follow-up.

**Assessment worktree:** a detached, throwaway checkout of that commit. The working tree was clean before and after every experiment.

The owner's main checkout is on `pantryflow/profile-baseline-reconciliation` at `f7a198f`. It has three untracked Slice 3 planning files and was not assessed or modified.

**Milestone:**
- Slice 2 (Shopping List MVP, KAN-6) is functionally complete, and all of its follow-up tickets are closed.
- KAN-6 itself is still open, pending owner acceptance.
- The last validated tags are `pantryflow/slice-1.1-baseline` and `pantryflow/sdk58-validated`. No Slice 2 baseline tag exists.

**Mode:** read-only. No source, Jira, git or hosted changes were made. The only local effects were:
- runs against the disposable local Supabase stack (`supabase_db_pantryflow-tests`), which was reset to the repository migrations afterwards;
- temporary mutations in the throwaway worktree, each reverted with `git checkout`.

> **Independence disclosure.** This assessment was produced by the same AI agent that implemented and verified Slice 2 Packages 2–6 (KAN-27, KAN-32/34/36/37/38/39, KAN-84–86) in the same working session. That is a conflict of interest.
>
> To limit it:
> - every grade rests on evidence re-executed on the assessed commit, or on primary artifacts (code, migrations, CI API, SonarCloud API), not on earlier reports;
> - executed, recorded, static and inferred evidence are labelled separately;
> - a separately commissioned, independent review should confirm the grades in categories 5 and 12 especially.

---

## A. Executive summary

| Item | Result |
| --- | --- |
| **Overall score** | **84.5 / 100** |
| **Overall grade** | **B** |
| **Completeness** | All 12 categories assessed. Category 9 (performance) rests on static inspection only and is low-confidence. Excluding it would give 84.7, so the grade is unchanged. |
| **Confidence** | Medium overall. High for categories 2, 5, 7 and 10 (re-executed suites and mutation experiments). Low to medium for categories 1 and 9 (no external users, no measurements). |
| **Development readiness** (next functional slice, Slice 3) | **GO** |
| **External beta** (closed, invited Android testers) | **CONDITIONAL GO.** See the conditions in section H. |
| **Android production** | **NO-GO** |
| **iOS production** | **NO-GO.** No iOS build exists. |
| **Public production release** | **NO-GO** |

**Five most important strengths**
1. **The database is the real authority.**
   - RLS is on every table, writes are limited by column grants, and identity and ownership fields are immutable.
   - Uniqueness is enforced by normalized unique indexes, so concurrent duplicates are impossible.
   - A composite foreign key keeps shopping links inside one household.
   - `SECURITY DEFINER` functions have a fixed `search_path`.
   - These are proven by pgTAP and ordinary-client API tests.
2. **Tests detect real regressions.** All 7 mutation experiments run in this assessment were caught: 6 in application logic, 1 in RLS authorization. Previously fixed defects carry regression tests that were shown failing.
3. **Robustness against asynchronous hazards is unusually thorough for an MVP:** stale responses, household changes, double taps, writes before the first load, lost native dialogs, and navigation during pending requests.
4. **Verification discipline is strong:**
   - required fast, database and SonarCloud checks on protected `main`;
   - manual Android E2E on the emulator, plus physical-device and TalkBack evidence;
   - failures and flakes are classified rather than hidden.
5. **The architecture is lean and proportionate.**
   - Client-to-Supabase with no custom backend.
   - Small modules, `strict` TypeScript with no `any` or `@ts-ignore`, and a small dependency set.
   - SonarCloud shows 0 bugs, 0 vulnerabilities and 0 hotspots in the app, with 0.8% duplication.

**Five most important weaknesses**
1. **Gaps for a public product:**
   - no password recovery (PF-AUTH-001);
   - no account deletion or retention path (KAN-43);
   - English only (`de.ts` is an empty stub; PF-I18N-001);
   - no iOS build (PF-IOS-001).
2. **Everyday efficiency is mediocre:**
   - marking an item low and adding it to the list takes 4 taps (the PRD targets 2–3);
   - the pantry list has no search, sort or filter, and filters were deferred (D5);
   - there is no bulk entry.
3. **Accessibility is incomplete:**
   - the status, category and location chips expose no role or selected state, so a screen-reader user cannot tell which status is selected;
   - VoiceOver is entirely unverified.
4. **The scope baseline is inconsistent.** The PRD's MVP table includes shared households and the free/premium split. Neither appears in any slice, including Slice 3. That needs an explicit owner decision (KAN-51).
5. **Operational maturity is low:**
   - no crash or error monitoring;
   - Android E2E is not a required check;
   - the dependency-advisory register is stale: `npm audit` now reports a new high advisory, picomatch ReDoS, propagated to 66 packages, while the register says "zero high";
   - no release pipeline or store distribution yet.

**Release blockers.** No critical security, privacy or data-integrity defect was demonstrated. The production blockers are the launch gates in finding F-01 to F-03 and F-09/F-11 (section E). Nothing blocks continued development.

---

## B. Weighted scorecard

| # | Category | Weight | Score | Grade | Confidence | Main justification |
|---|---|---:|---:|:---:|:---:|---|
| 1 | Usability and user experience | 15% | 75 | C | Low–Med | Clean three-tab flow, good error states and safeguards. But status changes take 4 taps, there is no search, sort or bulk entry, the app is English only, there is no password reset, the chips are unlabelled for screen readers, and no external user validation exists. |
| 2 | Functional correctness and spec compliance | 15% | 88 | B+ | High | All Slice 2 decisions D1–D6 are implemented and traced to tests; the invariants are enforced in the database. The PRD-versus-slice scope inconsistency (sharing, premium) is a specification gap, not an implementation defect. |
| 3 | Architecture and separation of concerns | 10% | 86 | B | Med–High | Data modules hold pure rules, providers own state with a shared household scope, and the database is authoritative. The prompt orchestration lives in the 307-line Edit Item screen, and the two providers duplicate similar mutation logic. |
| 4 | Code quality and maintainability | 10% | 87 | B+ | High | Strict TS with no type escapes, small files, 0 Sonar bugs or vulnerabilities in the app, 0.8% duplication, 88 minor smells. Some ticket-ID comment noise, and one large screen. |
| 5 | Meaningfulness of tests | 10% | 88 | B+ | Med–High | 7/7 mutations caught; assertions target behavior. React Native is stubbed with strings in the Node suites, there is no per-test timeout (one mutation hung instead of failing), and some tests are coupled to their stubs. |
| 6 | Behavioral test coverage | 8% | 84 | B | Med–High | Five layers: unit 252, Jest 2, pgTAP 65, API 22, Maestro 5 flows. No iOS or localization coverage, Android E2E only on demand or schedule, accessibility partly manual, no coverage metric. |
| 7 | Security, privacy and data integrity | 10% | 88 | B+ | High | Strong RLS, grants and constraints, proven by mutation. Not done yet: account deletion and retention, password policy (KAN-80), the populated-migration test, and the premium-flag audit. A stale advisory register. |
| 8 | Engineering proportionality | 5% | 84 | B | Medium | No over-built application layers, lean dependencies. But process and documentation overhead is high relative to about 3,100 lines of app code. |
| 9 | Performance and resource efficiency | 4% | 80 | B− | Low | Static inspection only: full-page fetch at household scale, memoized contexts, a 33 MB arm64 test APK. No startup or render measurements exist. |
| 10 | Robustness and error recovery | 5% | 88 | B+ | High | Stale, unloaded, double-tap, lost-dialog and household-change hazards are covered and pinned by tests. No offline mode, which is out of scope. |
| 11 | Build, CI/CD and operational readiness | 4% | 78 | C+ | Medium | Protected `main`, reproducible `npm ci`, Windows tooling job. Android E2E is not required, there was one infrastructure flake, and there is no monitoring, iOS build, store pipeline or rollback beyond migration procedures. |
| 12 | Quality of AI-assisted development | 4% | 88 | B+ | Medium (self-assessed) | Strong governance and evidence integrity. Two lapses are on record: a commit made on a red suite, and an inaccurate coverage note, both later corrected. Process overhead is high (12.7). |
| | **Weighted overall** | **100%** | **84.5** | **B** | **Medium** | |

**Calculation:**
- 75×15 + 88×15 + 86×10 + 87×10 + 88×10 + 84×8 + 88×10 + 84×5 + 80×4 + 88×5 + 78×4 + 88×4 = 8,451, which divided by 100 gives 84.5.
- Without category 9: (8,451 − 320) / 96 = 84.7, still B.

---

## C. Detailed assessment

### Category 1 — Usability and user experience: **C (75)**

**Evidence types**
- **Implemented / static:** code of all screens.
- **Device-tested:** by the owner on one Android 16 phone. The KAN-34/39 TalkBack checks and the Maestro journeys on that phone ran on 2026-11-13 to 11-18.
- **External-user validated:** none (NOT VERIFIED).

**Interaction counts** (static, from the code and Maestro flows; typing not counted):

| # | Workflow | Taps | Notes |
|---|---|---:|---|
| 1 | Register and begin | ≈ 7 + email round-trip | Register link, 3 fields, Create, open the email, tap the link. The hosted project requires email confirmation, so the PRD's "60 seconds" target is not measurable and is likely missed in practice. |
| 2 | Initial inventory | 2–4 per item | +, the name field is autofocused, type, optional category and location chips, Save. The Return key does not save (`app/add-item.tsx`). There is no bulk or barcode entry; barcode is deferred. 20 items take about 40–80 taps. |
| 3 | Mark running low | 3 | Tap the row, choose Low, Save. There is no inline status control; the PRD Flow 3 suggests "tap status or swipe". |
| 4 | Add a needed item to the list | +1 (via the prompt) or 3 manually | The prompt's Add button, so the full "mark low and add" path is **4 taps** against the PRD target of 2–3. Manually: Shopping tab, field, Add (Return also submits, and the keyboard stays open for multi-add, which is good). |
| 5 | Complete while shopping | 1 | Tap the circle. Completed items move to their own section. |
| 6 | Correct an accidental action | 1 (reopen) / 3 (status) | Reopening a completed item takes 1 tap. A wrong status takes another edit. Deletes are guarded by a confirmation dialog, but there is no undo afterwards. |
| 7 | Edit or remove an item | 3 | Row, Delete, Confirm. A rename takes row, edit, Save. |
| 8 | Recover from a failed operation | 1 | "Try again" on load errors. Translated, item-named error texts (KAN-37). Writes leave the form intact. |

**Strengths**
- Simple navigation: Pantry, Shopping, Settings.
- Clear empty states.
- Statuses limited to three colour-coded values.
- Protection against double taps (KAN-33/38), a lost dialog (KAN-36) and accidental deletes.
- Keyboard-safe first taps.
- Errors are announced to TalkBack: field errors (KAN-34), screen-level errors (KAN-39) and repeated errors (KAN-84), all checked on a phone.

**Weaknesses**
- No search, sort or filter in the pantry list, which is a flat list, newest first (`app/(tabs)/index.tsx:52-62`, `lib/pantry-data.ts:71`). Past about 30 items, finding an item means scrolling.
- Status changes require the edit screen.
- `OptionChips` (`components/OptionChips.tsx:27-37`) has no `accessibilityRole` or `accessibilityState.selected`, so TalkBack users cannot tell which status, category or location is selected.
- `PantryItem` rows have no role or label (`components/PantryItem.tsx:16`).
- English only (`lib/i18n/de.ts` has 3 lines), and no language switch.
- No password reset link.
- Settings contains only Sign out.

**What prevents B−:** the 4-tap status path, the missing pantry search, the inaccessible selection chips, and the absence of any user test beyond the developer and owner.

### Category 2 — Functional correctness and specification compliance: **B+ (88)**

**Executed verification** on `ec0dbdd`:
- `npm run test:fast`: typecheck, Node 252/252, Jest 2/2, local-stack safety 1/1;
- `npm run test:local`: database reset, pgTAP Files=3 Tests=65 PASS, integration 22/22.

**Traceability matrix (key requirements)**

| Requirement (source) | Implementation | Verification evidence |
|---|---|---|
| Pantry names unique per household after trim and case normalization (Slice 1.1, `00003`) | `pantry_items_household_normalized_name_key` on `(household_id, lower(pantry_trim_item_name(name)))`, a normalize trigger, client `assertUniqueItemName` | pgTAP `slice_1_1.test.sql`; integration `behavior.integration.ts`; mutations M1 and M2 caught (sections 5 and 6) |
| Duplicate add and rename rejected; editing without an identity change allowed | DB 23505, `itemSaveErrorKey`, edit excludes its own id | `screens.test.cjs` (duplicate translated without navigation), pgTAP, integration |
| Category, location and status do not affect uniqueness | The index omits them | pgTAP and integration (Slice 1.1 matrix) |
| Households independent | RLS `household_id IN (membership)` on all item tables; `UNIQUE(user_id)` membership | pgTAP foreign-visibility checks; RLS mutation (`USING (true)`) caught by "foreign shopping invisible" |
| Shopping duplicates among open items only, completed may repeat (D1) | Partial unique index `WHERE NOT is_checked` (`00004:55-57`) | `shopping.test.sql`; `shopping-data.integration.ts` |
| Completion retained and reopenable, server-timestamped (D2) | `prepare_shopping_item()` sets `completed_at` | pgTAP, `shopping-state.test.cjs`, Maestro complete/reopen |
| The low/out prompt only on a change to low or out; the pantry save is never rolled back (D3) | `offersShoppingAdd` plus the `edit-item` orchestration | `edit-item-prompt.test.cjs`; mutations M3 and M4 caught; Maestro prompt steps |
| Pantry deletion keeps the shopping item, link set to null (D4) | Composite FK `ON DELETE SET NULL (pantry_item_id)` | `pantry-shopping.integration.ts` |
| No silent merging, renaming or deletion | Errors surface as translated keys; the migration `00003` refuses to auto-resolve | pgTAP and integration; code inspection |
| The shopping list never changes pantry state, and vice versa | No cross-writes in the data modules | `pantry-shopping.integration.ts` (SHOP-LINK-02) |

**Discrepancies**

| Item | Classification |
|---|---|
| PRD §2 MVP includes shared household (2 members) and a free/premium split (75 items); no slice, including Slice 3 (KAN-40–83), schedules either | **Specification defect or ambiguity.** It needs an owner decision (KAN-51). Not penalized as an implementation gap. |
| PRD Flow 5 (check-off removes the item) versus D2 (completion retained) | Intentional documented deviation |
| PRD Flow 3 (tap status or swipe, 2–3 taps) versus the edit-screen-only status | Partly documented (D3 fixes the entry point, not the tap count). Usability gap. |
| PRD EN+DE at launch, dashboard filters | Intentional documented deferral (D5, PF-I18N-001) |
| Undocumented behavior changes or unapproved scope | None found |

**What prevents A−:** the PRD-versus-slice scope inconsistency is unresolved, and the hosted application of the Slice 2 schema (`00004`) was not verified in this assessment (NOT VERIFIED).

### Category 3 — Architecture and separation of concerns: **B (86)**

**Structure** (about 3,100 lines of app code):
- `lib/*-data.ts`: pure validation, error mapping and Supabase queries;
- `hooks/household-scope.tsx` and `household-list.ts`: shared scope and stale-guard;
- `hooks/usePantryItems.tsx` and `useShoppingItems.tsx`: domain providers;
- `app/*`: screens;
- `components/*`: presentational components.

**Strengths**
- Dependencies point one way: screens use providers, providers use data modules, data modules call Supabase.
- The household scope was extracted only when the second consumer needed it (Step 2a).
- The database enforces every invariant.
- No speculative repository or service layers.

**Weaknesses**
- The D3 prompt orchestration (save, prompt, add, notice, plus focus guards) lives in `app/edit-item/[id].tsx:131-153`. The screen is 307 lines, the largest file. That's contrary to the plan's rule to keep business rules out of UI handlers, although the rule itself, `offersShoppingAdd`, is extracted.
- The pantry and shopping providers repeat the same unloaded-write and re-read pattern (`usePantryItems.tsx:19-27` mirrors the shopping provider). Acceptable at two consumers.
- `lib/auth.tsx` mixes the auth context with the session-restore policy. Fine at this size.

**What prevents B+:** the business flow sits in the screen, and the twin-provider duplication has no shared contract beyond tests (`list-provider-contract.cjs` partly provides one).

### Category 4 — Code quality and maintainability: **B+ (87)**

**Evidence**
- `tsconfig` `strict: true`; zero `any`, `@ts-ignore` or `eslint-disable` in `app`, `components`, `hooks` and `lib` (grep).
- SonarCloud on `main`: app and Jira tooling show 0 bugs and 0 vulnerabilities, 88 Minor code smells (mostly S9382 and S6759) and 0.8% duplication project-wide. The project's reliability rating is D only because of 3 bugs in the legacy `frontend/` scaffold.

**Strengths:** small files and functions, names that say what they mean, consistent error-key mapping, lifecycle guards (`mounted`, `current()`), shared `useFormError` and `InlineError`.

**Weaknesses**
- Many comments carry ticket IDs ("(KAN-37)"). They aid traceability but add noise and rot.
- `app/edit-item/[id].tsx` is the complexity hot spot.
- The legacy `frontend/` and `backend/` scaffold is still in the repository, which distorts the project-wide metrics.
- No coverage metric is published.

### Category 5 — Meaningfulness and effectiveness of tests: **B+ (88)**

**Mutation experiments executed in this assessment** (throwaway worktree, each reverted):

| ID | Mutation | Result |
|---|---|---|
| M1 | Pantry duplicate check ignores case (`lib/pantry-data.ts:25`) | Caught: 2 failures |
| M2 | Pantry duplicate check without trim | Caught: 1 failure |
| M3 | "Low" no longer offers the shopping add (`lib/pantry-shopping.ts:5`) | Caught: 16 failures |
| M4 | An unchanged status also prompts | Caught: 18 failures and 1 cancelled. **Without a timeout, one test hangs indefinitely.** |
| M5 | Duplicate shopping error mapped to generic (`lib/shopping-data.ts:74`) | Caught: 8 failures |
| M6 | Permission error mapped to "missing" | Caught: 2 failures |
| M7 | Shopping `SELECT` policy `USING (true)` (`00004`, local stack) | Caught by pgTAP test 37, "foreign shopping invisible" |

**Recorded evidence** (ledgers, PR descriptions): each KAN-32 to KAN-86 fix carries a test that was shown failing first, or pinned by a deliberate mutation. One re-review corrected a test that pinned only half of a guard (KAN-85 I1). That was a test optimized for the wrong scenario, later fixed.

**Strengths:** behavior-level assertions (announcements, navigation counts, error keys, persisted outcomes); real local Auth and PostgREST with ordinary clients for authorization; fake timers instead of sleeps; database read-back after Maestro journeys.

**Weaknesses**
- The Node suites stub React Native primitives as strings (`tests/helpers.cjs` with per-test stubs). Layout, real touch handling and native accessibility are not exercised below Maestro.
- Tests are coupled to stub structure. For example, a test helper matched both a composite and a host node after a refactor (PR #39).
- There is no per-test timeout, so a regression can hang the suite (M4).
- Large inline stub maps are repeated across files, a maintenance cost; the deferred minor M2 from PR #40 covers this.

### Category 6 — Behavioral test coverage: **B (84)**

| Area | Automated | Manual or device | Gap |
|---|---|---|---|
| Auth, registration, confirmation, PKCE, session restore | Unit, integration, Maestro (5 confirmation flows) | Physical cold start (PF-EMAIL-001) | Password recovery doesn't exist |
| Pantry CRUD, duplicates, household isolation, direct API | Unit, pgTAP, integration, Maestro | Phone runs | — |
| Shopping CRUD, complete/reopen, prompt | Unit, pgTAP, integration, Maestro | Phone runs | — |
| Loading, empty, error, retry, concurrency, stale state | Unit (providers), proxy faults in Maestro | Phone checks | — |
| Restarts, backgrounding | Maestro cold restart; lost-dialog experiment | Phone | Background alert loss was only checked manually |
| Accessibility | Unit (props, announcements) | TalkBack checks (KAN-34/39/84) | VoiceOver none; chips unlabelled |
| Localization | — | — | German absent |
| iOS | — | — | **No build** |

The distribution across layers is appropriate: most tests are fast unit tests, authorization is tested at the database, and journeys use E2E.

**Gaps:** Android E2E runs only on manual dispatch, the schedule or a `[full-e2e]` push (`.github/workflows/pantryflow-tests.yml`, android `if:`), and is not a required check. No coverage percentage is collected.

### Category 7 — Security, privacy and data integrity: **B+ (88)**

**Confirmed controls** (static inspection plus the executed pgTAP and integration runs):
- RLS is on all 5 tables, with policies scoped to membership.
- `REVOKE`/`GRANT` per column: clients cannot write `created_by` (except on insert, where `= auth.uid()` is checked), `household_id` on update, `is_premium`, or timestamps (`00002:5-6,43-46`, `00004:61-66`).
- Membership is `UNIQUE(user_id)` with no client insert path, so there is no self-joining.
- Concurrency-safe uniqueness through unique indexes.
- Composite same-household foreign key.
- `SECURITY DEFINER` triggers pinned with `search_path = ''` (`00002:12-13`).
- The trigger function `prepare_shopping_item` has `EXECUTE` revoked.

**Stale cross-household client state** is guarded by `isCurrent(scope)` and pinned (KAN-85 item 2). Secrets go through Windows Credential Manager and the CLIs; CI is read-only with no hosted credentials (per `docs/security`).

**Confirmed vulnerabilities:** none demonstrated.

**Risks and unverified items**
- No account deletion or data-retention path (KAN-43). This is a GDPR and Play-policy blocker for public release.
- No password policy beyond Supabase defaults (KAN-80).
- PF-PREMIUM-001: historical `is_premium` flags are unaudited. Not currently used for gating.
- PF-DATA-001: no populated-database migration test.
- DMARC is `p=none` (PF-EMAIL-002).
- A hosted-only RLS auto-enable event trigger is accepted as a configuration exception.
- **`npm audit`** (executed): 66 high and 6 moderate. There is one new high root advisory, picomatch ReDoS (GHSA-fc5q-39xc-vjpf, ≤ 4.0.7), reached through Expo CLI, Metro and Jest, which is build tooling. The two moderates (glob, minimatch) are already registered. `docs/security/tooling-advisories.md` (last assessed 2026-11-09) still says "zero high/critical" and requires escalation once severity turns high. Exposure is likely limited to the build environment, but the register is stale (F-07).

### Category 8 — Engineering proportionality: **B (84)**

**Proportionate:**
- no custom backend;
- 18 runtime dependencies, of which 4 Expo packages are not imported directly but most likely required by Expo Router and icon fonts;
- no state library;
- no generic HouseholdKit framework built ahead of need.

**Disproportionate:**
- **Process and documentation volume.** 10 plan documents for Slice 2 packages, a 485-line coverage matrix, ledgers, and Opus reviews even for an 11-minor package. Test code is about twice the app code. Much of it gives real value (traceability, evidence), but the marginal benefit for small packages is low.
- **Repository tooling** (Jira CLI with its own CI) is justified by the safety rules, but adds surface.
- **Under-engineering:** no monitoring, and no shared list-provider abstraction despite twin implementations. That one is defensible at two consumers.

### Category 9 — Performance and resource efficiency: **B− (80), low confidence**

**Static only:**
- `fetchAllPages` loads a household's full list, sorted by `created_at, id`. Fine at household scale; the PRD's free limit is 75 items.
- Indexes on `household_id` and the uniqueness keys.
- Context values memoized (KAN-27), so consumers don't re-render needlessly.
- No polling or background work.
- arm64 test APK 33 MB.

**Not measured:** startup time, render performance, memory, network volume (NOT VERIFIED). No problem is assumed.

### Category 10 — Robustness and error recovery: **B+ (88)**

**Covered and pinned by tests:**
- stale reads after a write (KAN-32);
- household or identity change during pending work;
- double taps (KAN-33/38);
- a lost native dialog that leaves the form usable (KAN-36);
- a late answer after Cancel (KAN-85);
- a remove that drops the row before it resolves (KAN-35);
- load failures with retry;
- an unloaded write followed by a re-read;
- a missing record;
- a slow write (proxy delay);
- cold restart.

**Gaps**
- No offline queue. Out of scope, but slow-network UX is only "spinner, then error".
- Session expiry while using the app is covered only through the restore path.
- **Recorded:** one known benign state, where the shopping list can briefly show only the new row during a re-read. It's declined and documented.

### Category 11 — Build, CI/CD and operational readiness: **C+ (78)**

**Executed or observed**
- `npm ci` from the lockfile succeeded.
- The CI API shows recent `main` pushes green (fast, database, windows-tooling, Jira tooling).
- Branch protection on `main` requires `fast`, `database` and `SonarCloud Code Analysis`, with enforcement for everyone. Unauthenticated API read.
- Manual run 44225392722 failed once on a Gradle plugin download (`foojay-resolver-convention`) and passed on re-run. That's infrastructure flakiness.

**Development readiness:** good (B+).

**Production readiness:** weak (D):
- no crash or error monitoring;
- no store build or signing pipeline;
- no iOS build;
- no rollback plan beyond migration procedures;
- Android E2E is not required per merge.

### Category 12 — Quality of AI-assisted development: **B+ (88)**

See section D. Evidence: repository plans, PR descriptions, git history, the ignored ledgers in `pantry-flow/.verification/evidence/*`, and Jira comments. All of it was produced in a process this assessor took part in.

---

## D. AI-assisted development scorecard

| Sub | Area | Score | Grade | Evidence basis |
|---|---|---:|:---:|---|
| 12.1 | Specification adherence and scope discipline | 91 | A− | Each package had an approved plan with owner decisions. Deviations are recorded as rulings in ledgers and PRs. Scope additions (PR #39 minors, the Sonar fixes) were approved first. |
| 12.2 | AI-generated code quality | 87 | B+ | Clean, strict-typed, small. Some duplication: twin providers, and a six-form setter wrapper until a Sonar finding forced the shared hook. Comment ticket noise. No hallucinated APIs found (typecheck and builds pass). |
| 12.3 | AI-generated test quality | 88 | B+ | Mutation-proven. One test pinned half of a guard until the review (KAN-85 I1). React Native string stubs. One hanging-on-regression case. |
| 12.4 | Verification and evidence integrity | 90 | A− | Failures and flakes are reported with causes. Two recorded lapses: commit `58bb9f3` was made on a red suite and its ledger first claimed "245/245", then was corrected; a coverage note overstated "unreachable", later corrected. |
| 12.5 | Human oversight and decision governance | 93 | A | The owner approves plans, pushes, PR creation scope and every Jira transition; final reviews by a separate model instance; traceable rulings. |
| 12.6 | Security and operational guardrails | 91 | A− | Credentials are read inside scripts and never printed. The hosted environment and the release APK were untouched. The required checks are enforced by GitHub, not by the agent. The stored OAuth token has broader scopes (repo, workflow) than the approved use (PR creation). |
| 12.7 | Efficiency of AI-assisted engineering | 78 | C+ | Heavy ceremony for small packages: a plan, ledger, review and multiple CI runs for 11 minors. Several redo cycles (phone setup errors, Maestro stalls, a red commit). The useful output per unit of process is moderate. Claude Code is the only agent with evidence in this period; Codex, ChatGPT and Emergent allocation is NOT VERIFIED. |

**Average:** 88 (B+).

**Supported by evidence:** 12.1, 12.4, 12.5 and 12.6 (artifacts exist). **Uncertain:** 12.7 relative to alternatives, and cross-agent allocation.

---

## E. Findings register

| ID | Title | Severity | Evidence | Impact | Recommended correction | Regression test | Jira | Blocks |
|---|---|---|---|---|---|---|---|---|
| F-01 | No password recovery | High | No reset path in `app/(auth)/login.tsx`; PF-AUTH-001 | Locked-out users can't recover without support | Implement request, email, native link and update flows | Integration plus Maestro reset journey, including an expired link | KAN-42, KAN-54–56 | Beta (conditional), production |
| F-02 | No account deletion or retention | High | Settings has only Sign out; no delete RPC | GDPR and Play policy non-compliance | Authenticated deletion with confirmation, retention disclosure | pgTAP isolation after deletion, integration | KAN-43, KAN-57–59 | Production (beta needs at least a manual request path) |
| F-03 | No iOS build or validation | High (for iOS) | PF-IOS-001; no iOS CI | iOS release impossible; VoiceOver unverified | Build and validate on a device | Maestro iOS or manual checklist | KAN-47, KAN-68–70 | iOS production |
| F-04 | Selection chips not exposed to screen readers | Medium | `components/OptionChips.tsx:27-37` has no role or state | Blind users can't tell the selected status, category or location | `accessibilityRole="radio"` (or button) plus `accessibilityState={{ selected }}`, group label | Unit test on props; TalkBack check | KAN-45 / KAN-63 | Public (accessibility gate) |
| F-05 | Status change takes 4 taps (PRD target 2–3) | Medium | Flow table, section C1 | Friction on the most frequent action | Inline status control on the row (tap the badge to cycle, or long-press), keeping the D3 prompt | Screen test plus Maestro | New (do not create in this assessment) | — |
| F-06 | No search, sort or filter in the pantry list | Medium | `app/(tabs)/index.tsx:52-62` | Finding items scales poorly beyond ~30 | Search field first, alphabetical/status sort; filters already deferred (D5) | Unit plus Maestro | Localization slice (D5) | — |
| F-07 | New high advisory (picomatch ReDoS) not reflected in a stale advisory register | Medium | `npm audit`: 66 high, 6 moderate; register 2026-11-09 says zero high | Register's own escalation rule unmet; build-tooling exposure | Reassess now; document the exposure decision; track the Expo/Jest update | Audit check in CI or a monthly review record | KAN-66 | Process (not runtime) |
| F-08 | Android E2E not a required check | Medium | Workflow `if:` limits android to dispatch, schedule or `[full-e2e]` | Native regressions can merge if the manual run is skipped | Require android on PRs that touch `app/`, `components/`, `hooks/` or `lib/`, or nightly with an issue on failure | — | — | — |
| F-09 | German content missing | Medium | `lib/i18n/de.ts` is a stub; PRD requires EN+DE | German-speaking households excluded | Localization slice | i18n completeness test | KAN-44, KAN-60–62 | Public |
| F-10 | PRD MVP scope versus slice plan inconsistency (sharing, premium) | Medium | PRD §2 against KAN-40–83 | Unclear launch scope; risk of late scope shock | Owner decision recorded in the PRD or a decision log | — | KAN-51 | Public (decision) |
| F-11 | No crash or error monitoring | Medium | No SDK in `package.json` | Beta defects invisible | Add privacy-safe crash reporting before beta | — | KAN-66 / KAN-73 | Beta (conditional), production |
| F-12 | Node tests have no per-test timeout | Low | M4 hung until killed | Slow CI failure, poor diagnostics | `--test-timeout` in `npm test` | — | — | — |
| F-13 | Pantry rows have no accessibility role or label | Low | `components/PantryItem.tsx:16` | TalkBack reads the texts without "button" | Add role and a combined label | Unit | KAN-63 | — |
| F-14 | Add Item: Return doesn't save | Low | `app/add-item.tsx` (only `autoFocus`) | Extra tap per item during the initial inventory | `onSubmitEditing` to save | Screen test | — | — |
| F-15 | CI infrastructure flake (Gradle plugin download) | Low | Run 44225392722, attempt 1 | Re-runs, wasted minutes | Gradle caching or a pinned plugin repository | — | — | — |
| F-16 | Prompt orchestration in a 307-line screen | Low | `app/edit-item/[id].tsx:131-153` | Harder to change the D3 flow | Extract a `useStatusChangeShoppingPrompt` hook | Existing prompt tests | — | — |
| F-17 | Hosted Slice 2 schema state not verified here | Info | Out of read-only scope | A beta needs the hosted `00004` | Run the documented drift check before beta | Catalog comparison | KAN-29 follow-up | Beta (conditional) |
| F-18 | Legacy `frontend/` and `backend/` scaffold in the repository | Info | Sonar bugs and reliability D come from it | Misleading quality signals | Archive or remove (own ticket) | — | PF-LEGACY-001 | — |
| F-19 | DMARC `p=none` | Info | PF-EMAIL-002 | Spoofing risk on the auth subdomain | Review reports, then enforce | — | — | Production (hardening) |

No Critical findings.

---

## F. Prioritized improvement plan

1. **Immediate correctness or security:** none required for development.
   - Before a beta: F-07 (reassess the advisory register) and F-17 (hosted drift check plus the `00004` status).
2. **High-value usability:**
   - F-04 (chip accessibility; small effort, large effect);
   - F-05 (inline status change);
   - F-06 (pantry search);
   - F-14 (Return to save);
   - F-01 (password recovery), already planned in Slice 3.
3. **Tests and coverage:**
   - F-12 (test timeout);
   - F-08 (Android E2E enforcement for app-code PRs);
   - a test-stub helper, to cut the repeated stub maps;
   - an iOS checklist when F-03 starts.
4. **Architecture and maintainability:**
   - F-16 (extract the prompt hook);
   - F-18 (remove the legacy scaffold);
   - leaving the twin providers until a third list appears.
5. **Deliberately defer:**
   - offline mode;
   - a generic HouseholdKit framework;
   - barcode and photo features;
   - premium gating until PF-PREMIUM-001 and a pricing decision.
6. **Would be over-engineering now:**
   - a repository or service layer over Supabase;
   - a global state library;
   - full mutation-testing infrastructure in CI;
   - more process documents per minor package. Instead, reduce ceremony for packages under ~10 small items: a lighter plan, and no separate Opus review when CI and mutation evidence already cover them.

---

## G. Comparison with previous baselines

No earlier graded assessment exists. The closest reference is the Slice 1.1 review (`docs/release-readiness/2026-11-10-slice11-review.md`) at `e338b0f`, 2026-11-10, which had findings but no grades. None are invented here.

- **Improvements since then:**
  - Slice 2 delivered with database-enforced rules;
  - PostgreSQL aligned to version 17 (KAN-28);
  - hosted migration history adopted (KAN-29);
  - all Sonar Blocker, Critical and Major findings in app code closed (KAN-27);
  - TalkBack error announcements (KAN-34/39/84);
  - many robustness fixes (KAN-32/33/35/36/37/38).
- **Unchanged weaknesses:** iOS (PF-IOS-001), password recovery (PF-AUTH-001), German content (PF-I18N-001), the premium audit (PF-PREMIUM-001), the populated-migration test (PF-DATA-001), and DMARC enforcement.
- **New risks:**
  - a high npm advisory (picomatch) with a stale register;
  - the PRD-versus-slice scope inconsistency, made visible by the Slice 3 backlog;
  - growing process overhead;
  - CI infrastructure flakiness.

---

## H. Final verdict

| Question | Answer |
|---|---|
| Is PantryFlow technically well engineered? | **Yes, for its scope.** It has a sound database-first design, a lean client, and strong robustness and verification. |
| Is it easy enough for an ordinary household user? | **Partly.** Core actions are clear and safe, but status updates, finding items and initial entry take more effort than the PRD targets. English only, with no password reset. Not validated with real users. |
| Does it solve its intended problems without unnecessary effort? | **Mostly.** The pantry-to-list loop works and prevents duplicates. The friction is in frequent small actions. |
| Does it correctly implement its approved specifications? | **Yes, for Slice 1.1 and Slice 2.** The PRD's broader MVP (sharing, premium, German) is not scheduled, and that needs a decision. |
| Are its tests capable of detecting meaningful regressions? | **Yes.** 7 of 7 mutations were caught, including an RLS bypass, with known limits: React Native stubs, no iOS, no timeout. |
| Is its architecture proportionate to its current scope? | **Yes.** The process overhead is disproportionate, not the code. |
| Has AI-assisted development contributed positively? | **Positively overall.** High verification rigor and traceability, at a notable process cost, with two recorded lapses that were caught and corrected. |

| Gate | Verdict | Conditions |
|---|---|---|
| Next functional slice (Slice 3) | **GO** | Owner accepts Slice 2 (KAN-6, KAN-52) and decides on sharing and premium scope (KAN-51). |
| External beta (closed, Android, invited testers) | **CONDITIONAL GO** | <ol><li>Hosted drift check and `00004` applied through the tracked path.</li><li>Crash or error reporting (F-11).</li><li>A support path for password resets and account deletion requests, ideally F-01 itself.</li><li>A privacy notice.</li><li>Advisory register reassessed (F-07).</li><li>Testers informed that the app is English only.</li></ol> |
| Android production | **NO-GO** | F-01, F-02, F-04, F-09, F-10, F-11, PF-DATA-001, store and signing pipeline. |
| iOS production | **NO-GO** | F-03, plus all Android production conditions. |
| Public production release | **NO-GO** | As above, plus a DMARC review and the premium audit before any gating. |

---

## Verification log

| Kind | Command / source | Commit | Result |
|---|---|---|---|
| Executed | `npm ci` (pantry-flow) | `ec0dbdd` | exit 0 |
| Executed | `npm run test:fast` | `ec0dbdd` | exit 0; Node 252/252, Jest 2/2, safety 1/1, tsc clean |
| Executed | `python -m unittest discover -s tools/jira -p "test_*.py"` | `ec0dbdd` | 47 OK |
| Executed | `npm run test:local` (local reset, pgTAP, integration) | `ec0dbdd` | pgTAP Files=3 Tests=65 PASS; integration 22/22 |
| Executed | `npm audit --json` / `--omit=dev` | `ec0dbdd` | 66 high / 6 moderate (61/6 prod-labelled); one high root (picomatch) |
| Executed | Mutations M1–M6 (Node suites), M7 (RLS via `test:local`) | `ec0dbdd` worktree | All caught; M4 hangs without a timeout; tree restored; local DB re-reset |
| API (read) | GitHub Actions runs on `main`; branch protection | `ec0dbdd` | Push runs green; required checks fast, database, SonarCloud |
| API (read) | SonarCloud measures, issues, hotspots | `main` | 0 vulnerabilities, 0 hotspots; app 88 Minor; 3 bugs in the legacy frontend |
| Recorded | Phone, TalkBack and Maestro evidence (KAN-34/39/84), CI runs 44211292067, 44216675581, 44225392722 | Various | As recorded in the PRs #36–#40 and the evidence folders |
| Static | Migrations, screens, providers, tests, docs, PRD | `ec0dbdd` | As cited |
| Not verified | Hosted schema state, external usability, performance measurements, iOS | — | — |
