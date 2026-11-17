const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-39: Android does not speak the alert role by itself, so screen-level errors
// are announced explicitly. iOS keeps its current behavior (PF-IOS-001).
function setup(os = 'android') {
  const announced = [];
  const focus = { listeners: new Set(), focused: true };
  const expoRouter = {
    // Mirrors react-navigation: the effect runs while focused and is cleaned up on blur.
    useFocusEffect: callback => {
      const [focused, setFocused] = React.useState(focus.focused);
      React.useEffect(() => {
        focus.listeners.add(setFocused);
        return () => { focus.listeners.delete(setFocused); };
      }, []);
      React.useEffect(() => (focused ? callback() : undefined), [focused, callback]);
    },
  };
  const mod = load('hooks/useErrorAnnouncement.ts', {
    'react-native': { Platform: { OS: os }, AccessibilityInfo: { announceForAccessibility: m => announced.push(m) } },
    'expo-router': expoRouter,
  });
  const setFocus = value => act(() => { focus.focused = value; focus.listeners.forEach(fn => fn(value)); });
  return { mod, announced, setFocus, focus };
}

function mount(hook, message) {
  const Probe = ({ message: m }) => { hook(m); return null; };
  let renderer;
  act(() => { renderer = create(React.createElement(Probe, { message })); });
  return { update: m => act(() => renderer.update(React.createElement(Probe, { message: m }))),
    unmount: () => act(() => renderer.unmount()) };
}

test('an error announces once when it appears and again when its text changes', () => {
  const { mod, announced } = setup();
  const probe = mount(mod.useErrorAnnouncement, null);
  try {
    assert.deepEqual(announced, []);
    probe.update('Could not load.');
    probe.update('Could not load.');
    assert.deepEqual(announced, ['Could not load.']);
    probe.update('Session expired.');
    assert.deepEqual(announced, ['Could not load.', 'Session expired.']);
  } finally { probe.unmount(); }
});

test('the same error announces again after it was cleared, as after a failed retry', () => {
  const { mod, announced } = setup();
  const probe = mount(mod.useErrorAnnouncement, 'Could not load.');
  try {
    probe.update(null);
    probe.update('Could not load.');
    assert.deepEqual(announced, ['Could not load.', 'Could not load.']);
  } finally { probe.unmount(); }
});

test('a focused screen announces its error once on mount', () => {
  const { mod, announced } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, 'Could not load the shopping list.');
  try {
    assert.deepEqual(announced, ['Could not load the shopping list.']);
  } finally { probe.unmount(); }
});

test('an error on an unfocused screen waits until the screen is focused', () => {
  const { mod, announced, setFocus, focus } = setup();
  focus.focused = false;
  const probe = mount(mod.useFocusedErrorAnnouncement, null);
  try {
    probe.update('Could not load the shopping list.');
    assert.deepEqual(announced, []);
    setFocus(true);
    assert.deepEqual(announced, ['Could not load the shopping list.']);
  } finally { probe.unmount(); }
});

test('returning to a screen that still shows its error announces it again', () => {
  const { mod, announced, setFocus } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, 'Could not load the shopping list.');
  try {
    setFocus(false);
    setFocus(true);
    assert.deepEqual(announced, ['Could not load the shopping list.', 'Could not load the shopping list.']);
  } finally { probe.unmount(); }
});

test('a focused screen announces a new error when it appears', () => {
  const { mod, announced } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, null);
  try {
    assert.deepEqual(announced, []);
    probe.update('Could not load the pantry.');
    assert.deepEqual(announced, ['Could not load the pantry.']);
  } finally { probe.unmount(); }
});

test('iOS makes no announcement', () => {
  const { mod, announced } = setup('ios');
  const a = mount(mod.useErrorAnnouncement, 'Could not load.');
  const b = mount(mod.useFocusedErrorAnnouncement, 'Could not load.');
  try {
    assert.deepEqual(announced, []);
  } finally { a.unmount(); b.unmount(); }
});

test('InlineError keeps one polite live region mounted and puts the alert inside it', () => {
  const { InlineError } = load('components/InlineError.tsx', {
    'react-native': { Text: 'Text', View: 'View' },
  });
  let renderer;
  act(() => { renderer = create(React.createElement(InlineError, { message: null, testID: 'err' })); });
  try {
    const region = () => renderer.root.find(n => n.type === 'View' && n.props.accessibilityLiveRegion === 'polite');
    const before = region();
    assert.equal(before.props.collapsable, false);
    assert.equal(before.findAllByType('Text').length, 0);
    act(() => renderer.update(React.createElement(InlineError, { message: 'Could not sign out.', testID: 'err' })));
    assert.equal(region(), before);
    const text = region().findByType('Text');
    assert.equal(text.props.accessibilityRole, 'alert');
    assert.equal(text.props.children, 'Could not sign out.');
    assert.equal(text.props.testID, 'err');
  } finally { act(() => renderer.unmount()); }
});
