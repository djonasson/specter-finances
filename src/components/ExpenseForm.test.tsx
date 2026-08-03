// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '../test-utils';
import { ExpenseForm } from './ExpenseForm';
import type { ExpenseFormData } from '../types/expense';

// Deliberately not the defaults: these prove the form renders the names it is
// handed rather than any it knows itself.
const NAMES = { a: 'Ada', b: 'Bo' };

function renderForm(initial?: ExpenseFormData) {
  const onSubmit = vi.fn<(data: ExpenseFormData) => Promise<void>>(async () => {});
  renderWithMantine(<ExpenseForm names={NAMES} onSubmit={onSubmit} initial={initial} />);
  return { onSubmit };
}

const submit = () => screen.getByRole('button', { name: /Add Expense|Save/ });

const filled: ExpenseFormData = {
  date: '2026-01-10',
  amountA: '12.99',
  amountB: '',
  notCountedA: '',
  notCountedB: '',
  item: 'Bread',
  category: 'Food',
  notes: 'sourdough',
};

afterEach(cleanup);

// This form had no tests at all until the fields it shares with the recurring
// form were pulled out into one component. Everything below is the behaviour
// that extraction had to preserve — it is the form real money is entered
// through.

describe('ExpenseForm', () => {
  it('labels the amount fields with the names from the sheet', () => {
    renderForm();
    expect(screen.getByRole('textbox', { name: 'Ada (€)' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Bo (€)' })).toBeInTheDocument();
  });

  it('offers both people, so either can be the one who paid', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Bread');
    await user.type(screen.getByRole('textbox', { name: 'Bo (€)' }), '20');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ amountA: '', amountB: '20.00' });
  });

  it('records an amount from each of them on one row', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Groceries');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '30');
    await user.type(screen.getByRole('textbox', { name: 'Bo (€)' }), '20');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ amountA: '30.00', amountB: '20.00' });
  });

  it('refuses a row with no amount at all, which would record no spending', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Bread');
    await user.click(submit());

    expect(await screen.findByText('At least one amount is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('will not submit without an item, so nothing lands on the sheet unnamed', async () => {
    // The field is marked required, so the browser refuses before the form's own
    // check is reached; that check stays as cover for anything submitting the
    // form without going through the control.
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');
    await user.click(submit());

    expect(screen.getByRole('textbox', { name: 'Item' })).toBeRequired();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('defaults a new expense to today, since most are entered as they happen', () => {
    renderForm();
    const todayIso = new Date().toISOString().slice(0, 10);
    expect(screen.getByRole('textbox', { name: 'Date' })).toHaveValue(todayIso);
  });

  it('carries the category through', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Petrol');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '40');
    await user.click(screen.getByRole('textbox', { name: 'Category' }));
    await user.click(await screen.findByRole('option', { name: 'Car' }));
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].category).toBe('Car');
  });

  it('empties itself after adding, ready for the next one', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Bread');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveValue('');
  });

  it('stays filled in after saving an edit, which is not the same gesture', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm(filled);
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveValue('Bread');

    await user.click(submit());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    // An edit form that empties itself on save reads as though the record was
    // cleared.
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveValue('Bread');
  });

  it('pre-fills every field when editing', () => {
    renderForm(filled);
    expect(screen.getByRole('textbox', { name: 'Date' })).toHaveValue('2026-01-10');
    expect(screen.getByRole('textbox', { name: 'Ada (€)' })).toHaveValue('€ 12.99');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('sourdough');
    expect(screen.getByRole('textbox', { name: 'Category' })).toHaveValue('Food');
  });

  it('surfaces a failed save rather than appearing to have worked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {
      throw new Error('Backend error');
    });
    renderWithMantine(<ExpenseForm names={NAMES} onSubmit={onSubmit} />);

    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Bread');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');
    await user.click(submit());

    expect(await screen.findByText('Backend error')).toBeInTheDocument();
  });

  // ── Not counted ──
  //
  // A slice of the amount above it, for something only the person who paid it
  // got. The money was still spent; the other just does not owe half of it.

  it('records what was only for one of them', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Shop');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '100');
    await user.type(screen.getByRole('textbox', { name: 'Ada — not counted (€)' }), '10');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ amountA: '100.00', notCountedA: '10.00' });
  });

  it('leaves it empty on an ordinary shared expense', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Bread');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '12.99');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({ notCountedA: '', notCountedB: '' });
  });

  // More than the whole would make the shared part negative and pay the wrong
  // person — so the form refuses it rather than writing it to the sheet.
  it('refuses more set aside than was paid, naming whose figure it is', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Shop');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '100');
    await user.type(screen.getByRole('textbox', { name: 'Ada — not counted (€)' }), '150');
    await user.click(submit());

    expect(
      await screen.findByText('Not counted cannot be more than what Ada paid'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a purchase that was entirely for one of them', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(screen.getByRole('textbox', { name: 'Item' }), 'Book');
    await user.type(screen.getByRole('textbox', { name: 'Ada (€)' }), '20');
    await user.type(screen.getByRole('textbox', { name: 'Ada — not counted (€)' }), '20');
    await user.click(submit());

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it('shows no Cancel when there is nothing to cancel back to', () => {
    renderForm();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('offers Cancel when opened as an inline edit', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithMantine(
      <ExpenseForm names={NAMES} onSubmit={vi.fn(async () => {})} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
