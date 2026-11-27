'use strict';
// Release configuration checks for the Android beta artifact (KAN-77).
// Library: app.json, backup rules, merged manifest and app source checks (tests/release-config.test.cjs).
// CLI: `node scripts/release-config.cjs inspect` generates the production Android project in an
// ignored workspace, lets Gradle merge the release manifest and checks the result. It builds no
// APK, signs nothing and makes no network request to Supabase.
const fs = require('node:fs');
const path = require('node:path');
const { XML } = require('@expo/config-plugins');
const { DOMAINS, RULES_RESOURCE } = require('../plugins/with-backup-exclusion.cjs');

const PRODUCTION = { package: 'com.pantryflow.app', scheme: 'pantryflow' };
const BACKUP_PLUGIN = './plugins/with-backup-exclusion.cjs';
// Expo's template asks for these; the app uses none of them.
const BLOCKED_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
];
// Reviewed permissions of the merged release manifest (KAN-77 step 1, 2026-11-27).
// A new one fails the inspection until it is reviewed and added here.
const ALLOWED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.VIBRATE',
];
// The app's own AndroidX permission (androidx.core, for receivers registered as not exported);
// accepted only while it is declared at signature level, so other apps cannot hold it.
const SIGNATURE_PERMISSIONS = appPackage => [`${appPackage}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`];
// Exported components of the merged release manifest, reviewed the same way. `permission`: the
// permission a caller must hold; the component is accepted only while it carries it.
const ALLOWED_EXPORTED = appPackage => [
  { name: `${appPackage}.MainActivity` },
  // AndroidX profile installer: only the system or the adb shell holds DUMP.
  { name: 'androidx.profileinstaller.ProfileInstallReceiver', permission: 'android.permission.DUMP' },
];
// Google Play's target API level for new apps and updates: Android 16 (API 36) since 2026-08-31
// (developer.android.com/google/play/requirements/target-sdk, checked 2026-11-27).
const MIN_TARGET_SDK = 36;
const SOURCE_FOLDERS = ['app', 'components', 'hooks', 'lib', 'plugins'];
const SOURCE_FILE = /\.(ts|tsx|js|jsx|cjs|mjs)$/;
const SOURCE_PATTERNS = [
  [/\blocalhost\b/, 'local address (localhost)'],
  [/\b127\.0\.0\.1\b/, 'local address (127.0.0.1)'],
  [/\b10\.0\.2\.2\b/, 'emulator host address (10.0.2.2)'],
  [/\bpf\.test\.[a-z0-9.-]*@/i, 'test fixture account'],
  [/\bsb_secret_/, 'Supabase secret key'],
  [/\bservice_role\b/, 'service role reference'],
];

function appConfigProblems(config) {
  const expo = config.expo || {};
  const android = expo.android || {};
  const problems = [];
  if (android.package !== PRODUCTION.package) problems.push(`android.package is ${android.package}, expected ${PRODUCTION.package}`);
  if (expo.scheme !== PRODUCTION.scheme) problems.push(`scheme is ${expo.scheme}, expected ${PRODUCTION.scheme}`);
  if (!Number.isInteger(android.versionCode) || android.versionCode < 1) problems.push('android.versionCode must be a positive integer');
  if (android.allowBackup !== false) problems.push('android.allowBackup must be false');
  if (android.usesCleartextTraffic === true) problems.push('android.usesCleartextTraffic must not be true in the production config');
  const blocked = android.blockedPermissions || [];
  for (const permission of BLOCKED_PERMISSIONS) {
    if (!blocked.includes(permission)) problems.push(`android.blockedPermissions is missing ${permission}`);
  }
  if (!(expo.plugins || []).includes(BACKUP_PLUGIN)) problems.push(`plugins must include ${BACKUP_PLUGIN} (with-backup-exclusion)`);
  return problems;
}

