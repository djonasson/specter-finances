import type { Person } from './transfer';

export interface Gift {
  /** 1-based row index in the Gifts sheet (row 1 = header, data starts at row 2) */
  rowIndex: number;
  date: string; // YYYY-MM-DD
  amountDaniel: string; // e.g. "€123.45" or ""
  amountManuela: string;
  notes: string;
}

export interface GiftFormData {
  date: string;
  from: Person;
  amount: string; // raw number string, e.g. "123.45"
  notes: string;
}
