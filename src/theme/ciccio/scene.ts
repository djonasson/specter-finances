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

export const OVEN_WIDTH = 72;
const OVEN_HEIGHT = 66;
const OVEN_HOOD = 44;

export const BED_WIDTH = 100;
const BED_HEAD = 44;
const BED_MATTRESS = 18;

export const SOFA_WIDTH = 88;
const SOFA_BACK = 50;
const SOFA_SEAT = 22;

export const TV_WIDTH = 54;
const TV_STAND = 24;
const TV_SET = 46;

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
/** He keeps this clear of the oven: it is hot, and he is made of plush. */
const OVEN_CLEARANCE = 16;
/** And this clear of the sofa, which he climbs rather than walks through. */
const SOFA_CLEARANCE = 14;
const TV_GAP = 12;

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
  OVEN_HEIGHT + OVEN_HOOD,
  TV_STAND + TV_SET,
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
  ovenX: number;
  /** Against the back wall, and *inside* his walk — he passes it. */
  bedX: number;
  sofaX: number;
  tvX: number;
  /** The rug, which is scenery: nothing reads it, so it has no null case. */
  rugX: number;
  rugWidth: number;
  wanderLeft: number;
  wanderRight: number;
}

/**
 * The oven at one end, the sofa and the television at the other, and the floor
 * between them.
 *
 * **Nothing here is nullable, and that is a measured claim rather than an
 * oversight.** The bed stands against the back inside his walk rather than
 * competing with it, so it never has to be given up; and at 320px — the
 * narrowest window the app is opened at, which is 444 scene units — the oven,
 * the sofa and the television leave 116 units of flanked walk against a
 * `MIN_WANDER` of 110. A `bed: Bed | null` whose null arm cannot be reached
 * would be dead weight in `resizeScene`, in `draw.ts` and in every reader for
 * ever. The sweep in `scene.test.ts` is what keeps that true: widen a piece
 * past the room and it goes red rather than going quietly wrong.
 */
export function layoutFor(width: number): Layout {
  const ovenX = EDGE + OVEN_WIDTH / 2;
  const tvX = width - EDGE - TV_WIDTH / 2;
  const sofaX = tvX - TV_WIDTH / 2 - TV_GAP - SOFA_WIDTH / 2;

  const wanderLeft = ovenX + OVEN_WIDTH / 2 + OVEN_CLEARANCE;
  // Floored at a walk worth walking. On a window too narrow for both he walks
  // the last of it in front of the sofa rather than losing the walk, which is
  // the one thing the scene cannot do without — he is drawn over the furniture,
  // so it costs a little overlap and nothing else.
  const wanderRight = Math.max(wanderLeft + MIN_WANDER, sofaX - SOFA_WIDTH / 2 - SOFA_CLEARANCE);

  const bedX = wanderLeft + BED_WIDTH / 2 + 6;
  const rugX = (wanderLeft + wanderRight) / 2;

  return {
    ovenX,
    bedX,
    sofaX,
    tvX,
    rugX,
    rugWidth: Math.max(80, (wanderRight - wanderLeft) * 0.72),
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

  const { wanderLeft, wanderRight, sofaX, bedX } = scene.layout;
  if (scene.ciccio.at === 'sofa') scene.ciccio.x = sofaX;
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
 */
function followSquirrels(scene: Scene): void {
  for (const squirrel of scene.squirrels) {
    const target = flankX(scene, squirrel.side);
    const away = target - squirrel.x;
    if (Math.abs(away) > FLANK_SETTLED) {
      squirrel.x += clamp(away, -SQUIRREL_SPEED, SQUIRREL_SPEED);
      squirrel.facing = away > 0 ? 1 : -1;
    } else {
      // Settled: turn and look at him rather than staring down the room.
      squirrel.facing = -squirrel.side as -1 | 1;
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
