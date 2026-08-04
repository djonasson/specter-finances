// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Expense, ExpenseRow } from '../types/expense';
import type { PendingExpense } from '../services/recurring';

// The sheet layer is stubbed wholesale: what matters here is the orchestration
// the provider adds on top of it, which nothing else covers.
const fetchExpenses = vi.fn();
const appendGeneratedExpenses = vi.fn();

vi.mock('../services/sheets', () => ({
  fetchExpenses: () => fetchExpenses(),
  appendGeneratedExpenses: (rows: unknown) => appendGeneratedExpenses(rows),
  addExpense: vi.fn(async () => {}),
  updateExpense: vi.fn(async () => {}),
  deleteExpense: vi.fn(async () => {}),
  fetchTransfers: vi.fn(async () => []),
  addTransfer: vi.fn(async () => {}),
  updateTransfer: vi.fn(async () => {}),
  deleteTransfer: vi.fn(async () => {}),
  fetchGifts: vi.fn(async () => []),
  addGift: vi.fn(async () => {}),
  updateGift: vi.fn(async () => {}),
  deleteGift: vi.fn(async () => {}),
  fetchRecurring: vi.fn(async () => ({ rules: [], tabMissing: false })),
  addRecurring: vi.fn(async () => {}),
  updateRecurring: vi.fn(async () => {}),
  deleteRecurring: vi.fn(async () => {}),
  assignRecurringId: vi.fn(async () => {}),
  ensureRecurringSetup: vi.fn(async () => {}),
}));

import { ExpensesProvider, useExpensesContext } from './ExpensesContext';

const NAMES = { a: 'Ada', b: 'Bo' };

function makeExpense(marker: string, rowIndex = 3): Expense {
  return {
    rowIndex: rowIndex as ExpenseRow,
    date: '2026-02-10',
    amountA: '€12.99',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Phone',
    category: 'Various',
    notes: '',
    recurringMarker: marker,
    addedOn: '2026-02-10',
  };
}

function makePending(month: string): PendingExpense {
  return {
    ruleId: 'r1',
    month,
    marker: `rec:r1:${month}`,
    date: `${month}-10`,
    amountA: '€12.99',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Phone',
    category: 'Various',
    notes: '',
    amountVaries: false,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ExpensesProvider>{children}</ExpensesProvider>
);

beforeEach(() => {
  localStorage.clear();
  fetchExpenses.mockResolvedValue({ expenses: [], names: NAMES });
  appendGeneratedExpenses.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('the shape the context hands out', () => {
  it('groups each tab under its own key rather than one flat namespace', () => {
    const { result } = renderHook(() => useExpensesContext(), { wrapper });
    expect(Object.keys(result.current).sort()).toEqual([
      'expenses',
      'gifts',
      'names',
      'pending',
      'recurring',
      'transfers',
    ]);
  });

  it('refuses to be used outside its provider rather than handing back nothing', () => {
    // Rendering without the wrapper: the throw is the whole point.
    expect(() => renderHook(() => useExpensesContext())).toThrow(
      'useExpensesContext must be used within ExpensesProvider',
    );
  });

  it('offers the two names at the top, where every screen reaches for them', async () => {
    const { result } = renderHook(() => useExpensesContext(), { wrapper });
    await act(async () => {
      await result.current.expenses.load();
    });
    expect(result.current.names).toEqual(NAMES);
  });
});

// ── Writing the confirmed months ──
//
// Two devices can be open at once and the sheet has no transactions, so the
// other one may have written the same month while a confirmation sat open.

describe('generating recurring expenses', () => {
  it('writes the rows it was given', async () => {
    const { result } = renderHook(() => useExpensesContext(), { wrapper });

    let added = 0;
    await act(async () => {
      added = await result.current.pending.generate([
        makePending('2026-02'),
        makePending('2026-03'),
      ]);
    });

    expect(added).toBe(2);
    expect(appendGeneratedExpenses.mock.calls[0][0].map((p: PendingExpense) => p.month)).toEqual([
      '2026-02',
      '2026-03',
    ]);
  });

  it('drops a month the other device wrote while the confirmation was open', async () => {
    fetchExpenses.mockResolvedValue({ expenses: [makeExpense('rec:r1:2026-02')], names: NAMES });
    const { result } = renderHook(() => useExpensesContext(), { wrapper });

    let added = 0;
    await act(async () => {
      added = await result.current.pending.generate([
        makePending('2026-02'),
        makePending('2026-03'),
      ]);
    });

    expect(added).toBe(1);
    expect(appendGeneratedExpenses.mock.calls[0][0].map((p: PendingExpense) => p.month)).toEqual([
      '2026-03',
    ]);
  });

  // Reporting what was offered rather than what was written told the user "3
  // expenses added" when the answer was none.
  it('reports nothing written when every month had already been taken', async () => {
    fetchExpenses.mockResolvedValue({ expenses: [makeExpense('rec:r1:2026-02')], names: NAMES });
    const { result } = renderHook(() => useExpensesContext(), { wrapper });

    let added = -1;
    await act(async () => {
      added = await result.current.pending.generate([makePending('2026-02')]);
    });

    expect(added).toBe(0);
    expect(appendGeneratedExpenses.mock.calls[0][0]).toEqual([]);
  });

  it('re-reads the sheet before writing, not after', async () => {
    const { result } = renderHook(() => useExpensesContext(), { wrapper });
    await act(async () => {
      await result.current.pending.generate([makePending('2026-02')]);
    });
    // Read, write, then read again to refresh the list.
    expect(fetchExpenses.mock.invocationCallOrder[0]).toBeLessThan(
      appendGeneratedExpenses.mock.invocationCallOrder[0],
    );
  });

  it('reloads the expenses afterwards, so the new rows are on screen', async () => {
    const { result } = renderHook(() => useExpensesContext(), { wrapper });
    fetchExpenses.mockResolvedValue({ expenses: [makeExpense('rec:r1:2026-02')], names: NAMES });

    await act(async () => {
      await result.current.pending.generate([makePending('2026-03')]);
    });

    await waitFor(() => expect(result.current.expenses.items).toHaveLength(1));
  });
});
