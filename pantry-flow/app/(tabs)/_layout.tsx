import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthGate } from '@/components/AuthGate';
import { useTranslation } from '@/lib/i18n';
import { colors } from '@/lib/theme';

// Tab icons live outside the layout, so they are stable components (KAN-27).
type IconName = React.ComponentProps<typeof Ionicons>['name'];
function tabIcon(name: IconName) {
  return function TabIcon({ focused, size }: { focused: boolean; size: number }) {
    return <Ionicons name={name} size={size} color={focused ? colors.primary : colors.textMuted} />;
  };
}
const PantryIcon = tabIcon('cube-outline');
const ShoppingIcon = tabIcon('cart-outline');
const SettingsIcon = tabIcon('settings-outline');

export default function TabsLayout() {
  const { t } = useTranslation();


  return (
    <AuthGate requireSession>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav_pantry'),
          tabBarIcon: PantryIcon,
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          title: t('nav_shopping'),
          tabBarIcon: ShoppingIcon,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav_settings'),
          tabBarIcon: SettingsIcon,
        }}
      />
    </Tabs>
    </AuthGate>
  );
}
