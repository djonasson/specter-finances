import { describe, it, expect } from 'vitest';
import type { Expense, ExpenseRow } from '../types/expense';
import type { Transfer, TransferRow } from '../types/transfer';
import type { Gift, GiftRow } from '../types/gift';
import type { RecurringRow } from '../types/recurring';
import { toGiftKind } from '../types/gift';
import {
  fromDate,
  dateInputValue,
  toNum,
  fromNum,
  toNumber,
  fmt,
  fmtSigned,
  getAvailableYears,
  filterByDate,
  aggregateExpenses,
  calculateBalance,
  monthlyBars,
  transferFrom,
  transferAmount,
  transferToFormData,
  giftFrom,
  giftAmount,
  giftToFormData,
  expenseToFormData,
  hasAmbiguousDirection,
  sortExpenses,
  filterExpenses,
  expenseTotal,
  DEFAULT_EXPENSE_SORT,
  daysBefore,
  isRecentlyAdded,
  recurringToFormData,
  notCountedProblem,
} from './utils';
import { formatAmount } from './parsing';

// ── Factories ──

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    rowIndex: 3 as ExpenseRow,
    date: '2026-01-15',
    amountA: '',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Test',
    category: 'Food',
    notes: '',
    // Hand-entered by default: the balance cases below therefore double as
    // proof that introducing the recurring marker column moved nobody's money.
    recurringMarker: '',
    addedOn: '',
    ...overrides,
  };
}

function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    rowIndex: 2 as TransferRow,
    date: '2026-01-20',
    amountA: '',
    amountB: '',
    notes: '',
    ...overrides,
  };
}

/**
 * Defaults to `forgiven` on purpose: that is how every row written before the
 * kind column existed reads back, so the balance tests below double as proof
 * that introducing the column moved nobody's balance.
 */
function makeGift(overrides: Partial<Gift> = {}): Gift {
  return {
    rowIndex: 2 as GiftRow,
    date: '2026-01-20',
    amountA: '',
    amountB: '',
    notes: '',
    giftKind: 'forgiven',
    ...overrides,
  };
}

// ── Date helpers ──

