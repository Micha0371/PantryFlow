import React, { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { StatusBadge } from './StatusBadge';
import { useTranslation } from '@/lib/i18n';
import type { Frame } from '@/lib/status-menu';
import type { ViewRef } from './StatusSelector';
import type { PantryItem as PantryItemData } from '@/hooks/usePantryItems';

interface Props {
  item: PantryItemData;
  onPress: () => void;
  onStatusPress: (anchor: Frame, ref: React.RefObject<ViewRef | null>) => void;
  editDisabled?: boolean;
  statusDisabled?: boolean;
  statusBusy?: boolean;
  statusExpanded?: boolean;
}

// Two sibling controls inside one card: the content opens the editor, the status
// control opens the anchored selector. Neither is nested in the other.
export function PantryItem({
  item, onPress, onStatusPress, editDisabled, statusDisabled, statusBusy, statusExpanded,
}: Props) {
  const { t } = useTranslation();
  const statusRef = useRef<ViewRef>(null);

  const openStatus = () => {
    statusRef.current?.measureInWindow((x, y, width, height) => {
      onStatusPress({ x, y, width, height }, statusRef);
    });
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        disabled={editDisabled}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${t(`cat_${item.category}`)}, ${t(`loc_${item.location}`)}`}
        accessibilityHint={t('item_edit_hint')}
        accessibilityState={{ disabled: !!editDisabled }}
        style={({ pressed }) => [styles.content, pressed && styles.pressed]}
        testID={`pantry-item-${item.id}`}
      >
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {t(`cat_${item.category}`)} · {t(`loc_${item.location}`)}
        </Text>
      </Pressable>
      <Pressable
        ref={statusRef}
        onPress={openStatus}
        disabled={statusDisabled}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${t(`status_${item.status}`)}`}
        accessibilityHint={t('status_change_hint')}
        accessibilityState={{ disabled: !!statusDisabled, busy: !!statusBusy, expanded: !!statusExpanded }}
        style={({ pressed }) => [styles.status, pressed && styles.pressed]}
        testID={`pantry-item-status-${item.id}`}
      >
        <StatusBadge status={item.status} outlined />
        {statusBusy ? (
          <ActivityIndicator size="small" color={colors.textMuted} style={styles.spinner} />
        ) : (
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} style={styles.chevron} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.75 },
  content: { flex: 1, justifyContent: 'center', padding: spacing.lg, minHeight: 48 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  chevron: { marginLeft: spacing.xs },
  spinner: { marginLeft: spacing.xs },
  name: { ...typography.heading, color: colors.text, marginBottom: 2 },
  meta: { ...typography.small, color: colors.textMuted },
});
