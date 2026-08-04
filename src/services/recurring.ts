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

/**
 * How many missed occurrences a first run will offer to catch up.
 *
 * Counted in occurrences rather than months so the bound means the same thing
 * whatever the interval: 24 months would let a yearly bill catch up twice,
 * quietly dropping the rest of its history on a fresh install.
 */
export const MAX_CATCH_UP_OCCURRENCES = 24;

/** How many months a recurrence may span. */
export const MIN_EVERY_MONTHS = 1;
export const MAX_EVERY_MONTHS = 12;

/** Hold an interval read from a hand-editable cell to something workable. */
export function toEveryMonths(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < MIN_EVERY_MONTHS) return MIN_EVERY_MONTHS;
  return Math.min(n, MAX_EVERY_MONTHS);
}

/** How a recurrence reads to a person. */
export function describeInterval(everyMonths: number): string {
  const n = toEveryMonths(everyMonths);
  if (n === 1) return 'Monthly';
  if (n === 12) return 'Yearly';
  return `Every ${n} months`;
}

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

/** A YYYY-MM as a single number, so months can be counted and compared. */
export function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

/** The inverse of monthIndex. */
export function monthFromIndex(index: number): string {
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
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
 * The next date a rule would fall due, on or after today.
 *
 * Shown in the list so it is clear what the app will do next. This month's date
 * counts if it has not passed yet; otherwise it is next month's.
 *
 * A rule that has not started counts from its start date rather than from
 * today, and still lands on the rule's own day — a payment starting on the 25th
 * that falls due on the 5th first happens the following month, not on the 25th,
 * because that is the date an expense would actually carry.
 *
 * This answers "when next", not "what is outstanding": a rule with occurrences
 * already waiting to be confirmed is behind, and the list shows the earliest of
 * those instead.
 *
 * It only ever names a month the rule actually falls on. A bi-monthly bill
 * starting in March happens in May, not April, so the answer is snapped onto
 * the rule's own schedule rather than to the next month.
 */
export function nextDueDate(
  rule: Pick<RecurringRule, 'day' | 'start' | 'everyMonths'>,
  todayIso: string,
): string {
  const step = toEveryMonths(rule.everyMonths);
  const anchor = monthIndex(monthKey(rule.start));
  const from = rule.start > todayIso ? rule.start : todayIso;

  let index = alignToSchedule(anchor, step, monthIndex(monthKey(from)));
  // The month is right but its day may already have gone by.
  if (dueDate(monthFromIndex(index), rule.day) < from) index += step;
  return dueDate(monthFromIndex(index), rule.day);
}

/**
 * The first occurrence at or after `from`, staying on the rule's own schedule.
 *
 * Rounding up onto the schedule rather than stepping forward from wherever we
 * happen to be is what makes a rule whose interval was changed after some
 * expenses had been created snap back onto its anchor, instead of drifting a
 * month further out every time it is edited.
 */
function alignToSchedule(anchor: number, step: number, from: number): number {
  if (from <= anchor) return anchor;
  return anchor + Math.ceil((from - anchor) / step) * step;
}

/** The last occurrence at or before `until`, or the anchor if none has come. */
function latestOnOrBefore(anchor: number, step: number, until: number): number {
  if (until <= anchor) return anchor;
  return anchor + Math.floor((until - anchor) / step) * step;
}

/** An expense a rule says is due but the sheet does not have yet. */
export interface PendingExpense {
  ruleId: string;
  month: string;
  marker: string;
  date: string;
  amountA: string; // display form, copied from the rule as it stands now
  amountB: string;
  /** The rule does not know this month's figure; someone has to type it. */
  amountVaries: boolean;
  /** The slice of each amount that is only for that person. */
  notCountedA: string;
  notCountedB: string;
  item: string;
  category: Category | '';
  notes: string;
}

/**
 * Which months each rule still owes an expense row for.
 *
 * Two rules govern the answer:
 *
 * 1. **Generate forward from the last occurrence already generated**, rather
 *    than filling every gap. So deleting a generated expense does not resurrect
 *    it on the next check — a deletion is a decision, and an app that quietly
 *    undoes it is worse than one that misses a month.
 * 2. **An occurrence is due only once its day has arrived.** One comparison
 *    covers both ends: a rule on the 15th proposes nothing on the 3rd, and a
 *    rule started on the 25th with a day of 5 does not back-fill the month it
 *    started in.
 * 3. **Occurrences sit on a schedule anchored at the rule's start month**,
 *    stepping by its interval. A bi-monthly bill starting in March falls in
 *    May and July, never April — and because every occurrence is at least a
 *    month from the next, the YYYY-MM marker still names exactly one of them.
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
  options: { maxCatchUpOccurrences?: number } = {},
): PendingExpense[] {
  if (!isIsoDate(todayIso)) return [];

  const maxCatchUp = options.maxCatchUpOccurrences ?? MAX_CATCH_UP_OCCURRENCES;
  const currentIndex = monthIndex(monthKey(todayIso));

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

    const step = toEveryMonths(rule.everyMonths);
    const anchor = monthIndex(monthKey(rule.start));

    // Resume from the occurrence after the last one created, or from the very
    // first if none has been. Either way it is rounded up onto the schedule.
    const last = lastGenerated.get(rule.id);
    const resumeFrom = last ? monthIndex(last) + 1 : anchor;

    // Never offer more than the cap, counting back from the most recent
    // occurrence rather than from a fixed number of months — otherwise the
    // bound would mean two years for a monthly bill and two occurrences for a
    // yearly one. It is anchor + k*step by construction, so it is already on
    // the schedule and a plain comparison keeps the alignment.
    const floor = latestOnOrBefore(anchor, step, currentIndex) - (maxCatchUp - 1) * step;
    let index = Math.max(alignToSchedule(anchor, step, resumeFrom), floor);

    for (; index <= currentIndex; index += step) {
      const month = monthFromIndex(index);
      const date = dueDate(month, rule.day);
      if (date > todayIso) break; // not due yet, and neither is any later one
      if (date < rule.start) continue; // the rule had not started on that day
      if (generated.has(recurringMarker(rule.id, month))) continue;

      pending.push({
        ruleId: rule.id,
        month,
        marker: recurringMarker(rule.id, month),
        date,
        // Blank already for a varying payment: fetchRecurring establishes that
        // on the way in, so every screen agrees and this can simply copy.
        amountA: rule.amountA,
        amountB: rule.amountB,
        notCountedA: rule.notCountedA,
        notCountedB: rule.notCountedB,
        amountVaries: rule.amountVaries,
        item: rule.item,
        category: rule.category,
        notes: rule.notes,
      });
    }
  }

  return pending.sort((a, b) => a.date.localeCompare(b.date));
}
