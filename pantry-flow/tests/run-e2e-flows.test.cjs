const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FLOWS, selectFlows } = require('../scripts/e2e-flows.cjs');

const names = FLOWS.map(flow => flow.name);

test('no --flow selects every flow in the fixed order', () => {
  assert.deepEqual(selectFlows([]).map(flow => flow.name),
    ['slice-1-1', 'slice-2-shopping', 'slice-3-status', 'slice-3-search', 'slice-3-entry', 'confirmation']);
});

test('--flow <name> and --flow=<name> select exactly that flow', () => {
  for (const name of names) {
    assert.deepEqual(selectFlows(['--flow', name]).map(flow => flow.name), [name]);
    assert.deepEqual(selectFlows([`--flow=${name}`]).map(flow => flow.name), [name]);
  }
});

test('an unknown or missing flow name fails and lists the valid names', () => {
  for (const argv of [['--flow', 'nope'], ['--flow'], ['--flow='], ['--flow', '--other']]) {
    assert.throws(() => selectFlows(argv), error => /^Unknown flow /.test(error.message) && names.every(name => error.message.includes(name)));
  }
  assert.throws(() => selectFlows(['--flow', 'nope']), /"nope"/);
});

test('every flow names a Maestro file that exists and a debug folder, and report names are unique', () => {
  for (const flow of FLOWS) {
    assert.ok(fs.existsSync(path.join(__dirname, '../.maestro', `${flow.file}.yaml`)), `${flow.file}.yaml must exist`);
    assert.ok(flow.xml && flow.debug);
  }
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(FLOWS.map(flow => flow.xml)).size, FLOWS.length);
});

test('every flow header names its own seed', () => {
  for (const flow of FLOWS.filter(flow => flow.name !== 'confirmation')) {
    const text = fs.readFileSync(path.join(__dirname, '../.maestro', `${flow.file}.yaml`), 'utf8');
    assert.ok(text.includes(`Seed: seed:${flow.name}`), `${flow.file}.yaml must name Seed: seed:${flow.name}`);
  }
});
