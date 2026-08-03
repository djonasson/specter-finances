import { parseAmount, isIsoDate } from './parsing';
import type { Expense, Category } from '../types/expense';
import type { ExpenseFormData } from '../types/expense';
import type { Transfer, TransferFormData } from '../types/transfer';
import type { Person } from '../types/person';
import type { Gift, GiftFormData } from '../types/gift';
import type { RecurringRule, RecurringFormData } from '../types/recurring';

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

// ── Recently added ──

/**
 * How many days a row counts as newly added for, today included.
 *
 * Three rather than one: something entered late on a Sunday should still be
 * findable on Monday morning.
 */
export const RECENTLY_ADDED_DAYS = 3;

/** Step back n days from a YYYY-MM-DD. UTC only, so no zone can shift it. */
export function daysBefore(isoDate: string, n: number): string {
  const ms = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)) - n,
  );
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Was this row added in the last few days?
 *
 * The list is ordered by the date of the spending, so a purchase entered today
 * but dated last month lands in the middle of it, where nobody looking for what
 * they just typed would think to scroll. This is what marks it.
 *
 * A row with no added date is not recent — every row written before the column
 * existed reads that way, and so does anything typed straight into Google
 * Sheets. That is "not known", not "old", but treating it as old is the answer
 * that never puts a badge on a years-old row.
 *
 * There is no upper bound on purpose: a date in the future means a device with
 * a wrong clock wrote it, and that row is certainly new.
 */
export function isRecentlyAdded(
  e: Pick<Expense, 'addedOn'>,
  todayIso: string,
  days: number = RECENTLY_ADDED_DAYS,
): boolean {
  if (!isIsoDate(todayIso)) return false;
  return addedSince(e, recentlyAddedCutoff(todayIso, days));
}

/**
 * The oldest added-date that still counts as recent.
 *
 * Separate from `isRecentlyAdded` so a caller checking many rows works it out
 * once rather than rebuilding a Date per row: the list asks this of every row it
 * renders, twice over, once per breakpoint.
 */
export function recentlyAddedCutoff(todayIso: string, days: number = RECENTLY_ADDED_DAYS): string {
  return daysBefore(todayIso, days - 1);
}

/** The comparison itself, against a cutoff already worked out. */
function addedSince(e: Pick<Expense, 'addedOn'>, cutoff: string): boolean {
  return isIsoDate(e.addedOn) && e.addedOn >= cutoff;
}

// ── Expense sorting and filtering ──

export type ExpenseSortKey = 'date' | 'inserted' | 'amount';

export interface ExpenseSort {
  key: ExpenseSortKey;
  asc: boolean;
}

/**
 * Newest first — the order a list of spending is normally read in.
 *
 * The list used to be shown in sheet order reversed. For a sheet filled in as
 * the money was spent the two are the same list; they part company only where
 * a row was back-dated, and there sorting by date is the more useful answer.
 */
export const DEFAULT_EXPENSE_SORT: ExpenseSort = { key: 'date', asc: false };

/**
 * What a row cost, both columns together.
 *
 * "Most expensive" is a property of the purchase, not of either person: a €200
 * bill split €100/€100 outranks a €150 one paid by one of them. Comparing the
 * two people is what the dashboard's category breakdown is for.
 */
export function expenseTotal(e: Pick<Expense, 'amountA' | 'amountB'>): number {
  return toNumber(e.amountA) + toNumber(e.amountB);
}

/**
 * Order expenses, without mutating the array handed in (it comes straight from
 * context state).
 *
 * Ties break on the sheet row and follow the primary direction, which keeps the
 * order stable across re-renders and gives the useful property that sorting by
 * date descending reproduces the old reversed-sheet order exactly for a sheet
 * filled in chronologically.
 *
 * A date the sheet could not parse never takes part in a comparison — those
 * rows go to the end whichever way the list is sorted, so they are neither
 * hidden at the bottom of a descending list nor falsely topping an ascending
 * one.
 */
