const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

// KAN-127: a write that ends without a database answer may still have been committed.
const { WRITE_UNCONFIRMED, isUncodedFailure, unconfirmedWrite, isUnconfirmedWrite } = load('lib/write-outcome.ts');

test('a failure without a database or PostgREST code is uncoded: timeout, lost connection, gateway page, unreadable answer', () => {
  const aborted = { message: 'AbortError: The operation was aborted.', details: '', hint: 'Request was aborted', code: '' };
  for (const error of [aborted, new TypeError('Network request failed'), { message: '<html>502</html>' },
    new Error('Invalid item response'), { code: null }, 'offline', undefined]) {
    assert.equal(isUncodedFailure(error), true, JSON.stringify(error));
  }
});

test('a coded rejection is a confirmed answer, not an unknown outcome', () => {
  for (const code of ['23505', '42501', 'PGRST116', '23514', 'PF_PANTRY_MISSING', 'PF_SHOPPING_MISSING', 'PF_INVALID_SHOPPING']) {
    assert.equal(isUncodedFailure(Object.assign(new Error('x'), { code })), false, code);
  }
});

test('the unconfirmed-write error carries its own code and keeps the original failure as its cause', () => {
  const original = { message: 'AbortError', code: '' };
  const wrapped = unconfirmedWrite(original);
  assert.equal(wrapped.code, WRITE_UNCONFIRMED);
  assert.equal(WRITE_UNCONFIRMED, 'PF_WRITE_UNCONFIRMED');
  assert.equal(wrapped.cause, original);
  assert.equal(isUnconfirmedWrite(wrapped), true);
  assert.equal(isUnconfirmedWrite(original), false, 'only the wrapped error says the outcome is unknown');
  assert.equal(isUncodedFailure(wrapped), false, 'wrapping twice is impossible: the wrapped error is coded');
});
