const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

function setup(os, node) {
  const listeners = [];
  const appState = [];
  const AppState = { addEventListener: (name, cb) => { const l = { name, cb }; appState.push(l);
    return { remove: () => appState.splice(appState.indexOf(l), 1) }; } };
  const Keyboard = { addListener: (name, cb) => { const l = { name, cb }; listeners.push(l);
    return { remove: () => listeners.splice(listeners.indexOf(l), 1) }; } };
  const { useKeyboardOverlap } = load('hooks/useKeyboardOverlap.ts', { 'react-native': { Keyboard, AppState, Platform: { OS: os } } });
  let value;
  const ref = { current: node };
  const C = () => { value = useKeyboardOverlap(ref); return null; };
  let r; act(() => { r = create(React.createElement(C)); });
  const emit = (name, e) => act(() => listeners.filter(l => l.name === name).forEach(l => l.cb(e)));
  const appChange = st => act(() => appState.filter(l => l.name === 'change').forEach(l => l.cb(st)));
  return { listeners, appState, appChange, emit, get: () => value, unmount: () => act(() => r.unmount()) };
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
