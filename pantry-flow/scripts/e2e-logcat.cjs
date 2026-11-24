// Judges the Android log captured after an e2e run; kept free of side effects so it can be unit-tested.
// Matches the exact native asset failure observed in the prior device pass.
const ASSET_FAILURE = /ExpoAsset\.downloadAsync.*(?:reject|error)|AppDirectories.*not found|Unable to load font|Unrecognized font family|Error loading font/i;
const BUFFER_HEADER = /^-+ beginning of /;

// `logs` is the spawnSync result of `adb logcat -d`. Returns the problem, or null for a clean log.
function logcatProblem(logs) {
  if (logs.error || logs.status !== 0) return 'Android diagnostic log capture failed';
  const entries = (logs.stdout || '').split(/\r?\n/).filter(line => line.trim() !== '' && !BUFFER_HEADER.test(line));
  // without a single entry the search below would find nothing and look clean
  if (entries.length === 0) return 'Android diagnostic log is empty';
  return entries.some(line => ASSET_FAILURE.test(line)) ? 'Native font/asset regression detected in Android logcat' : null;
}

module.exports = { logcatProblem };
