const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

function setup(os, node) {
  const listeners = [];
  const Keyboard = { addListener: (name, cb) => { const l = { name, cb }; listeners.push(l);
    return { remove: () => listeners.splice(listeners.indexOf(l), 1) }; } };
  const { useKeyboardOverlap } = load('hooks/useKeyboardOverlap.ts', { 'react-native': { Keyboard, Platform: { OS: os } } });
  let value;
  const ref = { current: node };
  const C = () => { value = useKeyboardOverlap(ref); return null; };
  let r; act(() => { r = create(React.createElement(C)); });
  const emit = (name, e) => act(() => listeners.filter(l => l.name === name).forEach(l => l.cb(e)));
  return { listeners, emit, get: () => value, unmount: () => act(() => r.unmount()) };
}
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

test('never negative, and falls back to the keyboard height without a view', () => {
  const a = setup('android', view(400));
  a.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 500 } });
  assert.equal(a.get(), 0);
  a.unmount();
  const b = setup('android', null);
  b.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 500 } });
  assert.equal(b.get(), 300);
  b.unmount();
});
