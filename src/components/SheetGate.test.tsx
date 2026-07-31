// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, cleanup } from '@testing-library/react';
import { renderWithMantine } from '../test-utils';

let projectNumber: string | null = '89909641639';
vi.mock('../services/auth', () => ({
  getAccessToken: () => 'test-token',
  getProjectNumber: () => projectNumber,
}));

const pickSpreadsheet = vi.fn();
vi.mock('../services/picker', () => ({
  pickSpreadsheet: (...args: unknown[]) => pickSpreadsheet(...args),
}));

import { SheetGate } from './SheetGate';
import { getGrantedSheetId, clearGrantedSheetId } from '../services/sheetAccess';

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_API_KEY', 'test-api-key');
  projectNumber = '89909641639';
  pickSpreadsheet.mockReset();
});

afterEach(() => {
  cleanup();
  clearGrantedSheetId();
  vi.unstubAllEnvs();
});

describe('picking a sheet', () => {
  it('records the grant and reports it upward', async () => {
    const user = userEvent.setup();
    const onPicked = vi.fn();
    pickSpreadsheet.mockResolvedValue('sheet-abc');

    renderWithMantine(<SheetGate onPicked={onPicked} />);
    await user.click(screen.getByRole('button', { name: /choose spreadsheet/i }));

    // The app id is what creates the per-file grant; without it the pick
    // returns an id that every API call then rejects.
    expect(pickSpreadsheet).toHaveBeenCalledWith('test-token', 'test-api-key', '89909641639');
    expect(getGrantedSheetId()).toBe('sheet-abc');
    expect(onPicked).toHaveBeenCalledWith('sheet-abc');
  });

  it('stays put when the picker is cancelled', async () => {
    const user = userEvent.setup();
    const onPicked = vi.fn();
    pickSpreadsheet.mockResolvedValue(null);

    renderWithMantine(<SheetGate onPicked={onPicked} />);
    await user.click(screen.getByRole('button', { name: /choose spreadsheet/i }));

    expect(getGrantedSheetId()).toBeNull();
    expect(onPicked).not.toHaveBeenCalled();
  });

  it('surfaces a picker failure without granting anything', async () => {
    const user = userEvent.setup();
    const onPicked = vi.fn();
    pickSpreadsheet.mockRejectedValue(new Error('Could not load the Google file picker.'));

    renderWithMantine(<SheetGate onPicked={onPicked} />);
    await user.click(screen.getByRole('button', { name: /choose spreadsheet/i }));

    expect(await screen.findByText('Could not load the Google file picker.')).toBeInTheDocument();
    expect(getGrantedSheetId()).toBeNull();
    expect(onPicked).not.toHaveBeenCalled();
  });
});

describe('missing configuration', () => {
  it('names the missing API key rather than offering a dead button', () => {
    vi.stubEnv('VITE_GOOGLE_API_KEY', '');

    renderWithMantine(<SheetGate onPicked={vi.fn()} />);

    expect(screen.getByText('VITE_GOOGLE_API_KEY is not set')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /choose spreadsheet/i })).not.toBeInTheDocument();
  });

  it('says so when the project number cannot be derived from the client id', () => {
    projectNumber = null;

    renderWithMantine(<SheetGate onPicked={vi.fn()} />);

    expect(screen.getByText('Cannot read the project number')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /choose spreadsheet/i })).not.toBeInTheDocument();
  });
});

describe('sheet id hint', () => {
  it('shows the configured id so the right file is easy to spot', () => {
    vi.stubEnv('VITE_SPREADSHEET_ID', 'hint-sheet-id');
    renderWithMantine(<SheetGate onPicked={vi.fn()} />);
    expect(screen.getByText('hint-sheet-id')).toBeInTheDocument();
  });
});

describe('what the screen tells the user', () => {
  it('explains why picking is required', () => {
    renderWithMantine(<SheetGate onPicked={vi.fn()} />);
    expect(screen.getByText(/only reach spreadsheets you pick/i)).toBeInTheDocument();
  });
});
