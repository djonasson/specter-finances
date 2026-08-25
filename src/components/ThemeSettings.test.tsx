// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme, rolling, shufflingBetween } from '../test-utils';
import { STORAGE_KEY } from '../theme/ThemeContext';
import { BACKGROUNDS, BACKGROUND_NAMES } from '../theme/registry';
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
    // Derived from BACKGROUNDS, not from the very array the component is handed
    // as `data`: comparing that to itself passes even when a background stops
    // being offered at all.
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      ...BACKGROUNDS.map((background) => background.label),
      'Random',
    ]);
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

// Picking "Random" is only half the setting: without the list it shuffles
// between, the user has asked for a surprise and cannot say which ones.
describe('choosing what a random background shuffles between', () => {
  const boxes = () =>
    screen.getAllByRole('checkbox').map((box) => ({
      label: box.getAttribute('id')?.replace('shuffle-', ''),
      checked: (box as HTMLInputElement).checked,
    }));

  afterEach(() => vi.restoreAllMocks());

  it('asks nothing while a background was chosen by name', () => {
    renderSettings({ backgroundEffect: 'cello' });
    expect(screen.queryByRole('group', { name: 'Shuffle between' })).not.toBeInTheDocument();
  });

  it('names the group of boxes, which are meaningless read out one by one', () => {
    // "None, Matrix, Gradient, Squirrel, Cello" with nothing saying what they
    // configure is what a screen reader announced while the name sat on a
    // wrapper that carries no role.
    rolling(0);
    renderSettings({ backgroundEffect: 'random' });
    expect(screen.getByRole('group', { name: 'Shuffle between' })).toBeInTheDocument();
  });

  it('offers exactly one box per background, and no box for the shuffle itself', () => {
    // Asserted as a whole list: a sixth box labelled "Random" would tick, fail
    // validation on the way to storage, and silently re-render unticked.
    rolling(0);
    renderSettings({ backgroundEffect: 'random' });
    expect(boxes().map((box) => box.label)).toEqual(BACKGROUND_NAMES);
  });

  it('starts with every background but the plain one ticked', () => {
    rolling(0);
    renderSettings({ backgroundEffect: 'random' });
    expect(boxes()).toEqual(
      BACKGROUNDS.map((background) => ({
        label: background.value,
        checked: background.value !== 'none',
      })),
    );
  });

  it('remembers a background being taken out of the shuffle', async () => {
    rolling(0);
    const user = userEvent.setup();
    renderSettings(shufflingBetween('matrix', 'cello'));

    await user.click(screen.getByRole('checkbox', { name: 'Cello' }));

    expect(stored().randomExcluded).toContain('cello');
    expect(stored().randomExcluded).not.toContain('matrix');
  });

  it('remembers a background being added to the shuffle', async () => {
    rolling(0);
    const user = userEvent.setup();
    renderSettings(shufflingBetween('matrix'));

    await user.click(screen.getByRole('checkbox', { name: 'Cello' }));

    expect(stored().randomExcluded).not.toContain('cello');
  });

  it('names the background this launch landed on, since the picker cannot', () => {
    rolling(0.99);
    renderSettings(shufflingBetween('matrix', 'cello'));
    expect(screen.getByText(/This launch: Cello/)).toBeInTheDocument();
  });

  it('names the plain background too, when that is the one that was ticked', () => {
    // A blank screen somebody asked for is not the same state as a blank screen
    // nobody asked for, and the drawer must not report the second for the first.
    renderSettings(shufflingBetween('none'));
    expect(screen.getByText(/This launch: None/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing ticked/)).not.toBeInTheDocument();
  });

  it('says why the screen is bare when every box is unticked', () => {
    // Otherwise "Random" with nothing showing reads as a broken setting.
    renderSettings(shufflingBetween());
    expect(screen.getByText(/Nothing ticked/)).toBeInTheDocument();
    expect(screen.queryByText(/This launch:/)).not.toBeInTheDocument();
  });

  it('offers a shuffle the picker cannot: re-choosing Random fires no change', () => {
    rolling(0);
    renderSettings(shufflingBetween('matrix', 'cello'));
    expect(screen.getByRole('button', { name: /Shuffle again/i })).toBeInTheDocument();
  });

  it('rolls again when asked to, without waiting for the next launch', async () => {
    const roll = rolling(0);
    const user = userEvent.setup();
    renderSettings(shufflingBetween('matrix', 'cello'));
    expect(screen.getByText(/This launch: Matrix/)).toBeInTheDocument();

    roll.mockReturnValue(0.99);
    await user.click(screen.getByRole('button', { name: /Shuffle again/i }));

    expect(screen.getByText(/This launch: Cello/)).toBeInTheDocument();
  });

  it('offers no shuffle while a background was chosen by name', () => {
    renderSettings({ backgroundEffect: 'cello' });
    expect(screen.queryByRole('button', { name: /Shuffle again/i })).not.toBeInTheDocument();
  });
});

describe('the controls that belong to the background a shuffle landed on', () => {
  afterEach(() => vi.restoreAllMocks());

  it('offers the matrix speed when the shuffle is showing the matrix', () => {
    rolling(0);
    renderSettings(shufflingBetween('matrix'));
    expect(screen.getByText('Matrix Speed')).toBeInTheDocument();
  });

  it('keeps the matrix speed away when the shuffle landed elsewhere', () => {
    rolling(0);
    renderSettings(shufflingBetween('cello'));
    expect(screen.queryByText('Matrix Speed')).not.toBeInTheDocument();
  });

  it('offers the gradient controls when the shuffle is showing the gradient', () => {
    rolling(0);
    renderSettings(shufflingBetween('gradient'));
    expect(screen.getByText('Gradient Speed')).toBeInTheDocument();
    expect(screen.getByLabelText('Color 1')).toBeInTheDocument();
  });

  it('keeps the gradient controls away when the shuffle landed elsewhere', () => {
    rolling(0);
    renderSettings(shufflingBetween('cello'));
    expect(screen.queryByText('Gradient Speed')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Color 1')).not.toBeInTheDocument();
  });

  it('offers the card transparency, there being a background behind them', () => {
    rolling(0);
    renderSettings(shufflingBetween('cello'));
    expect(screen.getByText('Card Transparency')).toBeInTheDocument();
  });

  it('hides the card transparency when the shuffle had nothing to pick from', () => {
    renderSettings(shufflingBetween());
    expect(screen.queryByText('Card Transparency')).not.toBeInTheDocument();
  });
});
