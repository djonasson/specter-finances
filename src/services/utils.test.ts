import { describe, it, expect } from 'vitest';
import type { Expense } from '../types/expense';
import type { Transfer } from '../types/transfer';
import {
  toDate,
  fromDate,
  toNum,
  fromNum,
  toNumber,
  fmt,
  getAvailableYears,
  filterByDate,
  aggregateExpenses,
  calculateBalance,
  transferFrom,
  transferAmount,
  transferToFormData,
  expenseToFormData,
} from './utils';
import { formatAmount } from './parsing';

// ── Factories ──

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    rowIndex: 3,
    date: '2026-01-15',
    amountDaniel: '',
    amountManuela: '',
    item: 'Test',
    category: 'Food',
    notes: '',
    ...overrides,
  };
}

function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    rowIndex: 2,
    date: '2026-01-20',
    amountDaniel: '',
    amountManuela: '',
    ...overrides,
  };
}

// ── Date helpers ──

describe('toDate', () => {
  it('converts YYYY-MM-DD to Date at local midnight', () => {
    const d = toDate('2026-03-15');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2); // March = 2
    expect(d!.getDate()).toBe(15);
    expect(d!.getHours()).toBe(0);
  });

  it('returns null for empty string', () => {
    expect(toDate('')).toBeNull();
  });

  it('returns null for undefined-like input', () => {
    expect(toDate('')).toBeNull();
  });

  it('handles first day of year', () => {
    const d = toDate('2026-01-01');
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(1);
  });

  it('handles last day of year', () => {
    const d = toDate('2025-12-31');
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(31);
  });

  it('handles leap day', () => {
    const d = toDate('2024-02-29');
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(1);
    expect(d!.getDate()).toBe(29);
  });
});

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

  it('round-trips with toDate', () => {
    const original = '2026-06-15';
    expect(fromDate(toDate(original))).toBe(original);
  });

  it('handles future dates', () => {
    expect(fromDate(new Date(2030, 5, 15))).toBe('2030-06-15');
  });
});

// ── DateInput onChange simulation ──
// Mantine v8 DateInput onChange returns DateStringValue (string), not Date.
// These tests verify the pattern used in form components.

describe('DateInput onChange handling', () => {
  // Simulates the pattern: typeof d === 'string' ? d : fromDate(d)
  function handleDateChange(d: string | Date | null): string {
    if (d === null) return '';
    return typeof d === 'string' ? d : fromDate(d);
  }

  it('handles string value from Mantine v8 DateInput', () => {
    expect(handleDateChange('2026-04-10')).toBe('2026-04-10');
  });

  it('handles future date string', () => {
    expect(handleDateChange('2030-12-25')).toBe('2030-12-25');
  });

  it('handles past date string', () => {
    expect(handleDateChange('2020-01-01')).toBe('2020-01-01');
  });

  it('handles Date object fallback', () => {
    expect(handleDateChange(new Date(2026, 3, 10))).toBe('2026-04-10');
  });

  it('handles null (cleared input)', () => {
    expect(handleDateChange(null)).toBe('');
  });

  it('preserves date through form state round-trip', () => {
    // Simulate: user picks date -> onChange -> form.date -> value prop -> next onChange
    const picked = '2026-12-25';
    const formDate = handleDateChange(picked);
    expect(formDate).toBe('2026-12-25');
    // The form.date is then passed as value={form.date || null} to DateInput
    // On next change, DateInput returns another string
    const repicked = '2027-01-15';
    const formDate2 = handleDateChange(repicked);
    expect(formDate2).toBe('2027-01-15');
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
    const expenses = [
      makeExpense({ date: '2026-01-01' }),
      makeExpense({ date: '2026-12-31' }),
    ];
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
    expect(result).toEqual([
      { date: '2025-12-31' },
      { date: '2026-03-15' },
    ]);
  });

  it('filters by custom range (to only)', () => {
    const result = filterByDate(items, {
      mode: 'custom',
      customTo: '2024-12-31',
    });
    expect(result).toEqual([
      { date: '2024-06-01' },
    ]);
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
    const transfers = [
      makeTransfer({ date: '2025-06-01' }),
      makeTransfer({ date: '2026-01-15' }),
    ];
    const result = filterByDate(transfers, { mode: 'year', selectedYear: '2025' });
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2025-06-01');
  });
});

