import { createContext, useCallback, useContext } from 'react';
import type { ReactNode } from 'react';
import { useExpenses } from './useExpenses';
import { useTransfers } from './useTransfers';
import { useGifts } from './useGifts';
import { useRecurring } from './useRecurring';
import { useRecurringPending } from './useRecurringPending';
import type { PendingExpense } from '../services/recurring';
import { appendGeneratedExpenses, fetchExpenses } from '../services/sheets';
import type { PersonNames } from '../types/person';

/**
 * Everything the app knows, grouped by the tab it came from.
 *
 * Grouped rather than flattened. Each domain used to be spread across the top
 * level under a prefix-or-suffix convention that expenses was exempt from
 * (`loading` and `error`, against `transfersLoading` and `giftsError`), and a
 * fourth domain had nowhere consistent to sit — `recurringLoading` beside
 * `loadRecurring`. Handing back the hooks' own objects removes the renaming
 * layer entirely, and with it the question of what a fifth domain would be
 * called.
 */
interface DataState {
  /**
   * The two names, read from the expenses sheet header.
   *
   * Kept at the top rather than inside `expenses` because it is the one value
   * every screen needs. App is the only place that reads it; components take it
   * as a prop.
   */
  names: PersonNames;
  expenses: ReturnType<typeof useExpenses>;
  transfers: ReturnType<typeof useTransfers>;
  gifts: ReturnType<typeof useGifts>;
  recurring: ReturnType<typeof useRecurring>;
  /** Months the rules say are due, and whether to ask about them now. */
  pending: ReturnType<typeof useRecurringPending> & {
    /**
     * Write the confirmed rows. Amounts may have been corrected first.
     * Returns how many were actually appended, which is fewer than asked for
     * when another device generated the same month in the meantime.
     */
    generate: (rows: PendingExpense[]) => Promise<number>;
  };
}

const ExpensesContext = createContext<DataState | null>(null);

export function ExpensesProvider({ children }: { children: ReactNode }) {
  const expenses = useExpenses();
  const transfers = useTransfers();
  const gifts = useGifts();
  const recurring = useRecurring();

  const pending = useRecurringPending(
    recurring.items,
    expenses.items,
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
  const generate = useCallback(
    async (rows: PendingExpense[]) => {
      const { expenses: current } = await fetchExpenses();
      const already = new Set(current.map((e) => e.recurringMarker).filter(Boolean));
      const fresh = rows.filter((r) => !already.has(r.marker));
      await appendGeneratedExpenses(fresh);
      await load();
      return fresh.length;
    },
    [load],
  );

  const value: DataState = {
    names: expenses.names,
    expenses,
    transfers,
    gifts,
    recurring,
    pending: { ...pending, generate },
  };

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useExpensesContext(): DataState {
  const ctx = useContext(ExpensesContext);
  if (!ctx) throw new Error('useExpensesContext must be used within ExpensesProvider');
  return ctx;
}
