'use strict';
// Release configuration of the Android beta artifact (KAN-77 step 1).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { XML } = require('@expo/config-plugins');

const root = path.resolve(__dirname, '..');
const withBackupExclusion = require('../plugins/with-backup-exclusion.cjs');
const {
  appConfigProblems, rulesProblems, manifestProblems, sourceProblems, releaseExpectations,
} = require('../scripts/release-config.cjs');

const appJson = () => JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

test('app.json is release-ready: production identity, a version code, no backup, blocked permissions and the backup plugin', () => {
  assert.deepEqual(appConfigProblems(appJson()), []);
});

// KAN-77 (owner, 2026-11-27): the Play Console app is com.householdkit.pantryflow, and Play locks
// the package at the first upload. iOS keeps its bundle ID until iOS is planned (KAN-69).
test('the Android package is the Play Console app\'s, the iOS bundle ID is unchanged, and the old Android name is rejected', () => {
  const config = appJson();
  assert.equal(config.expo.android.package, 'com.householdkit.pantryflow');
  assert.equal(config.expo.ios.bundleIdentifier, 'com.pantryflow.app');
  config.expo.android.package = 'com.pantryflow.app';
  assert.ok(appConfigProblems(config).some(p => /android\.package is com\.pantryflow\.app, expected com\.householdkit\.pantryflow/.test(p)));
});

test('each broken app.json setting is reported', () => {
  const cases = [
    [c => { c.expo.android.package = 'com.pantryflow.test'; }, /package/],
    [c => { c.expo.scheme = 'pantryflowtest'; }, /scheme/],
    [c => { delete c.expo.android.versionCode; }, /versionCode/],
    [c => { c.expo.android.versionCode = 0; }, /versionCode/],
    [c => { c.expo.android.allowBackup = true; }, /allowBackup/],
    [c => { delete c.expo.android.allowBackup; }, /allowBackup/],
    [c => { c.expo.android.usesCleartextTraffic = true; }, /usesCleartextTraffic/],
    [c => { c.expo.android.blockedPermissions = []; }, /blockedPermissions/],
    [c => { c.expo.plugins = c.expo.plugins.filter(p => p !== './plugins/with-backup-exclusion.cjs'); }, /with-backup-exclusion/],
  ];
  for (const [breakIt, expected] of cases) {
    const config = appJson();
    breakIt(config);
    const problems = appConfigProblems(config);
    assert.ok(problems.some(p => expected.test(p)), `${expected} not reported: ${JSON.stringify(problems)}`);
  }
});

test('the backup rules exclude every storage domain from cloud backup and device transfer', () => {
  assert.deepEqual(rulesProblems(withBackupExclusion.DATA_EXTRACTION_RULES), []);
});

// aapt2 stores attributes sorted by name, so the rules inside an AAB read path before domain.
test('the backup rules pass in any attribute order, as aapt2 stores them in the artifact', () => {
  const reordered = withBackupExclusion.DATA_EXTRACTION_RULES.replace(/<exclude domain="([^"]+)" path="\." \/>/g, '<exclude path="." domain="$1"/>');
  assert.notEqual(reordered, withBackupExclusion.DATA_EXTRACTION_RULES);
  assert.deepEqual(rulesProblems(reordered), []);
  assert.ok(rulesProblems(reordered.replace('<exclude path="." domain="root"/>', '<exclude path="cache" domain="root"/>')).some(p => /root/.test(p)));
});

test('weakened backup rules are reported', () => {
  const rules = withBackupExclusion.DATA_EXTRACTION_RULES;
  const cases = [
    [rules.replace(/<device-transfer>[\s\S]*<\/device-transfer>/, ''), /device-transfer/],
    [rules.replace(/<cloud-backup>[\s\S]*<\/cloud-backup>/, ''), /cloud-backup/],
    [rules.replace('<exclude domain="database" path="." />', ''), /database/],
    [rules.replace('<exclude domain="root" path="." />', '<exclude domain="root" path="cache" />'), /root/],
    [rules.replace('<cloud-backup>', '<cloud-backup>\n    <include domain="file" path="." />'), /include/],
  ];
  for (const [xml, expected] of cases) {
    const problems = rulesProblems(xml);
    assert.ok(problems.some(p => expected.test(p)), `${expected} not reported: ${JSON.stringify(problems)}`);
  }
});