function rulesProblems(xml) {
  const problems = [];
  if (/<include\b/.test(xml)) problems.push('backup rules must not include anything');
  for (const section of ['cloud-backup', 'device-transfer']) {
    const body = xml.match(new RegExp(`<${section}\\b[^>]*>([\\s\\S]*?)</${section}>`));
    if (!body) { problems.push(`backup rules have no <${section}> section`); continue; }
    const excluded = new Set([...body[1].matchAll(/<exclude\s+domain="([^"]+)"\s+path="\."\s*\/>/g)].map(m => m[1]));
    for (const domain of DOMAINS) {
      if (!excluded.has(domain)) problems.push(`<${section}> does not exclude all of domain ${domain}`);
    }
  }
  return problems;
}

function releaseExpectations(config) {
  return {
    package: config.expo.android.package,
    scheme: config.expo.scheme,
    versionName: config.expo.version,
    minTargetSdk: MIN_TARGET_SDK,
    permissions: ALLOWED_PERMISSIONS,
    signaturePermissions: SIGNATURE_PERMISSIONS(config.expo.android.package),
    exported: ALLOWED_EXPORTED(config.expo.android.package),
  };
}

const COMPONENTS = ['activity', 'activity-alias', 'service', 'receiver', 'provider'];

async function manifestProblems(xml, expected) {
  const { manifest } = await XML.parseXMLAsync(xml);
  const attrs = manifest.$ || {};
  const application = (manifest.application || [])[0] || { $: {} };
  const app = application.$ || {};
  const problems = [];
  if (attrs.package !== expected.package) problems.push(`package is ${attrs.package}, expected ${expected.package}`);
  const versionCode = Number(attrs['android:versionCode']);
  if (!Number.isInteger(versionCode) || versionCode < 1) problems.push(`versionCode is ${attrs['android:versionCode']}`);
  if (attrs['android:versionName'] !== expected.versionName) problems.push(`versionName is ${attrs['android:versionName']}, expected ${expected.versionName}`);
  const targetSdk = Number(((manifest['uses-sdk'] || [])[0]?.$ || {})['android:targetSdkVersion']);
  if (!(targetSdk >= expected.minTargetSdk)) problems.push(`targetSdkVersion is ${targetSdk}, Google Play needs at least ${expected.minTargetSdk}`);
  if (app['android:allowBackup'] !== 'false') problems.push(`allowBackup is ${app['android:allowBackup']}, expected false`);
  if (app['android:dataExtractionRules'] !== RULES_RESOURCE) problems.push(`dataExtractionRules is ${app['android:dataExtractionRules']}, expected ${RULES_RESOURCE}`);
  if (app['android:usesCleartextTraffic'] === 'true') problems.push('usesCleartextTraffic is true');
  if (app['android:networkSecurityConfig']) problems.push(`networkSecurityConfig ${app['android:networkSecurityConfig']} is not reviewed`);
  if (app['android:debuggable'] === 'true') problems.push('debuggable is true');
  const declared = new Map((manifest.permission || []).map(entry => [entry.$['android:name'], entry.$['android:protectionLevel']]));
  for (const entry of manifest['uses-permission'] || []) {
    const name = entry.$['android:name'];
    if (expected.permissions.includes(name)) continue;
    if (expected.signaturePermissions.includes(name)) {
      if (declared.get(name) !== 'signature') problems.push(`permission ${name} is not declared at signature level`);
      continue;
    }
    problems.push(`permission ${name} is not reviewed`);
  }
  const schemes = [];
  for (const kind of COMPONENTS) {
    for (const component of application[kind] || []) {
      const name = component.$['android:name'];
      if (component.$['android:exported'] === 'true') {
        const reviewed = expected.exported.find(allowed => allowed.name === name);
        if (!reviewed) problems.push(`exported ${kind} ${name} is not reviewed`);
        else if (reviewed.permission && component.$['android:permission'] !== reviewed.permission) {
          problems.push(`exported ${kind} ${name} is not protected by ${reviewed.permission}`);
        }
      }
      for (const filter of component['intent-filter'] || []) {
        for (const data of filter.data || []) if (data.$['android:scheme']) schemes.push(data.$['android:scheme']);
      }
    }
  }
  if (!schemes.includes(expected.scheme)) problems.push(`no activity handles the ${expected.scheme} scheme`);
  for (const scheme of schemes) {
    if (scheme !== expected.scheme && !['http', 'https'].includes(scheme)) problems.push(`unexpected scheme ${scheme}`);
  }
  return problems;
}

function filesBelow(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && SOURCE_FILE.test(entry.name))
    .map(entry => path.join(entry.parentPath, entry.name));
}

function sourceProblems(root) {
  const problems = [];
  for (const folder of SOURCE_FOLDERS) {
    for (const file of filesBelow(path.join(root, folder))) {
      const text = fs.readFileSync(file, 'utf8');
      const relative = path.relative(root, file).split(path.sep).join('/');
      for (const [pattern, label] of SOURCE_PATTERNS) if (pattern.test(text)) problems.push(`${relative}: ${label}`);
    }
  }
  return problems;
}

