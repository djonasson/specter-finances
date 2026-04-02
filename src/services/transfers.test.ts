import { describe, it, expect } from 'vitest';
import type { Expense } from '../types/expense';
import type { Transfer, TransferFormData, Person } from '../types/transfer';
import { formatAmount, parseAmount } from './parsing';

// ── Helper: replicate transferRow logic from sheets.ts ──

function transferRow(form: TransferFormData): string[] {
  const danielAmt = form.from === 'Daniel' ? formatAmount(form.amount) : '';
  const manuelaAmt = form.from === 'Manuela' ? formatAmount(form.amount) : '';
  return [form.date, danielAmt, manuelaAmt];
}

// ── Helper: replicate balance calculation from Dashboard ──

function toNumber(formatted: string): number {
  const raw = parseAmount(formatted);
  return raw ? parseFloat(raw) : 0;
}

function calculateBalance(expenses: Expense[], transfers: Transfer[]) {
  let totalDaniel = 0;
  let totalManuela = 0;
  for (const e of expenses) {
    totalDaniel += toNumber(e.amountDaniel);
    totalManuela += toNumber(e.amountManuela);
  }

  let transferDaniel = 0;
  let transferManuela = 0;
  for (const t of transfers) {
    transferDaniel += toNumber(t.amountDaniel);
    transferManuela += toNumber(t.amountManuela);
  }

  const adjustedDeltaDaniel = (totalDaniel - totalManuela) - (transferDaniel - transferManuela);
  const adjustedDeltaManuela = -adjustedDeltaDaniel || 0;
  const netTransfer = transferDaniel - transferManuela;

  return {
    totalDaniel,
    totalManuela,
    transferDaniel,
    transferManuela,
    adjustedDeltaDaniel,
    adjustedDeltaManuela,
    netTransfer,
  };
}

// ── Helper factories ──

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

// ── Tests ──

describe('transferRow', () => {
  it('puts amount in Daniel column when Daniel transfers', () => {
    const row = transferRow({ date: '2026-03-01', from: 'Daniel', amount: '100' });
    expect(row).toEqual(['2026-03-01', '€100.00', '']);
  });

  it('puts amount in Manuela column when Manuela transfers', () => {
    const row = transferRow({ date: '2026-03-01', from: 'Manuela', amount: '250.50' });
    expect(row).toEqual(['2026-03-01', '', '€250.50']);
  });

  it('formats large amounts with comma separators', () => {
    const row = transferRow({ date: '2026-03-01', from: 'Daniel', amount: '1234.56' });
    expect(row).toEqual(['2026-03-01', '€1,234.56', '']);
  });

  it('handles empty amount gracefully', () => {
    const row = transferRow({ date: '2026-03-01', from: 'Daniel', amount: '' });
    expect(row).toEqual(['2026-03-01', '', '']);
  });
});

describe('toFormData reverse mapping', () => {
  function toFormData(t: Transfer): TransferFormData {
    const from: Person = t.amountDaniel ? 'Daniel' : 'Manuela';
    return {
      date: t.date,
      from,
      amount: parseAmount(from === 'Daniel' ? t.amountDaniel : t.amountManuela),
    };
  }

  it('reconstructs form data for Daniel transfer', () => {
    const t = makeTransfer({ date: '2026-02-10', amountDaniel: '€200.00', amountManuela: '' });
    expect(toFormData(t)).toEqual({ date: '2026-02-10', from: 'Daniel', amount: '200.00' });
  });

  it('reconstructs form data for Manuela transfer', () => {
    const t = makeTransfer({ date: '2026-02-10', amountDaniel: '', amountManuela: '€75.50' });
    expect(toFormData(t)).toEqual({ date: '2026-02-10', from: 'Manuela', amount: '75.50' });
  });

  it('round-trips through transferRow and back', () => {
    const original: TransferFormData = { date: '2026-04-01', from: 'Daniel', amount: '500' };
    const row = transferRow(original);
    const transfer: Transfer = {
      rowIndex: 2,
      date: row[0],
      amountDaniel: row[1],
      amountManuela: row[2],
    };
    const result = toFormData(transfer);
    expect(result.date).toBe('2026-04-01');
    expect(result.from).toBe('Daniel');
    expect(result.amount).toBe('500.00');
  });
});

