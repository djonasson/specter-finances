// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithTheme, rolling, shufflingBetween } from '../test-utils';

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
// Only the component is stood in for: the band it stands in is `celloFloor` in
// `cello/scene.ts`, which the registry asks for the width, and a copy of that
// here could go stale against the scene it comes from.
vi.mock('./cello/CelloBackground', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cello/CelloBackground')>()),
  CelloBackground: () => <div data-scene="cello" />,
}));

import { BackgroundEffect } from './backgrounds';
import { BACKGROUNDS, STAGED_BACKGROUNDS, drawsOverTheApp } from './registry';
import { FOOTER_HEIGHT, BEHIND_Z, SCENE_Z } from './chrome';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function render(settings: Record<string, unknown>) {
  const { container } = renderWithTheme(<BackgroundEffect />, settings);
  return {
    scene: container.querySelector('[data-scene]')?.getAttribute('data-scene') ?? null,
    // Named rather than "the aria-hidden div": the scene clip is one of those
    // too, and matching it here reported a floor for backgrounds that have none.
    floor: container.querySelector('[data-scene-floor]'),
    layer: container.querySelector<HTMLElement>('[data-scene-layer]'),
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

// Which layer a background lands on, and what it may paint over, are decided by
// the stage — never by the background. See `SceneLayer` for why; the short of it
// is that Cello's ground painted over all five nav buttons.

describe('where a background is put', () => {
  const layerOf = (stored: string) => render({ backgroundEffect: stored }).layer;

  const BEHIND_THE_APP = BACKGROUNDS.map((b) => b.value).filter((v) => !drawsOverTheApp(v));

  // Driven off the registry rather than a list written here, so a background
  // added later is covered the day it is added.
  it.each(STAGED_BACKGROUNDS)('stands %s in front of the app, off the footer', (stored) => {
    const layer = layerOf(stored);
    expect(layer!.style.zIndex).toBe(String(SCENE_Z));
    expect(layer!.style.clipPath).toBe(`inset(0 0 ${FOOTER_HEIGHT}px 0)`);
  });

  it.each(STAGED_BACKGROUNDS)('renders %s inside that layer rather than beside it', (stored) => {
    const { container } = renderWithTheme(<BackgroundEffect />, { backgroundEffect: stored });
    expect(container.querySelector('[data-scene]')?.closest('[data-scene-layer]')).not.toBeNull();
  });

  // The other direction, and the one that cost the most to learn: the clip is a
  // stacking context, so clipping a background that belongs behind the app
  // hoists it in front of every row, chart and form.
  it.each(BEHIND_THE_APP)('leaves %s behind the app, and clips it off nothing', (stored) => {
    const layer = layerOf(stored);
    expect(layer!.style.zIndex).toBe(String(BEHIND_Z));
    expect(layer!.style.clipPath).toBe('');
  });

  it('lets clicks through, so no background can swallow a tap on the app', () => {
    expect(layerOf('cello')!.style.pointerEvents).toBe('none');
  });

  it('is hidden from a screen reader, being scenery', () => {
    expect(layerOf('cello')).toHaveAttribute('aria-hidden');
  });
});

// A shuffled background is a background: it needs the same layer, floor and clip
// as the one that was chosen by name. Reading the choice instead of what it
// resolved to draws nothing at all — the registry has no `random` entry.
describe('a background that was shuffled', () => {
  const shuffled = (pool: string[], roll = 0) => {
    rolling(roll);
    return render(shufflingBetween(...pool));
  };

  afterEach(() => vi.restoreAllMocks());

  it('renders the scene the shuffle landed on', () => {
    expect(shuffled(['matrix', 'cello'], 0.99).scene).toBe('cello');
    cleanup();
    expect(shuffled(['matrix', 'cello'], 0).scene).toBe('matrix');
  });

  it('comes with the floor that scene stands in', () => {
    expect(shuffled(['cello']).floor).not.toBeNull();
  });

  it('stands the scene it landed on in front of the app, off the footer', () => {
    const { layer } = shuffled(['cello']);
    expect(layer!.style.zIndex).toBe(String(SCENE_Z));
    expect(layer!.style.clipPath).toBe(`inset(0 0 ${FOOTER_HEIGHT}px 0)`);
  });

  it('renders no scene at all when there was nothing to pick from', () => {
    expect(shuffled([]).scene).toBeNull();
  });
});
