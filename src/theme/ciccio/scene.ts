/**
 * The Ciccio scene, as state and nothing else.
 *
 * Ciccio is a plush hedgehog who lives in one room with two plush squirrels who
 * love him, and whom he loves. He wanders the floor, dances on the spot, runs
 * for a potato gratin when the oven puts one out, watches television from the
 * sofa with a squirrel either side, and sleeps in the bed with the two of them
 * beside him. Wherever he is, he likes to be **between them**.
 *
 * None of this touches a canvas, a window or a clock. Everything advances by
 * `step`, everything random arrives through the `rng` passed in, so a test can
 * run the scene forward frame by frame and get the same answer every time. The
 * drawing lives in `draw.ts` and the wiring in `CiccioBackground.tsx`; this file
 * is the only one that decides what happens.
 *
 * What this file does **not** own, and deliberately: how a window becomes a
 * stage. `sceneScale`, the clearance above the footer and the arithmetic turning
 * a reach into a reserved band all live in `../stage`, so this scene and the
 * cello cannot answer differently how much of the user's list gets covered. The
 * one number this scene contributes is `SCENE_REACH`.
 *
 * Its particles and palette are its own rather than the cello's. Sharing them
 * would make the cello a build dependency of a hedgehog, and the cello's hearts
 * carry a kind and an orbit angle that mean nothing in a living room.
 */

import { clamp, sceneFloor } from '../stage';
import type { SceneSize } from '../stage';

// -- the furniture -----------------------------------------------------------
// Scene units. The room is drawn at `sceneScale`, so these never change with
// the window: a phone gets the same room, drawn smaller.

export const OVEN_WIDTH = 74;
export const OVEN_HEIGHT = 64;
export const OVEN_HOOD_TOP = 104;

export const BED_WIDTH = 104;
export const BED_HEAD = 46;
const BED_MATTRESS = 20;

/** Three seats of cream leather. */
export const SOFA_WIDTH = 116;
export const SOFA_BACK = 52;
const SOFA_SEAT = 24;

/**
 * Wide, thin, and **hung on the wall** rather than stood on anything — which is
 * where a television of this size goes, and which is also why the living room
 * costs the room only a sofa's width: the set is above the sofa, not beside it.
 */
export const TV_WIDTH = 88;
export const TV_PANEL = 46;
/** The bottom of the panel, clear of the sofa's back. */
export const TV_HANGS_AT = 62;

/**
 * How high the room's own wall goes.
 *
 * The band the app reserves is opaque down to the footer, so the strip above
 * the ground is the scene's to paint — and painting it is what stops the room
 * reading as furniture floating on a page. It is the tallest thing here by
 * construction, so it *is* the reach; everything else has to fit under it.
 */
export const WALL_HEIGHT = 118;

/** How deep the room is drawn, for the top faces that give it a third side. */
export const DEPTH = 13;

// The three of them are what the scene is about, so they are drawn a good deal
// larger than a real hedgehog is next to a real oven. Room to grow: they are
// well under the oven's hood, which is what sets the reach.
const CICCIO_HEIGHT = 30;
const SQUIRREL_HEIGHT = 32;
/** How far a squirrel's tail stands above the rest of it. */
const SQUIRREL_TAIL_RISE = 16;

// -- the room ----------------------------------------------------------------

/** The room's own margin at each end, so nothing is drawn against the edge. */
const EDGE = 10;
/** Between one piece of furniture and the next. */
const GAP = 14;

/**
 * How far to either side of him a squirrel stands.
 *
 * His walking range is inset by this at both ends, which is what makes "he is
 * between them" true by construction rather than by a clamp fighting the layout
 * every frame. Without the inset, he walks to the wall and the squirrel that
 * belongs beside him has nowhere to be but on top of him.
 */
export const FLANK_GAP = 42;

/** A walk shorter than this is a hedgehog pacing, not a hedgehog wandering. */
export const MIN_WANDER = 110;

/**
 * How close a squirrel may be squeezed to his side before the invariant bites.
 *
 * Smaller than `FLANK_GAP`: the gap is where one *wants* to stand, this is the
 * nearest it may be pushed while he walks past it. Between the two there is
 * room to lag without ever changing sides — and it is still clear of him,
 * since he is drawn about 46 units long and they would otherwise stand on him.
 */
