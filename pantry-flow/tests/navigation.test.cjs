const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { load } = require('./helpers.cjs');

const t = key => key;
const host = name => ({ children, ...props }) => React.createElement(name, props, children);
const ancestorsOf = node => {
  const names = [];
  for (let p = node.parent; p; p = p.parent) if (typeof p.type === 'string') names.push(p.type);
  return names;
};
const closestAncestor = (node, type) => {
  for (let p = node.parent; p; p = p.parent) if (p.type === type) return p;
};

test('tab layout orders Pantry, Shopping, Settings behind the session gate', () => {
  const Tabs = ({ children }) => React.createElement(React.Fragment, null, children);
  Tabs.Screen = 'TabScreen';
  const { default: Layout } = load('app/(tabs)/_layout.tsx', {
    'expo-router': { Tabs }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/AuthGate': { AuthGate: host('Gate') },
    '@/lib/i18n': { useTranslation: () => ({ t }) },
    '@/lib/theme': { colors: {} },
  });
  let renderer;
  try {
    act(() => { renderer = create(React.createElement(Layout)); });
    const screens = renderer.root.findAllByType('TabScreen');
    assert.deepEqual(screens.map(s => s.props.name), ['index', 'shopping', 'settings']);
    assert.equal(screens[1].props.options.title, 'nav_shopping');
    for (const screen of screens) {
      const gate = closestAncestor(screen, 'Gate');
      assert.ok(gate, 'every tab screen sits under the gate');
      assert.equal(gate.props.requireSession, true);
    }
  } finally { if (renderer) act(() => renderer.unmount()); }
});

test('root layout mounts ShoppingProvider inside the household scope and around the stack', () => {
  const Stack = host('Stack');
  Stack.Screen = 'StackScreen';
  const { default: Layout } = load('app/_layout.tsx', {
    'expo-router': { Stack }, 'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-safe-area-context': { SafeAreaProvider: host('SafeAreaProvider') },
    'react-native-gesture-handler': { GestureHandlerRootView: host('GestureHandlerRootView') },
    '@/lib/i18n': { I18nProvider: host('I18nProvider') },
    '@/hooks/usePantryItems': { PantryProvider: host('PantryProvider') },
    '@/hooks/useShoppingItems': { ShoppingProvider: host('ShoppingProvider') },
    '@/hooks/household-scope': { HouseholdProvider: host('HouseholdProvider') },
    '@/lib/auth': { AuthProvider: host('AuthProvider') },
    '@/components/LanguageSync': { LanguageSync: host('LanguageSync') },
    '@/lib/theme': { colors: {} },
  });
  let renderer;
  try {
    act(() => { renderer = create(React.createElement(Layout)); });
    const stack = renderer.root.findByType('Stack');
    const chain = ancestorsOf(stack);
    assert.deepEqual(chain.slice(0, 4), ['ShoppingProvider', 'PantryProvider', 'HouseholdProvider', 'AuthProvider']);
    const modal = renderer.root.findAllByType('StackScreen').find(s => s.props.name === 'shopping-item/[id]');
    assert.ok(modal, 'shopping edit modal is registered');
    assert.equal(modal.props.options.presentation, 'modal');
  } finally { if (renderer) act(() => renderer.unmount()); }
});

// KAN-27: pins each tab icon's name and colors before moving the icon components out of the layout.
test('each tab icon has its Ionicons name and the focused or muted color', () => {
  const Tabs = ({ children }) => React.createElement(React.Fragment, null, children);
  Tabs.Screen = 'TabScreen';
  const theme = load('lib/theme.ts');
  const { default: Layout } = load('app/(tabs)/_layout.tsx', {
    'expo-router': { Tabs }, '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/components/AuthGate': { AuthGate: host('Gate') },
    '@/lib/i18n': { useTranslation: () => ({ t }) },
    '@/lib/theme': theme,
  });
  let renderer;
  try {
    act(() => { renderer = create(React.createElement(Layout)); });
    const icons = { index: 'cube-outline', shopping: 'cart-outline', settings: 'settings-outline' };
    for (const screen of renderer.root.findAllByType('TabScreen')) {
      for (const [focused, color] of [[true, theme.colors.primary], [false, theme.colors.textMuted]]) {
        let icon;
        act(() => { icon = create(React.createElement(screen.props.options.tabBarIcon, { focused, size: 24, color: 'ignored' })); });
        const node = icon.root.findByType('Icon');
        assert.deepEqual([node.props.name, node.props.size, node.props.color], [icons[screen.props.name], 24, color]);
        act(() => icon.unmount());
      }
    }
  } finally { if (renderer) act(() => renderer.unmount()); }
});
