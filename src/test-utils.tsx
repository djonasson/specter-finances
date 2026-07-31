import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

/** Components under test read Mantine's theme and color scheme. */
export function renderWithMantine(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

// Test-only helper module; the react-refresh component rule does not apply.
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
