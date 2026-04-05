import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useExpenses } from './useExpenses';
import { useTransfers } from './useTransfers';
import { useGifts } from './useGifts';
import type { Expense, ExpenseFormData } from '../types/expense';
import type { Transfer, TransferFormData } from '../types/transfer';
import type { Gift, GiftFormData } from '../types/gift';

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

  gifts: Gift[];
  giftsLoading: boolean;
  giftsError: string | null;
  loadGifts: () => Promise<void>;
  addGift: (form: GiftFormData) => Promise<void>;
  updateGift: (rowIndex: number, form: GiftFormData) => Promise<void>;
  removeGift: (rowIndex: number) => Promise<void>;
}

const ExpensesContext = createContext<DataState | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const expenses = useExpenses();
  const transfers = useTransfers();
  const giftsHook = useGifts();

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

    gifts: giftsHook.gifts,
    giftsLoading: giftsHook.loading,
    giftsError: giftsHook.error,
    loadGifts: giftsHook.load,
    addGift: giftsHook.add,
    updateGift: giftsHook.update,
    removeGift: giftsHook.remove,
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
