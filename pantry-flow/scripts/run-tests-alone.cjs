'use strict';
// Runs every top-level test of each tests/*.test.cjs file on its own. A test that only passes
// because an earlier test left state behind fails here. A name that matches nothing fails too.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function unescapeXml(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e) => {
    if (e[0] !== '#') return ENTITIES[e];
    return String.fromCodePoint(e[1] === 'x' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10));
  });
}

function escapeName(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

// Direct children of <testsuites>: leaf tests (<testcase>) and tests with subtests or describe
// blocks (<testsuite>). Testcases nested inside a testsuite are subtests and are skipped.
function topLevelNames(junitXml) {
  const tag = /<(\/?)(testsuite|testcase)\b((?:[^>"]|"[^"]*")*?)(\/?)>/g;
  const names = [];
  let depth = 0;
  let match;
  while ((match = tag.exec(junitXml))) {
    const [, closing, , attrs, selfClosing] = match;
    if (closing) { depth--; continue; }
    if (depth === 0) {
      const name = /^\s*name="([^"]*)"/.exec(attrs);
      if (name) names.push(unescapeXml(name[1]));
    }
    if (!selfClosing) depth++;
  }
  return [...new Set(names)];
}

// An unmatched --test-name-pattern still reports the file itself as one passing test, so a
// count cannot tell a miss from a hit. A real match yields a top-level entry with the name.
function matchedName(junitXml, name) {
  return topLevelNames(junitXml).includes(name);
}

// The child's junit <failure> text, else the tail of its output; at most 40 lines.
function detail(child) {
  const xml = child.stdout || '';
  const texts = [...xml.matchAll(/<failure\b[^>]*>([\s\S]*?)<\/failure>/g)].map(m => unescapeXml(m[1]));
  const raw = texts.length ? texts.join('\n') : `${xml}\n${child.stderr || ''}`;
  const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '');
  return lines.slice(-40).map(l => `      ${l}`).join('\n');
}

function runNode(args) {
  return spawnSync(process.execPath, ['--test', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  const dir = path.join(__dirname, '..', 'tests');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.cjs')).sort();
  const failures = [];
  let runs = 0;
  for (const file of files) {
    const rel = path.join('tests', file);
    const listing = runNode(['--test-reporter=junit', rel]);
    if (listing.status !== 0) {
      failures.push(`${file} :: (whole file fails before running tests alone)\n${detail(listing)}`);
      continue;
    }
    const names = topLevelNames(listing.stdout);
    if (names.length === 0) failures.push(`${file} :: (no top-level tests found)`);
    for (const name of names) {
      const alone = runNode(['--test-reporter=junit', '--test-name-pattern', `^${escapeName(name)}$`, rel]);
      runs++;
      if (alone.status !== 0) failures.push(`${file} :: ${name}\n${detail(alone)}`);
      else if (!matchedName(alone.stdout, name)) failures.push(`${file} :: ${name} (matched no test)`);
    }
  }
  console.log(`test:isolated ran ${runs} top-level tests alone across ${files.length} files`);
  if (failures.length) {
    console.error('Failed when run alone:');
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { escapeName, topLevelNames, matchedName };
