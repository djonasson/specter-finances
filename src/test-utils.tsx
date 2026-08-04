import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ThemeProvider, STORAGE_KEY } from './theme/ThemeContext';

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
