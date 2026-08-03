import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';
import { useExpenses } from './useExpenses';
import { useTransfers } from './useTransfers';
import { useGifts } from './useGifts';
import { useRecurring } from './useRecurring';
import { useRecurringPending } from './useRecurringPending';
import type { Expense, ExpenseFormData, ExpenseRow } from '../types/expense';
import type { Transfer, TransferFormData, TransferRow } from '../types/transfer';
import type { Gift, GiftFormData, GiftRow } from '../types/gift';
import type { RecurringRule, RecurringFormData, RecurringRow } from '../types/recurring';
import type { PendingExpense } from '../services/recurring';
import { appendGeneratedExpenses, fetchExpenses } from '../services/sheets';
import type { PersonNames } from '../types/person';

interface DataState {
  /** The two names, read from the expenses sheet header. */
  names: PersonNames;
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (form: ExpenseFormData) => Promise<void>;
  update: (rowIndex: ExpenseRow, form: ExpenseFormData) => Promise<void>;
  remove: (rowIndex: ExpenseRow) => Promise<void>;

  transfers: Transfer[];
  transfersLoading: boolean;
  transfersError: string | null;
  loadTransfers: () => Promise<void>;
  addTransfer: (form: TransferFormData) => Promise<void>;
  updateTransfer: (rowIndex: TransferRow, form: TransferFormData) => Promise<void>;
  removeTransfer: (rowIndex: TransferRow) => Promise<void>;

  gifts: Gift[];
  giftsLoading: boolean;
  giftsError: string | null;
  loadGifts: () => Promise<void>;
  addGift: (form: GiftFormData) => Promise<void>;
  updateGift: (rowIndex: GiftRow, form: GiftFormData) => Promise<void>;
  removeGift: (rowIndex: GiftRow) => Promise<void>;

  recurring: RecurringRule[];
  recurringLoading: boolean;
  recurringError: string | null;
  /** The tab has not been created yet — an empty state, not a failure. */
  recurringTabMissing: boolean;
  loadRecurring: () => Promise<void>;
  addRecurring: (form: RecurringFormData) => Promise<void>;
  updateRecurring: (rowIndex: RecurringRow, form: RecurringFormData, id: string) => Promise<void>;
  removeRecurring: (rowIndex: RecurringRow) => Promise<void>;
  assignRecurringId: (rowIndex: RecurringRow) => Promise<void>;
  setUpRecurring: () => Promise<void>;

  /** Months the rules say are due but the sheet does not have yet. */
  recurringPending: PendingExpense[];
  recurringPrompt: boolean;
  dismissRecurringPrompt: () => void;
  requestRecurringPrompt: () => void;
  /** Write the confirmed rows. Amounts may have been corrected first. */
  generateRecurring: (rows: PendingExpense[]) => Promise<void>;
}

const ExpensesContext = createContext<DataState | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const expenses = useExpenses();
  const transfers = useTransfers();
  const giftsHook = useGifts();
  const recurring = useRecurring();

  const pending = useRecurringPending(
    recurring.rules,
    expenses.expenses,
    expenses.loadedOnce,
    expenses.loading || recurring.loading,
  );

  const load = expenses.load;

  /**
   * Write the confirmed months.
   *
   * The expenses are re-read first. Two devices can be open at once and the
   * sheet has no transactions, so the other one may have generated the same
   * month while this modal sat open; dropping anything already marked is the
   * only thing standing between that and the payment appearing twice.
   */
  const generateRecurring = useCallback(
    async (rows: PendingExpense[]) => {
      const { expenses: current } = await fetchExpenses();
      const already = new Set(current.map((e) => e.recurringMarker).filter(Boolean));
      const fresh = rows.filter((r) => !already.has(r.marker));
      await appendGeneratedExpenses(fresh);
      await load();
    },
    [load],
  );

  const value: DataState = {
    names: expenses.names,
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

    recurring: recurring.rules,
    recurringLoading: recurring.loading,
    recurringError: recurring.error,
    recurringTabMissing: recurring.tabMissing,
    loadRecurring: recurring.load,
    addRecurring: recurring.add,
    updateRecurring: recurring.update,
    removeRecurring: recurring.remove,
    assignRecurringId: recurring.assignId,
    setUpRecurring: recurring.setUp,

    recurringPending: pending.pending,
    recurringPrompt: pending.prompt,
    dismissRecurringPrompt: pending.dismiss,
    requestRecurringPrompt: pending.request,
    generateRecurring,
  };

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useExpensesContext(): DataState {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error('useExpensesContext must be used within ExpensesProvider');
  return ctx;
}
