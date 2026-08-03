// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithMantine } from '../test-utils';
import { CategoryIcon } from './CategoryIcon';
import { CATEGORIES } from '../types/expense';

// Added retroactively. Small, but it is fed straight from a hand-edited
// spreadsheet cell, so the branch that matters is the one for a value that is
// not a category at all.

afterEach(cleanup);

describe('CategoryIcon', () => {
  it.each(CATEGORIES)('draws an icon for %s', (category) => {
    const { container } = renderWithMantine(<CategoryIcon category={category} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('gives every category its own icon, so none of them read as another', () => {
    const classes = CATEGORIES.map((category) => {
      const { container } = renderWithMantine(<CategoryIcon category={category} />);
      const cls = container.querySelector('svg')?.getAttribute('class') ?? '';
      cleanup();
      return cls;
    });
    expect(new Set(classes).size).toBe(CATEGORIES.length);
  });

  it('draws nothing for a cell the sheet holds that is not a category', () => {
    // toCategory blanks anything unrecognised, and a hand-edited sheet is full
    // of possibilities. Rendering nothing beats rendering a misleading icon.
    const { container } = renderWithMantine(<CategoryIcon category="Groceries" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('draws nothing for an uncategorised row', () => {
    const { container } = renderWithMantine(<CategoryIcon category="" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('honours the size it is given, since the list and the form differ', () => {
    const { container } = renderWithMantine(<CategoryIcon category="Food" size={24} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '24');
  });
});
