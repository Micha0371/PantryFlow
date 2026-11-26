const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-27: pins the variant colors and press/disabled opacity before flattening their conditions.
const theme = load('lib/theme.ts');
const { Button } = load('components/Button.tsx', {
  'react-native': { ActivityIndicator: 'Spinner', Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: s => s } },
  '@/lib/theme': theme,
});
const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const { colors } = theme;

test('each variant has its background, border and text colors', () => {
  const expected = {
    primary: { bg: colors.primary, border: 'transparent', fg: colors.primaryOn },
    secondary: { bg: 'transparent', border: colors.border, fg: colors.text },
    danger: { bg: colors.danger, border: 'transparent', fg: colors.primaryOn },
  };
  for (const [variant, want] of Object.entries(expected)) {
    let view;
    act(() => { view = create(React.createElement(Button, { label: 'Go', onPress() {}, variant })); });
    try {
      const style = flat(view.root.findByType('Pressable').props.style({ pressed: false }));
      assert.equal(style.backgroundColor, want.bg, variant);
      assert.equal(style.borderColor, want.border, variant);
      assert.equal(flat(view.root.findByType('Text').props.style).color, want.fg, variant);
    } finally { act(() => view.unmount()); }
  }
});

test('opacity is 0.6 when disabled or loading, 0.9 when pressed and 1 otherwise', () => {
  for (const [props, pressed, opacity] of [[{}, false, 1], [{}, true, 0.9], [{ disabled: true }, false, 0.6],
    [{ disabled: true }, true, 0.6], [{ loading: true }, true, 0.6]]) {
    let view;
    act(() => { view = create(React.createElement(Button, { label: 'Go', onPress() {}, ...props })); });
    try {
      assert.equal(flat(view.root.findByType('Pressable').props.style({ pressed })).opacity, opacity, JSON.stringify([props, pressed]));
    } finally { act(() => view.unmount()); }
  }
});

// Phone session 2026-11-26 (KAN-62, F1): at the largest font size "Bestätigungs-E-Mail erneut
// senden" wraps to two lines, and a fixed 48 dp height cut off the second line.
test('a long label can wrap: the button has a 48 dp minimum height, not a fixed one, and centres its text', () => {
  let view;
  act(() => { view = create(React.createElement(Button, { label: 'Go', onPress() {} })); });
  try {
    const style = flat(view.root.findByType('Pressable').props.style({ pressed: false }));
    assert.equal(style.height, undefined, 'a fixed height clips a wrapped label');
    assert.equal(style.minHeight, 48);
    assert.ok(style.paddingVertical > 0, 'a wrapped label keeps space above and below');
    assert.equal(flat(view.root.findByType('Text').props.style).textAlign, 'center');
  } finally { act(() => view.unmount()); }
});
