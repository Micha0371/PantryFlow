'use strict';
// Signed release build of the Android beta artifact (KAN-77 step 3).
// Library: environment, signing patch, JS bundle and signer checks (tests/build-release.test.cjs).
// CLI: `node scripts/build-release.cjs` from a clean checkout. It generates the production project
// (scripts/release-config.cjs), signs the App Bundle with the owner's upload key and inspects the
// exact artifact. The upload-key password is read from Windows Credential Manager into memory and
// handed to Gradle only through the environment: never printed, logged or passed as an argument.
// It makes no request to Supabase, uploads nothing and distributes nothing.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

const HOSTED_REF = 'oiqteedkfwmcertgxqga';
// The owner's upload certificate, reported by the owner on 2026-11-27 (public information).
const UPLOAD_CERT_SHA256 = '72:D9:1C:AC:86:55:2C:C8:28:4B:0A:8E:DC:4A:24:B2:50:08:69:DD:56:FC:C9:28:D8:AC:62:F9:FB:76:84:A2';
const UPLOAD_CREDENTIAL = 'OWN/PANTRYFLOW_UPLOAD_KEY';
const UPLOAD_KEYSTORE = path.join(os.homedir(), '.pantryflow-keys', 'pantryflow-upload.p12');

function decodeJwtRole(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString()).role;
  } catch {
    return undefined;
  }
}

// Problems with the public Supabase values that will be bundled. Never echoes the key.
function releaseEnvProblems(env) {
  const problems = [];
  if (env.EXPO_PUBLIC_SUPABASE_URL !== `https://${HOSTED_REF}.supabase.co`) problems.push('EXPO_PUBLIC_SUPABASE_URL is not the hosted project URL');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) problems.push('the EXPO_PUBLIC_SUPABASE_ANON_KEY key is missing');
  else if (key.startsWith('sb_secret_')) problems.push('the key is a secret key; only a publishable or anon key may be bundled');
  else if (!key.startsWith('sb_publishable_') && decodeJwtRole(key) !== 'anon') problems.push('the key is neither a publishable key nor an anon key');
  return problems;
}

const UPLOAD_SIGNING = `
        upload {
            storeFile file(System.getenv('PANTRYFLOW_UPLOAD_STORE') ?: 'missing-upload-keystore')
            storePassword System.getenv('PANTRYFLOW_UPLOAD_PASSWORD')
            keyAlias 'upload'
            keyPassword System.getenv('PANTRYFLOW_UPLOAD_PASSWORD')
        }`;

