// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderWithMantine } from '../test-utils';
import { ExpenseList } from './ExpenseList';
import type { Expense, ExpenseRow } from '../types/expense';

// Deliberately not the defaults: these prove the component renders the names it
// is handed rather than any it knows itself.
const NAMES = { a: 'Ada', b: 'Bo' };

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    rowIndex: 3 as ExpenseRow,
    date: '2026-01-15',
    amountA: '€10.00',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Test',
    category: 'Food',
    notes: '',
    recurringMarker: '',
    addedOn: '',
    ...overrides,
  };
}

function renderList(expenses: Expense[]) {
  const onUpdate = vi.fn(async () => {});
  const onDelete = vi.fn(async () => {});
  const onRefresh = vi.fn();
  renderWithMantine(
    <MemoryRouter>
      <ExpenseList
        names={NAMES}
        expenses={expenses}
        loading={false}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onRefresh={onRefresh}
      />
    </MemoryRouter>,
  );
  return { onUpdate, onDelete, onRefresh };
}

/**
 * The desktop table is the first one; read its item column, in order.
 *
 * The item cell may also hold the Recurring badge, so this reads the item's own
 * span rather than the cell's whole text.
 */
function itemsInOrder(): string[] {
  const tables = screen.getAllByRole('table');
  const rows = within(tables[0]).getAllByRole('row').slice(1); // drop the header
  return rows.map((r) => {
    const cell = within(r).getAllByRole('cell')[3];
    return (cell.querySelector('span') ?? cell).textContent?.trim() ?? '';
  });
}

/** Both breakpoints' tables are rendered at once, so most controls appear twice. */
function firstButton(name: string | RegExp) {
  return screen.getAllByRole('button', { name })[0];
}

afterEach(cleanup);

// ── Ordering ──
//
// The list used to be shown in one fixed order, the sheet reversed. It now
// defaults to newest first, which for a sheet filled in as the money was spent
// is the same list — but the other orders are new, and getting one backwards
// would put the largest spending where nobody looks.

describe('ordering', () => {
  const jan = makeExpense({
    rowIndex: 3 as ExpenseRow,
    date: '2026-01-05',
    item: 'January',
    amountA: '€10.00',
  });
  const feb = makeExpense({
    rowIndex: 4 as ExpenseRow,
    date: '2026-02-05',
    item: 'February',
    amountA: '€30.00',
  });
  const mar = makeExpense({
    rowIndex: 5 as ExpenseRow,
    date: '2026-03-05',
    item: 'March',
    amountA: '€20.00',
  });

  it('shows the newest first without the user choosing anything', () => {
    renderList([jan, feb, mar]);
    expect(itemsInOrder()).toEqual(['March', 'February', 'January']);
  });

  it('reverses to oldest first when asked', async () => {
    const user = userEvent.setup();
    renderList([jan, feb, mar]);
    await user.click(screen.getByRole('textbox', { name: 'Sort by' }));
    await user.click(await screen.findByRole('option', { name: 'Oldest first' }));
    expect(itemsInOrder()).toEqual(['January', 'February', 'March']);
  });

  it('orders by what each row cost when sorting by amount', async () => {
    const user = userEvent.setup();
    renderList([jan, feb, mar]);
    await user.click(screen.getByRole('textbox', { name: 'Sort by' }));
    await user.click(await screen.findByRole('option', { name: 'Largest amount' }));
    expect(itemsInOrder()).toEqual(['February', 'March', 'January']);
  });

  it('adds both columns, so a bill split between them ranks by what it cost', async () => {
    const user = userEvent.setup();
    const split = makeExpense({
      rowIndex: 6 as ExpenseRow,
      item: 'Split',
      amountA: '€100.00',
      amountB: '€100.00',
    });
    const single = makeExpense({ rowIndex: 7 as ExpenseRow, item: 'Single', amountA: '€150.00' });
    renderList([split, single]);
    await user.click(screen.getByRole('textbox', { name: 'Sort by' }));
    await user.click(await screen.findByRole('option', { name: 'Largest amount' }));
    expect(itemsInOrder()).toEqual(['Split', 'Single']);
  });

  it('can still show the sheet’s own order, which is what it always used to show', async () => {
    const user = userEvent.setup();
    const backdated = makeExpense({
      rowIndex: 6 as ExpenseRow,
      date: '2020-01-01',
      item: 'Backdated',
    });
    renderList([jan, backdated]);
    await user.click(screen.getByRole('textbox', { name: 'Sort by' }));
    await user.click(await screen.findByRole('option', { name: 'First added' }));
    expect(itemsInOrder()).toEqual(['January', 'Backdated']);
  });

  it('sorts by date from the header, and reports the direction to screen readers', async () => {
    const user = userEvent.setup();
    renderList([jan, feb, mar]);
    const tables = screen.getAllByRole('table');
    const header = () => within(tables[0]).getAllByRole('columnheader')[0];

    expect(header()).toHaveAttribute('aria-sort', 'descending');
    await user.click(within(header()).getByRole('button'));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
    expect(itemsInOrder()).toEqual(['January', 'February', 'March']);
  });

  it('keeps the header and the sort control saying the same thing', async () => {
    const user = userEvent.setup();
    renderList([jan, feb, mar]);
    const tables = screen.getAllByRole('table');
    await user.click(within(within(tables[0]).getAllByRole('columnheader')[0]).getByRole('button'));
    expect(screen.getByRole('textbox', { name: 'Sort by' })).toHaveValue('Oldest first');
  });
});

