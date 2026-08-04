// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '../test-utils';
import { RecurringList } from './RecurringList';
import type { RecurringRule, RecurringRow, RecurringFormData } from '../types/recurring';
import type { PendingExpense } from '../services/recurring';

const NAMES = { a: 'Ada', b: 'Bo' };

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

interface Options {
  tabMissing?: boolean;
  /** Months waiting, as the page would hand them over. */
  pending?: PendingExpense[];
}

/** N months waiting for the default rule, oldest first. */
function duePending(n: number, ruleId = 'r1'): PendingExpense[] {
  return Array.from({ length: n }, (_, i) => {
    const month = `2026-${String(i + 1).padStart(2, '0')}`;
    return {
      ruleId,
      month,
      marker: `rec:${ruleId}:${month}`,
      date: `${month}-10`,
      amountA: '€12.99',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      item: 'Phone',
      category: 'Various' as const,
      notes: '',
      amountVaries: false,
    };
  });
}

function renderList(rules: RecurringRule[], { tabMissing = false, pending = [] }: Options = {}) {
  const handlers = {
    onUpdate: vi.fn<(rowIndex: RecurringRow, data: RecurringFormData, id: string) => Promise<void>>(
      async () => {},
    ),
    onDelete: vi.fn(async () => {}),
    onAssignId: vi.fn(async () => {}),
    onSetUp: vi.fn(async () => {}),
    onGenerate: vi.fn(),
    onRefresh: vi.fn(),
  };
  renderWithMantine(
    <RecurringList
      names={NAMES}
      rules={rules}
      loading={false}
      tabMissing={tabMissing}
      pending={pending}
      {...handlers}
    />,
  );
  return handlers;
}

afterEach(cleanup);

// ── Setting the feature up ──
//
// Every sheet in use predates this tab. Reading a tab that is not there answers
// 400, which without this empty state is a red banner on an app that is working
// perfectly well.

describe('when the tab does not exist yet', () => {
  it('explains what will be created rather than showing an error', () => {
    renderList([], { tabMissing: true });
    expect(screen.getByRole('button', { name: 'Create the Recurring tab' })).toBeInTheDocument();
  });

  it('writes nothing to the spreadsheet until the button is pressed', async () => {
    const user = userEvent.setup();
    const { onSetUp } = renderList([], { tabMissing: true });
    expect(onSetUp).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Create the Recurring tab' }));
    await waitFor(() => expect(onSetUp).toHaveBeenCalled());
  });

  it('surfaces a failure to create it instead of failing silently', async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <RecurringList
        names={NAMES}
        rules={[]}
        loading={false}
        tabMissing
        pending={[]}
        onUpdate={vi.fn(async () => {})}
        onDelete={vi.fn(async () => {})}
        onAssignId={vi.fn(async () => {})}
        onSetUp={vi.fn(async () => {
          throw new Error('Permission denied');
        })}
        onGenerate={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Create the Recurring tab' }));
    await waitFor(() => expect(screen.getByText('Permission denied')).toBeInTheDocument());
  });
});

// ── The list ──

