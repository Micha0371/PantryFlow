import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { announce } from '@/lib/accessibility';
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

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [location, setLocation] = useState<string>(DEFAULT_LOCATION);
  const { busy, run } = useItemMutation();
  const { error, failures, setError } = useFormError();
  // The name field stays editable during a pending save, so a success clears it
  // only when it still holds exactly the submitted text.
  const nameRef = useRef('');
  const nameInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [savedAny, setSavedAny] = useState(false);

  const onNameChange = (text: string) => {
    nameRef.current = text;
    setName(text);
  };

  const onSave = async (mode: 'close' | 'next') => {
    if (busy) return;
    const submitted = name;
    const trimmed = name.trim();
    if (!trimmed) {
      setSavedName(null);
      setError(t('err_required_name'));
      return;
    }
    if (Array.from(trimmed).length > ITEM_NAME_MAX) {
      setSavedName(null);
      setError(t('err_item_name_length')); return;
    }
    if (!householdId) {
      setSavedName(null);
      setError(t('err_no_household'));
      return;
    }
    setError(null);
    await run(
      () => addItem({ name: trimmed, category, location }),
      () => {
        if (mode === 'close') {
          router.back();
          return;
        }
        if (nameRef.current === submitted) onNameChange('');
        setSavedName(trimmed);
        setSavedAny(true);
        announce(`${trimmed}, ${t('item_added_announcement')}`);
        nameInput.current?.focus();
      },
      (failure) => {
        setSavedName(null);
        setError(t(itemSaveErrorKey(failure)));
      },
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
          <Text style={styles.title}>{t('item_add_title')}</Text>
          <InlineError message={loadError ? t(loadError) : null} />
          {loadError ? <Button label={t('common_retry')} onPress={() => { void retry(); }} /> : null}

          <Input
            label={t('item_name')}
            placeholder={t('item_name_placeholder')}
            maxLength={ITEM_NAME_MAX}
            ref={nameInput}
            value={name}
            onChangeText={onNameChange}
            autoFocus
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => { void onSave('next'); }}
            testID="add-item-name"
            error={error}
            announceKey={failures}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={savedName ? styles.saved : undefined}
            testID="add-item-saved"
          >
            {savedName ? <>{t('item_added_prefix')} {savedName}</> : null}
          </Text>

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
        <FormFooter overlap={overlap}>
          <Button
            label={t(savedAny ? 'common_done' : 'common_cancel')}
            onPress={() => router.back()}
            variant="secondary"
            disabled={busy}
            style={{ flex: 1 }}
            testID="add-item-cancel"
          />
          <Button
            label={t('item_add_button')}
            onPress={() => onSave('close')}
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
  saved: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
});