// Signs release builds with the upload key; debug builds keep the template's debug key.
function patchReleaseSigning(text) {
  const configs = text.match(/signingConfigs \{/g) || [];
  const release = /(\brelease \{[^}]*?)signingConfig signingConfigs\.debug/;
  if (configs.length !== 1 || !release.test(text)) {
    throw new Error('Unexpected signing section in app/build.gradle; refusing to sign the release build');
  }
  return text.replace('signingConfigs {', `signingConfigs {${UPLOAD_SIGNING}`)
    .replace(release, '$1signingConfig signingConfigs.upload');
}

// Strings no bundled source may contain, unless reviewed for that library file below.
const SOURCE_FORBIDDEN = [
  ['10.0.2.2', 'emulator host address 10.0.2.2'],
  ['127.0.0.1', 'local address 127.0.0.1'],
  [':54321', 'local Supabase port 54321'],
  [':54329', 'local Supabase port 54329'],
  ['pf.test.', 'test fixture account (pf.test.)'],
  ['sb_secret_', 'Supabase secret key prefix'],
  ['service_role', 'service_role reference'],
  ['com.pantryflow.test', 'test package com.pantryflow.test'],
  ['pantryflowtest', 'test scheme pantryflowtest'],
];
// Library expressions reviewed on 2026-11-27 (supabase-js 2.119.0), by path below node_modules:
// [exact text, number of occurrences]. Only these occurrences are exempt; the forbidden strings
// must not occur anywhere else in the file, and a changed count fails until it is reviewed again.
const LIBRARY_ALLOWED = {
  '@supabase/supabase-js/dist/index.cjs': [
    ['key.startsWith("sb_secret_")', 1], // isNewApiKey: recognises the key format, holds no key
    ['`sb_secret_…`', 1], // doc comment naming the key formats
    ['targets.push("localhost", "127.0.0.1", "[::1]")', 1], // default trace-propagation targets
  ],
  '@supabase/functions-js/dist/main/FunctionsClient.js': [
    ['`sb_secret_…`', 1], // doc comment naming the key formats
  ],
  // Admin API documentation; the app never calls it and bundles no admin key.
  '@supabase/auth-js/dist/main/GoTrueAdminApi.js': [
    ['Never expose your `service_role` key in the browser.', 16],
    ['Requires a `service_role` key.', 1],
  ],
  '@supabase/storage-js/dist/index.cjs': [
    ['**Requires the `service_role` key.**', 2],
    ['`service_role` JWT', 2],
  ],
};

// Removes the reviewed expressions of a library file; reports any whose count changed.
function withoutReviewed(library, content, problems) {
  let rest = content;
  for (const [expression, count] of LIBRARY_ALLOWED[library] || []) {
    const parts = rest.split(expression);
    if (parts.length - 1 !== count) {
      problems.push(`${library}: reviewed expression ${JSON.stringify(expression)} occurs ${parts.length - 1} times, reviewed ${count}; review the library change`);
    }
    rest = parts.join('');
  }
  return rest;
}

// Problems in Metro's source map: every bundled source file with its content. String boundaries
// exist here, unlike in Hermes bytecode. App source is never exempt.
function sourceMapProblems(map) {
  const modules = (map.sections || [{ map }]).flatMap(section => {
    const { sources = [], sourcesContent = [] } = section.map || {};
    return sources.map((source, index) => [source, sourcesContent[index]]);
  });
  if (modules.length === 0 || modules.some(([, content]) => typeof content !== 'string')) {
    return ['source map has no source contents for every module'];
  }
  const problems = [];
  for (const [source, content] of modules) {
    const normalized = source.replaceAll('\\', '/');
    const library = normalized.includes('/node_modules/') ? normalized.split('/node_modules/').pop() : null;
    const checked = library && LIBRARY_ALLOWED[library] ? withoutReviewed(library, content, problems) : content;
    for (const [needle, label] of SOURCE_FORBIDDEN) {
      if (checked.includes(needle)) problems.push(`${library || normalized} contains ${label}`);
    }
  }
  return problems;
}

// Decodes aapt2's protobuf XML (an AAB's manifest and XML resources) into XML text, so the
// artifact's own files go through the same checks as the generated project's.
const PROTO_ANDROID_NS = 'http://schemas.android.com/apk/res/android';

function protoFields(buffer, start, end) {
  const fields = [];
  let at = start;
  const varint = () => {
    let value = 0;
    let scale = 1;
    for (let length = 0; length < 10; length += 1) {
      if (at >= end) throw new Error('aapt2 XML is truncated');
      const byte = buffer[at++];
      value += (byte % 128) * scale;
      if (byte < 128) return value;
      scale *= 128;
    }
    throw new Error('aapt2 XML has a malformed varint');
  };
  while (at < end) {
    const key = varint();
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) fields.push({ field, value: varint() });
    else if (wire === 2) {
      const length = varint();
      fields.push({ field, start: at, end: at + length });
      at += length;
    } else if (wire === 5) at += 4;
    else if (wire === 1) at += 8;
    else throw new Error(`aapt2 XML has an unsupported wire type ${wire}`);
    if (at > end) throw new Error('aapt2 XML is truncated');
  }
  return fields;
}

const escapeXml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function protoElementToString(buffer, start, end) {
  const text = field => buffer.toString('utf8', field.start, field.end);
  let name = '';
  const attributes = [];
  const children = [];
  for (const field of protoFields(buffer, start, end)) {
    if (field.field === 1 && field.start !== undefined) {
      const declaration = Object.fromEntries(protoFields(buffer, field.start, field.end).filter(f => f.start !== undefined).map(f => [f.field, text(f)]));
      attributes.push(`xmlns:${declaration[1]}="${escapeXml(declaration[2] || '')}"`);
    } else if (field.field === 3) name = text(field);
    else if (field.field === 4) {
      const attribute = Object.fromEntries(protoFields(buffer, field.start, field.end).filter(f => f.start !== undefined && f.field <= 3).map(f => [f.field, text(f)]));
      const prefix = attribute[1] === PROTO_ANDROID_NS ? 'android:' : '';
      attributes.push(`${prefix}${attribute[2]}="${escapeXml(attribute[3] || '')}"`);
    } else if (field.field === 5) children.push(protoNodeToString(buffer, field.start, field.end));
  }
  return `<${[name, ...attributes].join(' ')}>${children.join('')}</${name}>`;
}

