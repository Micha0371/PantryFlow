# Android release build (KAN-77 step 3)

How the signed Android App Bundle (AAB) for Google Play is built and checked. Written for the owner and for whoever runs the build. The builder is `pantry-flow/scripts/build-release.cjs`; its checks are tested in `pantry-flow/tests/build-release.test.cjs`.

Building an artifact does not authorize uploading or distributing it. The Play upload (KAN-77 step 4) and any tester distribution need the owner's separate approval; the distribution-trust decision is KAN-116 (B11).

## Prerequisites

- **A clean checkout of the commit to release**, normally `main` after merge. The builder refuses uncommitted changes, so the artifact maps to one commit.
- **`pantry-flow/.env`** with the hosted project's `EXPO_PUBLIC_SUPABASE_URL` and its publishable or anon key. The builder refuses another URL, a missing key, a secret key or a non-anon token, without printing the key.
- **The upload key**, created by the owner on 2026-11-27:
  - keystore `%USERPROFILE%\.pantryflow-keys\pantryflow-upload.p12` (PKCS12, alias `upload`), outside the repository, with an offline backup;
  - its password in Windows Credential Manager as `OWN/PANTRYFLOW_UPLOAD_KEY`;
  - certificate SHA-256 `72:D9:1C:AC:86:55:2C:C8:28:4B:0A:8E:DC:4A:24:B2:50:08:69:DD:56:FC:C9:28:D8:AC:62:F9:FB:76:84:A2`.
- **Java** from Android Studio: `JAVA_HOME` set to its `jbr` folder.

The password is read from Credential Manager into memory and given to Gradle only through the environment. It is never printed, logged, written to a file or passed as a command argument.

## Run

From `pantry-flow/`:

```text
node scripts/build-release.cjs
```

The builder:
1. Checks the clean tree, the `.env` values, the keystore and the release configuration (`app.json`, app source).
2. Generates the production Android project in the ignored `.verification/release-app` and switches release signing to the upload key. Debug builds keep the debug key.
3. Builds the App Bundle with Gradle (`:app:bundleRelease`) for the four standard ABIs.
4. Copies it to `.verification/release/pantryflow-<version>-<versionCode>-<commit>.aab` and inspects that exact file.
5. Writes a record next to it (`.json`, also printed): SHA-256, size, source commit, package, version, SDK levels, signer, permissions, ABIs and any problems. It exits non-zero on any problem.

A full build takes long on this machine; close memory-hungry applications first.

**Re-inspecting an existing AAB**, read-only (it builds and signs nothing): `node scripts/build-release.cjs inspect <file.aab>` runs the artifact checks below (all but the source map) and prints the SHA-256 and any problems.

## What the inspection checks

| Check | Source | Rule |
|---|---|---|
| Signer | The AAB | Every signer certificate is the upload key above (`keytool -printcert -jarfile`) |
| Manifest | The AAB's own `base/manifest/AndroidManifest.xml`, decoded from aapt2's protobuf format | The step 1 release-manifest checks: production package and scheme, version, target API 36, backup off with the data extraction rules, no cleartext, network security config or debuggable flag, only reviewed permissions and exported components |
| Backup rules | The AAB's own `base/res/xml/data_extraction_rules.xml`, decoded the same way | Every storage domain excluded from cloud backup and device transfer, nothing included |
| JS bundle (Hermes bytecode) | The AAB's own `base/assets/index.android.bundle` | Points at the hosted project; no emulator address, local Supabase port, test fixture account, test package or scheme; every embedded token has the `anon` role |
| Bundled sources | Metro's source map of the same Gradle run (the AAB carries no source map) | No bundled file contains a local address, a `sb_secret_` prefix, a `service_role` reference, a local port, a fixture account or the test package or scheme, outside the reviewed library expressions. App source is never exempt |

**Why the source map:** Hermes stores strings back to back and may overlap them, so a raw scan of the bytecode cannot tell supabase-js's `"sb_secret_"` prefix check from a real key. The source map lists every bundled file with its source, where string boundaries exist. It comes from the build folder, not the artifact; it is the map of the Gradle run that produced the artifact's bundle. A secret could otherwise only enter through the two inlined `EXPO_PUBLIC_` values, which are checked before the build.

**Reviewed library expressions** (supabase-js 2.119.0), each pinned to its exact text and number of occurrences:

| File below `node_modules` | Expression | Occurrences |
|---|---|---|
| `@supabase/supabase-js/dist/index.cjs` | `key.startsWith("sb_secret_")` (recognises the key format) | 1 |
| | `` `sb_secret_…` `` (doc comment) | 1 |
| | `targets.push("localhost", "127.0.0.1", "[::1]")` (default trace targets) | 1 |
| `@supabase/functions-js/dist/main/FunctionsClient.js` | `` `sb_secret_…` `` (doc comment) | 1 |
| `@supabase/auth-js/dist/main/GoTrueAdminApi.js` | ``Never expose your `service_role` key in the browser.`` | 16 |
| | ``Requires a `service_role` key.`` | 1 |
| `@supabase/storage-js/dist/index.cjs` | ``**Requires the `service_role` key.**`` | 2 |
| | `` `service_role` JWT `` | 2 |

Only those occurrences are exempt: the forbidden strings must not occur anywhere else in these files. A library update that adds an occurrence, or changes a count, fails the build until it is reviewed and the list updated. A test also checks the installed files against the list.

## Trial builds

`PANTRYFLOW_RELEASE_ARCHITECTURES=arm64-v8a` builds one ABI, much faster. The artifact is named `…-trial-arm64-v8a.aab` and its record says "trial, not for upload". Trials check the builder itself; only a full build of a merged commit is uploaded.

## Reproducibility

Two trial builds of the same app source in the same folder produced the same SHA-256 (2026-11-27). Changing the native build cache folder changed it, so a rebuild matches only from the same paths. The record's source commit and SHA-256 identify the uploaded artifact.

## If the upload key is lost or exposed

Play App Signing holds the app signing key; the upload key only authenticates uploads. A lost or exposed upload key is reset through Play Console support, which takes days. Rotate it, record the new certificate fingerprint in the builder and in this document, and never reuse the old password.
