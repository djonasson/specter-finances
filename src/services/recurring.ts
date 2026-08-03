import { isIsoDate } from './parsing';
import type { Category, Expense } from '../types/expense';
import type { RecurringRule } from '../types/recurring';

/**
 * Working out which recurring payments are due, and turning them into expense
 * rows.
 *
 * Everything here is pure and takes "today" as an argument, so the tests never
 * depend on the clock and the answers cannot drift with the timezone. Month
 * arithmetic is done on YYYY-MM strings and integers; the only Date used is a
 * UTC one, for counting the days in a month.
 *
 * This lives apart from utils.ts deliberately: that file is the settlement
 * maths, and mixing an unrelated domain into it makes both harder to trust.
 */

/** How far back a first run will offer to catch up. */
export const MAX_CATCH_UP_MONTHS = 24;

/** The cell written into expenses column G to record where a row came from. */
export function recurringMarker(ruleId: string, month: string): string {
  return `rec:${ruleId}:${month}`;
}

/**
 * Read a marker back, or null if the cell is anything else.
 *
 * Strict on purpose. Column G is a cell in someone's spreadsheet and may end up
 * holding a stray note; a loose parse would read that as provenance and
 * suppress a payment that was never actually generated.
 */
export function parseRecurringMarker(raw: string): { ruleId: string; month: string } | null {
  const m = /^rec:([^:]+):(\d{4}-\d{2})$/.exec(raw.trim());
  return m ? { ruleId: m[1], month: m[2] } : null;
}

/** '2026-07-14' -> '2026-07' */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Shift a YYYY-MM by n months, as integers — no Date, so no timezone. */
export function addMonths(month: string, n: number): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const total = year * 12 + monthIndex + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}

/** Days in a YYYY-MM. UTC throughout, so it cannot land in the wrong month. */
export function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/**
 * The date a rule falls due in a given month, clamped to the month's length.
 *
 * A rule set to the 31st fires on the 28th in February and the 30th in April.
 * Clamping rather than skipping: the payment does leave the account in a short
 * month, so a skipped month would understate real spending.
 */
export function dueDate(month: string, day: number): string {
  const clamped = Math.min(Math.max(day, 1), daysInMonth(month));
  return `${month}-${String(clamped).padStart(2, '0')}`;
}

/**
 * The next date a rule falls due, on or after today.
 *
 * Shown in the list so it is clear what the app is going to do next. This
 * month's date counts if it has not passed yet; otherwise it is next month's.
 * A rule that has not started yet reports its start date, which is the honest
 * answer to "when does this first happen".
 */
export function nextDueDate(rule: Pick<RecurringRule, 'day' | 'start'>, todayIso: string): string {
  if (rule.start > todayIso) return rule.start;
  const thisMonth = dueDate(monthKey(todayIso), rule.day);
  return thisMonth >= todayIso ? thisMonth : dueDate(addMonths(monthKey(todayIso), 1), rule.day);
}

/** An expense a rule says is due but the sheet does not have yet. */
export interface PendingExpense {
  ruleId: string;
  month: string;
  marker: string;
  date: string;
  amountA: string; // display form, copied from the rule as it stands now
  amountB: string;
  item: string;
  category: Category | '';
  notes: string;
}

/**
 * Which months each rule still owes an expense row for.
 *
 * Two rules govern the answer:
 *
 * 1. **Generate forward from the last month already generated**, rather than
 *    filling every gap. So deleting a generated expense does not resurrect it
 *    on the next check — a deletion is a decision, and an app that quietly
 *    undoes it is worse than one that misses a month.
 * 2. **A month is due only once its day has arrived.** One comparison covers
 *    both ends: a rule on the 15th proposes nothing on the 3rd, and a rule
 *    started on the 25th with a day of 5 does not back-fill the month it
 *    started in.
 *
 * The amounts are copied from the rule as it stands *now*. A rule carries no
 * history, so months missed across a price change would be proposed at today's
 * price — which is why the confirmation step lets the amounts be corrected
 * before anything is written.
 *
 * `existing` is deliberately narrowed to the marker column: this function
 * cannot see a rowIndex even if a future caller wanted it to, which is what
 * makes "generated expenses are never rewritten from their rule" a property of
 * the types rather than of anyone's memory.
 */
export function pendingRecurring(
  rules: RecurringRule[],
  existing: Pick<Expense, 'recurringMarker'>[],
  todayIso: string,
  options: { maxCatchUpMonths?: number } = {},
): PendingExpense[] {
  if (!isIsoDate(todayIso)) return [];

  const maxCatchUp = options.maxCatchUpMonths ?? MAX_CATCH_UP_MONTHS;
  const currentMonth = monthKey(todayIso);
  const floorMonth = addMonths(currentMonth, -(maxCatchUp - 1));

  // Only well-formed markers count as provenance. One pass answers both
  // questions asked below: whether a given month is already on the sheet, and
  // how far each rule has got.
  const generated = new Set<string>();
  const lastGenerated = new Map<string, string>();
  for (const e of existing) {
    const parsed = parseRecurringMarker(e.recurringMarker);
    if (!parsed) continue;
    generated.add(recurringMarker(parsed.ruleId, parsed.month));
    const seen = lastGenerated.get(parsed.ruleId);
    if (!seen || parsed.month > seen) lastGenerated.set(parsed.ruleId, parsed.month);
  }

  const pending: PendingExpense[] = [];

  for (const rule of rules) {
    if (!rule.id || !isIsoDate(rule.start)) continue;

    // Walk forward from whichever is later: the month after the last one
    // generated, or the rule's own start.
    const start = monthKey(rule.start);
    const last = lastGenerated.get(rule.id);
    const resume = last ? addMonths(last, 1) : start;
    let month = resume > start ? resume : start;
    if (month < floorMonth) month = floorMonth;

    for (; month <= currentMonth; month = addMonths(month, 1)) {
      const date = dueDate(month, rule.day);
      if (date > todayIso) break; // not due yet, and neither is any later month
      if (date < rule.start) continue; // the rule had not started on that day
      if (generated.has(recurringMarker(rule.id, month))) continue;

      pending.push({
        ruleId: rule.id,
        month,
        marker: recurringMarker(rule.id, month),
        date,
        amountA: rule.amountA,
        amountB: rule.amountB,
        item: rule.item,
        category: rule.category,
        notes: rule.notes,
      });
    }
  }

  return pending.sort((a, b) => a.date.localeCompare(b.date));
}
