# Hosted operations with Supabase CLI 3

**Status:** guide, 2026-11-28. Written after the local and CI pin moved to CLI 3.2.0 (#94). This guide authorizes no hosted operation. Every hosted read or change still needs the owner's approval for that exact operation, and the hosted Auth password change (KAN-82) stays on HOLD until the owner approves it separately.

Hosted project: `PantryFlow_Emergent`, `oiqteedkfwmcertgxqga`.

## 1. What changed for hosted commands

- **Local by default.** `db query`, `db push`, `db pull`, `migration list` and `migration repair` target the **local** stack unless you pass `--remote`. A command copied from a CLI 2 runbook without its target flag silently reads or changes the local stack.
- **One target flag.** `--remote=<ref>` replaces `--linked --project-ref <ref>` and `--db-url`. The old flags still run in 3.2.0, print a deprecation warning, are hidden from help, and will go in a later major version.
- **Consent for every hosted change.** `db push`, `migration repair` and every other command that changes a hosted project now asks first. The default answer is **No**, and an unattended run fails unless `--yes` is passed. A `y` piped on stdin no longer counts.
- **Read-only queries need no confirmation.** `db query --read-only` runs in a read-only transaction, and a hosted target then needs no consent.
- **Environment overrides.** Flags, `SUPABASE_*` shell variables and project `.env` files now override `config.toml`. Keep hosted work in an isolated workdir with no `.env` file, and set no `SUPABASE_*` variables.

## 2. Rules for every hosted command

1. **Isolated workdir.** Use `--workdir <isolated workdir>`, never the repository's `pantry-flow/` folder. Never run `supabase link`; the rule from the baseline procedure still holds.
2. **Explicit target.** Always pass `--remote=oiqteedkfwmcertgxqga`. Never use bare `--remote`, which means "the linked project".
3. **Check the target line before trusting any output.** CLI 3 prints `Target: …` once on stderr. If it doesn't name `oiqteedkfwmcertgxqga`, stop: the output isn't hosted evidence.
4. **Reads are `--read-only`.** Every hosted query that should not write carries `--read-only`, so a mistaken statement fails instead of changing data.
5. **Changes are confirmed in person.** The owner answers the consent prompt for each hosted change. Don't pre-supply `--yes`. The CLI 2 runs of 00004 (`hosted-shopping-migration.md`) passed `--yes`; with CLI 3 the prompt is the last check before a hosted change, so keep it.
6. **Never `supabase config push`.** It would push this repository's local test configuration to hosted, including localhost URLs, local mail and the confirmation settings, plus any `SUPABASE_*` variables. Hosted Auth settings change only through the dashboard (section 4).

## 3. Command forms

| Purpose | CLI 2 form (historical records) | CLI 3 form |
|---|---|---|
| Read-only query | `db query --linked --project-ref oiqteedkfwmcertgxqga --workdir <wd> --file <f> --output-format json` | `db query --remote=oiqteedkfwmcertgxqga --read-only --workdir <wd> --file <f> --output-format json` |
| Migration ledger | `migration list --linked --project-ref oiqteedkfwmcertgxqga --workdir <wd>` | `migration list --remote=oiqteedkfwmcertgxqga --workdir <wd>` |
| Push plan only | `db push --linked --project-ref … --dry-run` | `db push --remote=oiqteedkfwmcertgxqga --workdir <wd> --skip-vault --dry-run` |
| Apply migrations (owner-approved, confirmed at the prompt) | `db push --linked --project-ref … --skip-vault --yes` | `db push --remote=oiqteedkfwmcertgxqga --workdir <wd> --skip-vault` |
| Repair the ledger (owner-approved, confirmed at the prompt) | `migration repair … --linked --project-ref …` | `migration repair <versions> --status applied --remote=oiqteedkfwmcertgxqga --workdir <wd>` |
| Local query | `db query --local --file <f>` | `db query --file <f>` (`--local` only warns now) |

Checked against `--help` of the pinned CLI 3.2.0; no hosted command was run for this guide. Run them through `node node_modules/supabase/dist/supabase.js` from `pantry-flow/`, as before.

**Historical records stay as executed.** `hosted-baseline-adoption.md`, `profile-baseline-reconciliation.md`, `hosted-shopping-migration.md` and `2026-11-21-sec02-hosted-drift-check.md` record CLI 2 commands that ran on their dates. They aren't templates. Use the CLI 3 forms above for any new run.

## 4. Hosted Auth password policy (KAN-82)

**HOLD until the owner approves this exact change.** It sets the hosted minimum to the approved policy, 15 characters with no character rules (KAN-81). The app (#95) already checks 15 code points before sending, and hosted Auth v2.198.0 counts the minimum in code points too (FV-A1, 2026-11-21). Per the password spec §2.6, the app's new hint must not reach testers before the server enforces it. So no release build with #95 goes to testers before this change and its read-back.

| Step | Who | Action | Check |
|---|---|---|---|
| 1 | Owner | Approve the exact change: minimum password length 15, no required characters; leaked-password protection unavailable on Free (B2 deviation) | Approval recorded on KAN-82 |
| 2 | Owner | **Before** read-back in the dashboard (Authentication, password settings): minimum length, required characters, leaked-password protection, plus the Auth version and the "require current password" setting (spec P07) | Cropped screenshots, no keys or user data, attached to KAN-82 |
| 3 | Owner | Set the minimum to **15** and required characters to **none**. Nothing else changes | — |
| 4 | Owner | **After** read-back, the same screens as step 2 | Only the two values changed |
| 5 | Agent, with approval | Rejected-only check through the public sign-up API with the anon key: 14 ASCII characters and 8 × `ä` (16 bytes), each with a new reserved `pf.test.kan82.hosted.*` address | Both **422 `weak_password`, reason `length`**. A rejected sign-up creates no account and sends no email: in Auth v2.198.0 the password check runs in `validateSignupParams`, before the transaction that creates the user and sends the confirmation (`internal/api/signup.go`) |
| 6 | Owner decision | Accepted-side check, a 15-character sign-up. It creates an unconfirmed account and sends a confirmation email, so it runs only if the owner wants it, and the owner deletes that account in the dashboard afterwards | Account deleted; recorded on KAN-82 |
| 7 | Agent | Record the result on KAN-82: date, values before and after, step 5 outcomes, no passwords and no addresses beyond the reserved pattern | — |

**Rollback:** set the values back to the step 2 read-back in the dashboard, then repeat step 4.

**Stop if:**
- the step 2 read-back differs from FV-A1, for example a different Auth version
- step 5 returns anything other than 422 `weak_password` with reason `length`

Report to the owner before going further.
