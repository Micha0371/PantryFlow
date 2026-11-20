import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { FormFooter } from '@/components/FormFooter';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';
import { Input } from '@/components/Input';
import { AuthGate } from '@/components/AuthGate';
import { useFocusedErrorAnnouncement } from '@/hooks/useErrorAnnouncement';
import { useItemMutation } from '@/hooks/useItemMutation';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { SHOPPING_NAME_MAX, shoppingErrorKey } from '@/lib/shopping-data';
import { useTranslation } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';
import { useFormError } from '@/hooks/useFormError';

export default function EditShoppingItemModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AuthGate requireSession><EditShoppingItemContent key={id} /></AuthGate>;
}

function EditShoppingItemContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { loading, error: loadError, retry, getItem, renameItem, deleteItem } = useShoppingItems();
  // Edge-to-edge Android does not resize for the keyboard, so the footer lifts by
  // the measured overlap. iOS keeps KeyboardAvoidingView padding and needs none.
  const screenRef = useRef<React.ComponentRef<typeof View>>(null);
  const keyboardOverlap = useKeyboardOverlap(screenRef);
  const overlap = Platform.OS === 'android' ? keyboardOverlap : 0;

  const item = id ? getItem(id) : null;

  const [name, setName] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const { busy, run } = useItemMutation();
  const { error, failures, setError } = useFormError();
  // The provider drops a removed row before the delete resolves; until the screen
  // has closed, that is this screen's own remove, not a missing item (KAN-35).
  const removing = useRef(false);

  useEffect(() => {
    if (item && !hydrated) {
      setName(item.name);
      setHydrated(true);
    }
  }, [item, hydrated]);

  const missing = !item && !removing.current && !loading;
  useFocusedErrorAnnouncement(missing ? t(loadError ?? 'err_shopping_missing') : null);

  if (!item && removing.current) return <View style={styles.safe} />;

  if (loading && !item) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.missing}>
        <Text style={styles.errorText} accessibilityRole="alert">
          {t(loadError ?? 'err_shopping_missing')}
        </Text>
        <Button label={t('common_retry')} onPress={() => { void retry(); }} />
        <Button
          label={t('common_back')}
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>
    );
  }

  const onSave = async () => {
    if (busy) return;
    setError(null);
    await run(
      () => renameItem(item.id, name),
      () => router.back(),
      (failure) => setError(t(shoppingErrorKey(failure))),
    );
  };

  const onRemove = () => {
    if (busy) return;
    Alert.alert(
      t('shopping_remove_confirm_title'),
      t('shopping_remove_confirm_message'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('shopping_remove'),
          style: 'destructive',
          onPress: () => { void run(
            () => { removing.current = true; return deleteItem(item.id); },
            () => router.back(),
            (failure) => { removing.current = false; setError(t(shoppingErrorKey(failure))); },
          ); },
        },
      ]
    );
  };

  return (
    <View ref={screenRef} style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t('shopping_edit_title')}</Text>

          <Input
            label={t('item_name')}
            maxLength={SHOPPING_NAME_MAX}
            editable={!busy}
            value={name}
            onChangeText={setName}
            testID="shopping-edit-name"
            error={error}
            announceKey={failures}
          />

          <Button
            label={t('shopping_remove')}
            onPress={onRemove}
            variant="danger"
            disabled={busy}
            style={{ marginTop: spacing.xl }}
            testID="shopping-edit-remove"
          />
        </ScrollView>
        <FormFooter overlap={overlap}>
          <Button
            label={t('common_cancel')}
            onPress={() => router.back()}
            variant="secondary"
            disabled={busy}
            style={{ flex: 1 }}
            testID="shopping-edit-cancel"
          />
          <Button
            label={t('item_save_button')}
            onPress={onSave}
            loading={busy}
            style={{ flex: 1 }}
            testID="shopping-edit-save"
          />
        </FormFooter>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingBottom: spacing.xxl },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  missing: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'stretch',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center' },
});
