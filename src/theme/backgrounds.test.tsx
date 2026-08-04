// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithTheme } from '../test-utils';

// The real scenes are canvas animations, and jsdom has no canvas — every one of
// them would dereference the null its getContext returns. Standing in for them
// is enough: what is under test here is which one gets picked and what gets
// rendered beside it, not what any of them draws.
vi.mock('./MatrixBackground', () => ({
  MatrixBackground: ({ speed }: { speed: number }) => (
    <div data-scene="matrix" data-speed={speed} />
  ),
}));
vi.mock('./GradientBackground', () => ({
  GradientBackground: () => <div data-scene="gradient" />,
}));
vi.mock('./SquirrelBackground', () => ({
  SquirrelBackground: () => <div data-scene="squirrel" />,
}));
// Only the component is stood in for; CELLO_FLOOR is a plain number the registry
// reads, and a copy of it here could go stale against the scene it comes from.
vi.mock('./cello/CelloBackground', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cello/CelloBackground')>()),
  CelloBackground: () => <div data-scene="cello" />,
}));

import { BackgroundEffect } from './backgrounds';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function render(settings: Record<string, unknown>) {
  const { container } = renderWithTheme(<BackgroundEffect />, settings);
  return {
    scene: container.querySelector('[data-scene]')?.getAttribute('data-scene') ?? null,
    floor: container.querySelector('div[aria-hidden]'),
  };
}

// This is the whole dispatch: one lookup in the registry decides which scene the
// user gets. It replaced a chain of `if (backgroundEffect === '...')`, and the
// failure it can have now is quietly rendering the wrong one — or rendering a
// scene that draws over the app without the floor that makes that survivable.

describe('choosing the background', () => {
  it.each([
    ['matrix', 'matrix'],
    ['gradient', 'gradient'],
    ['squirrel', 'squirrel'],
    ['cello', 'cello'],
  ])('renders the %s background when that is what is stored', (stored, scene) => {
    expect(render({ backgroundEffect: stored }).scene).toBe(scene);
  });

  it('renders no scene at all when the user asked for none', () => {
    expect(render({ backgroundEffect: 'none' }).scene).toBeNull();
  });

  it('hands the matrix background the speed the user set, not a default', () => {
    const { container } = renderWithTheme(<BackgroundEffect />, {
      backgroundEffect: 'matrix',
      matrixSpeed: 2,
    });
    expect(container.querySelector('[data-scene="matrix"]')).toHaveAttribute('data-speed', '2');
  });
});

describe('the floor that comes with a scene', () => {
  it.each(['squirrel', 'cello'])('comes with the %s scene, which draws over the app', (stored) => {
    expect(render({ backgroundEffect: stored }).floor).not.toBeNull();
  });

  it.each(['none', 'matrix', 'gradient'])(
    'does not come with %s, which draws behind it',
    (stored) => {
      expect(render({ backgroundEffect: stored }).floor).toBeNull();
    },
  );
});
