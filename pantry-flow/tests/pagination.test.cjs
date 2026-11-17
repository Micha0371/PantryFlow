const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

// KAN-27: pins every exit of fetchAllPages before splitting its loop.
const { fetchAllPages, PAGE_SIZE } = load('lib/pagination.ts');
const rows = (n, from = 0) => Array.from({ length: n }, (_, i) => from + i);
function pages(list) {
  let i = 0;
  return async () => list[i++];
}

test('fetchAllPages stops when the reported count is reached', async () => {
  assert.equal((await fetchAllPages(pages([{ data: rows(PAGE_SIZE), error: null, count: PAGE_SIZE + 2 },
    { data: rows(2, PAGE_SIZE), error: null, count: PAGE_SIZE + 2 }]), x => x)).length, PAGE_SIZE + 2);
});

test('fetchAllPages returns on an empty page when the count is complete or unknown', async () => {
  assert.deepEqual(await fetchAllPages(pages([{ data: [], error: null, count: 0 }]), x => x), []);
  assert.deepEqual(await fetchAllPages(pages([{ data: null, error: null, count: null }]), x => x), []);
});

test('fetchAllPages rejects an empty page before the reported count', async () => {
  await assert.rejects(fetchAllPages(pages([{ data: [], error: null, count: 3 }]), x => x), /Incomplete inventory/);
});

test('fetchAllPages returns a short page when no count is reported', async () => {
  assert.deepEqual(await fetchAllPages(pages([{ data: rows(3), error: null, count: null }]), x => x), [0, 1, 2]);
});

test('fetchAllPages rejects a short page when the count says more rows exist', async () => {
  await assert.rejects(fetchAllPages(pages([{ data: rows(3), error: null, count: 10 }]), x => x), /row limit is below page size/);
});

test('fetchAllPages rethrows a page error and parses each row', async () => {
  const failure = new Error('offline');
  await assert.rejects(fetchAllPages(pages([{ data: null, error: failure, count: null }]), x => x), failure);
  assert.deepEqual(await fetchAllPages(pages([{ data: [1, 2], error: null, count: 2 }]), x => x * 10), [10, 20]);
});
