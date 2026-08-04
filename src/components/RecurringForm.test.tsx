// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '../test-utils';
import { RecurringForm } from './RecurringForm';
import type { RecurringFormData } from '../types/recurring';

const NAMES = { a: 'Ada', b: 'Bo' };

function renderForm(initial?: RecurringFormData) {
  const onSubmit = vi.fn<(data: RecurringFormData) => Promise<void>>(async () => {});
  renderWithMantine(<RecurringForm names={NAMES} onSubmit={onSubmit} initial={initial} />);
  return { onSubmit };
}

const submit = () => screen.getByRole('button', { name: /Add Recurring Payment|Save/ });

afterEach(cleanup);

describe('RecurringForm', () => {
  it('labels the amount fields with the names from the sheet', () => {
    renderForm();
    expect(screen.getByRole('textbox', { name: 'Ada (€)' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bo (€)' })).toBeInTheDocument();
  });

  it('will not submit without an item, so no rule lands on the sheet unnamed', async () => {
    // The field is marked required, so the browser refuses before the form's
    // own check is reached — the check stays as cover for anything that submits
    // the form without going through the control.
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');
    await user.click(submit());
    expect(screen.getByRole('textbox', { name: 'Item' })).toBeRequired();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('requires an amount, since a rule with none would create empty expenses', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Phone');
    await user.click(submit());
    expect(await screen.findByText('At least one amount is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('will not accept a day that is not a day of the month', async () => {
    // No month has a 45th, and a rule carrying one would never fall due.
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Phone');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');

    const day = screen.getByRole('textbox', { name: /Day of the month/ });
    await user.click(day);
    await user.keyboard('{Control>}a{/Control}45');

    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());

    const { day: submitted } = onSubmit.mock.calls[0]![0];
    expect(submitted).toBeGreaterThanOrEqual(1);
    expect(submitted).toBeLessThanOrEqual(31);
  });

  it('accepts the 31st, which the generator clamps per month rather than skipping', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Rent');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '500');

    const day = screen.getByRole('textbox', { name: /Day of the month/ });
    await user.click(day);
    await user.keyboard('{Control>}a{/Control}31');

    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].day).toBe(31);
  });

  // The clamp has to be explained where the value is entered, and in the label
  // rather than Mantine's description prop, which renders dimmed and fails the
  // project's contrast rule.
  it('explains the short-month clamp in the field’s own label', () => {
    renderForm();
    expect(
      screen.getByRole('textbox', {
        name: 'Day of the month (31 becomes the last day in shorter months)',
      }),
    ).toBeInTheDocument();
  });

  it('defaults the day to today, not to whenever the app was first loaded', () => {
    // An installed PWA can sit open across midnight; a module-level default
    // would keep handing out the day the bundle was evaluated.
    renderForm();
    const todayDay = String(Number(new Date().toISOString().slice(8, 10)));
    expect(screen.getByRole('textbox', { name: /Day of the month/ })).toHaveValue(todayDay);
  });

  it('says in the label that nothing is created before the start date', () => {
    renderForm();
    expect(
      screen.getByRole('textbox', { name: 'Starts on (nothing is created before this date)' }),
    ).toBeInTheDocument();
  });

  it('carries a share that is only for one of them, so it repeats every month', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Phone bill');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '30');
    await user.type(screen.getByRole('textbox', { name: 'Ada — not counted (€)' }), '12');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ amountA: '30.00', notCountedA: '12.00' });
  });

  it('refuses more set aside than the payment itself', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Phone bill');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '30');
    await user.type(screen.getByRole('textbox', { name: 'Ada — not counted (€)' }), '50');
    await user.click(submit());

    expect(
      await screen.findByText('Not counted cannot be more than what Ada paid'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a complete rule', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Phone');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ item: 'Phone', amountA: '12.99' });
  });

  it('pre-fills from the rule when editing, and does not reset afterwards', async () => {
    const user = userEvent.setup();
    const initial: RecurringFormData = {
      start: '2026-01-10',
      amountA: '12.99',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      item: 'Phone',
      category: 'Various',
      notes: 'monthly',
      day: 10,
      everyMonths: 1,
      amountVaries: false,
    };
    const { onSubmit } = renderForm(initial);
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveValue('Phone');

    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // Still filled in: an edit form that empties itself on save looks as though
    // the record was cleared.
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveValue('Phone');
  });

  // ── How often, and bills nobody can price in advance ──

  it('defaults to monthly, which is what most payments are', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    expect(screen.getByRole('textbox', { name: /How often/ })).toHaveValue('1');
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Phone');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].everyMonths).toBe(1);
  });

  it('carries an interval through, and names it in the label', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const every = screen.getByRole('textbox', { name: /How often/ });
    await user.click(every);
    await user.keyboard('{Control>}a{/Control}2');
    expect(screen.getByRole('textbox', { name: /Every 2 months/ })).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Water');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '40');
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].everyMonths).toBe(2);
  });

  it('will not accept an interval outside what it can honour', async () => {
    // Zero would never come round; beyond a year has no schedule to sit on.
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const every = screen.getByRole('textbox', { name: /How often/ });
    await user.click(every);
    await user.keyboard('{Control>}a{/Control}18');

    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Water');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '40');
    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].everyMonths).toBeLessThanOrEqual(12);
  });

  it('stops asking for an amount once the bill is one that varies', async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByRole('textbox', { name: 'Ada (€)' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /different every time/ }));

    expect(screen.queryByRole('textbox', { name: 'Ada (€)' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: /not counted/ })).toBeNull();
    // What it is and what it counts as are still needed.
    expect(screen.getByRole('textbox', { name: 'Item' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Category' })).toBeInTheDocument();
  });

  it('saves a varying bill with no amount at all', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByRole('checkbox', { name: /different every time/ }));
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Water');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      item: 'Water',
      amountVaries: true,
      amountA: '',
      amountB: '',
    });
  });

  // Leaving one behind would put it back on the sheet the moment the box is
  // unticked, as though the app had known the figure all along.
  it('forgets an amount already typed when the bill becomes one that varies', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '40');
    await user.click(screen.getByRole('checkbox', { name: /different every time/ }));
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Water');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].amountA).toBe('');
  });

  it('still refuses a fixed payment with no amount', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Phone');
    await user.click(submit());
    expect(await screen.findByText('At least one amount is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('surfaces a failed save rather than appearing to have worked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {
      throw new Error('Backend error');
    });
    renderWithMantine(<RecurringForm names={NAMES} onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Phone');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');
    await user.click(submit());

    expect(await screen.findByText('Backend error')).toBeInTheDocument();
  });
});
