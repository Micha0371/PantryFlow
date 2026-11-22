const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const ref = 'oiqteedkfwmcertgxqga';

// Only what node needs to start (plus the overrides): never the developer's shell or CI environment.
function childEnv(overrides) {
  const env = { PATH: process.env.PATH };
  for (const name of ['SystemRoot', 'TEMP', 'TMP']) if (process.env[name] !== undefined) env[name] = process.env[name];
  return { ...env, ...overrides };
}

// The builder reads <its parent folder>/.env, so run a temp copy and never touch the app root's files.
function withBuilderCopy(run) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-email-builder-'));
  try {
    fs.mkdirSync(path.join(folder, 'scripts'));
    fs.copyFileSync(path.join(__dirname, '../scripts/build-email-validation.cjs'), path.join(folder, 'scripts/build-email-validation.cjs'));
    run(folder);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
}

test('manual email builder refuses another project before loading or building app artifacts', () => {
  withBuilderCopy(folder => {
    const result = spawnSync(process.execPath, ['scripts/build-email-validation.cjs', '--project-ref', 'another-project'], {
      cwd: folder, env: childEnv({}), encoding: 'utf8', timeout: 30000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Explicit intended project reference required/);
    assert.doesNotMatch(result.stdout, /Built isolated/);
  });
});

test('manual email builder rejects modern secret and legacy service-role keys before any build', () => {
  const jwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  withBuilderCopy(folder => {
    for (const key of ['sb_secret_fixture_not_a_real_key', jwt]) {
      const result = spawnSync(process.execPath, ['scripts/build-email-validation.cjs', '--project-ref', ref], {
        cwd: folder, encoding: 'utf8', timeout: 30000,
        env: childEnv({ EXPO_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Never bundle/);
      assert.doesNotMatch(result.stdout, /Built isolated/);
    }
  });
});
