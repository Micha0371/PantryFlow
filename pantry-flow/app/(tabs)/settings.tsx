import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { OptionChips } from '@/components/OptionChips';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { isLocale, type Locale } from '@/lib/language';
import { clearPendingLanguage, saveProfileLanguage, setPendingLanguage } from '@/lib/profile-language';
import { colors, spacing, typography } from '@/lib/theme';
import { InlineError } from '@/components/InlineError';

export default function SettingsScreen() {
  const { locale, setLocale, t } = useTranslation();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [languageError, setLanguageError] = useState(false);
  // The newest requested language; writes run one after another and skip a superseded choice.
  const latest = useRef<Locale>(locale);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const persist = (userId: string, next: Locale) => {
    queue.current = queue.current.then(async () => {
      if (latest.current !== next) return;
      try {
        await saveProfileLanguage(userId, next);
        if (latest.current !== next) return;
        await clearPendingLanguage(userId);
        setLanguageError(false);
      } catch {
        if (latest.current === next) setLanguageError(true);
      }
    });
  };

  const onChooseLanguage = (key: string) => {
    if (!isLocale(key)) return;
    latest.current = key;
    setLanguageError(false);
    setLocale(key);
    if (!user) return;
    const userId = user.id;
    // The pending record survives a failed or interrupted save until a write succeeds.
    queue.current = queue.current.then(() => setPendingLanguage(userId, key).catch(() => {}));
    persist(userId, key);
  };

  const onRetryLanguage = () => {
    if (!user) return;
    setLanguageError(false);
    persist(user.id, latest.current);
  };

  const onSignOut = async () => {
    setError(false);
    setSubmitting(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container} testID="settings-screen">
        <InlineError message={error ? t('err_signout') : null} />
        <View style={styles.language}>
          <Text style={styles.languageLabel}>{t('settings_language')}</Text>
          <OptionChips
            options={['en', 'de']}
            value={locale}
            onChange={onChooseLanguage}
            labelFor={(key) => (key === 'de' ? 'Deutsch' : 'English')}
            testIDPrefix="settings-language"
          />
          <InlineError
            message={languageError ? t('err_language_save') : null}
            testID="settings-language-error"
          />
          {languageError ? (
            <Button
              label={t('common_retry')}
              onPress={onRetryLanguage}
              variant="secondary"
              testID="settings-language-retry"
            />
          ) : null}
        </View>
        <Button
          label={t('auth_logout')}
          onPress={onSignOut}
          variant="danger"
          loading={submitting}
          testID="settings-signout"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  language: { gap: spacing.md, marginBottom: spacing.md },
  languageLabel: { ...typography.label, color: colors.text },
  container: { flex: 1, padding: spacing.xl, justifyContent: 'flex-start' },
});
