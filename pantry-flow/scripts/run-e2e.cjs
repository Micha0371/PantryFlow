const { spawnSync, fork } = require('node:child_process');
const fs = require('node:fs');
const { lockFile, isAlive, acquireRunLock, releaseRunLock } = require('./e2e-lock.cjs');
const path = require('node:path');
const { selectFlows } = require('./e2e-flows.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.verification/maestro');
fs.mkdirSync(out, { recursive: true });
const adb = process.env.ADB || 'adb';
const maestro = process.env.MAESTRO || 'maestro';
// Maestro does not use ADB's ANDROID_SERIAL to select its own driver target.
const maestroDevice = process.env.ANDROID_SERIAL ? ['--device', process.env.ANDROID_SERIAL] : [];
// A physical-device run installs the ARM64 build; the emulator default is unchanged.
const apk = process.env.PANTRY_TEST_APK || '.verification/pantryflow-test.apk';
// Only a test build may be installed; the production package is never touched.
if (!/^\.verification\/pantryflow-test[\w-]*\.apk$/.test(apk.replaceAll('\\', '/'))) {
  throw new Error(`PANTRY_TEST_APK must name a .verification/pantryflow-test*.apk build, not ${apk}`);
}
// Each Maestro start reinstalls its driver by default; on a physical phone every reinstall
// can raise an install prompt (Xiaomi cancels it when unattended), so keep one install there.
const testOptions = process.env.PANTRY_TEST_TARGET === 'device' ? ['--no-reinstall-driver'] : [];
const run = (exe, args, options = {}) => {
  const result = spawnSync(exe, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${path.basename(exe)} exited ${result.status}`);
  return result;
};
// The fixture commands may run while this runner holds the lock; they must know it is theirs.
const fixture = command => run(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/e2e-fixtures.ts', command],
  { env: { ...process.env, PANTRY_E2E_RUNNER_PID: String(process.pid) } });
let proxy;
async function runAll(flows) {
let failure;
proxy = fork(path.join(__dirname, 'e2e-proxy.cjs'), { cwd: root, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
try {
await new Promise((resolve, reject) => {
 const timer = setTimeout(() => { proxy.kill(); reject(Error('Local test proxy did not start')); }, 10000);
 proxy.once('message', () => { clearTimeout(timer); resolve(); });
 proxy.once('error', reject);
 proxy.once('exit', code => reject(Error(`Local test proxy exited ${code}`)));
});
  // prepare resets only the four reserved fixture accounts, not the database.
  // Build before invocation using e2e:prepare + e2e:build, then fresh fixtures here.
  // prepare writes the env file (baked into the APK build); each flow then gets its own seed.
  fixture('prepare');
  run(adb, ['install', '-r', apk]);
  run(adb, ['logcat', '-c']);
  const maestroEnv = extra => ({ ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true', ...extra });
  const maestroFlow = (file, report, extra) => run(maestro, [...maestroDevice, 'test', ...testOptions, '--format', 'junit',
    '--output', `.verification/maestro/${report.xml}`, '--debug-output', `.verification/maestro/${report.debug}`,
    `.maestro/${file}.yaml`], { shell: process.platform === 'win32', env: maestroEnv(extra) });
  const readState = () => JSON.parse(fs.readFileSync(path.join(root, '.verification/confirmation-state.json'), 'utf8'));
  for (const flow of flows) {
    fixture(`seed:${flow.name}`);
    if (flow.name === 'confirmation') {
      // One test: the PKCE link only opens in the app that registered, so the steps run as a unit.
      maestroFlow('confirmation-register', { xml: 'confirmation-register.xml', debug: 'confirmation-register' });
      fixture('confirmation-first');
      maestroFlow('confirmation-complete', { xml: 'confirmation-first-complete.xml', debug: 'confirmation-first-complete' }, { MAESTRO_CONFIRMATION_URL: readState().confirmed });
      fixture('confirmation-reset');
      maestroFlow('confirmation-register', { xml: 'confirmation-register.xml', debug: 'confirmation-register' });
      fixture('confirmation-expired');
      maestroFlow('confirmation-resend', { xml: 'confirmation-resend.xml', debug: 'confirmation-resend' }, { MAESTRO_CONFIRMATION_URL: readState().expired });
      fixture('confirmation-resent');
      maestroFlow('confirmation-complete', { xml: 'confirmation-complete.xml', debug: 'confirmation-complete' }, { MAESTRO_CONFIRMATION_URL: readState().confirmed });
    } else {
      maestroFlow(flow.file, { xml: flow.xml, debug: flow.debug });
    }
    fixture(`verify:${flow.name}`);
  }
} catch (error) { failure = error; }
finally {
  const logs = spawnSync(adb, ['logcat', '-d', '-v', 'threadtime'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (logs.error || logs.status !== 0) failure ||= Error('Android diagnostic log capture failed');
  fs.writeFileSync(path.join(out, 'android-logcat.txt'), logs.stdout || logs.stderr || 'No logs captured');
  // Matches the exact native asset failure observed in the prior device pass.
  if (/ExpoAsset\.downloadAsync.*(?:reject|error)|AppDirectories.*not found|Unable to load font|Unrecognized font family|Error loading font/i.test(logs.stdout || '')) {
    failure ||= Error('Native font/asset regression detected in Android logcat');
  }
  try { fixture('cleanup'); } catch (error) { failure ||= error; }
  proxy.kill();
}
if (failure) { console.error(failure.message); process.exitCode = 1; }

}
// One e2e run at a time: the lock is taken before the proxy or any fixture reset and
// released on every exit path (a killed runner leaves a dead pid, which the next run replaces).
async function main() {
  const flows = selectFlows(process.argv.slice(2));
  const lock = lockFile();
  acquireRunLock(lock, process.pid, isAlive, root);
  // Ctrl-C / termination: free the lock and the proxy before exiting with the conventional code.
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
    process.once(signal, () => { proxy?.kill(); releaseRunLock(lock, process.pid); process.exit(code); });
  }
  try { await runAll(flows); } finally { releaseRunLock(lock, process.pid); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
