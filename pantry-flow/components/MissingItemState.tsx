import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { useTranslation } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';

interface Props {
  // The already-translated reason the item can't be shown.
  message: string;
  onRetry: () => void;
  onBack: () => void;
}

// KAN-96 H3: the "item not found or failed to load" view of Edit Item and the shopping
// item. Message, Retry and Back stack 12 dp apart and the buttons take the full width.
export function MissingItemState({ message, onRetry, onBack }: Readonly<Props>) {
  const { t } = useTranslation();
  return (
    <View style={styles.missing}>
      <Text style={styles.errorText} accessibilityRole="alert">{message}</Text>
      <Button label={t('common_retry')} onPress={onRetry} />
      <Button label={t('common_back')} onPress={onBack} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center' },
});
