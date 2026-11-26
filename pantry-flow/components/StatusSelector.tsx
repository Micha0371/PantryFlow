import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, findNodeHandle, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography, StatusKey } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';
import { placeMenu, type Frame } from '@/lib/status-menu';

export type ViewRef = React.ComponentRef<typeof View>;

const MARGIN = 16; // dp kept free at both screen sides
const OPTIONS: StatusKey[] = ['in_stock', 'low', 'out'];

interface Props {
  anchor: Frame | null;
  itemName: string;
  current: StatusKey;
  onSelect: (next: StatusKey) => void;
  onDismiss: () => void;
  returnFocusTo?: React.RefObject<ViewRef | null>;
}

function focusNode(ref: React.RefObject<ViewRef | null> | undefined) {
  const handle = ref?.current ? findNodeHandle(ref.current) : null;
  if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
}

export function StatusSelector({ anchor, itemName, current, onSelect, onDismiss, returnFocusTo }: Props) {
  const { t } = useTranslation();
  const screen = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const currentRef = useRef<ViewRef>(null);
  const returnRef = useRef(returnFocusTo);
  returnRef.current = returnFocusTo;
  const open = anchor != null;

  // Return accessibility focus to the status control when the menu closes.
  useEffect(() => {
    if (!open) return undefined;
    return () => {
      setSize(null);
      focusNode(returnRef.current);
    };
  }, [open]);

  // Once placed, move accessibility focus to the current option.
  const placed = open && size != null;
  useEffect(() => {
    if (placed) focusNode(currentRef);
  }, [placed]);

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  if (!anchor) return null;
  const pos = size ? placeMenu(anchor, size, screen, insets, MARGIN) : null;
  // The menu is invisible until measured and placed; keep it out of the accessibility tree meanwhile.
  const hiddenProps = pos ? {} : { importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true };

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent
      onRequestClose={onDismiss} testID="status-modal">
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}
        accessible={false} importantForAccessibility="no" testID="status-scrim" />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`${t('status_group_label')}, ${itemName}`}
        onLayout={onLayout}
        {...hiddenProps}
        style={[
          styles.menu,
          { maxWidth: Math.max(0, screen.width - 2 * MARGIN) },
          pos ? { top: pos.top, left: pos.left } : styles.hidden,
        ]}
      >
        {OPTIONS.map(status => {
          const checked = status === current;
          return (
            <Pressable
              key={status}
              ref={checked ? currentRef : undefined}
              onPress={() => (checked ? onDismiss() : onSelect(status))}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={t(`status_${status}`)}
              testID={`status-option-${status}`}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={[styles.dot, { backgroundColor: colors.status[status] }]} />
              <Text style={styles.label}>{t(`status_${status}`)}</Text>
              {checked ? <Ionicons name="checkmark" size={20} color={colors.primaryDark} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    minWidth: 160,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  hidden: { top: 0, left: 0, opacity: 0 },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.75 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.md },
  // Grow and shrink from the text's own width (not `flex: 1`, whose zero basis kept the menu at its
  // minimum width and broke words at large font sizes; phone session 2026-11-26).
  label: { ...typography.body, color: colors.text, flexGrow: 1, flexShrink: 1, marginRight: spacing.md },
});
