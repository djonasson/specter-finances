import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ThemeProvider, STORAGE_KEY } from './theme/ThemeContext';
import { RANDOM_BACKGROUND } from './theme/registry';
import { excludedFor } from './theme/random';

/**
 * Resize the window and let anything watching for it hear about it.
 *
 * jsdom fires no resize of its own, so the event has to be sent by hand — and
 * inside `act`, since what listens for it is React state.
 *
 * The document follows the window here — see `test-setup.ts` — so a resize
 * moves what `viewportSize` actually reads rather than only the fallback it
 * reaches for when the document reports nothing.
 */
export function resizeTo(width: number, height = window.innerHeight) {
  act(() => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event('resize'));
  });
}

/**
 * Stored settings that shuffle between exactly these backgrounds.
 *
 * The setting holds what was turned *off*, so a test that wants two backgrounds
 * in the shuffle would otherwise write out everything else. Built on the app's
 * own `excludedFor`, which `random.test.ts` pins directly.
 */
export function shufflingBetween(...pool: string[]) {
  return { backgroundEffect: RANDOM_BACKGROUND, randomExcluded: excludedFor(pool) };
}

/**
 * Holds the shuffle still. `pickBackground` takes its roll as a parameter, so
 * stubbing the one call to `Math.random()` fixes which background comes up.
 *
 * Note this also fixes Mantine's `randomId()`, which is why the controls whose
 * labels a test reaches by name carry explicit ids.
 */
export function rolling(value: number) {
  return vi.spyOn(Math, 'random').mockReturnValue(value);
}

/**
 * Components under test read Mantine's theme and color scheme.
 *
 * env="test" is Mantine's own setting for jsdom: it drops the transitions that
 * otherwise leave a Popover dropdown at `display: none` forever, since jsdom
 * runs no animations to finish them. Without it a Select's options exist in the
 * DOM but are never visible, so no accessible query can reach them.
 */
export function renderWithMantine(ui: ReactElement) {
  return render(<MantineProvider env="test">{ui}</MantineProvider>);
}

/**
 * The same, for components that read the app's own theme settings and so need
 * the real ThemeProvider around them. Settings are read from storage once, at
 * mount, so anything the test wants in place goes in through `settings` here.
 *
 * The inner MantineProvider is not redundant: ThemeProvider builds its own
 * MantineProvider — from the stored primary colour, which is the point of it —
 * and that one carries no env="test". The nearest provider wins, so without this
 * one the dropdown problem above comes straight back.
 */
export function renderWithTheme(ui: ReactElement, settings?: Record<string, unknown>) {
  if (settings) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return render(
    <ThemeProvider>
      <MantineProvider env="test">{ui}</MantineProvider>
    </ThemeProvider>,
  );
}

// Test-only helper module; the react-refresh component rule does not apply.
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
