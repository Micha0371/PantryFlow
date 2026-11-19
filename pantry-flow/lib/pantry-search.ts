import { normalizedItemName } from './pantry-data';

export function filterItemsByName<T extends { name: string }>(items: readonly T[], query: string): readonly T[] {
  const needle = normalizedItemName(query);
  if (!needle) return items;
  return items.filter(item => normalizedItemName(item.name).includes(needle));
}
