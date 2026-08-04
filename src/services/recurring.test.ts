import { describe, it, expect } from 'vitest';
import {
  recurringMarker,
  parseRecurringMarker,
  monthKey,
  monthIndex,
  monthFromIndex,
  daysInMonth,
  dueDate,
  nextDueDate,
  pendingRecurring,
  toEveryMonths,
  describeInterval,
  datedInOwnMonth,
} from './recurring';
import type { Expense, ExpenseRow } from '../types/expense';
import type { RecurringRule, RecurringRow } from '../types/recurring';

// ── Factories ──

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    rowIndex: 2 as RecurringRow,
    id: 'r1',
    start: '2026-01-10',
    amountA: '€12.99',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Phone',
    category: 'Various',
    notes: '',
    day: 10,
    everyMonths: 1,
    amountVaries: false,
    ...overrides,
  };
}

/** Only the marker column matters here — that is all the generator can see. */
function marked(...markers: string[]): Pick<Expense, 'recurringMarker'>[] {
  return markers.map((recurringMarker) => ({ recurringMarker }));
}

// ── Markers ──
//
// The marker is the only record that a month was already paid. Read it too
// loosely and a stray note in column G silently cancels a real payment; read it
// too strictly and a real one is generated twice.

describe('recurring markers', () => {
  it('round-trips a rule id and a month', () => {
    const cell = recurringMarker('r7x', '2026-07');
    expect(cell).toBe('rec:r7x:2026-07');
    expect(parseRecurringMarker(cell)).toEqual({ ruleId: 'r7x', month: '2026-07' });
  });

  it('refuses a note that merely begins like a marker', () => {
    expect(parseRecurringMarker('rec: paid this one by card')).toBeNull();
  });

  it('refuses a marker whose month is not a month', () => {
    expect(parseRecurringMarker('rec:r1:July')).toBeNull();
    expect(parseRecurringMarker('rec:r1:2026-07-01')).toBeNull();
  });

  it('refuses a marker with no rule id, which nothing could be traced back to', () => {
    expect(parseRecurringMarker('rec::2026-07')).toBeNull();
  });

  it('reads a hand-entered expense as having no provenance', () => {
    expect(parseRecurringMarker('')).toBeNull();
  });

  it('tolerates a cell the spreadsheet padded with spaces', () => {
    expect(parseRecurringMarker('  rec:r1:2026-07  ')).toEqual({ ruleId: 'r1', month: '2026-07' });
  });
});

// ── Month arithmetic ──
//
// Done on strings and integers rather than Date objects: a Date-based
// implementation shifts by a day either side of midnight depending on the
// viewer's timezone, and here that moves a payment into the wrong month.

describe('month arithmetic', () => {
  it('takes the month off an ISO date', () => {
    expect(monthKey('2026-07-14')).toBe('2026-07');
  });

  it('crosses a year boundary going forwards', () => {
    expect(monthFromIndex(monthIndex('2026-12') + 1)).toBe('2027-01');
  });

  it('crosses a year boundary going backwards', () => {
    expect(monthFromIndex(monthIndex('2026-01') - 1)).toBe('2025-12');
  });

  it('steps back a whole catch-up window at once', () => {
    expect(monthFromIndex(monthIndex('2026-07') - 23)).toBe('2024-08');
  });

  it('round-trips a month through its index', () => {
    for (const m of ['2026-01', '2026-12', '1999-06', '2031-02']) {
      expect(monthFromIndex(monthIndex(m))).toBe(m);
    }
  });

  it('counts the months between two dates as a plain difference', () => {
    expect(monthIndex('2026-07') - monthIndex('2026-01')).toBe(6);
    expect(monthIndex('2027-01') - monthIndex('2026-01')).toBe(12);
  });

  it('knows February is longer in a leap year', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
  });

  it('counts the short and long months correctly', () => {
    expect(daysInMonth('2026-04')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
  });
});

