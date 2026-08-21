// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '../test-utils';
import { STORAGE_KEY } from '../theme/ThemeContext';
import { BACKGROUNDS } from '../theme/registry';
import { ThemeSettings } from './ThemeSettings';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

const renderSettings = (settings?: Record<string, unknown>) =>
  renderWithTheme(<ThemeSettings opened onClose={() => {}} />, settings);

/** The picker's own input, found by the label it is currently showing. */
const picker = (showing: string) => screen.getByDisplayValue(showing);

// Added retroactively. This drawer is the only way into the theme settings, and
// what it writes outlives the release that wrote it — so an option that silently
// stops being offered, or a control that appears for the wrong background, is a
// setting the user can reach but never change back.

describe('the background picker', () => {
  it('offers every background the app knows about', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(picker('None'));

    // Compared against the registry rather than a list written out here: a
    // background added there and forgotten in the picker is exactly the failure
    // this catches, and a copy of the list would go stale alongside it.
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(
      BACKGROUNDS.map((background) => background.label),
    );
  });

  it('remembers the background that was picked', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(picker('None'));
    await user.click(await screen.findByRole('option', { name: 'Squirrel' }));

    expect(stored().backgroundEffect).toBe('squirrel');
    expect(picker('Squirrel')).toBeInTheDocument();
  });

  it('shows what is already stored rather than starting from the default', () => {
    renderSettings({ backgroundEffect: 'gradient' });
    expect(picker('Gradient')).toBeInTheDocument();
  });
});

describe('the controls that belong to one background', () => {
  it('offers the matrix speed while the matrix background is chosen', () => {
    renderSettings({ backgroundEffect: 'matrix' });
    expect(screen.getByText('Matrix Speed')).toBeInTheDocument();
  });

  it('takes the matrix speed away again when another background is chosen', () => {
    renderSettings({ backgroundEffect: 'gradient' });
    expect(screen.queryByText('Matrix Speed')).not.toBeInTheDocument();
  });

  it('offers the gradient speed and its three colours while the gradient is chosen', () => {
    renderSettings({ backgroundEffect: 'gradient' });
    expect(screen.getByText('Gradient Speed')).toBeInTheDocument();
    expect(screen.getByLabelText('Color 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Color 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Color 3')).toBeInTheDocument();
  });

  it('takes the gradient controls away again when another background is chosen', () => {
    renderSettings({ backgroundEffect: 'matrix' });
    expect(screen.queryByText('Gradient Speed')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Color 1')).not.toBeInTheDocument();
  });

  // Transparency is a property of the thing showing through. With no background
  // there is nothing behind the cards, so the slider would move a value the user
  // cannot see the effect of.
  it('hides the card transparency while there is nothing to see through the cards', () => {
    renderSettings();
    expect(screen.queryByText('Card Transparency')).not.toBeInTheDocument();
  });

  it('offers the card transparency once a background is behind them', () => {
    renderSettings({ backgroundEffect: 'squirrel' });
    expect(screen.getByText('Card Transparency')).toBeInTheDocument();
  });
});

describe('putting the theme back', () => {
  it('returns every setting to its default, storage included', async () => {
    const user = userEvent.setup();
    renderSettings({ backgroundEffect: 'matrix', primaryColor: 'teal', cardOpacity: 40 });

    await user.click(screen.getByRole('button', { name: /Reset to Defaults/i }));

    expect(stored()).toMatchObject({
      backgroundEffect: 'none',
      primaryColor: 'indigo',
      cardOpacity: 80,
    });
  });
});

// The drawer is the only way to reach any of this, so a section that quietly
// stops rendering is a feature the user can no longer get at.

describe('the data section', () => {
  it('offers a backup where the user goes looking for their settings', () => {
    renderSettings();

    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back up spreadsheet/i })).toBeInTheDocument();
  });

  it('still offers Reset to Defaults now that the data section sits above it', () => {
    renderSettings();

    expect(screen.getByRole('button', { name: /Reset to Defaults/i })).toBeInTheDocument();
  });

  it('calls itself Settings now that it holds more than the theme', () => {
    renderSettings();

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
