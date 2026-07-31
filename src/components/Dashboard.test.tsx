// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import { renderWithMantine } from '../test-utils';
import { Dashboard } from './Dashboard';
import type { Expense, ExpenseRow } from '../types/expense';
import type { Transfer, TransferRow } from '../types/transfer';
import type { Gift, GiftRow } from '../types/gift';

// The charts are canvas-only; nothing here asserts on them.
vi.mock('react-chartjs-2', () => ({
  Bar: () => null,
  Pie: () => null,
}));

afterEach(cleanup);

const NAMES = { a: 'Ada', b: 'Bo' };

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    rowIndex: 3 as ExpenseRow,
    date: '2026-01-15',
    amountA: '',
    amountB: '',
    item: 'Test',
    category: 'Food',
    notes: '',
    ...overrides,
  };
}

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

function renderDashboard(expenses: Expense[], transfers: Transfer[] = [], gifts: Gift[] = []) {
  renderWithMantine(
    <Dashboard names={NAMES} expenses={expenses} transfers={transfers} gifts={gifts} />,
  );
}

/** The three cells of a named row in the Spending by Person table. */
function row(label: string): string[] {
  const cell = screen.getByRole('cell', { name: label });
  const cells = within(cell.closest('tr') as HTMLElement).getAllByRole('cell');
  return cells.map((c) => c.textContent ?? '');
}

// ── Gift kinds in the totals table ──
// Presents and forgiveness are both gifts but only one of them is inside the
// Balance underneath, so they must never share a row.

describe('gift rows', () => {
  const expenses = [makeExpense({ amountA: '€500.00', amountB: '€100.00' })];

  it('shows neither row when there are no gifts', () => {
    renderDashboard(expenses);
    expect(screen.queryByRole('cell', { name: 'Gifts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Forgiven' })).not.toBeInTheDocument();
  });

  it('puts a present under Gifts, and leaves the balance alone', () => {
    renderDashboard(expenses, [], [makeGift({ amountA: '€50.00', giftKind: 'present' })]);

    expect(row('Gifts')).toEqual(['Gifts', '€50.00', '—']);
    expect(screen.queryByRole('cell', { name: 'Forgiven' })).not.toBeInTheDocument();
    // Unchanged: half the €400 spending gap.
    expect(row('Balance')).toEqual(['Balance', '+€200.00', '-€200.00']);
  });

  it('puts forgiveness under its own row, and moves the balance', () => {
    renderDashboard(expenses, [], [makeGift({ amountA: '€50.00', giftKind: 'forgiven' })]);

    expect(row('Forgiven')).toEqual(['Forgiven', '€50.00', '—']);
    expect(screen.queryByRole('cell', { name: 'Gifts' })).not.toBeInTheDocument();
    // 200 owed, less the €50 forgiven.
    expect(row('Balance')).toEqual(['Balance', '+€150.00', '-€150.00']);
  });

  it('keeps the two apart when both are present', () => {
    renderDashboard(
      expenses,
      [],
      [
        makeGift({ rowIndex: 2 as GiftRow, amountA: '€50.00', giftKind: 'present' }),
        makeGift({ rowIndex: 3 as GiftRow, amountB: '€30.00', giftKind: 'forgiven' }),
      ],
    );

    expect(row('Gifts')).toEqual(['Gifts', '€50.00', '—']);
    expect(row('Forgiven')).toEqual(['Forgiven', '—', '€30.00']);
    // Only Bo's €30 forgiveness counts: 200 owed + 30.
    expect(row('Balance')).toEqual(['Balance', '+€230.00', '-€230.00']);
  });

  it('reads a legacy gift with no explicit kind as forgiven', () => {
    const legacy = makeGift({ amountA: '€50.00' });
    delete (legacy as Partial<Gift>).giftKind;
    renderDashboard(expenses, [], [legacy as Gift]);

    expect(row('Forgiven')).toEqual(['Forgiven', '€50.00', '—']);
    expect(row('Balance')).toEqual(['Balance', '+€150.00', '-€150.00']);
  });

  it('still shows transfers separately from both', () => {
    const transfers: Transfer[] = [
      {
        rowIndex: 2 as TransferRow,
        date: '2026-01-20',
        amountA: '',
        amountB: '€20.00',
        notes: '',
      },
    ];
    renderDashboard(expenses, transfers, [makeGift({ amountA: '€50.00', giftKind: 'present' })]);

    expect(row('Transfers')).toEqual(['Transfers', '—', '€20.00']);
    expect(row('Gifts')).toEqual(['Gifts', '€50.00', '—']);
    // 200 owed less the €20 transferred; the present contributes nothing.
    expect(row('Balance')).toEqual(['Balance', '+€180.00', '-€180.00']);
  });
});

// ── Balance sign ──

describe('balance formatting', () => {
  it('leads the negative side with the minus, not the euro sign', () => {
    renderDashboard([makeExpense({ amountB: '€80.00' })]);
    expect(row('Balance')).toEqual(['Balance', '-€40.00', '+€40.00']);
  });

  it('shows a squared-up balance without a stray minus', () => {
    renderDashboard([makeExpense({ amountA: '€40.00', amountB: '€40.00' })]);
    expect(row('Balance')).toEqual(['Balance', '+€0.00', '+€0.00']);
  });
});
