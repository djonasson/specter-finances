import { useCallback, useMemo, useState } from 'react';
import type { Expense } from '../types/expense';
import type { RecurringRule } from '../types/recurring';
import { pendingRecurring } from '../services/recurring';
import type { PendingExpense } from '../services/recurring';
import { today } from '../services/utils';

const DISMISSED_KEY = 'sf_recurring_dismissed';

/**
 * What the app is about to be asked to confirm, and whether to ask now.
 *
 * The trigger has to survive a quirk of this app: every navigation refetches
 * all four domains, so "prompt whenever something is due" would reopen the
 * modal on every tap of the bottom bar.
 *
 * The dismissal is therefore keyed on *which* months are pending, not on a
 * flag. Dismissing July stops it asking about July; when August falls due the
 * set changes and it asks again, and so does adding or removing a rule. That is
 * "at least once a month, and whenever the list changes" without tracking
 * either explicitly.
 *
 * It is kept in localStorage rather than in memory because an installed PWA is
 * cold-started constantly, and a per-session flag would put the modal back on
 * every launch — the nagging this is meant to avoid.
 */
export function signatureOf(pending: PendingExpense[]): string {
  return pending
    .map((p) => p.marker)
    .sort()
    .join('|');
}

function readDismissed(): string {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? '';
  } catch {
    return '';
  }
}

export interface RecurringPendingState {
  pending: PendingExpense[];
  /** Show the confirmation now, unprompted. */
  prompt: boolean;
  /** Stop asking about exactly this set of months. */
  dismiss: () => void;
  /** Open it anyway, however it was dismissed — the Generate now button. */
  request: () => void;
}

export function useRecurringPending(
  rules: RecurringRule[],
  expenses: Expense[],
  /**
   * Whether the expenses have been read from the sheet at least once.
   *
   * Load-bearing. Before the first read `expenses` is empty, which is
   * indistinguishable from a sheet where nothing was ever generated — and a
   * check run then would offer to write every month of every rule.
   */
  expensesReady: boolean,
  busy: boolean,
): RecurringPendingState {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [requested, setRequested] = useState(false);

  const pending = useMemo(
    () => (expensesReady ? pendingRecurring(rules, expenses, today()) : []),
    [rules, expenses, expensesReady],
  );

  const signature = useMemo(() => signatureOf(pending), [pending]);

  const dismiss = useCallback(() => {
    setDismissed(signature);
    setRequested(false);
    try {
      localStorage.setItem(DISMISSED_KEY, signature);
    } catch {
      // A browser refusing storage is not a reason to fail; the worst case is
      // being asked again next launch.
    }
  }, [signature]);

  const request = useCallback(() => setRequested(true), []);

  const prompt = pending.length > 0 && !busy && (requested || signature !== dismissed);

  return { pending, prompt, dismiss, request };
}
