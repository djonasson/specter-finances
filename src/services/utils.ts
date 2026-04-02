import { parseAmount } from './parsing';
import type { Expense } from '../types/expense';
import type { ExpenseFormData } from '../types/expense';
import type { Transfer, TransferFormData, Person } from '../types/transfer';

// ── Date helpers ──

/** Convert a YYYY-MM-DD string to a Date (local midnight) */
export function toDate(str: string): Date | null {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
}

/** Convert a Date to YYYY-MM-DD string */
export function fromDate(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's date as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Number helpers ──

/** Convert a string to number or '' for form inputs */
export function toNum(s: string): number | '' {
  if (!s) return '';
  const n = parseFloat(s);
  return isNaN(n) ? '' : n;
}

/** Convert a number or '' back to string */
export function fromNum(n: number | ''): string {
  if (n === '' || n === undefined) return '';
  return String(n);
}

/** Parse a formatted amount string (€1,234.56) to a number */
export function toNumber(formatted: string): number {
  const raw = parseAmount(formatted);
  return raw ? parseFloat(raw) : 0;
}

/** Format a number with 2 decimal places */
export function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

// ── Date filtering ──

/** Get a YYYY-MM-DD string for n months ago */
export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0];
}

/** Extract unique years from expenses, sorted descending */
export function getAvailableYears(expenses: Expense[]): number[] {
  const years = new Set<number>();
  for (const e of expenses) {
    const y = parseInt(e.date.slice(0, 4), 10);
    if (!isNaN(y)) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}

export type FilterMode = 'all' | 'last12' | 'year' | 'custom';

export interface FilterParams {
  mode: FilterMode;
  selectedYear?: string;
  customFrom?: string;
  customTo?: string;
}

/** Filter items by date using the given filter params */
export function filterByDate<T extends { date: string }>(items: T[], params: FilterParams): T[] {
  switch (params.mode) {
    case 'all':
      return items;
    case 'last12': {
      const cutoff = monthsAgo(12);
      return items.filter((item) => item.date >= cutoff);
    }
    case 'year':
      return items.filter((item) => item.date.startsWith(params.selectedYear ?? ''));
    case 'custom': {
      const from = params.customFrom ?? '';
      const to = params.customTo ?? '';
      return items.filter((item) => {
        if (from && item.date < from) return false;
        if (to && item.date > to) return false;
        return true;
      });
    }
  }
}

// ── Expense aggregation ──

export interface SpendingAggregation {
  totalDaniel: number;
  totalManuela: number;
  byCategory: Record<string, { daniel: number; manuela: number }>;
  byMonth: Record<string, { daniel: number; manuela: number }>;
}

/** Aggregate expenses into totals, by-category, and by-month breakdowns */
export function aggregateExpenses(expenses: Expense[]): SpendingAggregation {
  let totalDaniel = 0;
  let totalManuela = 0;
  const byCategory: Record<string, { daniel: number; manuela: number }> = {};
  const byMonth: Record<string, { daniel: number; manuela: number }> = {};

  for (const e of expenses) {
    const d = toNumber(e.amountDaniel);
    const m = toNumber(e.amountManuela);
    totalDaniel += d;
    totalManuela += m;

    const cat = e.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = { daniel: 0, manuela: 0 };
    byCategory[cat].daniel += d;
    byCategory[cat].manuela += m;

    const month = e.date.slice(0, 7);
    if (month) {
      if (!byMonth[month]) byMonth[month] = { daniel: 0, manuela: 0 };
      byMonth[month].daniel += d;
      byMonth[month].manuela += m;
    }
  }

  return { totalDaniel, totalManuela, byCategory, byMonth };
}

// ── Balance calculation ──

export interface BalanceResult {
  totalDaniel: number;
  totalManuela: number;
  transferDaniel: number;
  transferManuela: number;
  adjustedDeltaDaniel: number;
  adjustedDeltaManuela: number;
  netTransfer: number;
}

/** Calculate balance between Daniel and Manuela accounting for transfers */
export function calculateBalance(expenses: Expense[], transfers: Transfer[]): BalanceResult {
  const { totalDaniel, totalManuela } = aggregateExpenses(expenses);

  let transferDaniel = 0;
  let transferManuela = 0;
  for (const t of transfers) {
    transferDaniel += toNumber(t.amountDaniel);
    transferManuela += toNumber(t.amountManuela);
  }

  // Expenses are shared (50/50), so the raw delta is 2× the per-person owed amount.
  // Transfers are direct payments at face value, so they must be doubled to match the display scale.
  const adjustedDeltaDaniel = (totalDaniel - totalManuela) + 2 * (transferDaniel - transferManuela);
  const adjustedDeltaManuela = -adjustedDeltaDaniel || 0;
  const netTransfer = transferDaniel - transferManuela;

  return {
    totalDaniel,
    totalManuela,
    transferDaniel,
    transferManuela,
    adjustedDeltaDaniel,
    adjustedDeltaManuela,
    netTransfer,
  };
}

// ── Transfer helpers ──

/** Determine who made the transfer */
export function transferFrom(t: Transfer): Person {
  return t.amountDaniel ? 'Daniel' : 'Manuela';
}

/** Get the formatted transfer amount */
export function transferAmount(t: Transfer): string {
  return t.amountDaniel || t.amountManuela;
}

/** Convert a Transfer to form data for editing */
export function transferToFormData(t: Transfer): TransferFormData {
  const from = transferFrom(t);
  return {
    date: t.date,
    from,
    amount: parseAmount(from === 'Daniel' ? t.amountDaniel : t.amountManuela),
  };
}

// ── Expense helpers ──

/** Convert an Expense to form data for editing */
export function expenseToFormData(e: Expense): ExpenseFormData {
  return {
    date: e.date,
    amountDaniel: parseAmount(e.amountDaniel),
    amountManuela: parseAmount(e.amountManuela),
    item: e.item,
    category: e.category || 'Various',
    notes: e.notes,
  };
}
