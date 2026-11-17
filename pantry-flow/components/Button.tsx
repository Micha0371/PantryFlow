import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'danger';

const BACKGROUND: Record<Variant, string> = {
  primary: colors.primary,
  secondary: 'transparent',
  danger: colors.danger,
};

function opacityFor(disabled: boolean, pressed: boolean): number {
  if (disabled) return 0.6;
  return pressed ? 0.9 : 1;
}

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  testID,
}: Props) {
  const isDisabled = disabled || loading;

  const bg = BACKGROUND[variant];
  const fg =
    variant === 'secondary' ? colors.text : colors.primaryOn;
  const borderColor =
    variant === 'secondary' ? colors.border : 'transparent';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor, opacity: opacityFor(isDisabled, pressed) },
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  inner: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  label: { ...typography.heading },
});
