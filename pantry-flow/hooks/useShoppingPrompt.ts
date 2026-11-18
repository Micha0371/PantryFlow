import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useShoppingItems } from '@/hooks/useShoppingItems';
import { useHouseholdScope } from '@/hooks/household-scope';
import { shoppingErrorKey } from '@/lib/shopping-data';
import { offersShoppingAdd } from '@/lib/pantry-shopping';
import { useTranslation } from '@/lib/i18n';
import type { PantryItem } from '@/lib/pantry-data';
import type { StatusKey } from '@/lib/theme';

// Resolves true on the affirmative button, false on the other button or dismissal.
export function ask(title: string, message: string, addLabel: string, skipLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: skipLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: addLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function notice(title: string, message: string, okLabel: string): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: okLabel, onPress: () => resolve() }],
      { cancelable: true, onDismiss: () => resolve() });
  });
}

// The D3 sequence shared by every screen that changes a pantry status: offer a
// shopping add after a change to low or out, add the saved item on Yes, and show
// a failure notice. It never touches pantry state. `prompting` is true while the
// dialog or its notice is unanswered (KAN-36).
export function useShoppingPrompt() {
  const { t } = useTranslation();
  const { addItem } = useShoppingItems();
  const { householdId } = useHouseholdScope();
  const householdRef = useRef(householdId);
  householdRef.current = householdId;
  const token = useRef(0);
  const mounted = useRef(true);
  const [prompting, setPrompting] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; token.current++; };
  }, []);

  const invalidate = useCallback(() => { token.current++; }, []);

  const offer = async (args: { saved: PantryItem; previous: StatusKey; current: () => boolean }): Promise<void> => {
    const { saved, previous, current } = args;
    if (!current() || !offersShoppingAdd(previous, saved.status) || saved.household_id !== householdRef.current) return;
    const mine = ++token.current;
    const household = householdRef.current;
    const valid = () => current() && token.current === mine && householdRef.current === household;
    setPrompting(true);
    try {
      const wanted = await ask(t('shopping_prompt_title'), saved.name, t('shopping_prompt_add'), t('shopping_prompt_skip'));
      if (!wanted || !valid()) return;
      try {
        await addItem({ name: saved.name, pantryItemId: saved.id });
      } catch (shoppingError) {
        if (!valid()) return;
        await notice(t('shopping_prompt_failed_title'), t(shoppingErrorKey(shoppingError)), t('common_ok'));
      }
    } finally {
      if (mounted.current) setPrompting(false);
    }
  };

  return { prompting, offer, invalidate };
}
