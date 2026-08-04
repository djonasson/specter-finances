// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithTheme } from '../test-utils';
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
function renderStage(ui: Parameters<typeof renderWithTheme>[0], effect: string) {
  return renderWithTheme(ui, { backgroundEffect: effect }).container.querySelector('div');
}

// The scene's canvas covers the whole viewport at a z-index above the app. These
// two are what make that survivable: the floor hides everything but the band the
// scene plays in, and the spacer keeps the last row of a list from being parked
// behind it. Rendered for the wrong background they hide content for no reason;
// missing for the right one they let a canvas cover the app.

describe('the floor a scene stands on', () => {
  it('appears for a background that draws over the app', () => {
    expect(renderStage(<BackgroundFloor />, 'squirrel')).not.toBeNull();
  });

  it.each(['none', 'matrix', 'gradient'])(
    'stays away from the %s background, which draws behind the app',
    (effect) => {
      expect(renderStage(<BackgroundFloor />, effect)).toBeNull();
    },
  );

  it('is hidden from a screen reader, being a mask over an animation', () => {
    expect(renderStage(<BackgroundFloor />, 'squirrel')).toHaveAttribute('aria-hidden');
  });

  it('lets clicks through, so it cannot swallow a tap on the app behind it', () => {
    expect(renderStage(<BackgroundFloor />, 'squirrel')?.style.pointerEvents).toBe('none');
  });

  // The registry decides how much room a scene needs; a floor that ignored it
  // would mask the wrong band for one of them.
  it.each(STAGED_BACKGROUNDS)('is as tall as %s asked for', (effect) => {
    const height = parseInt(renderStage(<BackgroundFloor />, effect)!.style.height);
    expect(height).toBe(stageFloorHeight(effect));
  });
});

describe('the room left below the content', () => {
  it('is reserved for a background that draws over the app', () => {
    expect(renderStage(<BackgroundSpacer />, 'squirrel')).not.toBeNull();
  });

  it('is not taken from a background that draws behind the app', () => {
    expect(renderStage(<BackgroundSpacer />, 'gradient')).toBeNull();
  });

  // A spacer shorter than the floor leaves the last row behind it with no way to
  // scroll it clear, which is the whole failure it exists to prevent — and it has
  // to hold for every scene, not just the one that happened to be checked.
  it.each(STAGED_BACKGROUNDS)('clears the floor %s asked for', (effect) => {
    const spacer = parseInt(renderStage(<BackgroundSpacer />, effect)!.style.height);
    expect(spacer).toBeGreaterThan(stageFloorHeight(effect));
  });
});
