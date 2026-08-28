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

import { clamp, sceneFloor, toward } from '../stage';
import type { SceneSize } from '../stage';

// -- the furniture -----------------------------------------------------------
// Scene units. The room is drawn at `sceneScale`, so these never change with
// the window: a phone gets the same room, drawn smaller.

export const OVEN_WIDTH = 74;
export const OVEN_HEIGHT = 64;
/** The worktop over it, which is the tallest the kitchen gets. */
export const OVEN_TOP = OVEN_HEIGHT + 5;

export const BED_WIDTH = 104;
export const BED_HEAD = 60;
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
 *
 * Set to give a 170px band at desktop, which is the whole of what this theme
 * was budgeted. Most of the extra over a room's worth of furniture goes to the
 * squirrel who climbs it: `CLIMB_MAX` is what is left once one of them and its
 * tail are subtracted, so raising the ceiling is how it gets to climb higher.
 */
export const WALL_HEIGHT = 136;

/** How deep the room is drawn, for the top faces that give it a third side. */
export const DEPTH = 13;

// The three of them are what the scene is about, so they are drawn a good deal
// larger than a real hedgehog is next to a real oven. Room to grow: they are
// well under the room's own ceiling, which is what sets the reach.
export const CICCIO_HEIGHT = 30;
const SQUIRREL_HEIGHT = 32;
/**
 * How far a squirrel's tail stands above the rest of it.
 *
 * It stands straight up rather than curling over, so it is the tallest thing
 * about a squirrel by some way — and `OCCUPANT_REACH` is measured off the
 * taller of the two animals for exactly this reason.
 */
const SQUIRREL_TAIL_RISE = 32;

// -- the room ----------------------------------------------------------------

/** The room's own margin at each end, so nothing is drawn against the edge. */
const EDGE = 10;
/** Between one piece of furniture and the next. */
const GAP = 14;
/**
 * How far along the span between the bed and the sofa the kitchen stands.
 *
 * Half way, so the kitchen sits in the middle of the room with the bed at one
 * end and the living room at the other, rather than leaning towards either.
 *
 * A share rather than a distance, for the reason the cello's home end is one: a
 * fixed offset from the bed puts the cooker beside the pillow on every window,
 * and the room grows entirely into one empty middle.
 */
const KITCHEN_ALONG = 0.5;

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

/**
 * How fast they manage while he is dashing for a gratin.
 *
 * Between their walking pace and his running one, and both halves matter.
 *
 * Slower than he runs, so the gap *grows* the whole way across the room — he
 * pulls further ahead every frame, which is what being beside yourself about a
 * potato gratin looks like. Matched to him, or offset by a fixed distance
 * instead, the gap is a constant and the dash looks exactly like the walk with
 * everybody shifted along.
 *
 * But well *above* the half-unit a frame that keeping up with a stroll costs
 * them, or they amble after him and only break into a run once he has stopped
 * and they are closing a gap — which is precisely backwards. Their stride is
 * taken from the ground they cover, so twice the speed is visibly twice the
 * scampering. They are back at their own top speed the moment it is over.
 *
 * Being between them is otherwise held by a clamp that will not let him past,
 * and that clamp is lifted for the length of a dash. It is a real, deliberate
 * hole in the invariant this scene is about, and it is the right one: he likes
 * to be between them *where he feels comfortable*, and this is not that.
 */
export const DASH_FOLLOW_SPEED = 1.7;

/** Scene units a frame, at the ~40fps the background loop is throttled to. */
export const WALK_SPEED = 0.55;
/**
 * Faster than he *runs*, not merely faster than he walks.
 *
 * Set between the two, a squirrel could keep up with a stroll but not with a
 * dash for a gratin — so the clamp that keeps him between them dragged it along
 * instead, which is a teleport wearing a squirrel suit. It has to beat
 * `SUMMON_SPEED` too, which is faster again: at anything less, the one he runs
 * *away* from on a summons trails behind and arrives after the other. It is the
 * fastest anybody in this room moves, and the max-step test is asserted
 * against it.
 */
export const SQUIRREL_SPEED = 3.4;
/** Near enough is near enough: without it they shuffle a fraction for ever. */
export const FLANK_SETTLED = 1.2;
/** How much of a turn `facing` takes in one frame. */
const TURN_EASE = 0.08;
/** Chance a frame that he turns round for no reason at all. */
const TURN_CHANCE = 0.0016;

// -- the dance ---------------------------------------------------------------

const TAU = Math.PI * 2;
/** How many times round he goes, wobbling, before he has had enough. */
const WOBBLE_TURNS = 2;
/** Radians a frame. Slow enough to read as a wobble rather than a blur. */
const WOBBLE_SPEED = 0.075;
/** Chance a frame that he starts one himself. */
const WOBBLE_CHANCE = 0.0011;
/**
 * How narrow he may be drawn passing edge-on, as a share of full width.
 *
 * Exported for the test that pins it — the drawing asks `ciccioFacing`, which
 * is where it is applied.
 */
export const CICCIO_NARROWEST = 0.3;

// -- what they say -----------------------------------------------------------

// -- the oven ----------------------------------------------------------------

/**
 * How many mouthfuls a gratin is.
 *
 * There is no oven timer, and there was not one for a while before this said
 * so: `oven.nextIn` was seeded and then never read or decremented, while eight
 * lines of comment above it explained how it had been tuned. Gratins come from
 * the rota and from a tap on the cooker, both of which go through
 * `serveGratin`.
 */
export const GRATIN_BITES = 150;
/** How close he has to be to it to be eating it rather than near it. */
const BITE_REACH = 26;
/**
 * Scene units a frame. Well over four times a walk: it is a gratin.
 *
 * At 1.35 he was only a fifth quicker than the squirrels behind him, so neither
 * he nor they read as running and the gap crept open at a quarter-unit a frame.
 */
export const RUN_SPEED = 2.4;
/** And faster again when somebody has just asked for it by tapping. */
const SUMMON_SPEED = 3.1;
/**
 * On his way to the next thing on the rota.
 *
 * Above a stroll and well below a run: he is going somewhere on purpose rather
 * than pottering, and at his wandering pace the walk across a wide room to the
 * sofa was most of the time he spent watching anything.
 */
const ERRAND_SPEED = 0.95;
export const MAX_STEAM = 14;

// -- getting on and off things -----------------------------------------------

/** How much of the turning-down happens in one frame. */
const BED_TURN_SPEED = 0.045;

/** Frames a climb on or off takes. */
export const CLIMB_FRAMES = 14;
/**
 * How much of a seat is covered in one frame, as a fraction of it.
 *
 * Named rather than written out at each site, which is the same argument
 * `toward` in `theme/stage.ts` makes for itself: everybody climbs at one rate,
 * and five copies of `1 / CLIMB_FRAMES` is five places to change it in.
 */
const LIFT_STEP = 1 / CLIMB_FRAMES;

/**
 * The last stretch of a programme, when the screen turns to a zebra — about
 * five seconds at the rate the frame loop is throttled to.
 *
 * Derived from the time left rather than stored beside it, the way the lit
 * window is: a zebra on a set that is not about to go off is not a state the
 * scene can reach, and there is nothing to keep in step.
 */
const ZEBRA_FRAMES = 200;

/** How long a programme lasts, and how long a nap does. */
const SHOW_FRAMES = 3400;
const NAP_FRAMES = 2200;
/** He stays put this long once seated, so a walk over is never wasted. */
const MIN_SIT = 400;
const STEAM_EVERY = 16;

// -- what happens, and how often ----------------------------------------------

export const SQUIRREL_SCOLD = 'Pfff!';

export const CAT_CALL = 'Meow!';
/**
 * Roughly how much *pottering* there is between visits — measured in the frames
 * he is actually free, not in frames of the clock, since that is the only kind
 * this counts (see `runCat`). Retuned from 2100 when the counter stopped
 * running down through meals and programmes: over four seeded fifty-minute days
 * that put the first cat at 65 seconds and one every two and a half minutes
 * after, which is the "quietly never" the measurement in `scene.test.ts` exists
 * to catch.
 *
 * **Deliberately not `ROUTINE_GAP`.** At 1500 it was exactly the rota's period,
 * and since `catMayCall` is a superset of the rota's own `free` gate the two
 * counters tick on the same frames from the same start — so they run down
 * together, the rota fires first and sends him off, the cat's freezes at 1 for
 * the whole errand, and it is let in on the first frame he is free again. That
 * is the pouncing the gating was written to stop, arrived at by resonance
 * instead: 78.5% of visits within a quarter of a second of him becoming free,
 * against 4.3% at the old 2100 and 1.8% here. A *shorter* interval giving a
 * *lower* rate is the tell that it is the coincidence and not the number.
 */
