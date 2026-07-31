import { useState, useCallback } from 'react';
import type { Expense, ExpenseFormData, ExpenseRow } from '../types/expense';
import { DEFAULT_NAMES } from '../types/person';
import type { PersonNames } from '../types/person';
import { fetchExpenses, addExpense, updateExpense, deleteExpense } from '../services/sheets';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  // Generic until the sheet has been read; see readPersonNames.
  const [names, setNames] = useState<PersonNames>(DEFAULT_NAMES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { expenses: rows, names: sheetNames } = await fetchExpenses();
      setExpenses(rows);
      setNames(sheetNames);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  const add = useCallback(
    async (form: ExpenseFormData) => {
      await addExpense(form);
      await load();
    },
    [load],
  );

  const update = useCallback(
    async (rowIndex: ExpenseRow, form: ExpenseFormData) => {
      await updateExpense(rowIndex, form);
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (rowIndex: ExpenseRow) => {
      await deleteExpense(rowIndex);
      await load();
    },
    [load],
  );

  return { expenses, names, loading, error, load, add, update, remove };
}