function protoNodeToString(buffer, start, end) {
  let xml = '';
  for (const field of protoFields(buffer, start, end)) {
    if (field.field === 1) xml += protoElementToString(buffer, field.start, field.end);
    else if (field.field === 2) xml += escapeXml(buffer.toString('utf8', field.start, field.end));
  }
  return xml;
}

function protoXmlToString(buffer) {
  return protoNodeToString(buffer, 0, buffer.length);
}

// Checked in the Hermes bytecode itself: none of these occurs in any library.
const BUNDLE_FORBIDDEN = [
  ['10.0.2.2', 'emulator host address 10.0.2.2'],
  [':54321', 'local Supabase port 54321'],
  [':54329', 'local Supabase port 54329'],
  ['pf.test.', 'test fixture account (pf.test.)'],
  ['com.pantryflow.test', 'test package com.pantryflow.test'],
  ['pantryflowtest', 'test scheme pantryflowtest'],
];

// Problems in the JS bundle (Hermes bytecode or plain JS): ASCII strings are stored as-is, but
// back to back, so library literals are checked per source file in sourceMapProblems instead.
function bundleProblems(buffer) {
  const text = buffer.toString('latin1');
  const problems = [];
  for (const [needle, label] of BUNDLE_FORBIDDEN) if (text.includes(needle)) problems.push(`bundle contains ${label}`);
  for (const match of text.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g)) {
    const role = decodeJwtRole(match[0]);
    if (role !== 'anon') problems.push(`bundle contains a token with role ${role}`);
  }
  if (!text.includes(`${HOSTED_REF}.supabase.co`)) problems.push('bundle does not point at the hosted project');
  return problems;
}

// Problems in `keytool -printcert -jarfile` output: every signer must be the upload key.
function signerProblems(printcert) {
  const fingerprints = [...printcert.matchAll(/SHA256:\s*([0-9A-F:]+)/g)].map(match => match[1]);
  if (fingerprints.length === 0) return ['no signer certificate found'];
  return fingerprints.filter(sha => sha !== UPLOAD_CERT_SHA256)
    .map(sha => `signed by ${sha}, expected the upload key ${UPLOAD_CERT_SHA256}`);
}

function artifactName(versionName, versionCode, commit, trialArchitecture) {
  const trial = trialArchitecture ? `-trial-${trialArchitecture}` : '';
  return `pantryflow-${versionName}-${versionCode}-${commit.slice(0, 7)}${trial}.aab`;
}

// Reads the upload-key password from Windows Credential Manager (UTF-8 blob) into memory.
function readUploadPassword() {
  const { spawnSync } = require('node:child_process');
  const script = `$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PfUploadCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL { public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
    public int Persist; public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName; }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, int type, int flags, out IntPtr cred);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr cred);
  public static string Read(string target) {
    IntPtr p; if (!CredRead(target, 1, 0, out p)) return null;
    try { var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
      var bytes = new byte[c.CredentialBlobSize]; Marshal.Copy(c.CredentialBlob, bytes, 0, bytes.Length);
      // cmdkey stores UTF-16; other tools store UTF-8. A password has no NUL byte.
      bool utf16 = Array.IndexOf(bytes, (byte)0) >= 0;
      return (utf16 ? System.Text.Encoding.Unicode : System.Text.Encoding.UTF8).GetString(bytes); } finally { CredFree(p); }
  }
}
'@
$value = [PfUploadCred]::Read('${UPLOAD_CREDENTIAL}')
if (-not $value) { exit 3 }
[Console]::Out.Write($value)`;
  const powershell = path.join(process.env.SystemRoot || String.raw`C:\Windows`, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout) throw new Error(`Credential ${UPLOAD_CREDENTIAL} could not be read (exit ${result.status})`);
  return result.stdout;
}

function run(command, args, options) {
  const { execFileSync } = require('node:child_process');
  return execFileSync(command, args, options);
}

const RELEASE_ARCHITECTURES = 'armeabi-v7a, arm64-v8a, x86, x86_64';