describe('balance calculation', () => {
  it('returns zero delta with no expenses and no transfers', () => {
    const result = calculateBalance([], []);
    expect(result.adjustedDeltaDaniel).toBe(0);
    expect(result.adjustedDeltaManuela).toBe(0);
    expect(result.netTransfer).toBe(0);
  });

  it('calculates correct spending delta with no transfers', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€300.00', amountManuela: '€100.00' }),
    ];
    const result = calculateBalance(expenses, []);
    expect(result.totalDaniel).toBe(300);
    expect(result.totalManuela).toBe(100);
    expect(result.adjustedDeltaDaniel).toBe(200);
    expect(result.adjustedDeltaManuela).toBe(-200);
    expect(result.netTransfer).toBe(0);
  });

  it('transfer from Daniel reduces his surplus', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€300.00', amountManuela: '€100.00' }),
    ];
    const transfers = [
      makeTransfer({ amountDaniel: '€50.00' }),
    ];
    const result = calculateBalance(expenses, transfers);
    // Spending delta: 300-100 = 200. Transfer delta: 50-0 = 50.
    // Adjusted: 200-50 = 150
    expect(result.adjustedDeltaDaniel).toBe(150);
    expect(result.adjustedDeltaManuela).toBe(-150);
    expect(result.netTransfer).toBe(50);
  });

  it('transfer from Manuela reduces her deficit', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€300.00', amountManuela: '€100.00' }),
    ];
    const transfers = [
      makeTransfer({ amountManuela: '€80.00' }),
    ];
    const result = calculateBalance(expenses, transfers);
    // Spending delta: 200. Transfer delta: 0-80 = -80.
    // Adjusted: 200 - (-80) = 280
    expect(result.adjustedDeltaDaniel).toBe(280);
    expect(result.adjustedDeltaManuela).toBe(-280);
  });

  it('transfer fully balances spending', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€200.00', amountManuela: '€100.00' }),
    ];
    const transfers = [
      // Daniel transfers 100 to cover his excess spending
      makeTransfer({ amountDaniel: '€100.00' }),
    ];
    const result = calculateBalance(expenses, transfers);
    expect(result.adjustedDeltaDaniel).toBe(0);
    expect(result.adjustedDeltaManuela).toBe(0);
  });

  it('transfer can overshoot, making delta negative', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€200.00', amountManuela: '€100.00' }),
    ];
    const transfers = [
      // Daniel transfers 150, more than the 100 difference
      makeTransfer({ amountDaniel: '€150.00' }),
    ];
    const result = calculateBalance(expenses, transfers);
    // Spending delta: 100. Transfer delta: 150.
    // Adjusted: 100 - 150 = -50 (Daniel now "owed" by Manuela)
    expect(result.adjustedDeltaDaniel).toBe(-50);
    expect(result.adjustedDeltaManuela).toBe(50);
  });

  it('handles multiple expenses and multiple transfers', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€100.00', amountManuela: '' }),
      makeExpense({ amountDaniel: '', amountManuela: '€50.00' }),
      makeExpense({ amountDaniel: '€200.00', amountManuela: '€75.00' }),
    ];
    const transfers = [
      makeTransfer({ amountDaniel: '€30.00' }),
      makeTransfer({ amountManuela: '€20.00' }),
    ];
    const result = calculateBalance(expenses, transfers);
    // Total Daniel spent: 100+200 = 300
    // Total Manuela spent: 50+75 = 125
    expect(result.totalDaniel).toBe(300);
    expect(result.totalManuela).toBe(125);
    // Spending delta: 300-125 = 175
    // Transfer delta: 30-20 = 10
    // Adjusted: 175-10 = 165
    expect(result.adjustedDeltaDaniel).toBe(165);
    expect(result.adjustedDeltaManuela).toBe(-165);
    expect(result.netTransfer).toBe(10);
  });

  it('handles Manuela spending more than Daniel', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€50.00', amountManuela: '€300.00' }),
    ];
    const result = calculateBalance(expenses, []);
    expect(result.adjustedDeltaDaniel).toBe(-250);
    expect(result.adjustedDeltaManuela).toBe(250);
  });

  it('handles Manuela spending more with a Manuela transfer', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€50.00', amountManuela: '€300.00' }),
    ];
    const transfers = [
      makeTransfer({ amountManuela: '€100.00' }),
    ];
    const result = calculateBalance(expenses, transfers);
    // Spending delta Daniel: 50-300 = -250
    // Transfer delta: 0-100 = -100
    // Adjusted: -250 - (-100) = -150
    expect(result.adjustedDeltaDaniel).toBe(-150);
    expect(result.adjustedDeltaManuela).toBe(150);
  });

  it('equal spending with no transfers yields zero delta', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€100.00', amountManuela: '€100.00' }),
    ];
    const result = calculateBalance(expenses, []);
    expect(result.adjustedDeltaDaniel).toBe(0);
    expect(result.adjustedDeltaManuela).toBe(0);
  });

  it('only transfers, no expenses', () => {
    const transfers = [
      makeTransfer({ amountDaniel: '€100.00' }),
    ];
    const result = calculateBalance([], transfers);
    // No spending, but Daniel transferred 100
    expect(result.adjustedDeltaDaniel).toBe(-100);
    expect(result.adjustedDeltaManuela).toBe(100);
    expect(result.netTransfer).toBe(100);
  });

  it('handles empty amount strings correctly', () => {
    const expenses = [
      makeExpense({ amountDaniel: '€100.00', amountManuela: '' }),
    ];
    const transfers = [
      makeTransfer({ amountDaniel: '', amountManuela: '' }),
    ];
    const result = calculateBalance(expenses, transfers);
    expect(result.adjustedDeltaDaniel).toBe(100);
    expect(result.adjustedDeltaManuela).toBe(-100);
  });

  it('netTransfer is positive when Daniel transfers more', () => {
    const transfers = [
      makeTransfer({ amountDaniel: '€200.00' }),
      makeTransfer({ amountManuela: '€50.00' }),
    ];
    const result = calculateBalance([], transfers);
    expect(result.netTransfer).toBe(150);
  });

  it('netTransfer is negative when Manuela transfers more', () => {
    const transfers = [
      makeTransfer({ amountDaniel: '€50.00' }),
      makeTransfer({ amountManuela: '€200.00' }),
    ];
    const result = calculateBalance([], transfers);
    expect(result.netTransfer).toBe(-150);
  });
});