describe('fromDate', () => {
  it('converts Date to YYYY-MM-DD', () => {
    expect(fromDate(new Date(2026, 2, 15))).toBe('2026-03-15');
  });

  it('pads single-digit month and day', () => {
    expect(fromDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('returns empty string for null', () => {
    expect(fromDate(null)).toBe('');
  });

  it('handles December correctly', () => {
    expect(fromDate(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('handles future dates', () => {
    expect(fromDate(new Date(2030, 5, 15))).toBe('2030-06-15');
  });
});

// ── DateInput onChange ──
// Mantine v8 DateInput onChange returns DateStringValue (string), not Date.
// dateInputValue is the real helper the forms and the dashboard call, so these
// tests fail if that handling regresses.

describe('dateInputValue', () => {
  it('handles string value from Mantine v8 DateInput', () => {
    expect(dateInputValue('2026-04-10')).toBe('2026-04-10');
  });

  it('handles Date object fallback', () => {
    expect(dateInputValue(new Date(2026, 3, 10))).toBe('2026-04-10');
  });

  it('handles null (cleared input)', () => {
    expect(dateInputValue(null)).toBe('');
  });

  it('round-trips a picked date back through the value prop', () => {
    // user picks -> onChange -> form.date -> value={form.date || null} -> onChange
    expect(dateInputValue(dateInputValue('2026-12-25'))).toBe('2026-12-25');
  });
});

// ── Number helpers ──

describe('toNum', () => {
  it('converts numeric string to number', () => {
    expect(toNum('123.45')).toBe(123.45);
  });

  it('returns empty string for empty input', () => {
    expect(toNum('')).toBe('');
  });

  it('returns empty string for non-numeric input', () => {
    expect(toNum('abc')).toBe('');
  });

  it('handles zero', () => {
    expect(toNum('0')).toBe(0);
  });

  it('handles integer strings', () => {
    expect(toNum('42')).toBe(42);
  });

  it('handles negative numbers', () => {
    expect(toNum('-5.5')).toBe(-5.5);
  });
});

describe('fromNum', () => {
  it('converts number to string', () => {
    expect(fromNum(123.45)).toBe('123.45');
  });

  it('returns empty string for empty input', () => {
    expect(fromNum('')).toBe('');
  });

  it('handles zero', () => {
    expect(fromNum(0)).toBe('0');
  });

  it('handles undefined', () => {
    expect(fromNum(undefined as unknown as '')).toBe('');
  });

  it('round-trips with toNum', () => {
    expect(fromNum(toNum('42.5') as number)).toBe('42.5');
  });
});

describe('toNumber', () => {
  it('parses formatted euro amounts', () => {
    expect(toNumber('€123.45')).toBe(123.45);
    expect(toNumber('€1,234.56')).toBe(1234.56);
  });

  it('returns 0 for empty string', () => {
    expect(toNumber('')).toBe(0);
  });

  it('returns 0 for non-numeric input', () => {
    expect(toNumber('abc')).toBe(0);
  });

  it('handles amounts without euro sign', () => {
    // parseAmount strips € and commas, so plain numbers work
    expect(toNumber('100.00')).toBe(100);
  });

  it('handles large amounts', () => {
    expect(toNumber('€99,999.99')).toBe(99999.99);
  });
});

describe('fmt', () => {
  it('formats with minimum 2 decimal places', () => {
    expect(fmt(123.4)).toBe('123.40');
    expect(fmt(123.45)).toBe('123.45');
  });

  it('formats zero', () => {
    expect(fmt(0)).toBe('0.00');
  });

  it('adds comma separators for thousands', () => {
    expect(fmt(1234.56)).toBe('1,234.56');
    expect(fmt(1000000)).toBe('1,000,000.00');
  });

  it('handles negative numbers', () => {
    expect(fmt(-50.5)).toBe('-50.50');
  });
});

describe('fmtSigned', () => {
  it('puts the minus in front of the symbol, not behind it', () => {
    expect(fmtSigned(-400)).toBe('-€400.00');
  });

  it('marks a positive with a plus', () => {
    expect(fmtSigned(400)).toBe('+€400.00');
  });

  it('reads zero as square rather than negative', () => {
    expect(fmtSigned(0)).toBe('+€0.00');
    // calculateBalance normalises -0 away, but never render "-€0.00" if it slips through.
    expect(fmtSigned(-0)).toBe('+€0.00');
  });

  it('keeps the thousands separators', () => {
    expect(fmtSigned(-6086.38)).toBe('-€6,086.38');
    expect(fmtSigned(1234.5)).toBe('+€1,234.50');
  });
});

// ── Date filtering ──

describe('getAvailableYears', () => {
  it('extracts unique years sorted descending', () => {
    const expenses = [
      makeExpense({ date: '2024-01-01' }),
      makeExpense({ date: '2026-06-15' }),
      makeExpense({ date: '2024-12-31' }),
      makeExpense({ date: '2025-03-01' }),
    ];
    expect(getAvailableYears(expenses)).toEqual([2026, 2025, 2024]);
  });

  it('returns empty array for no expenses', () => {
    expect(getAvailableYears([])).toEqual([]);
  });

  it('handles single year', () => {
    const expenses = [makeExpense({ date: '2026-01-01' }), makeExpense({ date: '2026-12-31' })];
    expect(getAvailableYears(expenses)).toEqual([2026]);
  });

  it('skips expenses with invalid dates', () => {
    const expenses = [
      makeExpense({ date: '2026-01-01' }),
      makeExpense({ date: '' }),
      makeExpense({ date: 'invalid' }),
    ];
    expect(getAvailableYears(expenses)).toEqual([2026]);
  });
});

describe('malformed dates stay out of date ranges', () => {
  // "March 2013" sorts above "2025-…" lexicographically, so before isIsoDate it
  // was pulled into last-12-months and inflated the totals for that period.
  const junk = makeExpense({ date: 'March 2013' });
  const good = makeExpense({ date: '2026-07-01' });

  it('excludes them from last12', () => {
    expect(filterByDate([junk, good], { mode: 'last12' })).toEqual([good]);
  });

  it('excludes them from a custom range', () => {
    const params = { mode: 'custom' as const, customFrom: '2000-01-01', customTo: '2030-01-01' };
    expect(filterByDate([junk, good], params)).toEqual([good]);
  });

  it('keeps them under "all", so the bad row is still visible', () => {
    expect(filterByDate([junk, good], { mode: 'all' })).toEqual([junk, good]);
  });

  it('keeps them out of the year dropdown', () => {
    expect(getAvailableYears([junk, good, makeExpense({ date: '21-03-05' })])).toEqual([2026]);
  });
});

describe('filterByDate', () => {
  const items = [
    { date: '2024-06-01' },
    { date: '2025-01-15' },
    { date: '2025-06-30' },
    { date: '2025-12-31' },
    { date: '2026-03-15' },
  ];

  it('returns all items in "all" mode', () => {
    expect(filterByDate(items, { mode: 'all' })).toEqual(items);
  });

  it('filters by year', () => {
    const result = filterByDate(items, { mode: 'year', selectedYear: '2025' });
    expect(result).toEqual([
      { date: '2025-01-15' },
      { date: '2025-06-30' },
      { date: '2025-12-31' },
    ]);
  });

  it('returns empty when no items match year', () => {
    const result = filterByDate(items, { mode: 'year', selectedYear: '2020' });
    expect(result).toEqual([]);
  });

  it('filters by custom range (both from and to)', () => {
    const result = filterByDate(items, {
      mode: 'custom',
      customFrom: '2025-01-01',
      customTo: '2025-12-31',
    });
    expect(result).toEqual([
      { date: '2025-01-15' },
      { date: '2025-06-30' },
      { date: '2025-12-31' },
    ]);
  });

  it('filters by custom range (from only)', () => {
    const result = filterByDate(items, {
      mode: 'custom',
      customFrom: '2025-12-01',
    });
    expect(result).toEqual([{ date: '2025-12-31' }, { date: '2026-03-15' }]);
  });

  it('filters by custom range (to only)', () => {
    const result = filterByDate(items, {
      mode: 'custom',
      customTo: '2024-12-31',
    });
    expect(result).toEqual([{ date: '2024-06-01' }]);
  });

  it('custom range with empty strings returns all', () => {
    const result = filterByDate(items, {
      mode: 'custom',
      customFrom: '',
      customTo: '',
    });
    expect(result).toEqual(items);
  });

  it('works with Transfer objects', () => {
    const transfers = [makeTransfer({ date: '2025-06-01' }), makeTransfer({ date: '2026-01-15' })];
    const result = filterByDate(transfers, { mode: 'year', selectedYear: '2025' });
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-06-01');
  });
});

// ── Expense aggregation ──

describe('aggregateExpenses', () => {
  it('returns zeros for empty array', () => {
    const result = aggregateExpenses([]);
    expect(result.totalA).toBe(0);
    expect(result.totalB).toBe(0);
    expect(Object.keys(result.byCategory)).toHaveLength(0);
    expect(Object.keys(result.byMonth)).toHaveLength(0);
  });

  it('sums totals correctly', () => {
    const expenses = [
      makeExpense({ amountA: '€100.00', amountB: '€50.00' }),
      makeExpense({ amountA: '€200.00', amountB: '€75.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.totalA).toBe(300);
    expect(result.totalB).toBe(125);
  });

  it('handles empty amounts as zero', () => {
    const expenses = [
      makeExpense({ amountA: '€100.00', amountB: '' }),
      makeExpense({ amountA: '', amountB: '€200.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.totalA).toBe(100);
    expect(result.totalB).toBe(200);
  });

  it('groups by category correctly', () => {
    const expenses = [
      makeExpense({ category: 'Food', amountA: '€100.00', amountB: '€50.00' }),
      makeExpense({ category: 'Car', amountA: '€200.00', amountB: '' }),
      makeExpense({ category: 'Food', amountA: '€30.00', amountB: '€20.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.byCategory['Food']).toEqual({ a: 130, b: 70 });
    expect(result.byCategory['Car']).toEqual({ a: 200, b: 0 });
  });

  it('uses "Other" for empty category', () => {
    const expenses = [makeExpense({ category: '' as Expense['category'], amountA: '€50.00' })];
    const result = aggregateExpenses(expenses);
    expect(result.byCategory['Other']).toEqual({ a: 50, b: 0 });
  });

  it('groups by month correctly', () => {
    const expenses = [
      makeExpense({ date: '2026-01-10', amountA: '€100.00' }),
      makeExpense({ date: '2026-01-20', amountA: '€50.00' }),
      makeExpense({ date: '2026-02-05', amountB: '€75.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.byMonth['2026-01']).toEqual({ a: 150, b: 0 });
    expect(result.byMonth['2026-02']).toEqual({ a: 0, b: 75 });
  });

  it('handles expenses across multiple years', () => {
    const expenses = [
      makeExpense({ date: '2024-12-31', amountA: '€100.00' }),
      makeExpense({ date: '2025-01-01', amountA: '€200.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.byMonth['2024-12']).toEqual({ a: 100, b: 0 });
    expect(result.byMonth['2025-01']).toEqual({ a: 200, b: 0 });
  });

  it('handles all six categories', () => {
    const categories = ['Car', 'Food', 'Health', 'Holidays', 'Home', 'Various'] as const;
    const expenses = categories.map((cat, i) =>
      makeExpense({ category: cat, amountA: `€${(i + 1) * 10}.00` }),
    );
    const result = aggregateExpenses(expenses);
    expect(Object.keys(result.byCategory).sort()).toEqual([...categories].sort());
    expect(result.byCategory['Car'].a).toBe(10);
    expect(result.byCategory['Various'].a).toBe(60);
  });
});

// ── Balance calculation ──

describe('calculateBalance', () => {
  // The figure reported is REAL MONEY: what one would hand the other to square
  // up, i.e. half the spending gap. Expenses are shared 50/50, so €200 more
  // spent is €100 owed; a transfer or forgiveness is money moving between the
  // two, so it counts at face value.

  it('returns zeros with no data', () => {
    const result = calculateBalance([], []);
    expect(result.owedToA).toBe(0);
    expect(result.owedToB).toBe(0);
  });

  it('reads as real money: €1000 against €500 is €250 owed, not €500', () => {
    // The figure this returns must be the amount that would actually change
    // hands. Paying €500 would leave A out €500 and B out €1000 —
    // reporting the €500 gap here is what made forgiveness look doubled.
    const expenses = [makeExpense({ amountA: '€1,000.00', amountB: '€500.00' })];
    expect(calculateBalance(expenses, []).owedToA).toBe(250);

    // And every figure entered moves it by its own face value.
    const forgiveAll = calculateBalance(expenses, [], [makeGift({ amountA: '€250.00' })]);
    const forgiveHalf = calculateBalance(expenses, [], [makeGift({ amountA: '€125.00' })]);
    expect(forgiveAll.owedToA).toBe(0);
    expect(forgiveHalf.owedToA).toBe(125);

    // Settling it by transfer costs the same €250 as forgiving it does.
    const shePays = calculateBalance(expenses, [makeTransfer({ amountB: '€250.00' })]);
    expect(shePays.owedToA).toBe(0);
  });

  it('halves the spending gap, because a shared expense is split two ways', () => {
    // A put in €200 more, so B is €100 short of their half.
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const result = calculateBalance(expenses, []);
    expect(result.totalA).toBe(300);
    expect(result.totalB).toBe(100);
    expect(result.owedToA).toBe(100);
    expect(result.owedToB).toBe(-100);
  });

  it('equalises the two ways of settling up', () => {
    // Paying the other €50 and spending €100 more on shared things leave the
    // same amount owed — that equivalence is why the gap is twice the debt.
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const paysHim = calculateBalance(expenses, [makeTransfer({ amountB: '€50.00' })]);
    const spendsMore = calculateBalance([...expenses, makeExpense({ amountB: '€100.00' })], []);
    expect(paysHim.owedToA).toBe(50);
    expect(spendsMore.owedToA).toBe(50);
  });

  // The transfer column means "this person SENT money to the other".
  // Sending money increases the sender's effective contribution.

  it('a transfer from the one who spent less counts at face value', () => {
    // A spent €200 more, so €100 is owed. B transfers €50 of it.
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const transfers = [makeTransfer({ amountB: '€50.00' })];
    const result = calculateBalance(expenses, transfers);
    // (200 + 2*(0-50)) / 2 = 50
    expect(result.owedToA).toBe(50);
    expect(result.owedToB).toBe(-50);
  });

  it('a transfer from the one who spent more adds to what he is owed', () => {
    // A spent €200 more AND gives B €80 cash.
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const transfers = [makeTransfer({ amountA: '€80.00' })];
    const result = calculateBalance(expenses, transfers);
    // (200 + 2*(80-0)) / 2 = 180
    expect(result.owedToA).toBe(180);
    expect(result.owedToB).toBe(-180);
  });

  it('transferring exactly what is owed squares up', () => {
    // spentA=300, spentB=100 → €100 owed. B transfers precisely that.
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const transfers = [makeTransfer({ amountB: '€100.00' })];
    const result = calculateBalance(expenses, transfers);
    expect(result.owedToA).toBe(0);
    expect(result.owedToB).toBe(0);
  });

  it('overshooting flips who is owed', () => {
    // €100 owed, B transfers €150 — an overpayment of €50.
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const transfers = [makeTransfer({ amountB: '€150.00' })];
    const result = calculateBalance(expenses, transfers);
    // (200 + 2*(0-150)) / 2 = -50
    expect(result.owedToA).toBe(-50);
    expect(result.owedToB).toBe(50);
  });

  it('multiple expenses and multiple transfers', () => {
    const expenses = [
      makeExpense({ amountA: '€100.00', amountB: '' }),
      makeExpense({ amountA: '', amountB: '€50.00' }),
      makeExpense({ amountA: '€200.00', amountB: '€75.00' }),
    ];
    const transfers = [
      makeTransfer({ amountA: '€30.00' }), // A sends €30
      makeTransfer({ amountB: '€20.00' }), // B sends €20
    ];
    const result = calculateBalance(expenses, transfers);
    expect(result.totalA).toBe(300);
    expect(result.totalB).toBe(125);
    // Gap: 175 + 2*(30-20) = 195. Owed: 97.50
    expect(result.owedToA).toBe(97.5);
    expect(result.owedToB).toBe(-97.5);
  });

  it('B spending more than A', () => {
    const expenses = [makeExpense({ amountA: '€50.00', amountB: '€300.00' })];
    const result = calculateBalance(expenses, []);
    expect(result.owedToA).toBe(-125);
    expect(result.owedToB).toBe(125);
  });

  it('B spending more, A settles up with transfer', () => {
    // B spent €250 more, so A owes €125. A transfers €100 of it.
    const expenses = [makeExpense({ amountA: '€50.00', amountB: '€300.00' })];
    const transfers = [makeTransfer({ amountA: '€100.00' })];
    const result = calculateBalance(expenses, transfers);
    // (-250 + 2*(100-0)) / 2 = -25
    expect(result.owedToA).toBe(-25);
    expect(result.owedToB).toBe(25);
  });

  it('only transfers, no expenses — the sender is owed what he sent', () => {
    const transfers = [makeTransfer({ amountA: '€100.00' })];
    const result = calculateBalance([], transfers);
    // (0 + 2*(100-0)) / 2 = 100
    expect(result.owedToA).toBe(100);
    expect(result.owedToB).toBe(-100);
  });

  it('handles empty amount strings', () => {
    const expenses = [makeExpense({ amountA: '€100.00', amountB: '' })];
    const transfers = [makeTransfer({ amountA: '', amountB: '' })];
    const result = calculateBalance(expenses, transfers);
    expect(result.owedToA).toBe(50);
    expect(result.owedToB).toBe(-50);
  });

  it('equal spending with equal transfers nets to zero', () => {
    const expenses = [makeExpense({ amountA: '€100.00', amountB: '€100.00' })];
    const transfers = [makeTransfer({ amountA: '€50.00' }), makeTransfer({ amountB: '€50.00' })];
    const result = calculateBalance(expenses, transfers);
    expect(result.owedToA).toBe(0);
    expect(result.owedToB).toBe(0);
  });

  it('real-world scale: €6,086.38 gap, B transfers €300', () => {
    const expenses = [makeExpense({ amountA: '€8,043.19', amountB: '€1,956.81' })];
    const transfers = [makeTransfer({ amountB: '€300.00' })];
    const result = calculateBalance(expenses, transfers);
    // (6086.38 + 2*(0-300)) / 2 = 2743.19
    expect(result.owedToA).toBeCloseTo(2743.19, 2);
    expect(result.owedToB).toBeCloseTo(-2743.19, 2);
  });

  it('with no transfers, what is owed is half the spending difference', () => {
    const expenses = [makeExpense({ amountA: '€8,043.19', amountB: '€1,956.81' })];
    const result = calculateBalance(expenses, []);
    // 8043.19 - 1956.81 = 6086.38 of gap, half of which is owed.
    expect(result.owedToA).toBeCloseTo(3043.19, 2);
    expect(result.owedToB).toBeCloseTo(-3043.19, 2);
    expect(result.transferA).toBe(0);
    expect(result.transferB).toBe(0);
  });

  it('large number of small expenses accumulate correctly', () => {
    const expenses = Array.from({ length: 100 }, () =>
      makeExpense({ amountA: '€10.00', amountB: '€5.00' }),
    );
    const result = calculateBalance(expenses, []);
    expect(result.totalA).toBe(1000);
    expect(result.totalB).toBe(500);
    expect(result.owedToA).toBe(250);
  });
});

// ── Transfer helpers ──

describe('hasAmbiguousDirection', () => {
  it('is false when only A has an amount', () => {
    expect(hasAmbiguousDirection({ amountA: '€100.00', amountB: '' })).toBe(false);
  });

  it('is false when only B has an amount', () => {
    expect(hasAmbiguousDirection({ amountA: '', amountB: '€100.00' })).toBe(false);
  });

  it('is false when neither column has an amount', () => {
    expect(hasAmbiguousDirection({ amountA: '', amountB: '' })).toBe(false);
  });

  it('is true when both columns have an amount', () => {
    expect(hasAmbiguousDirection({ amountA: '€100.00', amountB: '€40.00' })).toBe(true);
  });
});

describe('both-column rows lose data on save (why hasAmbiguousDirection exists)', () => {
  // calculateBalance counts BOTH columns, but the list and the edit form only
  // ever surface one. These tests pin that mismatch so the warning in
  // Transfer/GiftList stays justified — if a future change makes the round trip
  // lossless, these fail and the warning can go.
  const both = makeTransfer({ amountA: '€100.00', amountB: '€40.00' });

  it('counts both amounts in the balance', () => {
    const { transferA, transferB } = calculateBalance([], [both], []);
    expect(transferA).toBe(100);
    expect(transferB).toBe(40);
  });

  it('shows only A’s amount in the list', () => {
    expect(transferAmount(both)).toBe('€100.00');
    expect(transferFrom(both)).toBe('A');
  });

  it('drops B’s amount when opened for editing', () => {
    expect(transferToFormData(both)).toEqual({
      date: '2026-01-20',
      from: 'A',
      amount: '100.00',
      notes: '',
    });
  });

  it('applies to gifts identically', () => {
    const bothGift = makeGift({ amountA: '€100.00', amountB: '€40.00' });
    expect(hasAmbiguousDirection(bothGift)).toBe(true);
    expect(giftAmount(bothGift)).toBe('€100.00');
    expect(giftToFormData(bothGift).amount).toBe('100.00');
  });
});

describe('transferFrom', () => {
  it('returns A when the first column has an amount', () => {
    expect(transferFrom(makeTransfer({ amountA: '€100.00', amountB: '' }))).toBe('A');
  });

  it('returns B when the second column has an amount', () => {
    expect(transferFrom(makeTransfer({ amountA: '', amountB: '€100.00' }))).toBe('B');
  });

  it('returns B when both are empty', () => {
    // edge case: no amount in either column, defaults to B
    expect(transferFrom(makeTransfer({ amountA: '', amountB: '' }))).toBe('B');
  });
});

describe('transferAmount', () => {
  it('returns A’s amount when present', () => {
    expect(transferAmount(makeTransfer({ amountA: '€100.00', amountB: '' }))).toBe('€100.00');
  });

  it('returns B’s amount when A’s is empty', () => {
    expect(transferAmount(makeTransfer({ amountA: '', amountB: '€200.00' }))).toBe('€200.00');
  });

  it('returns empty when both are empty', () => {
    expect(transferAmount(makeTransfer({ amountA: '', amountB: '' }))).toBe('');
  });
});

describe('transferToFormData', () => {
  it('converts an A transfer to form data', () => {
    const t = makeTransfer({ date: '2026-02-10', amountA: '€200.00', amountB: '' });
    expect(transferToFormData(t)).toEqual({
      date: '2026-02-10',
      from: 'A',
      amount: '200.00',
      notes: '',
    });
  });

  it('converts a B transfer to form data', () => {
    const t = makeTransfer({ date: '2026-02-10', amountA: '', amountB: '€75.50' });
    expect(transferToFormData(t)).toEqual({
      date: '2026-02-10',
      from: 'B',
      amount: '75.50',
      notes: '',
    });
  });

  it('round-trips through formatAmount → transferToFormData', () => {
    const original = { date: '2026-04-01', from: 'A' as const, amount: '500', notes: '' };
    const transfer: Transfer = {
      rowIndex: 2 as TransferRow,
      date: original.date,
      amountA: formatAmount(original.amount),
      amountB: '',
      notes: '',
    };
    const result = transferToFormData(transfer);
    expect(result.date).toBe('2026-04-01');
    expect(result.from).toBe('A');
    expect(result.amount).toBe('500.00');
  });

  it('handles large formatted amounts', () => {
    const t = makeTransfer({ amountA: '€1,234.56' });
    const result = transferToFormData(t);
    expect(result.amount).toBe('1234.56');
  });
});

// ── Expense helpers ──

describe('expenseToFormData', () => {
  it('converts expense with both amounts', () => {
    const e = makeExpense({
      date: '2026-01-15',
      amountA: '€100.00',
      amountB: '€50.00',
      item: 'Groceries',
      category: 'Food',
      notes: 'Weekly shop',
    });
    expect(expenseToFormData(e)).toEqual({
      date: '2026-01-15',
      amountA: '100.00',
      amountB: '50.00',
      notCountedA: '',
      notCountedB: '',
      item: 'Groceries',
      category: 'Food',
      notes: 'Weekly shop',
    });
  });

  it('converts expense with empty amounts', () => {
    const e = makeExpense({ amountA: '', amountB: '' });
    const result = expenseToFormData(e);
    expect(result.amountA).toBe('');
    expect(result.amountB).toBe('');
  });

  it('defaults empty category to Various', () => {
    const e = makeExpense({ category: '' as Expense['category'] });
    expect(expenseToFormData(e).category).toBe('Various');
  });

  it('preserves existing category', () => {
    const e = makeExpense({ category: 'Health' });
    expect(expenseToFormData(e).category).toBe('Health');
  });

  it('strips euro formatting from amounts', () => {
    const e = makeExpense({ amountA: '€1,234.56' });
    expect(expenseToFormData(e).amountA).toBe('1234.56');
  });

  it('preserves notes and item', () => {
    const e = makeExpense({ item: 'Test item', notes: 'Some notes' });
    const result = expenseToFormData(e);
    expect(result.item).toBe('Test item');
    expect(result.notes).toBe('Some notes');
  });
});

// ── Gift balance tests ──

describe('calculateBalance with gifts', () => {
  it('forgiving €100 with nothing else owed puts the forgiver €100 behind', () => {
    const gifts = [makeGift({ amountA: '€100.00' })];
    const result = calculateBalance([], [], gifts);
    expect(result.owedToA).toBe(-100);
    expect(result.owedToB).toBe(100);
  });

  it('mirrors when B is the one forgiving', () => {
    const gifts = [makeGift({ amountB: '€100.00' })];
    const result = calculateBalance([], [], gifts);
    expect(result.owedToA).toBe(100);
    expect(result.owedToB).toBe(-100);
  });

  it('forgiveness cancels a transfer of the same size', () => {
    const transfers = [makeTransfer({ amountA: '€100.00' })];
    const gifts = [makeGift({ amountA: '€100.00' })];
    const result = calculateBalance([], transfers, gifts);
    expect(result.owedToA).toBe(0);
    expect(result.owedToB).toBe(0);
  });

  it('expenses + transfers + gifts combined', () => {
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const transfers = [makeTransfer({ amountB: '€50.00' })];
    const gifts = [makeGift({ amountA: '€25.00' })];
    const result = calculateBalance(expenses, transfers, gifts);
    // Gap: 200 + 2*(0-50) - 2*(25-0) = 50. Owed: 25
    expect(result.owedToA).toBe(25);
    expect(result.owedToB).toBe(-25);
  });

  it('real-world scale: €6,086.38 gap, B transfers €300, A forgives €100', () => {
    const expenses = [makeExpense({ amountA: '€8,043.19', amountB: '€1,956.81' })];
    const transfers = [makeTransfer({ amountB: '€300.00' })];
    const gifts = [makeGift({ amountA: '€100.00' })];
    const result = calculateBalance(expenses, transfers, gifts);
    // Gap: 6086.38 - 600 - 200 = 5286.38. Owed: 2643.19 — the €300 paid and the
    // €100 forgiven each came off at face value.
    expect(result.owedToA).toBeCloseTo(2643.19, 2);
    expect(result.owedToB).toBeCloseTo(-2643.19, 2);
  });

  it('forgiving cuts what he is owed by exactly the amount forgiven', () => {
    const expenses = [makeExpense({ amountA: '€500.00', amountB: '€100.00' })];
    const before = calculateBalance(expenses, []);
    const after = calculateBalance(expenses, [], [makeGift({ amountA: '€50.00' })]);
    expect(before.owedToA).toBe(200);
    expect(after.owedToA).toBe(150);
  });

  it('default gifts parameter preserves backward compatibility', () => {
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const transfers = [makeTransfer({ amountB: '€50.00' })];
    const result = calculateBalance(expenses, transfers);
    expect(result.owedToA).toBe(50);
    expect(result.forgivenA).toBe(0);
    expect(result.forgivenB).toBe(0);
    expect(result.presentA).toBe(0);
    expect(result.presentB).toBe(0);
  });
});

// ── Gift kinds ──
//
// Every case above uses the makeGift default of 'forgiven', which is also how a
// row with a blank kind column reads. These cover what the kind actually changes.

describe('calculateBalance with gift kinds', () => {
  const present = (o: Partial<Gift> = {}) => makeGift({ giftKind: 'present', ...o });

  it('a present leaves the balance exactly where it was', () => {
    const expenses = [makeExpense({ amountA: '€500.00', amountB: '€100.00' })];
    const withoutGift = calculateBalance(expenses, []);
    const withGift = calculateBalance(expenses, [], [present({ amountA: '€50.00' })]);
    expect(withGift.owedToA).toBe(withoutGift.owedToA);
    expect(withGift.owedToB).toBe(withoutGift.owedToB);
  });

  it('a present alone moves nothing in either direction', () => {
    const fromA = calculateBalance([], [], [present({ amountA: '€100.00' })]);
    const fromB = calculateBalance([], [], [present({ amountB: '€100.00' })]);
    expect(fromA.owedToA).toBe(0);
    expect(fromB.owedToA).toBe(0);
  });

  it('a present does NOT cancel a transfer, unlike a forgiven row', () => {
    const transfers = [makeTransfer({ amountA: '€100.00' })];
    const asPresent = calculateBalance([], transfers, [present({ amountA: '€100.00' })]);
    const asForgiven = calculateBalance([], transfers, [makeGift({ amountA: '€100.00' })]);
    expect(asPresent.owedToA).toBe(100);
    expect(asForgiven.owedToA).toBe(0);
  });

  it('forgiving €X drops what the other owes by exactly €X', () => {
    // A is €400 ahead in spending, so €200 is owed. B paying €40 and
    // A forgiving €40 must land on the same figure, €40 lower — that
    // equivalence is the whole feature, and it is why forgiveness is face value.
    const expenses = [makeExpense({ amountA: '€500.00', amountB: '€100.00' })];
    const shePays = calculateBalance(expenses, [makeTransfer({ amountB: '€40.00' })]);
    const heForgives = calculateBalance(expenses, [], [makeGift({ amountA: '€40.00' })]);
    expect(heForgives.owedToA).toBe(shePays.owedToA);
    expect(heForgives.owedToA).toBe(160);
  });

  it('reports present and forgiven totals separately, per person', () => {
    const gifts = [
      present({ amountA: '€10.00' }),
      present({ amountB: '€20.00' }),
      makeGift({ amountA: '€30.00' }),
      makeGift({ amountB: '€40.00' }),
    ];
    const result = calculateBalance([], [], gifts);
    expect(result.presentA).toBe(10);
    expect(result.presentB).toBe(20);
    expect(result.forgivenA).toBe(30);
    expect(result.forgivenB).toBe(40);
    // Only the forgiven pair reaches the formula: -2 * (30 - 40) of gap = 10 owed
    expect(result.owedToA).toBe(10);
  });

  it('combines expenses, transfers and both gift kinds', () => {
    const expenses = [makeExpense({ amountA: '€300.00', amountB: '€100.00' })];
    const transfers = [makeTransfer({ amountB: '€50.00' })];
    const gifts = [present({ amountA: '€75.00' }), makeGift({ amountA: '€25.00' })];
    const result = calculateBalance(expenses, transfers, gifts);
    // Gap 200 + 2*(0-50) - 2*(25-0) = 50 → 25 owed; the €75 present is absent
    expect(result.owedToA).toBe(25);
  });

  it('treats a row with no kind at all as forgiven', () => {
    // Belt and braces for data that reaches calculateBalance without going
    // through toGiftKind — the fallback must never be the balance-neutral one.
    const legacy = { ...makeGift({ amountA: '€100.00' }) } as Gift;
    delete (legacy as Partial<Gift>).giftKind;
    expect(calculateBalance([], [], [legacy]).owedToA).toBe(-100);
  });
});

describe('toGiftKind', () => {
  it('reads a present', () => {
    expect(toGiftKind('present')).toBe('present');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(toGiftKind('  Present ')).toBe('present');
    expect(toGiftKind('FORGIVEN')).toBe('forgiven');
  });

  it('defaults a blank cell to forgiven — the behaviour legacy rows already had', () => {
    expect(toGiftKind('')).toBe('forgiven');
    expect(toGiftKind('   ')).toBe('forgiven');
  });

  it('defaults unrecognised text to forgiven rather than silently re-pricing a row', () => {
    expect(toGiftKind('gift')).toBe('forgiven');
    expect(toGiftKind('yes')).toBe('forgiven');
  });
});

// ── Gift helpers ──

describe('giftFrom', () => {
  it('returns A when the first column has an amount', () => {
    expect(giftFrom(makeGift({ amountA: '€100.00', amountB: '' }))).toBe('A');
  });

  it('returns B when the second column has an amount', () => {
    expect(giftFrom(makeGift({ amountA: '', amountB: '€100.00' }))).toBe('B');
  });

  it('returns B when both are empty', () => {
    expect(giftFrom(makeGift({ amountA: '', amountB: '' }))).toBe('B');
  });
});

describe('giftAmount', () => {
  it('returns A’s amount when present', () => {
    expect(giftAmount(makeGift({ amountA: '€100.00', amountB: '' }))).toBe('€100.00');
  });

  it('returns B’s amount when A’s is empty', () => {
    expect(giftAmount(makeGift({ amountA: '', amountB: '€200.00' }))).toBe('€200.00');
  });

  it('returns empty when both are empty', () => {
    expect(giftAmount(makeGift({ amountA: '', amountB: '' }))).toBe('');
  });
});

describe('giftToFormData', () => {
  it('converts an A gift to form data', () => {
    const g = makeGift({
      date: '2026-02-10',
      amountA: '€200.00',
      amountB: '',
      notes: 'Birthday',
    });
    expect(giftToFormData(g)).toEqual({
      date: '2026-02-10',
      from: 'A',
      amount: '200.00',
      notes: 'Birthday',
      giftKind: 'forgiven',
    });
  });

  it('converts a B gift to form data', () => {
    const g = makeGift({
      date: '2026-02-10',
      amountA: '',
      amountB: '€75.50',
      notes: '',
    });
    expect(giftToFormData(g)).toEqual({
      date: '2026-02-10',
      from: 'B',
      amount: '75.50',
      notes: '',
      giftKind: 'forgiven',
    });
  });

  it('carries the kind through, so editing a row cannot re-price it', () => {
    const g = makeGift({ amountA: '€200.00', giftKind: 'present' });
    expect(giftToFormData(g).giftKind).toBe('present');
  });

  it('round-trips through formatAmount → giftToFormData', () => {
    const original = { date: '2026-04-01', from: 'A' as const, amount: '500', notes: 'Test' };
    const gift: Gift = {
      rowIndex: 2 as GiftRow,
      date: original.date,
      amountA: formatAmount(original.amount),
      amountB: '',
      notes: original.notes,
      giftKind: 'present',
    };
    const result = giftToFormData(gift);
    expect(result.date).toBe('2026-04-01');
    expect(result.from).toBe('A');
    expect(result.amount).toBe('500.00');
    expect(result.notes).toBe('Test');
    expect(result.giftKind).toBe('present');
  });
});

// ── Transfer helpers with notes ──

describe('transferToFormData with notes', () => {
  it('includes notes in form data', () => {
    const t = makeTransfer({ date: '2026-02-10', amountA: '€200.00', notes: 'Settlement' });
    const result = transferToFormData(t);
    expect(result.notes).toBe('Settlement');
  });

  it('handles empty notes', () => {
    const t = makeTransfer({ date: '2026-02-10', amountA: '€200.00', notes: '' });
    const result = transferToFormData(t);
    expect(result.notes).toBe('');
  });
});

// ── Monthly bar data ──

describe('monthlyBars', () => {
  const byMonth = {
    '2024-01': { a: 100, b: 0 },
    '2025-01': { a: 300, b: 0 },
    '2025-07': { a: 50, b: 20 },
  };

  it('lists actual months in order when not averaging', () => {
    const bars = monthlyBars(byMonth, false);
    expect(bars.labels).toEqual(['2024-01', '2025-01', '2025-07']);
    expect(bars.a).toEqual([100, 300, 50]);
    expect(bars.b).toEqual([0, 0, 20]);
  });

  it('divides each month by the number of years it appears in, not by the range', () => {
    const bars = monthlyBars(byMonth, true);
    expect(bars.labels).toHaveLength(12);
    // January appears in two years: (100 + 300) / 2
    expect(bars.a[0]).toBe(200);
    // July appears in one: 50 / 1
    expect(bars.a[6]).toBe(50);
    expect(bars.b[6]).toBe(20);
  });

  it('reports zero for months with no data rather than dividing by zero', () => {
    const bars = monthlyBars(byMonth, true);
    expect(bars.a[1]).toBe(0);
    expect(Number.isNaN(bars.a[1])).toBe(false);
  });

  it('handles an empty range', () => {
    expect(monthlyBars({}, false).labels).toEqual([]);
    expect(monthlyBars({}, true).a).toEqual(Array(12).fill(0));
  });
});

// ── Sorting and filtering the expense list ──
//
// The list used to be shown in one fixed order — the sheet reversed — with a
// single text box. These helpers replace that. The risk is the change of
// default: for years the list has read one way, and it has to keep reading that
// way for a sheet filled in as the money was spent.

describe('expenseTotal', () => {
  it('adds both columns, because a shared bill cost what both of them put in', () => {
    expect(expenseTotal({ amountA: '€100.00', amountB: '€100.00' })).toBe(200);
  });

  it('reads an empty column as nothing rather than as missing data', () => {
    expect(expenseTotal({ amountA: '€1,234.56', amountB: '' })).toBe(1234.56);
  });
});

describe('sortExpenses', () => {
  const jan = makeExpense({ rowIndex: 3 as ExpenseRow, date: '2026-01-05', amountA: '€10.00' });
  const feb = makeExpense({ rowIndex: 4 as ExpenseRow, date: '2026-02-05', amountA: '€30.00' });
  const mar = makeExpense({ rowIndex: 5 as ExpenseRow, date: '2026-03-05', amountA: '€20.00' });
  const chronological = [jan, feb, mar];

  it('shows the newest first by default', () => {
    const sorted = sortExpenses(chronological, DEFAULT_EXPENSE_SORT);
    expect(sorted.map((e) => e.date)).toEqual(['2026-03-05', '2026-02-05', '2026-01-05']);
  });

  it('reproduces the old reversed-sheet order for a sheet filled in as money was spent', () => {
    // The regression that licenses changing the default: same list, same order.
    expect(sortExpenses(chronological, DEFAULT_EXPENSE_SORT)).toEqual([...chronological].reverse());
  });

  it('reverses to oldest first when asked', () => {
    const sorted = sortExpenses(chronological, { key: 'date', asc: true });
    expect(sorted.map((e) => e.date)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05']);
  });

  it('orders by what each row cost, both columns together', () => {
    const split = makeExpense({
      rowIndex: 6 as ExpenseRow,
      amountA: '€100.00',
      amountB: '€100.00',
    });
    const single = makeExpense({ rowIndex: 7 as ExpenseRow, amountA: '€150.00' });
    const sorted = sortExpenses([single, split], { key: 'amount', asc: false });
    expect(sorted.map((e) => e.rowIndex)).toEqual([6, 7]);
  });

  it('ranks a free row below a paid one rather than treating a blank as missing', () => {
    const free = makeExpense({ rowIndex: 8 as ExpenseRow, amountA: '', amountB: '' });
    const paid = makeExpense({ rowIndex: 9 as ExpenseRow, amountA: '€0.50' });
    expect(
      sortExpenses([free, paid], { key: 'amount', asc: false }).map((e) => e.rowIndex),
    ).toEqual([9, 8]);
  });

  it('orders by the sheet itself when asked for insertion order', () => {
    const backdated = makeExpense({ rowIndex: 9 as ExpenseRow, date: '2020-01-01' });
    const sorted = sortExpenses([jan, backdated], { key: 'inserted', asc: true });
    expect(sorted.map((e) => e.rowIndex)).toEqual([3, 9]);
  });

  it('breaks a same-day tie by the order the rows were entered', () => {
    const first = makeExpense({ rowIndex: 3 as ExpenseRow, date: '2026-01-05' });
    const second = makeExpense({ rowIndex: 4 as ExpenseRow, date: '2026-01-05' });
    expect(
      sortExpenses([second, first], { key: 'date', asc: true }).map((e) => e.rowIndex),
    ).toEqual([3, 4]);
  });

  it('flips the tie-break with the direction, so the list reads consistently', () => {
    const first = makeExpense({ rowIndex: 3 as ExpenseRow, date: '2026-01-05' });
    const second = makeExpense({ rowIndex: 4 as ExpenseRow, date: '2026-01-05' });
    expect(
      sortExpenses([first, second], { key: 'date', asc: false }).map((e) => e.rowIndex),
    ).toEqual([4, 3]);
  });

  it('sends a date the sheet could not parse to the end whichever way the list is sorted', () => {
    const broken = makeExpense({ rowIndex: 9 as ExpenseRow, date: 'March 2013' });
    const withBroken = [broken, ...chronological];
    expect(sortExpenses(withBroken, { key: 'date', asc: true }).at(-1)?.rowIndex).toBe(9);
    expect(sortExpenses(withBroken, { key: 'date', asc: false }).at(-1)?.rowIndex).toBe(9);
  });

  it('leaves the array it was given untouched', () => {
    const original = [...chronological];
    sortExpenses(chronological, { key: 'amount', asc: true });
    expect(chronological).toEqual(original);
  });
});

describe('filterExpenses', () => {
  const bread = makeExpense({ rowIndex: 3 as ExpenseRow, item: 'Bread', category: 'Food' });
  const petrol = makeExpense({ rowIndex: 4 as ExpenseRow, item: 'Petrol', category: 'Car' });
  const mystery = makeExpense({ rowIndex: 5 as ExpenseRow, item: 'Mystery', category: '' });
  const phone = makeExpense({
    rowIndex: 6 as ExpenseRow,
    item: 'Phone',
    category: 'Various',
    notCountedA: '',
    notCountedB: '',
    recurringMarker: 'rec:r1:2026-02',
  });
  const all = [bread, petrol, mystery, phone];
  const noFilter = { text: '', category: 'all' } as const;

  it('keeps everything when nothing is asked of it', () => {
    expect(filterExpenses(all, noFilter)).toHaveLength(4);
  });

  it('narrows to one category', () => {
    expect(filterExpenses(all, { text: '', category: 'Food' }).map((e) => e.item)).toEqual([
      'Bread',
    ]);
  });

  it('can reach the rows whose category the sheet left blank', () => {
    // toCategory blanks anything it does not recognise, and those rows are real
    // in a hand-edited sheet — a filter that cannot reach them hides them.
    expect(filterExpenses(all, { text: '', category: '' }).map((e) => e.item)).toEqual(['Mystery']);
  });

  it('still matches free text against item, category, notes and date', () => {
    const noted = makeExpense({ rowIndex: 7 as ExpenseRow, notes: 'sourdough' });
    expect(filterExpenses([...all, noted], { ...noFilter, text: 'sourdough' })).toHaveLength(1);
    expect(filterExpenses(all, { ...noFilter, text: 'car' }).map((e) => e.item)).toEqual([
      'Petrol',
    ]);
    expect(filterExpenses(all, { ...noFilter, text: '2026-01' })).toHaveLength(4);
  });

  it('ignores the case of what was typed', () => {
    expect(filterExpenses(all, { ...noFilter, text: 'BREAD' }).map((e) => e.item)).toEqual([
      'Bread',
    ]);
  });

  it('finds the generated rows when the search box says recurring', () => {
    expect(filterExpenses(all, { ...noFilter, text: 'recurring' }).map((e) => e.item)).toEqual([
      'Phone',
    ]);
  });

  it('does not call a hand-entered row recurring', () => {
    expect(filterExpenses([bread], { ...noFilter, text: 'recurring' })).toEqual([]);
  });

  it('matches a shortened form of the word', () => {
    expect(filterExpenses(all, { ...noFilter, text: 'rec' }).map((e) => e.item)).toEqual(['Phone']);
  });

  // The containment used to run the other way round, so any single letter of
  // "recurring" pulled in every generated row and swamped an ordinary search.
  // The fixture deliberately carries no "r" of its own, so the only thing that
  // could match it is the provenance branch.
  it('does not treat a stray letter as a search for recurring rows', () => {
    const gym = makeExpense({
      rowIndex: 7 as ExpenseRow,
      item: 'Gym',
      category: 'Health',
      notes: '',
      date: '2026-01-15',
      notCountedA: '',
      notCountedB: '',
      recurringMarker: 'rec:r1:2026-01',
    });
    expect(filterExpenses([gym], { ...noFilter, text: 'r' })).toEqual([]);
    expect(filterExpenses([gym], { ...noFilter, text: 'rec' })).toHaveLength(1);
  });

  it('ignores whitespace around a date the same way it does elsewhere', () => {
    expect(filterExpenses(all, { ...noFilter, text: '  2026-01  ' })).toHaveLength(4);
  });

  it('narrows rather than widens when a category and text are combined', () => {
    expect(filterExpenses(all, { text: 'Bread', category: 'Car' })).toEqual([]);
  });
});

describe('filtering to what was added recently', () => {
  const TODAY = '2026-03-20';
  const fresh = makeExpense({ rowIndex: 3 as ExpenseRow, item: 'Fresh', addedOn: TODAY });
  const older = makeExpense({ rowIndex: 4 as ExpenseRow, item: 'Older', addedOn: '2026-01-01' });
  const unknown = makeExpense({ rowIndex: 5 as ExpenseRow, item: 'Unknown', addedOn: '' });
  const all = [fresh, older, unknown];
  const base = { text: '', category: 'all' } as const;

  it('keeps everything when the box is unticked', () => {
    expect(filterExpenses(all, { ...base, recentOnly: false, todayIso: TODAY })).toHaveLength(3);
  });

  it('keeps only what was added in the last few days', () => {
    const kept = filterExpenses(all, { ...base, recentOnly: true, todayIso: TODAY });
    expect(kept.map((e) => e.item)).toEqual(['Fresh']);
  });

  it('drops the rows that predate the column rather than guessing they are recent', () => {
    const kept = filterExpenses([unknown], { ...base, recentOnly: true, todayIso: TODAY });
    expect(kept).toEqual([]);
  });

  // Answering "show me what is new" by emptying the list reads as "you have no
  // expenses". Better to ignore a filter that cannot be evaluated.
  it('ignores the filter when today is not a real date, rather than hiding everything', () => {
    const kept = filterExpenses(all, { ...base, recentOnly: true, todayIso: 'not-a-date' });
    expect(kept).toHaveLength(3);
  });

  it('ignores it when no date was supplied at all', () => {
    expect(filterExpenses(all, { ...base, recentOnly: true })).toHaveLength(3);
  });

  it('narrows further when combined with a category', () => {
    const freshCar = makeExpense({
      rowIndex: 6 as ExpenseRow,
      item: 'Tyres',
      category: 'Car',
      addedOn: TODAY,
    });
    const kept = filterExpenses([...all, freshCar], {
      text: '',
      category: 'Car',
      recentOnly: true,
      todayIso: TODAY,
    });
    expect(kept.map((e) => e.item)).toEqual(['Tyres']);
  });

  it('narrows further when combined with free text', () => {
    const kept = filterExpenses(all, {
      text: 'older',
      category: 'all',
      recentOnly: true,
      todayIso: TODAY,
    });
    expect(kept).toEqual([]);
  });
});

// ── Recently added ──
//
// The list is ordered by when the money was spent, so a purchase entered today
// but dated weeks ago lands in the middle of it. This is what marks it, and the
// boundaries matter: a day out either way either badges a stale row or hides
// the one the user just typed.

describe('daysBefore', () => {
  it('steps back within a month', () => {
    expect(daysBefore('2026-03-20', 2)).toBe('2026-03-18');
  });

  it('steps back across a month boundary', () => {
    expect(daysBefore('2026-03-01', 1)).toBe('2026-02-28');
  });

  it('steps back across a year boundary', () => {
    expect(daysBefore('2026-01-01', 1)).toBe('2025-12-31');
  });

  it('knows February is longer in a leap year', () => {
    expect(daysBefore('2028-03-01', 1)).toBe('2028-02-29');
  });

  it('returns the same day when asked for none', () => {
    expect(daysBefore('2026-03-20', 0)).toBe('2026-03-20');
  });
});

describe('isRecentlyAdded', () => {
  const on = (addedOn: string) => ({ addedOn });

  it('marks a row added today', () => {
    expect(isRecentlyAdded(on('2026-03-20'), '2026-03-20')).toBe(true);
  });

  it('still marks one added the day before yesterday', () => {
    // Three days including today: the 18th is the oldest that counts.
    expect(isRecentlyAdded(on('2026-03-18'), '2026-03-20')).toBe(true);
  });

  it('stops marking one added the day before that', () => {
    expect(isRecentlyAdded(on('2026-03-17'), '2026-03-20')).toBe(false);
  });

  it('honours a different window', () => {
    expect(isRecentlyAdded(on('2026-03-19'), '2026-03-20', 1)).toBe(false);
    expect(isRecentlyAdded(on('2026-03-20'), '2026-03-20', 1)).toBe(true);
  });

  it('reaches back across a month boundary', () => {
    expect(isRecentlyAdded(on('2026-02-28'), '2026-03-01')).toBe(true);
  });

  // Every row written before the column existed reads this way, as does
  // anything typed straight into Google Sheets. Unknown is not the same as
  // recent, and treating it as old is what stops years-old rows lighting up.
  it('does not mark a row with no added date', () => {
    expect(isRecentlyAdded(on(''), '2026-03-20')).toBe(false);
  });

  it('does not mark a row whose added date the sheet could not parse', () => {
    expect(isRecentlyAdded(on('March 2013'), '2026-03-20')).toBe(false);
  });

  // A date in the future means the device that wrote it has a wrong clock, and
  // that row is certainly new — better badged than silently missing.
  it('marks a row stamped in the future rather than hiding it', () => {
    expect(isRecentlyAdded(on('2026-03-25'), '2026-03-20')).toBe(true);
  });

  it('reports nothing when today is not a real date', () => {
    expect(isRecentlyAdded(on('2026-03-20'), 'not-a-date')).toBe(false);
  });
});

// ── Recurring rule to form ──
//
// The fourth of the record→form converters. It goes through parseAmount like the
// other three: a rule is the one record whose bad value would be re-applied
// every month rather than once.

describe('recurringToFormData', () => {
  const rule = {
    rowIndex: 2 as RecurringRow,
    id: 'r1',
    start: '2026-01-10',
    amountA: '€1,234.50',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Phone',
    category: 'Various' as const,
    notes: 'monthly',
    day: 10,
  };

  it('strips the display formatting off the amounts', () => {
    expect(recurringToFormData(rule)).toMatchObject({ amountA: '1234.50', amountB: '' });
  });

  it('drops a value the sheet holds that is not an amount, rather than passing junk through', () => {
    expect(recurringToFormData({ ...rule, amountA: 'n/a' }).amountA).toBe('');
  });

  it('gives an uncategorised rule the same default an expense gets', () => {
    expect(recurringToFormData({ ...rule, category: '' }).category).toBe('Various');
  });

  it('carries the rest across unchanged', () => {
    expect(recurringToFormData(rule)).toMatchObject({
      start: '2026-01-10',
      item: 'Phone',
      notes: 'monthly',
      day: 10,
    });
  });
});

// ── Not counted ──
//
// Part of an amount that was only for the person who paid it. The money was
// really spent, so it stays in the totals and the charts; it just never reaches
// the gap, because the other person did not have it. Getting this wrong makes
// one of them pay half of something they never received.

describe('spending that is not shared', () => {
  const noneShared = { transferA: 0, transferB: 0 };

  it('leaves every existing row exactly where it was', () => {
    // Every row on the sheet today has these columns blank. If this moves, the
    // feature has re-priced history.
    const expenses = [
      makeExpense({ amountA: '€1,000.00' }),
      makeExpense({ rowIndex: 4 as ExpenseRow, amountB: '€500.00' }),
    ];
    expect(calculateBalance(expenses, [], []).owedToA).toBe(250);
  });

  it('takes the personal part out of what the other owes', () => {
    // €100 spent, €10 of it only for A → €90 shared, so B owes €45 not €50.
    const expenses = [makeExpense({ amountA: '€100.00', notCountedA: '€10.00' })];
    expect(calculateBalance(expenses, [], []).owedToA).toBe(45);
  });

  it('still reports the whole amount as spent', () => {
    const expenses = [makeExpense({ amountA: '€100.00', notCountedA: '€10.00' })];
    const balance = calculateBalance(expenses, [], []);
    expect(balance.totalA).toBe(100);
    expect(balance.notCountedA).toBe(10);
  });

  it('squares up when one of them buys only for themselves', () => {
    // Nothing was shared, so nobody owes anybody.
    const expenses = [makeExpense({ amountA: '€80.00', notCountedA: '€80.00' })];
    expect(calculateBalance(expenses, [], []).owedToA).toBe(0);
  });

  it('nets the two sides against each other', () => {
    const expenses = [
      makeExpense({ amountA: '€100.00', notCountedA: '€20.00' }),
      makeExpense({ rowIndex: 4 as ExpenseRow, amountB: '€60.00', notCountedB: '€10.00' }),
    ];
    // Shared: 80 against 50 → a 30 gap → 15 owed.
    expect(calculateBalance(expenses, [], []).owedToA).toBe(15);
  });

  it('handles both people setting something aside on one row', () => {
    const expenses = [
      makeExpense({
        amountA: '€100.00',
        amountB: '€100.00',
        notCountedA: '€40.00',
        notCountedB: '€10.00',
      }),
    ];
    const balance = calculateBalance(expenses, [], []);
    expect(balance.notCountedA).toBe(40);
    expect(balance.notCountedB).toBe(10);
    // Shared 60 against 90 → B is owed 15.
    expect(balance.owedToA).toBe(-15);
  });

  it('still lets a transfer settle what is left', () => {
    const expenses = [makeExpense({ amountA: '€100.00', notCountedA: '€10.00' })];
    const transfers = [makeTransfer({ amountB: '€45.00' })];
    // B owed 45 and paid it.
    expect(calculateBalance(expenses, transfers, []).owedToA).toBe(0);
  });

  // A slice cannot be bigger than what it is a slice of. The forms refuse it,
  // but the sheet is hand-editable, and taken at face value it would push the
  // shared figure negative and pay the wrong person.
  it('refuses to let a hand-typed excess swing the balance the wrong way', () => {
    const expenses = [makeExpense({ amountA: '€100.00', notCountedA: '€500.00' })];
    const balance = calculateBalance(expenses, [], []);
    expect(balance.notCountedA).toBe(100);
    expect(balance.owedToA).toBe(0);
  });

  it('ignores an amount set aside against a column nobody paid into', () => {
    const expenses = [makeExpense({ amountA: '€100.00', notCountedB: '€30.00' })];
    expect(calculateBalance(expenses, [], []).owedToA).toBe(50);
  });

  it('reads a blank column as nothing set aside, not as missing data', () => {
    const expenses = [makeExpense({ amountA: '€100.00', notCountedA: '' })];
    expect(calculateBalance(expenses, [], []).notCountedA).toBe(0);
    expect(noneShared.transferA).toBe(0);
  });
});

describe('notCountedProblem', () => {
  const NAMES = { a: 'Ada', b: 'Bo' };
  const base = { amountA: '100', amountB: '100', notCountedA: '', notCountedB: '' };

  it('accepts nothing set aside', () => {
    expect(notCountedProblem(base, NAMES)).toBeNull();
  });

  it('accepts a slice smaller than the amount', () => {
    expect(notCountedProblem({ ...base, notCountedA: '10' }, NAMES)).toBeNull();
  });

  it('accepts the whole amount, since a purchase can be entirely personal', () => {
    expect(notCountedProblem({ ...base, notCountedA: '100' }, NAMES)).toBeNull();
  });

  it('names the person whose figure does not add up', () => {
    expect(notCountedProblem({ ...base, notCountedA: '150' }, NAMES)).toBe(
      'Not counted cannot be more than what Ada paid',
    );
    expect(notCountedProblem({ ...base, notCountedB: '150' }, NAMES)).toBe(
      'Not counted cannot be more than what Bo paid',
    );
  });

  it('refuses anything set aside against a column nobody paid into', () => {
    expect(notCountedProblem({ ...base, amountA: '', notCountedA: '10' }, NAMES)).not.toBeNull();
  });
});

// ── Both ends of the clamp ──
//
// The shared figure subtracts what was set aside, so the guard has to hold at
// both ends. Too much pushes sharing negative; too little — a negative — adds to
// it, and the dashboard row is hidden below zero, so the balance would move with
// nothing on screen to explain why.

describe('a not-counted figure the sheet should not hold', () => {
  it('ignores a negative rather than letting it inflate what the other owes', () => {
    const expenses = [makeExpense({ amountA: '€100.00', notCountedA: '€-50.00' })];
    const balance = calculateBalance(expenses, [], []);
    expect(balance.notCountedA).toBe(0);
    // Unchanged from the same row with the column blank.
    expect(balance.owedToA).toBe(50);
  });

  it('ignores an excess rather than letting it pay the wrong person', () => {
    const expenses = [makeExpense({ amountA: '€100.00', notCountedA: '€500.00' })];
    expect(calculateBalance(expenses, [], []).owedToA).toBe(0);
  });

  it('refuses a negative in the form, so the two guards agree', () => {
    const NAMES = { a: 'Ada', b: 'Bo' };
    const base = { amountA: '100', amountB: '100', notCountedA: '', notCountedB: '' };
    expect(notCountedProblem({ ...base, notCountedA: '-50' }, NAMES)).toBe(
      'Not counted cannot be negative',
    );
    expect(notCountedProblem({ ...base, notCountedB: '-1' }, NAMES)).toBe(
      'Not counted cannot be negative',
    );
  });
});
