/**
 * How a scene meets the window.
 *
 * These are app policy rather than facts about any one scene, and they live here
 * for the reason `fitCanvas` lives in `chrome.ts`: every canvas background needs
 * them, and a scene that quietly used its own numbers would simply be laid out
 * at a different size — nothing would fail. `BackgroundStage` asks each scene for
 * its own `floor(width)`, so two scenes disagreeing about the scale at 360px
 * would never once show up as an error.
 *
 * What belongs to a scene and not here: how tall its scenery is, where its
 * furniture stands, and the `floor(width)` it works out from those. Only the
 * conversion between a window and a stage is shared.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The scene stands this far above the app's footer, in *screen* pixels. */
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

/**
 * The stage a scene is handed: its own units, and the line everyone stands on.
 *
 * `ground` arrives already converted, since the component works it out from the
 * measured footer in screen pixels before dividing by the scale.
 */
export interface SceneSize {
  width: number;
  height: number;
  ground: number;
}
