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
    amountVaries: false,
    notCountedA: '',
    notCountedB: '',
    item: 'Phone',
    category: 'Various',
    notes: '',
    ...overrides,
  };
}

function renderPrompt(pending: PendingExpense[]) {
  const onConfirm = vi.fn<(rows: PendingExpense[]) => Promise<void>>(async () => {});
  const onDismiss = vi.fn<(signature?: string) => void>();
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
    expect(screen.getByRole('textbox', { name: 'Date for Phone in 2026-02' })).toHaveValue(
      '2026-02-10',
    );
    expect(screen.getByRole('textbox', { name: 'Date for Phone in 2026-03' })).toHaveValue(
      '2026-03-10',
    );
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

  it('leaves out the last month when the user unticks it', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb, mar]);
    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-03' }));
    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0].map((p) => p.month)).toEqual(['2026-02']);
  });

  // The bug this shape exists to prevent. Generation resumes from the last month
  // written, so writing March while skipping February would mean February is
  // never offered again — a month of real spending gone, silently, from the only
  // ledger the two of them have.
  it('will not let a month be skipped while a later one is written', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb, mar]);

    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-02' }));

    // March came off with it, so no hole can be left behind.
    expect(screen.getByRole('checkbox', { name: 'Add Phone for 2026-03' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /^Add 0 expenses$/ })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('brings the earlier months back when a later one is ticked again', async () => {
    const user = userEvent.setup();
    renderPrompt([feb, mar]);

    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-02' }));
    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-03' }));

    expect(screen.getByRole('checkbox', { name: 'Add Phone for 2026-02' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Add 2 expenses' })).toBeEnabled();
  });

  it('stops one payment without touching another', async () => {
    const user = userEvent.setup();
    const gym = makePending({ ruleId: 'r2', month: '2026-03', item: 'Gym' });
    const { onConfirm } = renderPrompt([feb, mar, gym]);

    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-02' }));
    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0].map((p) => p.item)).toEqual(['Gym']);
  });

  it('records nothing for a skipped month, so it can be offered again', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb, mar]);
    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-03' }));
    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    const markers = onConfirm.mock.calls[0]![0].map((p) => p.marker);
    expect(markers).not.toContain('rec:r1:2026-03');
  });

  // Without this the modal reopens the instant the user presses Add: the set it
  // was holding is stale by then, because writing reloads the expenses and
  // recomputes what is pending.
  it('stops asking about exactly what was left behind, not what it opened with', async () => {
    const user = userEvent.setup();
    const { onConfirm, onDismiss } = renderPrompt([feb, mar]);
    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-03' }));
    await user.click(screen.getByRole('button', { name: 'Add 1 expense' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onDismiss).toHaveBeenCalledWith('rec:r1:2026-03');
  });

  it('asks the hook to use its own idea of what is pending when merely closed', async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderPrompt([feb]);
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(onDismiss).toHaveBeenCalledWith();
  });

  // The price-change case. A rule holds one amount and no history, so months
  // missed while the app was closed would otherwise be written at today's price.
  it('writes the amount the user corrected, not the one the rule carries', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb]);

    const input = screen.getByRole('textbox', { name: 'Ada for Phone in 2026-02' });
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
    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-02' }));
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

  it('says plainly that unticking leaves the later months too', () => {
    renderPrompt([feb]);
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/every later month of that payment/i)).toBeInTheDocument();
    expect(dialog.getByText(/offered again/i)).toBeInTheDocument();
  });
});

// ── A corrected amount and the slice set aside against it ──
//
// The rule carries a not-counted figure; correcting the amount here can leave
// that figure larger than the whole. calculateBalance would clamp it, so the
// month would settle as fully personal with nothing on screen to say why —
// which is exactly what both forms refuse.

describe('when a correction strands what the rule sets aside', () => {
  const withSlice = makePending({ month: '2026-02', amountA: '€30.00', notCountedA: '€12.00' });

  it('shows what the payment sets aside, so the figure is not invisible', () => {
    renderPrompt([withSlice]);
    expect(screen.getByText(/not counted: €12.00/)).toBeInTheDocument();
  });

  it('refuses a correction that leaves more set aside than was paid', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([withSlice]);

    const input = screen.getByRole('textbox', { name: 'Ada for Phone in 2026-02' });
    await user.clear(input);
    await user.type(input, '8');

    expect(
      await screen.findByText(/Not counted cannot be more than what Ada paid/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add 1 expense$/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('accepts a correction that still leaves room for it', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([withSlice]);

    const input = screen.getByRole('textbox', { name: 'Ada for Phone in 2026-02' });
    await user.clear(input);
    await user.type(input, '20');
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]).toMatchObject({
      amountA: '€20.00',
      notCountedA: '€12.00',
    });
  });
});

// ── Bills nobody can price in advance ──
//
// The rule deliberately holds no amount, so this dialog is the only moment the
// app can learn it. Writing a zero row would be worse than writing nothing: it
// settles as though the bill were free, on the only record either of them has.

