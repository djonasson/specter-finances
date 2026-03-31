import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useExpenses } from './useExpenses';
import type { Expense, ExpenseFormData } from '../types/expense';

interface ExpensesState {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (form: ExpenseFormData) => Promise<void>;
  update: (rowIndex: number, form: ExpenseFormData) => Promise<void>;
  remove: (rowIndex: number) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesState | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const state = useExpenses();
  return (
    <ExpensesContext.Provider value={state}>{children}</ExpensesContext.Provider>
  );
}

export function useExpensesContext(): ExpensesState {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error('useExpensesContext must be used within ExpensesProvider');
  return ctx;
}
