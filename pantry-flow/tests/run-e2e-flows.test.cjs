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

test('unconsumed arguments and a repeated --flow fail clearly instead of running everything', () => {
  // `npm run test:e2e --flow x` (no `--`) reaches the script as just ["slice-3-entry"].
  assert.throws(() => selectFlows(['slice-3-entry']), /^Error: Unexpected argument "slice-3-entry"; usage: /);
  assert.throws(() => selectFlows(['--flow', 'slice-3-entry', 'extra']), /Unexpected argument "extra"/);
  assert.throws(() => selectFlows(['--other']), /Unexpected argument "--other"/);
  assert.throws(() => selectFlows(['--flow', 'slice-3-entry', '--flow', 'slice-3-search']), /more than once/);
  assert.throws(() => selectFlows(['--flow=slice-3-entry', '--flow', 'slice-3-entry']), /more than once/);
});

test('every flow names a Maestro file that exists and a debug folder, and report names are unique', () => {
  for (const flow of FLOWS) {
    assert.ok(fs.existsSync(path.join(__dirname, '../.maestro', `${flow.file}.yaml`)), `${flow.file}.yaml must exist`);
    assert.ok(flow.xml && flow.debug);
  }
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(FLOWS.map(flow => flow.xml)).size, FLOWS.length);
});

test('every flow header names its own seed; the three confirmation files name seed:confirmation', () => {
  for (const flow of FLOWS.filter(flow => flow.name !== 'confirmation')) {
    const text = fs.readFileSync(path.join(__dirname, '../.maestro', `${flow.file}.yaml`), 'utf8');
    assert.ok(text.includes(`Seed: seed:${flow.name}`), `${flow.file}.yaml must name Seed: seed:${flow.name}`);
  }
  for (const file of ['confirmation-register', 'confirmation-complete', 'confirmation-resend']) {
    const text = fs.readFileSync(path.join(__dirname, '../.maestro', `${file}.yaml`), 'utf8');
    assert.ok(text.includes('Seed: seed:confirmation'), `${file}.yaml must name Seed: seed:confirmation`);
  }
});

test('every flow has a seed and a verify command in e2e-fixtures', () => {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/e2e-fixtures.ts'), 'utf8');
  for (const flow of FLOWS) {
    assert.match(source, new RegExp(`^  '?${flow.name}'?: async \\(`, 'm'), `seed for ${flow.name}`);
    assert.match(source, new RegExp(`^  'verify:${flow.name}': \\w+,`, 'm'), `verify:${flow.name}`);
  }
});