// ── Due dates ──
//
// A payment set to the 31st still leaves the account in February. Clamping
// rather than skipping keeps that month's real spending on the sheet.

describe('dueDate', () => {
  it('falls on the chosen day in a month long enough to have one', () => {
    expect(dueDate('2026-07', 15)).toBe('2026-07-15');
  });

  it('moves a rule set to the 31st to the last day of February', () => {
    expect(dueDate('2026-02', 31)).toBe('2026-02-28');
    expect(dueDate('2028-02', 31)).toBe('2028-02-29');
  });

  it('moves a rule set to the 31st to the last day of a 30-day month', () => {
    expect(dueDate('2026-04', 31)).toBe('2026-04-30');
  });

  it('pads a single-digit day so the result still sorts as a date', () => {
    expect(dueDate('2026-07', 5)).toBe('2026-07-05');
  });
});

// ── Next due ──

describe('nextDueDate', () => {
  it('is later this month when the day has not passed', () => {
    expect(nextDueDate({ start: '2026-01-10', day: 25, everyMonths: 1 }, '2026-03-20')).toBe(
      '2026-03-25',
    );
  });

  it('rolls to next month once the day has passed', () => {
    expect(nextDueDate({ start: '2026-01-10', day: 10, everyMonths: 1 }, '2026-03-20')).toBe(
      '2026-04-10',
    );
  });

  // A payment starting on the 25th that falls due on the 5th first happens the
  // following month. Reporting the start date would name a day on which no
  // expense will ever be dated.
  it('reports the first date an expense would actually carry, not the start date', () => {
    expect(nextDueDate({ start: '2026-09-25', day: 5, everyMonths: 1 }, '2026-03-20')).toBe(
      '2026-10-05',
    );
  });

  it('reports the start month itself when the rule starts before its own day', () => {
    expect(nextDueDate({ start: '2026-09-01', day: 5, everyMonths: 1 }, '2026-03-20')).toBe(
      '2026-09-05',
    );
  });

  it('clamps to the last day of a short month', () => {
    expect(nextDueDate({ start: '2026-01-01', day: 31, everyMonths: 1 }, '2026-02-01')).toBe(
      '2026-02-28',
    );
  });
});

// ── Generation ──
//
// The core of the feature. Getting this wrong either charges the couple twice
// for a month or quietly loses a payment from the balance, and the sheet has no
// audit trail that would make either visible.

