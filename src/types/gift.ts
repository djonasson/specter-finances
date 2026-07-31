import type { Person } from './person';

/**
 * What a gift row actually was.
 *
 * - `present` — money changed hands as a present. It is outside the shared pot,
 *   so it does not move the balance at all.
 * - `forgiven` — no money moved; the giver let that much of the other's debt
 *   slide. Worth a −2× swing, exactly like the receiver having paid it.
 */
export type GiftKind = 'present' | 'forgiven';

export const GIFT_KINDS: GiftKind[] = ['present', 'forgiven'];

/**
 * Read the kind column, defaulting to `forgiven`.
 *
 * Every row written before this column existed comes back blank, and `forgiven`
 * is the −2× behaviour those rows already had — so no balance moves when the
 * column is introduced. Unrecognised text falls the same way for the same
 * reason: never silently re-price an existing row.
 */
export function toGiftKind(raw: string): GiftKind {
  return raw.trim().toLowerCase() === 'present' ? 'present' : 'forgiven';
}

/** A row number in the Gifts sheet. See ExpenseRow for why this is branded. */
export type GiftRow = number & { readonly __sheet: 'gifts' };

export interface Gift {
  /** Phantom tag — see Transfer.__kind. Gifts apply the inverse balance sign. */
  readonly __kind?: 'gift';
  /** 1-based row index in the Gifts sheet (row 1 = header, data starts at row 2) */
  rowIndex: GiftRow;
  date: string; // YYYY-MM-DD
  amountA: string; // e.g. "€123.45" or ""
  amountB: string;
  notes: string;
  giftKind: GiftKind;
}

export interface GiftFormData {
  readonly __kind?: 'gift';
  date: string;
  from: Person;
  amount: string; // raw number string, e.g. "123.45"
  notes: string;
  giftKind: GiftKind;
}
