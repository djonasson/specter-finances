import { useState, useCallback, useRef } from 'react';
import type { Expense, ExpenseFormData, ExpenseRow } from '../types/expense';
import { DEFAULT_NAMES } from '../types/person';
import type { PersonNames } from '../types/person';
import {
  fetchExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  ensureExpenseColumnLabels,
} from '../services/sheets';

export function useExpenses() {
  const [items, setItems] = useState<Expense[]>([]);
  // Generic until the sheet has been read; see readPersonNames.
  const [names, setNames] = useState<PersonNames>(DEFAULT_NAMES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Has the sheet been read successfully even once?
   *
   * Before the first read, `expenses` is an empty array that looks exactly like
   * a sheet with no expenses on it. The recurring check reads that as "no month
   * has ever been generated" and would offer to write every month of every rule
   * at once. Once true this stays true: a later network blip must not re-arm
   * that.
   */
  const [loadedOnce, setLoadedOnce] = useState(false);
  /** Whether G to J still need a heading; answered by the last read. */
  const unlabelled = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { expenses: rows, names: sheetNames, columnsUnlabelled } = await fetchExpenses();
      setItems(rows);
      setNames(sheetNames);
      setLoadedOnce(true);
      unlabelled.current = columnsUnlabelled;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Put a heading over the columns the app writes, the first time it writes any.
   *
   * Done here rather than on load, because writing to someone's spreadsheet
   * because they opened the app is the surprise this app avoids — but once they
   * have added or changed an expense, those columns have been written and an
   * unexplained column of money is worse than the extra request.
   *
   * Best-effort: the expense itself already saved, so a failure to label is not
   * a reason to report the save as failed.
   */
  const labelColumns = useCallback(async () => {
    if (!unlabelled.current) return;
    try {
      await ensureExpenseColumnLabels();
      unlabelled.current = false;
    } catch {
      // Tried; the next write will try again.
    }
  }, []);

  const add = useCallback(
    async (form: ExpenseFormData) => {
      await addExpense(form);
      await labelColumns();
      await load();
    },
    [load, labelColumns],
  );

  const update = useCallback(
    async (rowIndex: ExpenseRow, form: ExpenseFormData) => {
      await updateExpense(rowIndex, form);
      await labelColumns();
      await load();
    },
    [load, labelColumns],
  );

  const remove = useCallback(
    async (rowIndex: ExpenseRow) => {
      await deleteExpense(rowIndex);
      await load();
    },
    [load],
  );

  return { items, names, loading, loadedOnce, error, load, add, update, remove };
}
