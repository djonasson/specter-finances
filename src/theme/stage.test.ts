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
import { FOOTER_HEIGHT } from './chrome';
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
  const floor = sceneFloor(100);

  it('covers the scenery standing in it at every width', () => {
    for (const width of [320, 360, 414, 700, 900, 1440]) {
      expect(floor(width)).toBeGreaterThanOrEqual(100 * sceneScale(width));
    }
  });

  it('shrinks with the scenery, rather than holding back a strip for empty air', () => {
    expect(floor(320)).toBeLessThan(floor(1440));
  });

  it('rounds up, so a band is never half a pixel shorter than what stands in it', () => {
    // 137 x 0.72 = 98.64: rounding would take the band below the scenery and
    // leave the tallest thing drawn over the user's list.
    expect(sceneFloor(137)(320)).toBe(Math.ceil(GROUND_ABOVE_FOOTER + 137 * SCENE_MIN_SCALE));
    expect(Number.isInteger(sceneFloor(137)(320))).toBe(true);
  });

  it('gives every scene the same clearance, whatever it is made of', () => {
    expect(sceneFloor(0)(1440)).toBe(GROUND_ABOVE_FOOTER);
  });
});

describe('bounding a value', () => {
  it('holds it between the two ends, and passes it through in between', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
