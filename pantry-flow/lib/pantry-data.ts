import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORIES, LOCATIONS, STATUSES } from './constants';
import { fetchAllPages, PAGE_SIZE } from './pagination';
import type { StatusKey } from './theme';

export interface PantryItem {
  id: string;
  household_id: string;
  name: string;
  status: StatusKey;
  category: string;
  location: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewItemInput { name: string; category: string; location: string }
export interface UpdateItemInput extends NewItemInput { status: StatusKey }

export const ITEM_NAME_MAX = 120;
export { PAGE_SIZE };

export function normalizedItemName(name: string) {
  return name.trim().toLowerCase();
}

export function assertUniqueItemName(items: PantryItem[], name: string, excludeId?: string) {
  const normalized = normalizedItemName(name);
  if (items.some(item => item.id !== excludeId && normalizedItemName(item.name) === normalized)) {
    throw Object.assign(new Error('Duplicate pantry item'), { code: '23505' });
  }
}

// A delete filtered by id and household that removed no row (CR-01).
export const PANTRY_MISSING = 'PF_PANTRY_MISSING';

// Zero rows from a write filtered by id and household: the item is gone for this
// household, whether deleted elsewhere or never visible here, so nothing reveals
// another household's rows. Transport, permission and server errors are not
// "missing"; the cached row stays (CR-01).
export function isMissingPantryItem(error: unknown) {
  const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return code === 'PGRST116' || code === PANTRY_MISSING;
}

// A status write lost its compare-and-set twice; the error carries the row now
// in the database as `current` (UX-01B).
export const PANTRY_STATUS_CONFLICT = 'PF_PANTRY_STATUS_CONFLICT';

// An update step failed without a Postgres/PostgREST code (thrown, lost
// connection, gateway page): the server may have committed. `cause` is the
// original failure (A1).
export const PANTRY_STATUS_UNKNOWN = 'PF_PANTRY_STATUS_UNKNOWN';

export type StatusWriteResult =
  | { kind: 'changed'; item: PantryItem; previous: StatusKey }
  | { kind: 'already'; item: PantryItem };

// Status-only compare-and-set: the write matches only while the row still holds
// the status the caller saw, so it never overwrites a concurrent rename. A miss
// is re-read once and retried against the database status (design 5.11).
export async function writeItemStatus(
  client: SupabaseClient, householdId: string, id: string, previous: StatusKey, next: StatusKey,
): Promise<StatusWriteResult> {
  const valid = (value: string) => (STATUSES as readonly string[]).includes(value);
  if (!valid(next) || !valid(previous)) throw new Error('Invalid pantry item');
  const uncertain = (cause: unknown) => Object.assign(
    new Error('Pantry status change outcome is unknown', { cause }), { code: PANTRY_STATUS_UNKNOWN });
  const attempt = async (prev: StatusKey): Promise<PantryItem | null> => {
    let result;
    try {
      result = await client.from('pantry_items')
        .update({ status: next }).eq('id', id).eq('household_id', householdId).eq('status', prev)
        .select().maybeSingle();
    } catch (cause) {
      throw uncertain(cause);
    }
    const { data, error } = result;
    if (error) {
      // A coded error is a confirmed rejection; anything else may have committed.
      const code = typeof error === 'object' && 'code' in error ? error.code : undefined;
      throw typeof code === 'string' && code !== '' ? error : uncertain(error);
    }
    return data ? parseItem(data) : null;
  };
  const read = async (): Promise<PantryItem> => {
    const { data, error } = await client.from('pantry_items')
      .select('*').eq('id', id).eq('household_id', householdId).maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error('Pantry item is missing'), { code: PANTRY_MISSING });
    return parseItem(data);
  };
  // Selecting the status the caller already believes in is only a check, never a write.
  const changed = previous === next ? null : await attempt(previous);
  if (changed) return { kind: 'changed', item: changed, previous };
  const current = await read();
  if (current.status === next) return { kind: 'already', item: current };
  const retried = await attempt(current.status);
  if (retried) return { kind: 'changed', item: retried, previous: current.status };
  throw Object.assign(new Error('Pantry status changed elsewhere'), {
    code: PANTRY_STATUS_CONFLICT, current: await read(),
  });
}

export function itemSaveErrorKey(error: unknown) {
  if (isMissingPantryItem(error)) return 'err_item_missing';
  return error !== null && typeof error === 'object' && 'code' in error && error.code === '23505'
    ? 'err_duplicate_item' : 'err_save_item';
}

export function validateItem(input: NewItemInput | UpdateItemInput) {
  const name = input.name.trim();
  if (!name || Array.from(name).length > ITEM_NAME_MAX ||
      !(CATEGORIES as readonly string[]).includes(input.category) ||
      !(LOCATIONS as readonly string[]).includes(input.location) ||
      ('status' in input && !(STATUSES as readonly string[]).includes(input.status))) {
    throw new Error('Invalid pantry item');
  }
  return {
    name, category: input.category, location: input.location,
    ...('status' in input ? { status: input.status } : {}),
  };
}

export function parseItem(value: unknown): PantryItem {
  if (!value || typeof value !== 'object') throw new Error('Invalid item response');
  const row = value as Record<string, unknown>;
  for (const key of ['id', 'household_id', 'name', 'category', 'location', 'status', 'created_at', 'updated_at']) {
    if (typeof row[key] !== 'string') throw new Error('Invalid item response');
  }
  if (row.created_by !== null && typeof row.created_by !== 'string') {
    throw new Error('Invalid item creator');
  }
  validateItem(row as unknown as UpdateItemInput);
  return row as unknown as PantryItem;
}

export function fetchAllItems(client: SupabaseClient, householdId: string) {
  return fetchAllPages(
    (from, to) => client.from('pantry_items')
      .select('*', { count: 'exact' }).eq('household_id', householdId)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, to),
    parseItem,
  );
}
