import { BACKGROUND_NAMES, isBackgroundName, PLAIN_BACKGROUND } from './registry';
import type { BackgroundName } from './registry';

/**
 * What a first shuffle leaves out: the plain background, and nothing else.
 *
 * `none` starts turned off because "surprise me" asking for a blank screen is a
 * choice worth making deliberately, not a default.
 */
export const DEFAULT_EXCLUDED: readonly BackgroundName[] = [PLAIN_BACKGROUND];

/**
 * The backgrounds a shuffle picks from, given the ones that were turned off.
 *
 * **Derived from the registry, never stored.** The setting holds what the user
 * turned *off*; a background added to `BACKGROUNDS` later is in nobody's stored
 * list, so it joins every existing shuffle the day it ships. Stored the other
 * way round — as the list that was ticked — it would join nobody's: the moment
 * anyone changes any theme setting, the whole settings object is written back,
 * freezing their pool to the backgrounds that happened to exist that day.
 */
export function poolFrom(excluded: readonly BackgroundName[]): BackgroundName[] {
  return BACKGROUND_NAMES.filter((value) => !excluded.includes(value));
}

/**
 * The exclusions that leave exactly this pool — what the drawer's checkboxes,
 * which speak in backgrounds to shuffle between, mean in stored terms.
 */
export function excludedFor(pool: readonly string[]): BackgroundName[] {
  const wanted = new Set(pool.filter(isBackgroundName));
  return BACKGROUND_NAMES.filter((value) => !wanted.has(value));
}

/**
 * The names in a stored exclusion list that still answer to a background.
 *
 * A stored `[]` is kept, not refilled: it means nothing was turned off. Anything
 * that is not a list at all is not an instruction, so that falls back.
 *
 * Dropping a name this build does not recognise puts a background back *into*
 * the shuffle, which is the harmless direction — the same pruning over a stored
 * list of inclusions emptied the pool instead, leaving a blank screen and a
 * drawer reporting a choice the user never made.
 */
export function toExcluded(value: unknown): BackgroundName[] {
  if (!Array.isArray(value)) return [...DEFAULT_EXCLUDED];
  return [...new Set(value.filter(isBackgroundName))];
}

/**
 * The background a shuffle lands on, given a roll in [0, 1).
 *
 * Pure and takes its randomness as a parameter — the same rule Cello's scene
 * follows — so what the shuffle does is something a test can hold still. An
 * empty pool resolves to the plain background rather than to one the user
 * turned off.
 */
export function pickBackground(pool: readonly BackgroundName[], roll: number): BackgroundName {
  if (pool.length === 0) return PLAIN_BACKGROUND;

  const safeRoll = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 1) : 0;
  const index = Math.min(Math.floor(safeRoll * pool.length), pool.length - 1);
  return pool[index];
}
