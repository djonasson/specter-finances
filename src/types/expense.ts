export const CATEGORIES = ['Car', 'Food', 'Health', 'Holidays', 'Home', 'Various'] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Narrow an arbitrary sheet cell to a Category.
 *
 * The sheet is hand-edited, so column E can hold anything. Casting it to
 * Category was a lie the compiler believed: an unknown value produced a
 * phantom slice in the pie chart and its own row in the breakdown, splitting
 * one category's spending across two labels.
 */
export function toCategory(raw: string): Category | '' {
  return (CATEGORIES as readonly string[]).includes(raw) ? (raw as Category) : '';
}

/**
 * A row number in the Expenses sheet. Branded so it cannot be passed to the
 * Transfers or Gifts API: the three sheets have different header offsets, and
 * an index from the wrong one deletes or overwrites an unrelated record.
 * Compile-time only — at runtime this is just a number.
 */
export type ExpenseRow = number & { readonly __sheet: 'expenses' };

export interface Expense {
  /** 1-based row index in the spreadsheet (row 1 = header, row 2 = sub-header, data starts at row 3) */
  rowIndex: ExpenseRow;
  date: string; // YYYY-MM-DD
  amountA: string; // e.g. "€123.45" or ""
  amountB: string;
  item: string;
  category: Category | '';
  notes: string;
  /**
   * Columns I and J: how much of each person's amount was only for them.
   *
   * A €100 shop with €10 of it bought for one person alone is still €100 spent
   * — the sheet should say so — but only €90 of it is shared. These carry that
   * €10, so the spending stays honest and the balance does not make the other
   * person pay half of something they never had.
   *
   * Part of the amount beside it, never on top: `notCountedA` is a slice of
   * `amountA`, so it can never exceed it.
   */
  notCountedA: string;
  notCountedB: string;
  /**
   * Column G: which recurring rule and month produced this row, if any —
   * `rec:<ruleId>:YYYY-MM`. Empty on every hand-entered expense.
   *
   * Provenance only. Nothing reads this to write back into the row: a generated
   * expense records what was actually paid that month, and later edits to the
   * rule must not rewrite history.
   */
  recurringMarker: string;
  /**
   * Column H: the date this row was added, as opposed to the date of the
   * spending, which is column A.
   *
   * The two differ whenever a purchase is entered late or back-dated, and the
   * list is ordered by the spending date — so without this a row entered today
   * can land in the middle of the list, where nobody looking for it would
   * think to scroll.
   *
   * Written by the app on insert and never touched again; editing a row does
   * not change when it was added. Empty on every row that predates the column,
   * and on anything typed straight into Google Sheets, which reads as "not
   * known" rather than "old".
   */
  addedOn: string;
}

/**
 * The editable fields of an expense.
 *
 * Note the absence of `recurringMarker`. That is what keeps Duplicate honest —
 * duplicating a generated expense produces a fresh, unmarked row — and it means
 * no form can reach the marker at all.
 */
export interface ExpenseFormData {
  date: string;
  amountA: string; // raw number string, e.g. "123.45"
  amountB: string;
  /** The slice of the amount beside it that was only for that person. */
  notCountedA: string;
  notCountedB: string;
  item: string;
  category: Category;
  notes: string;
}
