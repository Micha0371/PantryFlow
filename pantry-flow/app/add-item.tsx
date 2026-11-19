import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { FormFooter } from '@/components/FormFooter';
import { useKeyboardOverlap } from '@/hooks/useKeyboardOverlap';
import { Input } from '@/components/Input';
import { OptionChips } from '@/components/OptionChips';
import { AuthGate } from '@/components/AuthGate';
import { useItemMutation } from '@/hooks/useItemMutation';
import { ITEM_NAME_MAX, itemSaveErrorKey } from '@/lib/pantry-data';
import { usePantryItems } from '@/hooks/usePantryItems';
import { useTranslation } from '@/lib/i18n';
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  DEFAULT_LOCATION,
  LOCATIONS,
} from '@/lib/constants';
import { colors, spacing, typography } from '@/lib/theme';
import { InlineError } from '@/components/InlineError';
import { useFormError } from '@/hooks/useFormError';

export default function AddItemModal() {
  return <AuthGate requireSession><AddItemModalContent /></AuthGate>;
}

function AddItemModalContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { householdId, loading, error: loadError, retry, addItem } = usePantryItems();
  // Edge-to-edge Android does not resize for the keyboard, so the footer lifts by
  // the measured overlap. iOS keeps KeyboardAvoidingView padding and needs none.
  const screenRef = useRef<React.ComponentRef<typeof View>>(null);
  const keyboardOverlap = useKeyboardOverlap(screenRef);
  const overlap = Platform.OS === 'android' ? keyboardOverlap : 0;
  const [footerHeight, setFooterHeight] = useState(0);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [location, setLocation] = useState<string>(DEFAULT_LOCATION);
  const { busy, run } = useItemMutation();
  const { error, failures, setError } = useFormError();

  const onSave = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('err_required_name'));
      return;
    }
    if (Array.from(trimmed).length > ITEM_NAME_MAX) {
      setError(t('err_item_name_length')); return;
    }
    if (!householdId) {
      setError(t('err_no_household'));
      return;
    }
    setError(null);
    await run(
      () => addItem({ name: trimmed, category, location }),
      () => router.back(),
      (failure) => setError(t(itemSaveErrorKey(failure))),
    );
  };

  return (
    <View ref={screenRef} style={styles.safe}>
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + footerHeight + overlap }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('item_add_title')}</Text>
        <InlineError message={loadError ? t(loadError) : null} />
        {loadError ? <Button label={t('common_retry')} onPress={() => { void retry(); }} /> : null}

        <Input
          label={t('item_name')}
          placeholder={t('item_name_placeholder')}
          maxLength={ITEM_NAME_MAX}
          editable={!busy}
          value={name}
          onChangeText={setName}
          autoFocus
          testID="add-item-name"
          error={error}
          announceKey={failures}
        />

        <Text style={styles.sectionLabel}>{t('item_category')}</Text>
        <OptionChips
          options={[...CATEGORIES]}
          value={category}
          onChange={setCategory}
          labelFor={(k) => t(`cat_${k}`)}
          testIDPrefix="add-item-category"
        />

        <View style={{ height: spacing.md }} />

        <Text style={styles.sectionLabel}>{t('item_location')}</Text>
        <OptionChips
          options={[...LOCATIONS]}
          value={location}
          onChange={setLocation}
          labelFor={(k) => t(`loc_${k}`)}
          testIDPrefix="add-item-location"
        />

      </ScrollView>
      <FormFooter overlap={overlap} onLayoutHeight={setFooterHeight}>
        <Button
          label={t('common_cancel')}
          onPress={() => router.back()}
          variant="secondary"
          disabled={busy}
          style={{ flex: 1 }}
          testID="add-item-cancel"
        />
        <Button
          label={t('item_add_button')}
          onPress={onSave}
          loading={busy}
          disabled={loading || !householdId || !!loadError}
          style={{ flex: 1 }}
          testID="add-item-save"
        />
      </FormFooter>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingBottom: spacing.xxl },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
});
