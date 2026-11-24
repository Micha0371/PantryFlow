'use strict';
// Finds test files that would never run: no runner picks them up, or they declare no test.
// Also reports a runner that has no file at all.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { globToRegExp, declaresTest } = require('./check-test-independence.cjs');
const e2eFlows = require('./e2e-flows.cjs');

const TEST_FILE = /\.(test|integration)\.(cjs|mjs|js|cts|mts|ts|jsx|tsx)$/;

// Paths below `folder`, relative to `root`, with forward slashes; [] when the folder does not exist.
function filesBelow(root, folder) {
  const dir = path.join(root, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

// `flowFiles`: the Maestro files the e2e runner starts, without `.yaml`.
function inventoryProblems(root, flowFiles = e2eFlows.flowFiles()) {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const named = new Set(Object.values(scripts).flatMap(script => script.split(/\s+/)));
  const component = require(path.join(root, 'jest.config.cjs')).testMatch.map(globToRegExp);
  const runners = {
    node: file => /^tests\/[^/]+\.test\.cjs$/.test(file),
    component: file => component.some(glob => glob.test(file)),
    integration: file => file.startsWith('tests/integration/') && named.has(file),
  };

  const tests = filesBelow(root, 'tests').filter(file => TEST_FILE.test(file));
  const problems = [];
  for (const file of tests) {
    if (!Object.values(runners).some(picks => picks(file))) problems.push(`${file}: no test runner picks this file up`);
    else if (!declaresTest(file, fs.readFileSync(path.join(root, file), 'utf8'))) problems.push(`${file}: declares no test`);
  }
  for (const [kind, picks] of Object.entries(runners)) {
    if (!tests.some(picks)) problems.push(`no ${kind} test files found`);
  }

  if (!filesBelow(root, 'supabase/tests').some(file => file.endsWith('.test.sql'))) problems.push('no database test files found');

  const flows = filesBelow(root, '.maestro').filter(file => /^\.maestro\/[^/]+\.ya?ml$/.test(file));
  if (flows.length === 0) problems.push('no Maestro test files found');
  for (const file of flows) {
    if (!flowFiles.includes(path.parse(file).name)) problems.push(`${file}: the e2e runner does not use this flow`);
  }
  return problems;
}

module.exports = { inventoryProblems };
