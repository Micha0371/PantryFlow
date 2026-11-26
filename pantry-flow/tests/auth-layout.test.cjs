const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

// KAN-96 H1 (auth) and H2: keyboard-safe sign-in/registration, aligned confirmation views.
const theme = load('lib/theme.ts');
const t = key => key;
const flat = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

function stubs(os, overlap) {
  return {
    'react-native': { Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView',
      KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'Spinner', Platform: { OS: os },
      StyleSheet: { create: s => s } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { Link: 'Link', useRouter: () => ({ replace: () => {} }), useLocalSearchParams: () => ({}) },
    '@/lib/theme': theme, '@/lib/i18n': { useTranslation: () => ({ t }) },
    '@/components/Button': { Button: 'Button' }, '@/components/Input': { Input: 'Input' },
    '@/hooks/useKeyboardOverlap': { useKeyboardOverlap: () => overlap },
    '@/hooks/useFormError': load('hooks/useFormError.ts'),
    '@/lib/sign-in-error': load('lib/sign-in-error.ts'),
    '@/lib/email-confirmation': { confirmationCode: () => null, confirmEmail: async () => {}, resendConfirmation: async () => {} },
    '@/lib/auth': { useAuth: () => ({ signIn: async () => {}, signUp: async () => 'confirmation_required' }) },
  };
}

function mount(file, os = 'android', overlap = 240) {
  const { default: Screen } = load(file, stubs(os, overlap));
  let renderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  return renderer;
}

for (const file of ['app/(auth)/login.tsx', 'app/(auth)/register.tsx']) {
  test(`${file}: sign-in and registration add the keyboard overlap to the ScrollView bottom padding`, () => {
    const android = mount(file, 'android', 240);
    const ios = mount(file, 'ios', 240);
    try {
      assert.equal(flat(android.root.findByType('ScrollView').props.contentContainerStyle).paddingBottom,
        theme.spacing.xl + 240);
      assert.equal(flat(ios.root.findByType('ScrollView').props.contentContainerStyle).paddingBottom,
        theme.spacing.xl, 'iOS keeps KeyboardAvoidingView and applies no overlap');
      assert.equal(ios.root.findByType('KeyboardAvoidingView').props.behavior, 'padding');
    } finally { act(() => { android.unmount(); ios.unmount(); }); }
  });
}

async function registered() {
  const r = mount('app/(auth)/register.tsx', 'ios', 0);
  const inputs = r.root.findAllByType('Input');
  act(() => { inputs[0].props.onChangeText('Alice'); inputs[1].props.onChangeText('a@example.com'); inputs[2].props.onChangeText('password'); });
  await act(async () => r.root.findByType('Button').props.onPress());
  return r;
}

test('the post-registration view stacks message, Resend and Go to sign in with gap 12, Resend first', async () => {
  const r = await registered();
  try {
    const container = r.root.findByType('SafeAreaView').findByType('View');
    assert.equal(flat(container.props.style).gap, theme.spacing.md);
    assert.equal(theme.spacing.md, 12);
    const order = container.children.map(c => c.props.testID || c.props.label || c.props.children);
    assert.deepEqual(order, ['auth_check_email_title', 'auth_check_email_message',
      'register-resend-confirmation', 'auth_go_to_login']);
    const buttons = r.root.findAllByType('Button');
    assert.equal(buttons[0].props.testID, 'register-resend-confirmation');
    assert.equal(buttons[1].props.label, 'auth_go_to_login');
    assert.equal(buttons[1].props.testID, undefined);
  } finally { act(() => r.unmount()); }
});

test("the post-registration title spacing equals confirm-email's", async () => {
  const r = await registered();
  const c = mount('app/(auth)/confirm-email.tsx', 'ios', 0);
  try {
    const regTitle = flat(r.root.findAllByType('Text').find(n => n.props.children === 'auth_check_email_title').props.style);
    const confTitle = flat(c.root.findAllByType('Text').find(n => n.props.children === 'auth_check_email_title').props.style);
    assert.deepEqual(regTitle, confTitle);
    const regC = flat(r.root.findByType('SafeAreaView').findByType('View').props.style);
    const confC = flat(c.root.findByType('ScrollView').props.contentContainerStyle);
    for (const k of ['padding', 'paddingTop', 'gap']) assert.equal(regC[k], confC[k], k);
    assert.equal(regC.paddingBottom, undefined);
  } finally { act(() => { r.unmount(); c.unmount(); }); }
});

test('Go to sign in uses the secondary variant on all three confirmation screens', async () => {
  const r = await registered();
  const c = mount('app/(auth)/confirm-email.tsx', 'ios', 0);
  const cb = load('app/auth/callback.tsx', { ...stubs('ios', 0),
    '@/lib/auth': { useAuth: () => ({ loading: false, user: null }) } }).default;
  let k;
  act(() => { k = create(React.createElement(cb)); }); // no code: the invalid phase shows the actions
  try {
    const login = (root, id) => id ? root.findByProps({ testID: id }) : root.findAllByType('Button').find(b => b.props.label === 'auth_go_to_login');
    for (const [root, id] of [[r.root, null], [c.root, 'confirmation-back-login'], [k.root, 'confirmation-login']]) {
      const b = login(root, id);
      assert.equal(b.props.variant, 'secondary');
      assert.equal(b.props.label, 'auth_go_to_login');
    }
    assert.notEqual(r.root.findByProps({ testID: 'register-resend-confirmation' }).props.variant, 'secondary');
    assert.notEqual(c.root.findByProps({ testID: 'confirmation-resend' }).props.variant, 'secondary');
  } finally { act(() => { r.unmount(); c.unmount(); k.unmount(); }); }
});