// ── Filtering ──

describe('filtering', () => {
  const bread = makeExpense({ rowIndex: 3 as ExpenseRow, item: 'Bread', category: 'Food' });
  const petrol = makeExpense({ rowIndex: 4 as ExpenseRow, item: 'Petrol', category: 'Car' });
  const phone = makeExpense({
    rowIndex: 5 as ExpenseRow,
    item: 'Phone',
    category: 'Various',
    notCountedA: '',
    notCountedB: '',
    recurringMarker: 'rec:r1:2026-01',
  });

  it('narrows the table to one category', async () => {
    const user = userEvent.setup();
    renderList([bread, petrol, phone]);
    await user.click(screen.getByRole('textbox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Food' }));
    expect(itemsInOrder()).toEqual(['Bread']);
  });

  it('does not offer an uncategorised filter when every row has a category', async () => {
    const user = userEvent.setup();
    renderList([bread, petrol]);
    await user.click(screen.getByRole('textbox', { name: 'Category' }));
    expect(screen.queryByRole('option', { name: 'Uncategorised' })).toBeNull();
  });

  it('can reach the rows whose category the sheet left blank', async () => {
    // toCategory blanks anything it does not recognise, and those rows are real
    // in a hand-edited sheet — a filter that cannot reach them hides them.
    const user = userEvent.setup();
    const mystery = makeExpense({ rowIndex: 6 as ExpenseRow, item: 'Mystery', category: '' });
    renderList([bread, mystery]);
    await user.click(screen.getByRole('textbox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Uncategorised' }));
    expect(itemsInOrder()).toEqual(['Mystery']);
  });

  it('still filters by free text', async () => {
    const user = userEvent.setup();
    renderList([bread, petrol, phone]);
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'petr');
    expect(itemsInOrder()).toEqual(['Petrol']);
  });

  it('counts what was matched, not what is on screen', async () => {
    const user = userEvent.setup();
    renderList([bread, petrol, phone]);
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'petr');
    expect(screen.getByText('Showing 1 of 1 expenses')).toBeInTheDocument();
  });

  it('isolates the created rows when the search box says recurring', async () => {
    const user = userEvent.setup();
    renderList([bread, petrol, phone]);
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'recurring');
    expect(itemsInOrder()).toEqual(['Phone']);
  });

  it('returns to the first page whenever the ordering or filtering changes', async () => {
    const user = userEvent.setup();
    // 60 rows across two pages; page 2 holds the oldest ten.
    const many = Array.from({ length: 60 }, (_, i) =>
      makeExpense({
        rowIndex: (i + 3) as ExpenseRow,
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        item: `Item ${i}`,
      }),
    );
    renderList(many);

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(itemsInOrder()).toHaveLength(10);

    await user.click(screen.getByRole('textbox', { name: 'Sort by' }));
    await user.click(await screen.findByRole('option', { name: 'Oldest first' }));
    expect(itemsInOrder()).toHaveLength(50);
  });
});

