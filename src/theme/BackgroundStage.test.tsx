// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithTheme, rolling, shufflingBetween } from '../test-utils';
import { STAGED_BACKGROUNDS, stageFloorHeight } from './registry';
import { BackgroundFloor, BackgroundSpacer } from './BackgroundStage';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

/**
 * Both of these render a single bare div or nothing at all, and the provider
 * around them injects a `<style>` of its own — so the assertion has to name the
 * div rather than take whatever came first.
 */
function renderStage(ui: Parameters<typeof renderWithTheme>[0], settings: Record<string, unknown>) {
  return renderWithTheme(ui, settings).container.querySelector('div');
}

/** The same, for a background nobody named: see the shuffle describe below. */
function renderShuffled(ui: Parameters<typeof renderWithTheme>[0], pool: string[]) {
  rolling(0);
  return renderStage(ui, shufflingBetween(...pool));
}

// The scene's canvas covers the whole viewport at a z-index above the app. These
// two are what make that survivable: the floor hides everything but the band the
// scene plays in, and the spacer keeps the last row of a list from being parked
// behind it. Rendered for the wrong background they hide content for no reason;
// missing for the right one they let a canvas cover the app.

describe('the floor a scene stands on', () => {
  it('appears for a background that draws over the app', () => {
    expect(renderStage(<BackgroundFloor />, { backgroundEffect: 'squirrel' })).not.toBeNull();
  });

  it.each(['none', 'matrix', 'gradient'])(
    'stays away from the %s background, which draws behind the app',
    (effect) => {
      expect(renderStage(<BackgroundFloor />, { backgroundEffect: effect })).toBeNull();
    },
  );

  it('is hidden from a screen reader, being a mask over an animation', () => {
    expect(renderStage(<BackgroundFloor />, { backgroundEffect: 'squirrel' })).toHaveAttribute(
      'aria-hidden',
    );
  });

  it('lets clicks through, so it cannot swallow a tap on the app behind it', () => {
    expect(
      renderStage(<BackgroundFloor />, { backgroundEffect: 'squirrel' })?.style.pointerEvents,
    ).toBe('none');
  });

  // The registry decides how much room a scene needs; a floor that ignored it
  // would mask the wrong band for one of them.
  it.each(STAGED_BACKGROUNDS)('is as tall as %s asked for', (effect) => {
    const height = parseInt(
      renderStage(<BackgroundFloor />, { backgroundEffect: effect })!.style.height,
    );
    expect(height).toBe(stageFloorHeight(effect));
  });
});

describe('the room left below the content', () => {
  it('is reserved for a background that draws over the app', () => {
    expect(renderStage(<BackgroundSpacer />, { backgroundEffect: 'squirrel' })).not.toBeNull();
  });

  it('is not taken from a background that draws behind the app', () => {
    expect(renderStage(<BackgroundSpacer />, { backgroundEffect: 'gradient' })).toBeNull();
  });

  // A spacer shorter than the floor leaves the last row behind it with no way to
  // scroll it clear, which is the whole failure it exists to prevent — and it has
  // to hold for every scene, not just the one that happened to be checked.
  it.each(STAGED_BACKGROUNDS)('clears the floor %s asked for', (effect) => {
    const spacer = parseInt(
      renderStage(<BackgroundSpacer />, { backgroundEffect: effect })!.style.height,
    );
    expect(spacer).toBeGreaterThan(stageFloorHeight(effect));
  });
});

// The band belongs to the scene on screen, not to the setting: a shuffle that
// landed on Cello needs Cello's floor and Cello's scroll room.
describe('the band a shuffled scene stands in', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is as tall as the background the shuffle landed on asked for', () => {
    const floor = renderShuffled(<BackgroundFloor />, ['cello']);
    expect(parseInt(floor!.style.height)).toBe(stageFloorHeight('cello'));
  });

  it('reserves scroll room that clears the floor the scene stands in', () => {
    const spacer = parseInt(renderShuffled(<BackgroundSpacer />, ['cello'])!.style.height);
    expect(spacer).toBeGreaterThan(stageFloorHeight('cello'));
  });

  it('stays away when the shuffle landed on a background drawn behind the app', () => {
    expect(renderShuffled(<BackgroundFloor />, ['matrix'])).toBeNull();
    cleanup();
    expect(renderShuffled(<BackgroundSpacer />, ['matrix'])).toBeNull();
  });
});
