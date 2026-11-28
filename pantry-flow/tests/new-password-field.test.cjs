const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-82 / section 2.6 (P08-P14): the shared new-password field. The policy line is the field's hint,
// the status line follows every change but is not a live region, announcements come only from
// state changes (plus one paused count), and the visibility toggle never touches the value.
const theme = load('lib/theme.ts');
const { en } = load('lib/i18n/en.ts');
const t = key => en[key];
const AE = String.fromCodePoint(0xe4);
const EMOJI = String.fromCodePoint(0x1f600);
const ACUTE = String.fromCodePoint(0x301);
const CHECK = String.fromCodePoint(0x2713);
const MET = CHECK + ' Minimum length reached';
const TOO_LONG = 'This password is too long. Letters with accents and emoji take up more space, so use fewer characters.';
const POLICY = 'Use at least 15 characters. Spaces are allowed. A longer passphrase is harder to guess.';

function setup(ctx, { announced = [], initial = '', error = null, os = 'android' } = {}) {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  const { NewPasswordField } = load('components/NewPasswordField.tsx', {
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', StyleSheet: { create: s => s }, Platform: { OS: os } },
    '@/lib/theme': theme, '@/components/Input': { Input: 'Input' },
    '@/lib/i18n': { useTranslation: () => ({ t }) },
    '@/lib/accessibility': { announce: message => announced.push(message) },
    '@/lib/password-policy': load('lib/password-policy.ts'),
  });
  function Host() {
    const [value, setValue] = React.useState(initial);
    return React.createElement(NewPasswordField, { label: 'Password', value, onChangeText: setValue, error, announceKey: 0, testID: 'pw' });
  }
  let renderer;
  act(() => { renderer = create(React.createElement(Host)); });
  ctx.after(() => { try { act(() => renderer.unmount()); } catch { /* already unmounted */ } });
  const textOf = node => [node.props.children].flat(Infinity).filter(c => c !== null && c !== undefined && c !== false).join('');
  const api = {
    announced, renderer,
    input: () => renderer.root.findByType('Input'),
    type: value => act(() => api.input().props.onChangeText(value)),
    typeOneByOne: value => { for (const char of Array.from(value)) api.type(api.input().props.value + char); },
    policy: () => renderer.root.findByProps({ testID: 'pw-policy' }),
    status: () => renderer.root.findAllByProps({ testID: 'pw-status' }).filter(n => typeof n.type === 'string')[0] ?? null,
    statusText: () => { const s = api.status(); return s ? textOf(s) : null; },
    toggle: () => renderer.root.findByProps({ testID: 'pw-toggle' }),
    tick: ms => act(() => ctx.mock.timers.tick(ms)),
    allText: () => renderer.root.findAll(n => n.type === 'Text').map(textOf).join('\n'),
  };
  return api;
}

test('P08: the policy line is visible before any input, reaches the screen reader, and promises nothing about composition', ctx => {
  const f = setup(ctx);
  assert.equal(textOfNode(f.policy()), POLICY);
  // Android (phone check 2026-11-28): React Native drops accessibilityHint on a text field, so TalkBack
  // read only "Bearbeitungsfeld". The policy is part of the field's accessible name there instead.
  assert.equal(f.input().props.accessibilityLabel, 'Password, ' + POLICY);
  assert.equal(f.input().props.accessibilityHint, undefined, 'no hint on Android, so nothing is read twice');
  assert.equal(f.input().props.placeholder, undefined, 'a placeholder disappears on the first keystroke');
  assert.equal(f.status(), null, 'an empty field shows only the policy line');
  assert.deepEqual(f.announced, []);
  assert.doesNotMatch(f.allText(), /uppercase|digit|special|number|symbol/i);
  f.type('abc');
  assert.equal(textOfNode(f.policy()), POLICY, 'the policy line stays while typing');
});
function textOfNode(node) { return [node.props.children].flat(Infinity).join(''); }

test('P12: autofill and keyboard attributes of a new-password field; paste is not blocked', ctx => {
  const p = setup(ctx).input().props;
  assert.equal(p.autoComplete, 'new-password');
  assert.equal(p.textContentType, 'newPassword');
  assert.equal(p.autoCorrect, false);
  assert.equal(p.autoCapitalize, 'none');
  assert.equal(p.secureTextEntry, true);
  assert.equal(p.contextMenuHidden, undefined);
  assert.equal(p.onPaste, undefined);
  assert.equal(p.testID, 'pw');
});

