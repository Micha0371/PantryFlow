const { test, mock } = require('node:test');
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

// On focus, the announcement waits until TalkBack has spoken the selected tab;
// otherwise "Shopping selected" cuts it off (KAN-39 phone check, 2026-11-18).
const withTimers = fn => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try { fn(ms => act(() => mock.timers.tick(ms))); } finally { mock.timers.reset(); }
};

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

test('a focused screen announces its error once, after the tab has been spoken', () => withTimers(tick => {
  const { mod, announced } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, 'Could not load the shopping list.');
  try {
    assert.equal(mod.FOCUS_ANNOUNCEMENT_DELAY_MS, 1000);
    tick(999);
    assert.deepEqual(announced, []);
    tick(1);
    assert.deepEqual(announced, ['Could not load the shopping list.']);
    tick(5000);
    assert.deepEqual(announced, ['Could not load the shopping list.']);
  } finally { probe.unmount(); }
}));

test('leaving the screen before the delay ends cancels the announcement', () => withTimers(tick => {
  const { mod, announced, setFocus } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, 'Could not load the shopping list.');
  try {
    tick(500);
    setFocus(false);
    tick(1000);
    assert.deepEqual(announced, []);
  } finally { probe.unmount(); }
}));

test('an error on an unfocused screen waits until the screen is focused', () => withTimers(tick => {
  const { mod, announced, setFocus, focus } = setup();
  focus.focused = false;
  const probe = mount(mod.useFocusedErrorAnnouncement, null);
  try {
    probe.update('Could not load the shopping list.');
    tick(2000);
    assert.deepEqual(announced, []);
    setFocus(true);
    tick(1000);
    assert.deepEqual(announced, ['Could not load the shopping list.']);
  } finally { probe.unmount(); }
}));

test('returning to a screen that still shows its error announces it again', () => withTimers(tick => {
  const { mod, announced, setFocus } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, 'Could not load the shopping list.');
  try {
    tick(1000);
    setFocus(false);
    setFocus(true);
    tick(1000);
    assert.deepEqual(announced, ['Could not load the shopping list.', 'Could not load the shopping list.']);
  } finally { probe.unmount(); }
}));

test('an error that appears on the visible screen is announced at once, as after Try again', () => withTimers(tick => {
  const { mod, announced } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, null);
  try {
    tick(1000);
    probe.update('Could not load the pantry.');
    assert.deepEqual(announced, ['Could not load the pantry.']);
    tick(2000);
    assert.deepEqual(announced, ['Could not load the pantry.']);
  } finally { probe.unmount(); }
}));

test('iOS makes no announcement', () => withTimers(tick => {
  const { mod, announced } = setup('ios');
  const a = mount(mod.useErrorAnnouncement, 'Could not load.');
  const b = mount(mod.useFocusedErrorAnnouncement, 'Could not load.');
  try {
    tick(2000);
    assert.deepEqual(announced, []);
  } finally { a.unmount(); b.unmount(); }
}));

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

test('an error that appears during the delay after focus is spoken when the delay ends (final review I2)', () => withTimers(tick => {
  const { mod, announced } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, null);
  try {
    tick(300);
    probe.update('Could not load the pantry.');
    assert.deepEqual(announced, [], 'TalkBack is still speaking the screen');
    tick(700);
    assert.deepEqual(announced, ['Could not load the pantry.']);
  } finally { probe.unmount(); }
}));

test('an error cleared and re-shown during the delay is spoken once (final review M1)', () => withTimers(tick => {
  const { mod, announced } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, 'E');
  try {
    tick(200);
    probe.update(null);
    probe.update('E');
    probe.update('B');
    probe.update('E');
    tick(800);
    assert.deepEqual(announced, ['E']);
  } finally { probe.unmount(); }
}));

test('an error that is gone when the delay ends is not spoken', () => withTimers(tick => {
  const { mod, announced } = setup();
  const probe = mount(mod.useFocusedErrorAnnouncement, 'E');
  try {
    tick(500);
    probe.update(null);
    tick(500);
    assert.deepEqual(announced, []);
  } finally { probe.unmount(); }
}));
