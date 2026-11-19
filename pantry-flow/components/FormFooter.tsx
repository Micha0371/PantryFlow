import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { colors, spacing } from '@/lib/theme';

type Props = {
  children: React.ReactNode;
  // How far the keyboard covers the screen's bottom edge, in dp (0 when hidden).
  overlap: number;
  // Reports the footer's own height without the keyboard lift, so a scroll view
  // can reserve room for it: footer height + overlap is what covers its bottom.
  onLayoutHeight?: (height: number) => void;
};

// Primary actions of a modal form, pinned above the keyboard.
export function FormFooter({ children, overlap, onLayoutHeight }: Props) {
  const onLayout = (e: LayoutChangeEvent) => {
    onLayoutHeight?.(Math.max(0, e.nativeEvent.layout.height - overlap));
  };
  return (
    <View
      style={[styles.footer, { paddingBottom: spacing.xl + overlap }]}
      onLayout={onLayout}
      testID="form-footer"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
