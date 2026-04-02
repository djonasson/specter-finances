export type Person = 'Daniel' | 'Manuela';
export const PEOPLE: Person[] = ['Daniel', 'Manuela'];

export interface Transfer {
  /** 1-based row index in the Transfers sheet (row 1 = header, data starts at row 2) */
  rowIndex: number;
  date: string; // YYYY-MM-DD
  amountDaniel: string; // e.g. "€123.45" or ""
  amountManuela: string;
}

export interface TransferFormData {
  date: string;
  from: Person;
  amount: string; // raw number string, e.g. "123.45"
}