// ── The new badge ──
//
// The list is ordered by when the money was spent, so a purchase entered today
// but dated last month sits in the middle of it — which is exactly where nobody
// looking for what they just typed would scroll.

describe('the new badge', () => {
  const TODAY = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  it('marks a row added today, even though it is dated weeks ago', () => {
    renderList([makeExpense({ date: '2026-01-02', item: 'Backdated', addedOn: TODAY })]);
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
  });

  it('still marks one added two days ago', () => {
    renderList([makeExpense({ item: 'Recent', addedOn: daysAgo(2) })]);
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
  });

  it('leaves an older row unmarked', () => {
    renderList([makeExpense({ item: 'Older', addedOn: daysAgo(9) })]);
    expect(screen.queryByText('New')).toBeNull();
  });

  it('leaves a row that predates the column unmarked, rather than calling it new', () => {
    renderList([makeExpense({ item: 'Legacy', addedOn: '' })]);
    expect(screen.queryByText('New')).toBeNull();
  });

  it('shows it on the narrow layout without having to open the row', () => {
    renderList([makeExpense({ item: 'Backdated', addedOn: TODAY })]);
    // Both breakpoints render at once; the second table is the narrow one, and
    // a badge only reachable by tapping each row would be no help at all.
    const mobileTable = screen.getAllByRole('table')[1];
    expect(within(mobileTable).getByText('New')).toBeInTheDocument();
  });

  it('carries both badges on a caught-up recurring payment, which is both', () => {
    renderList([makeExpense({ item: 'Phone', addedOn: TODAY, recurringMarker: 'rec:r1:2026-01' })]);
    const desktopTable = screen.getAllByRole('table')[0];
    expect(within(desktopTable).getByText('New')).toBeInTheDocument();
    expect(within(desktopTable).getByText('Recurring')).toBeInTheDocument();
  });

  it('still finds the item by name with a badge beside it', async () => {
    const user = userEvent.setup();
    renderList([
      makeExpense({ rowIndex: 3 as ExpenseRow, item: 'Phone', addedOn: TODAY }),
      makeExpense({ rowIndex: 4 as ExpenseRow, item: 'Bread', addedOn: '' }),
    ]);
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'phone');
    expect(itemsInOrder()).toEqual(['Phone']);
  });
});