// Refuses to build from a dirty checkout, with non-hosted or non-public values, or a broken config.
function preflight(root, repo) {
  const { appConfigProblems, sourceProblems } = require('./release-config.cjs');
  const git = args => run('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  if (git(['status', '--porcelain'])) throw new Error('The checkout has uncommitted changes; build the release only from a clean commit');
  const { parseEnv } = require('node:util');
  const dotenv = path.join(root, '.env');
  const publicEnv = fs.existsSync(dotenv) ? parseEnv(fs.readFileSync(dotenv, 'utf8')) : {};
  const envProblems = releaseEnvProblems(publicEnv);
  if (envProblems.length) throw new Error(`Release environment: ${envProblems.join('; ')}`);
  if (!fs.existsSync(UPLOAD_KEYSTORE)) throw new Error(`Upload keystore not found at ${UPLOAD_KEYSTORE}`);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const configProblems = [...appConfigProblems(config), ...sourceProblems(root)];
  if (configProblems.length) throw new Error(`Release configuration: ${configProblems.join('; ')}`);
  // A trial may build one ABI (faster); the release keeps the template's four.
  const trialArchitecture = process.env.PANTRYFLOW_RELEASE_ARCHITECTURES;
  if (trialArchitecture && !['arm64-v8a', 'x86_64'].includes(trialArchitecture)) throw new Error('Unsupported trial architecture');
  return {
    commit: git(['rev-parse', 'HEAD']), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), publicEnv, config, trialArchitecture,
  };
}

// Generates the production project, signs release builds with the upload key and builds the AAB.
function buildBundle(root, repo, { publicEnv, trialArchitecture }) {
  const { prepareReleaseProject } = require('./release-config.cjs');
  const { applyWindowsNativePaths } = require('./windows-native-paths.cjs');
  let password = readUploadPassword();
  const { work, env: prebuildEnv } = prepareReleaseProject(root);
  const android = path.join(work, 'android');
  const buildFile = path.join(android, 'app/build.gradle');
  fs.writeFileSync(buildFile, patchReleaseSigning(fs.readFileSync(buildFile, 'utf8')));
  if (process.platform === 'win32') applyWindowsNativePaths(android, path.join(repo, '.cxx', 'release').replaceAll('\\', '/'));
  // Metro may hold transforms with other inlined EXPO_PUBLIC_ values from test builds.
  fs.rmSync(path.join(os.tmpdir(), 'metro-cache'), { recursive: true, force: true });
  const env = {
    ...prebuildEnv,
    EXPO_PUBLIC_SUPABASE_URL: publicEnv.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: publicEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    PANTRYFLOW_UPLOAD_STORE: UPLOAD_KEYSTORE,
    PANTRYFLOW_UPLOAD_PASSWORD: password,
  };
  const gradle = process.platform === 'win32' ? path.join(android, 'gradlew.bat') : './gradlew';
  const gradleArgs = [':app:bundleRelease', '--max-workers=2', '--no-daemon'];
  if (trialArchitecture) gradleArgs.push(`-PreactNativeArchitectures=${trialArchitecture}`);
  try {
    run(gradle, gradleArgs, { cwd: android, env, stdio: 'inherit', shell: process.platform === 'win32' });
  } finally {
    password = undefined;
    env.PANTRYFLOW_UPLOAD_PASSWORD = undefined;
  }
  return { android, built: path.join(android, 'app/build/outputs/bundle/release/app-release.aab') };
}

const ARTIFACT_ENTRIES = {
  manifest: 'base/manifest/AndroidManifest.xml',
  rules: 'base/res/xml/data_extraction_rules.xml',
  bundle: 'base/assets/index.android.bundle',
};

// Inspects only the AAB file itself: its signer, and its own manifest, backup rules and JS bundle,
// decoded from the artifact (nothing from the build folder). Usable on any AAB, read-only.
async function inspectArtifactFile(artifact, config) {
  const { manifestProblems, rulesProblems, releaseExpectations } = require('./release-config.cjs');
  const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'keytool') : 'keytool';
  const problems = [...signerProblems(run(keytool, ['-printcert', '-jarfile', artifact], { encoding: 'utf8' }))];
  const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || String.raw`C:\Windows`, 'System32', 'tar.exe') : 'bsdtar';
  const entries = new Set(run(tar, ['-tf', artifact], { encoding: 'utf8' }).split(/\r?\n/));
  const missing = Object.values(ARTIFACT_ENTRIES).filter(entry => !entries.has(entry));
  if (missing.length) return { problems: [...problems, ...missing.map(entry => `artifact has no ${entry}`)], manifestXml: null };
  const extract = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-release-artifact-'));
  try {
    run(tar, ['-xf', artifact, '-C', extract, ...Object.values(ARTIFACT_ENTRIES)]);
    const read = entry => fs.readFileSync(path.join(extract, entry));
    const manifestXml = protoXmlToString(read(ARTIFACT_ENTRIES.manifest));
    problems.push(
      ...await manifestProblems(manifestXml, releaseExpectations(config)),
      ...rulesProblems(protoXmlToString(read(ARTIFACT_ENTRIES.rules))),
      ...bundleProblems(read(ARTIFACT_ENTRIES.bundle)),
    );
    return { problems, manifestXml };
  } finally {
    fs.rmSync(extract, { recursive: true, force: true });
  }
}

