// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, cleanup, waitFor, within } from '@testing-library/react';
import { renderWithMantine } from '../test-utils';
import { MovementList } from './MovementList';
import type { Transfer, TransferFormData, TransferRow } from '../types/transfer';
import type { Gift, GiftFormData, GiftRow } from '../types/gift';

afterEach(cleanup);

/**
 * Deliberately not the defaults: these prove the components render the names
 * they are handed rather than anything baked in.
 */
const NAMES = { a: 'Ada', b: 'Bo' };

function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    rowIndex: 2 as TransferRow,
    date: '2026-01-20',
    amountA: '',
    amountB: '',
    notes: '',
    ...overrides,
  };
}

interface Handlers {
  onUpdate?: (rowIndex: TransferRow, data: TransferFormData) => Promise<void>;
  onDelete?: (rowIndex: TransferRow) => Promise<void>;
  onRefresh?: () => void;
}

function renderTransfers(items: Transfer[], handlers: Handlers = {}) {
  const onUpdate = handlers.onUpdate ?? vi.fn().mockResolvedValue(undefined);
  const onDelete = handlers.onDelete ?? vi.fn().mockResolvedValue(undefined);
  const onRefresh = handlers.onRefresh ?? vi.fn();
  renderWithMantine(
    <MovementList<Transfer, TransferRow, TransferFormData>
      kind="transfer"
      names={NAMES}
      items={items}
      loading={false}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onRefresh={onRefresh}
    />,
  );
  return { onUpdate, onDelete, onRefresh };
}

// ── Direction rendering ──

describe('direction', () => {
  it('reads Ada → Bo from the first amount column', () => {
    renderTransfers([makeTransfer({ amountA: '€50.00' })]);
    expect(screen.getByText('Ada → Bo')).toBeInTheDocument();
    expect(screen.getByText('€50.00')).toBeInTheDocument();
  });

  it('reads Bo → Ada from the second amount column', () => {
    renderTransfers([makeTransfer({ amountB: '€25.00' })]);
    expect(screen.getByText('Bo → Ada')).toBeInTheDocument();
    expect(screen.getByText('€25.00')).toBeInTheDocument();
  });
});

// ── The both-columns-filled warning (H1) ──

describe('ambiguous rows', () => {
  const ambiguous = makeTransfer({ amountA: '€100.00', amountB: '€40.00' });

  it('flags the row so the hidden amount is discoverable', () => {
    renderTransfers([ambiguous]);
    expect(
      screen.getByLabelText('Ambiguous direction — this row has amounts in both columns'),
    ).toBeInTheDocument();
  });

  it('does not flag a well-formed row', () => {
    renderTransfers([makeTransfer({ amountA: '€100.00' })]);
    expect(
      screen.queryByLabelText('Ambiguous direction — this row has amounts in both columns'),
    ).not.toBeInTheDocument();
  });

  it('warns which amount a save would clear, naming both values', async () => {
    const user = userEvent.setup();
    renderTransfers([ambiguous]);

    await user.click(screen.getByTitle('Edit'));

    const warning = screen.getByText(/direction is ambiguous/i);
    expect(warning).toBeInTheDocument();
    expect(warning.textContent).toContain('€100.00');
    expect(warning.textContent).toContain('€40.00');
  });

  it('shows no warning when editing a well-formed row', async () => {
    const user = userEvent.setup();
    renderTransfers([makeTransfer({ amountA: '€100.00' })]);

    await user.click(screen.getByTitle('Edit'));

    expect(screen.queryByText(/direction is ambiguous/i)).not.toBeInTheDocument();
  });
});

// ── Editing ──

