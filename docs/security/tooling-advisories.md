# Tooling advisory register

Owner: repository maintainer **Micha0371**. Last assessed: **2026-11-18** (SEC-01, KAN-102). Next review: **2026-12-01**, then the first day of every month. Also reassess on each trigger listed below. The owner records the date, audit counts and decision in this register.

## Current audit

Audit facts:
- **Date and commit:** 2026-11-18, commit `ed6b1b5` (main after PR #41).
- **Lockfile:** `pantry-flow/package-lock.json`, blob `70949b7`. It is unchanged since `0bc0bf2` (PF-EMAIL-001).
- **Environment:** Windows, Node 26.10.0, npm 11.18.0. A fresh `npm ci` was run. The audit needed no certificate workaround. CI uses Node 22; audit counts come from the registry's advisory database at query time.
- **Evidence:** kept as ignored local files in `pantry-flow/.verification/sec01-20261118/`. They are `audit.json`, `npm-ls-all.txt`, `npm-ls-picomatch.txt`, `npm-ls-glob-minimatch.txt`, `env.txt`, `export.log` and `bundle-check.txt`. They contain no tokens or registry credentials.

Locked audit: **67 high, 6 moderate, zero low/critical**.
- These are 73 affected package entries, including transitive propagation, from **three root advisories**. They are not 73 independent vulnerabilities.
- The 2026-11-09 counts (23 moderate, one low, zero high) changed without any lockfile change. The difference comes from the advisory database:
  - a new picomatch advisory was published on 2026-10-19;
  - the deepmerge advisory was withdrawn on 2026-11-16.

| Root advisory | Installed versions and paths | Exposure | Decision and remediation |
| --- | --- | --- | --- |
| [picomatch GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), high (CVSS 7.5, availability only): ReDoS through crafted single-branch repeated extglob **patterns**. GitHub marked it **withdrawn on 2026-11-18 15:38 UTC**. The withdrawal note reads "withdrawn because it is a security issue", which gives no usable reason. `npm audit` still reported it at 16:27 UTC. | **4.0.7**, the latest published release, reached through: `@expo/cli`, `@expo/metro-config`, `@parcel/watcher`, `fdir`, `tinyglobby`, `jest-haste-map`, `jest-util`, `jest-message-util`. **2.3.2**, the latest 2.x, reached through: `anymatch`, `micromatch`, `jest-util@29`. All of these are development, build and test tooling (Expo CLI, Metro, file watchers, Jest). | **Production app:** none shipped. The Android production export of `ed6b1b5` was checked through its source map: its 1,784 sources contain no picomatch, micromatch, anymatch, glob, minimatch, fdir, tinyglobby, watcher or Jest code. The only `@expo/cli` file in it is Metro's module loader `metro-require/require.js`. App code imports no glob matcher, so in the shipped app, pantry and shopping names or remote data have no path into pattern evaluation. **Build and CI:** patterns come from repository-owned Metro, Jest and watcher configuration. PR code already executes in the isolated CI runner, so a crafted pattern there adds no capability beyond what that code already has. **Local development:** I found no path where Metro dev-server request input becomes a glob pattern, but this was not exhaustively traced. Run the dev server only on trusted networks. | **Proposed:** accept, time-bounded until **2026-12-01**. Owner: Micha0371. The acceptance takes effect when the owner merges this register change. **Remediation available:** none. No patched release exists, the advisory lists no fixed version, and the installed versions are the newest of each line, so an override cannot help. **Rejected:** `npm audit`'s suggested downgrades (see "Rejected audit fixes" below). **Reassess at once** if a patched picomatch is released, if the advisory is reinstated or revised, or if exposure changes. |
| [glob GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), moderate: an AbortSignal cancellation bypass that allows traversal after a timeout. | **13.0.7**, top-level, reached through: `@expo/cli`, `@expo/fingerprint`, `@jest/reporters`, `jest-config`, `jest-runtime`. **10.5.0**, seven copies nested under Jest: `@jest/core`, `jest-runner`, `jest-snapshot`, `jest-expo`, and `test-exclude` under `@jest/reporters`, `jest-config` and `jest-runtime`. The 7.2.3 copy under the top-level `test-exclude` is outside the range. | Expo CLI and fingerprint scans, and Jest scans, of repository paths they own. Nothing relies on aborting a traversal of untrusted directories. The production bundle contains no glob code. | Remains accepted for this exposure. Owner: Micha0371. Review on 2026-12-01. The fix is 14.0.2; the latest release is 14.0.6. That is one major above 13.x and four above 10.x. Upstream has not adopted it as of 2026-11-18: the latest `jest-config` (Jest 30.5.2) and `test-exclude` (8.0.0) still require `glob` `^13.0.6`. Do not force a cross-major override without a compatibility analysis. A tested `glob` 14 override would be a separate, owner-approved dependency change, validated with the full fast, database and Android suites. Otherwise, track Expo and Jest releases that adopt it. |
| [minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate: denial of service via globparts amplification. | **10.2.6**, top-level, reached through: `@expo/fingerprint`, `glob@13.0.7`, `test-exclude@7.0.2`. **9.0.9**, nested under the glob 10.5.0 copies above. The 3.1.5 copy under the top-level `test-exclude` is outside the range. | Pattern processing in Expo and test tooling, with repository-owned patterns. Pantry names and remote application data are not passed into pattern evaluation. The production bundle contains no minimatch code. | Remains accepted for this exposure. Owner: Micha0371. Review on 2026-12-01. The fix is 11.0.1; the latest release is 11.0.9. Moving to it is a cross-major change, and the same tracking rule as glob applies. Upstream has not adopted it as of 2026-11-18: the latest `@expo/fingerprint` (0.21.10) still requires `minimatch` `^10.2.6`. Validate the fast, database and Android suites after any dependency change. |

**Rejected audit fixes.** For the three advisories, `npm audit` suggests only downgrades, which npm flags as semver-major. They would undo the SDK 58 baseline:

| Package | Suggested | Installed |
| --- | --- | --- |
| `expo` | 54.0.33 | 58.0.23 |
| `react-native` | 0.83.10 | 0.88.1 |
| `babel-preset-expo` | 55.0.25 | 58.0.24 |
| `jest-expo` | 58.0.6 | 58.0.14 |
| `@types/jest` | 28.1.8 | 30.0.0 |
| `jest` | 29.7.0 | 30.5.2 |

**No longer reported:** deepmerge [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) (low). GitHub withdrew it on 2026-11-16. deepmerge 4.3.1 is still installed; the entry would return if the advisory were reinstated.

**Escalation applied:** the register's rule ("escalate when severity becomes high") was triggered by the picomatch advisory. This reassessment is that escalation. Before any external beta invitation or distribution, BETA-01 needs a reviewed disposition. The merged register above is that disposition; no external beta has been authorized.

**Not related:** KAN-27 (Sonar cleanup, Fertig) changed no dependencies, and its Sonar findings are not advisories.

## Policy

The risk assessment concerns how packages are used, not npm's prod/dev dependency labels. Expo CLI can be a transitive production dependency in npm while still being build tooling. Do not assume a finding is harmless just because a package is tooling; check the exposure and the shipped bundle.

Keep CI read-only and without hosted Supabase management or mail credentials. PR code already executes in the isolated test runner; do not reuse that runner as an authenticated production service.

**Reassessment triggers.** Reassess on any of these:
- any lockfile change;
- a new, revised, withdrawn or reinstated advisory affecting the tree;
- a patched release for an accepted advisory;
- an exposure change, such as a feature that evaluates user-supplied patterns, or a development server exposed beyond a trusted network;
- the first day of each month;
- before any external beta invitation or distribution.

**Reassessment procedure:**
1. From `pantry-flow`, run `npm ci`, `npm audit --json` and `npm ls --all`.
2. Separate root advisories from propagated counts and trace their dependency paths.
3. Check the primary advisory and the upstream release notes, including withdrawal status.
4. Check whether flagged code ships in the production bundle: export with `--dump-sourcemap` and inspect the sources.
5. Record the audit date, environment, commit and decisions here, and keep the full output as an ignored verification artifact.

A nonzero audit exit status does not by itself establish a release blocker. Escalate before release if a finding becomes reachable from production input, if a severity becomes high or critical, or if a practical exploit affects the build or release environment. Record the decision and run the appropriate regressions. Do not silence the audit, and never run `npm audit fix --force`: here it proposes major downgrades.

## History

- **2026-11-09:** 23 moderate and one low. Root advisories: glob, minimatch and deepmerge. All accepted for tooling exposure.
- **Resolved in the SDK baseline:** the unused direct query-string dependency was removed, and the old CLI tar dependency was scoped to the patched 7.5.22.
  - Email acceptance requires CLI 2.122.1, because its local Auth 2.197.0 matches the hosted server and supports PKCE resend.
  - That CLI distributes platform binaries and no longer uses the JavaScript tar path, so the obsolete override was removed.
  - Reassess these decisions if dependency paths change.
