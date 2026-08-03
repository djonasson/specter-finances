// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DEFAULT_NAMES } from '../types/person';
import type { Expense, ExpenseRow } from '../types/expense';

const fetchExpenses = vi.fn();
const addExpense = vi.fn<(form: unknown) => Promise<void>>(async () => {});
const updateExpense = vi.fn<(rowIndex: unknown, form: unknown) => Promise<void>>(async () => {});
const deleteExpense = vi.fn<(rowIndex: unknown) => Promise<void>>(async () => {});

vi.mock('../services/sheets', () => ({
  fetchExpenses: () => fetchExpenses(),
  addExpense: (form: unknown) => addExpense(form),
  updateExpense: (rowIndex: unknown, form: unknown) => updateExpense(rowIndex, form),
  deleteExpense: (rowIndex: unknown) => deleteExpense(rowIndex),
}));

import { useExpenses } from './useExpenses';

const NAMES = { a: 'Ada', b: 'Bo' };

const row: Expense = {
  rowIndex: 3 as ExpenseRow,
  date: '2026-01-10',
  amountA: '€10.00',
  amountB: '',
  item: 'Bread',
  category: 'Food',
  notes: '',
  recurringMarker: '',
  addedOn: '',
};

const form = {
  date: '2026-01-10',
  amountA: '10',
  amountB: '',
  item: 'Bread',
  category: 'Food' as const,
  notes: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchExpenses.mockResolvedValue({ expenses: [row], names: NAMES });
});

// Added retroactively. Most of this mirrors useMovements, but the two pieces of
// state this hook carries on top — the names and `loadedOnce` — are exactly
// what nothing else covers, and `loadedOnce` is what stands between a slow first
// load and the app offering to write every month of every recurring payment.

describe('useExpenses', () => {
  it('shows placeholder names until the sheet has been read', () => {
    const { result } = renderHook(() => useExpenses());
    expect(result.current.names).toEqual(DEFAULT_NAMES);
  });

  it('takes the names from the sheet once it has', async () => {
    const { result } = renderHook(() => useExpenses());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.names).toEqual(NAMES);
    expect(result.current.items).toEqual([row]);
  });

  it('keeps the placeholder names when the read fails, rather than blanking them', async () => {
    fetchExpenses.mockRejectedValue(new Error('Backend error'));
    const { result } = renderHook(() => useExpenses());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.names).toEqual(DEFAULT_NAMES);
    expect(result.current.error).toBe('Backend error');
  });

  // An unread list is an empty array, which is indistinguishable from a sheet
  // where nothing was ever generated. Acting on that would offer to write every
  // month of every rule at once.
  it('does not claim to have read the sheet before it has', () => {
    const { result } = renderHook(() => useExpenses());
    expect(result.current.loadedOnce).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('claims it only after a read that actually succeeded', async () => {
    fetchExpenses.mockRejectedValue(new Error('Backend error'));
    const { result } = renderHook(() => useExpenses());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.loadedOnce).toBe(false);

    fetchExpenses.mockResolvedValue({ expenses: [row], names: NAMES });
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.loadedOnce).toBe(true);
  });

  it('stays true through a later failure, so a blip cannot re-arm the hazard', async () => {
    const { result } = renderHook(() => useExpenses());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.loadedOnce).toBe(true);

    fetchExpenses.mockRejectedValue(new Error('Offline'));
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.loadedOnce).toBe(true);
  });

  it('re-reads the sheet after every mutation, because row numbers shift', async () => {
    const { result } = renderHook(() => useExpenses());
    await act(async () => {
      await result.current.add(form);
    });
    expect(addExpense).toHaveBeenCalledWith(form);
    expect(fetchExpenses).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.update(3 as ExpenseRow, form);
    });
    expect(updateExpense).toHaveBeenCalledWith(3, form);

    await act(async () => {
      await result.current.remove(3 as ExpenseRow);
    });
    expect(deleteExpense).toHaveBeenCalledWith(3);
    expect(fetchExpenses).toHaveBeenCalledTimes(3);
  });

  it('lets a failed write reject to the form rather than parking it here', async () => {
    addExpense.mockRejectedValueOnce(new Error('Write failed'));
    const { result } = renderHook(() => useExpenses());

    await expect(
      act(async () => {
        await result.current.add(form);
      }),
    ).rejects.toThrow('Write failed');
    expect(result.current.error).toBeNull();
  });

  it('keeps load stable, since the refetch effect is keyed on it', () => {
    const { result, rerender } = renderHook(() => useExpenses());
    const first = result.current.load;
    rerender();
    expect(result.current.load).toBe(first);
  });
});
