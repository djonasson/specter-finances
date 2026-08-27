import { describe, it, expect } from 'vitest';
import { sceneScale, SCENE_FULL_WIDTH, SCENE_MIN_SCALE, GROUND_ABOVE_FOOTER } from './stage';

// How a scene meets the window is app policy, not a fact about any one scene:
// two of them disagreeing about the scale at 360px would be a real surprise and
// would fail nothing at all, since the stage asks each scene for its own
// `floor(width)`. Same argument `fitCanvas` is in `chrome.ts` for.

describe('how large a scene is drawn', () => {
  // Pinned at the widths the scenes are laid out against, so the promotion out
  // of `cello/scene.ts` is a move and not a rewrite. These are the numbers the
  // cello was drawn to; anything that changes them changes a scene nobody
  // touched.
  it.each([
    [320, SCENE_MIN_SCALE],
    [360, SCENE_MIN_SCALE],
    [700, 0.72 + ((700 - 360) / (900 - 360)) * (1 - 0.72)],
    [900, 1],
    [1440, 1],
  ])('draws a %ipx window at %f', (width, scale) => {
    expect(sceneScale(width)).toBeCloseTo(scale, 10);
  });

  it('stops shrinking below the narrowest phone, rather than vanishing', () => {
    expect(sceneScale(0)).toBe(SCENE_MIN_SCALE);
    expect(sceneScale(-100)).toBe(SCENE_MIN_SCALE);
  });

  it('does not grow the scenery on a window wider than it was drawn for', () => {
    expect(sceneScale(SCENE_FULL_WIDTH)).toBe(1);
    expect(sceneScale(SCENE_FULL_WIDTH * 3)).toBe(1);
  });

  it('rises without a step from the narrowest phone to full size', () => {
    for (let width = 320; width <= 1000; width += 7) {
      expect(sceneScale(width)).toBeGreaterThanOrEqual(sceneScale(width - 7));
    }
  });
});

describe('where a scene stands', () => {
  // In *screen* pixels, deliberately: a background works the ground out before
  // dividing by the scale, so scaling this too would move the ground twice.
  it('leaves room above the footer for a scene to stand clear of the nav bar', () => {
    expect(GROUND_ABOVE_FOOTER).toBeGreaterThan(0);
  });
});
