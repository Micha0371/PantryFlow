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

## What the inspection checks

| Check | Rule |
|---|---|
| Signer | Every signer certificate of the AAB is the upload key above (`keytool -printcert -jarfile`) |
| Manifest | The bundle manifest passes the step 1 release-manifest checks: production package and scheme, version, target API 36, backup off with the data extraction rules, no cleartext, network security config or debuggable flag, only reviewed permissions and exported components |
| Backup rules | Every storage domain excluded from cloud backup and device transfer; the rules file is inside the AAB |
| JS bundle (Hermes bytecode) | Points at the hosted project; no emulator address, local Supabase port, test fixture account, test package or scheme; every embedded token has the `anon` role |
| Bundled sources (Metro source map) | No bundled file contains a local address, a `sb_secret_` prefix, a `service_role` reference, a local port, a fixture account or the test package or scheme, except the reviewed library literals listed in the builder (supabase-js 2.119.0: its `sb_secret_` prefix check and default trace targets; documentation text in functions-js, auth-js and storage-js). App source is never exempt |

**Why the source map:** Hermes stores strings back to back and may overlap them, so a raw scan of the bytecode cannot tell supabase-js's `"sb_secret_"` prefix check from a real key. The source map of the same Gradle run lists every bundled file with its source, where string boundaries exist. A secret could otherwise only enter through the two inlined `EXPO_PUBLIC_` values, which step 1 checks before the build.

**A library update** that adds or moves one of these literals fails the build until the new occurrence is reviewed and added to the builder's list.

## Trial builds

`PANTRYFLOW_RELEASE_ARCHITECTURES=arm64-v8a` builds one ABI, much faster. The artifact is named `…-trial-arm64-v8a.aab` and its record says "trial, not for upload". Trials check the builder itself; only a full build of a merged commit is uploaded.

## Reproducibility

Two trial builds of the same app source in the same folder produced the same SHA-256 (2026-11-27). Changing the native build cache folder changed it, so a rebuild matches only from the same paths. The record's source commit and SHA-256 identify the uploaded artifact.

## If the upload key is lost or exposed

Play App Signing holds the app signing key; the upload key only authenticates uploads. A lost or exposed upload key is reset through Play Console support, which takes days. Rotate it, record the new certificate fingerprint in the builder and in this document, and never reuse the old password.