describe('a payment whose amount varies', () => {
  const water = makePending({
    month: '2026-02',
    item: 'Water',
    amountA: '',
    amountB: '',
    amountVaries: true,
  });

  it('says why the amount is empty', () => {
    renderPrompt([water]);
    expect(screen.getByText('amount differs every time')).toBeInTheDocument();
  });

  it('refuses to write it until someone types the figure', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([water]);

    expect(screen.getByRole('button', { name: /^Add 1 expense$/ })).toBeDisabled();
    expect(screen.getByText(/needs its amount/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('writes it once the figure is in', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([water]);

    await user.type(screen.getByRole('textbox', { name: 'Ada for Water in 2026-02' }), '82.4');
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]).toMatchObject({ amountA: '€82.40', item: 'Water' });
  });

  it('accepts a figure against either person', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([water]);
    await user.type(screen.getByRole('textbox', { name: 'Bo for Water in 2026-02' }), '50');
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]).toMatchObject({ amountB: '€50.00' });
  });

  it('lets the rest through when the unpriced one is left for next time', async () => {
    const user = userEvent.setup();
    const phone = makePending({ month: '2026-01', item: 'Phone' });
    const { onConfirm } = renderPrompt([phone, water]);

    await user.click(screen.getByRole('checkbox', { name: 'Add Water for 2026-02' }));
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0].map((p) => p.item)).toEqual(['Phone']);
  });

  it('leaves a payment with a known amount alone', () => {
    renderPrompt([makePending({ month: '2026-01' })]);
    expect(screen.getByRole('button', { name: /^Add 1 expense$/ })).toBeEnabled();
    expect(screen.queryByText(/needs its amount/)).toBeNull();
  });
});

describe('a varying bill typed as zero', () => {
  it('is treated as no figure at all, rather than as a free bill', async () => {
    // A €0 row settles as though the bill had been free — the thing the guard
    // exists to prevent — so an explicit zero must not slip past it.
    const user = userEvent.setup();
    const water = makePending({ month: '2026-02', item: 'Water', amountA: '', amountVaries: true });
    const { onConfirm } = renderPrompt([water]);

    await user.type(screen.getByRole('textbox', { name: 'Ada for Water in 2026-02' }), '0');

    expect(screen.getByRole('button', { name: /^Add 1 expense$/ })).toBeDisabled();
    expect(screen.getByText(/needs its amount/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ── The day a bill actually landed ──
//
// A monthly bill arrives on the 15th one month and the 18th the next. This is
// the moment it is in front of you, so it is the moment to say so — rather than
// adding the row and going to find it again in the list afterwards.

describe('correcting the date', () => {
  const feb = makePending({ month: '2026-02' });

  /** Replace the whole field rather than appending to it. */
  async function retype(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
    await user.click(screen.getByRole('textbox', { name: label }));
    await user.keyboard(`{Control>}a{/Control}${value}`);
  }

  it('writes the day the bill actually landed', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb]);

    await retype(user, 'Date for Phone in 2026-02', '2026-02-18');
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]).toMatchObject({ date: '2026-02-18' });
  });

  // jsdom has no layout, so it cannot see the value being clipped — this pins
  // the column width instead, which is the thing that was wrong. The date is
  // the field the user is being asked to check, and it was showing "2026-08-0".
  it('gives the date column room for a whole date', () => {
    renderPrompt([feb]);
    const header = screen.getByRole('columnheader', { name: 'Date' });
    const width = Number((header.getAttribute('style') ?? '').replace(/\D/g, ''));
    expect(width).toBeGreaterThanOrEqual(150);
  });

  it('leaves the date alone when it is not touched', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb]);
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]).toMatchObject({ date: '2026-02-10' });
  });

  it('takes the last day of the month', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb]);
    await retype(user, 'Date for Phone in 2026-02', '2026-02-28');
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]).toMatchObject({ date: '2026-02-28' });
  });

  // Says why rather than quietly correcting it. Handing the picker min/max
  // makes it clamp in silence — the field still reads the date typed while a
  // different one is written.
  it('refuses a date outside the month the payment covers', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb]);

    await retype(user, 'Date for Phone in 2026-02', '2026-03-05');

    expect(await screen.findByText(/has to stay in 2026-02/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add 1 expense$/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // The row's handle is what it is and which month it covers, both fixed. The
  // message names the date as it stands now — saying "on 2026-02-10" while the
  // row reads 2026-02-18 points at the wrong row when several months of the
  // same bill are listed.
  it('names the corrected date when it says what is wrong', async () => {
    const user = userEvent.setup();
    const water = makePending({ month: '2026-02', item: 'Water', amountA: '', amountVaries: true });
    renderPrompt([water]);

    expect(await screen.findByText(/Water on 2026-02-10 needs its amount/)).toBeInTheDocument();

    await retype(user, 'Date for Water in 2026-02', '2026-02-18');

    expect(await screen.findByText(/Water on 2026-02-18 needs its amount/)).toBeInTheDocument();
  });

  it('keeps the same handle on a row whose date has been changed', async () => {
    const user = userEvent.setup();
    renderPrompt([feb]);
    await retype(user, 'Date for Phone in 2026-02', '2026-02-18');
    // Still reachable by the month it covers, which is what does not move.
    expect(screen.getByRole('textbox', { name: 'Date for Phone in 2026-02' })).toHaveValue(
      '2026-02-18',
    );
  });

  it('lets the date be put back and written', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPrompt([feb]);

    await retype(user, 'Date for Phone in 2026-02', '2026-03-05');
    await retype(user, 'Date for Phone in 2026-02', '2026-02-20');

    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0][0]).toMatchObject({ date: '2026-02-20' });
  });

  it('ignores the date of a month left for next time', async () => {
    const user = userEvent.setup();
    const mar = makePending({ month: '2026-03' });
    const { onConfirm } = renderPrompt([feb, mar]);

    await user.click(screen.getByRole('checkbox', { name: 'Add Phone for 2026-03' }));
    await retype(user, 'Date for Phone in 2026-03', '2026-05-01');

    await user.click(screen.getByRole('button', { name: /^Add 1 expense$/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0]![0].map((p) => p.month)).toEqual(['2026-02']);
  });
});
