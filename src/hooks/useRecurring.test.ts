// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RecurringRule, RecurringRow, RecurringFormData } from '../types/recurring';

const fetchRecurring = vi.fn();
const addRecurring = vi.fn<(form: unknown) => Promise<void>>(async () => {});
const updateRecurring = vi.fn<(rowIndex: unknown, form: unknown, id: unknown) => Promise<void>>(
  async () => {},
);
const deleteRecurring = vi.fn<(rowIndex: unknown) => Promise<void>>(async () => {});
const assignRecurringId = vi.fn<(rowIndex: unknown) => Promise<void>>(async () => {});
const ensureRecurringSetup = vi.fn(async () => {});

vi.mock('../services/sheets', () => ({
  fetchRecurring: () => fetchRecurring(),
  addRecurring: (form: unknown) => addRecurring(form),
  updateRecurring: (rowIndex: unknown, form: unknown, id: unknown) =>
    updateRecurring(rowIndex, form, id),
  deleteRecurring: (rowIndex: unknown) => deleteRecurring(rowIndex),
  assignRecurringId: (rowIndex: unknown) => assignRecurringId(rowIndex),
  ensureRecurringSetup: () => ensureRecurringSetup(),
}));

import { useRecurring } from './useRecurring';

const rule: RecurringRule = {
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
};

const form: RecurringFormData = {
  start: '2026-01-10',
  amountA: '12.99',
  amountB: '',
  notCountedA: '',
  notCountedB: '',
  item: 'Phone',
  category: 'Various',
  notes: '',
  day: 10,
  everyMonths: 1,
  amountVaries: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchRecurring.mockResolvedValue({ rules: [rule], tabMissing: false });
});

// Added retroactively. The interesting part is `tabMissing`: a sheet nobody has
// set the feature up on is an ordinary empty state, and treating it as an error
// would put a red banner over an app that is working perfectly well.

describe('useRecurring', () => {
  it('holds the rules the sheet returned', async () => {
    const { result } = renderHook(() => useRecurring());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.items).toEqual([rule]);
    expect(result.current.tabMissing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reports a missing tab as an empty state, not a failure', async () => {
    fetchRecurring.mockResolvedValue({ rules: [], tabMissing: true });
    const { result } = renderHook(() => useRecurring());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.tabMissing).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('still reports a real failure as an error', async () => {
    fetchRecurring.mockRejectedValue(new Error('Backend error'));
    const { result } = renderHook(() => useRecurring());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBe('Backend error');
    expect(result.current.tabMissing).toBe(false);
  });

  it('stops reporting a missing tab once it has been created', async () => {
    fetchRecurring.mockResolvedValue({ rules: [], tabMissing: true });
    const { result } = renderHook(() => useRecurring());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.tabMissing).toBe(true);

    fetchRecurring.mockResolvedValue({ rules: [rule], tabMissing: false });
    await act(async () => {
      await result.current.setUp();
    });
    expect(ensureRecurringSetup).toHaveBeenCalled();
    expect(result.current.tabMissing).toBe(false);
  });

  it('re-reads after every mutation, because deleting renumbers the rows below', async () => {
    const { result } = renderHook(() => useRecurring());

    await act(async () => {
      await result.current.add(form);
    });
    expect(addRecurring).toHaveBeenCalledWith(form);

    await act(async () => {
      await result.current.update(2 as RecurringRow, form, 'r1');
    });
    // The id is carried through rather than regenerated: a new one would orphan
    // every expense the rule has already produced.
    expect(updateRecurring).toHaveBeenCalledWith(2, form, 'r1');

    await act(async () => {
      await result.current.remove(2 as RecurringRow);
    });
    expect(deleteRecurring).toHaveBeenCalledWith(2);

    await act(async () => {
      await result.current.assignId(3 as RecurringRow);
    });
    expect(assignRecurringId).toHaveBeenCalledWith(3);

    expect(fetchRecurring).toHaveBeenCalledTimes(4);
  });

  it('lets a failed write reject to the caller rather than parking it here', async () => {
    addRecurring.mockRejectedValueOnce(new Error('Write failed'));
    const { result } = renderHook(() => useRecurring());

    await expect(
      act(async () => {
        await result.current.add(form);
      }),
    ).rejects.toThrow('Write failed');
    expect(result.current.error).toBeNull();
  });

  it('keeps load stable, since the refetch effect is keyed on it', () => {
    const { result, rerender } = renderHook(() => useRecurring());
    const first = result.current.load;
    rerender();
    expect(result.current.load).toBe(first);
  });
});