describe('pendingRecurring', () => {
  it('proposes the current month once its day has arrived', () => {
    const pending = pendingRecurring([makeRule()], [], '2026-01-10');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      date: '2026-01-10',
      month: '2026-01',
      marker: 'rec:r1:2026-01',
      item: 'Phone',
      amountA: '€12.99',
    });
  });

  it('proposes nothing before the day of the month arrives', () => {
    expect(pendingRecurring([makeRule({ day: 15 })], [], '2026-01-03')).toEqual([]);
  });

  it('proposes nothing when the month is already on the sheet', () => {
    const pending = pendingRecurring([makeRule()], marked('rec:r1:2026-01'), '2026-01-20');
    expect(pending).toEqual([]);
  });

  it('proposes every month missed while the app went unopened, in date order', () => {
    // Generated through January, opened again in April.
    const pending = pendingRecurring([makeRule()], marked('rec:r1:2026-01'), '2026-04-12');
    expect(pending.map((p) => p.month)).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(pending.map((p) => p.date)).toEqual(['2026-02-10', '2026-03-10', '2026-04-10']);
  });

  it('does not back-fill the month a rule started in when it started after its own day', () => {
    // Starts on the 25th, falls due on the 5th: January is already past.
    const rule = makeRule({ start: '2026-01-25', day: 5 });
    const pending = pendingRecurring([rule], [], '2026-02-28');
    expect(pending.map((p) => p.month)).toEqual(['2026-02']);
  });

  it('proposes the start month when the rule started on or before its day', () => {
    const rule = makeRule({ start: '2026-01-01', day: 5 });
    const pending = pendingRecurring([rule], [], '2026-01-31');
    expect(pending.map((p) => p.month)).toEqual(['2026-01']);
  });

  it('ignores a rule that has not started yet', () => {
    expect(pendingRecurring([makeRule({ start: '2027-01-10' })], [], '2026-06-01')).toEqual([]);
  });

  it('does not resurrect a generated expense the user deleted', () => {
    // February's row was deleted on purpose; March is the latest still marked.
    const pending = pendingRecurring(
      [makeRule()],
      marked('rec:r1:2026-01', 'rec:r1:2026-03'),
      '2026-04-30',
    );
    expect(pending.map((p) => p.month)).toEqual(['2026-04']);
  });

  it('ignores a marker belonging to a different rule for the same month', () => {
    const pending = pendingRecurring(
      [makeRule({ id: 'r2' })],
      marked('rec:r1:2026-01'),
      '2026-01-20',
    );
    expect(pending.map((p) => p.marker)).toEqual(['rec:r2:2026-01']);
  });

  it('ignores a rule someone added by hand with no id, rather than generating untraceable rows', () => {
    expect(pendingRecurring([makeRule({ id: '' })], [], '2026-06-01')).toEqual([]);
  });

  it('ignores a rule whose start date the sheet could not parse', () => {
    expect(pendingRecurring([makeRule({ start: 'every month' })], [], '2026-06-01')).toEqual([]);
  });

  it('proposes nothing at all when today is not a real date', () => {
    expect(pendingRecurring([makeRule()], [], 'not-a-date')).toEqual([]);
  });

  it('caps a long-dormant rule at the catch-up window instead of proposing years of rows', () => {
    const pending = pendingRecurring([makeRule({ start: '2019-01-10' })], [], '2026-07-31', {
      maxCatchUpOccurrences: 3,
    });
    expect(pending.map((p) => p.month)).toEqual(['2026-05', '2026-06', '2026-07']);
  });

  it('clamps a rule set to the 31st as it walks through short months', () => {
    const rule = makeRule({ start: '2026-01-31', day: 31 });
    const pending = pendingRecurring([rule], [], '2026-04-30');
    expect(pending.map((p) => p.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('interleaves two rules in date order so the confirmation reads chronologically', () => {
    const phone = makeRule({ id: 'r1', item: 'Phone', day: 20, start: '2026-01-01' });
    const gym = makeRule({ id: 'r2', item: 'Gym', day: 5, start: '2026-01-01' });
    const pending = pendingRecurring([phone, gym], [], '2026-02-28');
    expect(pending.map((p) => `${p.date} ${p.item}`)).toEqual([
      '2026-01-05 Gym',
      '2026-01-20 Phone',
      '2026-02-05 Gym',
      '2026-02-20 Phone',
    ]);
  });

  it('carries what the rule sets aside into every month it creates', () => {
    // A phone line only one of them uses repeats every month; without this it
    // would have to be corrected on the generated expense each time.
    const rule = makeRule({ amountA: '€30.00', notCountedA: '€12.00' });
    const [pending] = pendingRecurring([rule], [], '2026-01-10');
    expect(pending).toMatchObject({ amountA: '€30.00', notCountedA: '€12.00', notCountedB: '' });
  });

  it('copies the rule amounts through untouched, so no cent is lost to reformatting', () => {
    const rule = makeRule({ amountA: '€1,234.50', amountB: '€0.01' });
    const [pending] = pendingRecurring([rule], [], '2026-01-10');
    expect(pending.amountA).toBe('€1,234.50');
    expect(pending.amountB).toBe('€0.01');
  });

  it('treats a stray note in the marker column as no provenance and still proposes the month', () => {
    const pending = pendingRecurring([makeRule()], marked('paid by card'), '2026-01-20');
    expect(pending.map((p) => p.month)).toEqual(['2026-01']);
  });

  it('takes the amounts as the rule stands now, having no record of what it used to cost', () => {
    // The price rose to €15 while the app was unopened. Both missed months are
    // proposed at the new price — the confirmation step is where that is fixed,
    // and this test pins the limitation so it stays deliberate.
    const rule = makeRule({ amountA: '€15.00' });
    const pending = pendingRecurring([rule], marked('rec:r1:2026-01'), '2026-03-15');
    expect(pending.map((p) => p.amountA)).toEqual(['€15.00', '€15.00']);
  });
});

// ── The snapshot invariant ──

describe('generated expenses are snapshots', () => {
  it('cannot reach an expense row number even if a caller wanted it to', () => {
    // The parameter is Pick<Expense, 'recurringMarker'>, so this compiles only
    // because rowIndex is not required — and the function body has no way to
    // ask for one. That is the invariant enforced by the types rather than by
    // remembering.
    const existing: Pick<Expense, 'recurringMarker'>[] = marked('rec:r1:2026-01');
    expect(pendingRecurring([makeRule()], existing, '2026-01-20')).toEqual([]);
  });

  it('accepts full expense records too, and still reports only what is missing', () => {
    const full: Expense[] = [
      {
        rowIndex: 3 as ExpenseRow,
        date: '2026-01-10',
        amountA: '€12.99',
        amountB: '',
        notCountedA: '',
        notCountedB: '',
        item: 'Phone',
        category: 'Various',
        notes: '',
        recurringMarker: 'rec:r1:2026-01',
        addedOn: '',
      },
    ];
    expect(pendingRecurring([makeRule()], full, '2026-01-20')).toEqual([]);
  });
});

// ── How often a payment recurs ──
//
// Occurrences sit on a schedule anchored at the rule's start month, stepping by
// its interval. A bi-monthly bill starting in March falls in May and July and
// never April — and because every occurrence is at least a month from the next,
// the YYYY-MM marker still names exactly one of them.

describe('toEveryMonths', () => {
  it('takes an ordinary interval as it is', () => {
    expect(toEveryMonths(3)).toBe(3);
    expect(toEveryMonths('6')).toBe(6);
  });

  it('reads a blank cell as monthly, so a rule written before the column is unchanged', () => {
    expect(toEveryMonths(undefined)).toBe(1);
    expect(toEveryMonths('')).toBe(1);
  });

  it('holds a hand-typed value inside what the app can honour', () => {
    // Zero would never come round; a year and a half has no schedule to sit on.
    expect(toEveryMonths(0)).toBe(1);
    expect(toEveryMonths(-4)).toBe(1);
    expect(toEveryMonths(18)).toBe(12);
    expect(toEveryMonths('every other month')).toBe(1);
  });

  it('rounds a fractional interval to whole months', () => {
    expect(toEveryMonths(2.4)).toBe(2);
  });
});

describe('describeInterval', () => {
  it.each([
    [1, 'Monthly'],
    [2, 'Every 2 months'],
    [3, 'Every 3 months'],
    [6, 'Every 6 months'],
    [12, 'Yearly'],
  ])('reads %i months as %s', (months, expected) => {
    expect(describeInterval(months)).toBe(expected);
  });

  it('describes a rule with nothing set as monthly', () => {
    expect(describeInterval(0)).toBe('Monthly');
  });
});

describe('pendingRecurring across intervals', () => {
  it('offers a monthly rule exactly what it always did', () => {
    // The regression that licenses rewriting the loop: same rule, same answer.
    const monthly = makeRule({ start: '2026-01-10', day: 10, everyMonths: 1 });
    const pending = pendingRecurring([monthly], [], '2026-04-12');
    expect(pending.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
  });

  it('skips the months in between a bi-monthly bill', () => {
    const rule = makeRule({ start: '2026-03-10', day: 10, everyMonths: 2 });
    const pending = pendingRecurring([rule], [], '2026-08-31');
    expect(pending.map((p) => p.month)).toEqual(['2026-03', '2026-05', '2026-07']);
  });

  it('offers a quarterly bill four times a year', () => {
    const rule = makeRule({ start: '2026-01-15', day: 15, everyMonths: 3 });
    const pending = pendingRecurring([rule], [], '2026-12-31');
    expect(pending.map((p) => p.month)).toEqual(['2026-01', '2026-04', '2026-07', '2026-10']);
  });

  it('offers a half-yearly bill twice', () => {
    const rule = makeRule({ start: '2026-02-01', day: 1, everyMonths: 6 });
    const pending = pendingRecurring([rule], [], '2026-12-31');
    expect(pending.map((p) => p.month)).toEqual(['2026-02', '2026-08']);
  });

  it('offers a yearly bill in its own month and no other', () => {
    const rule = makeRule({ start: '2024-09-20', day: 20, everyMonths: 12 });
    const pending = pendingRecurring([rule], [], '2026-10-01');
    expect(pending.map((p) => p.month)).toEqual(['2024-09', '2025-09', '2026-09']);
  });

  it('resumes on the schedule after a gap rather than every month since', () => {
    const rule = makeRule({ start: '2026-01-10', day: 10, everyMonths: 3 });
    const pending = pendingRecurring([rule], marked('rec:r1:2026-01'), '2026-10-31');
    expect(pending.map((p) => p.month)).toEqual(['2026-04', '2026-07', '2026-10']);
  });

  it('does not resurrect a deleted occurrence, exactly as for a monthly rule', () => {
    const rule = makeRule({ start: '2026-01-10', day: 10, everyMonths: 3 });
    // April was deleted on purpose; July is the latest still marked.
    const pending = pendingRecurring(
      [rule],
      marked('rec:r1:2026-01', 'rec:r1:2026-07'),
      '2026-10-31',
    );
    expect(pending.map((p) => p.month)).toEqual(['2026-10']);
  });

  // Changing the interval must snap the rule back onto its own anchor rather
  // than drifting a month further out every time it is edited.
  it('realigns to the schedule when the interval is changed later', () => {
    const rule = makeRule({ start: '2026-01-10', day: 10, everyMonths: 6 });
    const pending = pendingRecurring([rule], marked('rec:r1:2026-02'), '2026-08-31');
    // The anchor is January, so a six-month schedule falls in July, not August.
    expect(pending.map((p) => p.month)).toEqual(['2026-07']);
  });

  it('clamps the day on a six-month step landing in February', () => {
    const rule = makeRule({ start: '2025-08-31', day: 31, everyMonths: 6 });
    const pending = pendingRecurring([rule], [], '2026-03-01');
    expect(pending.map((p) => p.date)).toEqual(['2025-08-31', '2026-02-28']);
  });

  it('offers nothing before the day arrives, whatever the interval', () => {
    const rule = makeRule({ start: '2026-03-25', day: 25, everyMonths: 2 });
    expect(pendingRecurring([rule], [], '2026-03-04')).toEqual([]);
  });

  it('counts the catch-up cap in occurrences, so a yearly bill keeps its history', () => {
    const rule = makeRule({ start: '2019-09-20', day: 20, everyMonths: 12 });
    const pending = pendingRecurring([rule], [], '2026-10-01', { maxCatchUpOccurrences: 3 });
    expect(pending.map((p) => p.month)).toEqual(['2024-09', '2025-09', '2026-09']);
  });

  it('interleaves payments on different schedules in date order', () => {
    const water = makeRule({
      id: 'r1',
      item: 'Water',
      start: '2026-01-05',
      day: 5,
      everyMonths: 2,
    });
    const power = makeRule({
      id: 'r2',
      item: 'Power',
      start: '2026-01-20',
      day: 20,
      everyMonths: 1,
    });
    const pending = pendingRecurring([water, power], [], '2026-03-31');
    expect(pending.map((p) => `${p.date} ${p.item}`)).toEqual([
      '2026-01-05 Water',
      '2026-01-20 Power',
      '2026-02-20 Power',
      '2026-03-05 Water',
      '2026-03-20 Power',
    ]);
  });
});

// ── Bills whose amount nobody knows in advance ──

describe('a payment whose amount varies', () => {
  // A varying rule reaches memory with no amount at all — fetchRecurring settles
  // that, so every screen agrees — and the generator simply carries it through.
  it('offers no amount at all, rather than one it invented', () => {
    const rule = makeRule({
      amountA: '',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      amountVaries: true,
    });
    const [pending] = pendingRecurring([rule], [], '2026-01-10');
    expect(pending).toMatchObject({
      amountA: '',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      amountVaries: true,
    });
  });

  it('still says when it is due, and what it is for', () => {
    const rule = makeRule({ item: 'Water', amountVaries: true });
    const [pending] = pendingRecurring([rule], [], '2026-01-10');
    expect(pending).toMatchObject({ item: 'Water', date: '2026-01-10', category: 'Various' });
  });

  it('leaves a fixed payment carrying its amount as before', () => {
    const [pending] = pendingRecurring([makeRule()], [], '2026-01-10');
    expect(pending).toMatchObject({ amountA: '€12.99', amountVaries: false });
  });
});

describe('nextDueDate across intervals', () => {
  it('names a month the rule actually falls on', () => {
    // Bi-monthly from March: May, not April.
    const rule = { start: '2026-03-10', day: 10, everyMonths: 2 };
    expect(nextDueDate(rule, '2026-04-01')).toBe('2026-05-10');
  });

  it('names this month when its day has not passed', () => {
    expect(nextDueDate({ start: '2026-01-25', day: 25, everyMonths: 3 }, '2026-04-02')).toBe(
      '2026-04-25',
    );
  });

  it('steps a whole interval once the day has gone by', () => {
    expect(nextDueDate({ start: '2026-01-25', day: 25, everyMonths: 3 }, '2026-04-26')).toBe(
      '2026-07-25',
    );
  });

  it('answers for a yearly bill without walking through the months between', () => {
    expect(nextDueDate({ start: '2020-09-20', day: 20, everyMonths: 12 }, '2026-10-01')).toBe(
      '2027-09-20',
    );
  });
});

// ── The date a row may carry ──
//
// Correctable, because a bill's day wanders — but not out of its own month,
// because that month is what says which occurrence the row is.

describe('datedInOwnMonth', () => {
  it('accepts any day inside the month', () => {
    expect(datedInOwnMonth('2026-02-01', '2026-02')).toBe(true);
    expect(datedInOwnMonth('2026-02-18', '2026-02')).toBe(true);
    expect(datedInOwnMonth('2026-02-28', '2026-02')).toBe(true);
  });

  it('refuses a date in the month either side', () => {
    expect(datedInOwnMonth('2026-01-31', '2026-02')).toBe(false);
    expect(datedInOwnMonth('2026-03-01', '2026-02')).toBe(false);
  });

  it('refuses the same day a year out', () => {
    expect(datedInOwnMonth('2027-02-18', '2026-02')).toBe(false);
  });

  // The month check alone would take these, since it only reads the first seven
  // characters.
  it('refuses a day that month never had', () => {
    expect(datedInOwnMonth('2026-02-99', '2026-02')).toBe(false);
    expect(datedInOwnMonth('2026-02-30', '2026-02')).toBe(false);
  });

  it('accepts the 29th only in a leap year', () => {
    expect(datedInOwnMonth('2026-02-29', '2026-02')).toBe(false);
    expect(datedInOwnMonth('2028-02-29', '2028-02')).toBe(true);
  });

  it('refuses anything that is not a date at all', () => {
    expect(datedInOwnMonth('', '2026-02')).toBe(false);
    expect(datedInOwnMonth('2026-2-5', '2026-02')).toBe(false);
    expect(datedInOwnMonth('February', '2026-02')).toBe(false);
  });
});