export const MIN_FLANK = 26;

/** Scene units a frame, at the ~40fps the background loop is throttled to. */
const WALK_SPEED = 0.55;
/**
 * Faster than he walks, or a squirrel he turns towards can never close the gap
 * and spends the rest of the session pinned against `MIN_FLANK`.
 */
const SQUIRREL_SPEED = 0.9;
/** Near enough is near enough: without it they shuffle a fraction for ever. */
const FLANK_SETTLED = 1.2;
/** How much of a turn `facing` takes in one frame. */
const TURN_EASE = 0.08;
/** Chance a frame that he turns round for no reason at all. */
const TURN_CHANCE = 0.0016;

/**
 * Where each spot's surface is, measured up from the ground.
 *
 * This is the table the placement code reads, so `SCENE_REACH` is measured from
 * it too — a seat added here cannot be forgotten in the band the app reserves,
 * which is the one way that band could silently go stale.
 */
export const SEAT_HEIGHT = {
  floor: 0,
  sofa: SOFA_SEAT,
  bed: BED_MATTRESS,
} as const;

/** Which of them somebody is on. */
export type Spot = keyof typeof SEAT_HEIGHT;

/**
 * The tallest thing that sits on a seat.
 *
 * A maximum over both animals rather than over him: taking it off the hedgehog
 * alone is right only for as long as a squirrel's tail happens to be shorter,
 * and a taller squirrel would then be drawn over the user's own list with
 * nothing failing.
 */
const OCCUPANT_REACH = Math.max(CICCIO_HEIGHT, SQUIRREL_HEIGHT + SQUIRREL_TAIL_RISE);

/**
 * How far above the ground the room reaches with nothing in the air.
 *
 * The band the app reserves is derived from this rather than picked to look
 * right, so a taller oven cannot quietly start drawing over the app's own
 * content. What is *thrown* is deliberately not counted — steam off a gratin
 * and hearts over a pair of squirrels are meant to be seen up there, the same
 * way the cello's pizza is.
 */
export const SCENE_REACH = Math.max(
  WALL_HEIGHT,
  OVEN_HOOD_TOP,
  TV_HANGS_AT + TV_PANEL,
  SOFA_BACK,
  BED_HEAD,
  Math.max(...Object.values(SEAT_HEIGHT)) + OCCUPANT_REACH,
);

/**
 * The band this scene needs the app to reserve for it. The scene contributes its
 * reach and nothing else; `sceneFloor` owns the rest, so the clearance and the
 * rounding cannot come out differently here than in any other scene.
 */
export const ciccioFloor = sceneFloor(SCENE_REACH);

export interface Layout {
  /** Left to right, the way the room reads: sleep, then cook, then sit. */
  bedX: number;
  ovenX: number;
  /**
   * The living room, as one number: the sofa stands here and the television
   * hangs on the wall directly above it. Two fields would be two facts that can
   * drift apart, and a set hung a few units off its sofa is exactly the sort of
   * thing nobody notices until it is on a phone.
   */
  loungeX: number;
  /** The rug, which is scenery: nothing reads it, so it has no null case. */
  rugX: number;
  rugWidth: number;
  wanderLeft: number;
  wanderRight: number;
}

/**
 * Bed, then kitchen, then living room — the order somebody would actually walk
 * through a studio flat, rather than the order the pieces happened to be
 * written in. Everything stands against the back wall and he walks the strip of
 * floor in front of all of it, which is why he passes the bed rather than
 * having to be given room for it.
 *
 * **Nothing here is nullable, and that is measured rather than assumed.** At
 * 320px — the narrowest window the app is opened at, which is 444 scene units —
 * the bed, the oven and the living room fit with a gap between each, and his
 * walk is the whole width less a flank at either end: 340 units, against the
 * 110 that would make it worth walking. A null arm that cannot be reached is
 * dead weight in `resizeScene`, in `draw.ts` and in every reader for ever. The
 * sweep in `scene.test.ts` is what keeps it true.
 */