test('the plugin turns off backup and points the application at the rules', async () => {
  const manifest = await XML.parseXMLAsync(
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:allowBackup="true"/></manifest>');
  withBackupExclusion.applyBackupExclusion(manifest);
  assert.equal(manifest.manifest.application[0].$['android:allowBackup'], 'false');
  assert.equal(manifest.manifest.application[0].$['android:dataExtractionRules'], '@xml/data_extraction_rules');
});

test('the plugin registers a manifest change and writes the rules file into the generated project', async () => {
  const config = withBackupExclusion({ name: 'x', slug: 'x' });
  assert.equal(typeof config.mods?.android?.manifest, 'function');
  assert.equal(typeof config.mods?.android?.dangerous, 'function');
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-rules-'));
  try {
    await config.mods.android.dangerous({ modRequest: { platformProjectRoot: projectRoot }, modResults: {} });
    const written = fs.readFileSync(path.join(projectRoot, 'app/src/main/res/xml/data_extraction_rules.xml'), 'utf8');
    assert.equal(written, withBackupExclusion.DATA_EXTRACTION_RULES);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

const goodManifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.householdkit.pantryflow" android:versionCode="1" android:versionName="0.1.0">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36" />
  <uses-permission android:name="android.permission.INTERNET" />
  <application android:name=".MainApplication" android:allowBackup="false" android:dataExtractionRules="@xml/data_extraction_rules">
    <activity android:name="com.householdkit.pantryflow.MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
      <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="pantryflow" />
      </intent-filter>
    </activity>
  </application>
</manifest>`;
const expectations = {
  package: 'com.householdkit.pantryflow', scheme: 'pantryflow', versionName: '0.1.0', minTargetSdk: 36,
  permissions: ['android.permission.INTERNET'], signaturePermissions: [],
  exported: [{ name: 'com.householdkit.pantryflow.MainActivity' }],
};

test('a release manifest with the expected settings has no problems', async () => {
  assert.deepEqual(await manifestProblems(goodManifest, expectations), []);
});

test('each unsafe merged-manifest setting is reported', async () => {
  const cases = [
    [m => m.replace('package="com.householdkit.pantryflow"', 'package="com.pantryflow.test"'), /package/],
    [m => m.replace('android:versionCode="1"', 'android:versionCode="0"'), /versionCode/],
    [m => m.replace('android:versionName="0.1.0"', 'android:versionName="0.0.1"'), /versionName/],
    [m => m.replace('android:targetSdkVersion="36"', 'android:targetSdkVersion="35"'), /targetSdk/],
    [m => m.replace('android:allowBackup="false"', 'android:allowBackup="true"'), /allowBackup/],
    [m => m.replace(' android:dataExtractionRules="@xml/data_extraction_rules"', ''), /dataExtractionRules/],
    [m => m.replace('<application ', '<application android:usesCleartextTraffic="true" '), /usesCleartextTraffic/],
    [m => m.replace('<application ', '<application android:networkSecurityConfig="@xml/nsc" '), /networkSecurityConfig/],
    [m => m.replace('<application ', '<application android:debuggable="true" '), /debuggable/],
    [m => m.replace('<application', '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />\n  <application'), /SYSTEM_ALERT_WINDOW/],
    [m => m.replace('android:scheme="pantryflow"', 'android:scheme="pantryflowtest"'), /scheme/],
    [m => m.replace('<data android:scheme="pantryflow" />', '<data android:scheme="pantryflow" />\n        <data android:scheme="pantryflowtest" />'), /unexpected scheme pantryflowtest/],
    [m => m.replace('<data android:scheme="pantryflow" />', ''), /no activity handles the pantryflow scheme/],
    [m => m.replace('</application>', '<receiver android:name="x.Leak" android:exported="true" /></application>'), /x\.Leak/],
  ];
  for (const [breakIt, expected] of cases) {
    const problems = await manifestProblems(breakIt(goodManifest), expectations);
    assert.ok(problems.some(p => expected.test(p)), `${expected} not reported: ${JSON.stringify(problems)}`);
  }
});

// The two AndroidX entries the real merged release manifest carries (2026-11-27), with their protection.
const androidxManifest = goodManifest
  .replace('<uses-permission android:name="android.permission.INTERNET" />',
    '<permission android:name="com.householdkit.pantryflow.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" android:protectionLevel="signature" />\n' +
    '  <uses-permission android:name="android.permission.INTERNET" />\n' +
    '  <uses-permission android:name="com.householdkit.pantryflow.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" />')
  .replace('</application>',
    '<receiver android:name="androidx.profileinstaller.ProfileInstallReceiver" android:exported="true" android:permission="android.permission.DUMP" /></application>');

test('the AndroidX signature permission and the DUMP-protected profile receiver are accepted', async () => {
  assert.deepEqual(await manifestProblems(androidxManifest, releaseExpectations(appJson())), []);
});

test('the AndroidX entries are reported once their protection is gone', async () => {
  const cases = [
    [androidxManifest.replace('android:protectionLevel="signature"', 'android:protectionLevel="normal"'), /DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION/],
    [androidxManifest.replace(/<permission [^>]*\/>\n/, ''), /DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION/],
    [androidxManifest.replace(' android:permission="android.permission.DUMP"', ''), /ProfileInstallReceiver/],
    [androidxManifest.replace('android.permission.DUMP', 'android.permission.INTERNET'), /ProfileInstallReceiver/],
  ];
  for (const [xml, expected] of cases) {
    const problems = await manifestProblems(xml, releaseExpectations(appJson()));
    assert.ok(problems.some(p => expected.test(p)), `${expected} not reported: ${JSON.stringify(problems)}`);
  }
});

test('release expectations come from app.json', () => {
  const config = appJson();
  const expected = releaseExpectations(config);
  assert.equal(expected.package, config.expo.android.package);
  assert.equal(expected.scheme, config.expo.scheme);
  assert.equal(expected.versionName, config.expo.version);
});

test('app source carries no local addresses, test fixtures or server secrets', () => {
  assert.deepEqual(sourceProblems(root), []);
});

test('a local address, a fixture account or a server secret in app source is reported', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-source-'));
  try {
    fs.mkdirSync(path.join(dir, 'lib'));
    const planted = {
      'a.ts': "const url = 'http://10.0.2.2:54329';",
      'b.ts': "fetch('http://127.0.0.1:54321')",
      'c.tsx': "const host = 'localhost';",
      'd.ts': "const email = 'pf.test.alice@example.com';",
      'e.ts': "const key = 'sb_secret_abc';",
      'f.ts': "const role = 'service_role';",
    };
    for (const [name, text] of Object.entries(planted)) fs.writeFileSync(path.join(dir, 'lib', name), text);
    fs.writeFileSync(path.join(dir, 'lib', 'clean.ts'), "const placeholder = 'you@example.com';");
    const problems = sourceProblems(dir);
    for (const name of Object.keys(planted)) assert.ok(problems.some(p => p.startsWith(`lib/${name}:`)), `lib/${name} not reported`);
    assert.ok(!problems.some(p => p.startsWith('lib/clean.ts')), 'the email placeholder is not a fixture');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the release target is the API level Google Play requires', () => {
  assert.equal(releaseExpectations(appJson()).minTargetSdk, 36);
});
