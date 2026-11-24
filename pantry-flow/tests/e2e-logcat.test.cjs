const { test } = require('node:test');
const assert = require('node:assert/strict');
const { logcatProblem } = require('../scripts/e2e-logcat.cjs');

const LINE = '11-23 02:11:26.686  1234  1234 I ActivityManager: Displayed com.pantryflow.test/.MainActivity\n';
const HEADERS = '--------- beginning of main\n--------- beginning of system\r\n';
const captured = stdout => ({ status: 0, stdout, stderr: '' });

test('a captured log without a font or asset error is no problem', () => {
  assert.equal(logcatProblem(captured(HEADERS + LINE)), null);
});

test('a log without any entry is a problem, not a clean result', () => {
  for (const stdout of ['', null, undefined, ' \r\n', HEADERS]) {
    assert.equal(logcatProblem(captured(stdout)), 'Android diagnostic log is empty', JSON.stringify(stdout));
  }
});

test('a failed capture is a problem', () => {
  assert.equal(logcatProblem({ error: new Error('spawn adb ENOENT'), status: null, stdout: null }), 'Android diagnostic log capture failed');
  assert.equal(logcatProblem({ status: 1, stdout: LINE }), 'Android diagnostic log capture failed');
});

test('a native font or asset error is a problem', () => {
  for (const text of ['ExpoAsset.downloadAsync was rejected', 'AppDirectories module not found', 'Unable to load font ionicons',
    'Unrecognized font family "ionicons"', 'Error loading font x']) {
    assert.equal(logcatProblem(captured(`${LINE}11-23 02:11:27.000  1  1 E ReactNativeJS: ${text}\n`)),
      'Native font/asset regression detected in Android logcat', text);
  }
});
