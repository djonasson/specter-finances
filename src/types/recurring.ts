import type { Category } from './expense';

/**
 * A row number in the Recurring sheet. Branded for the same reason as the
 * others: the four tabs have different layouts, and an index from the wrong one
 * deletes or overwrites an unrelated record. Compile-time only.
 */
export type RecurringRow = number & { readonly __sheet: 'recurring' };

/**
 * A standing monthly payment — a phone bill, a subscription, a gym.
 *
 * This is metadata, not money. It never enters calculateBalance; only the
 * expense rows it produces do, and those are ordinary expenses.
 */
export interface RecurringRule {
  rowIndex: RecurringRow;
  /**
   * The stable identity, stored in the sheet rather than derived from the row.
   * Deleting any row above renumbers rowIndex, so a marker keyed on the row
   * number would start pointing at a different rule.
   *
   * Empty for a rule someone added by hand in Google Sheets. Such a rule is
   * listed but never generated from — a generated expense that nothing can be
   * traced back to is worse than one that was never generated.
   */
  id: string;
  /** YYYY-MM-DD. Nothing is generated dated before this. */
  start: string;
  amountA: string; // display form, e.g. "€12.99" or ""
  amountB: string;
  /**
   * The slice of the amount beside it that is only for that person — a phone
   * line on a shared bill, one person's add-on to a subscription. Carried by
   * the rule so it does not have to be re-entered on the generated expense
   * every single month.
   */
  notCountedA: string;
  notCountedB: string;
  item: string;
  category: Category | '';
  notes: string;
  /**
   * Day of the month the payment falls on, 1–31, clamped to the month's length
   * so 31 becomes 28, 29 or 30 as required.
   *
   * Held separately from `start` on purpose: a rule that fires on the 31st
   * cannot be expressed by a start date, because it may well begin in a 30-day
   * month.
   */
  day: number;
  /**
   * Months between one occurrence and the next: 1 monthly, 2 bi-monthly, 3
   * quarterly, 6 twice a year, 12 yearly. Held to 1–12.
   *
   * Blank in the sheet reads as 1, so every rule written before this column
   * existed is monthly and nothing it had already created moves.
   */
  everyMonths: number;
  /**
   * The amount is different every time — a utility bill, where only the
   * supplier knows the figure until it arrives.
   *
   * The app must not guess it: the rule stores no amount, and the confirmation
   * refuses to write the expense until one is typed in.
   */
  amountVaries: boolean;
}

export interface RecurringFormData {
  start: string;
  amountA: string; // raw number string, e.g. "12.99"
  amountB: string;
  notCountedA: string;
  notCountedB: string;
  item: string;
  category: Category;
  notes: string;
  day: number;
  everyMonths: number;
  amountVaries: boolean;
}
