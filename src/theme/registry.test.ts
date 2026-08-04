import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import {
  BACKGROUNDS,
  backgroundFor,
  drawsOverTheApp,
  isBackgroundName,
  stageFloorHeight,
} from './registry';

// This list is the seam that keeps a theme's quirks out of the app: App.tsx and
// ThemeContext.tsx ask it what a background needs instead of asking which one is
// showing. An entry that is malformed here is a `if (name === ...)` growing back
// somewhere else.

describe('the list of backgrounds', () => {
  it('names each background once, so the picker cannot offer the same one twice', () => {
    const values = BACKGROUNDS.map((background) => background.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('labels every background, since the picker shows nothing else', () => {
    for (const background of BACKGROUNDS) {
      expect(background.label.trim()).not.toBe('');
    }
  });

  it('keeps offering the plain background the settings fall back to', () => {
    expect(backgroundFor('none')).toBeDefined();
    expect(drawsOverTheApp('none')).toBe(false);
  });

  it('asks for a floor only from the backgrounds that draw over the app', () => {
    // The squirrel's and Cello's canvases sit above the AppShell; matrix and
    // gradient sit behind it and would be masked by a floor they never asked for.
    expect(drawsOverTheApp('squirrel')).toBe(true);
    expect(drawsOverTheApp('cello')).toBe(true);
    expect(drawsOverTheApp('matrix')).toBe(false);
    expect(drawsOverTheApp('gradient')).toBe(false);
    expect(drawsOverTheApp('none')).toBe(false);
  });

  it('has nothing to say about a background it does not have', () => {
    expect(backgroundFor('pinball')).toBeUndefined();
    expect(drawsOverTheApp('pinball')).toBe(false);
    expect(stageFloorHeight('pinball')).toBe(0);
  });
});

// Entries are added by copying the one above, which is exactly how a new
// background ends up quietly rendering the previous one's scene.
describe('what each entry actually renders', () => {
  const PROPS = {
    matrixSpeed: 5,
    gradient: { colors: ['#111111', '#222222', '#333333'] as [string, string, string], speed: 5 },
  };

  it('draws its own component for each background, and nothing for the plain one', () => {
    const components: unknown[] = [];
    for (const background of BACKGROUNDS) {
      const rendered = background.render(PROPS);
      if (background.value === 'none') {
        expect(rendered).toBeNull();
        continue;
      }
      expect(rendered).not.toBeNull();
      components.push((rendered as ReactElement).type);
    }
    // Two entries sharing a component means one of them silently shows the other.
    expect(new Set(components).size).toBe(components.length);
  });
});

describe('recognising a stored background name', () => {
  it('accepts every name the app actually offers', () => {
    for (const background of BACKGROUNDS) {
      expect(isBackgroundName(background.value)).toBe(true);
    }
  });

  it('rejects a name no background answers to', () => {
    expect(isBackgroundName('squirrels')).toBe(false);
    expect(isBackgroundName('')).toBe(false);
  });

  it('rejects what is not even a name, since storage can hold anything', () => {
    expect(isBackgroundName(undefined)).toBe(false);
    expect(isBackgroundName(null)).toBe(false);
    expect(isBackgroundName(7)).toBe(false);
    expect(isBackgroundName({ value: 'matrix' })).toBe(false);
  });
});
