'use strict';
// Which changes need the Android e2e job (CI starts it on its own for them), and whether a new head
// needs it again after a green run. Skipping a needed run is the costly mistake, so anything under
// pantry-flow/ counts unless it is a doc, a unit test or a component test, which never reach the APK.
//   git diff --name-only <range> | node scripts/android-relevance.cjs        -> android=true|false
//   node scripts/android-relevance.cjs --since <green-sha> [--head H] [--base origin/main]
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// git runs from a fixed absolute path, never a PATH lookup (Sonar S4036): the GitHub runners'
// /usr/bin/git, common Unix locations, and Git for Windows.
const GIT_CANDIDATES = ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git', String.raw`C:\Program Files\Git\cmd\git.exe`];
function gitExecutable(candidates = GIT_CANDIDATES) {
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) throw new Error(`No git found at a fixed path (${candidates.join(', ')})`);
  return found;
}

const WORKFLOW = '.github/workflows/pantryflow-tests.yml';
const NOT_IN_APK = [
  /\.md$/,                           // docs anywhere
  /^tests\/[^/]+\.test\.cjs$/,       // node unit tests (top level only; tests/integration feeds the e2e fixtures)
  /^tests\/helpers\.cjs$/,
  /^tests\/list-provider-contract\.cjs$/,
  /^tests\/components\//,            // Jest component tests
];

function isRelevant(file) {
  if (file === WORKFLOW) return true;
  if (!file.startsWith('pantry-flow/')) return false;
  const inApp = file.slice('pantry-flow/'.length);
  return !NOT_IN_APK.some(pattern => pattern.test(inApp));
}

function androidRelevant(files) {
  const relevant = files.filter(isRelevant);
  return { relevant: relevant.length > 0, files: relevant };
}

// After a green run on `green`: the files the branch itself changed (against where it left `base`)
// at either commit, limited to relevant ones, whose content differs between the two. Files that only
// main changed are left out: main's own Android run checks them. A file both changed counts.
function rerunNeeded({ green, head = 'HEAD', base = 'origin/main', cwd = process.cwd() }) {
  const gitPath = gitExecutable();
  const git = (...args) => execFileSync(gitPath, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const own = commit => git('diff', '--name-only', git('merge-base', commit, base), commit).split('\n').filter(Boolean);
  const blob = (commit, file) => { try { return git('rev-parse', `${commit}:${file}`); } catch { return null; } };
  const candidates = [...new Set([...own(green), ...own(head)])].filter(isRelevant).sort((a, b) => a.localeCompare(b));
  const files = candidates.filter(file => blob(green, file) !== blob(head, file));
  return { needed: files.length > 0, files };
}

module.exports = { androidRelevant, rerunNeeded, isRelevant, gitExecutable, GIT_CANDIDATES };

if (require.main === module) {
  const args = process.argv.slice(2);
  const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  if (option('--since')) {
    const result = rerunNeeded({ green: option('--since'), head: option('--head'), base: option('--base') });
    console.log(result.needed ? `Android run needed again: yes, the branch's own changes differ in:\n  ${result.files.join('\n  ')}` : 'Android run needed again: no');
    process.exit(0);
  }
  let input = '';
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    const result = androidRelevant(input.split(/\r?\n/));
    if (result.files.length) console.error(`Android-relevant: ${result.files.join(', ')}`);
    process.stdout.write(`android=${result.relevant}\n`);
  });
}
