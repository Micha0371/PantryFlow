export const PAGE_SIZE = 200;

interface PageResult { data: unknown[] | null; error: unknown; count: number | null }

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  parse: (row: unknown) => T,
): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error, count } = await page(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []).map(parse);
    items.push(...rows);
    if (isComplete(items.length, rows.length, count)) return items;
  }
}

// True once every row has been read; throws when the server stopped early.
function isComplete(total: number, received: number, count: number | null): boolean {
  if (count !== null && total >= count) return true;
  // Do not silently truncate if the server's response cap is below PAGE_SIZE.
  if (received === 0) {
    if (count !== null && total < count) throw new Error('Incomplete inventory');
    return true;
  }
  if (count === null && received < PAGE_SIZE) return true;
  if (received < PAGE_SIZE) throw new Error('Server row limit is below page size');
  return false;
}