describe('listing the rules', () => {
  it('labels the amount columns with the names from the sheet', () => {
    renderList([makeRule()]);
    expect(screen.getByRole('columnheader', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bo' })).toBeInTheDocument();
  });

  it('shows a rule with its day, item and amount', () => {
    renderList([makeRule()]);
    expect(screen.getByRole('cell', { name: 'Phone' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '€12.99' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '10' })).toBeInTheDocument();
  });

  it('says how often each payment comes round', () => {
    renderList([
      makeRule({ rowIndex: 2 as RecurringRow, id: 'r1', item: 'Phone', everyMonths: 1 }),
      makeRule({ rowIndex: 3 as RecurringRow, id: 'r2', item: 'Water', everyMonths: 2 }),
      makeRule({ rowIndex: 4 as RecurringRow, id: 'r3', item: 'Tax', everyMonths: 12 }),
    ]);
    expect(screen.getByRole('cell', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Every 2 months' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Yearly' })).toBeInTheDocument();
  });

  it('marks a payment the app cannot price in advance', () => {
    renderList([makeRule({ item: 'Water', amountVaries: true })]);
    expect(screen.getByText('Amount varies')).toBeInTheDocument();
  });

  it('leaves a payment with a known amount unmarked', () => {
    renderList([makeRule({ item: 'Phone' })]);
    expect(screen.queryByText('Amount varies')).toBeNull();
  });

  it('says so when there is nothing set up yet', () => {
    renderList([]);
    expect(screen.getByText(/No recurring payments yet/)).toBeInTheDocument();
  });

  it('offers to add the months that are waiting', async () => {
    const user = userEvent.setup();
    const { onGenerate } = renderList([makeRule()], { pending: duePending(3) });
    expect(screen.getByText('3 payments are waiting to be added')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add 3 due' }));
    expect(onGenerate).toHaveBeenCalled();
  });

  // "Everything has been added" is only true when something has. A payment that
  // falls on the 25th, set up on the 3rd, has created nothing and is not due to
  // — and saying otherwise reads as a bug, because the expense the user goes
  // looking for is not there while the app claims it should be.
  it('says nothing is due yet, and when it will be, rather than claiming it was added', () => {
    renderList([makeRule({ day: 25, start: '2026-01-10' })], { pending: [] });
    expect(
      screen.getByText(/Nothing is due yet — the next expense is created on/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/has been added/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Add \d+ due/ })).toBeNull();
  });

  it('names the soonest date across several payments', () => {
    renderList(
      [
        makeRule({ rowIndex: 2 as RecurringRow, id: 'r1', day: 25, start: '2026-01-10' }),
        makeRule({ rowIndex: 3 as RecurringRow, id: 'r2', day: 5, start: '2026-01-10' }),
      ],
      { pending: [] },
    );
    // Whichever comes first, not whichever is listed first.
    const line = screen.getByText(/the next expense is created on/).textContent ?? '';
    const shown = line.slice(line.lastIndexOf(' ') + 1);
    const others = screen.getAllByRole('cell').map((c) => c.textContent ?? '');
    expect(others).toContain(shown);
  });

  it('says nothing at all when there are no payments to report on', () => {
    renderList([], { pending: [] });
    expect(screen.queryByText(/Nothing is due yet/)).toBeNull();
  });
});

// ── Rules added by hand ──

describe('a rule with no id', () => {
  it('is flagged rather than silently ignored', () => {
    renderList([makeRule({ id: '' })]);
    expect(screen.getByText('No id')).toBeInTheDocument();
    expect(screen.getByText(/could not be traced back/)).toBeInTheDocument();
  });

  it('can be given one', async () => {
    const user = userEvent.setup();
    const { onAssignId } = renderList([makeRule({ id: '' })]);
    await user.click(screen.getByRole('button', { name: /Give .*Phone.* an id/ }));
    expect(onAssignId).toHaveBeenCalledWith(2);
  });

  it('surfaces a failed id assignment instead of swallowing it', async () => {
    // Every other mutation on this screen routes its failure into the alert;
    // this one fired a promise nobody awaited, so a failure was invisible.
    const user = userEvent.setup();
    renderWithMantine(
      <RecurringList
        names={NAMES}
        rules={[makeRule({ id: '' })]}
        loading={false}
        tabMissing={false}
        pending={[]}
        onUpdate={vi.fn(async () => {})}
        onDelete={vi.fn(async () => {})}
        onAssignId={vi.fn(async () => {
          throw new Error('Backend error');
        })}
        onSetUp={vi.fn(async () => {})}
        onGenerate={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Give .*Phone.* an id/ }));
    await waitFor(() => expect(screen.getByText('Backend error')).toBeInTheDocument());
  });

  it('shows no next due date, because nothing will be created from it', () => {
    renderList([makeRule({ id: '' })]);
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument();
  });
});

// ── Editing and deleting ──

describe('changing a rule', () => {
  it('edits in place and keeps the rule’s identity', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderList([makeRule()]);
    await user.click(screen.getByTitle('Edit'));

    const amount = screen.getByRole('textbox', { name: 'Ada (€)' });
    await user.clear(amount);
    await user.type(amount, '15');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0]![0]).toBe(2);
    expect(onUpdate.mock.calls[0]![1]).toMatchObject({ amountA: '15.00' });
    // The id is passed straight back through: regenerating it would orphan
    // every expense the rule has already created.
    expect(onUpdate.mock.calls[0]![2]).toBe('r1');
  });

  it('says that a change only affects future months', async () => {
    const user = userEvent.setup();
    renderList([makeRule()]);
    await user.click(screen.getByTitle('Edit'));
    expect(screen.getByText(/only affects future months/)).toBeInTheDocument();
    expect(
      screen.getByText(/record what was actually paid and stay as they are/),
    ).toBeInTheDocument();
  });

  it('warns that deleting keeps the expenses already created', async () => {
    const user = userEvent.setup();
    renderList([makeRule()]);
    await user.click(screen.getByTitle('Delete'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/are kept/)).toBeInTheDocument();
    expect(within(dialog).getByText(/that money was really spent/i)).toBeInTheDocument();
  });

  it('deletes only after that warning is confirmed', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderList([makeRule()]);
    await user.click(screen.getByTitle('Delete'));

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByTitle('Delete'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(2));
  });

  it('surfaces a failed delete rather than looking as though it worked', async () => {
    const user = userEvent.setup();
    renderWithMantine(
      <RecurringList
        names={NAMES}
        rules={[makeRule()]}
        loading={false}
        tabMissing={false}
        pending={[]}
        onUpdate={vi.fn(async () => {})}
        onDelete={vi.fn(async () => {
          throw new Error('Backend error');
        })}
        onAssignId={vi.fn(async () => {})}
        onSetUp={vi.fn(async () => {})}
        onGenerate={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );
    await user.click(screen.getByTitle('Delete'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByText('Backend error')).toBeInTheDocument());
  });
});
