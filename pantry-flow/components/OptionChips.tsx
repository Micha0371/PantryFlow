import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, typography } from '@/lib/theme';

interface Props {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  labelFor: (key: string) => string;
  testIDPrefix?: string;
  // Names the group for screen readers, e.g. the row's visible label.
  accessibilityLabel?: string;
}

export function OptionChips({
  options,
  value,
  onChange,
  labelFor,
  testIDPrefix,
  accessibilityLabel,
}: Props) {
  return (
    <ScrollView
      horizontal
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <Pressable
            key={opt}
            testID={testIDPrefix ? `${testIDPrefix}-${opt}` : undefined}
            onPress={() => onChange(opt)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[
              styles.chip,
              selected ? styles.chipSelected : styles.chipIdle,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                selected ? styles.chipTextSelected : styles.chipTextIdle,
              ]}
            >
              {labelFor(opt)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.xs, gap: spacing.sm },
  chip: {
    // KAN-100 (L1): at least a 48 dp touch target.
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  chipIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { ...typography.label },
  chipTextIdle: { color: colors.text },
  chipTextSelected: { color: colors.primaryOn, fontWeight: '600' },
});
