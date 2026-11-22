const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-34: an error shown under a form field must be announced by screen readers.
const theme = load('lib/theme.ts');
function loadInput() {
  const announced = [];
  const { Input } = load('components/Input.tsx', {
    'react-native': { Text: 'Text', TextInput: 'TextInput', View: 'View', StyleSheet: { create: s => s } },
    '@/lib/theme': theme,
    '@/lib/accessibility': load('lib/accessibility.ts', { 'react-native': { Platform: { OS: 'android' },
      AccessibilityInfo: { announceForAccessibility: m => announced.push(m) } } }),
    './InlineError': load('components/InlineError.tsx', { 'react-native': { Text: 'Text', View: 'View' } }),
  });
  return { Input, announced };
}
function render(error, { Input } = loadInput()) {
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
  const { Input } = loadInput();
  const renderer = render('Name is required.', { Input });
  try {
    act(() => renderer.update(React.createElement(Input, { error: 'This item is already on your shopping list.', testID: 'field' })));
    const regions = liveRegion(renderer);
    assert.equal(regions.length, 1);
    const region = regions[0];
    assert.equal(region.findByType('Text').props.children, 'This item is already on your shopping list.');
  } finally { act(() => renderer.unmount()); }
});

test('the field gets the error border only while an error is shown', () => {
  const { Input } = loadInput();
  const renderer = render('Name is required.', { Input });
  try {
    const field = () => renderer.root.findByType('TextInput');
    assert.equal(flat(field().props.style).borderColor, theme.colors.danger);
    assert.equal(field().props.testID, 'field');
    act(() => renderer.update(React.createElement(Input, { error: null, testID: 'field' })));
    assert.equal(flat(field().props.style).borderColor, theme.colors.border);
  } finally { act(() => renderer.unmount()); }
});

// KAN-84 item 3: a failed submit that leaves the same error does not change the
// live region, so TalkBack would stay silent. A new announceKey speaks it once.
test('an unchanged error is announced again when announceKey changes', () => {
  const { Input, announced } = loadInput();
  let renderer;
  const el = (error, announceKey) => React.createElement(Input, { error, announceKey, testID: 'field' });
  act(() => { renderer = create(el('Name is required.', 1)); });
  try {
    assert.deepEqual(announced, [], 'the first appearance is left to the live region');
    act(() => renderer.update(el('Name is required.', 1)));
    assert.deepEqual(announced, [], 'a re-render without a new key says nothing');
    act(() => renderer.update(el('Name is required.', 2)));
    assert.deepEqual(announced, ['Name is required.']);
    act(() => renderer.update(el('Name is too long.', 3)));
    assert.deepEqual(announced, ['Name is required.'], 'a changed error is left to the live region');
    act(() => renderer.update(el(null, 4)));
    assert.deepEqual(announced, ['Name is required.']);
    act(() => renderer.update(el('Name is required.', 5)));
    assert.deepEqual(announced, ['Name is required.'], 'an error that re-appears is left to the live region');
  } finally { act(() => renderer.unmount()); }
});
