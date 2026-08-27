import { footerHeight, viewportSize } from './chrome';

/**
 * How a window becomes a stage for a scene to stand on.
 *
 * This is app policy rather than a fact about any one scene, and it lives here
 * for the reason `fitCanvas` lives in `chrome.ts`: every canvas background needs
 * it, and a scene that quietly used its own numbers would simply be laid out at
 * a different size — nothing would fail. `BackgroundStage` asks each scene for
 * its own `floor(width)`, so two scenes disagreeing about the scale at 360px
 * would never once show up as an error.
 *
 * What stays with a scene: how tall its scenery is. What it gets from here: the
 * stage that scenery stands on, and the arithmetic turning a reach into the band
 * the app reserves. A scene tells the app how tall it is; it does not also
 * decide what a window is.
 */

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A scene stands this far above the app's footer, in *screen* pixels. */
export const GROUND_ABOVE_FOOTER = 34;

/**
 * The window width a scene is drawn for. Wider than this changes nothing — the
 * scenery does not grow, it just has more room to stand in.
 */
export const SCENE_FULL_WIDTH = 900;
/** Narrow enough that a phone fits the scene; small enough is not smaller still. */
export const SCENE_MIN_SCALE = 0.72;
/** The width at which the shrinking stops, being about the narrowest phone. */
const SCENE_MIN_WIDTH = 360;

/**
 * How large to draw a scene on a window this wide.
 *
 * A scene is drawn scaled rather than laid out differently, and everything in it
 * goes on working in the units it was written in — a phone simply hands it a
 * wider stage (`width / sceneScale(width)`) with smaller scenery on it. The
 * alternative, a narrow-window case in every measurement a scene makes, is the
 * one this exists to avoid.
 */
export function sceneScale(width: number): number {
  const range = SCENE_FULL_WIDTH - SCENE_MIN_WIDTH;
  const along = (width - SCENE_MIN_WIDTH) / range;
  return clamp(SCENE_MIN_SCALE + along * (1 - SCENE_MIN_SCALE), SCENE_MIN_SCALE, 1);
}

/** The stage a scene is handed: its own units, and the line everyone stands on. */
export interface SceneSize {
  width: number;
  height: number;
  ground: number;
}

/**
 * The stage as it is right now, in the scene's own units.
 *
 * Three readings here are load-bearing and each cost a bug to learn, which is
 * why they are made once for every scene rather than per background:
 *
 * - the width comes from `viewportSize`, not `innerWidth`, because a classic
 *   scrollbar counts towards the latter but not towards the containing block of
 *   the `position: fixed` canvas — laid out from it, the last strip of the scene
 *   is drawn off the side of the screen;
 * - the height stays `innerHeight`, since `clientHeight` is the layout viewport
 *   and does not move when a phone's URL bar collapses, while the footer does;
 * - the footer is *measured*, not assumed, and measured here rather than cached,
 *   so a footer that lays out taller than the sign-in screen's fallback does not
 *   leave the ground where it was for the session.
 *
 * `scale` comes back with the size because the caller needs it for `drawScene`
 * and for dividing clicks, and recomputing it there would be a second reading of
 * a width that may have changed in between.
 */
export function stageFor(): SceneSize & { scale: number } {
  const seen = viewportSize();
  const scale = sceneScale(seen.width);
  const ground = seen.height - footerHeight() - GROUND_ABOVE_FOOTER;
  return {
    width: seen.width / scale,
    height: seen.height / scale,
    ground: ground / scale,
    scale,
  };
}

/**
 * The band a scene of this reach needs the app to reserve for it.
 *
 * A scene owns the reach — how tall its own scenery is — and nothing else here:
 * the clearance, the scaling and the rounding are the same for every scene, and
 * two copies of them would be two answers to how much of the user's list gets
 * covered. It follows the width because the scenery does, since a narrow window
 * draws the whole scene smaller and a band sized for full-width scenery would
 * hold back a strip of the list for empty air.
 *
 * Rounded **up**, not just rounded: a band half a pixel shorter than the scenery
 * standing in it leaves the top of the tallest thing drawn over the user's list,
 * and a fractional height gives the mask a seam to peek through.
 */
export function sceneFloor(reach: number): (width: number) => number {
  return (width) => Math.ceil(GROUND_ABOVE_FOOTER + reach * sceneScale(width));
}
