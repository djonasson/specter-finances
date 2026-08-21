// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithMantine } from '../test-utils';

const backupSpreadsheet = vi.fn();
vi.mock('../services/backup', () => ({
  backupSpreadsheet: (todayIso: string) => backupSpreadsheet(todayIso),
}));

import { BackupButton } from './BackupButton';
import { today } from '../services/utils';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const render = () => renderWithMantine(<BackupButton />);
const button = () => screen.getByRole('button', { name: /Back up spreadsheet/i });

// A backup that quietly failed is the worst outcome this component has: the
// user walks away believing the only copy of their records is safe somewhere,
// and finds out otherwise at the point they need it.

describe('the backup button', () => {
  it('backs up as of today rather than a date the component invented', async () => {
    const user = userEvent.setup();
    backupSpreadsheet.mockResolvedValue('Household-2026-08-18.xlsx');
    render();

    await user.click(button());

    await waitFor(() => expect(backupSpreadsheet).toHaveBeenCalledWith(today()));
  });

  it('shows nothing gone wrong before anyone has pressed it', () => {
    render();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says what went wrong instead of leaving the user believing it downloaded', async () => {
    const user = userEvent.setup();
    backupSpreadsheet.mockRejectedValue(new Error('Cannot reach spreadsheet abc'));
    render();

    await user.click(button());

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach spreadsheet abc');
  });

  it('still says something useful when the failure carries no message', async () => {
    const user = userEvent.setup();
    backupSpreadsheet.mockRejectedValue('nope');
    render();

    await user.click(button());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not download the spreadsheet.',
    );
  });

  it('does not offer a second download while the first is still running', async () => {
    const user = userEvent.setup();
    let release = () => {};
    backupSpreadsheet.mockReturnValue(
      new Promise<string>((resolve) => {
        release = () => resolve('Household.xlsx');
      }),
    );
    render();

    await user.click(button());

    await waitFor(() => expect(button()).toBeDisabled());
    release();
    await waitFor(() => expect(button()).toBeEnabled());
    expect(backupSpreadsheet).toHaveBeenCalledTimes(1);
  });

  it('lets the user try again after a failure rather than staying stuck', async () => {
    const user = userEvent.setup();
    backupSpreadsheet.mockRejectedValue(new Error('Backend error'));
    render();

    await user.click(button());
    await screen.findByRole('alert');

    await waitFor(() => expect(button()).toBeEnabled());
  });

  it('clears the previous failure when a retry succeeds', async () => {
    const user = userEvent.setup();
    backupSpreadsheet.mockRejectedValueOnce(new Error('Backend error'));
    backupSpreadsheet.mockResolvedValueOnce('Household.xlsx');
    render();

    await user.click(button());
    await screen.findByRole('alert');

    await user.click(button());

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