const CAT_INTERVAL = 1700;

/** Frames of pottering between one thing on the rota and the next. */
const ROUTINE_GAP = 1500;
/**
 * What he does, in order, for ever: potter, eat, potter, watch something,
 * potter, sleep, potter, eat...
 *
 * A rota rather than three independent chances. Rolled separately they came out
 * in any order and sometimes not at all — a whole seeded day could go by with
 * the television never once on — and the only way to see the scene was to sit
 * through a great deal of it. Taps still interrupt whatever is happening; they
 * do not shuffle the order.
 */
const ROTA = ['eat', 'watch', 'sleep'] as const;
/**
 * Scene units a frame.
 *
 * A cat is in no hurry, but at a stroll it spent the better part of fifteen
 * seconds crossing a wide room before anything happened — which is a long time
 * to watch something approach. It trots.
 */
const CAT_SPEED = 2.3;
/** How close it comes before speaking kindly to him. */
export const CAT_NEAR = 48;
const MEOW_FRAMES = 110;
const KISS_FRAMES = 90;
/** How much of the bristling happens in one frame. */
const BRISTLE_SPEED = 0.05;
export const MAX_HEARTS = 10;

export const CICCIO_CALL = 'Ciccio Ciccio!';
export const CICCIO_GRATIN = 'Ciccio pasticcio!';
export const SQUIRREL_CALL = 'Susin!';

/** Frames a line stays up: long enough to read, short enough not to nag. */
const SAY_FRAMES = 110;
/** Chance a frame that one of them starts the round off. */
const CHATTER_CHANCE = 0.0012;
/** Frames between one of them speaking and the next taking their turn. */
const CHATTER_GAP = 36;

/**
 * Give somebody a line, replacing whatever they were saying.
 *
 * Replacing rather than queueing is the whole of it: queued, the line for
 * spotting a gratin would wait behind an idle "Ciccio Ciccio!" and he would
 * announce the food after eating it.
 */
export function say(who: { say: Say | null }, line: string): void {
  who.say = { line, left: SAY_FRAMES };
}

function runSaying(who: { say: Say | null }): void {
  if (who.say && --who.say.left <= 0) who.say = null;
}

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
 * Where an errand leads, and the only place that knows.
 *
 * Written out at each site it was five copies of the same three-way choice, one
 * of them a chain whose final `else` silently caught anything unlisted — so a
 * fourth `Errand` would have compiled and quietly mis-aimed every resize. The
 * `switch` is exhaustive over the union instead, which makes that a build
 * error.
 *
 * `undefined` means the thing it was for is gone, which only a meal can be.
 */
export function errandTarget(scene: Scene, errand: Errand): number | undefined {
  switch (errand) {
    case 'eat':
      return scene.gratin?.x;
    case 'sit':
      return scene.layout.loungeX;
    case 'sleep':
      return scene.layout.bedX;
  }
}

/**
 * The most anybody's height may change in one frame.
 *
 * The tallest seat over the frames a climb takes, and the whole reason
 * `mounting` and `dismounting` exist: without frames that own the change, he is
 * on the rug the frame after he was on a cushion, and all three of them snap at
 * once. It is asserted rather than described.
 *
 * **Written out, not derived**, and that is the point: it has no reader in the
 * scene at all — it exists to be the bound the tests hold everybody to. Taken
 * off `SEAT_HEIGHT` it became the very expression the movers step by, so
 * raising the sofa to 60 moved everybody 4.29 units a frame, two and a half
 * times the old bound, with all four max-step cases still green because the
 * bound had grown with them. `scene.test.ts` pins this against the table
 * instead, so a taller seat fails there, loudly and by name — the same shape as
 * `MAX_PIXEL_RATIO`, which is asserted to be 2 beside a buffer pinned at 1600.
 */
export const MAX_CLIMB = 24 / CLIMB_FRAMES;

/**
 * The tallest thing that sits on a seat.
 *
 * A maximum over both animals rather than over him: taking it off the hedgehog
 * alone is right only for as long as a squirrel's tail happens to be shorter,
 * and a taller squirrel would then be drawn over the user's own list with
 * nothing failing.
 */
/** The tallest a squirrel gets: the top of its tail. */
export const SQUIRREL_REACH = SQUIRREL_HEIGHT + SQUIRREL_TAIL_RISE;

const OCCUPANT_REACH = Math.max(CICCIO_HEIGHT, SQUIRREL_REACH);

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
  OVEN_TOP,
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

/**
 * How high one can get up the wall before the room runs out.
 *
 * **Derived from the wall, not chosen**: the tallest part of a squirrel is the
 * top of its tail, and the band the app reserves ends at `WALL_HEIGHT`. Pick a
 * number instead and the first time either of those moves, a squirrel climbs
 * out through the ceiling and over the user's own list, with nothing to say so.
 */
export const CLIMB_MAX = WALL_HEIGHT - SEAT_HEIGHT.sofa - SQUIRREL_REACH;
const CLIMB_SPEED = 0.55;
/**
 * How high the one doing the fetching goes: just under him, near enough to be
 * collecting him rather than joining him.
 */
const ESCORT_BELOW = CLIMB_MAX - 10;
/** How long he stays up there working out that he cannot get down. */
const STUCK_FRAMES = 150;
/** And how long the telling-off lasts. */
const SCOLD_FRAMES = 130;
/** Chance a frame, while they are watching something, that one goes up. */
const RESCUE_CHANCE = 0.0022;
/**
 * Chance a frame, while one is on its way up, that the other calls it down.
 *
 * A climb takes about ninety frames, so this comes out at roughly half of them
 * ending in a telling-off part way up and the other half going all the way to
 * the top and needing fetching. Without it every single climb ran the whole
 * drama, which is a lot of ceremony for something meant to happen "sometimes" —
 * and the scene only has the one version of it to show.
 */
const CALL_DOWN_CHANCE = 0.0165;
/**
 * The stretch of the climb over which it may be called back.
 *
 * Bounded at both ends. Above the top of it there is no point — it may as well
 * finish, and being called back from there reads as the other one changing its
 * mind. Below the bottom of it there is nothing to see: told off on the first
 * frame it has not left the sofa yet, and the whole thing plays out as a
 * squirrel twitching.
 */
const CALL_DOWN_FROM = 0.28;
const CALL_DOWN_UNTIL = 0.78;

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

  // The living room is anchored to the right-hand edge and pushed back off the
  // bed if the two would meet — which they only do on a window narrower than
  // the app is designed for. Capped rather than merely placed, the way the
  // cello's school is: a piece placed without a cap goes wrong only on a phone,
  // where nobody looks until it ships.
  const loungeX = Math.max(
    bedX + BED_WIDTH / 2 + GAP * 2 + OVEN_WIDTH + SOFA_WIDTH / 2,
    width - EDGE - SOFA_WIDTH / 2,
  );

  // The kitchen goes *between* the two rather than up against the bed. Anchored
  // to the bed it stood a gap's width from the pillow at every window size, so
  // a wide room read as a bedsit with a cooker in it and a thousand units of
  // empty floor beyond — not as three places. Placed along the span, the three
  // areas grow apart as the room does.
  const bedRight = bedX + BED_WIDTH / 2;
  const loungeLeft = loungeX - SOFA_WIDTH / 2;
  // No clamp: `loungeX` above already floors the span at `GAP * 2 + OVEN_WIDTH`,
  // which is exactly what a centred cooker needs, so a clamp here could never
  // once bind — and a guard that cannot fire is a trap, not a safety net. What
  // keeps it honest is the width sweep asserting the two gaps, which is also
  // what would catch `KITCHEN_ALONG` being moved off centre.
  const ovenX = bedRight + (loungeLeft - bedRight) * KITCHEN_ALONG;

  // His whole floor, inset by a flank at each end so a squirrel beside him is
  // still in the room. There is no clamp on how short this may get, because at
  // every width the app is opened at it is three times what it needs to be —
  // and a guard that cannot fire is a trap, not a safety net.
  const wanderLeft = EDGE + FLANK_GAP;
  const wanderRight = width - EDGE - FLANK_GAP;

  return {
    bedX,
    ovenX,
    loungeX,
    wanderLeft,
    wanderRight,
  };
}

