// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  sceneScale,
  sceneFloor,
  stageFor,
  clamp,
  SCENE_FULL_WIDTH,
  SCENE_MIN_SCALE,
  GROUND_ABOVE_FOOTER,
} from './stage';
import { FOOTER_HEIGHT, footerHeight } from './chrome';
import { resizeTo } from '../test-utils';

afterEach(() => vi.restoreAllMocks());

describe('how large a scene is drawn', () => {
  it.each([
    [320, SCENE_MIN_SCALE],
    [360, SCENE_MIN_SCALE],
    // Half way between the narrowest phone and the width the scenery was drawn
    // for, so the answer is hand-checkable: 0.72 + 0.5 x 0.28. Written out
    // rather than derived, because an expectation that recomputes the formula
    // agrees with it however wrong it is.
    [630, 0.86],
    [SCENE_FULL_WIDTH, 1],
    [1440, 1],
  ])('draws a %ipx window at %f', (width, scale) => {
    expect(sceneScale(width)).toBeCloseTo(scale, 10);
  });

  it('stops shrinking below the narrowest phone, rather than vanishing', () => {
    expect(sceneScale(120)).toBe(SCENE_MIN_SCALE);
    expect(sceneScale(0)).toBe(SCENE_MIN_SCALE);
  });

  it('does not grow the scenery on a window wider than it was drawn for', () => {
    expect(sceneScale(SCENE_FULL_WIDTH * 3)).toBe(1);
  });

  it('rises without a step from the narrowest phone to full size', () => {
    let previous = sceneScale(200);
    for (let width = 207; width <= 2000; width += 7) {
      const scale = sceneScale(width);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });

  // `>=` alone is satisfied by a staircase — round the scale to two places and
  // every assertion above still passes, while the scenery jumps a size at a
  // time as a window is dragged. Between the two clamps it has to actually
  // climb, every step.
  it('climbs continuously between the clamps, rather than in jumps', () => {
    let previous = sceneScale(361);
    for (let width = 362; width < SCENE_FULL_WIDTH; width += 1) {
      const scale = sceneScale(width);
      expect(scale).toBeGreaterThan(previous);
      previous = scale;
    }
  });

  // The point of the exercise: a phone gets room for the whole scene, measured
  // in the units the layout is written in. At 360px the scene has 500 to place
  // its scenery in, so nothing in it needs a narrow-window case of its own.
  it('gives a phone a wider stage than its screen, in scene units', () => {
    expect(360 / sceneScale(360)).toBeGreaterThan(360);
  });
});

describe('the stage a window makes', () => {
  it('measures the width the fixed canvas actually covers, not the window', () => {
    resizeTo(1024, 768);
    // A classic scrollbar counts towards `innerWidth` but not towards the
    // containing block of a `position: fixed` box, so a stage laid out from the
    // window draws its last strip off the side of the screen.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1009);
    expect(stageFor().width).toBeCloseTo(1009 / sceneScale(1009), 10);
  });

  it('stands the ground clear of the footer, in the scene’s own units', () => {
    resizeTo(SCENE_FULL_WIDTH, 800);
    // Full size, so screen pixels and scene units are the same thing here and
    // the arithmetic is readable.
    expect(stageFor().ground).toBeCloseTo(800 - FOOTER_HEIGHT - GROUND_ABOVE_FOOTER, 10);
  });

  // The footer is measured, not assumed. Replacing `footerHeight()` with the
  // FOOTER_HEIGHT constant passes every other test in this file, and costs a
  // scene its ground for the whole session on any layout where the footer comes
  // out taller than the fallback — the sign-in screen's is the case that bit.
  it('takes the footer as it actually laid out, not as the fallback guesses it', () => {
    resizeTo(SCENE_FULL_WIDTH, 800);
    const footer = document.createElement('div');
    footer.className = 'mantine-AppShell-footer';
    footer.getBoundingClientRect = () => ({ height: 96 }) as DOMRect;
    document.body.appendChild(footer);
    try {
      expect(footerHeight()).toBe(96);
      expect(stageFor().ground).toBeCloseTo(800 - 96 - GROUND_ABOVE_FOOTER, 10);
      // And not what the constant would have given, or the assertion above
      // would pass on a stage that never asked.
      expect(stageFor().ground).not.toBeCloseTo(800 - FOOTER_HEIGHT - GROUND_ABOVE_FOOTER, 10);
    } finally {
      footer.remove();
    }
  });

  it('divides every measurement by the one scale, so the ground keeps its line', () => {
    resizeTo(400, 700);
    const stage = stageFor();
    expect(stage.scale).toBe(sceneScale(400));
    expect(stage.width * stage.scale).toBeCloseTo(400, 10);
    expect(stage.height * stage.scale).toBeCloseTo(700, 10);
    expect(stage.ground * stage.scale).toBeCloseTo(700 - FOOTER_HEIGHT - GROUND_ABOVE_FOOTER, 10);
  });
});

describe('the band a scene asks the app to reserve', () => {
  // Written out rather than computed, and this is the whole point of the block:
  // an expectation that recomputes `ceil(GROUND_ABOVE_FOOTER + reach * scale)`
  // agrees with that line however wrong it is. These nine numbers are what the
  // app actually reserves for the cello today, and every term in the formula
  // moves at least one of them.
  //
  // 414 is not decoration. It is the one width in the sweep whose raw height
  // lands below the half — 136.476 — so it is the only case that can tell
  // `Math.ceil` from `Math.round`, and a band a pixel short leaves the top of
  // the scenery drawn over the user's list.
  const CELLO_REACH = 137;
  const floor = sceneFloor(CELLO_REACH);

  it.each([
    [320, 133],
    [360, 133],
    [390, 135],
    [414, 137],
    [500, 143],
    [630, 152],
    [768, 162],
    [900, 171],
    [1440, 171],
  ])('reserves %ipx of screen as a band %ipx tall', (width, band) => {
    expect(floor(width)).toBe(band);
  });

  it('rounds up rather than to nearest, so a band is never short of its scenery', () => {
    // 34 + 137 x 0.748 = 136.476. Rounded, the band is 136 and the scenery
    // reaches 136.476 — the half pixel the mask cannot cover.
    expect(floor(414)).toBe(137);
    expect(floor(414)).toBeGreaterThan(GROUND_ABOVE_FOOTER + CELLO_REACH * sceneScale(414));
  });

  it('covers the scenery standing in it at every width', () => {
    for (const width of [320, 360, 390, 414, 500, 630, 768, 900, 1440]) {
      expect(floor(width)).toBeGreaterThanOrEqual(CELLO_REACH * sceneScale(width));
    }
  });

  it('shrinks with the scenery, rather than holding back a strip for empty air', () => {
    expect(floor(320)).toBeLessThan(floor(1440));
  });

  // Pinned as a number, not as the constant: `toBe(GROUND_ABOVE_FOOTER)` reads
  // both sides off the same symbol and passes for any value it could hold,
  // including zero — which would stand every scene directly on the nav bar.
  it('stands a scene of no height clear of the footer regardless', () => {
    expect(sceneFloor(0)(1440)).toBe(34);
    expect(sceneFloor(0)(320)).toBe(34);
  });
});

describe('bounding a value', () => {
  it('holds it between the two ends, and passes it through in between', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
