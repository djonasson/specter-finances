// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecurringPending } from './useRecurringPending';
import type { Expense, ExpenseRow } from '../types/expense';
import type { RecurringRule, RecurringRow } from '../types/recurring';

// The whole trigger turns on what "today" is, so it is pinned rather than left
// to the day the suite happens to run.
vi.mock('../services/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/utils')>()),
  today: () => '2026-03-20',
}));

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

function makeExpense(marker: string, rowIndex = 3): Expense {
  return {
    rowIndex: rowIndex as ExpenseRow,
    date: '2026-01-10',
    amountA: '€12.99',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Phone',
    category: 'Various',
    notes: '',
    recurringMarker: marker,
    addedOn: '',
  };
}

/** Loaded, idle, and ready to be asked — the ordinary case. */
const READY = { expensesReady: true, busy: false };

function render(rules: RecurringRule[], expenses: Expense[], { expensesReady, busy } = READY) {
  return renderHook(() => useRecurringPending(rules, expenses, expensesReady, busy));
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('useRecurringPending', () => {
  it('asks about the months that have come due', () => {
    const { result } = render([makeRule()], []);
    expect(result.current.prompt).toBe(true);
    expect(result.current.pending.map((p) => p.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('stays quiet when every month is already on the sheet', () => {
    const { result } = render(
      [makeRule()],
      [makeExpense('rec:r1:2026-01'), makeExpense('rec:r1:2026-02'), makeExpense('rec:r1:2026-03')],
    );
    expect(result.current.prompt).toBe(false);
    expect(result.current.pending).toEqual([]);
  });

  // The nag this exists to prevent: every navigation refetches all four
  // domains, so a plain "is anything due" flag would reopen the modal on every
  // tap of the bottom bar.
  it('does not ask again once the same set of months has been dismissed', () => {
    const { result, rerender } = render([makeRule()], []);
    act(() => result.current.dismiss());
    rerender();
    expect(result.current.prompt).toBe(false);
    expect(result.current.pending).toHaveLength(3); // still due, just not asked about
  });

  it('remembers the dismissal across a cold start, as an installed app has many', () => {
    const first = render([makeRule()], []);
    act(() => first.result.current.dismiss());
    first.unmount();

    const second = render([makeRule()], []);
    expect(second.result.current.prompt).toBe(false);
  });

  it('asks again when a further month falls due', () => {
    const dismissed = render([makeRule()], [makeExpense('rec:r1:2026-01')]);
    act(() => dismissed.result.current.dismiss());
    dismissed.unmount();

    // February has since been added, so only March is left — a different set.
    const later = render(
      [makeRule()],
      [makeExpense('rec:r1:2026-01'), makeExpense('rec:r1:2026-02', 4)],
    );
    expect(later.result.current.prompt).toBe(true);
    expect(later.result.current.pending.map((p) => p.month)).toEqual(['2026-03']);
  });

  it('asks again when a payment is added to the list', () => {
    const before = render([makeRule()], []);
    act(() => before.result.current.dismiss());
    before.unmount();

    const after = render([makeRule(), makeRule({ id: 'r2', rowIndex: 3 as RecurringRow })], []);
    expect(after.result.current.prompt).toBe(true);
  });

  // The most dangerous state in the feature. On first paint the expenses are an
  // empty array, which is indistinguishable from a sheet where nothing was ever
  // created — and acting on that would offer to write every month of every rule.
  it('stays quiet until the expenses have actually been read', () => {
    const { result } = render([makeRule()], [], { expensesReady: false, busy: false });
    expect(result.current.pending).toEqual([]);
    expect(result.current.prompt).toBe(false);
  });

  it('stays quiet while a load is still in flight', () => {
    const { result } = render([makeRule()], [], { expensesReady: true, busy: true });
    expect(result.current.prompt).toBe(false);
  });

  it('opens on request even after a dismissal, so generating is always reachable', () => {
    const { result } = render([makeRule()], []);
    act(() => result.current.dismiss());
    expect(result.current.prompt).toBe(false);

    act(() => result.current.request());
    expect(result.current.prompt).toBe(true);
  });

  it('records nothing when the prompt is merely opened by hand', () => {
    const { result } = render([makeRule()], []);
    act(() => result.current.request());
    expect(localStorage.getItem('sf_recurring_dismissed')).toBeNull();
  });

  it('never asks when there is nothing to ask about, however it was requested', () => {
    const { result } = render([], []);
    act(() => result.current.request());
    expect(result.current.prompt).toBe(false);
  });
});