// -- the cast ----------------------------------------------------------------

/** Why he is crossing the room. */
export type Errand = 'eat' | 'sit' | 'sleep';

/** What he is doing. */
export type CiccioPhase =
  | 'wandering'
  | 'wobbling'
  | 'heading'
  | 'eating'
  | 'mounting'
  | 'dismounting'
  | 'sitting'
  | 'sleeping'
  | 'bristling';

/**
 * What somebody is saying, and for how long.
 *
 * The scene owns the words and the countdown; how wide the bubble has to be to
 * hold them is `draw.ts`'s, because it is the only one with a canvas to measure
 * text on. Two owners of one fact is what the cello's peel and pizza were.
 */
export interface Say {
  line: string;
  left: number;
}

export interface Ciccio {
  phase: CiccioPhase;
  /**
   * How far round the dance has come, in radians, accumulated.
   *
   * Compared against a total with `>=` and never with a modulus: `spin % TAU`
   * makes the exit depend on the angle it started at and on how far one frame
   * carries it, and some starts step straight over the window and spin for
   * ever. Separate from `facing`, which is the walk's — sharing one field, the
   * walk resumes from wherever the spin last left it and he flips.
   */
  spin: number;
  /**
   * What the dance hands off to when it finishes.
   *
   * One wobble, two callers: the one he does for no reason and the happy one
   * before a meal are the same machinery, and two copies would drift apart the
   * first time either was tuned. `eating` is *guarded* on entry rather than
   * trusted — a stale value from a click-dance far from any food would have him
   * eating the carpet.
   */
  after: 'wandering' | 'eating';
  /** Where he is going and why, or nothing. */
  /**
   * Where he is going and why. `urgent` marks a goal somebody asked for by
   * tapping the thing itself, which he goes to at a trot rather than a stroll —
   * a click nobody sees answered for twenty seconds reads as a click that did
   * nothing.
   */
  /**
   * Where he is going and **why**. `then` is the reason, not the thing he does
   * on arrival: 'eat' told the pace, the hand-off, the run pose and whether
   * food may re-target him, all off one value that happened to mean "gratin"
   * today. Named for the reason, the next errand that ends in a dance does not
   * silently become a dash for food.
   *
   * `urgent` marks a goal somebody asked for by tapping the thing itself, which
   * he goes to at a trot — a click nobody sees answered for twenty seconds
   * reads as a click that did nothing.
   */
  goal: { x: number; then: Errand; urgent: boolean } | null;
  /**
   * How far onto `at` he has got, 0 to 1.
   *
   * The seat is named from the *start* of a climb and the height is this
   * fraction of it, which is what makes an interrupt mid-climb safe: he turns
   * round from wherever he had reached. Taken off a timer with `at` only set at
   * the end, three separate things dropped him a whole cushion in one frame — a
   * tap during a mount (`at` still said floor, so the interrupt sent him
   * walking), a tap during a dismount (the timer reset and yanked him back up),
   * and a destination that changed under an interpolation still aiming at the
   * old one.
   */
  lift: number;
  /** Frames left of the sit or the sleep. */
  timer: number;
  say: Say | null;
  /**
   * How far his spines are up, 0 to 1.
   *
   * Stored because it eases, easing towards a target derived from what the cat
   * is doing — the bed's rule again, so a bristling hedgehog with no cat in the
   * room is not a state the scene can reach.
   */
  bristle: number;
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
  /** How far onto `at` it has got, 0 to 1. See `Ciccio.lift`. */
  lift: number;
  x: number;
  facing: number;
  /** Its own, not the scene's: see `side`, for the same reason. */
  say: Say | null;
  /** How far up the wall it has got, above whatever it is standing on. */
  climb: number;
  /** Head down, the way a squirrel actually comes down a trunk. */
  headDown: boolean;
}

/** A puff of steam coming off something hot. */
export interface Puff {
  x: number;
  y: number;
  rise: number;
  size: number;
  life: number;
}

/**
 * A small blue cat, who calls now and then and is very fond of him.
 *
 * `from` is the edge it came in by and the edge it will leave by — carried
 * rather than recovered from which half of the room it is standing in, for the
 * same reason `car.at` is: the first thing that nudges it past the middle would
 * send it out of the wrong side.
 */
export interface Cat {
  x: number;
  /**
   * Which way it is looking, carried rather than worked out by the drawing.
   *
   * Every other figure's facing is the scene's, and for the reason `girl.facing`
   * is: a side computed from geometry snaps the whole figure the frame two
   * positions cross. Taken from `sign(ciccio.x - cat.x)` in `draw.ts` it also
   * needed a tie-break that existed nowhere else.
   */
  facing: -1 | 1;
  from: -1 | 1;
  phase: 'arriving' | 'meowing' | 'kissing' | 'leaving';
  timer: number;
  say: Say | null;
}

export interface Heart {
  x: number;
  y: number;
  rise: number;
  drift: number;
  life: number;
}

export interface Gratin {
  x: number;
  bites: number;
  steam: Puff[];
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
  /**
   * Stored, not derived — deliberately unlike the cello's lit school window.
   * "On while he is still walking over" is a state somebody reaches by clicking
   * it, so it has to be a fact rather than a consequence.
   *
   * It cannot outlive the room it belongs to, and that is a property of the
   * layout rather than of anything done here: the living room has no null case
   * at any width, so there is no reconciliation for `resizeScene` to do. If a
   * piece of furniture ever *does* become nullable, this is the field that will
   * need it.
   */
  tv: { on: boolean; showLeft: number };
  /** Whose turn it is in the round of "Susin! Ciccio Ciccio! Susin!". */
  chatter: { next: number; wait: number } | null;
  /**
   * How far the bed is turned down, 0 to 1 — pillow plumped, cover pulled back.
   *
   * Stored because it *eases*, but what it eases towards is derived
   * (`bedExpectsHim`), so a bed made up for nobody is not a state the scene can
   * reach. That is the cello's lit window, and the reason the television needed
   * the opposite treatment: "on while he walks over" is real, "turned down with
   * nobody coming" is not.
   */
  bed: { turned: number };
  /**
   * The visitor, and the countdown to the next one.
   *
   * One at a time, by construction — there is only ever this slot, and the
   * timer only runs down while it is empty.
   */
  cat: Cat | null;
  catNextIn: number;
  /** Where he has got to on the rota, and how long until the next thing. */
  routine: { next: number; wait: number };
  /**
   * One of them has gone up the wall and cannot get down again.
   *
   * `climber` is which of the two, carried rather than worked out from whoever
   * happens to be highest — the same rule as `side` and `car.at`, and the first
   * frame both of them are off the ground is the frame that would break it.
   */
  rescue: {
    climber: 0 | 1;
    phase: 'climbing' | 'recalled' | 'stuck' | 'fetching' | 'descending' | 'scolding';
    timer: number;
  } | null;
  /** Rising off a kiss. Thrown, so they go above the reserved band on purpose. */
  hearts: Heart[];
  /**
   * One at a time, by construction: there is only ever this one slot, and
   * `serveGratin` returns early rather than replacing what is in it. There is
   * no oven timer to gate as well — the rota and a tap on the cooker both go
   * through that one function.
   */
  gratin: Gratin | null;
  frame: number;
}

type Rng = () => number;

/** How far off the ground somebody part way onto a seat is. */
const seatLift = (at: Spot, lift: number) => SEAT_HEIGHT[at] * lift;

export const ciccioY = (scene: Scene) =>
  scene.ground - seatLift(scene.ciccio.at, scene.ciccio.lift);

export const squirrelY = (scene: Scene, squirrel: Squirrel) =>
  // The wall climb included, which is what makes a squirrel up there clickable
  // where it is drawn rather than at the floor under it.
  scene.ground - seatLift(squirrel.at, squirrel.lift) - squirrel.climb;

/**
 * Where a squirrel belongs right now.
 *
 * The one place that answers it, so that a squirrel standing on the floor in
 * front of a sofa he is sitting on is not a state the scene can reach. It reads
 * his spot as well as his position, for the same reason.
 */