export function layoutFor(width: number): Layout {
  const bedX = EDGE + BED_WIDTH / 2;
  const ovenX = bedX + BED_WIDTH / 2 + GAP + OVEN_WIDTH / 2;

  // The living room is anchored to the right-hand edge and pushed back off the
  // kitchen if the two would meet — which they only do on a window narrower
  // than the app is designed for. Capped rather than merely placed, the way the
  // cello's school is: a piece placed without a cap goes wrong only on a phone,
  // where nobody looks until it ships.
  const kitchenRight = ovenX + OVEN_WIDTH / 2;
  const loungeX = Math.max(kitchenRight + GAP + SOFA_WIDTH / 2, width - EDGE - SOFA_WIDTH / 2);

  // His whole floor, inset by a flank at each end so a squirrel beside him is
  // still in the room. There is no clamp on how short this may get, because at
  // every width the app is opened at it is three times what it needs to be —
  // and a guard that cannot fire is a trap, not a safety net.
  const wanderLeft = EDGE + FLANK_GAP;
  const wanderRight = width - EDGE - FLANK_GAP;

  // Centred on the open floor between the kitchen and the sofa, which is the
  // part of the room he actually walks.
  const openLeft = Math.max(wanderLeft, kitchenRight);
  const openRight = Math.min(wanderRight, loungeX - SOFA_WIDTH / 2);

  return {
    bedX,
    ovenX,
    loungeX,
    rugX: (openLeft + openRight) / 2,
    rugWidth: Math.max(90, (openRight - openLeft) * 0.78),
    wanderLeft,
    wanderRight,
  };
}

// -- the cast ----------------------------------------------------------------

/** What he is doing. One entry today; the scene grows into it. */
export type CiccioPhase = 'wandering';

export interface Ciccio {
  phase: CiccioPhase;
  x: number;
  /** Snaps. Which way he is going. */
  dir: -1 | 1;
  /**
   * Eases between −1 and 1. Which way he is *facing*, which is not the same
   * thing: the squirrel beside him is placed off his position, and a nose that
   * flips in one frame reads as a stumble.
   */
  facing: number;
  /**
   * What he is on now — never where he belongs, and never recovered by
   * comparing his x to a seat's. The first thing that nudges the sofa a unit
   * would leave him unable to get off it, with no error and nothing to see but
   * a hedgehog who stopped moving.
   */
  at: Spot;
}

export interface Squirrel {
  /**
   * Which side of him this one stands, fixed when it is made.
   *
   * Assigning sides by whichever is nearer means one hurry or one resize swaps
   * them, after which they cross him on the way back and "he is between them"
   * is quietly gone — the same failure the cello's colonies had, which agreed
   * only by coincidence and only at exactly two pairs.
   */
  side: -1 | 1;
  at: Spot;
  x: number;
  facing: number;
}

export interface Scene {
  width: number;
  height: number;
  /** The line everyone stands on: feet, oven base, the foot of the bed. */
  ground: number;
  layout: Layout;
  ciccio: Ciccio;
  /** Exactly two, one either side. */
  squirrels: Squirrel[];
  frame: number;
}

type Rng = () => number;

/** How high off the ground somebody on this spot is drawn. */
const spotY = (scene: Scene, at: Spot) => scene.ground - SEAT_HEIGHT[at];

export const ciccioY = (scene: Scene) => spotY(scene, scene.ciccio.at);
export const squirrelY = (scene: Scene, squirrel: Squirrel) => spotY(scene, squirrel.at);

/**
 * Where a squirrel belongs right now.
 *
 * The one place that answers it, so that a squirrel standing on the floor in
 * front of a sofa he is sitting on is not a state the scene can reach. It reads
 * his spot as well as his position, for the same reason.
 */
export function flankX(scene: Scene, side: -1 | 1): number {
  const { wanderLeft, wanderRight } = scene.layout;
  return clamp(scene.ciccio.x + side * FLANK_GAP, wanderLeft - FLANK_GAP, wanderRight + FLANK_GAP);
}

export function createScene(size: SceneSize, rng: Rng): Scene {
  const layout = layoutFor(size.width);
  const scene: Scene = {
    width: size.width,
    height: size.height,
    ground: size.ground,
    layout,
    ciccio: {
      phase: 'wandering',
      x: layout.wanderLeft + (layout.wanderRight - layout.wanderLeft) * rng(),
      dir: rng() < 0.5 ? -1 : 1,
      facing: 1,
      at: 'floor',
    },
    squirrels: [],
    frame: 0,
  };
  scene.squirrels = ([-1, 1] as const).map((side) => ({
    side,
    at: 'floor' as Spot,
    x: flankX(scene, side),
    facing: -side as -1 | 1,
  }));
  return scene;
}

