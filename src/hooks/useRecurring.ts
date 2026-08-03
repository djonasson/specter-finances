import { useState, useCallback } from 'react';
import type { RecurringRule, RecurringFormData, RecurringRow } from '../types/recurring';
import {
  fetchRecurring,
  addRecurring,
  updateRecurring,
  deleteRecurring,
  assignRecurringId,
  ensureRecurringSetup,
} from '../services/sheets';

/**
 * The recurring rules, loaded from their own tab.
 *
 * Shaped like useMovements — load/add/update/remove, mutations reloading rather
 * than patching because a delete renumbers every row below — but hand-written
 * for the same reason useExpenses is: it carries an extra piece of state.
 * Here that is `tabMissing`, a sheet nobody has set the feature up on yet,
 * which is an empty state and not an error.
 */
export function useRecurring() {
  const [items, setItems] = useState<RecurringRule[]>([]);
  const [tabMissing, setTabMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRecurring();
      setItems(result.rules);
      setTabMissing(result.tabMissing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recurring payments');
    } finally {
      setLoading(false);
    }
  }, []);

  const add = useCallback(
    async (form: RecurringFormData) => {
      // Creates the tab first if it is not there, so the empty state's own
      // "Add" works without the user having to know a tab was involved.
      await addRecurring(form);
      await load();
    },
    [load],
  );

  const update = useCallback(
    async (rowIndex: RecurringRow, form: RecurringFormData, id: string) => {
      await updateRecurring(rowIndex, form, id);
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (rowIndex: RecurringRow) => {
      await deleteRecurring(rowIndex);
      await load();
    },
    [load],
  );

  const assignId = useCallback(
    async (rowIndex: RecurringRow) => {
      await assignRecurringId(rowIndex);
      await load();
    },
    [load],
  );

  const setUp = useCallback(async () => {
    await ensureRecurringSetup();
    await load();
  }, [load]);

  return { items, tabMissing, loading, error, load, add, update, remove, assignId, setUp };
}