export function flankX(scene: Scene, side: -1 | 1): number {
  const { wanderLeft, wanderRight } = scene.layout;
  // Running for a gratin he is beside himself, and it shows: both of them are
  // wanted a little further back, so he surges out in front and they scamper
  // after him. Deliberate rather than incidental — with a top speed above his
  // they would otherwise stay pinned to his flanks at any pace, and the dash
  // would read exactly like the walk.
  // The target is his flank whatever he is doing. What changes on a dash is how
  // fast they may travel towards it, which is what makes the gap grow rather
  // than sit at some fixed distance.
  return clamp(scene.ciccio.x + side * FLANK_GAP, wanderLeft - FLANK_GAP, wanderRight + FLANK_GAP);
}

/**
 * Which seat an errand ends on. Written out at both the place it is decided and
 * the place it is drawn, the two drifted the moment a third errand appeared.
 */
export const spotFor = (errand: Errand | undefined): Spot => (errand === 'sleep' ? 'bed' : 'sofa');

/** Whether he is in the middle of a run for food. */
export const dashingForFood = (scene: Scene) =>
  scene.ciccio.phase === 'heading' && scene.ciccio.goal?.then === 'eat';

export function createScene(size: SceneSize, rng: Rng): Scene {
  const layout = layoutFor(size.width);
  const scene: Scene = {
    width: size.width,
    height: size.height,
    ground: size.ground,
    layout,
    ciccio: {
      phase: 'wandering',
      spin: 0,
      after: 'wandering',
      goal: null,
      lift: 0,
      timer: 0,
      bristle: 0,
      say: null,
      x: layout.wanderLeft + (layout.wanderRight - layout.wanderLeft) * rng(),
      dir: rng() < 0.5 ? -1 : 1,
      facing: 1,
      at: 'floor',
    },
    squirrels: [],
    gratin: null,
    tv: { on: false, showLeft: 0 },
    chatter: null,
    bed: { turned: 0 },
    cat: null,
    catNextIn: CAT_INTERVAL,
    routine: { next: 0, wait: ROUTINE_GAP },
    rescue: null,
    hearts: [],
    frame: 0,
  };
  scene.squirrels = ([-1, 1] as const).map((side) => ({
    side,
    at: 'floor' as Spot,
    x: flankX(scene, side),
    facing: -side as -1 | 1,
    lift: 0,
    say: null,
    climb: 0,
    headDown: false,
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

  // Clamped into *his* range, never deleted: a gratin left where the room used
  // to be wider is a gratin he can never reach, and `heading` never arrives.
  if (scene.gratin) scene.gratin.x = clamp(scene.gratin.x, wanderLeft, wanderRight);

  // And the errand is re-aimed at the thing it was for. Rewriting every goal to
  // the gratin's x sent him to the cooker for a programme; leaving a sofa or a
  // bed goal alone sent him to where the furniture used to be, and he climbed
  // onto nothing.
  const goal = scene.ciccio.goal;
  if (goal) {
    const where = errandTarget(scene, goal.then);
    if (where === undefined) scene.ciccio.goal = null;
    else scene.ciccio.goal = { ...goal, x: where };
  }

  for (const squirrel of scene.squirrels) squirrel.x = flankX(scene, squirrel.side);
}

// -- one frame ---------------------------------------------------------------

/**
 * What he is doing this frame: one handler per phase, each returning.
 *
 * The last of them, pottering, is `wander` below — it is the only one that is
 * not simply waiting for a timer, and it is the ninth case rather than this
 * function's afterthought.
 */
function walkCiccio(scene: Scene, rng: Rng): void {
  const { ciccio } = scene;

  if (ciccio.phase === 'bristling') {
    // Rooted to the spot. Not even a wobble: he has seen a cat.
    return;
  }

  if (ciccio.phase === 'eating') {
    // Nobody but this may clear the gratin, and it is guarded rather than
    // trusted: a stale `after` from a dance nowhere near food would otherwise
    // have him eating the carpet.
    const gratin = scene.gratin;
    if (!gratin || Math.abs(gratin.x - ciccio.x) > BITE_REACH) {
      ciccio.phase = 'wandering';
      return;
    }
    if (--gratin.bites <= 0) {
      scene.gratin = null;
      ciccio.phase = 'wandering';
    }
    return;
  }

  if (ciccio.phase === 'wobbling') {
    ciccio.spin += WOBBLE_SPEED;
    if (ciccio.spin >= WOBBLE_TURNS * TAU) {
      ciccio.spin = 0;
      ciccio.phase = ciccio.after === 'eating' ? 'eating' : 'wandering';
      ciccio.after = 'wandering';
    }
    // He stays exactly where he is: the dance is on the spot, and `facing` is
    // the walk's and is not touched, so the walk resumes the way it left off.
    return;
  }

  if (ciccio.phase === 'mounting') {
    ciccio.lift = toward(ciccio.lift, 1, LIFT_STEP);
    if (ciccio.lift >= 1) {
      ciccio.phase = ciccio.at === 'bed' ? 'sleeping' : 'sitting';
      ciccio.timer = ciccio.at === 'bed' ? NAP_FRAMES : MIN_SIT;
      ciccio.goal = null;
    }
    return;
  }

  if (ciccio.phase === 'dismounting') {
    ciccio.lift = toward(ciccio.lift, 0, LIFT_STEP);
    if (ciccio.lift <= 0) {
      ciccio.at = 'floor';
      ciccio.phase = ciccio.goal ? 'heading' : 'wandering';
    }
    return;
  }

  if (ciccio.phase === 'sitting') {
    ciccio.timer--;
    // Food gets him up; so does the programme ending, but not before he has
    // sat long enough for the walk over to have been worth it.
    if (scene.gratin || (!scene.tv.on && ciccio.timer <= 0)) startDismount(ciccio);
    return;
  }

  if (ciccio.phase === 'sleeping') {
    // A gratin does not wake him: it is scenery, not a projectile, and it will
    // keep. It does shorten the nap, because he can smell it.
    ciccio.timer -= scene.gratin ? 3 : 1;
    if (ciccio.timer <= 0) startDismount(ciccio);
    return;
  }

  if (ciccio.phase === 'heading') {
    const goal = ciccio.goal;
    if (!goal) {
      ciccio.phase = 'wandering';
      return;
    }
    const away = goal.x - ciccio.x;
    ciccio.dir = away >= 0 ? 1 : -1;
    ciccio.facing = toward(ciccio.facing, ciccio.dir, TURN_EASE);
    const pace = goal.urgent ? SUMMON_SPEED : goal.then === 'eat' ? RUN_SPEED : ERRAND_SPEED;
    if (Math.abs(away) <= pace) {
      // Snapped on arrival. A step that overshoots leaves him oscillating
      // either side of the plate at running speed, for ever.
      ciccio.x = goal.x;
      if (goal.then === 'eat') {
        ciccio.after = 'eating';
        startWobble(ciccio);
      } else {
        // The seat is named now, at the start of the climb, so an interrupt
        // half way up turns round from where it had got to.
        ciccio.at = spotFor(goal.then);
        ciccio.phase = 'mounting';
      }
      return;
    }
    ciccio.x += ciccio.dir * pace;
    return;
  }

  wander(scene, rng);
}

/**
 * Pottering: the one phase that is not simply waiting for a timer.
 *
 * He walks his floor, turning at the ends and now and then for no reason, and
 * this is also where he notices a gratin, a television that has come on, or
 * that it is time for bed. `x` is snapped to the bound it reached rather than
 * left a fraction past it: left to drift, a walk at a speed the range is not a
 * multiple of creeps further out of the room every lap.
 */
function wander(scene: Scene, rng: Rng): void {
  const { ciccio } = scene;
  const { wanderLeft, wanderRight } = scene.layout;

  // Food beats wandering, and beats an errand to the sofa or the bed — but not
  // the run it is already making for food, which would re-set the same goal
  // every frame and hide a bug behind idempotence. It is set as a *goal* rather
  // than as a phase, so everything that has to happen on the way happens once.
  if (scene.gratin && ciccio.goal?.then !== 'eat') {
    headForGratin(scene, ciccio.goal?.urgent ?? false);
    return;
  }

  if (scene.tv.on && !ciccio.goal) {
    summon(scene, 'sit', false);
    return;
  }

  if (rng() < WOBBLE_CHANCE) {
    startWobble(ciccio);
    return;
  }

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
  ciccio.facing = toward(ciccio.facing, ciccio.dir, TURN_EASE);
}

/**
 * They go where he is, seat included, and take the same frames over it — so a
 * sofa does not gain two squirrels in one frame either.
 *
 * A seat is never swapped for another seat: he goes to the floor between any
 * two of them, at least 28 frames of it, so there is nothing here to guard
 * against naming a new seat while a lift still stands on the old one. There was
 * — `wants !== 'floor' && (at === wants || lift <= 0)`, whose extra arms were
 * measured over eight seeded days at zero occurrences, which is the predicate
 * this repo calls a trap and an unkillable mutant besides. The max-step
 * assertion is what would catch a rota that ever did transfer him seat to seat.
 *
 * **Only ever one change of height at a time**, and it runs *before* the
 * rescue rather than after. A squirrel coming off the wall and off the sofa on
 * the same frame moved 2.8 units, well past what either alone is allowed —
 * and merely checking `climb === 0` here was not enough, because the rescue
 * zeroes the climb earlier in the very same frame. Ordered ahead of it, the
 * seat waits a frame and the two never coincide.
 */
function settleSquirrelSeats(scene: Scene): void {
  // Reads only him, so it cannot change across the pair.
  const wants = squirrelWants(scene);
  for (const squirrel of scene.squirrels) {
    if (squirrel.climb > 0) continue;
    if (wants === 'floor') {
      squirrel.lift = toward(squirrel.lift, 0, LIFT_STEP);
      if (squirrel.lift <= 0) squirrel.at = 'floor';
    } else {
      squirrel.at = wants;
      squirrel.lift = toward(squirrel.lift, 1, LIFT_STEP);
    }
  }
}

/**
 * They keep to his side, at their own pace, and nothing ever places them.
 *
 * The target is always his correct flank, so they are always *travelling* to
 * the right side of him and get there under their own steam. There was a hard
 * clamp here as well, holding them on their sides come what may, and it had to
 * go: he overtakes the one in front of him on a dash, and the frame the dash
 * ended that squirrel was put back beside him from wherever it had got to — a
 * hundred units in a single frame. Worse, correcting it at walking pace instead
 * still spent a second move on top of the first, so a squirrel could cover
 * twice its own top speed in a frame and the max-step invariant went with it.
 *
 * So being between them is now something that *converges* rather than something
 * held down: he can be in front of both while he runs for a gratin, and they
 * are back either side of him a moment after he stops. The layout still insets
 * his range by a flank at each end, so there is always somewhere for them to
 * stand.
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
    // Up the wall, the sideways business stops: it is holding on.
    if (squirrel.climb > 0) continue;

    const target = flankX(scene, squirrel.side);
    // Their top speed is the only thing that changes on a dash: they may not
    // travel as fast as he can, so the gap grows the whole way across the room
    // rather than sitting at some fixed distance behind him.
    const top = dashingForFood(scene) ? DASH_FOLLOW_SPEED : SQUIRREL_SPEED;
    const away = target - squirrel.x;
    if (Math.abs(away) > FLANK_SETTLED) {
      const move = clamp(away, -top, top);
      squirrel.x += move;
      // Faces the way it is going, and *keeps* that when it is not going
      // anywhere. Both halves matter and each was a bug on its own: recomputed
      // every frame off the movement, the one being pushed along in front of
      // him rode the edge of the dead zone and strobed; pinned to look at him
      // instead, the same squirrel slid backwards down the room. Held, it turns
      // when the pair turns and walks the way it faces.
      squirrel.facing = move > 0 ? 1 : -1;
    }

    // In front of the television they watch it rather than the room: the set is
    // on the wall above the middle of the sofa, so looking at it means looking
    // inwards. Everywhere else `facing` is held from the last time they moved.
    if (scene.ciccio.phase === 'sitting') {
      squirrel.facing = squirrel.x <= scene.layout.loungeX ? 1 : -1;
    }
  }
}

/**
 * Off whatever he is on, taking the frames to do it.
 *
 * The single way down, so nothing anywhere else can write `at` back to the
 * floor and skip the climb.
 */
function startDismount(ciccio: Ciccio): void {
  // `lift` is deliberately left where it is: reset to full, an interrupt during
  // a dismount yanked him back up onto the seat he was climbing off.
  ciccio.phase = 'dismounting';
}

/**
 * Off after a gratin, said once on the way.
 *
 * The one place a gratin becomes a goal, so the frame he spots it for himself
 * and the frame somebody taps the oven produce the same thing — including the
 * line, which was said only on the path he found it by himself until a tap
 * started sending him directly.
 */
function headForGratin(scene: Scene, urgent: boolean): void {
  if (!scene.gratin) return;
  summon(scene, 'eat', urgent);
  // Said on the frame he spots it. Keyed on the goal *holding*, he would shout
  // it every frame of the run across the room.
  say(scene.ciccio, CICCIO_GRATIN);
}

/**
 * Drop whatever he was doing and go there now.
 *
 * Everything a tap on a *thing* does goes through here, so an interrupted
 * dance, an interrupted meal and an interrupted nap all end the same way. He
 * still climbs down off whatever he is on rather than appearing on the floor —
 * the one thing an interrupt may not do is skip the frames a change of height
 * is owed.
 */
function summon(scene: Scene, then: Errand, urgent = true): void {
  const { ciccio } = scene;
  const x = errandTarget(scene, then);
  // The thing it was for is gone, which only a meal can be.
  if (x === undefined) return;
  ciccio.goal = { x, then, urgent };
  ciccio.spin = 0;
  ciccio.after = 'wandering';
  // `at` names a seat from the moment a climb begins, so this is false while he
  // is on his way up — which is what stops an interrupt there dropping him.
  if (ciccio.at === 'floor') ciccio.phase = 'heading';
  else startDismount(ciccio);
}

/**
 * Starts one, or leaves the one in progress alone.
 *
 * Whatever errand he was on is dropped with it. Left set, the goal is orphaned:
 * `wander` will not reissue one that already exists and the rota will not start
 * anything while one does, so he potters for the life of the tab past a gratin
 * he was on his way to.
 */
/**
 * The dance, and the one place an errand is dropped.
 *
 * Dropping a `sleep` errand **loses the turn**, and that is a real asymmetry
 * worth naming: `runRoutine` advances the rota at dispatch, and the other two
 * turns leave something in the world that `wander` re-notices — `eat` leaves a
 * gratin on the floor, `watch` leaves the set on. A nap exists only as the goal,
 * so an interrupt routed through here drops it with nothing to re-issue it and
 * the bed is not offered again until the rota comes round. That is deliberate
 * and much the lesser evil: the alternative is the orphaned goal, which stops
 * everything for the life of the tab rather than skipping one nap.
 */
function startWobble(ciccio: Ciccio): void {
  // Dropped *before* the early return. Below it, "an interrupt drops the errand
  // it interrupts" quietly stopped holding for a hedgehog who was already
  // dancing — and `runRoutine`'s own `free` gate admits `wobbling`, so one rota
  // arm that set a goal without also setting `heading` would have reintroduced
  // the orphaned-goal deadlock this rule exists to prevent.
  ciccio.goal = null;
  if (ciccio.phase === 'wobbling') return;
  ciccio.phase = 'wobbling';
  ciccio.spin = 0;
}

/**
 * What a tap on him does, which depends on where he is.
 *
 * On his feet he dances. On the sofa or in bed he gets up — a dance has nowhere
 * to happen up there, and simply setting the phase left `at` naming a seat he
 * was no longer climbing off: he walked the room a cushion's height in the air
 * for ever, and since the rota only starts something while he is on the floor,
 * it never ran again either.
 */
export function tapCiccio(scene: Scene): void {
  const { ciccio } = scene;
  if (ciccio.at === 'floor') {
    startWobble(ciccio);
    return;
  }
  // Getting him up off the sofa turns the set off with him, because the
  // programme is *why* he would go back: `wander` re-issues the sit errand on
  // the first frame he reaches the floor, and the set is on for the whole of
  // the only time he is ever up there — so the tap was a 35-frame bob that
  // read as a tap that did nothing. Taking him off it is the decision to stop
  // watching, the same way the set going off on its own is.
  if (ciccio.at === 'sofa') {
    scene.tv.on = false;
    scene.tv.showLeft = 0;
  }
  ciccio.goal = null;
  startDismount(ciccio);
}

/**
 * They speak in turn, and always in the same order: the squirrel on his left,
 * then him, then the squirrel on his right — "Susin! Ciccio Ciccio! Susin!".
 *
 * A round, not three independent chances. Rolled separately they talked over
 * each other and the three lines never came out as the one phrase they are.
 * The gratin is the exception and stays his alone: it is a thing he says about
 * something he has seen, not a greeting anybody is answering.
 */
function startChatter(scene: Scene): void {
  if (!scene.chatter) scene.chatter = { next: 0, wait: 0 };
}

function runChatter(scene: Scene, rng: Rng): void {
  runSaying(scene.ciccio);
  for (const squirrel of scene.squirrels) runSaying(squirrel);

  if (!scene.chatter) {
    if (rng() < CHATTER_CHANCE) startChatter(scene);
    return;
  }

  if (--scene.chatter.wait > 0) return;
  const turn = scene.chatter.next;
  if (turn === 1) say(scene.ciccio, CICCIO_CALL);
  else say(scene.squirrels[turn === 0 ? 0 : 1], SQUIRREL_CALL);

  scene.chatter = turn >= 2 ? null : { next: turn + 1, wait: CHATTER_GAP };
}

/**
 * Puts a gratin on the floor in front of the oven, if there is not one already.
 *
 * The one way a gratin is ever made: the timer and the click both come through
 * here, so the two cannot drift into answering differently.
 */
export function serveGratin(scene: Scene): void {
  if (scene.gratin) return;
  const { ovenX, wanderLeft, wanderRight } = scene.layout;
  scene.gratin = {
    x: clamp(ovenX + OVEN_WIDTH / 2 + 18, wanderLeft, wanderRight),
    bites: GRATIN_BITES,
    steam: [],
  };
}

/**
 * The programme runs down whether or not anybody is watching it.
 *
 * Ticked only while he is seated, a television he never reaches never expires,
 * and from then on the sofa is where he lives.
 */
function runTv(scene: Scene): void {
  if (!scene.tv.on) return;
  // Runs down whether or not anybody is watching, or a set he never reaches
  // never expires and the sofa is where he lives from then on.
  if (--scene.tv.showLeft <= 0) {
    scene.tv.on = false;
    scene.tv.showLeft = 0;
  }
}

/**
 * Whether the bed is expecting him: he is on his way to it, climbing into it,
 * or in it.
 *
 * This is also what makes a tap on the bed visible. Without it the only thing a
 * click on the bed did was start three animals walking, which on a wide room is
 * a second and a half of nothing happening where the tap was.
 */
export const bedExpectsHim = (scene: Scene) =>
  scene.ciccio.at === 'bed' || scene.ciccio.goal?.then === 'sleep';

function runBed(scene: Scene): void {
  const target = bedExpectsHim(scene) ? 1 : 0;
  scene.bed.turned = toward(scene.bed.turned, target, BED_TURN_SPEED);
}

/**
 * Whether a cat would be welcome right now.
 *
 * Only while he is up and about. Startled off a sofa or out of a meal there is
 * no sensible state to hand him back to, and every one of those combinations
 * would be a case somebody had to think about — where "the cat calls when he is
 * pottering" is one rule with no corners.
 */
const catMayCall = (scene: Scene) =>
  scene.ciccio.at === 'floor' &&
  (scene.ciccio.phase === 'wandering' || scene.ciccio.phase === 'wobbling') &&
  !scene.gratin &&
  // The rota turns the set on and returns, four lines before this runs, leaving
  // him still `wandering` on the floor — so without this the cat could let
  // itself in on the very frame a programme started and freeze him in front of
  // a set counting itself down. He would reach the sofa, if at all, to a screen
  // that had already gone off.
  !scene.tv.on;

/**
 * A small blue cat lets itself in, walks up to him, says something kind, gives
 * him a kiss and sees itself out.
 *
 * He freezes and puts his spines up the moment he sees it, and they only come
 * down once it has spoken — which is the point of the whole visit, and the
 * reason the meow is a phase of its own rather than something that happens on
 * the way past.
 */
function runCat(scene: Scene, rng: Rng): void {
  const cat = scene.cat;
  if (!cat) {
    // What this counts is *pottering*, so it runs down only while pottering is
    // what he is doing. Ticked on every frame instead it went as far as −1500
    // across a busy day, which is a counter that has stopped pacing anything:
    // the cat then walked in on the very frame he swallowed the last bite or
    // stepped off the sofa, pouncing rather than dropping by.
    if (!catMayCall(scene) || --scene.catNextIn > 0) return;
    const from: -1 | 1 = rng() < 0.5 ? -1 : 1;
    scene.cat = {
      // Off the edge it came in by, so it is never simply *there*.
      x: from === -1 ? -30 : scene.width + 30,
      from,
      phase: 'arriving',
      timer: 0,
      say: null,
      facing: from === -1 ? 1 : -1,
    };
    scene.ciccio.phase = 'bristling';
    return;
  }

  runSaying(cat);

  if (cat.phase === 'arriving') {
    const away = scene.ciccio.x - cat.x;
    const stopAt = CAT_NEAR * Math.sign(away || 1);
    if (Math.abs(away) <= CAT_NEAR) {
      cat.phase = 'meowing';
      cat.timer = MEOW_FRAMES;
      say(cat, CAT_CALL);
    } else {
      const move = Math.sign(away - stopAt) * CAT_SPEED;
      cat.x += move;
      if (move !== 0) cat.facing = move > 0 ? 1 : -1;
    }
    return;
  }

  if (cat.phase === 'meowing') {
    if (--cat.timer <= 0) {
      cat.phase = 'kissing';
      cat.timer = KISS_FRAMES;
    }
    return;
  }

  if (cat.phase === 'kissing') {
    // Hearts over the pair of them, while the kiss lasts.
    if (scene.frame % 14 === 0 && scene.hearts.length < MAX_HEARTS) {
      scene.hearts.push({
        x: (cat.x + scene.ciccio.x) / 2 + (rng() - 0.5) * 12,
        y: -26,
        rise: 0.4 + rng() * 0.22,
        drift: (rng() - 0.5) * 0.3,
        life: 90,
      });
    }
    if (--cat.timer <= 0) cat.phase = 'leaving';
    return;
  }

  // Leaving, by the edge it came in by.
  cat.facing = cat.from;
  cat.x += cat.from * CAT_SPEED * 1.3;
  if (cat.x < -40 || cat.x > scene.width + 40) {
    scene.cat = null;
    scene.catNextIn = CAT_INTERVAL;
    if (scene.ciccio.phase === 'bristling') scene.ciccio.phase = 'wandering';
  }
}

/**
 * His spines, and the hearts a kiss leaves behind.
 *
 * The target is derived — up while a cat is on its way over, down from the
 * moment it speaks kindly to him — so a bristling hedgehog with no cat in the
 * room is not a state the scene can reach.
 */
function runBristle(scene: Scene): void {
  const target = scene.cat?.phase === 'arriving' ? 1 : 0;
  scene.ciccio.bristle = toward(scene.ciccio.bristle, target, BRISTLE_SPEED);

  for (const heart of scene.hearts) {
    heart.y -= heart.rise;
    heart.x += heart.drift;
    heart.life--;
  }
  scene.hearts = scene.hearts.filter((heart) => heart.life > 0);
}

/**
 * Now and then, in front of the television, one of them goes straight up the
 * wall — gets to the top, turns head-down, and finds it cannot come back.
 *
 * The other one climbs up, brings it down, and tells it off with a slap of the
 * tail and a "Pfff!".
 *
 * The whole thing is abandoned the moment they stop watching: it belongs to
 * sitting still on a sofa, and a squirrel left half way up a wall because a
 * gratin came out would be stuck up there for the life of the tab.
 */
function runRescue(scene: Scene, rng: Rng): void {
  const watching = watchingTelevision(scene);

  // Abandoned the moment they stop watching — but abandoning it is only the
  // decision. Coming down is what has to keep happening afterwards, and it
  // belongs to *not having a rescue* rather than to *not watching*: a
  // programme resumed part way through the descent (tapping the set while he
  // is still on the sofa dismounts and remounts in half the frames a full
  // descent needs) left both of them hanging in mid air, one upside down, not
  // following him and with nothing to bring them down again.
  if (!watching) scene.rescue = null;

  const rescue = scene.rescue;
  if (!rescue) {
    for (const squirrel of scene.squirrels) {
      squirrel.climb = Math.max(0, squirrel.climb - CLIMB_SPEED * 2);
      if (squirrel.climb === 0) squirrel.headDown = false;
    }
    // And nobody starts a climb while either of them is still moving
    // vertically — the seat rule again, one change of height at a time. It
    // would otherwise pick one still settling onto the cushion and add the
    // wall to that same frame (1.7 of sofa and 0.55 of wall at once), or one
    // still unwinding from an abandoned rescue, which starts at the top and so
    // drops straight into `stuck` with no climb to watch.
    //
    // Asked after `watching`, not before it: the set is off for most of the
    // scene's life, and the scan is otherwise run every frame for an answer
    // nothing looks at. `&&` still puts the `rng()` last, so the draw order is
    // the same either way.
    if (
      watching &&
      // Settled at *either* end, which is what "not moving vertically" means.
      // Spelled `lift >= 1` it happened to work only because `watching` implies
      // they are heading for the sofa: widen what counts as watching — letting
      // them watch from the floor, say — and every climb stops happening, with
      // a green suite and nothing to see but squirrels that never climb again.
      scene.squirrels.every(
        (squirrel) => squirrel.climb === 0 && (squirrel.lift <= 0 || squirrel.lift >= 1),
      ) &&
      rng() < RESCUE_CHANCE
    ) {
      scene.rescue = { climber: rng() < 0.5 ? 0 : 1, phase: 'climbing', timer: 0 };
    }
    return;
  }

  const climber = scene.squirrels[rescue.climber];
  const other = scene.squirrels[rescue.climber === 0 ? 1 : 0];

  if (rescue.phase === 'climbing') {
    climber.climb = Math.min(CLIMB_MAX, climber.climb + CLIMB_SPEED);
    if (climber.climb >= CLIMB_MAX) {
      // Turns round at the top, which is when it works the problem out.
      climber.headDown = true;
      rescue.phase = 'stuck';
      rescue.timer = STUCK_FRAMES;
      return;
    }
    // Or it gets told off before it can get itself stuck, and comes back down
    // under its own steam. Only while it is still low enough for that to read
    // as being called back rather than as the other one changing its mind.
    const up = climber.climb / CLIMB_MAX;
    if (up > CALL_DOWN_FROM && up < CALL_DOWN_UNTIL && rng() < CALL_DOWN_CHANCE) {
      rescue.phase = 'recalled';
      say(other, SQUIRREL_SCOLD);
    }
    return;
  }

  if (rescue.phase === 'recalled') {
    // Down on its own: nobody had to come and get it, so there is nothing to
    // tell it off for afterwards — it has already been told.
    climber.climb = Math.max(0, climber.climb - CLIMB_SPEED * 1.4);
    if (climber.climb === 0) scene.rescue = null;
    return;
  }

  if (rescue.phase === 'stuck') {
    if (--rescue.timer <= 0) rescue.phase = 'fetching';
    return;
  }

  if (rescue.phase === 'fetching') {
    // Up to just below it, which is where you would stop to collect somebody.
    other.climb = Math.min(ESCORT_BELOW, other.climb + CLIMB_SPEED);
    if (other.climb >= ESCORT_BELOW) rescue.phase = 'descending';
    return;
  }

  if (rescue.phase === 'descending') {
    // They come down **together**, the rescuer keeping station just below.
    //
    // Stepped down at the same rate they did not: the rescuer started lower, so
    // it reached the bottom first and left him to do the last stretch on his
    // own — which rather undoes the whole point of somebody going up to fetch
    // him. Holding the second to a share of the first's height keeps it just
    // underneath the entire way, and lands them both at once.
    climber.climb = Math.max(0, climber.climb - CLIMB_SPEED * 1.4);
    other.climb = climber.climb * (ESCORT_BELOW / CLIMB_MAX);
    if (climber.climb === 0) {
      other.climb = 0;
      climber.headDown = false;
      rescue.phase = 'scolding';
      rescue.timer = SCOLD_FRAMES;
      say(other, SQUIRREL_SCOLD);
    }
    return;
  }

  if (--rescue.timer <= 0) scene.rescue = null;
}

/** How far through the telling-off we are, 0 to 1, or null if there is none. */
export function scoldingAt(scene: Scene): number | null {
  const rescue = scene.rescue;
  if (!rescue || rescue.phase !== 'scolding') return null;
  return 1 - rescue.timer / SCOLD_FRAMES;
}

/**
 * How far round the scolder's tail is swung, in radians, this frame.
 *
 * A fact about the scene, so it lives here: `draw.ts` was deriving it from
 * `scoldingAt` itself, which is the two-owners-of-one-fact the peel and the
 * pizza already cost once — and it is the sort of fact a test can hold, where
 * a `Math.sin` inside a canvas call is not.
 */
export function scoldSwing(scene: Scene, squirrel: Squirrel): number {
  if (scolder(scene) !== squirrel) return 0;
  const at = scoldingAt(scene);
  return at === null ? 0 : Math.sin(at * Math.PI * 3) * SCOLD_SWING;
}

/** How far round the tail goes at the top of the swing. */
const SCOLD_SWING = 0.28;

/** Which of them is doing the telling-off, if anybody is. */
export const scolder = (scene: Scene) =>
  scene.rescue?.phase === 'scolding' ? scene.squirrels[scene.rescue.climber === 0 ? 1 : 0] : null;

/**
 * The rota, which is what happens when nobody is clicking anything.
 *
 * Only counted down while he is pottering with nothing else on: it is a rota of
 * things to do next, not a clock that fires into the middle of something.
 */
function runRoutine(scene: Scene): void {
  const { ciccio } = scene;
  const free =
    ciccio.at === 'floor' &&
    (ciccio.phase === 'wandering' || ciccio.phase === 'wobbling') &&
    !ciccio.goal &&
    !scene.gratin &&
    !scene.tv.on &&
    !scene.cat;
  if (!free) return;

  if (--scene.routine.wait > 0) return;
  const doing = ROTA[scene.routine.next % ROTA.length];
  scene.routine = { next: (scene.routine.next + 1) % ROTA.length, wait: ROUTINE_GAP };

  if (doing === 'eat') {
    serveGratin(scene);
    headForGratin(scene, false);
  } else if (doing === 'watch') {
    scene.tv.on = true;
    scene.tv.showLeft = SHOW_FRAMES;
  } else {
    summon(scene, 'sleep', false);
  }
}

function runSteam(scene: Scene, rng: Rng): void {
  const gratin = scene.gratin;
  if (!gratin) return;

  for (const puff of gratin.steam) {
    puff.y -= puff.rise;
    puff.size += 0.06;
    puff.life--;
  }
  gratin.steam = gratin.steam.filter((puff) => puff.life > 0);

  if (scene.frame % STEAM_EVERY === 0 && gratin.steam.length < MAX_STEAM) {
    gratin.steam.push({
      x: gratin.x + (rng() - 0.5) * 6,
      y: -8,
      rise: 0.32 + rng() * 0.2,
      size: 2 + rng() * 1.4,
      life: 70,
    });
  }
}

/**
 * Which spot a squirrel belongs on: the one he is settled on, and the floor
 * while he is between two.
 *
 * Read off him rather than stored, because unlike his own `at` there is nothing
 * to recover — a squirrel has no reason of its own to be on a sofa.
 */
function squirrelWants(scene: Scene): Spot {
  const { phase, at } = scene.ciccio;
  return phase === 'sitting' || phase === 'sleeping' ? at : 'floor';
}

/** One frame. Everything mutates `scene`; nothing here reads a clock. */
export function step(scene: Scene, rng: Rng): void {
  scene.frame++;
  runTv(scene);
  runRoutine(scene);
  runBed(scene);
  // Ahead of `runRescue`, and that order is load-bearing: the rescue zeroes a
  // climb earlier in the same frame, so a seat that moved after it would move
  // on the frame the wall did. See `settleSquirrelSeats`.
  settleSquirrelSeats(scene);
  runCat(scene, rng);
  runRescue(scene, rng);
  runBristle(scene);
  walkCiccio(scene, rng);
  runSteam(scene, rng);
  followSquirrels(scene);
  runChatter(scene, rng);
}

/**
 * Which way he is drawn facing, dance included.
 *
 * Turning on the spot in a side-on scene is his facing running all the way
 * round: 1, through 0 where he is edge-on, to −1 where his back is to you, and
 * back. It lives here rather than in `draw.ts` because it is what the spin
 * *means*, and a drawing that worked it out for itself would be a second copy
 * free to disagree — which is exactly what the cello's peel and pizza were.
 */
export function ciccioFacing(scene: Scene): number {
  const turn = Math.cos(ciccioAngle(scene));
  // Never all the way to nothing. A figure drawn about a horizontal scale
  // vanishes to a one-pixel sliver as it passes edge-on, which reads as him
  // blinking out twice a turn — where a hedgehog seen end-on is a round blob.
  // The floor keeps him solid the whole way round.
  const narrowest = Math.max(Math.abs(turn), CICCIO_NARROWEST);
  return turn < 0 ? -narrowest : narrowest;
}

/**
 * Which way round he is, as an angle: 0 is nose to the right, π/2 is nose
 * towards you, π is nose to the left, 3π/2 is his back to you.
 *
 * Scaling the whole figure by `cos` and leaving it there is a card turning on
 * the spot — flat, because every part of him is squashed by the same amount at
 * the same time and nothing ever passes in front of anything else. An angle
 * lets the drawing put his nose *round* the body: it swings across, shortens as
 * it comes towards you, and goes behind him on the far half of the turn. That
 * occlusion is the whole of the depth, and it needs to be a fact of the scene
 * rather than something the drawing invents, or the two go out of step.
 */
export function ciccioAngle(scene: Scene): number {
  const { ciccio } = scene;
  // The television is on the back wall, so watching it means having your back
  // to whoever is looking at the room. Three quarters round is exactly that:
  // nose pointing away, and the drawing puts his face behind his own back.
  if (ciccio.phase === 'sitting') return Math.PI * 1.5;
  // `facing` eases between −1 and 1 and *is* the cosine of the resting angle,
  // so the walk and the dance are the same quantity all the way through.
  const base = Math.acos(clamp(ciccio.facing, -1, 1));
  return ciccio.phase === 'wobbling' ? base + ciccio.spin : base;
}

/** The closing few seconds of whatever they are watching. */
export const showingZebra = (scene: Scene) => scene.tv.on && scene.tv.showLeft <= ZEBRA_FRAMES;

/** Whether the three of them have their backs to the room, watching the set. */
/**
 * Sitting in front of a set that is actually on.
 *
 * The `tv.on` half is load-bearing rather than tidy: he stays `sitting` after a
 * programme ends until his own dwell runs out, and `runRescue` owns the whole
 * wall climb off this predicate — so on `phase` alone a squirrel would set off
 * up the wall, get stuck, be fetched down and told off, all three of them drawn
 * from behind facing a switched-off screen.
 */
export const watchingTelevision = (scene: Scene) => scene.ciccio.phase === 'sitting' && scene.tv.on;

/** Whether we are looking at his front half, and so whether his nose is in front. */
export const ciccioNoseInFront = (scene: Scene) => Math.sin(ciccioAngle(scene)) >= 0;

/** The bob that makes it a wobble rather than a turntable. */
export function ciccioBob(scene: Scene): number {
  return scene.ciccio.phase === 'wobbling' ? Math.abs(Math.sin(scene.ciccio.spin * 2)) * 2.5 : 0;
}

// -- clicks ------------------------------------------------------------------

/**
 * How wide a hit box each of them gets.
 *
 * Far wider than they are drawn, deliberately: a hedgehog is forty units across
 * on a screen a thousand wide, and a target nobody can hit is a feature nobody
 * has. The cello's `hitsGirl` is the same shape.
 */
const HIT_WIDE = 34;
const HIT_TALL = 46;

/**
 * A box around something standing at `x` with its feet at `footY`.
 *
 * `footY` rather than the ground, because that is where the figure is actually
 * drawn: a squirrel forty-eight units up the wall was hit-tested at floor level,
 * so the one interaction a stuck squirrel has had to be aimed at the empty floor
 * beneath it, and a seated hedgehog's head was dead while the carpet in front of
 * the sofa was live.
 */
const hitsBox = (
  x: number,
  y: number,
  atX: number,
  footY: number,
  wide: number,
  tall: number,
  under = 10,
) => Math.abs(x - atX) <= wide && y >= footY - tall && y <= footY + under;

export const hitsCiccio = (scene: Scene, x: number, y: number) =>
  hitsBox(x, y, scene.ciccio.x, ciccioY(scene), HIT_WIDE, HIT_TALL);

export const hitsSquirrel = (scene: Scene, squirrel: Squirrel, x: number, y: number) =>
  hitsBox(x, y, squirrel.x, squirrelY(scene, squirrel), 26, HIT_TALL);

export const hitsTv = (scene: Scene, x: number, y: number) =>
  hitsBox(
    x,
    y,
    scene.layout.loungeX,
    scene.ground - TV_HANGS_AT,
    TV_WIDTH / 2 + 4,
    TV_PANEL + 4,
    4,
  );

export const hitsBed = (scene: Scene, x: number, y: number) =>
  hitsBox(x, y, scene.layout.bedX, scene.ground, BED_WIDTH / 2 + 4, BED_HEAD + 4, 6);

export const hitsOven = (scene: Scene, x: number, y: number) =>
  hitsBox(x, y, scene.layout.ovenX, scene.ground, OVEN_WIDTH / 2 + 6, OVEN_TOP + 8, 6);

/**
 * A click, in the scene's own units.
 *
 * Order matters where the boxes overlap, and there is one rule for it:
 * **whoever is off the floor is asked before the room, and everybody on the
 * floor after it.**
 *
 * On the floor the room wins because his box is deliberately enormous —
 * thirty-four units either side of an animal a few units across — so testing
 * him first makes the oven unclickable for as long as he happens to be
 * standing in front of it, which is exactly when somebody is most likely to be
 * reaching past him for it.
 *
 * Off the floor it inverts, for the same reason: whatever somebody is off the
 * floor *on* is drawn over them, so the room would answer every tap aimed at
 * them. Measured on a grid over each animal's own hit box — 74.4% of a squirrel
 * in bed and 45.1% of *him* asleep in it are inside the bed's, and a tap there
 * was answered by taking him out of bed to go back to bed; 13.7% of a squirrel
 * on the sofa and 21.4% of him are inside the television's, where a tap
 * restarted the programme. It was found first as a squirrel stuck up the wall,
 * and keying the exception on `climb` fixed it for exactly that one case.
 */
export function clickScene(scene: Scene, x: number, y: number): void {
  // What a tap on a squirrel does, said once: the two loops below differ only
  // in which squirrels they will accept.
  const tappedSquirrel = (eligible: (squirrel: Squirrel) => boolean) => {
    const hit = scene.squirrels.some(
      (squirrel) => eligible(squirrel) && hitsSquirrel(scene, squirrel, x, y),
    );
    if (hit) startChatter(scene);
    return hit;
  };

  // Off the floor first — see above. The squirrels before him, because they sit
  // either side of him and his box is the wider.
  if (tappedSquirrel((squirrel) => squirrel.climb > 0 || squirrel.at !== 'floor')) return;
  if (scene.ciccio.at !== 'floor' && hitsCiccio(scene, x, y)) {
    tapCiccio(scene);
    startChatter(scene);
    return;
  }

  if (hitsOven(scene, x, y)) {
    serveGratin(scene);
    // Sent, not merely offered. Leaving him to notice it on his own turn means
    // a tap answered in twenty seconds, which is a tap that did nothing.
    headForGratin(scene, true);
    return;
  }
  if (hitsTv(scene, x, y)) {
    scene.tv.on = true;
    scene.tv.showLeft = SHOW_FRAMES;
    summon(scene, 'sit');
    return;
  }
  if (hitsBed(scene, x, y)) {
    summon(scene, 'sleep');
    return;
  }
  if (tappedSquirrel(() => true)) return;

  if (hitsCiccio(scene, x, y)) {
    tapCiccio(scene);
    startChatter(scene);
  }
}
