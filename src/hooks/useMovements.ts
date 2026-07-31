import { useState, useCallback } from 'react';

interface Crud<TRecord, TRow extends number, TForm> {
  fetchAll: () => Promise<TRecord[]>;
  add: (form: TForm) => Promise<void>;
  update: (rowIndex: TRow, form: TForm) => Promise<void>;
  remove: (rowIndex: TRow) => Promise<void>;
}

/**
 * Load/add/update/remove state for one sheet-backed collection.
 *
 * useTransfers and useGifts were line-for-line identical, so an improvement
 * made to one (retry, optimistic update, abort on unmount) would silently miss
 * the other and leave two near-identical screens behaving differently.
 *
 * Mutations reload from the sheet rather than patching in place: a delete
 * renumbers every row below it, so local state would go stale immediately.
 */
export function useMovements<TRecord, TRow extends number, TForm>(
  crud: Crud<TRecord, TRow, TForm>,
  label: string,
) {
  const [items, setItems] = useState<TRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await crud.fetchAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to load ${label}`);
    } finally {
      setLoading(false);
    }
    // crud and label are module-level constants — stable for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useCallback(
    async (form: TForm) => {
      await crud.add(form);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  const update = useCallback(
    async (rowIndex: TRow, form: TForm) => {
      await crud.update(rowIndex, form);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  const remove = useCallback(
    async (rowIndex: TRow) => {
      await crud.remove(rowIndex);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  return { items, loading, error, load, add, update, remove };
}
