/**
 * The two people, identified by position rather than by name.
 *
 * `A` owns the first amount column in every sheet tab, `B` the second. No real
 * name appears anywhere in this codebase: the app is usable by anyone, and
 * whose finances it happens to track is a property of the spreadsheet, not of
 * the software. Display names are read from the sheet's header row at runtime
 * — see `PersonNames` and `readPersonNames` in services/sheets.ts.
 */
export type Person = 'A' | 'B';

export const PEOPLE: Person[] = ['A', 'B'];

/** The one who isn't `p`. */
export function otherPerson(p: Person): Person {
  return p === 'A' ? 'B' : 'A';
}

/** What to call each of them on screen. */
export interface PersonNames {
  a: string;
  b: string;
}

/**
 * Used until the sheet has been read, and for a sheet whose header cells are
 * blank. Generic on purpose — a wrong name is worse than an honest placeholder.
 */
export const DEFAULT_NAMES: PersonNames = { a: 'Partner A', b: 'Partner B' };

export function nameOf(names: PersonNames, p: Person): string {
  return p === 'A' ? names.a : names.b;
}
