// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '../test-utils';
import { RecordTypeHelp } from './RecordTypeHelp';

// Deliberately not the defaults: the examples must be built from the sheet's
// names, never from a name written into this repo.
const NAMES = { a: 'Ada', b: 'Bo' };

afterEach(cleanup);

// Added retroactively. This component is the app's own explanation of the
// settlement rules, so it is the one place where wrong copy teaches the user
// the wrong model of their money.

describe('RecordTypeHelp', () => {
  // Mantine keeps collapsed content mounted, so aria-expanded is the contract
  // that actually says whether it is open — to a screen reader as much as here.
  it('starts collapsed, so it does not push the form off the screen', () => {
    renderWithMantine(<RecordTypeHelp kind="expense" names={NAMES} />);
    expect(screen.getByRole('button', { name: /What counts as an expense/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('reports whether it is open, for anyone not looking at the chevron', async () => {
    const user = userEvent.setup();
    renderWithMantine(<RecordTypeHelp kind="expense" names={NAMES} />);
    const toggle = screen.getByRole('button', { name: /What counts as an expense/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it.each([
    ['expense', /What counts as an expense/i],
    ['transfer', /What counts as a transfer/i],
    ['gift', /What counts as a gift/i],
  ] as const)('asks the question that fits a %s', (kind, question) => {
    renderWithMantine(<RecordTypeHelp kind={kind} names={NAMES} />);
    expect(screen.getByRole('button', { name: question })).toBeInTheDocument();
  });

  it.each(['expense', 'transfer', 'gift'] as const)(
    'builds the %s example from the names in the sheet',
    async (kind) => {
      const user = userEvent.setup();
      renderWithMantine(<RecordTypeHelp kind={kind} names={NAMES} />);
      await user.click(screen.getByRole('button', { name: /What counts as/i }));
      // Both names, in copy this repo never writes down itself.
      expect(screen.getAllByText(/Ada/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Bo/).length).toBeGreaterThan(0);
    },
  );

  // These two do opposite things to the balance, and the copy is the only place
  // that says so before the user picks one.
  it('keeps a present apart from forgiving debt', async () => {
    const user = userEvent.setup();
    renderWithMantine(<RecordTypeHelp kind="gift" names={NAMES} />);
    await user.click(screen.getByRole('button', { name: /What counts as a gift/i }));

    expect(screen.getByText(/the balance stays exactly where it was/i)).toBeInTheDocument();
    expect(screen.getByText(/no money moved/i)).toBeInTheDocument();
  });

  it('says a repayment belongs in a transfer, from the gift side', async () => {
    const user = userEvent.setup();
    renderWithMantine(<RecordTypeHelp kind="gift" names={NAMES} />);
    await user.click(screen.getByRole('button', { name: /What counts as a gift/i }));
    expect(screen.getByText(/log it as a transfer instead/i)).toBeInTheDocument();
  });
});