// Generates the production Android project (unchanged app.json) in .verification/release-app.
// Returns the workspace and the environment used (no Supabase values).
function prepareReleaseProject(root) {
  const { execFileSync } = require('node:child_process');
  const work = path.join(root, '.verification/release-app');
  if (!work.startsWith(path.resolve(root, '.verification') + path.sep)) throw new Error('Unsafe release workspace');
  fs.mkdirSync(work, { recursive: true });
  for (const name of [...SOURCE_FOLDERS, 'android']) fs.rmSync(path.join(work, name), { recursive: true, force: true });
  for (const name of SOURCE_FOLDERS) fs.cpSync(path.join(root, name), path.join(work, name), { recursive: true });
  for (const name of ['app.json', 'package.json', 'babel.config.js', 'tsconfig.json']) fs.copyFileSync(path.join(root, name), path.join(work, name));
  if (!fs.existsSync(path.join(work, 'node_modules'))) {
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(work, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  }
  // No Supabase values: generating the project and merging the manifest needs none.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('EXPO_PUBLIC_')));
  Object.assign(env, { EXPO_NO_DOTENV: '1', CI: '1' });
  execFileSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'], { cwd: work, env, stdio: 'inherit' });
  return { work, env };
}

// Returns the merged release manifest and the generated backup rules of that project.
function mergeReleaseManifest(root) {
  const { execFileSync } = require('node:child_process');
  const { work, env } = prepareReleaseProject(root);
  const gradle = process.platform === 'win32' ? path.join(work, 'android/gradlew.bat') : './gradlew';
  execFileSync(gradle, [':app:processReleaseMainManifest', '--max-workers=2', '--no-daemon'], {
    cwd: path.join(work, 'android'), env, stdio: 'inherit', shell: process.platform === 'win32',
  });
  const merged = path.join(work, 'android/app/build/intermediates/merged_manifest/release');
  const found = fs.readdirSync(merged, { recursive: true }).filter(file => path.basename(file) === 'AndroidManifest.xml');
  if (found.length !== 1) throw new Error(`Expected one merged release manifest, found ${found.length}`);
  return {
    manifest: fs.readFileSync(path.join(merged, found[0]), 'utf8'),
    rules: fs.readFileSync(path.join(work, 'android/app/src/main/res/xml/data_extraction_rules.xml'), 'utf8'),
  };
}

async function summarize(xml) {
  const { manifest } = await XML.parseXMLAsync(xml);
  const sdk = (manifest['uses-sdk'] || [])[0]?.$ || {};
  const application = (manifest.application || [])[0] || {};
  const exported = COMPONENTS.flatMap(kind => (application[kind] || [])
    .filter(component => component.$['android:exported'] === 'true').map(component => `${kind} ${component.$['android:name']}`));
  return {
    package: manifest.$.package, versionCode: manifest.$['android:versionCode'], versionName: manifest.$['android:versionName'],
    minSdk: sdk['android:minSdkVersion'], targetSdk: sdk['android:targetSdkVersion'],
    permissions: (manifest['uses-permission'] || []).map(entry => entry.$['android:name']),
    exported,
  };
}

async function inspect() {
  const root = path.resolve(__dirname, '..').replace(/^[a-z](?=:)/, drive => drive.toUpperCase());
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const problems = [...appConfigProblems(config), ...sourceProblems(root)];
  const { manifest, rules } = mergeReleaseManifest(root);
  problems.push(...rulesProblems(rules), ...await manifestProblems(manifest, releaseExpectations(config)));
  console.log(JSON.stringify({ merged: await summarize(manifest), problems }, null, 2));
  if (problems.length) process.exitCode = 1;
}

if (require.main === module) {
  if (process.argv[2] !== 'inspect' || process.argv.length !== 3) {
    console.error('Usage: node scripts/release-config.cjs inspect');
    process.exitCode = 2;
  } else {
    inspect().catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}

module.exports = {
  appConfigProblems, rulesProblems, manifestProblems, sourceProblems, releaseExpectations, prepareReleaseProject,
  BLOCKED_PERMISSIONS, ALLOWED_PERMISSIONS, SIGNATURE_PERMISSIONS, ALLOWED_EXPORTED, MIN_TARGET_SDK,
};
