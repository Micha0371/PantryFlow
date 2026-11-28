import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { NewPasswordField, newPasswordMessage } from '@/components/NewPasswordField';
import { useAuth } from '@/lib/auth';
import { signUpErrorKey } from '@/lib/auth-error';
import { evaluateNewPassword } from '@/lib/password-policy';
import { useTranslation } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';
import { useFormError } from '@/hooks/useFormError';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const router = useRouter();
  // Edge-to-edge Android does not resize for the keyboard, so the ScrollView pads
  // by the measured overlap. iOS keeps KeyboardAvoidingView padding and needs none.
  const screenRef = useRef<React.ComponentRef<typeof SafeAreaView>>(null);
  const keyboardOverlap = useKeyboardOverlap(screenRef);
  const overlap = Platform.OS === 'android' ? keyboardOverlap : 0;

  const [confirmation, setConfirmation] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { error, failures, setError } = useFormError();
  const submitLock = useRef(false);

  const onSubmit = async () => {
    if (submitLock.current) return;
    // Section 2.6: a refused submit shows the status line's text as the error and sends nothing. The
    // password itself is sent exactly as typed (no trimming, truncation or normalization).
    const evaluation = evaluateNewPassword(password);
    if (!evaluation.meetsMinimum || evaluation.tooLong) {
      setError(newPasswordMessage(evaluation, t));
      return;
    }
    submitLock.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const outcome = await signUp(name.trim(), email.trim(), password);
      if (outcome === 'signed_in') router.replace('/(tabs)');
      else setConfirmation(true);
    } catch (cause) {
      setError(t(signUpErrorKey(cause, password)));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (confirmation) return <SafeAreaView style={styles.safe}>
    <View style={styles.confirmContainer}>
      <Text style={styles.confirmTitle}>{t('auth_check_email_title')}</Text>
      <Text style={styles.message}>{t('auth_check_email_message')}</Text>
      <Button testID="register-resend-confirmation" label={t('auth_resend_confirmation')} onPress={() => router.replace('/(auth)/confirm-email')} />
      <Button variant="secondary" label={t('auth_go_to_login')} onPress={() => router.replace('/(auth)/login')} />
    </View>
  </SafeAreaView>;

  return (
    <SafeAreaView ref={screenRef} style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + overlap }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t('auth_register_title')}</Text>

          <Input
            label={t('auth_name')}
            placeholder={t('auth_name_placeholder')}
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoCapitalize="words"
            testID="register-name"
          />
          <Input
            label={t('auth_email')}
            placeholder={t('auth_email_placeholder')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            testID="register-email"
          />
          <NewPasswordField
            label={t('auth_password')}
            value={password}
            onChangeText={setPassword}
            testID="register-password"
            error={error}
            announceKey={failures}
          />

          <Button
            label={t('auth_register_button')}
            onPress={onSubmit}
            loading={submitting}
            // A short password can be submitted: the message then says what the policy needs (section 2.6).
            disabled={!name.trim() || !email.trim() || !password}
            style={{ marginTop: spacing.md }}
            testID="register-submit"
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('auth_have_account')} </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable testID="go-login">
                <Text style={styles.switchLink}>{t('auth_go_to_login')}</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  // The "Check your email" view matches confirm-email.tsx: the gap spaces the stack.
  confirmContainer: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.md },
  confirmTitle: { ...typography.title, color: colors.text },
  message: { ...typography.body, color: colors.textMuted },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  switchText: { ...typography.body, color: colors.textMuted },
  switchLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
