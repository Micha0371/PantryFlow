const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');
const constants = load('lib/constants.ts');
const pantryData = load('lib/pantry-data.ts', { './write-outcome': load('lib/write-outcome.ts'), './constants': constants, './pagination': load('lib/pagination.ts') });
const { filterItemsByName } = load('lib/pantry-search.ts', { './pantry-data': pantryData });
const items = (...names) => names.map((name, i) => ({ id: String(i), name }));

test('an empty or whitespace-only query returns the same array reference', () => {
  const list = items('Milk', 'Rice');
  for (const q of ['', '   ', '\t\n', '\u00a0']) assert.equal(filterItemsByName(list, q), list);
});

test('matching is a case-insensitive substring of the trimmed query', () => {
  const list = items('Milk', 'Buttermilk', 'Rice');
  assert.deepEqual(filterItemsByName(list, '  mIL ').map(i => i.name), ['Milk', 'Buttermilk']);
});

test('German characters lower-case consistently', () => {
  const list = items('Äpfel', 'Apfel');
  assert.deepEqual(filterItemsByName(list, 'äp').map(i => i.name), ['Äpfel']);
  assert.deepEqual(filterItemsByName(items('Äpfel'), 'ae'), []);
});

test('order is preserved', () => {
  const list = items('Zucker Milk', 'Milk', 'Almond Milk');
  assert.deepEqual(filterItemsByName(list, 'milk').map(i => i.id), ['0', '1', '2']);
});