describe('the recently-added filter', () => {
  const TODAY = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  const fresh = makeExpense({ rowIndex: 3 as ExpenseRow, item: 'Fresh', addedOn: TODAY });
  const older = makeExpense({ rowIndex: 4 as ExpenseRow, item: 'Older', addedOn: daysAgo(30) });
  const legacy = makeExpense({ rowIndex: 5 as ExpenseRow, item: 'Legacy', addedOn: '' });

  const checkbox = () => screen.getByRole('checkbox', { name: 'Recently added' });

  it('is off to begin with, so the list opens showing everything', () => {
    renderList([fresh, older, legacy]);
    expect(checkbox()).not.toBeChecked();
    expect(itemsInOrder()).toHaveLength(3);
  });

  it('narrows to what was added in the last few days', async () => {
    const user = userEvent.setup();
    renderList([fresh, older, legacy]);
    await user.click(checkbox());
    expect(itemsInOrder()).toEqual(['Fresh']);
  });

  it('restores the rest when unticked again', async () => {
    const user = userEvent.setup();
    renderList([fresh, older, legacy]);
    await user.click(checkbox());
    await user.click(checkbox());
    expect(itemsInOrder()).toHaveLength(3);
  });

  it('counts only what it matched', async () => {
    const user = userEvent.setup();
    renderList([fresh, older, legacy]);
    await user.click(checkbox());
    expect(screen.getByText('Showing 1 of 1 expenses')).toBeInTheDocument();
  });

  it('combines with a category rather than replacing it', async () => {
    const user = userEvent.setup();
    const freshCar = makeExpense({
      rowIndex: 6 as ExpenseRow,
      item: 'Tyres',
      category: 'Car',
      addedOn: TODAY,
    });
    renderList([fresh, freshCar, older]);

    await user.click(checkbox());
    await user.click(screen.getByRole('textbox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Car' }));

    expect(itemsInOrder()).toEqual(['Tyres']);
  });

  it('returns to the first page when ticked', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 60 }, (_, i) =>
      makeExpense({
        rowIndex: (i + 3) as ExpenseRow,
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        item: `Item ${i}`,
        addedOn: TODAY,
      }),
    );
    renderList(many);

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(itemsInOrder()).toHaveLength(10);

    await user.click(checkbox());
    expect(itemsInOrder()).toHaveLength(50);
  });

  it('shows an empty list honestly when nothing has been added recently', async () => {
    const user = userEvent.setup();
    renderList([older, legacy]);
    await user.click(checkbox());
    expect(itemsInOrder()).toEqual([]);
    expect(screen.getByText('Showing 0 of 0 expenses')).toBeInTheDocument();
  });
});

// ── The recurring badge ──

describe('the recurring badge', () => {
  it('marks a row this app created from a recurring payment', () => {
    renderList([makeExpense({ item: 'Phone', recurringMarker: 'rec:r1:2026-01' })]);
    expect(screen.getAllByText('Recurring').length).toBeGreaterThan(0);
  });

  it('leaves a hand-entered row unmarked', () => {
    renderList([makeExpense({ item: 'Bread' })]);
    expect(screen.queryByText('Recurring')).toBeNull();
  });

  it('does not mark a row whose marker column holds a stray note', () => {
    // Only the reader decides what counts as provenance; the badge follows a
    // non-empty cell, so this pins that a note reads as a marker to the badge
    // but never to the generator (see recurring.test.ts).
    renderList([makeExpense({ item: 'Bread', recurringMarker: '' })]);
    expect(screen.queryByText('Recurring')).toBeNull();
  });

  it('leaves every action available on a created row, like any other', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList([
      makeExpense({ item: 'Phone', recurringMarker: 'rec:r1:2026-01' }),
    ]);
    expect(screen.getAllByTitle('Duplicate').length).toBeGreaterThan(0);

    await user.click(screen.getAllByTitle('Delete')[0]);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(3));
  });
});

// ── Behaviour that predates this change ──

describe('unchanged behaviour', () => {
  it('still shows the two names from the sheet as the amount columns', () => {
    renderList([makeExpense()]);
    expect(screen.getAllByRole('columnheader', { name: 'Ada' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Bo' }).length).toBeGreaterThan(0);
  });

  it('still paginates at fifty rows', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      makeExpense({ rowIndex: (i + 3) as ExpenseRow, item: `Item ${i}` }),
    );
    renderList(many);
    expect(screen.getByText('Showing 50 of 60 expenses')).toBeInTheDocument();
  });

  it('still opens an inline edit form on the row', async () => {
    const user = userEvent.setup();
    renderList([makeExpense({ item: 'Bread' })]);
    await user.click(screen.getAllByTitle('Edit')[0]);
    expect(firstButton('Save')).toBeInTheDocument();
  });

  it('still asks before deleting, naming what is about to go', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList([makeExpense({ item: 'Bread' })]);
    await user.click(screen.getAllByTitle('Delete')[0]);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Bread/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('still reloads on request', async () => {
    const user = userEvent.setup();
    const { onRefresh } = renderList([makeExpense()]);
    await user.click(firstButton('Refresh'));
    expect(onRefresh).toHaveBeenCalled();
  });
});
