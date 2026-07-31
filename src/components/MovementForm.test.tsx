// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, cleanup, waitFor } from '@testing-library/react';
import { renderWithMantine } from '../test-utils';
import { MovementForm } from './MovementForm';
import type { TransferFormData } from '../types/transfer';
import type { GiftFormData } from '../types/gift';

afterEach(cleanup);

const NAMES = { a: 'Ada', b: 'Bo' };

function renderTransferForm(initial?: TransferFormData) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithMantine(
    <MovementForm<TransferFormData>
      kind="transfer"
      names={NAMES}
      onSubmit={onSubmit}
      initial={initial}
    />,
  );
  return { onSubmit };
}

describe('amount validation', () => {
  it('rejects an empty amount without calling onSubmit', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderTransferForm();

    await user.click(screen.getByRole('button', { name: 'Add Transfer' }));

    expect(await screen.findByText('Amount must be greater than 0')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects zero', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderTransferForm();

    await user.type(screen.getByLabelText('Amount (€)'), '0');
    await user.click(screen.getByRole('button', { name: 'Add Transfer' }));

    expect(await screen.findByText('Amount must be greater than 0')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a positive amount', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderTransferForm();

    await user.type(screen.getByLabelText('Amount (€)'), '25.50');
    await user.click(screen.getByRole('button', { name: 'Add Transfer' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ from: 'A', amount: '25.50' });
  });

  it('clears the error once a valid amount is submitted', async () => {
    const user = userEvent.setup();
    renderTransferForm();

    await user.click(screen.getByRole('button', { name: 'Add Transfer' }));
    expect(await screen.findByText('Amount must be greater than 0')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Amount (€)'), '10');
    await user.click(screen.getByRole('button', { name: 'Add Transfer' }));

    await waitFor(() =>
      expect(screen.queryByText('Amount must be greater than 0')).not.toBeInTheDocument(),
    );
  });
});

describe('direction', () => {
  it('names the receiver as whoever is not sending', () => {
    renderTransferForm();
    expect(screen.getByText(/Receiving:/).textContent).toContain('B');
  });

  it('submits whoever the sender select holds', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderTransferForm({
      date: '2026-03-01',
      from: 'B',
      amount: '40',
      notes: 'n',
    });

    await user.click(screen.getByRole('button', { name: 'Add Transfer' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ from: 'B', amount: '40' });
  });
});

describe('submit failures', () => {
  it('surfaces the error and stays on the form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('Sheets API error: 500'));
    renderWithMantine(
      <MovementForm<TransferFormData> kind="transfer" names={NAMES} onSubmit={onSubmit} />,
    );

    await user.type(screen.getByLabelText('Amount (€)'), '10');
    await user.click(screen.getByRole('button', { name: 'Add Transfer' }));

    expect(await screen.findByText('Sheets API error: 500')).toBeInTheDocument();
  });
});

describe('per-kind copy', () => {
  it('asks who is transferring, and offers Add Transfer', () => {
    renderTransferForm();
    expect(screen.getByRole('textbox', { name: 'Who is transferring?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Transfer' })).toBeInTheDocument();
  });

  it('asks who is giving the gift, and offers Add Gift', () => {
    renderWithMantine(
      <MovementForm<GiftFormData>
        kind="gift"
        names={NAMES}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Who is giving the gift?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Gift' })).toBeInTheDocument();
  });

  it('lets an explicit submitLabel win, as the edit rows rely on', () => {
    renderWithMantine(
      <MovementForm<TransferFormData>
        kind="transfer"
        names={NAMES}
        submitLabel="Save"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});

// ── Gift kind ──
// The choice here decides whether the row moves the balance at all, so it has
// to be present, default safely, and survive an edit.

describe('gift kind', () => {
  const PRESENT = 'A present — money changed hands';
  const FORGIVEN = 'Forgiving debt — no money moved';

  function renderGiftForm(initial?: GiftFormData) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithMantine(
      <MovementForm<GiftFormData>
        kind="gift"
        names={NAMES}
        onSubmit={onSubmit}
        initial={initial}
      />,
    );
    return { onSubmit };
  }

  it('offers the choice on a gift', () => {
    renderGiftForm();
    expect(screen.getByRole('radio', { name: PRESENT })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: FORGIVEN })).toBeInTheDocument();
  });

  it('does not offer it on a transfer', () => {
    renderTransferForm();
    expect(screen.queryByRole('radio', { name: PRESENT })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: FORGIVEN })).not.toBeInTheDocument();
  });

  it('defaults a new gift to a present, so forgiving debt stays deliberate', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderGiftForm();

    expect(screen.getByRole('radio', { name: PRESENT })).toBeChecked();

    await user.type(screen.getByLabelText('Amount (€)'), '30');
    await user.click(screen.getByRole('button', { name: 'Add Gift' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ giftKind: 'present', amount: '30.00' });
  });

  it('submits forgiven once chosen', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderGiftForm();

    await user.click(screen.getByRole('radio', { name: FORGIVEN }));
    await user.type(screen.getByLabelText('Amount (€)'), '40');
    await user.click(screen.getByRole('button', { name: 'Add Gift' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ giftKind: 'forgiven', amount: '40.00' });
  });

  it('opens an existing row on its own kind', () => {
    renderGiftForm({
      date: '2026-03-01',
      from: 'A',
      amount: '40',
      notes: '',
      giftKind: 'forgiven',
    });
    expect(screen.getByRole('radio', { name: FORGIVEN })).toBeChecked();
    expect(screen.getByRole('radio', { name: PRESENT })).not.toBeChecked();
  });

  it('resets to a present after adding, not to whatever was last chosen', async () => {
    const user = userEvent.setup();
    renderGiftForm();

    await user.click(screen.getByRole('radio', { name: FORGIVEN }));
    await user.type(screen.getByLabelText('Amount (€)'), '25');
    await user.click(screen.getByRole('button', { name: 'Add Gift' }));

    await waitFor(() => expect(screen.getByRole('radio', { name: PRESENT })).toBeChecked());
  });
});

describe('reset behaviour', () => {
  it('clears the amount after adding a new record', async () => {
    const user = userEvent.setup();
    renderTransferForm();

    const amount = screen.getByLabelText('Amount (€)');
    await user.type(amount, '15');
    await user.click(screen.getByRole('button', { name: 'Add Transfer' }));

    await waitFor(() => expect(amount).toHaveValue(''));
  });

  it('keeps the values when editing an existing record', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithMantine(
      <MovementForm<TransferFormData>
        kind="transfer"
        names={NAMES}
        submitLabel="Save"
        initial={{ date: '2026-03-01', from: 'A', amount: '40', notes: 'rent' }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByLabelText('Notes')).toHaveValue('rent');
  });
});
