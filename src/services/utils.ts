import { parseAmount, isIsoDate } from './parsing';
import type { Expense } from '../types/expense';
import type { ExpenseFormData } from '../types/expense';
import type { Transfer, TransferFormData } from '../types/transfer';
import type { Person } from '../types/person';
import type { Gift, GiftFormData } from '../types/gift';

// ── Date helpers ──

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

/**
 * Normalize what Mantine's DateInput hands back into a YYYY-MM-DD string.
 * v8 emits a string, but the Date branch is kept for the picker's own callbacks.
 */
export function dateInputValue(d: string | Date | null): string {
  if (d === null) return '';
  return typeof d === 'string' ? d : fromDate(d);
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

/**
 * A signed euro amount, sign first: `+€40.00`, `-€40.00`.
 *
 * The € is a literal prefix rather than part of the number's own format, so
 * interpolating a negative straight into `€{fmt(n)}` strands the minus behind
 * the symbol — `€-40.00`. Take the sign off the number and lead with it.
 */
export function fmtSigned(n: number): string {
  return `${n < 0 ? '-' : '+'}€${fmt(Math.abs(n))}`;
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
    // Only real dates: parseInt would happily read "21" out of "21-03-05".
    if (!isIsoDate(e.date)) continue;
    years.add(parseInt(e.date.slice(0, 4), 10));
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
      // A malformed date must never compare its way into a range — see isIsoDate.
      return items.filter((item) => isIsoDate(item.date) && item.date >= cutoff);
    }
    case 'year':
      return items.filter(
        (item) => isIsoDate(item.date) && item.date.startsWith(params.selectedYear ?? ''),
      );
    case 'custom': {
      const from = params.customFrom ?? '';
      const to = params.customTo ?? '';
      return items.filter((item) => {
        if (!from && !to) return true;
        if (!isIsoDate(item.date)) return false;
        if (from && item.date < from) return false;
        if (to && item.date > to) return false;
        return true;
      });
    }
  }
}

// ── Expense aggregation ──

export interface SpendingAggregation {
  totalA: number;
  totalB: number;
  byCategory: Record<string, { a: number; b: number }>;
  byMonth: Record<string, { a: number; b: number }>;
}

/** Aggregate expenses into totals, by-category, and by-month breakdowns */
export function aggregateExpenses(expenses: Expense[]): SpendingAggregation {
  let totalA = 0;
  let totalB = 0;
  const byCategory: Record<string, { a: number; b: number }> = {};
  const byMonth: Record<string, { a: number; b: number }> = {};

  for (const e of expenses) {
    const d = toNumber(e.amountA);
    const m = toNumber(e.amountB);
    totalA += d;
    totalB += m;

    const cat = e.category || 'Other';
    if (!byCategory[cat]) byCategory[cat] = { a: 0, b: 0 };
    byCategory[cat].a += d;
    byCategory[cat].b += m;

    const month = e.date.slice(0, 7);
    if (month) {
      if (!byMonth[month]) byMonth[month] = { a: 0, b: 0 };
      byMonth[month].a += d;
      byMonth[month].b += m;
    }
  }

  return { totalA, totalB, byCategory, byMonth };
}

// ── Chart data ──

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export interface MonthlyBars {
  labels: string[];
  a: number[];
  b: number[];
}

/**
 * Monthly spending series for the bar chart.
 *
 * With `average`, collapse every year onto twelve calendar months and divide
 * by the number of DISTINCT YEARS that month actually appears in — not by the
 * number of months in the range. A January seen in three years is divided by
 * three; a July seen once is divided by one. Getting that divisor wrong
 * silently rescales the whole chart, which is why this lives here with tests
 * rather than inline in the dashboard render.
 */
export function monthlyBars(
  byMonth: Record<string, { a: number; b: number }>,
  average: boolean,
): MonthlyBars {
  if (!average) {
    const labels = Object.keys(byMonth).sort();
    return {
      labels,
      a: labels.map((m) => byMonth[m]?.a ?? 0),
      b: labels.map((m) => byMonth[m]?.b ?? 0),
    };
  }

  const totals = Array.from({ length: 12 }, () => ({ a: 0, b: 0 }));
  const yearsPerMonth = Array<number>(12).fill(0);

  for (const [key, val] of Object.entries(byMonth)) {
    const idx = parseInt(key.slice(5, 7), 10) - 1;
    if (idx >= 0 && idx < 12) {
      totals[idx].a += val.a;
      totals[idx].b += val.b;
      yearsPerMonth[idx]++;
    }
  }

  return {
    labels: [...MONTH_NAMES],
    a: totals.map((t, i) => (yearsPerMonth[i] ? t.a / yearsPerMonth[i] : 0)),
    b: totals.map((t, i) => (yearsPerMonth[i] ? t.b / yearsPerMonth[i] : 0)),
  };
}

// ── Balance calculation ──

export interface BalanceResult {
  totalA: number;
  totalB: number;
  transferA: number;
  transferB: number;
  /** Gifts marked `forgiven` — the only ones that move the balance. */
  forgivenA: number;
  forgivenB: number;
  /** Gifts marked `present` — reported for display, absent from the formula. */
  presentA: number;
  presentB: number;
  /**
   * Real money: what A would be handed to square up. Positive means A is owed
   * it, negative means A owes it. Half the spending gap — see below.
   */
  owedToA: number;
  owedToB: number;
}

