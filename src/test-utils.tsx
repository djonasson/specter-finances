import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

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

// Test-only helper module; the react-refresh component rule does not apply.
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
