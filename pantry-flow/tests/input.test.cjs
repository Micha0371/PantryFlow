const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-34: an error shown under a form field must be announced by screen readers.
const theme = load('lib/theme.ts');
const { Input } = load('components/Input.tsx', {
  'react-native': { Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: s => s } },
  '@/lib/theme': theme,
});

function render(error) {
  let renderer;
  act(() => { renderer = create(React.createElement(Input, { error, testID: 'field' })); });
  return renderer;
}
const liveRegion = renderer => renderer.root.findAll(node => node.type === 'View'
  && node.props.accessibilityLiveRegion === 'polite');
const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

test('an error under a field is an alert inside a polite live region', () => {
  const renderer = render('Name is required.');
  try {
    const regions = liveRegion(renderer);
    assert.equal(regions.length, 1);
    assert.equal(regions[0].props.collapsable, false);
    const text = regions[0].findByType('Text');
    assert.equal(text.props.children, 'Name is required.');
    assert.equal(text.props.accessibilityRole, 'alert');
  } finally { act(() => renderer.unmount()); }
});

test('without an error the live region is rendered empty', () => {
  const renderer = render(null);
  try {
    const regions = liveRegion(renderer);
    assert.equal(regions.length, 1);
    assert.equal(regions[0].findAllByType('Text').length, 0);
    assert.equal(regions[0].props.style, undefined);
  } finally { act(() => renderer.unmount()); }
});

test('a changed error replaces the text inside the live region', () => {
  const renderer = render('Name is required.');
  try {
    act(() => renderer.update(React.createElement(Input, { error: 'This item is already on your shopping list.', testID: 'field' })));
    const regions = liveRegion(renderer);
    assert.equal(regions.length, 1);
    const region = regions[0];
    assert.equal(region.findByType('Text').props.children, 'This item is already on your shopping list.');
  } finally { act(() => renderer.unmount()); }
});

test('the field gets the error border only while an error is shown', () => {
  const renderer = render('Name is required.');
  try {
    const field = () => renderer.root.findByType('TextInput');
    assert.equal(flat(field().props.style).borderColor, theme.colors.danger);
    assert.equal(field().props.testID, 'field');
    act(() => renderer.update(React.createElement(Input, { error: null, testID: 'field' })));
    assert.equal(flat(field().props.style).borderColor, theme.colors.border);
  } finally { act(() => renderer.unmount()); }
});
