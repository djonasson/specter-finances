export const CATEGORIES = [
  'Car',
  'Food',
  'Health',
  'Holidays',
  'Home',
  'Various',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Expense {
  /** 1-based row index in the spreadsheet (row 1 = header, row 2 = sub-header, data starts at row 3) */
  rowIndex: number;
  date: string; // YYYY-MM-DD
  amountDaniel: string; // e.g. "€123.45" or ""
  amountManuela: string;
  item: string;
  category: Category | '';
  notes: string;
}

export interface ExpenseFormData {
  date: string;
  amountDaniel: string; // raw number string, e.g. "123.45"
  amountManuela: string;
  item: string;
  category: Category;
  notes: string;
}
