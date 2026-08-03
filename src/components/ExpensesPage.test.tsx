// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { renderWithMantine } from '../test-utils';
import { ExpensesPage } from './ExpensesPage';
import type { Expense, ExpenseRow } from '../types/expense';
import type { RecurringRule, RecurringRow } from '../types/recurring';
import type { PendingExpense } from '../services/recurring';

const NAMES = { a: 'Ada', b: 'Bo' };

const expense: Expense = {
  rowIndex: 3 as ExpenseRow,
  date: '2026-01-15',
  amountA: '€10.00',
  amountB: '',
  notCountedA: '',
  notCountedB: '',
  item: 'Bread',
  category: 'Food',
  notes: '',
  recurringMarker: '',
  addedOn: '',
};

function duePending(n: number): PendingExpense[] {
  return Array.from({ length: n }, (_, i) => {
    const month = `2026-${String(i + 1).padStart(2, '0')}`;
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
      category: 'Various' as const,
      notes: '',
    };
  });
}

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
};

/** Reports the current location so the tab's effect on the URL can be asserted. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(initialEntry = '/list', dueCount = 0) {
  renderWithMantine(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ExpensesPage
        names={NAMES}
        expenses={{
          expenses: [expense],
          loading: false,
          onUpdate: vi.fn(async () => {}),
          onDelete: vi.fn(async () => {}),
          onRefresh: vi.fn(),
        }}
        recurring={{
          rules: [rule],
          loading: false,
          tabMissing: false,
          pending: duePending(dueCount),
          onUpdate: vi.fn(async () => {}),
          onDelete: vi.fn(async () => {}),
          onAssignId: vi.fn(async () => {}),
          onSetUp: vi.fn(async () => {}),
          onGenerate: vi.fn(),
          onRefresh: vi.fn(),
        }}
      />
      <LocationProbe />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('ExpensesPage', () => {
  it('shows the expenses first', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Expenses' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('cell', { name: 'Bread' }).length).toBeGreaterThan(0);
  });

  it('opens straight onto the recurring payments from the address bar', () => {
    renderPage('/list?tab=recurring');
    expect(screen.getByRole('tab', { name: 'Recurring' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('cell', { name: 'Phone' })).toBeInTheDocument();
  });

  // The tab is held in the query string rather than the path so the bottom nav,
  // which marks the current screen by exact pathname, keeps Expenses lit — and
  // so switching tabs is not a navigation, which in this app refetches
  // everything.
  it('keeps the path on /list when switching tabs', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Recurring' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/list?tab=recurring');
  });

  it('goes back to a bare /list rather than leaving a stale query', async () => {
    const user = userEvent.setup();
    renderPage('/list?tab=recurring');
    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/list');
    expect(screen.getByTestId('location')).not.toHaveTextContent('tab=recurring');
  });

  it('says on the tab itself how many payments are waiting', () => {
    renderPage('/list', 3);
    expect(screen.getByRole('tab', { name: 'Recurring (3 due)' })).toBeInTheDocument();
  });

  it('leaves the tab unadorned when nothing is due', () => {
    renderPage('/list', 0);
    expect(screen.getByRole('tab', { name: 'Recurring' })).toBeInTheDocument();
  });

  it('treats an unknown tab in the address as the expenses one', () => {
    renderPage('/list?tab=nonsense');
    expect(screen.getByRole('tab', { name: 'Expenses' })).toHaveAttribute('aria-selected', 'true');
  });
});
