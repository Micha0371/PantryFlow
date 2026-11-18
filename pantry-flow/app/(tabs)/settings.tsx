import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';
import { InlineError } from '@/components/InlineError';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  container: { flex: 1, padding: spacing.xl, justifyContent: 'flex-start' },
});
