import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useExpenses } from './useExpenses';
import { useTransfers } from './useTransfers';
import type { Expense, ExpenseFormData } from '../types/expense';
import type { Transfer, TransferFormData } from '../types/transfer';

interface DataState {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (form: ExpenseFormData) => Promise<void>;
  update: (rowIndex: number, form: ExpenseFormData) => Promise<void>;
  remove: (rowIndex: number) => Promise<void>;

  transfers: Transfer[];
  transfersLoading: boolean;
  transfersError: string | null;
  loadTransfers: () => Promise<void>;
  addTransfer: (form: TransferFormData) => Promise<void>;
  updateTransfer: (rowIndex: number, form: TransferFormData) => Promise<void>;
  removeTransfer: (rowIndex: number) => Promise<void>;
}

const ExpensesContext = createContext<DataState | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const expenses = useExpenses();
  const transfers = useTransfers();

  const value: DataState = {
    expenses: expenses.expenses,
    loading: expenses.loading,
    error: expenses.error,
    load: expenses.load,
    add: expenses.add,
    update: expenses.update,
    remove: expenses.remove,

    transfers: transfers.transfers,
    transfersLoading: transfers.loading,
    transfersError: transfers.error,
    loadTransfers: transfers.load,
    addTransfer: transfers.add,
    updateTransfer: transfers.update,
    removeTransfer: transfers.remove,
  };

  return (
    <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>
  );
}

export function useExpensesContext(): DataState {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error('useExpensesContext must be used within ExpensesProvider');
  return ctx;
}
