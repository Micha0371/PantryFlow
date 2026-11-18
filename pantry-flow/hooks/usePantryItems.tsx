import React, { createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { assertUniqueItemName, fetchAllItems, isMissingPantryItem, PANTRY_MISSING, PANTRY_STATUS_CONFLICT, parseItem, validateItem, writeItemStatus, PantryItem, NewItemInput, UpdateItemInput, StatusWriteResult } from '@/lib/pantry-data';
import type { StatusKey } from '@/lib/theme';
import { useHouseholdList } from './household-list';

export type { PantryItem, NewItemInput, UpdateItemInput, StatusWriteResult } from '@/lib/pantry-data';

function usePantryState() {
  const { user, householdId, scope, isCurrent, loadedScope, generation, pendingItems, setItems, setLoading, setError,
    visibleItems, view } = useHouseholdList<PantryItem>(fetchAllItems, 'err_load_items');
  const { fetchItems } = view;

  // Invalidate pending reads before each mutation, so an older snapshot cannot
  // overwrite its result. All screens observe this same state instance.
  // While the list is not loaded for this scope the discarded read is re-run
  // after the write settles, and a load error stays visible, so a write before
  // the first load never leaves a partial list or a permanent spinner (KAN-32).
  const beginMutation = () => {
    if (!householdId || !user || !isCurrent(scope)) throw new Error('No active household');
    const unloaded = loadedScope !== scope;
    generation.current++; setLoading(false);
    if (!unloaded) setError(null);
    return unloaded;
  };
  // Also re-read when a write failed because the record is missing, so other
  // changes are picked up. The caller still gets the original error.
  const rereadIfUnloaded = (unloaded: boolean) => {
    if (unloaded && isCurrent(scope)) void fetchItems();
  };
  // A missing record is gone for this household, so drop it at once. A later
  // write may discard the re-read; the row must not depend on it to disappear (CR-01).
  const dropIfMissing = (id: string, error: unknown) => {
    if (!isMissingPantryItem(error)) return false;
    if (isCurrent(scope)) setItems(prev => prev.filter(it => it.id !== id));
    return true;
  };
  const beginItemMutation = (id: string) => {
    if (pendingItems.current.has(id)) throw new Error('Item change is already pending');
    const unloaded = beginMutation();
    pendingItems.current.add(id);
    return unloaded;
  };
  const addItem = async (input: NewItemInput) => {
    const validated = validateItem(input);
    assertUniqueItemName(visibleItems, validated.name);
    const unloaded = beginMutation();
    try {
      const { data, error: err } = await supabase.from('pantry_items')
        .insert({ ...validated, household_id: householdId, status: 'in_stock', created_by: user!.id })
        .select().single();
      if (err) throw err;
      const item = parseItem(data);
      // A refresh may already hold this row; replace it instead of adding a copy.
      if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => [item, ...prev.filter(it => it.id !== item.id)]); }
      return item;
    } finally {
      rereadIfUnloaded(unloaded);
    }
  };
  const updateItem = async (id: string, input: UpdateItemInput) => {
    const validated = validateItem(input);
    assertUniqueItemName(visibleItems, validated.name, id);
    let reread = beginItemMutation(id);
    try {
      const { data, error: err } = await supabase.from('pantry_items')
        .update(validated).eq('id', id).eq('household_id', householdId).select().single();
      if (err) throw err;
      const item = parseItem(data);
      if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => prev.map(it => it.id === id ? item : it)); }
      return item;
    } catch (error) {
      if (dropIfMissing(id, error)) reread = true;
      throw error;
    } finally {
      pendingItems.current.delete(id);
      rereadIfUnloaded(reread);
    }
  };
  const deleteItem = async (id: string) => {
    let reread = beginItemMutation(id);
    try {
      const { data, error: err } = await supabase.from('pantry_items')
        .delete().eq('id', id).eq('household_id', householdId).select('id');
      if (err) throw err;
      if (!data?.length) throw Object.assign(new Error('Item was not deleted'), { code: PANTRY_MISSING });
      if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => prev.filter(it => it.id !== id)); }
    } catch (error) {
      if (dropIfMissing(id, error)) reread = true;
      throw error;
    } finally {
      pendingItems.current.delete(id);
      rereadIfUnloaded(reread);
    }
  };
  // Status-only compare-and-set write. The cached status is the expected
  // previous one; a no-op selection makes no call (UX-01B).
  const setItemStatus = async (id: string, next: StatusKey): Promise<StatusWriteResult> => {
    const cached = visibleItems.find(it => it.id === id);
    if (!cached) throw new Error('Invalid pantry item');
    if (cached.status === next) return { kind: 'already', item: cached };
    let reread = beginItemMutation(id);
    try {
      const result = await writeItemStatus(supabase, householdId!, id, cached.status, next);
      if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => prev.map(it => it.id === id ? result.item : it)); }
      return result;
    } catch (error) {
      if (dropIfMissing(id, error)) reread = true;
      else if (error !== null && typeof error === 'object' && 'code' in error && error.code === PANTRY_STATUS_CONFLICT) {
        const current = (error as unknown as { current: PantryItem }).current;
        if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => prev.map(it => it.id === id ? current : it)); }
      }
      throw error;
    } finally {
      pendingItems.current.delete(id);
      rereadIfUnloaded(reread);
    }
  };
  return { ...view, addItem, updateItem, deleteItem, setItemStatus };
}

const PantryContext = createContext<ReturnType<typeof usePantryState> | undefined>(undefined);
export function PantryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ScopedPantryProvider key={user?.id ?? 'guest'}>{children}</ScopedPantryProvider>;
}
function ScopedPantryProvider({ children }: { children: ReactNode }) {
  const value = usePantryState();
  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}
export function usePantryItems() {
  const value = useContext(PantryContext);
  if (!value) throw new Error('usePantryItems must be used within PantryProvider');
  return value;
}