/**
 * A window that changed size, in the order the steps have to happen: the room
 * first, then him, then the two of them — their places are read off his, so
 * placing them before he has moved puts them where he used to be.
 *
 * Nothing here recovers a carried fact by measuring. `at` is left exactly as it
 * was, and he is put back on the seat it names in the room's new coordinates.
 */
export function resizeScene(scene: Scene, size: SceneSize): void {
  scene.width = size.width;
  scene.height = size.height;
  scene.ground = size.ground;
  scene.layout = layoutFor(size.width);

  const { wanderLeft, wanderRight, loungeX, bedX } = scene.layout;
  if (scene.ciccio.at === 'sofa') scene.ciccio.x = loungeX;
  else if (scene.ciccio.at === 'bed') scene.ciccio.x = bedX;
  else scene.ciccio.x = clamp(scene.ciccio.x, wanderLeft, wanderRight);

  for (const squirrel of scene.squirrels) squirrel.x = flankX(scene, squirrel.side);
}

// -- one frame ---------------------------------------------------------------

/**
 * He walks his floor, turning at the ends and now and then for no reason.
 *
 * `x` is snapped to the bound it reached rather than left a fraction past it:
 * left to drift, a walk at a speed the range is not a multiple of creeps
 * further out of the room every lap.
 */
function walkCiccio(scene: Scene, rng: Rng): void {
  const { ciccio } = scene;
  const { wanderLeft, wanderRight } = scene.layout;

  ciccio.x += ciccio.dir * WALK_SPEED;
  if (ciccio.x <= wanderLeft) {
    ciccio.x = wanderLeft;
    ciccio.dir = 1;
  } else if (ciccio.x >= wanderRight) {
    ciccio.x = wanderRight;
    ciccio.dir = -1;
  } else if (rng() < TURN_CHANCE) {
    ciccio.dir = ciccio.dir === 1 ? -1 : 1;
  }

  // The nose follows the feet, over about a dozen frames.
  ciccio.facing += clamp(ciccio.dir - ciccio.facing, -TURN_EASE, TURN_EASE);
}

/**
 * They keep to his side, with a lag and a dead zone — and then are held there.
 *
 * Two mechanisms, and both are load-bearing. The layout insets his range by a
 * flank at each end, so there is always somewhere legal for a squirrel to
 * stand; the clamp below is what makes it true on the frames in between, when
 * he has walked past one that has not caught up yet. Lag alone inverts the pair
 * the first time he outruns it, and from then on the left squirrel is on the
 * right — with nothing failing, and the one thing the scene is about quietly
 * gone.
 *
 * Which way they *face* is not taken from which way they moved. The one ahead
 * of him is pushed rather than chasing, so it rides the edge of the dead zone —
 * inside it one frame and outside the next — and a facing read off the movement
 * flipped every frame, strobing the whole figure, which the drawing mirrors
 * about it. They look at him: stable by construction, and what a squirrel who
 * loves a hedgehog would be doing anyway.
 */
function followSquirrels(scene: Scene): void {
  for (const squirrel of scene.squirrels) {
    const target = flankX(scene, squirrel.side);
    const away = target - squirrel.x;
    if (Math.abs(away) > FLANK_SETTLED) {
      const move = clamp(away, -SQUIRREL_SPEED, SQUIRREL_SPEED);
      squirrel.x += move;
      // Faces the way it is going, and *keeps* that when it is not going
      // anywhere. Both halves matter and each was a bug on its own: recomputed
      // every frame off the movement, the one being pushed along in front of
      // him rode the edge of the dead zone and strobed; pinned to look at him
      // instead, the same squirrel slid backwards down the room. Held, it turns
      // when the pair turns and walks the way it faces.
      squirrel.facing = move > 0 ? 1 : -1;
    }

    squirrel.x =
      squirrel.side === -1
        ? Math.min(squirrel.x, scene.ciccio.x - MIN_FLANK)
        : Math.max(squirrel.x, scene.ciccio.x + MIN_FLANK);
  }
}

/** One frame. Everything mutates `scene`; nothing here reads a clock. */
export function step(scene: Scene, rng: Rng): void {
  scene.frame++;
  walkCiccio(scene, rng);
  followSquirrels(scene);
}
