// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '../test-utils';
import { RecurringList } from './RecurringList';
import type { RecurringRule, RecurringRow, RecurringFormData } from '../types/recurring';

const NAMES = { a: 'Ada', b: 'Bo' };

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    rowIndex: 2 as RecurringRow,
    id: 'r1',
    start: '2026-01-10',
    amountA: '€12.99',
    amountB: '',
    item: 'Phone',
    category: 'Various',
    notes: '',
    day: 10,
    ...overrides,
  };
}

interface Options {
  tabMissing?: boolean;
  dueCount?: number;
}

function renderList(rules: RecurringRule[], { tabMissing = false, dueCount = 0 }: Options = {}) {
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
      dueCount={dueCount}
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
        dueCount={0}
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

  it('says so when there is nothing set up yet', () => {
    renderList([]);
    expect(screen.getByText(/No recurring payments yet/)).toBeInTheDocument();
  });

  it('offers to add the months that are waiting', async () => {
    const user = userEvent.setup();
    const { onGenerate } = renderList([makeRule()], { dueCount: 3 });
    expect(screen.getByText('3 payments are waiting to be added')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add 3 due' }));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('says plainly when everything is up to date', () => {
    renderList([makeRule()], { dueCount: 0 });
    expect(screen.getByText('Every payment up to this month has been added')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add \d+ due/ })).toBeNull();
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
        dueCount={0}
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
