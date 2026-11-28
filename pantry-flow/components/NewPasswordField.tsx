import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '@/components/Input';
import { announce } from '@/lib/accessibility';
import { useTranslation } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/en';
import { evaluateNewPassword } from '@/lib/password-policy';
import { colors, spacing, typography } from '@/lib/theme';

type Evaluation = ReturnType<typeof evaluateNewPassword>;
type Status = 'empty' | 'needed' | 'met' | 'too_long';
type Translate = (key: TranslationKey) => string;

// Section 2.6 of the password session spec: the state of a new-password value, from the one shared
// evaluator. An empty field shows only the policy line.
function statusOf(evaluation: Evaluation): Status {
  if (evaluation.tooLong) return 'too_long';
  if (evaluation.meetsMinimum) return 'met';
  return evaluation.codePoints === 0 ? 'empty' : 'needed';
}

const remainingKey = (evaluation: Evaluation): TranslationKey =>
  evaluation.remaining === 1 ? 'auth_password_remaining_one' : 'auth_password_remaining_many';

// The text of the status line, or null for an empty field. The count is joined as its own text, as
// t() has no interpolation. A submit that is refused shows this same text as its error.
export function newPasswordMessage(evaluation: Evaluation, t: Translate): string | null {
  const status = statusOf(evaluation);
  if (status === 'empty') return null;
  if (status === 'too_long') return t('auth_password_too_long');
  if (status === 'met') return t('auth_password_minimum_met');
  return `${evaluation.remaining} ${t(remainingKey(evaluation))}`;
}

// A remaining-count announcement waits this long after the last input (section 2.6, N7).
const COUNT_PAUSE_MS = 1000;

interface Props {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  announceKey?: number;
  testID: string;
}

// The new-password field of registration (and, later, reset and change): policy line, live status
// line, visibility toggle and password-manager attributes. Sign-in never uses it.
export function NewPasswordField({ label, value, onChangeText, error, announceKey, testID }: Readonly<Props>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const evaluation = evaluateNewPassword(value);
  const status = statusOf(evaluation);
  const message = newPasswordMessage(evaluation, t);

  // Announcements are separate from the visible status line (N7): only a change of state is spoken,
  // plus one count after a pause. A value present at mount (autofill) is not announced.
  const previous = useRef(status);
  const spokenCount = useRef<number | null>(status === 'needed' ? evaluation.remaining : null);
  useEffect(() => {
    if (status !== previous.current) {
      previous.current = status;
      spokenCount.current = status === 'needed' ? evaluation.remaining : null;
      if (message) announce(message);
    }
    if (status !== 'needed' || spokenCount.current === evaluation.remaining) return;
    const timer = setTimeout(() => {
      spokenCount.current = evaluation.remaining;
      if (message) announce(message);
    }, COUNT_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const policy = t('auth_password_policy');
  // React Native drops accessibilityHint on an Android text field (phone check 2026-11-28: TalkBack read
  // only "Bearbeitungsfeld"), so there the policy is part of the accessible name; iOS keeps it as a hint.
  const android = Platform.OS === 'android';
  // Owner decision 2026-11-28: while an error shows (a refused submit), only the red error is shown, not
  // the same text again in the status line; typing again clears the error and the status line returns.
  let statusLine: React.ReactNode = null;
  if (!error && status === 'needed') {
    // The count is its own text, so the phrase stays a plain catalogue string.
    statusLine = <Text style={styles.status} testID={`${testID}-status`}>{evaluation.remaining}{' '}{t(remainingKey(evaluation))}</Text>;
  } else if (!error && message) {
    statusLine = <Text style={styles.status} testID={`${testID}-status`}>{message}</Text>;
  }
  return (
    <View>
      <Input
        label={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoComplete="new-password"
        textContentType="newPassword"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={android ? `${label}, ${policy}` : label}
        accessibilityHint={android ? undefined : policy}
        testID={testID}
        error={error}
        announceKey={announceKey}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(visible ? 'auth_password_hide' : 'auth_password_show')}
        accessibilityState={{ selected: visible }}
        onPress={() => setVisible(current => !current)}
        style={styles.toggle}
        testID={`${testID}-toggle`}
      >
        <Text style={styles.toggleText}>{t(visible ? 'auth_password_hide' : 'auth_password_show')}</Text>
      </Pressable>
      <Text style={styles.policy} testID={`${testID}-policy`}>{policy}</Text>
      {statusLine}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignSelf: 'flex-start', marginTop: -spacing.sm },
  toggleText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  policy: { ...typography.small, color: colors.textMuted },
  status: { ...typography.small, color: colors.text, marginTop: spacing.xs, marginBottom: spacing.md },
});
