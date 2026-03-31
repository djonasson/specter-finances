import { useState, useCallback } from 'react';
import type { Expense, ExpenseFormData } from '../types/expense';
import {
  fetchExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
} from '../services/sheets';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExpenses();
      setExpenses(data);
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
    [load]
  );

  const update = useCallback(
    async (rowIndex: number, form: ExpenseFormData) => {
      await updateExpense(rowIndex, form);
      await load();
    },
    [load]
  );

  const remove = useCallback(
    async (rowIndex: number) => {
      await deleteExpense(rowIndex);
      await load();
    },
    [load]
  );

  return { expenses, loading, error, load, add, update, remove };
}
