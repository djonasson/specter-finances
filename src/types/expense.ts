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
}

export interface ExpenseFormData {
  date: string;
  amountA: string; // raw number string, e.g. "123.45"
  amountB: string;
  item: string;
  category: Category;
  notes: string;
}