/** Calculate what one owes the other, accounting for transfers and gifts */
export function calculateBalance(
  expenses: Expense[],
  transfers: Transfer[],
  gifts: Gift[] = [],
): BalanceResult {
  const { totalA, totalB } = aggregateExpenses(expenses);

  let transferA = 0;
  let transferB = 0;
  for (const t of transfers) {
    transferA += toNumber(t.amountA);
    transferB += toNumber(t.amountB);
  }

  let forgivenA = 0;
  let forgivenB = 0;
  let presentA = 0;
  let presentB = 0;
  for (const g of gifts) {
    const d = toNumber(g.amountA);
    const m = toNumber(g.amountB);
    if (g.giftKind === 'present') {
      presentA += d;
      presentB += m;
    } else {
      // Anything not explicitly a present — including rows from before the kind
      // column existed — is forgiveness, which is the behaviour they had.
      forgivenA += d;
      forgivenB += m;
    }
  }

  // First the spending GAP: how much more one has put in than the other.
  //
  // A transfer or a forgiveness of €X swings it by 2×X, because it moves both
  // sides at once — one is €X better off AND the other €X worse off. Transfers
  // close the gap (+2x), forgiveness is the inverse (-2x). Presents are
  // deliberately absent: that money was a present rather than part of the
  // shared pot, so it must leave the gap exactly where it was.
  const gapA = totalA - totalB + 2 * (transferA - transferB) - 2 * (forgivenA - forgivenB);

  // Then halve it, because the gap is twice the debt: spending €1000 against
  // the other's €500 is a €500 gap, but only €250 changes hands to square up —
  // the payer is €250 better off and the receiver €250 worse off. Reporting the
  // gap invited reading it as the amount owed, and doubled every settlement.
  // (Exact in binary floating point, so this loses no precision.)
  const owedToA = gapA / 2;
  const owedToB = -owedToA || 0;

  return {
    totalA,
    totalB,
    transferA,
    transferB,
    forgivenA,
    forgivenB,
    presentA,
    presentB,
    owedToA,
    owedToB,
  };
}

// ── Shared transfer/gift helpers ──

/**
 * True when a transfer/gift row has amounts in BOTH columns.
 *
 * Direction is encoded by leaving one column empty, so a row with both filled
 * has no well-defined direction: `calculateBalance` counts both amounts, while
 * the list and the edit form only ever show one of them. Saving such a row
 * would drop the other amount silently, so callers must warn first.
 *
 * Only reachable by editing the sheet directly — the app's own writes always
 * blank one column.
 */
export function hasAmbiguousDirection(m: { amountA: string; amountB: string }): boolean {
  return !!m.amountA && !!m.amountB;
}

/** The columns transfers and gifts share — direction lives in which one is empty. */
interface MovementAmounts {
  date: string;
  amountA: string;
  amountB: string;
  notes: string;
}

/** Determine who sent the money. Both empty defaults to B — see hasAmbiguousDirection. */
export function movementFrom(m: MovementAmounts): Person {
  return m.amountA ? 'A' : 'B';
}

/** The formatted amount, from whichever column carries it */
export function movementAmount(m: MovementAmounts): string {
  return m.amountA || m.amountB;
}

/**
 * Convert a transfer/gift to form data for editing.
 *
 * Only the fields both kinds share; a gift's own `giftKind` is added by
 * giftToFormData, so editing one cannot silently re-price the row.
 */
export function movementToFormData(m: MovementAmounts): {
  date: string;
  from: Person;
  amount: string;
  notes: string;
} {
  const from = movementFrom(m);
  return {
    date: m.date,
    from,
    amount: parseAmount(from === 'A' ? m.amountA : m.amountB),
    notes: m.notes,
  };
}

// ── Transfer helpers ──
// Thin named wrappers: they keep the branded types at the call site, so a Gift
// cannot be passed where a Transfer is expected.

/** Determine who made the transfer */
export function transferFrom(t: Transfer): Person {
  return movementFrom(t);
}

/** Get the formatted transfer amount */
export function transferAmount(t: Transfer): string {
  return movementAmount(t);
}

/** Convert a Transfer to form data for editing */
export function transferToFormData(t: Transfer): TransferFormData {
  return movementToFormData(t);
}

// ── Gift helpers ──

/** Determine who gave the gift */
export function giftFrom(g: Gift): Person {
  return movementFrom(g);
}

/** Get the formatted gift amount */
export function giftAmount(g: Gift): string {
  return movementAmount(g);
}

/** Convert a Gift to form data for editing */
export function giftToFormData(g: Gift): GiftFormData {
  return { ...movementToFormData(g), giftKind: g.giftKind };
}

// ── Expense helpers ──

/** Convert an Expense to form data for editing */
export function expenseToFormData(e: Expense): ExpenseFormData {
  return {
    date: e.date,
    amountA: parseAmount(e.amountA),
    amountB: parseAmount(e.amountB),
    item: e.item,
    category: e.category || 'Various',
    notes: e.notes,
  };
}
