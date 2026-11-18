import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { InlineError } from './InlineError';
import { announceError } from '@/hooks/useErrorAnnouncement';

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  // Changes on every failed submit. A failed submit that leaves the same error
  // does not change the live region, so it is announced explicitly (KAN-84).
  announceKey?: number;
}

export function Input({ label, error, announceKey, style, ...rest }: Readonly<Props>) {
  const seen = useRef({ key: announceKey, error });
  useEffect(() => {
    const previous = seen.current;
    seen.current = { key: announceKey, error };
    if (announceKey !== previous.key && error && error === previous.error) announceError(error);
  }, [announceKey, error]);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      <InlineError message={error ?? null} style={styles.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
  error: {
    ...typography.small,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
