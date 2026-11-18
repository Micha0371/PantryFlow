const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-84: forms count failed submits so Input can announce a repeated identical error.
const { useFormError } = load('hooks/useFormError.ts');

test('useFormError counts each error it is given and keeps the count when cleared', () => {
  let form;
  const Probe = () => { form = useFormError(); return null; };
  let renderer;
  act(() => { renderer = create(React.createElement(Probe)); });
  try {
    assert.equal(form.error, null);
    assert.equal(form.failures, 0);
    const { setError } = form;
    act(() => form.setError('Name is required.'));
    assert.equal(form.error, 'Name is required.');
    assert.equal(form.failures, 1);
    act(() => form.setError('Name is required.'));
    assert.equal(form.failures, 2, 'the same error again is a new failure');
    act(() => form.setError(null));
    assert.equal(form.error, null);
    assert.equal(form.failures, 2, 'clearing is not a failure');
    assert.equal(form.setError, setError, 'setError is stable across renders');
  } finally { act(() => renderer.unmount()); }
});
