import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/lib/i18n';
import { colors, radii, spacing, typography } from '@/lib/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
}

// Pinned above the list. Return only dismisses the keyboard; the list filters as you type.
export function SearchField({ value, onChangeText }: Readonly<Props>) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('pantry_search_placeholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityRole="search"
        accessibilityLabel={t('pantry_search_label')}
        returnKeyType="search"
        blurOnSubmit
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        testID="pantry-search"
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t('pantry_search_clear')}
          hitSlop={4}
          style={styles.clear}
          testID="pantry-search-clear"
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
    minHeight: 48,
  },
  input: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  clear: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