export function sortExpenses<T extends Expense>(items: T[], sort: ExpenseSort): T[] {
  const direction = sort.asc ? 1 : -1;

  // Each row's sort keys are worked out once up front rather than inside the
  // comparator, which runs O(n log n) times. Both of the expensive ones hide
  // behind innocent-looking calls: isIsoDate builds a Date and reads three
  // fields off it, and expenseTotal runs two regex replaces per amount. Doing
  // that per comparison made the default ordering the slowest thing on the
  // screen for a sheet with a few thousand rows.
  const keyed = items.map((item) => ({
    item,
    dated: sort.key === 'date' && isIsoDate(item.date),
    total: sort.key === 'amount' ? expenseTotal(item) : 0,
  }));

  keyed.sort((a, b) => {
    if (sort.key === 'date') {
      if (a.dated !== b.dated) return a.dated ? -1 : 1; // unparseable last, both directions
      if (a.dated && a.item.date !== b.item.date) {
        return a.item.date < b.item.date ? -direction : direction;
      }
    } else if (sort.key === 'amount' && a.total !== b.total) {
      return a.total < b.total ? -direction : direction;
    }
    return (a.item.rowIndex - b.item.rowIndex) * direction;
  });

  return keyed.map((k) => k.item);
}

export interface ExpenseFilter {
  text: string;
  /** A category, `''` for the rows the sheet left uncategorised, or 'all'. */
  category: Category | '' | 'all';
  /** Keep only what was added in the last few days. Needs `todayIso`. */
  recentOnly?: boolean;
  todayIso?: string;
}

/**
 * Narrow the list by free text, category, and how recently a row was added.
 *
 * The text side is unchanged from what the list did inline, plus the word
 * "recurring" matching generated rows — which is the only way to filter by
 * provenance on the narrow layout, where there is no room for another control.
 *
 * `recentOnly` is ignored unless `todayIso` is a real date. Without a usable
 * "today" nothing can be recent, and applying it anyway would answer a request
 * to narrow the list by emptying it — which reads as "you have no expenses"
 * rather than "the clock is wrong".
 */
export function filterExpenses<T extends Expense>(items: T[], filter: ExpenseFilter): T[] {
  const text = filter.text.trim().toLowerCase();
  const todayIso = filter.todayIso ?? '';
  const recentOnly = !!filter.recentOnly && isIsoDate(todayIso);
  // Worked out once rather than per row.
  const cutoff = recentOnly ? recentlyAddedCutoff(todayIso) : '';

  return items.filter((e) => {
    if (filter.category !== 'all' && e.category !== filter.category) return false;
    if (recentOnly && !addedSince(e, cutoff)) return false;
    if (!text) return true;
    return (
      e.item.toLowerCase().includes(text) ||
      e.category.toLowerCase().includes(text) ||
      e.notes.toLowerCase().includes(text) ||
      e.date.includes(text) ||
      // Prefix, not containment: `'recurring'.includes(text)` was the wrong way
      // round, so searching a single letter of the word matched every generated
      // row. Three characters in before it counts, so "rec" works and "r" does
      // not hijack an ordinary search.
      (!!e.recurringMarker && text.length >= 3 && 'recurring'.startsWith(text))
    );
  });
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

/**
 * A recurring rule as its edit form.
 *
 * Goes through parseAmount like the other three converters rather than
 * stripping the symbols by hand: a cell holding something non-numeric then
 * arrives as an empty field instead of as junk that would be written back into
 * a rule and generate a wrong expense every month afterwards.
 */
export function recurringToFormData(r: RecurringRule): RecurringFormData {
  return {
    start: r.start,
    amountA: parseAmount(r.amountA),
    amountB: parseAmount(r.amountB),
    item: r.item,
    category: r.category || 'Various',
    notes: r.notes,
    day: r.day,
  };
}
