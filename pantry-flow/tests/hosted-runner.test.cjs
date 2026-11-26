const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Only what node needs to start (plus the overrides): never the developer's shell or CI environment.
function childEnv(overrides) {
  const env = { PATH: process.env.PATH };
  for (const name of ['SystemRoot', 'TEMP', 'TMP']) if (process.env[name] !== undefined) env[name] = process.env[name];
  return { ...env, ...overrides };
}

test('hosted runner refuses another project and administrative keys before making requests', () => {
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-hosted-refusal-'));
  try {
    fs.mkdirSync(path.join(folder, 'scripts'));
    fs.copyFileSync(path.join(__dirname, '../scripts/verify-hosted.cjs'), path.join(folder, 'scripts/verify-hosted.cjs'));
    const preload = path.join(folder, 'no-requests.cjs');
    fs.writeFileSync(preload, `global.fetch = async () => { throw Error('Unexpected request'); };`);
    for (const overrides of [
      { EXPO_PUBLIC_SUPABASE_URL: 'https://other-project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test' },
      { EXPO_PUBLIC_SUPABASE_URL: 'https://oiqteedkfwmcertgxqga.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_test' },
      { EXPO_PUBLIC_SUPABASE_URL: 'https://oiqteedkfwmcertgxqga.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt },
    ]) {
      const result = spawnSync(process.execPath, ['--require', preload, 'scripts/verify-hosted.cjs', '--preflight'], {
        cwd: folder, env: childEnv(overrides), encoding: 'utf8', timeout: 30000,
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /unexpected project|Only publishable or legacy anon keys/);
      assert.doesNotMatch(result.stdout + result.stderr, /signature|sb_secret_test/);
      assert.doesNotMatch(result.stdout + result.stderr, /Unexpected request/);
    }
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test('confirmation-enabled hosted checks refuse synthetic signup and explain the confirmed-fixture procedure', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-hosted-confirmation-'));
  try {
    fs.mkdirSync(path.join(folder, 'scripts'));
    fs.copyFileSync(path.join(__dirname, '../scripts/verify-hosted.cjs'), path.join(folder, 'scripts/verify-hosted.cjs'));
    const preload = path.join(folder, 'settings-only.cjs');
    fs.writeFileSync(preload, `global.fetch = async url => {
      if (!url.endsWith('/auth/v1/settings')) throw Error('Unexpected request after confirmation preflight');
      return new Response(JSON.stringify({external:{email:true},mailer_autoconfirm:false,disable_signup:false}));
    };`);
    const result = spawnSync(process.execPath, ['--require', preload, 'scripts/verify-hosted.cjs', '--run', '--create-test-accounts'], {
      cwd: folder, encoding: 'utf8', timeout: 30000,
      env: childEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://oiqteedkfwmcertgxqga.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture' }),
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /provision two confirmed disposable accounts/);
    assert.match(result.stderr, /do not disable confirmation/);
    assert.doesNotMatch(result.stdout + result.stderr, /Created disposable user|Unexpected request/);
    assert.equal(fs.existsSync(path.join(folder, '.env.verification.local')), false);
    const report = JSON.parse(fs.readFileSync(path.join(folder, '.verification/hosted-results.json'), 'utf8'));
    assert.deepEqual(report.results, []);
    assert.deepEqual(report.cleanupFailures, []);
  } finally {
    assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

// KAN-27: a failure after the run (here: writing the report) is reported, not left as an unhandled rejection.
test('a failure after the run exits 1 with a message instead of an unhandled rejection', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-hosted-report-'));
  try {
    fs.mkdirSync(path.join(folder, 'scripts'));
    fs.copyFileSync(path.join(__dirname, '../scripts/verify-hosted.cjs'), path.join(folder, 'scripts/verify-hosted.cjs'));
    const preload = path.join(folder, 'no-network-no-report.cjs');
    fs.writeFileSync(preload, `global.fetch = async () => { throw Error('offline'); };
      const fs = require('node:fs'); const write = fs.writeFileSync;
      fs.writeFileSync = (file, ...rest) => {
        if (String(file).endsWith('hosted-results.json')) throw Error('report could not be written');
        return write(file, ...rest);
      };`);
    const result = spawnSync(process.execPath, ['--require', preload, 'scripts/verify-hosted.cjs', '--run'], {
      cwd: folder, encoding: 'utf8', timeout: 30000,
      env: childEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://oiqteedkfwmcertgxqga.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture' }),
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /report could not be written/);
    assert.doesNotMatch(result.stderr, /Node\.js v\d+|at .*verify-hosted\.cjs/);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

// KAN-122 review: the sign-in screen maps Auth's invalid_credentials code, which the local
// integration test pins only against the local server. The hosted run checks it too, with the
// API version header supabase-js sends. Fake responses only: no request leaves the machine.
test('the hosted run checks that a wrong password is rejected with invalid_credentials', () => {
  for (const [code, expected] of [['invalid_credentials', 'passed'], ['validation_failed', 'failed']]) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-hosted-wrong-password-'));
    try {
      fs.mkdirSync(path.join(folder, 'scripts'));
      fs.copyFileSync(path.join(__dirname, '../scripts/verify-hosted.cjs'), path.join(folder, 'scripts/verify-hosted.cjs'));
      const preload = path.join(folder, 'wrong-password.cjs');
      fs.writeFileSync(preload, `global.fetch = async (url, init = {}) => {
        if (url.endsWith('/auth/v1/settings')) return new Response(JSON.stringify({external:{email:true},mailer_autoconfirm:false,disable_signup:false}));
        const body = JSON.parse(init.body ?? 'null');
        if (url.endsWith('/auth/v1/token?grant_type=password') && body?.password !== 'fixture-password') {
          if (init.headers?.['X-Supabase-Api-Version'] !== '2024-01-01') return new Response(JSON.stringify({error_code:'${code}'}), {status:400});
          return new Response(JSON.stringify({code:'${code}',msg:'Invalid login credentials'}), {status:400});
        }
        throw Error('stop after the wrong-password check');
      };`);
      const result = spawnSync(process.execPath, ['--require', preload, 'scripts/verify-hosted.cjs', '--run'], {
        cwd: folder, encoding: 'utf8', timeout: 30000,
        env: childEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://oiqteedkfwmcertgxqga.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
          PANTRY_TEST_A_EMAIL: 'pf.verify.a@example.com', PANTRY_TEST_A_PASSWORD: 'fixture-password',
          PANTRY_TEST_B_EMAIL: 'pf.verify.b@example.com', PANTRY_TEST_B_PASSWORD: 'fixture-password' }),
      });
      assert.equal(result.status, 1, 'the fake stops the run after the check');
      assert.doesNotMatch(result.stdout + result.stderr, /fixture-password/);
      const report = JSON.parse(fs.readFileSync(path.join(folder, '.verification/hosted-results.json'), 'utf8'));
      const check = report.results.find(r => /wrong password/.test(r.name));
      assert.ok(check, 'the wrong-password check ran');
      assert.equal(check.status, expected, code);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  }
});
