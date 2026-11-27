'use strict';
// Signed release build of the Android beta artifact (KAN-77 step 3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  releaseEnvProblems, patchReleaseSigning, bundleProblems, sourceMapProblems, signerProblems, artifactName,
  HOSTED_REF, UPLOAD_CERT_SHA256,
} = require('../scripts/build-release.cjs');
const { applyWindowsNativePaths } = require('../scripts/windows-native-paths.cjs');

const url = `https://${HOSTED_REF}.supabase.co`;
const jwt = payload => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'c2lnbmF0dXJl'].join('.');

test('the upload certificate fingerprint is the one the owner reported (2026-11-27)', () => {
  assert.equal(UPLOAD_CERT_SHA256,
    '72:D9:1C:AC:86:55:2C:C8:28:4B:0A:8E:DC:4A:24:B2:50:08:69:DD:56:FC:C9:28:D8:AC:62:F9:FB:76:84:A2');
});

test('the hosted project and a public key pass the environment check', () => {
  assert.deepEqual(releaseEnvProblems({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc' }), []);
  assert.deepEqual(releaseEnvProblems({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) }), []);
});

test('a local or other project, a missing key, a secret key or an admin token is refused without echoing the key', () => {
  const secretish = 'sb_secret_DO_NOT_ECHO';
  const cases = [
    [{ EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc' }, /URL/],
    [{ EXPO_PUBLIC_SUPABASE_URL: 'https://otherproject.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abc' }, /URL/],
    [{ EXPO_PUBLIC_SUPABASE_URL: url }, /key is missing/],
    [{ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: secretish }, /secret/],
    [{ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) }, /anon/],
    [{ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'not-a-key' }, /anon/],
  ];
  for (const [env, expected] of cases) {
    const problems = releaseEnvProblems(env);
    assert.ok(problems.some(p => expected.test(p)), `${expected} not reported: ${JSON.stringify(problems)}`);
    assert.ok(!problems.join(' ').includes('DO_NOT_ECHO'), 'a key value was echoed');
  }
});

const templateGradle = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

test('release builds are signed with the upload key from the environment; debug builds keep the debug key', () => {
  const patched = patchReleaseSigning(templateGradle);
  const release = patched.slice(patched.indexOf('        release {'));
  const debugBuildType = patched.slice(patched.indexOf('    buildTypes {'), patched.indexOf('        release {'));
  assert.match(release, /signingConfig signingConfigs\.upload/);
  assert.doesNotMatch(release, /signingConfigs\.debug/);
  assert.match(debugBuildType, /signingConfig signingConfigs\.debug/);
  assert.match(patched, /upload \{[\s\S]*storeFile file\(System\.getenv\('PANTRYFLOW_UPLOAD_STORE'\)/);
  assert.match(patched, /storePassword System\.getenv\('PANTRYFLOW_UPLOAD_PASSWORD'\)/);
  assert.match(patched, /keyAlias 'upload'/);
  const upload = patched.match(/upload \{[\s\S]*?\n\s*\}/)[0];
  assert.doesNotMatch(upload, /Password '/, 'no literal password in the upload signing config');
});

test('a template the signing patch does not recognise stops the build', () => {
  assert.throws(() => patchReleaseSigning(templateGradle.replace('signingConfigs {', 'signingConfigs{')), /signing/);
  assert.throws(() => patchReleaseSigning(templateGradle.replace(/release \{[\s\S]*?signingConfig signingConfigs\.debug/, 'release {')), /signing/);
});

test('a bundle pointing at the hosted project with a public key passes', () => {
  const bundle = Buffer.from(`var a="${url}";var b="sb_publishable_abc";var c="http://localhost";`);
  assert.deepEqual(bundleProblems(bundle), []);
});

// Hermes packs its strings back to back, so a raw scan cannot tell supabase-js's `sb_secret_`
// prefix check or its `127.0.0.1` trace target from a real value: those are checked per source
// file in the source map instead (sourceMapProblems).
test('the bytecode scan leaves the library literals sb_secret_ and 127.0.0.1 to the source-map check', () => {
  const packed = Buffer.from(`${url}sb_secret_isNewApiKey_prefix_check127.0.0.10.x-http-method-override`);
  assert.deepEqual(bundleProblems(packed), []);
});

test('local addresses, test identities and admin tokens in the bundle are reported', () => {
  const base = `var a="${url}";`;
  const cases = [
    ['var x="http://10.0.2.2:54329";', /10\.0\.2\.2/],
    ['var x="localhost:54321";', /54321/],
    ['var x=":54329";', /54329/],
    ['var x="pf.test.alice@example.com";', /fixture/],
    ['var x="com.pantryflow.test";', /test package/],
    ['var x="pantryflowtest://";', /test scheme/],
    [`var x="${jwt({ role: 'service_role' })}";`, /service_role/],
  ];
  for (const [text, expected] of cases) {
    const problems = bundleProblems(Buffer.from(base + text));
    assert.ok(problems.some(p => expected.test(p)), `${expected} not reported: ${JSON.stringify(problems)}`);
  }
  assert.ok(bundleProblems(Buffer.from('var a="https://otherproject.supabase.co";')).some(p => /hosted project/.test(p)));
});

// Metro source map shape: one section per module, each with sources and their content.
const sourceMap = modules => ({
  version: 3,
  sections: modules.map(([source, content]) => ({ offset: { line: 0, column: 0 }, map: { version: 3, sources: [source], sourcesContent: [content] } })),
});
const NM = 'C:/repo/pantry-flow/node_modules/';

test('the reviewed library literals pass the source-map check', () => {
  const map = sourceMap([
    [`${NM}@supabase/supabase-js/dist/index.cjs`, 'key.startsWith("sb_secret_"); targets.push("localhost", "127.0.0.1", "[::1]");'],
    [`${NM}@supabase/functions-js/dist/main/FunctionsClient.js`, '/* `sb_secret_…` is not sent as a Bearer token */'],
    [`${NM}@supabase/auth-js/dist/main/GoTrueAdminApi.js`, '// requires the service_role key'],
    [`${NM}@supabase/storage-js/dist/index.cjs`, '// service_role'],
    ['C:/repo/pantry-flow/lib/supabase.ts', 'createClient(url, key)'],
  ]);
  assert.deepEqual(sourceMapProblems(map), []);
});

test('a forbidden string in app source or in an unreviewed library is reported with its file', () => {
  const cases = [
    ['C:/repo/pantry-flow/lib/supabase.ts', 'const key = "sb_secret_abc";', /lib\/supabase\.ts.*secret/],
    ['C:/repo/pantry-flow/lib/supabase.ts', 'const u = "http://127.0.0.1:54321";', /lib\/supabase\.ts.*127\.0\.0\.1/],
    ['C:/repo/pantry-flow/app/x.tsx', 'role: "service_role"', /app\/x\.tsx.*service_role/],
    ['C:/repo/pantry-flow/lib/a.ts', '"http://10.0.2.2"', /10\.0\.2\.2/],
    ['C:/repo/pantry-flow/lib/a.ts', '"pf.test.bob@example.com"', /fixture/],
    ['C:/repo/pantry-flow/lib/a.ts', '"com.pantryflow.test"', /test package/],
    ['C:/repo/pantry-flow/lib/a.ts', '"http://host:54321"', /54321/],
    ['C:/repo/pantry-flow/lib/a.ts', '"http://host:54329"', /54329/],
    ['C:/repo/pantry-flow/lib/a.ts', '"pantryflowtest://callback"', /test scheme/],
    // The allowlist covers installed libraries only, not a file outside node_modules with the same path.
    ['@supabase/supabase-js/dist/index.cjs', 'key.startsWith("sb_secret_")', /supabase-js.*secret/],
    [`${NM}some-lib/index.js`, '"sb_secret_"', /some-lib\/index\.js.*secret/],
    [`${NM}@supabase/supabase-js/dist/index.cjs`, '"service_role"', /supabase-js.*service_role/],
  ];
  for (const [source, content, expected] of cases) {
    const problems = sourceMapProblems(sourceMap([[source, content]]));
    assert.ok(problems.some(p => expected.test(p)), `${expected} not reported: ${JSON.stringify(problems)}`);
  }
});

test('a source map without source contents is reported, not passed', () => {
  assert.ok(sourceMapProblems({ version: 3, sections: [] }).some(p => /no source contents/.test(p)));
  assert.ok(sourceMapProblems(sourceMap([['C:/repo/pantry-flow/lib/a.ts', null]])).some(p => /no source contents/.test(p)));
});

const printcert = sha => `Signer #1:

Certificate #1:
Owner: CN=PantryFlow upload key
Issuer: CN=PantryFlow upload key
Certificate fingerprints:
\t SHA1: 00:11
\t SHA256: ${sha}
Signature algorithm name: SHA384withRSA
`;

test('an artifact signed only by the upload key passes the signer check', () => {
  assert.deepEqual(signerProblems(printcert(UPLOAD_CERT_SHA256)), []);
});

test('an unsigned artifact, another key or a second signer is reported', () => {
  const other = UPLOAD_CERT_SHA256.replace('72:D9', '00:00');
  assert.ok(signerProblems('Not a signed jar file').some(p => /no signer/.test(p)));
  assert.ok(signerProblems(printcert(other)).some(p => /00:00/.test(p)));
  assert.ok(signerProblems(printcert(UPLOAD_CERT_SHA256) + printcert(other).replace('Signer #1', 'Signer #2')).some(p => /00:00/.test(p)));
});

test('the artifact name carries version, version code and source commit', () => {
  assert.equal(artifactName('0.1.0', 1, '30a3e4c0123456789'), 'pantryflow-0.1.0-1-30a3e4c.aab');
});

test('a single-ABI trial artifact is named as a trial so it is never mistaken for the upload', () => {
  assert.equal(artifactName('0.1.0', 1, '30a3e4c0123456789', 'arm64-v8a'), 'pantryflow-0.1.0-1-30a3e4c-trial-arm64-v8a.aab');
});

test('Windows native paths: the shared patch writes what the e2e builder wrote inline before', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-native-'));
  try {
    fs.mkdirSync(path.join(dir, 'app'));
    fs.writeFileSync(path.join(dir, 'app/build.gradle'), 'apply plugin: "x"\nandroid {\n    ndkVersion "1"\n}\n');
    fs.writeFileSync(path.join(dir, 'build.gradle'), 'buildscript {}\n');
    applyWindowsNativePaths(dir, 'C:/repo/.cxx');
    assert.equal(fs.readFileSync(path.join(dir, 'app/build.gradle'), 'utf8'),
      "apply plugin: \"x\"\nandroid {\n    externalNativeBuild { cmake { buildStagingDirectory file('C:/repo/.cxx/app') } }\n" +
      "    defaultConfig { externalNativeBuild { cmake { arguments '-DCMAKE_OBJECT_PATH_MAX=250' } } }\n    ndkVersion \"1\"\n}\n");
    assert.equal(fs.readFileSync(path.join(dir, 'build.gradle'), 'utf8'), `buildscript {}

// Windows test-build cache paths; no installed package sources are modified.
subprojects { nativeProject ->
    nativeProject.plugins.withId('com.android.library') {
        nativeProject.android {
            externalNativeBuild { cmake {
                buildStagingDirectory file('C:/repo/.cxx/' + Integer.toHexString(nativeProject.path.hashCode()))
            } }
            defaultConfig { externalNativeBuild { cmake {
                arguments '-DCMAKE_OBJECT_PATH_MAX=250'
            } } }
        }
    }
}
`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
