const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// The tests replace the animation-frame globals; put the originals back after each test.
const originalFrames = { request: global.requestAnimationFrame, cancel: global.cancelAnimationFrame };
afterEach(() => {
  for (const [name, original] of [['requestAnimationFrame', originalFrames.request], ['cancelAnimationFrame', originalFrames.cancel]]) {
    if (original === undefined) delete global[name]; else global[name] = original;
  }
});

function setup(os, node, kb = {}) {
  const listeners = [];
  const appState = [];
  const AppState = { addEventListener: (name, cb) => { const l = { name, cb }; appState.push(l);
    return { remove: () => appState.splice(appState.indexOf(l), 1) }; } };
  const Keyboard = { isVisible: () => !!kb.visible, metrics: () => kb.metrics, addListener: (name, cb) => { const l = { name, cb }; listeners.push(l);
    return { remove: () => listeners.splice(listeners.indexOf(l), 1) }; } };
  const { useKeyboardOverlap } = load('hooks/useKeyboardOverlap.ts', { 'react-native': { Keyboard, AppState, Platform: { OS: os } } });
  let value;
  const ref = { current: node };
  const C = () => { value = useKeyboardOverlap(ref); return null; };
  const rafs = [];
  global.requestAnimationFrame = cb => { rafs.push(cb); return rafs.length; };
  global.cancelAnimationFrame = () => {};
  let r; act(() => { r = create(React.createElement(C)); });
  const emit = (name, e) => act(() => listeners.filter(l => l.name === name).forEach(l => l.cb(e)));
  const appChange = st => act(() => appState.filter(l => l.name === 'change').forEach(l => l.cb(st)));
  const frame = () => act(() => rafs.splice(0).forEach(cb => cb(0)));
  return { frame, listeners, appState, appChange, emit, get: () => value, unmount: () => act(() => r.unmount()) };
}
const lateView = () => { const calls = []; return { calls, measureInWindow: cb => calls.push(cb) }; };
const view = bottomY => ({ measureInWindow: cb => cb(0, 0, 100, bottomY) });

test('android: did-show measures the overlap, did-hide resets, unmount removes', () => {
  const h = setup('android', view(800));
  assert.deepEqual(h.listeners.map(l => l.name).sort(), ['keyboardDidHide', 'keyboardDidShow']);
  assert.equal(h.get(), 0);
  h.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 560 } });
  assert.equal(h.get(), 240);
  h.emit('keyboardDidHide', {});
  assert.equal(h.get(), 0);
  h.unmount();
  assert.equal(h.listeners.length, 0);
});

test('ios uses the will events', () => {
  const h = setup('ios', view(800));
  assert.deepEqual(h.listeners.map(l => l.name).sort(), ['keyboardWillHide', 'keyboardWillShow']);
  h.emit('keyboardWillShow', { endCoordinates: { height: 300, screenY: 500 } });
  assert.equal(h.get(), 300);
  h.unmount();
});

test('never negative, and is 0 without a view', () => {
  const a = setup('android', view(400));
  a.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 500 } });
  assert.equal(a.get(), 0);
  a.unmount();
  const b = setup('android', null);
  b.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 500 } });
  assert.equal(b.get(), 0);
  b.unmount();
});

test('a measurement that resolves after the keyboard hid is dropped', () => {
  const node = lateView();
  const h = setup('android', node);
  h.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 560 } });
  h.emit('keyboardDidHide', {});
  act(() => node.calls[0](0, 0, 100, 800));
  assert.equal(h.get(), 0);
  h.unmount();
});

test('a newer show wins over an older, late measurement', () => {
  const node = lateView();
  const h = setup('android', node);
  h.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 560 } });
  h.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 600 } });
  act(() => node.calls[1](0, 0, 100, 800));
  act(() => node.calls[0](0, 0, 100, 800));
  assert.equal(h.get(), 200);
  h.unmount();
});

test('becoming active again resets the overlap, and unmount removes the AppState subscription', () => {
  const h = setup('android', view(800));
  h.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 560 } });
  assert.equal(h.get(), 240);
  h.appChange('background');
  assert.equal(h.get(), 240);
  h.appChange('active');
  assert.equal(h.get(), 0);
  assert.equal(h.appState.length, 1);
  h.unmount();
  assert.equal(h.appState.length, 0);
});

test('a keyboard already visible at mount seeds the overlap on the next frame', () => {
  const h = setup('android', view(800), { visible: true, metrics: { screenY: 560, height: 240 } });
  assert.equal(h.get(), 0);
  h.frame();
  assert.equal(h.get(), 240);
  h.emit('keyboardDidHide', {});
  assert.equal(h.get(), 0);
  h.unmount();
});

test('the mount seed is dropped if the keyboard hid before the frame, and skipped when hidden or without metrics', () => {
  const a = setup('android', view(800), { visible: true, metrics: { screenY: 560, height: 240 } });
  a.emit('keyboardDidHide', {});
  a.frame();
  assert.equal(a.get(), 0);
  a.unmount();
  const b = setup('android', view(800), { visible: false });
  b.frame();
  assert.equal(b.get(), 0);
  b.unmount();
  const c = setup('android', view(800), { visible: true, metrics: undefined });
  c.frame();
  assert.equal(c.get(), 0);
  c.unmount();
});
