// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '../test-utils';
import { RecurringPrompt } from './RecurringPrompt';
import type { PendingExpense } from '../services/recurring';

const NAMES = { a: 'Ada', b: 'Bo' };

function makePending(overrides: Partial<PendingExpense> = {}): PendingExpense {
  const month = overrides.month ?? '2026-02';
  return {
    ruleId: 'r1',
    month,
    marker: `rec:r1:${month}`,
    date: `${month}-10`,
    amountA: '€12.99',
    amountB: '',
    item: 'Phone',
    category: 'Various',
    notes: '',
    ...overrides,
  };
}

function renderPrompt(pending: PendingExpense[]) {
  const onConfirm = vi.fn<(rows: PendingExpense[]) => Promise<void>>(async () => {});
  const onDismiss = vi.fn();
  renderWithMantine(
    <RecurringPrompt
      opened
      names={NAMES}
      pending={pending}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />,
  );
  return { onConfirm, onDismiss };
}

afterEach(cleanup);

describe('RecurringPrompt', () => {
  const feb = makePending({ month: '2026-02' });
  const mar = makePending({ month: '2026-03' });

  it('lists every month that is due before anything is written', () => {
    renderPrompt([feb, mar]);
    expect(screen.getByText('2026-02-10')).toBeInTheDocument();
    expect(screen.getByText('2026-03-10')).toBeInTheDocument();
  });

  it('names the amount columns from the sheet rather than knowing them itself', () => {
    renderPrompt([feb]);
    expect(screen.getByRole('columnheader', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bo' })).toBeInTheDocument();
  });

  it('writes the months the user confirmed', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb, mar]);
    await user.click(screen.getByRole('button', { name: 'Add 2 expenses' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0].map((p) => p.month)).toEqual(['2026-02', '2026-03']);
  });

  it('leaves out a month the user unticked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb, mar]);
    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-02-10' }));
    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0].map((p) => p.month)).toEqual(['2026-03']);
  });

  // Skipping must record nothing at all. If it wrote a marker, "not this month"
  // would quietly become "never", with no way back short of editing the sheet.
  it('records nothing for a skipped month, so it can be offered again', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb, mar]);
    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-02-10' }));
    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    const markers = onConfirm.mock.calls[0]![0].map((p) => p.marker);
    expect(markers).not.toContain('rec:r1:2026-02');
  });

  // The price-change case. A rule holds one amount and no history, so months
  // missed while the app was closed would otherwise be written at today's price.
  it('writes the amount the user corrected, not the one the rule carries', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb]);

    const input = screen.getByRole('textbox', { name: 'Ada for Phone on 2026-02-10' });
    await user.clear(input);
    await user.type(input, '15');

    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]!.amountA).toBe('€15.00');
  });

  it('leaves an untouched amount exactly as the rule had it', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb]);
    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]).toMatchObject({ amountA: '€12.99', amountB: '' });
  });

  it('writes nothing when the user says later', async () => {
    const user = userEvent.setup();
    const { onConfirm, onDismiss } = renderPrompt([feb]);
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('will not write an empty list once everything has been unticked', async () => {
    const user = userEvent.setup();
    renderPrompt([feb]);
    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-02-10' }));
    expect(screen.getByRole('button', { name: /^Add 0 expenses$/ })).toBeDisabled();
  });

  it('shows a failed write rather than closing as though it had worked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => {
      throw new Error('Backend error');
    });
    const onDismiss = vi.fn();
    renderWithMantine(
      <RecurringPrompt
        opened
        names={NAMES}
        pending={[feb]}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));
    await waitFor(() => expect(screen.getByText('Backend error')).toBeInTheDocument());
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('says plainly that an unticked month is not recorded either', () => {
    renderPrompt([feb]);
    expect(
      within(screen.getByRole('dialog')).getByText(/offered\s+again next time/i),
    ).toBeInTheDocument();
  });
});
