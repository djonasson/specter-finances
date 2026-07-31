import type { Person } from './person';

/** A row number in the Transfers sheet. See ExpenseRow for why this is branded. */
export type TransferRow = number & { readonly __sheet: 'transfers' };

export interface Transfer {
  /**
   * Phantom tag, never present at runtime. Transfer and Gift are otherwise
   * structurally identical, and they enter calculateBalance with OPPOSITE
   * signs — without this the compiler happily accepts them swapped.
   */
  readonly __kind?: 'transfer';
  /** 1-based row index in the Transfers sheet (row 1 = header, data starts at row 2) */
  rowIndex: TransferRow;
  date: string; // YYYY-MM-DD
  amountA: string; // e.g. "€123.45" or ""
  amountB: string;
  notes: string;
}

export interface TransferFormData {
  readonly __kind?: 'transfer';
  date: string;
  from: Person;
  amount: string; // raw number string, e.g. "123.45"
  notes: string;
  /**
   * Declared-and-impossible so MovementForm, which is generic over
   * `TransferFormData | GiftFormData`, can read `form.giftKind` off the union
   * with no cast — while a transfer carrying one stays a type error.
   */
  giftKind?: never;
}