test('P09: the status line counts what is still needed, with the number as its own text', ctx => {
  const f = setup(ctx);
  f.type('a');
  assert.equal(f.statusText(), '14 more characters needed');
  f.type('a'.repeat(13));
  assert.equal(f.statusText(), '2 more characters needed');
  f.type('a'.repeat(14));
  assert.equal(f.statusText(), '1 more character needed', 'singular for the last one');
  f.type('a'.repeat(15));
  assert.equal(f.statusText(), MET);
  f.type('');
  assert.equal(f.status(), null, 'emptying the field returns to the policy line only');
  f.type('a'.repeat(20));
  assert.equal(f.statusText(), MET);
  // The number is its own child, so the phrase stays a plain catalogue string.
  f.type('a');
  const children = [f.status().props.children].flat();
  assert.ok(children.includes(14) || children.includes('14'));
  assert.ok(children.includes(en.auth_password_remaining_many));
});

test('P09: code points, not UTF-16 units or visible characters', ctx => {
  const f = setup(ctx);
  f.type(EMOJI.repeat(14));
  assert.equal(f.statusText(), '1 more character needed');
  f.type(EMOJI.repeat(15));
  assert.equal(f.statusText(), MET);
  f.type(('e' + ACUTE).repeat(7));
  assert.equal(f.statusText(), '1 more character needed', '7 x (e + U+0301) are 14 code points');
  f.type(' '.repeat(15));
  assert.equal(f.statusText(), MET, 'spaces count');
});

test('P10: more than 72 bytes is too long; the boundary is met, never trimmed', ctx => {
  const f = setup(ctx);
  for (const ok of ['a'.repeat(72), AE.repeat(36), EMOJI.repeat(18)]) {
    f.type(ok);
    assert.equal(f.statusText(), MET);
  }
  for (const bad of ['a'.repeat(73), AE.repeat(37), EMOJI.repeat(19), AE.repeat(64)]) {
    f.type(bad);
    assert.equal(f.statusText(), TOO_LONG);
  }
  f.type(' ' + 'a'.repeat(72));
  assert.equal(f.statusText(), TOO_LONG, 'a leading space is counted');
  f.type('a'.repeat(72) + ' ');
  assert.equal(f.statusText(), TOO_LONG, 'a trailing space is counted');
});

test('P11: nothing says strong or secure, and there is no strength meter', ctx => {
  const f = setup(ctx);
  for (const value of ['', 'a', 'a'.repeat(15), 'a'.repeat(40), 'a'.repeat(80)]) {
    f.type(value);
    assert.doesNotMatch(f.allText(), /strong|secure|safe|weak|good|great/i);
  }
  assert.equal(f.renderer.root.findAll(n => /meter|progress|strength/i.test(String(n.props.testID ?? '') + String(n.props.accessibilityRole ?? ''))).length, 0);
});

test('section 2.6: the status line follows every change but is not a live region, in every state', ctx => {
  const f = setup(ctx);
  // more needed, minimum reached, too long: each state renders its own status text.
  for (const [value, expected] of [['abc', '12 more characters needed'], ['a'.repeat(15), MET], ['a'.repeat(73), TOO_LONG]]) {
    f.type(value);
    assert.equal(f.statusText(), expected);
    const regions = f.renderer.root.findAll(n => n.props.accessibilityLiveRegion !== undefined);
    assert.deepEqual(regions, [], `no live region while showing "${expected}"`);
    assert.equal(f.status().props.accessibilityLiveRegion, undefined);
    assert.equal(f.status().props.accessibilityRole, undefined, 'not an alert either: errors use the form-error mechanism');
  }
});

test('P12: the visibility toggle switches secureTextEntry only, with label, state, role and a 48 dp target', ctx => {
  const f = setup(ctx);
  f.type('correct horse battery');
  const before = f.input().props.value;
  const spoken = f.announced.length;
  assert.equal(f.toggle().props.accessibilityRole, 'button');
  assert.equal(f.toggle().props.accessibilityLabel, 'Show password');
  assert.equal(f.toggle().props.accessibilityState.selected, false);
  assert.equal(f.input().props.secureTextEntry, true);
  const size = Object.assign({}, ...[f.toggle().props.style].flat(Infinity).filter(Boolean));
  assert.ok(size.minHeight >= 48, 'minHeight');
  assert.ok(size.minWidth >= 48, 'minWidth');
  act(() => f.toggle().props.onPress());
  assert.equal(f.input().props.secureTextEntry, false);
  assert.equal(f.toggle().props.accessibilityLabel, 'Hide password');
  assert.equal(f.toggle().props.accessibilityState.selected, true);
  assert.equal(f.input().props.value, before, 'the value is untouched');
  assert.equal(f.announced.length, spoken, 'toggling announces nothing');
  act(() => f.toggle().props.onPress());
  assert.equal(f.input().props.secureTextEntry, true);
  assert.equal(f.input().props.value, before);
  assert.equal(f.toggle().props.accessibilityLabel, 'Show password');
});