// The artifact checks plus the bundled sources. The AAB carries no source map, so the sources
// come from Metro's map of the same Gradle run that produced the artifact's bundle.
async function inspectArtifact(android, artifact, config) {
  const { problems, manifestXml } = await inspectArtifactFile(artifact, config);
  const packagerMap = path.join(android, 'app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map');
  problems.push(...sourceMapProblems(JSON.parse(fs.readFileSync(packagerMap, 'utf8'))));
  return { problems, manifestXml };
}

async function build() {
  const { XML } = require('@expo/config-plugins');
  const root = path.resolve(__dirname, '..').replace(/^[a-z](?=:)/, drive => drive.toUpperCase());
  const repo = path.resolve(root, '..');
  const checked = preflight(root, repo);
  const { android, built } = buildBundle(root, repo, checked);
  const { config, commit, trialArchitecture } = checked;
  const name = artifactName(config.expo.version, config.expo.android.versionCode, commit, trialArchitecture);
  const outDir = path.join(root, '.verification/release');
  fs.mkdirSync(outDir, { recursive: true });
  const artifact = path.join(outDir, name);
  fs.copyFileSync(built, artifact);
  const { problems, manifestXml } = await inspectArtifact(android, artifact, config);

  // With entries missing there is no manifest; the record still lists the problems.
  const { manifest } = manifestXml ? await XML.parseXMLAsync(manifestXml) : { manifest: { $: {} } };
  const sdk = (manifest['uses-sdk'] || [])[0]?.$ || {};
  const bytes = fs.readFileSync(artifact);
  const record = {
    artifact: name,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    sourceCommit: commit,
    branch: checked.branch,
    package: manifest.$.package,
    versionName: manifest.$['android:versionName'],
    versionCode: manifest.$['android:versionCode'],
    minSdk: sdk['android:minSdkVersion'],
    targetSdk: sdk['android:targetSdkVersion'],
    signer: UPLOAD_CERT_SHA256,
    hostedProject: HOSTED_REF,
    permissions: (manifest['uses-permission'] || []).map(entry => entry.$['android:name']),
    architectures: trialArchitecture ? `${trialArchitecture} only (trial, not for upload)` : RELEASE_ARCHITECTURES,
    builtAt: new Date().toISOString(),
    problems,
  };
  fs.writeFileSync(path.join(outDir, name.replace(/\.aab$/, '.json')), `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify(record, null, 2));
  if (problems.length) process.exitCode = 1;
}

// `inspect <file.aab>`: read-only artifact checks of an existing AAB; builds and signs nothing.
async function inspectOnly(artifact) {
  const root = path.resolve(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const { problems } = await inspectArtifactFile(path.resolve(artifact), config);
  const sha256 = createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
  console.log(JSON.stringify({ artifact: path.basename(artifact), sha256, problems }, null, 2));
  if (problems.length) process.exitCode = 1;
}

if (require.main === module) {
  const [command, file] = process.argv.slice(2);
  if (process.argv.length === 2) {
    build().catch(error => { console.error(error.message); process.exitCode = 1; });
  } else if (command === 'inspect' && file && process.argv.length === 4) {
    inspectOnly(file).catch(error => { console.error(error.message); process.exitCode = 1; });
  } else {
    console.error('Usage: node scripts/build-release.cjs [inspect <file.aab>]');
    process.exitCode = 2;
  }
}

module.exports = {
  releaseEnvProblems, patchReleaseSigning, bundleProblems, sourceMapProblems, signerProblems, artifactName,
  protoXmlToString, LIBRARY_ALLOWED, HOSTED_REF, UPLOAD_CERT_SHA256, UPLOAD_CREDENTIAL, UPLOAD_KEYSTORE,
};
