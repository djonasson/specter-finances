import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import {
  BACKGROUND_CHOICE_OPTIONS,
  BACKGROUND_OPTIONS,
  BACKGROUNDS,
  backgroundFor,
  drawsOverTheApp,
  isBackgroundChoice,
  isBackgroundName,
  RANDOM_BACKGROUND,
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
    expect(stageFloorHeight('pinball', 1440)).toBe(0);
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

// A scene drawn smaller on a narrow window needs a smaller band, or the app
// holds back a strip of the user's list for empty sky. The registry asks the
// background rather than storing a number, so a scene that does not care about
// the width simply ignores it.
describe('how tall a band a background asks for', () => {
  it('lets a scene ask for less of a narrow window than of a wide one', () => {
    expect(stageFloorHeight('cello', 360)).toBeLessThan(stageFloorHeight('cello', 1440));
  });

  it('lets a scene that does not care about the width ask for the same either way', () => {
    expect(stageFloorHeight('squirrel', 360)).toBe(stageFloorHeight('squirrel', 1440));
  });

  it('asks for nothing at all from a background that draws behind the app', () => {
    for (const width of [360, 1440]) {
      expect(stageFloorHeight('matrix', width)).toBe(0);
      expect(stageFloorHeight('none', width)).toBe(0);
    }
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

// "Random" is a choice the picker offers, not a background: it has nothing to
// render and no floor to stand in, and an entry in BACKGROUNDS would have the
// stage asking it for both.
describe('offering a random background', () => {
  it('is not a background the app can draw', () => {
    expect(backgroundFor(RANDOM_BACKGROUND)).toBeUndefined();
    expect(isBackgroundName(RANDOM_BACKGROUND)).toBe(false);
    expect(drawsOverTheApp(RANDOM_BACKGROUND)).toBe(false);
    expect(stageFloorHeight(RANDOM_BACKGROUND, 1440)).toBe(0);
  });

  it('is offered by the picker alongside every real background', () => {
    expect(BACKGROUND_CHOICE_OPTIONS.map((option) => option.value)).toEqual([
      ...BACKGROUND_OPTIONS.map((option) => option.value),
      RANDOM_BACKGROUND,
    ]);
    const random = BACKGROUND_CHOICE_OPTIONS.at(-1);
    expect(random?.label.trim()).not.toBe('');
  });

  it('is accepted as a stored choice, unlike a name no background answers to', () => {
    expect(isBackgroundChoice(RANDOM_BACKGROUND)).toBe(true);
    for (const background of BACKGROUNDS) {
      expect(isBackgroundChoice(background.value)).toBe(true);
    }
    expect(isBackgroundChoice('pinball')).toBe(false);
    expect(isBackgroundChoice(null)).toBe(false);
    expect(isBackgroundChoice(7)).toBe(false);
  });
});