test('P13: typing 20 characters one by one announces only the two state changes', ctx => {
  const f = setup(ctx);
  f.typeOneByOne('a'.repeat(20));
  assert.deepEqual(f.announced, ['14 more characters needed', MET]);
  f.tick(10000);
  assert.deepEqual(f.announced, ['14 more characters needed', MET], 'no paused count once the minimum is met');
});

test('P13: a paused count is announced once, 1000 ms after the last input, only when it changed', ctx => {
  const f = setup(ctx);
  f.type('a');
  assert.deepEqual(f.announced, ['14 more characters needed']);
  f.tick(5000);
  assert.deepEqual(f.announced, ['14 more characters needed'], 'the count was just announced: nothing to repeat');
  f.type('aaaa');
  assert.equal(f.announced.length, 1, 'typing within a state is silent');
  f.tick(999);
  assert.equal(f.announced.length, 1, 'not before the full second');
  f.type('aaaaa');
  f.tick(999);
  assert.equal(f.announced.length, 1, 'more input restarts the second');
  f.tick(1);
  assert.deepEqual(f.announced.slice(1), ['10 more characters needed']);
  f.tick(10000);
  assert.equal(f.announced.length, 2, 'at most once per pause');
});

test('P13: deleting and pasting follow the state-change rule only', ctx => {
  const f = setup(ctx);
  f.type('a'.repeat(20));
  assert.deepEqual(f.announced, [MET], 'pasting 20 characters goes straight to the minimum');
  f.type('a'.repeat(19));
  f.type('a'.repeat(16));
  assert.deepEqual(f.announced, [MET], 'deleting within a state is silent');
  f.type('a'.repeat(14));
  assert.deepEqual(f.announced, [MET, '1 more character needed'], 'dropping below the minimum is a state change');
  f.tick(5000);
  assert.equal(f.announced.length, 2, 'its count was just spoken');
  f.type('a'.repeat(10));
  f.type('a'.repeat(4));
  f.tick(1000);
  assert.deepEqual(f.announced.slice(2), ['11 more characters needed'], 'deleting then pausing announces the count once');
  f.type('');
  f.tick(5000);
  assert.equal(f.announced.length, 3, 'emptying announces nothing and cancels the paused count');
});

test('P13: becoming too long announces once, and back again announces the new state', ctx => {
  const f = setup(ctx);
  f.type('a'.repeat(72));
  assert.deepEqual(f.announced, [MET]);
  f.type('a'.repeat(73));
  assert.deepEqual(f.announced, [MET, TOO_LONG]);
  f.type('a'.repeat(74));
  f.type('a'.repeat(80));
  f.tick(5000);
  assert.deepEqual(f.announced, [MET, TOO_LONG], 'still too long: silent');
  f.type('a'.repeat(72));
  assert.deepEqual(f.announced, [MET, TOO_LONG, MET]);
  f.type(AE.repeat(37));
  assert.deepEqual(f.announced.at(-1), TOO_LONG);
});

test('P13: a password already present at mount (autofill) is not announced; an unmount cancels a pending count', ctx => {
  const announced = [];
  const f = setup(ctx, { announced, initial: 'abc' });
  f.tick(5000);
  assert.deepEqual(announced, []);
  f.type('abcd');
  act(() => f.renderer.unmount());
  ctx.mock.timers.tick(5000);
  assert.deepEqual(announced, []);
});

test('the field passes the error and announceKey to the input', ctx => {
  const f = setup(ctx, { error: 'Something' });
  assert.equal(f.input().props.error, 'Something');
  assert.equal(f.input().props.announceKey, 0);
  assert.equal(f.input().props.label, 'Password');
});

test('P08 on iOS: the label is the accessible name and the policy is the hint', ctx => {
  const f = setup(ctx, { os: 'ios' });
  assert.equal(f.input().props.accessibilityLabel, 'Password');
  assert.equal(f.input().props.accessibilityHint, POLICY);
});

// Owner decision 2026-11-28 (phone check): after a refused submit only the red error shows, not the same
// text again in the status line. The policy line stays; typing again brings the status line back.
test('while the field shows an error, the status line is hidden and the policy line stays', ctx => {
  const f = setup(ctx, { initial: 'a'.repeat(80), error: TOO_LONG });
  assert.equal(f.status(), null, 'no second copy of the error');
  assert.equal(textOfNode(f.policy()), POLICY);
  assert.equal(f.input().props.error, TOO_LONG);
});

test('the status line is hidden by an error in the "more needed" state too, which renders its own text', ctx => {
  const f = setup(ctx, { initial: 'abc', error: '12 more characters needed' });
  assert.equal(f.status(), null);
  assert.equal(textOfNode(f.policy()), POLICY);
});
