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
    await user.tripleClick(day); // select what is there, then replace it
    await user.type(day, '45');

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
    await user.tripleClick(day);
    await user.type(day, '31');

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

  it('says in the label that nothing is created before the start date', () => {
    renderForm();
    expect(
      screen.getByRole('textbox', { name: 'Starts on (nothing is created before this date)' }),
    ).toBeInTheDocument();
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
      item: 'Phone',
      category: 'Various',
      notes: 'monthly',
      day: 10,
    };
    const { onSubmit } = renderForm(initial);
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveValue('Phone');

    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // Still filled in: an edit form that empties itself on save looks as though
    // the record was cleared.
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveValue('Phone');
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