describe('editing a row', () => {
  it('passes the row index and edited data to onUpdate', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderTransfers([makeTransfer({ rowIndex: 7 as TransferRow, amountA: '€50.00' })], {
      onUpdate,
    });

    await user.click(screen.getByTitle('Edit'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const [rowIndex, data] = onUpdate.mock.calls[0];
    expect(rowIndex).toBe(7);
    expect(data).toMatchObject({ from: 'A', amount: '50.00', date: '2026-01-20' });
  });

  it('closes the editor on cancel without calling onUpdate', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderTransfers([makeTransfer({ amountA: '€50.00' })], { onUpdate });

    await user.click(screen.getByTitle('Edit'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Ada → Bo')).toBeInTheDocument();
  });
});

// ── Deleting ──

describe('deleting a row', () => {
  it('confirms first, then deletes the row that was clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderTransfers(
      [
        makeTransfer({ rowIndex: 2 as TransferRow, amountA: '€10.00' }),
        makeTransfer({ rowIndex: 3 as TransferRow, amountA: '€20.00' }),
      ],
      { onDelete },
    );

    // Rows render newest-first, so the second delete icon is row 2.
    await user.click(screen.getAllByTitle('Delete')[1]);
    expect(onDelete).not.toHaveBeenCalled();

    // Scoped to the dialog: the row icon carries the same accessible name.
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(2));
  });

  it('does not delete when the confirmation is dismissed', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderTransfers([makeTransfer({ amountA: '€10.00' })], { onDelete });

    await user.click(screen.getByTitle('Delete'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  // Regression test for the silent-failure fix: this list used to swallow the
  // rejection in a try/finally with no catch.
  it('surfaces a failed delete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockRejectedValue(new Error('Sheets API error: 503'));
    renderTransfers([makeTransfer({ amountA: '€10.00' })], { onDelete });

    await user.click(screen.getByTitle('Delete'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Sheets API error: 503')).toBeInTheDocument();
  });

  it('falls back to a generic message when the failure is not an Error', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockRejectedValue('nope');
    renderTransfers([makeTransfer({ amountA: '€10.00' })], { onDelete });

    await user.click(screen.getByTitle('Delete'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Failed to delete transfer')).toBeInTheDocument();
  });
});

// ── Search ──

describe('search', () => {
  const items = [
    makeTransfer({ rowIndex: 2 as TransferRow, amountA: '€10.00', notes: 'rent' }),
    makeTransfer({
      rowIndex: 3 as TransferRow,
      date: '2025-06-01',
      amountB: '€20.00',
      notes: 'holiday',
    }),
  ];

  it('filters by notes', async () => {
    const user = userEvent.setup();
    renderTransfers(items);

    await user.type(screen.getByPlaceholderText('Search transfers...'), 'holiday');

    expect(screen.getByText('Bo → Ada')).toBeInTheDocument();
    expect(screen.queryByText('Ada → Bo')).not.toBeInTheDocument();
  });

  it('filters by sender', async () => {
    const user = userEvent.setup();
    renderTransfers(items);

    await user.type(screen.getByPlaceholderText('Search transfers...'), 'ada');

    // Both match: one is from Ada, the other is *to* Ada.
    expect(screen.getByText('Ada → Bo')).toBeInTheDocument();
    expect(screen.getByText('Bo → Ada')).toBeInTheDocument();
  });

  it('filters by date', async () => {
    const user = userEvent.setup();
    renderTransfers(items);

    await user.type(screen.getByPlaceholderText('Search transfers...'), '2025-06');

    expect(screen.getByText('Bo → Ada')).toBeInTheDocument();
    expect(screen.queryByText('Ada → Bo')).not.toBeInTheDocument();
  });

  it('reports how many rows are showing', () => {
    renderTransfers(items);
    expect(screen.getByText('Showing 2 of 2 transfers')).toBeInTheDocument();
  });
});

// ── Per-kind copy ──
// The two lists are one component now; these pin the strings that differ so a
// gift screen cannot silently start calling itself a transfer.

function makeGift(overrides: Partial<Gift> = {}): Gift {
  return {
    rowIndex: 2 as GiftRow,
    date: '2026-01-20',
    amountA: '€50.00',
    amountB: '',
    notes: '',
    giftKind: 'forgiven',
    ...overrides,
  };
}

function renderGifts(items: Gift[] = [makeGift()]) {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  renderWithMantine(
    <MovementList<Gift, GiftRow, GiftFormData>
      kind="gift"
      names={NAMES}
      items={items}
      loading={false}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onRefresh={vi.fn()}
    />,
  );
  return { onUpdate, onDelete };
}

describe('gift copy', () => {
  it('labels the column, search box and count as gifts', () => {
    renderGifts();
    expect(screen.getByPlaceholderText('Search gifts...')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 gifts')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Gift' })).toBeInTheDocument();
  });

  it('titles the delete confirmation as a gift', async () => {
    const user = userEvent.setup();
    renderGifts();

    await user.click(screen.getByTitle('Delete'));

    expect(await screen.findByText('Delete gift?')).toBeInTheDocument();
  });
});

// ── Gift kind ──
// A present and a forgiven row are the same shape and do opposite things to
// the balance, so the badge is the only thing telling them apart on screen.

describe('gift kind', () => {
  it('badges a forgiven row', () => {
    renderGifts([makeGift({ giftKind: 'forgiven' })]);
    expect(screen.getByText('Forgiven')).toBeInTheDocument();
    expect(screen.queryByText('Present')).not.toBeInTheDocument();
  });

  it('badges a present', () => {
    renderGifts([makeGift({ giftKind: 'present' })]);
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.queryByText('Forgiven')).not.toBeInTheDocument();
  });

  it('leaves transfers unbadged', () => {
    renderTransfers([makeTransfer({ amountA: '€50.00' })]);
    expect(screen.queryByText('Present')).not.toBeInTheDocument();
    expect(screen.queryByText('Forgiven')).not.toBeInTheDocument();
  });

  it('filters by kind', async () => {
    const user = userEvent.setup();
    renderGifts([
      makeGift({ rowIndex: 2 as GiftRow, amountA: '€50.00', giftKind: 'forgiven' }),
      makeGift({ rowIndex: 3 as GiftRow, amountB: '€80.00', giftKind: 'present' }),
    ]);

    await user.type(screen.getByPlaceholderText('Search gifts...'), 'forgiven');

    expect(await screen.findByText('Showing 1 of 1 gifts')).toBeInTheDocument();
    expect(screen.getByText('€50.00')).toBeInTheDocument();
    expect(screen.queryByText('€80.00')).not.toBeInTheDocument();
  });

  it('warns that deleting a forgiven row puts the debt back', async () => {
    const user = userEvent.setup();
    renderGifts([makeGift({ amountA: '€50.00', giftKind: 'forgiven' })]);

    await user.click(screen.getByTitle('Delete'));

    expect(await screen.findByText(/puts €50\.00 back onto what Bo owes/)).toBeInTheDocument();
  });

  it('does not warn when deleting a present', async () => {
    const user = userEvent.setup();
    renderGifts([makeGift({ amountA: '€50.00', giftKind: 'present' })]);

    await user.click(screen.getByTitle('Delete'));

    expect(await screen.findByText('Delete gift?')).toBeInTheDocument();
    expect(screen.queryByText(/puts .* back onto what/)).not.toBeInTheDocument();
  });

  it('keeps the kind when the row is edited', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderGifts([makeGift({ amountA: '€50.00', giftKind: 'present' })]);

    await user.click(screen.getByTitle('Edit'));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][1]).toMatchObject({ giftKind: 'present' });
  });
});

describe('empty state', () => {
  it('renders the header row and a zero count', () => {
    renderTransfers([]);
    expect(screen.getByText('Showing 0 of 0 transfers')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Transfer' })).toBeInTheDocument();
  });
});
