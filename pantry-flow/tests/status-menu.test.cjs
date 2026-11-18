const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');
const { placeMenu } = load('lib/status-menu.ts');

const screen = { width: 400, height: 800 };
const insets = { top: 24, bottom: 24 };
const menu = { width: 180, height: 160 };

test('opens below when there is room above the bottom inset', () => {
  const r = placeMenu({ x: 300, y: 200, width: 90, height: 56 }, menu, screen, insets);
  assert.equal(r.placement, 'below');
  assert.equal(r.top, 200 + 56 + 4);
});

test('flips above for the last row near the bottom', () => {
  const r = placeMenu({ x: 300, y: 700, width: 90, height: 56 }, menu, screen, insets);
  assert.equal(r.placement, 'above');
  assert.equal(r.top, 700 - 4 - 160);
});

test('keeps a 16 dp margin from the right and left edges', () => {
  const right = placeMenu({ x: 330, y: 200, width: 90, height: 56 }, menu, screen, insets);
  assert.ok(right.left + menu.width <= screen.width - 16);
  const left = placeMenu({ x: -20, y: 200, width: 30, height: 56 }, menu, screen, insets);
  assert.ok(left.left >= 16);
});

test('opens centered when neither side fits (large font scale)', () => {
  const tall = { width: 180, height: 500 };
  const r = placeMenu({ x: 300, y: 400, width: 90, height: 56 }, tall, screen, insets);
  assert.equal(r.placement, 'center');
  assert.equal(r.top, Math.round((24 + (800 - 24) - 500) / 2));
});

test('never overlaps the top inset', () => {
  for (const y of [0, 10, 100, 400, 750]) {
    for (const h of [100, 300, 700, 900]) {
      const r = placeMenu({ x: 300, y, width: 90, height: 56 }, { width: 180, height: h }, screen, insets);
      assert.ok(r.top >= insets.top, `y=${y} h=${h} top=${r.top}`);
    }
  }
});
