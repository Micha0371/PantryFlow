import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/lib/theme';

type Props = {
  children: React.ReactNode;
  // How far the keyboard covers the screen's bottom edge, in dp (0 when hidden).
  overlap: number;
};

// Primary actions of a modal form, last in the screen column, above the keyboard.
export function FormFooter({ children, overlap }: Readonly<Props>) {
  const { bottom } = useSafeAreaInsets();
  // The overlap is measured to the window bottom, so it already includes the
  // navigation bar while the keyboard is open.
  return (
    <View
      style={[styles.footer, { paddingBottom: spacing.xl + Math.max(overlap, bottom) }]}
      testID="form-footer"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
