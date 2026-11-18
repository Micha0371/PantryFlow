import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { assertUniqueItemName, fetchAllItems, isMissingPantryItem, PANTRY_MISSING, PANTRY_STATUS_CONFLICT, PANTRY_STATUS_UNKNOWN, parseItem, validateItem, writeItemStatus, PantryItem, NewItemInput, UpdateItemInput, StatusWriteResult } from '@/lib/pantry-data';
import type { StatusKey } from '@/lib/theme';
import { useHouseholdList } from './household-list';

export type { PantryItem, NewItemInput, UpdateItemInput, StatusWriteResult } from '@/lib/pantry-data';

function usePantryState() {
  const { user, householdId, scope, isCurrent, loadedScope, loadCount, generation, pendingItems, setItems, setLoading, setError,
    visibleItems, view } = useHouseholdList<PantryItem>(fetchAllItems, 'err_load_items');
  const { fetchItems } = view;

  // Items whose last status write may or may not have committed. The ref feeds
  // the mutation guards synchronously; the state re-renders the list.
  const unconfirmedRef = useRef(new Set<string>());
  const [unconfirmed, setUnconfirmed] = useState<ReadonlySet<string>>(new Set());
  const markUnconfirmed = (id: string) => {
    unconfirmedRef.current.add(id); setUnconfirmed(new Set(unconfirmedRef.current));
  };
  const clearUnconfirmed = (id?: string) => {
    if (id === undefined) unconfirmedRef.current.clear(); else unconfirmedRef.current.delete(id);
    setUnconfirmed(prev => prev.size === unconfirmedRef.current.size ? prev : new Set(unconfirmedRef.current));
  };
  // An accepted full read is authoritative for every item.
  useEffect(() => { clearUnconfirmed(); }, [loadCount]);

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
  // While any status outcome is unconfirmed, every mutation also re-reads, so a
  // later write cannot discard the reconciling read and leave the mark set (A1).
  const rereadIfUnloaded = (unloaded: boolean) => {
    if ((unloaded || unconfirmedRef.current.size > 0) && isCurrent(scope)) void fetchItems();
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
    if (cached.status === next && !unconfirmedRef.current.has(id)) return { kind: 'already', item: cached };
    let reread = beginItemMutation(id);
    try {
      const result = await writeItemStatus(supabase, householdId!, id, cached.status, next);
      clearUnconfirmed(id);
      if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => prev.map(it => it.id === id ? result.item : it)); }
      return result;
    } catch (error) {
      const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (dropIfMissing(id, error)) { reread = true; clearUnconfirmed(id); }
      else if (code === PANTRY_STATUS_UNKNOWN) {
        // Keep the cached row, mark it, and discard reads that began before this
        // outcome; the forced re-read below reconciles it.
        // Scope-guarded: after a household change this must not discard the new scope's read.
        if (isCurrent(scope)) { markUnconfirmed(id); generation.current++; }
        reread = true;
      } else if (code === PANTRY_STATUS_CONFLICT) {
        clearUnconfirmed(id);
        const current = (error as unknown as { current: PantryItem }).current;
        if (isCurrent(scope)) { generation.current++; setLoading(false); setItems(prev => prev.map(it => it.id === id ? current : it)); }
      }
      throw error;
    } finally {
      pendingItems.current.delete(id);
      rereadIfUnloaded(reread);
    }
  };
  const isUnconfirmed = (id: string) => unconfirmed.has(id);
  return { ...view, addItem, updateItem, deleteItem, setItemStatus, isUnconfirmed };
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