// ── Expense aggregation ──

describe('aggregateExpenses', () => {
  it('returns zeros for empty array', () => {
    const result = aggregateExpenses([]);
    expect(result.totalDaniel).toBe(0);
    expect(result.totalManuela).toBe(0);
    expect(Object.keys(result.byCategory)).toHaveLength(0);
    expect(Object.keys(result.byMonth)).toHaveLength(0);
  });

  it('sums totals correctly', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€100.00', amountManuela: '€50.00' }),
      makeExpense({ amountDaniel: '€200.00', amountManuela: '€75.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.totalDaniel).toBe(300);
    expect(result.totalManuela).toBe(125);
  });

  it('handles empty amounts as zero', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€100.00', amountManuela: '' }),
      makeExpense({ amountDaniel: '', amountManuela: '€200.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.totalDaniel).toBe(100);
    expect(result.totalManuela).toBe(200);
  });

  it('groups by category correctly', () => {
    const expenses = [
      makeExpense({ category: 'Food', amountDaniel: '€100.00', amountManuela: '€50.00' }),
      makeExpense({ category: 'Car', amountDaniel: '€200.00', amountManuela: '' }),
      makeExpense({ category: 'Food', amountDaniel: '€30.00', amountManuela: '€20.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.byCategory['Food']).toEqual({ daniel: 130, manuela: 70 });
    expect(result.byCategory['Car']).toEqual({ daniel: 200, manuela: 0 });
  });

  it('uses "Other" for empty category', () => {
    const expenses = [
      makeExpense({ category: '' as Expense['category'], amountDaniel: '€50.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.byCategory['Other']).toEqual({ daniel: 50, manuela: 0 });
  });

  it('groups by month correctly', () => {
    const expenses = [
      makeExpense({ date: '2026-01-10', amountDaniel: '€100.00' }),
      makeExpense({ date: '2026-01-20', amountDaniel: '€50.00' }),
      makeExpense({ date: '2026-02-05', amountManuela: '€75.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.byMonth['2026-01']).toEqual({ daniel: 150, manuela: 0 });
    expect(result.byMonth['2026-02']).toEqual({ daniel: 0, manuela: 75 });
  });

  it('handles expenses across multiple years', () => {
    const expenses = [
      makeExpense({ date: '2024-12-31', amountDaniel: '€100.00' }),
      makeExpense({ date: '2025-01-01', amountDaniel: '€200.00' }),
    ];
    const result = aggregateExpenses(expenses);
    expect(result.byMonth['2024-12']).toEqual({ daniel: 100, manuela: 0 });
    expect(result.byMonth['2025-01']).toEqual({ daniel: 200, manuela: 0 });
  });

  it('handles all six categories', () => {
    const categories = ['Car', 'Food', 'Health', 'Holidays', 'Home', 'Various'] as const;
    const expenses = categories.map((cat, i) =>
      makeExpense({ category: cat, amountDaniel: `€${(i + 1) * 10}.00` })
    );
    const result = aggregateExpenses(expenses);
    expect(Object.keys(result.byCategory).sort()).toEqual([...categories].sort());
    expect(result.byCategory['Car'].daniel).toBe(10);
    expect(result.byCategory['Various'].daniel).toBe(60);
  });
});

// ── Balance calculation ──

describe('calculateBalance', () => {
  it('returns zeros with no data', () => {
    const result = calculateBalance([], []);
    expect(result.adjustedDeltaDaniel).toBe(0);
    expect(result.adjustedDeltaManuela).toBe(0);
    expect(result.netTransfer).toBe(0);
  });

  it('calculates spending-only delta', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€300.00', amountManuela: '€100.00' }),
    ];
    const result = calculateBalance(expenses, []);
    expect(result.totalDaniel).toBe(300);
    expect(result.totalManuela).toBe(100);
    expect(result.adjustedDeltaDaniel).toBe(200);
    expect(result.adjustedDeltaManuela).toBe(-200);
  });

  // The transfer column means "this person SENT money to the other".
  // Sending money increases the sender's effective contribution.
  // Formula: adjustedDelta = (spentD - spentM) + (transferD - transferM)

  // Expenses are shared 50/50, so the raw spending delta is 2× the per-person owed amount.
  // Transfers are direct payments at face value → doubled in the display scale.

  it('transfer from person who spent less (settling up) reduces delta by 2x', () => {
    // Daniel spent €200 more. Manuela settles up by transferring €50 to Daniel.
    const expenses = [makeExpense({ amountDaniel: '€300.00', amountManuela: '€100.00' })];
    const transfers = [makeTransfer({ amountManuela: '€50.00' })];
    const result = calculateBalance(expenses, transfers);
    // 200 + 2*(0-50) = 100
    expect(result.adjustedDeltaDaniel).toBe(100);
    expect(result.adjustedDeltaManuela).toBe(-100);
  });

  it('transfer from person who spent more increases delta by 2x', () => {
    // Daniel spent €200 more AND gives Manuela €80 cash.
    const expenses = [makeExpense({ amountDaniel: '€300.00', amountManuela: '€100.00' })];
    const transfers = [makeTransfer({ amountDaniel: '€80.00' })];
    const result = calculateBalance(expenses, transfers);
    // 200 + 2*(80-0) = 360
    expect(result.adjustedDeltaDaniel).toBe(360);
    expect(result.adjustedDeltaManuela).toBe(-360);
  });

  it('exact settlement zeroes the delta', () => {
    // spentD=300, spentM=100. Delta=200. Settlement=100. Manuela transfers €100.
    // 200 + 2*(0-100) = 0
    const expenses = [makeExpense({ amountDaniel: '€300.00', amountManuela: '€100.00' })];
    const transfers = [makeTransfer({ amountManuela: '€100.00' })];
    const result = calculateBalance(expenses, transfers);
    expect(result.adjustedDeltaDaniel).toBe(0);
    expect(result.adjustedDeltaManuela).toBe(0);
  });

  it('transfer can overshoot, flipping the delta', () => {
    // Spending delta €200, settlement €100. Manuela transfers €150 (overpays by €50).
    const expenses = [makeExpense({ amountDaniel: '€300.00', amountManuela: '€100.00' })];
    const transfers = [makeTransfer({ amountManuela: '€150.00' })];
    const result = calculateBalance(expenses, transfers);
    // 200 + 2*(0-150) = -100
    expect(result.adjustedDeltaDaniel).toBe(-100);
    expect(result.adjustedDeltaManuela).toBe(100);
  });

  it('multiple expenses and multiple transfers', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€100.00', amountManuela: '' }),
      makeExpense({ amountDaniel: '', amountManuela: '€50.00' }),
      makeExpense({ amountDaniel: '€200.00', amountManuela: '€75.00' }),
    ];
    const transfers = [
      makeTransfer({ amountDaniel: '€30.00' }),   // Daniel sends €30
      makeTransfer({ amountManuela: '€20.00' }),   // Manuela sends €20
    ];
    const result = calculateBalance(expenses, transfers);
    expect(result.totalDaniel).toBe(300);
    expect(result.totalManuela).toBe(125);
    // Spending delta: 175. Transfer: 2*(30-20) = +20. Adjusted: 195
    expect(result.adjustedDeltaDaniel).toBe(195);
    expect(result.adjustedDeltaManuela).toBe(-195);
    expect(result.netTransfer).toBe(10);
  });

  it('Manuela spending more than Daniel', () => {
    const expenses = [makeExpense({ amountDaniel: '€50.00', amountManuela: '€300.00' })];
    const result = calculateBalance(expenses, []);
    expect(result.adjustedDeltaDaniel).toBe(-250);
    expect(result.adjustedDeltaManuela).toBe(250);
  });

  it('Manuela spending more, Daniel settles up with transfer', () => {
    // Manuela spent €250 more. Daniel transfers €100 to settle up.
    const expenses = [makeExpense({ amountDaniel: '€50.00', amountManuela: '€300.00' })];
    const transfers = [makeTransfer({ amountDaniel: '€100.00' })];
    const result = calculateBalance(expenses, transfers);
    // -250 + 2*(100-0) = -50
    expect(result.adjustedDeltaDaniel).toBe(-50);
    expect(result.adjustedDeltaManuela).toBe(50);
  });

  it('only transfers, no expenses — sender is ahead by 2x', () => {
    const transfers = [makeTransfer({ amountDaniel: '€100.00' })];
    const result = calculateBalance([], transfers);
    // 0 + 2*(100-0) = 200
    expect(result.adjustedDeltaDaniel).toBe(200);
    expect(result.adjustedDeltaManuela).toBe(-200);
    expect(result.netTransfer).toBe(100);
  });

  it('handles empty amount strings', () => {
    const expenses = [makeExpense({ amountDaniel: '€100.00', amountManuela: '' })];
    const transfers = [makeTransfer({ amountDaniel: '', amountManuela: '' })];
    const result = calculateBalance(expenses, transfers);
    expect(result.adjustedDeltaDaniel).toBe(100);
    expect(result.adjustedDeltaManuela).toBe(-100);
  });

  it('netTransfer positive when Daniel transfers more', () => {
    const transfers = [
      makeTransfer({ amountDaniel: '€200.00' }),
      makeTransfer({ amountManuela: '€50.00' }),
    ];
    const result = calculateBalance([], transfers);
    expect(result.netTransfer).toBe(150);
  });

  it('netTransfer negative when Manuela transfers more', () => {
    const transfers = [
      makeTransfer({ amountDaniel: '€50.00' }),
      makeTransfer({ amountManuela: '€200.00' }),
    ];
    const result = calculateBalance([], transfers);
    expect(result.netTransfer).toBe(-150);
  });

  it('equal spending with equal transfers nets to zero', () => {
    const expenses = [makeExpense({ amountDaniel: '€100.00', amountManuela: '€100.00' })];
    const transfers = [
      makeTransfer({ amountDaniel: '€50.00' }),
      makeTransfer({ amountManuela: '€50.00' }),
    ];
    const result = calculateBalance(expenses, transfers);
    expect(result.adjustedDeltaDaniel).toBe(0);
    expect(result.adjustedDeltaManuela).toBe(0);
    expect(result.netTransfer).toBe(0);
  });

  it('user scenario: €6,086.38 delta, Manuela transfers €300', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€8,043.19', amountManuela: '€1,956.81' }),
    ];
    const transfers = [makeTransfer({ amountManuela: '€300.00' })];
    const result = calculateBalance(expenses, transfers);
    // 6086.38 + 2*(0-300) = 5486.38
    expect(result.adjustedDeltaDaniel).toBeCloseTo(5486.38, 2);
    expect(result.adjustedDeltaManuela).toBeCloseTo(-5486.38, 2);
  });

  it('with no transfers, delta equals raw spending difference', () => {
    // This verifies the refactoring didn't change behavior vs the old inline code
    const expenses = [
      makeExpense({ amountDaniel: '€8,043.19', amountManuela: '€1,956.81' }),
    ];
    const result = calculateBalance(expenses, []);
    // Old code: totalDaniel - totalManuela = 8043.19 - 1956.81 = 6086.38
    expect(result.adjustedDeltaDaniel).toBeCloseTo(6086.38, 2);
    expect(result.adjustedDeltaManuela).toBeCloseTo(-6086.38, 2);
    expect(result.netTransfer).toBe(0);
    expect(result.transferDaniel).toBe(0);
    expect(result.transferManuela).toBe(0);
  });

  it('large number of small expenses accumulate correctly', () => {
    const expenses = Array.from({ length: 100 }, () =>
      makeExpense({ amountDaniel: '€10.00', amountManuela: '€5.00' })
    );
    const result = calculateBalance(expenses, []);
    expect(result.totalDaniel).toBe(1000);
    expect(result.totalManuela).toBe(500);
    expect(result.adjustedDeltaDaniel).toBe(500);
  });
});

// ── Transfer helpers ──

describe('transferFrom', () => {
  it('returns Daniel when Daniel column has amount', () => {
    expect(transferFrom(makeTransfer({ amountDaniel: '€100.00', amountManuela: '' }))).toBe('Daniel');
  });

  it('returns Manuela when Manuela column has amount', () => {
    expect(transferFrom(makeTransfer({ amountDaniel: '', amountManuela: '€100.00' }))).toBe('Manuela');
  });

  it('returns Manuela when both are empty', () => {
    // edge case: no amount in either column, defaults to Manuela
    expect(transferFrom(makeTransfer({ amountDaniel: '', amountManuela: '' }))).toBe('Manuela');
  });
});

describe('transferAmount', () => {
  it('returns Daniel amount when present', () => {
    expect(transferAmount(makeTransfer({ amountDaniel: '€100.00', amountManuela: '' }))).toBe('€100.00');
  });

  it('returns Manuela amount when Daniel is empty', () => {
    expect(transferAmount(makeTransfer({ amountDaniel: '', amountManuela: '€200.00' }))).toBe('€200.00');
  });

  it('returns empty when both are empty', () => {
    expect(transferAmount(makeTransfer({ amountDaniel: '', amountManuela: '' }))).toBe('');
  });
});

describe('transferToFormData', () => {
  it('converts Daniel transfer to form data', () => {
    const t = makeTransfer({ date: '2026-02-10', amountDaniel: '€200.00', amountManuela: '' });
    expect(transferToFormData(t)).toEqual({ date: '2026-02-10', from: 'Daniel', amount: '200.00' });
  });

  it('converts Manuela transfer to form data', () => {
    const t = makeTransfer({ date: '2026-02-10', amountDaniel: '', amountManuela: '€75.50' });
    expect(transferToFormData(t)).toEqual({ date: '2026-02-10', from: 'Manuela', amount: '75.50' });
  });

  it('round-trips through formatAmount → transferToFormData', () => {
    const original = { date: '2026-04-01', from: 'Daniel' as const, amount: '500' };
    const transfer: Transfer = {
      rowIndex: 2,
      date: original.date,
      amountDaniel: formatAmount(original.amount),
      amountManuela: '',
    };
    const result = transferToFormData(transfer);
    expect(result.date).toBe('2026-04-01');
    expect(result.from).toBe('Daniel');
    expect(result.amount).toBe('500.00');
  });

  it('handles large formatted amounts', () => {
    const t = makeTransfer({ amountDaniel: '€1,234.56' });
    const result = transferToFormData(t);
    expect(result.amount).toBe('1234.56');
  });
});

// ── Expense helpers ──

describe('expenseToFormData', () => {
  it('converts expense with both amounts', () => {
    const e = makeExpense({
      date: '2026-01-15',
      amountDaniel: '€100.00',
      amountManuela: '€50.00',
      item: 'Groceries',
      category: 'Food',
      notes: 'Weekly shop',
    });
    expect(expenseToFormData(e)).toEqual({
      date: '2026-01-15',
      amountDaniel: '100.00',
      amountManuela: '50.00',
      item: 'Groceries',
      category: 'Food',
      notes: 'Weekly shop',
    });
  });

  it('converts expense with empty amounts', () => {
    const e = makeExpense({ amountDaniel: '', amountManuela: '' });
    const result = expenseToFormData(e);
    expect(result.amountDaniel).toBe('');
    expect(result.amountManuela).toBe('');
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
    const e = makeExpense({ amountDaniel: '€1,234.56' });
    expect(expenseToFormData(e).amountDaniel).toBe('1234.56');
  });

  it('preserves notes and item', () => {
    const e = makeExpense({ item: 'Test item', notes: 'Some notes' });
    const result = expenseToFormData(e);
    expect(result.item).toBe('Test item');
    expect(result.notes).toBe('Some notes');
  });
});
