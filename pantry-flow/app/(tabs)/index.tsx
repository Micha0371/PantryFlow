import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';
import { PantryItem } from '@/components/PantryItem';
import { Button } from '@/components/Button';
import { SearchField } from '@/components/SearchField';
import { StatusSelector, type ViewRef } from '@/components/StatusSelector';
import { useItemMutation } from '@/hooks/useItemMutation';
import { useShoppingPrompt, notice } from '@/hooks/useShoppingPrompt';
import { announce } from '@/lib/accessibility';
import { filterItemsByName } from '@/lib/pantry-search';
import { PANTRY_STATUS_CONFLICT, PANTRY_STATUS_UNKNOWN, itemSaveErrorKey } from '@/lib/pantry-data';
import { offersShoppingAdd } from '@/lib/pantry-shopping';
import type { Frame } from '@/lib/status-menu';
import type { StatusKey } from '@/lib/theme';
import { usePantryItems } from '@/hooks/usePantryItems';
import { useSingleOpen } from '@/hooks/useSingleOpen';
import { useTranslation } from '@/lib/i18n';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { useFocusedErrorAnnouncement } from '@/hooks/useErrorAnnouncement';

export default function PantryScreen() {
  // One lock for rows and add actions: a tap burst opens one screen (KAN-33, KAN-38).
  const openScreen = useSingleOpen();
  const { t } = useTranslation();
  const { householdId, items, loading, error, retry, setItemStatus, isUnconfirmed } = usePantryItems();
  const { busy, run } = useItemMutation();
  const prompt = useShoppingPrompt();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; anchor: Frame; ref: React.RefObject<ViewRef | null> } | null>(null);
  const [query, setQuery] = useState('');
  const results = filterItemsByName(items, query);
  const trimmedQuery = query.trim();
  const openItem = open ? results.find((it) => it.id === open.id) ?? null : null;
  const { invalidate } = prompt;

  // The selector, its writes and an unanswered prompt belong to the focused list;
  // leaving it closes the selector and ends the prompt.
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => {
      focused.current = false;
      setOpen(null);
      invalidate();
    };
  }, [invalidate]));

  // A query belongs to one household's list.
  useEffect(() => { setQuery(''); }, [householdId]);

  // An emptied pantry (not a loading one) drops its query, so a later add is not hidden by it.
  const emptied = !loading && items.length === 0;
  useEffect(() => { if (emptied) setQuery(''); }, [emptied]);

  // One count announcement once typing pauses, never one per keystroke.
  const resultCount = useRef(0);
  resultCount.current = results.length;
  useEffect(() => {
    if (!trimmedQuery) return;
    const timer = setTimeout(() => {
      const count = resultCount.current;
      announce(count === 0 ? t('pantry_search_no_match_title')
        : count === 1 ? t('pantry_search_results_one')
          : `${count} ${t('pantry_search_results_many')}`);
    }, 600);
    return () => clearTimeout(timer);
  }, [trimmedQuery, t]);

  // The selector never outlives its item (deleted elsewhere, filtered out, household change).
  useEffect(() => {
    if (open && !openItem) setOpen(null);
  }, [open, openItem]);

  const changeStatus = (id: string, next: StatusKey) => {
    setOpen(null);
    if (!focused.current) return;
    invalidate();
    // The offer is requested inside the locked operation (not awaited), so the
    // native dialog exists before the write lock is released.
    void run(async (current) => {
      setPendingId(id);
      let result;
      try {
        result = await setItemStatus(id, next);
      } finally {
        setPendingId(null);
      }
      if (!current()) return;
      if (result.kind === 'changed' && offersShoppingAdd(result.previous, result.item.status)) {
        void prompt.offer({ saved: result.item, previous: result.previous, current });
      } else {
        announce(`${result.item.name}, ${t(`status_${result.item.status}`)}`);
      }
    }, () => {}, (e) => {
      const code = typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
      const unknown = code === PANTRY_STATUS_UNKNOWN;
      const message = unknown ? 'err_status_unconfirmed'
        : code === PANTRY_STATUS_CONFLICT ? 'err_status_conflict' : itemSaveErrorKey(e);
      void notice(t(unknown ? 'status_unconfirmed_title' : 'status_not_changed_title'), t(message), t('common_ok'));
    });
  };

  const showLoading = loading && items.length === 0;
  useFocusedErrorAnnouncement(error ? t(error) : null);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText} accessibilityRole="alert">{t(error)}</Text>
        <Button label={t('common_retry')} onPress={() => { void retry(); }} />
      </View>
    );
  }

  if (showLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="pantry-screen">
      {items.length === 0 ? (
        <EmptyState
          title={t('empty_pantry_title')}
          subtitle={t('empty_pantry_subtitle')}
          ctaLabel={t('empty_pantry_cta')}
          onCtaPress={() => openScreen('/add-item')}
        />
      ) : (
        <>
          <SearchField value={query} onChangeText={setQuery} />
          {trimmedQuery && results.length === 0 ? (
            <View style={styles.noMatch} testID="pantry-search-no-match">
              <Text style={styles.noMatchTitle}>{t('pantry_search_no_match_title')}</Text>
              <Text style={styles.noMatchQuery}>{`"${trimmedQuery}"`}</Text>
              <Button
                label={t('pantry_search_clear')}
                onPress={() => setQuery('')}
                testID="pantry-search-no-match-clear"
              />
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(it) => it.id}
              extraData={[pendingId, busy, open?.id, isUnconfirmed]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              renderItem={({ item }) => (
                <PantryItem
                  item={item}
                  onPress={() => { Keyboard.dismiss(); openScreen(`/edit-item/${item.id}`); }}
                  onStatusPress={(anchor, ref) => {
                    // Ignored while unfocused or while a row/add navigation is pending.
                    if (!busy && focused.current && !openScreen.isLocked()) {
                      Keyboard.dismiss();
                      setOpen({ id: item.id, anchor, ref });
                    }
                  }}
                  editDisabled={pendingId === item.id || isUnconfirmed(item.id)}
                  statusDisabled={busy}
                  statusBusy={pendingId === item.id}
                  statusExpanded={open?.id === item.id}
                />
              )}
              contentContainerStyle={styles.list}
            />
          )}
        </>
      )}

      {open && openItem ? (
        <StatusSelector
          anchor={open.anchor}
          itemName={openItem.name}
          current={openItem.status}
          onSelect={(next) => (next === openItem.status ? setOpen(null) : changeStatus(openItem.id, next))}
          onDismiss={() => setOpen(null)}
          returnFocusTo={open.ref}
        />
      ) : null}

      <Pressable
        onPress={() => { Keyboard.dismiss(); openScreen('/add-item'); }}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('item_add_button')}
        testID="pantry-fab-add"
      >
        <Ionicons name="add" size={28} color={colors.primaryOn} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2.5,
  },
  noMatch: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  noMatchTitle: { ...typography.heading, color: colors.text, textAlign: 'center' },
  noMatchQuery: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabPressed: { opacity: 0.9 },
});
