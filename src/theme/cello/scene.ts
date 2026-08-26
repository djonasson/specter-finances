/**
 * The Cello scene, as state and nothing else.
 *
 * A pizzaiolo works a stone oven; when a pizza is ready he slides it out on a
 * peel and tosses it up. Cello, a small blue bird, is in love with a girl
 * walking the scene and rides on her shoulder — until a pizza is in the air,
 * which he abandons her for. Having eaten one he is too heavy to fly and sits on
 * the ground with hearts circling overhead until he has digested it.
 *
 * None of this touches a canvas, a window or a clock. Everything advances by
 * `step`, everything random arrives through the `rng` passed in, so a test can
 * run the scene forward frame by frame and get the same answer every time. The
 * drawing lives in `draw.ts` and the wiring in `CelloBackground.tsx`; this file
 * is the only one that decides what happens.
 */

/** Frames, at the ~40fps the background loop is throttled to. */
export const EATING_FRAMES = 40;
export const FULL_FRAMES = 400;
export const TAKEOFF_FRAMES = 30;
export const TOSS_FRAMES = 24;
/** How long the peel takes to come back down to level after a throw. */
export const PEEL_RECOVER_FRAMES = 14;
const PIZZA_INTERVAL_MIN = 500;
const PIZZA_INTERVAL_SPREAD = 400;

const GRAVITY = 0.22;
const CATCH_RADIUS = 24;

export const GIRL_HEIGHT = 74;
/**
 * Where a perched bird's middle ends up: beside her head rather than under it,
 * since he is a third of her height and would otherwise be drawn through it.
 */
const SHOULDER_HEIGHT = 64;
/** How far behind her he sits, on the shoulder she is not leading with. */
const SHOULDER_BACK = 13;
/** And how far above that he hovers, clear of the top of her head. */
const HOVER_HEIGHT = 40;
/** How far he drifts up and down while he waits there. */
const HOVER_BOB = 5;
/** How far the drawn bird reaches above his own middle — his head, in `draw.ts`. */
const BIRD_REACH = 15;
/** A bird too full to fly is drawn larger, and sitting lower. */
export const FULL_SCALE = 1.45;
export const FULL_LIFT = 11;
const GIRL_SPEED = 0.45;
/** How close, and how closely matched in speed, counts as having landed. */
const ARRIVE_REACH = 4.5;
const ARRIVE_DRIFT = 1.2;

/** How readily he puts his feet down once he is settled beside a perch. */
const LANDING_CHANCE = 0.01;
const MOVING_PERCH_LANDING = 0.07;

/** How close, and how closely matched in speed, counts as ready to land. */
const SETTLE_REACH = 14;
const SETTLE_DRIFT = 0.8;
/**
 * How he flies at a perch: a spring of this stiffness against this drag.
 *
 * Hovering above one is loose and slow; dropping onto it is stiff and quick.
 */
const ESCORT_STEER = { gain: 0.012, drag: 0.92 };
const LANDING_STEER = { gain: 0.05, drag: 0.82 };

/**
 * How far ahead of a moving perch a bird flying like this has to aim.
 *
 * Steering at where the perch *is* leaves him permanently behind it: chasing
 * something moving at `v`, a spring settles at a gap of about
 * `v * (1 - drag) / gain`. Behind a car that is further than the distance that
 * counts as arriving, so he flew above it for whole drives. Aiming where it is
 * *going* cancels the lag exactly — and the lead has to be worked out from the
 * *same* gains, or a stiffer approach overshoots by as much as the loose one
 * trailed.
 */
function leadFrames(steer: { gain: number; drag: number }): number {
  return (1 - steer.drag) / steer.gain;
}

/**
 * The squirrels: two in the park and two in the bananas, a pair for each colony
 * so that each has somebody to kiss.
 *
 * `up` is how far along the tree one is, from the foot of the trunk at 0 to the
 * top of the crown at 1, so a squirrel's height is the tree's — it cannot climb
 * out of the band the app reserved by climbing higher than the tree it is in.
 */
const SQUIRREL_COUNT = 4;
const CLIMB_SPEED = 0.012;
/** Frames spent still, once it has reached one end of its climb. */
const SQUIRREL_SIT_MIN = 30;
const SQUIRREL_SIT_SPREAD = 90;
/** How likely it is to cross to the next tree instead of climbing back down. */
const CROSS_CHANCE = 0.35;
/** How long the crossing takes, and how far it arcs above the two crowns. */
export const CROSS_FRAMES = 26;
export const CROSS_ARC = 12;
/** How much further a longer jump arcs, capped so it stays inside the band. */
const CROSS_ARC_MAX = 1.6;
/** How often a jump is aimed at the other one rather than at a tree at random. */
const MEET_CHANCE = 0.45;
/** Up at the top, together: how likely, how long, and how often a heart. */
const KISS_CHANCE = 0.04;
const KISS_FRAMES = 150;
const KISS_HEART_INTERVAL = 22;
/** How far apart they sit while they are at it. */
export const KISS_APART = 4.5;
/** How far the second colony's kiss is turned round the trunk from the first's. */
const KISS_TILT = Math.PI / 6;
/**
 * How far round the tree a full climb carries it, and how wide that circle is at
 * the foot of the trunk and up in the crown.
 *
 * A squirrel going straight up one side reads as a lift rather than an animal;
 * going round means it passes behind the trunk, which is also why the drawing
 * makes two passes at them.
 */
const SPIRAL_TURNS = 1.7;
const TRUNK_RADIUS = 4.5;
/**
 * Where the pseudostem is at its widest and its narrowest, at the foot and at
 * the crown.
 *
 * In `scene.ts` rather than in `draw.ts` because the squirrels' orbit is derived
 * from it — a stem drawn one width and circled at another is a squirrel hanging
 * in open air beside the plant, which is what a park crown's radius did here.
 */
export const BANANA_STEM_FOOT = 4.6;
export const BANANA_STEM_TOP = 3.3;
const SPIRAL_CROWN_RADIUS = 13.5;
/**
 * And round a banana, which has a stem rather than a crown.
 *
 * Taken from the stem's own half-width at the top, where a squirrel sits between
 * climbs and where every kiss happens, so its body is against the plant. Picked
 * by hand at 5.5 it stood clear of a 3.3-wide stem, and over the half of the
 * turn that goes behind the plant it was only partly hidden by it — the
 * blinking this radius exists to stop.
 */
const BANANA_SPIRAL_RADIUS = BANANA_STEM_TOP;
/** Where round the tree each of them starts, so two in one tree are not one. */
const SQUIRREL_SIDE = Math.PI;

/**
 * The lounger at the home end, and the two banana trees over it.
 *
 * Kept shorter than the park's trees so the band the app reserves is still
 * measured from the bird in a park tree — scenery that out-reaches it is
 * scenery drawn over the user's own list.
 */
/** How many leaves each plant carries; the second one is fuller. */
const BANANA_LEAVES = [9, 10];
/** How far a leaf reaches out, up and over, before the wobble below shapes it. */
const LEAF_REACH = 34;
const LEAF_RISE = 26;
const LEAF_ARCH = 34;
const LEAF_FALL = 31;
const LEAF_HALF = 7;
/**
 * How far the plant itself leans, and which way.
 *
 * Here rather than in `draw.ts` because a perch depends on it: the bird sits in
 * the crown of the first plant, and a lean the scene cannot see is a bird held
 * at a fixed point while the crown slides out from under him — the very thing
 * `perchX` swaying with a park tree exists to prevent.
 */
export function bananaLean(scene: Scene, plant: number): number {
  return Math.sin(scene.frame * SWAY_SPEED + plant * 2.9) * SWAY_REACH * 0.6;
}

/** How far a leaf nods, and how quickly. A banana leaf is big and slow. */
export const LEAF_SWAY = 0.07;
const LEAF_SWAY_SPEED = 0.021;
export const BANANA_TRUNK = 62;
/**
 * The two of them are not the same height. One plant beside its own copy reads
 * as wallpaper; the shorter one is what makes them a pair.
 */
export const BANANA_TRUNKS = [BANANA_TRUNK, Math.round(BANANA_TRUNK * 0.74)];
export const BANANA_SPREAD = 30;
/** How far apart the plants stand, which is what `crossArc` measures a hop by. */
export const BANANA_GAP = BANANA_SPREAD * 1.8;
export const LOUNGER_LENGTH = 44;
export const LOUNGER_BACK_HEIGHT = 21;
/** How far into the home end the lounger stands. */
const LOUNGER_ALONG = 0.45;
/**
 * How likely she is to lie down, caught on the way past — from either side of
 * it, unlike the school's door, which she only takes on the way west.
 */
const LOUNGE_CHANCE = 0.42;
const LOUNGE_MIN = 320;
const LOUNGE_SPREAD = 520;
/** Where he sits on the lounger: at the head of it, beside her. */
const LOUNGER_PERCH_BACK = LOUNGER_LENGTH * 0.42;

/**
 * A number between 0 and 1 that is always the same for the same leaf.
 *
 * The plants need to be irregular without being restless: a leaf that took a
 * fresh random number each frame would flap through every shape it has. Hashing
 * its own indices gives each one its own length and angle, fixed for good.
 */
function leafWobble(plant: number, leaf: number, salt: number): number {
  const n = Math.sin(plant * 12.9898 + leaf * 78.233 + salt * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The shape of one banana leaf, in the crown's own coordinates: the spine's
 * control point and tip, and how broad the blade is.
 *
 * In this file, not in the drawing, for two reasons. It decides how far the
 * plant reaches above its stem, which is what `BANANA_HEIGHT` — and through it
 * the band the app reserves — is derived from; and being fixed per leaf it can
 * be worked out once instead of on every frame of the loop.
 */
export interface LeafShape {
  control: { x: number; y: number };
  tip: { x: number; y: number };
  half: number;
  /** Which of the two greens the drawing paints it in. */
  dark: boolean;
}

const leavesByPlant = new Map<number, LeafShape[]>();

export function bananaLeaves(plant: number): LeafShape[] {
  const known = leavesByPlant.get(plant);
  if (known) return known;

  const count = BANANA_LEAVES[plant % BANANA_LEAVES.length];
  const size = BANANA_TRUNKS[plant % BANANA_TRUNKS.length] / BANANA_TRUNK;
  const leaves = Array.from({ length: count }, (_, leaf) => {
    // Spread across the fan, then pushed off it: a plant whose leaves are evenly
    // spaced and matched in length is a diagram of a plant.
    const even = (leaf / (count - 1)) * 2 - 1;
    // Bounded inline rather than through `clamp`: this runs while the module is
    // still being evaluated, to derive BANANA_HEIGHT, and `clamp` is not built
    // yet at that point.
    const nudged = even + (leafWobble(plant, leaf, 1) - 0.5) * 0.34;
    const across = Math.max(-1.15, Math.min(1.15, nudged));
    const long = 0.82 + leafWobble(plant, leaf, 2) * 0.36;
    const droop = 0.8 + leafWobble(plant, leaf, 3) * 0.5;
    const reach = LEAF_REACH * across * size * long;

    return {
      control: { x: reach * 0.3, y: (-LEAF_ARCH * long - (1 - Math.abs(across)) * 10) * size },
      tip: { x: reach, y: (-LEAF_RISE * long + Math.abs(across) * LEAF_FALL * droop) * size },
      half: (LEAF_HALF - Math.abs(across) * 1.5) * size * (0.85 + leafWobble(plant, leaf, 4) * 0.3),
      dark: leafWobble(plant, leaf, 5) >= 0.45,
    };
  });

  leavesByPlant.set(plant, leaves);
  return leaves;
}

/** How far above its own crown a plant's leaves get. */
function leafReach(plant: number): number {
  return Math.max(
    ...bananaLeaves(plant).map((leaf) => Math.max(-leaf.control.y, -leaf.tip.y) + leaf.half),
  );
}

/**
 * How tall the tallest plant stands, stem and leaves together.
 *
 * Derived rather than chosen, like everything else the reserved band is measured
 * from: picked by hand it goes stale the moment a leaf grows, and the check that
 * it fits inside the band becomes two constants agreeing with each other.
 */
export const BANANA_HEIGHT = Math.max(
  ...BANANA_TRUNKS.map((trunk, plant) => trunk + leafReach(plant)),
);

/** How much of a turn she gets through in one frame. */
const TURN_STEP = 0.09;
const GIRL_MARGIN = 28;
/** How close to either edge the bird is ever allowed, perch included. */
const BIRD_EDGE = 8;

/**
 * The park, the school and the car, on the left of the scene as the oven is on
 * the right. Sizes live here rather than in `draw.ts` because the floor the app
 * reserves is derived from them: scenery that grew without the band growing with
 * it would quietly start painting over the user's own list.
 */
const TREE_TRUNK_HEIGHT = 50;
export const TREE_CROWN_RADIUS = 27;
/** Ground to the top of the crown. */
export const TREE_HEIGHT = TREE_TRUNK_HEIGHT + TREE_CROWN_RADIUS * 2;
export const TREE_COUNT = 3;
/** Trees march away from the school, so a narrow window loses the far ones. */
export const TREE_GAP = 44;
const PARK_GAP = 12;

export const SCHOOL_WIDTH = 92;
export const SCHOOL_WALL_HEIGHT = 74;
export const SCHOOL_ROOF_HEIGHT = 30;
export const SCHOOL_HEIGHT = SCHOOL_WALL_HEIGHT + SCHOOL_ROOF_HEIGHT;
export const SCHOOL_DOOR_WIDTH = 22;
export const SCHOOL_DOOR_HEIGHT = 36;
/** The roof overhangs the walls a little, as a real one does. */
export const SCHOOL_ROOF_OVERHANG = 7;
export const SCHOOL_CHIMNEY_WIDTH = 9;
export const SCHOOL_CHIMNEY_HEIGHT = 15;
export const SCHOOL_CHIMNEY_CAP = 4;
/** How far down the right-hand slope it stands: 0 at the ridge, 1 at the eaves. */
const CHIMNEY_ALONG = 0.45;

/** Half the roof, eaves to eaves, overhang included. */
const ROOF_HALF = SCHOOL_WIDTH / 2 + SCHOOL_ROOF_OVERHANG;
/**
 * How high the school gets, which is the chimney rather than the ridge — it
 * stands part way down a slope, so its own top is what the reserved band has to
 * clear.
 */
/**
 * How far along the slope the *higher* corner of the stack sits.
 *
 * `schoolChimney` measures the stack's top at its left corner, because that is
 * the one that has to clear the roof. Taking the reach at the stack's centre
 * instead under-reports the top by the roof's rise across half its width — which
 * is a band that ends below the scenery standing in it.
 */
const CHIMNEY_LEFT_ALONG = CHIMNEY_ALONG - SCHOOL_CHIMNEY_WIDTH / 2 / ROOF_HALF;

export const SCHOOL_REACH = Math.max(
  SCHOOL_HEIGHT,
  SCHOOL_WALL_HEIGHT +
    SCHOOL_ROOF_HEIGHT * (1 - CHIMNEY_LEFT_ALONG) +
    SCHOOL_CHIMNEY_HEIGHT +
    SCHOOL_CHIMNEY_CAP,
);
/** The school centre on a window wide enough to hold the whole left side. */
const SCHOOL_HOME = 191;

/**
 * How long the car is. Everything else about its shape is a fraction of this,
 * including the traced outline it is drawn from (`CAR_OUTLINE`, in `draw.ts`).
 */
export const CAR_WIDTH = 70;
/**
 * Ground to the top of the roof; the belt line is a fraction of it, in
 * `draw.ts`.
 *
 * Tall enough for the length: measured off the same traced drawing the body's
 * outline comes from, 733 long by 310 to the roof, its aerial excluded because
 * an aerial is not the car — 2.37 to 1, where 70 by 27 was 2.5, long and low,
 * which is the half of "Beetle" that survives even once the profile is right.
 */
export const CAR_ROOF_HEIGHT = 30;
/**
 * The car's outline, traced from a side-on drawing of the real one rather than
 * drawn by hand: fractions of its length and of its height to the roof,
 * nose-left, starting at the top of the front bumper, back over the roof, down
 * the tailgate and along the underside through both wheel wells.
 *
 * Hand-placed control points went round in circles here — each pass fixed the
 * profile at one zoom and broke it at another, and an overlay of outlines
 * scaled to the same length flattered every one of them. Tracing settles it:
 * what is drawn is the shape the car is, to inside a pixel at the size it is
 * drawn at. The wheel wells being part of this path is the point — cut as a
 * separate arc over the body they read as hoops standing clear of the tyres.
 *
 * It lives here rather than in `draw.ts` because a perch depends on it: the bird
 * sits on this roof, and a roof the scene cannot see is a bird placed by the
 * numbers of a car that is no longer drawn — which is exactly what `ROOF_BACK`
 * became when the body was re-traced and it was not.
 */
export const CAR_OUTLINE: readonly (readonly [number, number])[] = [
  [0.0, 0.345],
  [0.014, 0.448],
  [0.086, 0.577],
  [0.214, 0.648],
  [0.424, 0.945],
  [0.588, 1.0],
  [0.744, 1.0],
  [0.772, 0.971],
  [0.82, 0.971],
  [0.828, 0.919],
  [0.926, 0.658],
  [0.967, 0.6],
  [0.97, 0.516],
  [1.0, 0.371],
  [1.0, 0.271],
  [0.982, 0.152],
  [0.925, 0.139],
  [0.9, 0.048],
  [0.858, 0.0],
  [0.814, 0.01],
  [0.772, 0.094],
  [0.718, 0.132],
  [0.278, 0.119],
  [0.241, 0.023],
  [0.186, 0.0],
  [0.149, 0.039],
  [0.123, 0.116],
  [0.007, 0.132],
  [0.0, 0.271],
];

/** Parked clear of the wall, on the door side. */
const CAR_GAP = 16;
/** School centre to the car's far end — how far the school's block reaches right. */
const CAR_TAIL = SCHOOL_WIDTH / 2 + CAR_GAP + CAR_WIDTH;
/** Space kept between that block and the pizzaiolo, so nothing is drawn through him. */
const PIZZAIOLO_ROOM = 40;
/** How much of her walk has to lie beyond the door for her to pass it at all. */
const DOOR_ROOM = 24;
/** The school itself always stays on screen, whatever else has to give. */
const SCHOOL_ON_SCREEN = SCHOOL_WIDTH / 2 + 4;

/** How long the door takes to swing open and shut again. */
export const DOOR_FRAMES = 26;
/** How long she takes getting into the car, and again getting out. */
export const BOARD_FRAMES = 16;
/** The car's top speed, in scene units per frame. */
const CAR_SPEED = 2.7;
/** Over how much of each end of the trip it pulls away and draws up. */
const CAR_EASE = 46;
/** The slowest it will creep, so that it always arrives. */
const CAR_CRAWL = 0.16;
/**
 * How much of the room between the school's car and the end of her walk is kept
 * for walking at the home end, rather than given to the drive.
 *
 * A share rather than a fixed distance: fixed, it either leaves a wide window
 * with a home end she crosses in a moment, or leaves a narrow one with no room
 * to drive at all — and then there is no car anywhere.
 */
const HOME_WALK_SHARE = 0.35;
const HOME_WALK_MIN = 70;
const HOME_WALK_MAX = 260;
/**
 * How likely she is to get in rather than turn round, each time her walk brings
 * her back to the car.
 *
 * This is what sets the shape of her day. Boarding on the first arrival gave
 * each end exactly one lap, and since the school end is wider and has a visit
 * inside it, she was at work two thirds of the time and home for a tenth of it.
 * Turning round instead keeps her at the end she is at — and out of the middle
 * either way, which is what the car is for.
 */
const LEAVE_HOME_CHANCE = 0.82;
/** She has been in, and the park is on the way back: home at the first chance. */
const LEAVE_SCHOOL_CHANCE = 1;
/** A drive shorter than this is not worth getting in for. */
const MIN_DRIVE = 120;
/**
 * Where he rides: up on the roof, back over its middle.
 *
 * A 500's roof sits behind the centre of the car, so which side of the middle
 * that is depends on which way it is pointing — measured from the nose he ends
 * up on the bonnet driving one way and the boot the other.
 */
/**
 * Where along the car the flat of the roof runs, off the traced outline itself:
 * the points whose height is the full `CAR_ROOF_HEIGHT`.
 */
const ROOF_RUN = CAR_OUTLINE.filter(([, fy]) => fy === 1).map(([fx]) => fx);
if (ROOF_RUN.length !== 2) {
  // Two points, or the perch is not the middle of anything. An outline re-traced
  // with 0.999 for the roof leaves this empty, `Math.min` of nothing is
  // Infinity, and the bird is placed at NaN — which `perched` writes every
  // frame, so he leaves the scene the moment she first boards and never
  // returns, with nothing thrown.
  throw new Error(`CAR_OUTLINE needs exactly two roof points, found ${ROOF_RUN.length}`);
}
/**
 * How far back from the middle of the car his feet go — the middle of that flat.
 *
 * Derived, not chosen. Seven was measured against the hand-drawn roof, whose
 * apex sat at 0.57 of the length; the traced roof runs 0.588 to 0.744, so seven
 * left him perched on its leading edge with his body out over the windscreen.
 */
const ROOF_BACK = ((Math.min(...ROOF_RUN) + Math.max(...ROOF_RUN)) / 2 - 0.5) * CAR_WIDTH;
/** The top of the roof, which is what he stands on. */
const ROOF_TOP = CAR_ROOF_HEIGHT;
/**
 * How far his middle is above whatever he is standing on.
 *
 * His body is drawn as an ellipse centred on his position, so a perch measured
 * at the surface buries half of him in it — which on a car roof is a bird
 * sitting inside the car.
 */
const BIRD_SIT = 9;
/**
 * Long enough to be a visit rather than a flicker: at ~40fps this is fifteen to
 * thirty-five seconds. It also has to outlast a pizza — if he is mid-mouthful
 * when she goes in he finishes it first, and a short stay meant she was back out
 * before he ever reached the trees.
 */
const INSIDE_MIN = 300;
const INSIDE_SPREAD = 400;
/** She does not go in every time she reaches the door — most passes she turns. */
const VISIT_CHANCE = 0.3;

/** How far a crown leans, and how slowly it gets there. */
const SWAY_SPEED = 0.013;
export const SWAY_REACH = 3.5;

export const OVEN_WIDTH = 96;
/**
 * A real one is a dome on a waist-high stone plinth, with the wood stored in an
 * arch underneath — so the fire and the mouth are up at the pizzaiolo's hands,
 * not down at his feet.
 */
export const OVEN_BASE_HEIGHT = 40;
export const OVEN_DOME_HEIGHT = 48;
/** Ground to the top of the dome, which is where the chimney starts. */
export const OVEN_HEIGHT = OVEN_BASE_HEIGHT + OVEN_DOME_HEIGHT;
export const CHIMNEY_HEIGHT = 24;
/** The cap sitting on top of the chimney. */
export const CHIMNEY_CAP = 6;
/**
 * The peel, measured from his feet: where it is hinged at his hands, how far
 * along it the pizza rides, and how far above the blade the pizza sits.
 *
 * Here rather than in `draw.ts` because the throw is made of it — release the
 * pizza from anywhere else and it hops out of the paddle, which is exactly what
 * it used to do. `draw.ts` reads these too, so the two cannot disagree.
 */
export const PEEL_PIVOT = { x: 6, y: -44 } as const;
export const PEEL_CARRY_ALONG = 61;
/** Above the blade, so negative in the peel's own frame. */
export const PEEL_CARRY_ABOVE = -12;
/** Where the blade starts along the handle, and how deep it is. */
export const PEEL_BLADE_ALONG = 52;
export const PEEL_BLADE_DEPTH = 18;
/** How far along the handle his hands are, so the arms swing with the peel. */
export const PEEL_GRIP = 16;
/** Level-ish, reaching into the mouth of the dome. */
const PEEL_REST_ANGLE = -0.28;
/** How far the whole swing carries it round. */
const PEEL_SWEEP = 1.1;
/**
 * How far through the swing the pizza leaves.
 *
 * Not at the end: the further round the arc, the flatter the tip is travelling,
 * so a pizza let go late is thrown sideways rather than up and over. He lets go
 * early and the peel follows through, which is both what a throw looks like and
 * what puts the pizza over the scene. Tuned against the carry point as the
 * paddle actually draws it — measured off a mirrored one, this read as 0.55.
 */
export const PEEL_RELEASE_SWING = 0.28;
/**
 * The wrist. The paddle's own speed is a lob — it clears his hat and little
 * else — so the throw carries the snap that a swinging arm ends with.
 */
const PEEL_SNAP = 2.9;
/** Enough to keep two throws from being the same, and no more. */
const TOSS_JITTER = 0.12;

/** The pizzaiolo stands this far to the oven's left, clear of it, peel in hand. */
const PIZZAIOLO_OFFSET = 78;
export const PIZZAIOLO_HEIGHT = 82;
/** She turns before she reaches him rather than walking through the oven. */
const GIRL_CLEARANCE = 52;

const BIRD_HIT_WIDTH = 48;
const BIRD_HIT_HEIGHT = 44;
const PIZZAIOLO_HIT_WIDTH = 64;
/**
 * Much wider than she is drawn: she is a few pixels across on a screen a
 * thousand wide, and a target the width of her body is one most taps miss.
 */
const GIRL_HIT_WIDTH = 72;

const SMOKE_INTERVAL = 20;
export const MAX_PUFFS = 24;
const HEART_INTERVAL = 26;
export const MAX_HEARTS = 14;
/** A perched bird's occasional heart for the girl, rarer than the full one's. */
const PERCHED_HEART_INTERVAL = 110;
export const RING_LIFE = 120;
export const DRIFT_LIFE = 70;
/** The orbit a ring heart travels, measured from the bird's middle. */
const RING_HEIGHT = 46;
const RING_RADIUS_X = 22;
const RING_RADIUS_Y = 7;

/**
 * How high above whatever he is sitting on the bird gets: hovering over it,
 * bobbing, and his own head above his middle.
 */
const BIRD_ABOVE_PERCH = HOVER_HEIGHT + HOVER_BOB + BIRD_REACH;

/**
 * Where each of his perches is, measured up from the ground.
 *
 * In the tree he sits *in* the crown rather than balanced on top of it — which
 * is both what a bird does and the difference between reserving 198px of the
 * user's screen and reserving 171px, since this is the tallest thing in the
 * scene and `SCENE_REACH` is measured from it.
 */
export const PERCH_TREE_TOP = TREE_TRUNK_HEIGHT + TREE_CROWN_RADIUS;

const PERCH_HEIGHT = {
  shoulder: SHOULDER_HEIGHT,
  tree: PERCH_TREE_TOP,
  car: ROOF_TOP + BIRD_SIT,
  lounger: LOUNGER_BACK_HEIGHT + BIRD_SIT,
  banana: BANANA_TRUNK,
} as const;

/** Which of them he is on, or would be if he flew home now. */
export type Perch = keyof typeof PERCH_HEIGHT;

/** The scene stands this far above the app's footer. */
export const GROUND_ABOVE_FOOTER = 34;

/**
 * The window width the scene was drawn for. Wider than this changes nothing —
 * the scenery does not grow, it just has more room to stand in.
 */
export const SCENE_FULL_WIDTH = 900;
/** Narrow enough that a phone fits the scene; small enough is not smaller still. */
export const SCENE_MIN_SCALE = 0.72;
/** The width at which the shrinking stops, being about the narrowest phone. */
const SCENE_MIN_WIDTH = 360;

/**
 * How large to draw the scene on a window this wide.
 *
 * The scene is drawn scaled rather than laid out differently, and everything in
 * this file goes on working in the units it was written in — a phone simply
 * hands it a wider stage (`width / sceneScale(width)`) with smaller scenery on
 * it. At 360px unscaled there is no room between the school and the oven for a
 * car, or for her to walk anywhere worth walking.
 */
export function sceneScale(width: number): number {
  const range = SCENE_FULL_WIDTH - SCENE_MIN_WIDTH;
  const along = (width - SCENE_MIN_WIDTH) / range;
  return clamp(SCENE_MIN_SCALE + along * (1 - SCENE_MIN_SCALE), SCENE_MIN_SCALE, 1);
}

/**
 * The highest a squirrel gets: the top of the tallest thing it can climb, plus
 * the arc of a crossing.
 *
 * Off the whole list rather than off the park, which was right only for as long
 * as the bananas happened to be shorter than a park tree — raise `BANANA_TRUNK`
 * past it and squirrels would climb over the user's own list with nothing to
 * say so. It stays under `SCENE_REACH`, which is measured from the bird in a
 * park tree, so the reserved band does not grow because of them; a test pins
 * that rather than this comment.
 */
export const SQUIRREL_REACH =
  Math.max(PERCH_HEIGHT.tree, ...BANANA_TRUNKS) + CROSS_ARC * CROSS_ARC_MAX;

/**
 * How far above the ground the scene reaches with nothing in the air: the top of
 * the chimney cap, and the bird at the top of his hover.
 *
 * The floor the app reserves is derived from this rather than picked to look
 * right, so a taller oven or a higher hover cannot quietly start drawing over
 * the app's own content. What is *thrown* is deliberately not counted — a pizza
 * sailing up over the app, like the squirrel's falling acorns, is the point.
 */
export const SCENE_REACH = Math.max(
  OVEN_HEIGHT + CHIMNEY_HEIGHT + CHIMNEY_CAP,
  SCHOOL_REACH,
  // Whichever perch is highest, plus how far above it he gets. Taken off the
  // same list `perchY` places him with, so a perch added there cannot be
  // forgotten here — which is the one way the band could silently go stale.
  Math.max(...Object.values(PERCH_HEIGHT)) + BIRD_ABOVE_PERCH,
);

/**
 * `escorting` and `perched` are the two idle states — above her, or on her
 * shoulder. Everything else is one trip through a pizza.
 */
export type SquirrelPhase = 'climbing' | 'sitting' | 'crossing' | 'kissing';

export interface Squirrel {
  /** Which tree it is in — while crossing, the one it left. */
  tree: number;
  /** Where along that tree it is: 0 at the foot, 1 at the top of the crown. */
  up: number;
  /** Climbing up or down. */
  dir: 1 | -1;
  phase: SquirrelPhase;
  /** Frames left in a sit, or frames into a crossing. */
  timer: number;
  /** The tree it is crossing to, and which side of the trunk it sits on. */
  towards: number;
  side: number;
}

export type BirdPhase =
  | 'escorting'
  | 'landing'
  | 'perched'
  | 'diving'
  | 'eating'
  | 'full'
  | 'takeoff';

export interface Bird {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: BirdPhase;
  /** Frames left in a phase that ends on a timer. */
  timer: number;
  facingRight: boolean;
  /** Wing-beat counter; still while he is on the ground. */
  flap: number;
  /**
   * Which perch he took when he sat down.
   *
   * `perched` holds him *at* his perch by setting his position every frame,
   * which is right while it stays put and a teleport the moment it becomes a
   * different perch — she goes into the school and home is a treetop, she comes
   * out and it is her shoulder again. Remembering which one he chose is what
   * lets `perched` notice, wherever the change came from: keying it on the two
   * girl transitions that happen to cause it today would leave the next cause —
   * a second perch, another reason she leaves — to reintroduce the jump.
   *
   * Identity rather than distance, because `perched` may not doubt that it is at
   * its perch: anything that places him there deliberately still counts.
   */
  perchedOn: Perch;
}

/**
 * `walking` is the pacing she has always done, `entering`/`inside`/`leaving` one
 * visit to the school, and the last three one drive: getting in, the drive
 * itself, and getting out again. She walks the two ends of the scene — the park
 * at one, the oven at the other — and drives the empty stretch between them.
 */
export type GirlPhase =
  | 'lounging'
  | 'walking'
  | 'entering'
  | 'inside'
  | 'leaving'
  | 'boarding'
  | 'driving'
  | 'alighting';

export interface Girl {
  x: number;
  dir: 1 | -1;
  /**
   * Which way she is *turned*, easing between −1 and 1 rather than flipping with
   * `dir`.
   *
   * The shoulder he sits on is the one behind her, so it is on the far side of
   * her the moment she turns — and `perched` puts him exactly on it every frame.
   * Taken straight off `dir` that is the width of her body crossed in a single
   * frame, twice a lap, for as long as the scene runs.
   */
  facing: number;
  /**
   * Where he sits while she is lying down: the head of the lounger, or one of
   * the banana trees over it.
   *
   * Chosen once, when she lies down, and held for as long as she is there.
   * Decided per frame it would change under him every frame — `perched` follows
   * the perch, and `perchedOn` puts him back in the air whenever it changes, so
   * he would bounce between the two for the whole afternoon.
   */
  restPerch: Extract<Perch, 'lounger' | 'banana'>;

  /**
   * Set when a drive ends at the school: the next time she reaches the door she
   * goes in, rather than taking the usual chance on it. Driving somewhere and
   * not going in is not an errand.
   */
  dueAtSchool: boolean;
  /** Walk-cycle counter, so the legs move with the distance covered. */
  step: number;
  phase: GirlPhase;
  /** Frames left in a phase that ends on a timer. */
  timer: number;
}

/**
 * The Fiat, and where it is now: parked at one of its two spots, or carrying
 * her between them. `null` on a window with no room to park one clear of the
 * pizzaiolo, which is also a window with no room to drive across.
 */
export interface Car {
  x: number;
  /** How fast it is going, so a bird can tell whether he is keeping station. */
  vx: number;
  /** Which way it is pointing, so the seat beside her stays beside her. */
  dir: 1 | -1;
  /**
   * Which end it is parked at, or where it is heading while she drives.
   *
   * Held rather than recovered from `x`, for the reason `bird.perchedOn` is:
   * comparing a coordinate to a layout number works only while every writer
   * lands exactly on one, and the first thing that nudges the car by a pixel
   * would leave it unboardable for ever — no error, she simply stops taking it.
   */
  at: 'school' | 'home';
}

export interface Pizza {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  rotation: number;
}

export interface Puff {
  x: number;
  y: number;
  radius: number;
  drift: number;
  life: number;
  maxLife: number;
}

/**
 * `kiss` is hers, and the only thing in the scene the app's own user starts: one
 * heart from her, and he comes down to her shoulder. It rises and fades like a
 * `drift` one, which is why the two share everything but where they begin.
 *
 * `ring` hearts circle a bird too full to fly — that is the "wait for me" sign,
 * and nothing else uses it. A `drift` heart is a single one he lets go while
 * perched, rising off to one side, so being in love does not read as being full.
 *
 * Both carry a real `x`/`y`: a ring heart's orbit is advanced here rather than
 * worked out again at drawing time, so "the ring follows the bird" is something
 * a test can hold rather than something only the screen knows.
 */
export interface Heart {
  kind: 'ring' | 'drift' | 'kiss';
  /** Where round the bird's head this one is. Ring hearts only. */
  angle: number;
  x: number;
  y: number;
  life: number;
}

export interface Layout {
  ovenX: number;
  pizzaioloX: number;
  girlLeft: number;
  girlRight: number;
  /** Left to right as they are drawn; the first is the one nearest the school. */
  treeXs: number[];
  schoolX: number;
  /** Where she stops to go in. She walks past it, so it is inside her range. */
  doorX: number;
  /**
   * Where the car waits at each end of its drive: outside the school, and home
   * at the oven end, short of the pizzaiolo with room to walk beyond him. Both
   * `null` together on a window too narrow to park one clear of him, or too
   * narrow for the drive to be worth getting in for.
   */
  carSchoolX: number | null;
  carHomeX: number | null;
  /** The lounger at the home end, and the two banana trees standing over it. */
  loungerX: number;
  bananaXs: number[];
}

export interface Scene {
  width: number;
  height: number;
  /** The line everyone stands on: feet, oven base, the bottom of a splat. */
  ground: number;
  layout: Layout;
  bird: Bird;
  girl: Girl;
  oven: {
    nextPizzaIn: number;
    tossing: number;
    recovering: number;
    /** Whether this swing has already let its pizza go. */
    thrown: boolean;
    smoke: Puff[];
  };
  car: Car | null;
  /** Scenery with a life of its own; nothing else in the scene reads it. */
  squirrels: Squirrel[];
  /** Rising from the school chimney, and only while she is in there. */
  schoolSmoke: Puff[];
  /** One at a time, by construction — there is only ever one slot. */
  pizza: Pizza | null;
  hearts: Heart[];
  frame: number;
}

export interface SceneSize {
  width: number;
  height: number;
  ground: number;
}

type Rng = () => number;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The oven sits on the right and the school on the left, and the girl walks the
 * space between them. On a narrow window that space shrinks rather than either
 * building sliding off the edge — and the park, being furthest out and least
 * load-bearing, is what goes over the left edge first.
 */
function layoutFor(width: number): Layout {
  const ovenX = Math.max(width * 0.62, width - 84);
  const pizzaioloX = ovenX - PIZZAIOLO_OFFSET;

  const girlRight = Math.max(GIRL_MARGIN, pizzaioloX - GIRL_CLEARANCE);

  // The school is capped, not just placed. Two things it must not do, both of
  // which it did: sit past the end of her walk, which put the door somewhere she
  // could never reach and killed the whole visit on a 320px phone; and push the
  // car it parks into the pizzaiolo, which happened at every phone width.
  const schoolX = Math.max(
    SCHOOL_ON_SCREEN,
    Math.min(
      SCHOOL_HOME,
      width * 0.34,
      girlRight - DOOR_ROOM,
      pizzaioloX - PIZZAIOLO_ROOM - CAR_TAIL,
    ),
  );

  const parkRight = schoolX - SCHOOL_WIDTH / 2 - PARK_GAP - TREE_CROWN_RADIUS;
  const treeXs = Array.from({ length: TREE_COUNT }, (_, i) => parkRight - i * TREE_GAP);

  // Her walk is the whole width between the buildings, as it always was. She
  // passes the door rather than turning at it: making the door her turning point
  // cut her range to a third and she paced like something wound too tight.
  const doorX = schoolX;

  // On a window too narrow for both, the car goes rather than being drawn
  // through the pizzaiolo. The park has already gone by then.
  const carRight = schoolX + CAR_TAIL;
  const schoolSpotX = schoolX + SCHOOL_WIDTH / 2 + CAR_GAP + CAR_WIDTH / 2;
  // Short of the pizzaiolo, with a stretch of walking left beyond it: the oven
  // end is half the scene worth watching, and a car parked at the end of her
  // range would leave her nothing to walk there.
  const homeSpotX =
    girlRight - clamp((girlRight - schoolSpotX) * HOME_WALK_SHARE, HOME_WALK_MIN, HOME_WALK_MAX);
  // Between where the car waits and the end of her walk — or, with no car to
  // wait anywhere, simply near the end of it. Either way she passes it.
  const homeStart = Math.max(GIRL_MARGIN, Math.min(homeSpotX, girlRight - 40));
  const loungerX = homeStart + (girlRight - homeStart) * LOUNGER_ALONG;

  const parkable =
    carRight <= pizzaioloX - PIZZAIOLO_ROOM &&
    homeSpotX - schoolSpotX >= MIN_DRIVE &&
    schoolSpotX >= GIRL_MARGIN &&
    homeSpotX <= girlRight;

  return {
    ovenX,
    pizzaioloX,
    treeXs,
    schoolX,
    doorX,
    carSchoolX: parkable ? schoolSpotX : null,
    carHomeX: parkable ? homeSpotX : null,
    loungerX,
    // Spaced by how many there are, not read off a second hand-written list:
    // one entry short and `loungerX + undefined` is NaN, which propagates into
    // `up` where no clamp recovers it, and the squirrel simply stops being
    // drawn for the rest of the session with nothing thrown anywhere.
    bananaXs: BANANA_TRUNKS.map(
      (_, plant) => loungerX + (plant - (BANANA_TRUNKS.length - 1) / 2) * BANANA_GAP,
    ),
    girlLeft: GIRL_MARGIN,
    girlRight,
  };
}

/**
 * Where the bird calls home.
 *
 * Her shoulder, as ever — except while she is inside, when it is the treetop
 * nearest the school. Substituting the target rather than adding a phase is what
 * keeps "waits on the tree" and "flies about near it" out of the state machine
 * entirely: `perched` and `escorting` already steer at home, and diving for a
 * pizza mid-visit goes on working without knowing she is gone. The seat of the
 * car is the third of them, on the same terms.
 */
export function currentPerch(scene: Scene): Perch {
  if (!girlOut(scene)) return 'tree';
  if (lounging(scene)) return scene.girl.restPerch;
  // From the moment she starts getting in, so he is already in the seat rather
  // than chasing a car that has pulled away with her shoulder in it.
  return inCar(scene) && scene.car ? 'car' : 'shoulder';
}

export function perchX(scene: Scene): number {
  const perch = currentPerch(scene);
  if (perch === 'car') return scene.car!.x - scene.car!.dir * ROOF_BACK;
  if (perch === 'lounger') return scene.layout.loungerX - LOUNGER_PERCH_BACK;
  // Swaying with the plant he is standing in, as in a park tree.
  if (perch === 'banana') return treeX(scene, scene.layout.treeXs.length);
  if (girlOut(scene)) return shoulderX(scene);
  // Swaying with the crown he is sitting in, rather than held at the trunk while
  // the tree moves around him — and inside the same edge the bird is clamped to,
  // or on a narrow window he would steer forever at a perch he cannot reach and
  // never finish landing.
  const tree = treeX(scene, 0);
  return clamp(tree, BIRD_EDGE, Math.max(BIRD_EDGE, scene.width - BIRD_EDGE));
}

/**
 * Everything a squirrel can climb: the park's trees, and the banana plants at
 * the home end.
 *
 * One list, because a squirrel does not care which kind it is in — it wants a
 * trunk to go round and a crown to sit in. Each carries its own height, since
 * the bananas are shorter and a squirrel measured against a park tree would
 * climb straight out of the crown it is supposed to be in.
 */
export function treeCount(scene: Scene): number {
  return scene.layout.treeXs.length + scene.layout.bananaXs.length;
}

/** Which of them are the park's, the bananas being the rest. */
export function inPark(scene: Scene, at: number): boolean {
  return at < scene.layout.treeXs.length;
}

/**
 * Where one of them stands this frame, swaying with its own wind.
 *
 * Read one at a time rather than as a list: `squirrelX`, `squirrelY`,
 * `crossArc` and `squirrelFacing` all want a single number, and building the
 * whole park to index it once ran ~16 times a frame — a hundred-odd throwaway
 * objects a frame, for as long as an installed PWA is left open. The same waste
 * the leaf shapes upstream are cached to avoid.
 */
export function treeX(scene: Scene, at: number): number {
  return inPark(scene, at)
    ? scene.layout.treeXs[at] + treeSway(scene, at)
    : scene.layout.bananaXs[at - scene.layout.treeXs.length] +
        bananaLean(scene, at - scene.layout.treeXs.length);
}

/** And how tall it is, which is fixed for the scene's life. */
export function treeTop(scene: Scene, at: number): number {
  return inPark(scene, at) ? PERCH_HEIGHT.tree : BANANA_TRUNKS[at - scene.layout.treeXs.length];
}

/**
 * How wide a circle it goes round, up in the crown.
 *
 * A park tree has a crown to orbit inside. A banana has none — its pseudostem is
 * a few units across — so a squirrel swung at the park's radius hung in open air
 * beside it, and `squirrelBehind` then hid it behind a stem a fifth as wide for
 * half of every turn: the blinking the two-pass draw exists to stop, in the
 * stand it was added for.
 */
export function treeRadius(scene: Scene, at: number): number {
  return inPark(scene, at) ? SPIRAL_CROWN_RADIUS : BANANA_SPIRAL_RADIUS;
}

/** How far round the tree it has got, which is what makes the climb a spiral. */
function spiralAngle(squirrel: Squirrel): number {
  return squirrel.side + squirrel.up * SPIRAL_TURNS * Math.PI * 2;
}

/** How high a jump arches: further to go, higher over the park. */
function crossArc(scene: Scene, squirrel: Squirrel): number {
  const gap = Math.abs(treeX(scene, squirrel.towards) - treeX(scene, squirrel.tree));
  // Against its own stand's spacing. Measured against the park's, a hop between
  // the bananas — which stand further apart than the park's trees — read as
  // further than it is and arced higher than the plants are tall.
  const spacing = inPark(scene, squirrel.tree) ? TREE_GAP : BANANA_GAP;
  return CROSS_ARC * Math.min(CROSS_ARC_MAX, Math.max(1, gap / spacing));
}

/** Where a squirrel is across the park, arcing between trees while it crosses. */
export function squirrelX(scene: Scene, squirrel: Squirrel): number {
  const from = treeX(scene, squirrel.tree);
  // Wider round the crown than round the trunk, because the tree is.
  const round =
    squirrel.phase === 'kissing'
      ? Math.sin(spiralAngle(squirrel)) * KISS_APART
      : Math.sin(spiralAngle(squirrel)) *
        (TRUNK_RADIUS + (treeRadius(scene, squirrel.tree) - TRUNK_RADIUS) * squirrel.up);
  if (squirrel.phase !== 'crossing') return from + round;

  const to = treeX(scene, squirrel.towards);
  return from + (to - from) * (squirrel.timer / CROSS_FRAMES) + round;
}

/**
 * Whether it is round the far side of the trunk just now.
 *
 * The drawing takes two passes at them because of this: one behind the trees and
 * one in front, so going round is something you can see rather than a squirrel
 * sliding across the bark.
 */
/**
 * Which way a squirrel is turned: 1 facing right, −1 facing left.
 *
 * Outwards from the trunk as it goes round — and inwards, at each other, for the
 * pair at the top, which is what makes a kiss read as a kiss.
 */
export function squirrelFacing(scene: Scene, squirrel: Squirrel): 1 | -1 {
  const outward = squirrelX(scene, squirrel) >= treeX(scene, squirrel.tree) ? 1 : -1;
  return squirrel.phase === 'kissing' ? (-outward as 1 | -1) : outward;
}

export function squirrelBehind(squirrel: Squirrel): boolean {
  return squirrel.phase !== 'crossing' && Math.cos(spiralAngle(squirrel)) < 0;
}

/**
 * How far up the tree it will be when it lands.
 *
 * The height it left at, unless the tree it is heading for is too short to hold
 * it — the bananas are 62 and 46, so the taller one's crown is above the
 * shorter one's top and a squirrel crossing between them has to come down.
 */
function arrivalUp(scene: Scene, squirrel: Squirrel): number {
  const height = squirrel.up * treeTop(scene, squirrel.tree);
  return clamp(height / treeTop(scene, squirrel.towards), 0, 1);
}

/** And how high, which is the one thing about them the app's layout cares about. */
export function squirrelY(scene: Scene, squirrel: Squirrel): number {
  const along = squirrel.up * treeTop(scene, squirrel.tree);
  if (squirrel.phase !== 'crossing') return scene.ground - along;

  // Across to the height it will land at, rather than holding the height it
  // left at and dropping the difference on the arrival frame. Carrying the
  // height across and clamping it on arrival looked like it preserved the
  // height, and does when the two trees are the same — but between the two
  // bananas the clamp swallowed 16 units in a single frame, against a climb of
  // half a unit, which is the jerk that carrying it was meant to remove.
  const through = squirrel.timer / CROSS_FRAMES;
  const landing = arrivalUp(scene, squirrel) * treeTop(scene, squirrel.towards);
  // A hop, not a wire: highest halfway across.
  return (
    scene.ground -
    (along + (landing - along) * through) -
    Math.sin(through * Math.PI) * crossArc(scene, squirrel)
  );
}

function runSquirrels(scene: Scene, rng: Rng): void {
  for (const squirrel of scene.squirrels) {
    switch (squirrel.phase) {
      case 'climbing': {
        squirrel.up = clamp(squirrel.up + squirrel.dir * CLIMB_SPEED, 0, 1);
        if (squirrel.up === 0 || squirrel.up === 1) {
          squirrel.phase = 'sitting';
          squirrel.timer = SQUIRREL_SIT_MIN + Math.floor(rng() * SQUIRREL_SIT_SPREAD);
        }
        break;
      }
      case 'sitting': {
        if (--squirrel.timer > 0) break;
        // High in the crown, it may go across to a neighbour instead of back
        // down. The neighbours are worked out after the roll, since two thirds
        // of the time the answer is thrown away unlooked at.
        const others =
          squirrel.up > 0.5 && rng() < CROSS_CHANCE ? otherTrees(scene, squirrel.tree) : [];
        if (others.length > 0) {
          squirrel.phase = 'crossing';
          // Often at the other one, which is how they come to share a tree at
          // all; otherwise anywhere in the park.
          // Only at a mate it could actually jump to: the nearest other
          // squirrel may be in the park while this one is in the bananas, and
          // aiming there turns a jump into a flight across the whole scene.
          const mate = scene.squirrels.find(
            (other) => other !== squirrel && others.includes(other.tree),
          );
          squirrel.towards =
            mate && rng() < MEET_CHANCE ? mate.tree : others[Math.floor(rng() * others.length)];
          squirrel.timer = 0;
          break;
        }
        squirrel.phase = 'climbing';
        squirrel.dir = squirrel.up >= 1 ? -1 : 1;
        break;
      }
      case 'kissing':
        // Held by the pair below: one of them cannot decide this alone.
        break;

      case 'crossing': {
        squirrel.timer++;
        if (squirrel.timer < CROSS_FRAMES) break;
        // Exactly where `squirrelY` has been drawing it arriving, so the last
        // frame of the flight and the first frame of the climb are the same
        // height.
        //
        // `up` is not only a height: the spiral is `side + up * SPIRAL_TURNS`
        // turns, so landing lower on a shorter tree also spun it round the
        // trunk — 26 units sideways in one frame between the two bananas, and
        // half the time it popped from in front of the stem to behind it. That
        // is the same jerk this fix removed from the height, moved into the
        // width. The phase lives in `side`, so the difference goes there.
        const landed = arrivalUp(scene, squirrel);
        const turn = (squirrel.up - landed) * SPIRAL_TURNS * Math.PI * 2;
        squirrel.side += turn;
        squirrel.up = landed;
        squirrel.tree = squirrel.towards;
        squirrel.phase = 'climbing';
        squirrel.dir = -1;
        squirrel.timer = 0;
        break;
      }
    }
  }
}

/**
 * Every tree it will jump to: the others in its own stand.
 *
 * The stand is the whole of it. This used to be a distance — 150 units — which
 * looked like it separated the two colonies and does at a desktop width, but
 * the scene squeezes as the window narrows and below about 385px the nearest
 * park tree and the nearest banana came within that of each other. Squirrels
 * emigrated: over seeded runs at 320-375px a pair split across the two stands
 * within twenty seconds and stayed split, and since kissing needs both in one
 * tree and pairs are fixed at creation, neither pair could kiss again. The jump
 * flew through the schoolhouse on the way.
 *
 * The distance is gone rather than kept alongside: within a stand the widest
 * gap is 88 units of park or 54 of banana, so it could never once have excluded
 * anything, and a predicate that cannot fire is a trap — raise `TREE_GAP` past
 * it and a squirrel would simply stop crossing, with no test to notice.
 */
function otherTrees(scene: Scene, tree: number): number[] {
  const stand = inPark(scene, tree);
  const near: number[] = [];
  for (let at = 0; at < treeCount(scene); at++) {
    if (at !== tree && inPark(scene, at) === stand) near.push(at);
  }
  return near;
}

/**
 * Where the pair of them are, if they are anywhere together.
 *
 * Kissing takes two, so it cannot be decided inside a loop that sees one at a
 * time: the squirrels are checked as a pair once the whole park has moved.
 */
function runSquirrelPairs(scene: Scene, rng: Rng): void {
  // Two at a time, in the order they were made: the first pair lives in the
  // park and the second in the bananas, so each colony has somebody to kiss.
  for (let at = 0; at + 1 < scene.squirrels.length; at += 2) {
    runSquirrelPair(scene, rng, scene.squirrels[at], scene.squirrels[at + 1]);
  }
}

function runSquirrelPair(scene: Scene, rng: Rng, one: Squirrel, two: Squirrel): void {
  if (one.phase === 'kissing' && two.phase === 'kissing') {
    one.timer--;
    two.timer--;
    if (scene.frame % KISS_HEART_INTERVAL === 0 && scene.hearts.length < MAX_HEARTS) {
      scene.hearts.push({
        kind: 'drift',
        angle: 0,
        x: (squirrelX(scene, one) + squirrelX(scene, two)) / 2,
        y: squirrelY(scene, one) - 8,
        life: DRIFT_LIFE,
      });
    }
    if (one.timer > 0) return;
    // Down the tree again, and back to their own business — from exactly where
    // the kiss left them. Putting the side they were born on back here jumped
    // the spiral in one frame: 17.4 units, twice the worst jerk this scene has
    // anywhere else, with the squirrel popping from in front of the trunk to
    // behind it in half of all releases. What the restore was for is now in the
    // kiss angles themselves, which cost nothing to hold.
    for (const squirrel of [one, two]) {
      squirrel.phase = 'climbing';
      squirrel.dir = -1;
    }
    return;
  }

  const together =
    one.tree === two.tree &&
    [one, two].every((squirrel) => squirrel.phase === 'sitting' && squirrel.up >= 1);
  if (!together || rng() >= KISS_CHANCE) return;

  // Side by side at the top, facing one another. The spiral angle is set rather
  // than left where the climb finished, or they would be kissing whichever way
  // round the trunk they each happened to arrive.
  //
  // Tilted by the colony, so the two pairs do not come out of a kiss holding
  // the same two angles: `sin`/`cos` cannot tell 90 degrees from 90 degrees,
  // and both colonies climbing down in step is the "one squirrel with a
  // shadow" the seeding spread exists to prevent. A sixth of a turn is enough
  // to separate all four and still leaves them either side of the trunk.
  const climbed = SPIRAL_TURNS * Math.PI * 2;
  const tilt = inPark(scene, one.tree) ? 0 : KISS_TILT;
  one.side = Math.PI / 2 + tilt - climbed;
  two.side = -Math.PI / 2 + tilt - climbed;
  for (const squirrel of [one, two]) {
    squirrel.phase = 'kissing';
    squirrel.timer = KISS_FRAMES;
  }
}

/**
 * How fast the perch itself is travelling.
 *
 * A perch is not always standing still: her shoulder walks, and the car drives.
 * Whether he has *settled* onto one is a question about the gap between them,
 * not about his speed over the ground — measured against zero he could only ever
 * land on something stopped, which is why he flew above the car for the whole
 * drive and only ever got in during the pause while she was getting in.
 */
export function perchVX(scene: Scene): number {
  if (currentPerch(scene) === 'car') return scene.car?.vx ?? 0;
  if (scene.girl.phase === 'walking') return scene.girl.dir * GIRL_SPEED;
  return 0;
}

/**
 * Sitting on something, rather than in the air: wings folded, and still.
 *
 * Here rather than in `draw.ts` because it is a fact about what he is doing —
 * the drawing knew only about the two grounded phases, so a perched bird beat
 * his wings on the spot for as long as he sat there.
 */
export function birdAtRest(scene: Scene): boolean {
  const { phase } = scene.bird;
  return phase === 'perched' || phase === 'full' || phase === 'eating';
}

/** Where he aims for a perch that is moving: where it will be, not where it is. */
export function perchLeadX(scene: Scene, steer: { gain: number; drag: number }): number {
  return perchX(scene) + perchVX(scene) * leadFrames(steer);
}

/** Near his perch, and matching its speed: close enough to put his feet down. */
export function settledOnPerch(scene: Scene): boolean {
  const { bird } = scene;
  return (
    Math.abs(bird.x - perchX(scene)) < SETTLE_REACH &&
    Math.abs(bird.vx - perchVX(scene)) < SETTLE_DRIFT
  );
}

export function perchY(scene: Scene): number {
  return scene.ground - PERCH_HEIGHT[currentPerch(scene)];
}

/**
 * Whether the pizzaiolo has anyone to make a pizza for: she is at the home end
 * of the scene, or on her way back to it. He is making them for her, and one
 * tossed while she is at the school or in the park is one nobody is there for.
 *
 * A window with no car has no ends to be at, so the old rule stands: she is
 * simply out, or she is not.
 */
export function homeward(scene: Scene): boolean {
  if (!girlOut(scene)) return false;
  const { carHomeX } = scene.layout;
  if (!scene.car || carHomeX === null) return true;
  if (scene.girl.phase === 'driving') return scene.girl.dir === 1;
  // Lying on the lounger is as at-home as it gets.
  return lounging(scene) || scene.girl.x >= carHomeX;
}

/** Walking the scene on her own legs, rather than inside the school or the car. */
export function girlOnFoot(scene: Scene): boolean {
  return girlOut(scene) && scene.girl.phase !== 'driving' && scene.girl.phase !== 'lounging';
}

/**
 * Behind the wheel: she is inside the car and drawn through its window rather
 * than standing on the road.
 *
 * A predicate rather than a phase comparison in `draw.ts`, for the reason all of
 * these exist: the drawing has no assertable output, so a fact it works out for
 * itself is a fact no test can hold. `inCar` is not the same question — it
 * counts `boarding`, through which she is still on her feet beside the car.
 */
export function atTheWheel(scene: Scene): boolean {
  return scene.girl.phase === 'driving';
}

/** Stretched out on the lounger under the banana trees. */
export function lounging(scene: Scene): boolean {
  return scene.girl.phase === 'lounging';
}

/** Standing at the car: getting in, driving, or getting out again. */
export function atCar(scene: Scene): boolean {
  return inCar(scene) || scene.girl.phase === 'alighting';
}

/** In the car, or on her way into it — either way, not walking beside it. */
export function inCar(scene: Scene): boolean {
  return scene.girl.phase === 'boarding' || scene.girl.phase === 'driving';
}

/** She is drawn, and has a shoulder to sit on, whenever she is not inside. */
export function girlOut(scene: Scene): boolean {
  return scene.girl.phase !== 'inside';
}

/** The school's window is lit while she is in there — which is to say, not out. */
export function schoolLit(scene: Scene): boolean {
  return !girlOut(scene);
}

/**
 * How far the door stands open, 0 shut to 1 wide — an arc, so it swings open and
 * shut again across the frames she is stepping through it.
 */
export function doorOpen(scene: Scene): number {
  const { phase, timer } = scene.girl;
  if (phase !== 'entering' && phase !== 'leaving') return 0;
  // Symmetric about its middle, so it opens and shuts across the frames she
  // is stepping through it.
  return Math.sin((timer / DOOR_FRAMES) * Math.PI);
}

/**
 * The roof's surface directly above a point, so anything standing on it can sit
 * on the slope rather than hover over it.
 */
export function schoolRoofY(scene: Scene, x: number): number {
  const eaves = scene.ground - SCHOOL_WALL_HEIGHT;
  const along = Math.min(1, Math.abs(x - scene.layout.schoolX) / ROOF_HALF);
  return eaves - SCHOOL_ROOF_HEIGHT * (1 - along);
}

/**
 * Where the chimney stands, and where its mouth is.
 *
 * Both sides of its foot sit on the roof, which is the whole reason this is
 * worked out rather than placed: the roof falls away to the right, so a stack
 * with a level base has one corner buried and the other hanging in the air.
 */
export function schoolChimney(scene: Scene): {
  left: number;
  right: number;
  top: number;
  mouth: { x: number; y: number };
} {
  const centre = scene.layout.schoolX + ROOF_HALF * CHIMNEY_ALONG;
  const left = centre - SCHOOL_CHIMNEY_WIDTH / 2;
  const right = centre + SCHOOL_CHIMNEY_WIDTH / 2;
  // Measured at the higher corner, so the stack clears the roof on both sides.
  const top = schoolRoofY(scene, left) - SCHOOL_CHIMNEY_HEIGHT;
  return { left, right, top, mouth: { x: centre, y: top - SCHOOL_CHIMNEY_CAP } };
}

/**
 * How far one banana leaf is nodding right now, in radians.
 *
 * Its own phase per leaf and per plant: moved as one they read as a flag rather
 * than as a plant with leaves. Here rather than in `draw.ts` for the same reason
 * `treeSway` is — the drawing has no assertable output.
 */
export function leafSway(scene: Scene, tree: number, leaf: number): number {
  return Math.sin(scene.frame * LEAF_SWAY_SPEED + tree * 2.3 + leaf * 0.9) * LEAF_SWAY;
}

/** How far this crown is leaning right now. Pure, so the sway can be asserted. */
export function treeSway(scene: Scene, index: number): number {
  return Math.sin(scene.frame * SWAY_SPEED + index * 1.7) * SWAY_REACH;
}

export function shoulderX(scene: Scene): number {
  return scene.girl.x - scene.girl.facing * SHOULDER_BACK;
}

export function shoulderY(scene: Scene): number {
  return scene.ground - SHOULDER_HEIGHT;
}

/**
 * Where she is standing when the scene opens: at one end or the other, never in
 * between.
 *
 * The middle is the stretch she never walks — it is what the car is for — so
 * being dropped into it means walking out of it on foot, which is the one
 * journey the scene is built to avoid. With no car there are no ends, and she
 * starts anywhere in her range as she always did.
 */
function startingX(layout: Layout, rng: Rng): number {
  const { girlLeft, girlRight, carSchoolX, carHomeX } = layout;
  if (carSchoolX === null || carHomeX === null) {
    return clamp(girlLeft + rng() * Math.max(1, girlRight - girlLeft), girlLeft, girlRight);
  }
  const [from, to] = rng() < 0.5 ? [girlLeft, carSchoolX] : [carHomeX, girlRight];
  return clamp(from + rng() * Math.max(1, to - from), from, to);
}

/**
 * The car, waiting at whichever end she was dropped into the scene at.
 *
 * Parked at a fixed end it can start the session on the far side of the middle
 * from her — and the middle is the one stretch she never walks, so she would
 * have to cross it on foot to reach the car that exists to carry her across it.
 */
function parkedNear(layout: Layout, girlX: number): Car | null {
  if (layout.carSchoolX === null || layout.carHomeX === null) return null;
  const atSchool = girlX < (layout.carSchoolX + layout.carHomeX) / 2;
  return {
    x: atSchool ? layout.carSchoolX : layout.carHomeX,
    vx: 0,
    dir: 1,
    at: atSchool ? 'school' : 'home',
  };
}

const pizzaInterval = (rng: Rng) => PIZZA_INTERVAL_MIN + Math.floor(rng() * PIZZA_INTERVAL_SPREAD);

export function createScene(size: SceneSize, rng: Rng): Scene {
  const layout = layoutFor(size.width);
  const girlX = startingX(layout, rng);

  return {
    width: size.width,
    height: size.height,
    ground: size.ground,
    layout,
    bird: {
      x: girlX,
      y: size.ground - SHOULDER_HEIGHT - HOVER_HEIGHT,
      vx: 0,
      vy: 0,
      phase: 'escorting',
      timer: 0,
      facingRight: true,
      flap: 0,
      perchedOn: 'shoulder',
    },
    girl: {
      x: girlX,
      dir: rng() < 0.5 ? -1 : 1,
      facing: rng() < 0.5 ? -1 : 1,
      step: 0,
      phase: 'walking',
      timer: 0,
      dueAtSchool: false,
      restPerch: 'lounger',
    },
    oven: { nextPizzaIn: pizzaInterval(rng), tossing: 0, recovering: 0, thrown: false, smoke: [] },
    car: parkedNear(layout, girlX),
    squirrels: Array.from({ length: SQUIRREL_COUNT }, (_, i) => {
      // A pair per colony, in the order they are made: the first into the park
      // and the second into the bananas. Stated once — written out again for
      // `towards`, the two could drift apart and a squirrel would be created
      // already mid-jump.
      const inPair = i % 2;
      // A half turn between the pair and a quarter between the colonies. On the
      // global index `SQUIRREL_SIDE` being pi made squirrel 2's side of 2pi
      // identical to squirrel 0's 0 once `sin`/`cos` had it, so the two colonies
      // climbed in perfect lockstep at opposite ends of the scene — the "one
      // squirrel with a shadow" the spread exists to prevent, with `up` and
      // `dir` fixed for it and this left behind.
      const born = inPair * SQUIRREL_SIDE + (i < SQUIRREL_COUNT / 2 ? 0 : SQUIRREL_SIDE / 2);
      const tree =
        i < SQUIRREL_COUNT / 2
          ? inPair % layout.treeXs.length
          : layout.treeXs.length + (inPair % layout.bananaXs.length);
      return {
        tree,
        towards: tree,
        // Spread along their tree, so two of them are never one squirrel with a
        // shadow: they start at different heights and climbing opposite ways.
        // Within the tree, not past its top — per pair, since `0.25 + i * 0.4`
        // put the third and fourth above 1 and their first frame snapped them
        // back down the trunk.
        up: 0.25 + inPair * 0.4,
        dir: (inPair === 0 ? 1 : -1) as 1 | -1,
        phase: 'climbing' as SquirrelPhase,
        timer: 0,
        side: born,
      };
    }),
    schoolSmoke: [],
    pizza: null,
    hearts: [],
    frame: 0,
  };
}

/**
 * Put everyone back inside a window that changed size. A perched bird follows
 * the shoulder he is sitting on, which may itself have just been pulled inside
 * the new bounds — without that he would be left hanging in mid-air off-screen.
 */
export function resizeScene(scene: Scene, size: SceneSize): void {
  scene.width = size.width;
  scene.height = size.height;
  scene.ground = size.ground;
  scene.layout = layoutFor(size.width);

  // A window that lost its car takes her out of it: the spots it drove between
  // are gone, so there is nowhere left for the trip to end.
  if (scene.layout.carSchoolX === null) {
    scene.car = null;
    if (atCar(scene)) scene.girl.phase = 'walking';
  } else if (!scene.car) {
    scene.car = parkedNear(scene.layout, scene.girl.x);
  } else if (scene.girl.phase === 'driving') {
    scene.car.x = clamp(scene.car.x, scene.layout.carSchoolX, scene.layout.carHomeX!);
  } else {
    // Parked: back onto the spot it is parked at, in the new coordinates. Which
    // spot that is was never a question about where it stands.
    scene.car.x = scene.car.at === 'school' ? scene.layout.carSchoolX : scene.layout.carHomeX!;
  }

  scene.girl.x = girlRestingX(scene);
  scene.bird.x = clamp(scene.bird.x, 0, size.width);
  scene.bird.y = clamp(scene.bird.y, 0, size.ground);
  if (scene.bird.phase === 'perched') {
    scene.bird.x = perchX(scene);
    scene.bird.y = perchY(scene);
  }
  if (scene.bird.phase === 'full') scene.bird.y = size.ground;
  if (scene.pizza) scene.pizza.x = clamp(scene.pizza.x, 0, size.width);
}

/**
 * Where she belongs after a resize: at the car if she is at it, at the door if
 * the door has her, and otherwise back inside the walk the new window allows.
 */
function girlRestingX(scene: Scene): number {
  const { girlLeft, girlRight, carSchoolX, carHomeX, doorX, loungerX } = scene.layout;
  if (!girlOut(scene)) return doorX;
  if (scene.car && atCar(scene)) return scene.car.x;
  if (lounging(scene)) return loungerX;
  if (scene.girl.phase !== 'walking') return doorX;

  const walking = clamp(scene.girl.x, girlLeft, girlRight);
  if (carSchoolX === null || carHomeX === null) return walking;
  // A window that changed size moves both ends, and can leave her standing in
  // the middle she never walks. She is put back to the nearer end of it.
  if (walking <= carSchoolX || walking >= carHomeX) return walking;
  return walking - carSchoolX < carHomeX - walking ? carSchoolX : carHomeX;
}

/**
 * Whether this step of her walk took her onto the parked car, going the way it
 * would take her. The car only ever helps her across the middle: caught at the
 * school end she must be heading for the oven, and at the oven end for home.
 */
function reachedCar(scene: Scene, wasAt: number): boolean {
  const { car, girl } = scene;
  if (!car) return false;
  // Out of the school end towards home, or home towards the school.
  const goingHome = car.at === 'school' && girl.dir === 1;
  const goingToSchool = car.at === 'home' && girl.dir === -1;
  if (!goingHome && !goingToSchool) return false;
  return goingHome ? wasAt <= car.x && girl.x >= car.x : wasAt >= car.x && girl.x <= car.x;
}

/**
 * The drive itself, easing away from one spot and up to the other.
 *
 * The speed is taken from how far it has come and how far is left rather than
 * from a stored velocity, so it is a property of where the car is: nothing can
 * leave it accelerating into a spot it has already reached, and a resize that
 * moves the spots underneath it changes only how quickly it arrives.
 */
function driveCar(scene: Scene): void {
  const { car, girl, layout } = scene;
  if (!car || layout.carSchoolX === null || layout.carHomeX === null) {
    girl.phase = 'walking';
    return;
  }

  const target = girl.dir === 1 ? layout.carHomeX : layout.carSchoolX;
  const from = girl.dir === 1 ? layout.carSchoolX : layout.carHomeX;
  car.at = girl.dir === 1 ? 'home' : 'school';
  const eased = Math.min(Math.abs(car.x - from), Math.abs(target - car.x)) / CAR_EASE;
  const speed = CAR_SPEED * clamp(eased, CAR_CRAWL, 1);

  car.dir = girl.dir;
  car.vx = girl.dir * speed;
  car.x += car.vx;
  if ((girl.dir === 1 && car.x >= target) || (girl.dir === -1 && car.x <= target)) {
    car.x = target;
    car.vx = 0;
    girl.phase = 'alighting';
    girl.timer = BOARD_FRAMES;
  }
  girl.x = car.x;
}

/** Eases her round to face the way she is going. See `Girl.facing`. */
function turnGirl(scene: Scene): void {
  const { girl } = scene;
  girl.facing = clamp(girl.facing + clamp(girl.dir - girl.facing, -TURN_STEP, TURN_STEP), -1, 1);
}

function walkGirl(scene: Scene, rng: Rng): void {
  const { girl } = scene;
  const { girlLeft, girlRight, doorX } = scene.layout;

  if (girl.phase === 'driving') {
    driveCar(scene);
    return;
  }

  // Stretched out: she does not move through any of it, and gets up where she
  // lay down.
  if (girl.phase === 'lounging') {
    girl.x = scene.layout.loungerX;
    if (--girl.timer <= 0) girl.phase = 'walking';
    return;
  }

  // Getting in and getting out: both are a pause beside the car, which is where
  // she already is. Without them she appears behind the wheel of a car that was
  // empty the frame before.
  if (girl.phase === 'boarding' || girl.phase === 'alighting') {
    if (scene.car) girl.x = scene.car.x;
    if (--girl.timer > 0) return;
    if (girl.phase === 'boarding') {
      girl.phase = 'driving';
      return;
    }
    girl.phase = 'walking';
    // She came here to go in. The door is a few steps west of the car, so she
    // walks into it rather than having to turn round for it.
    if (scene.car?.at === 'school') girl.dueAtSchool = true;
    return;
  }

  // The visit runs on timers at the door; she does not move through any of it.
  if (girl.phase !== 'walking') {
    girl.x = doorX;
    if (--girl.timer > 0) return;
    if (girl.phase === 'entering') {
      girl.phase = 'inside';
      girl.timer = INSIDE_MIN + Math.floor(rng() * INSIDE_SPREAD);
    } else if (girl.phase === 'inside') {
      girl.phase = 'leaving';
      girl.timer = DOOR_FRAMES;
    } else {
      // Back out, and west — away from the door either way, and into the park.
      // Leaving eastwards walks her straight back to the car, which is the whole
      // of the school end and means the park is never walked at all.
      girl.phase = 'walking';
      girl.dir = -1;
    }
    return;
  }

  const wasRightOfDoor = girl.x > doorX;
  const wasAt = girl.x;
  girl.x += girl.dir * GIRL_SPEED;

  // Caught on the way past, walking left — most passes she carries on by, unless
  // she drove here to go in.
  if (
    girl.dir === -1 &&
    wasRightOfDoor &&
    girl.x <= doorX &&
    (girl.dueAtSchool || rng() < VISIT_CHANCE)
  ) {
    girl.x = doorX;
    girl.phase = 'entering';
    girl.timer = DOOR_FRAMES;
    girl.dueAtSchool = false;
    return;
  }

  // Caught on the way past the lounger, from either side — an afternoon on it is
  // something she chooses now and then, not every time she walks by.
  const { loungerX } = scene.layout;
  // Strictly across it: she is pinned to the lounger while she lies on it, so on
  // the frame she stands up she is still exactly on it — and "at most zero"
  // counts standing still as a crossing, which is an afternoon she never gets
  // up from.
  const crossedLounger = (wasAt - loungerX) * (girl.x - loungerX) < 0;
  if (crossedLounger && rng() < LOUNGE_CHANCE) {
    girl.x = loungerX;
    girl.phase = 'lounging';
    girl.timer = LOUNGE_MIN + Math.floor(rng() * LOUNGE_SPREAD);
    // Where he waits it out, chosen once so it does not change under him.
    girl.restPerch = rng() < 0.5 ? 'lounger' : 'banana';
    return;
  }

  // Reaching the car, pointed the way it goes: she gets in. Certain rather than
  // a chance, because the two ends are where the scene is — the park at one, the
  // oven at the other — and the stretch between them is what the car is for.
  if (reachedCar(scene, wasAt)) {
    girl.x = scene.car!.x;
    const leaving = scene.car!.at === 'home' ? LEAVE_HOME_CHANCE : LEAVE_SCHOOL_CHANCE;
    if (rng() < leaving) {
      girl.phase = 'boarding';
      girl.timer = BOARD_FRAMES;
      return;
    }
    // Not this time: the car is the end of her walk when she is not taking it,
    // which keeps her at this end of the scene rather than into the middle.
    girl.dir = girl.dir === 1 ? -1 : 1;
    return;
  }

  if (girl.x <= girlLeft) {
    girl.x = girlLeft;
    girl.dir = 1;
  } else if (girl.x >= girlRight) {
    girl.x = girlRight;
    girl.dir = -1;
  }
  girl.step += GIRL_SPEED;
}

/** How far through its swing the peel is, `framesIn` frames into a toss. */
export function peelSwingAt(framesIn: number): number {
  const t = clamp(framesIn / TOSS_FRAMES, 0, 1);
  // Squared rather than linear: a peel crossing its arc at one speed reads as a
  // lever being cranked. A throw accelerates into the release.
  return t * t;
}

/**
 * Whether the pizza is still riding the paddle. The drawn pizza and the thrown
 * one turn on the same answer: worked out again in `draw.ts`, where nothing can
 * be asserted, the two drift and the pizza is drawn on a peel that has already
 * let it go.
 */
export function carryingPizza(scene: Scene): boolean {
  return scene.oven.tossing > 0 && !scene.oven.thrown;
}

/** Where the peel is now: swinging, following through, or level. */
export function peelSwing(scene: Scene): number {
  const { tossing, recovering } = scene.oven;
  if (tossing > 0) return peelSwingAt(TOSS_FRAMES - tossing);
  if (recovering > 0) return recovering / PEEL_RECOVER_FRAMES;
  return 0;
}

export function peelAngle(swing: number): number {
  return PEEL_REST_ANGLE - swing * PEEL_SWEEP;
}

/** Where on the scene the pizza rides, at a given point in the swing. */
export function peelTip(scene: Scene, swing = peelSwing(scene)): { x: number; y: number } {
  const angle = peelAngle(swing);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // The same rotation of the same point the drawing makes — `PEEL_CARRY_ABOVE`
  // is already negative, being above the blade, so negating it here again put
  // the pizza 24px away on the other side of the paddle.
  return {
    x: scene.layout.pizzaioloX + PEEL_PIVOT.x + PEEL_CARRY_ALONG * cos - PEEL_CARRY_ABOVE * sin,
    y: scene.ground + PEEL_PIVOT.y + PEEL_CARRY_ALONG * sin + PEEL_CARRY_ABOVE * cos,
  };
}

function runOven(scene: Scene, rng: Rng): void {
  const { oven } = scene;

  if (oven.tossing > 0) {
    const carrying = carryingPizza(scene);
    oven.tossing--;
    const swing = peelSwingAt(TOSS_FRAMES - oven.tossing);
    if (carrying && swing >= PEEL_RELEASE_SWING) {
      // It leaves along the path it was already travelling: the carry point over
      // the frame that let it go, snapped up by the wrist. Taking the direction
      // from the swing itself is what keeps the throw and the peel agreeing,
      // however the swing is later shaped.
      const from = peelTip(scene, peelSwingAt(TOSS_FRAMES - oven.tossing - 1));
      const to = peelTip(scene, swing);
      const jitter = 1 + (rng() - 0.5) * TOSS_JITTER;
      scene.pizza = {
        x: to.x,
        y: to.y,
        vx: (to.x - from.x) * PEEL_SNAP * jitter,
        vy: (to.y - from.y) * PEEL_SNAP * jitter,
        spin: (rng() - 0.5) * 0.16,
        rotation: 0,
      };
      oven.thrown = true;
      oven.nextPizzaIn = pizzaInterval(rng);
    }
    // The arm carries on past the release, then comes back down to level.
    if (oven.tossing === 0) oven.recovering = PEEL_RECOVER_FRAMES;
    return;
  }

  if (oven.recovering > 0) oven.recovering--;

  // He is making them for her. While she is away the oven waits — and the
  // countdown waits with it, so she is not met by one the instant she is back.
  if (!homeward(scene)) return;

  if (oven.nextPizzaIn > 0) oven.nextPizzaIn--;
  // A pizza already in the air means this one waits: two at once would leave one
  // of them uncatchable, and a pizza nobody eats is a pizza wasted.
  if (oven.nextPizzaIn <= 0 && !scene.pizza) {
    oven.tossing = TOSS_FRAMES;
    oven.thrown = false;
  }
}

function movePizza(scene: Scene): void {
  const { pizza } = scene;
  if (!pizza) return;

  pizza.vy += GRAVITY;
  pizza.x += pizza.vx;
  pizza.y += pizza.vy;
  pizza.rotation += pizza.spin;

  // Off the side or onto the floor: gone either way, and the bird gives up.
  if (pizza.y >= scene.ground || pizza.x < -40 || pizza.x > scene.width + 40) {
    scene.pizza = null;
  }
}

function steer(bird: Bird, targetX: number, targetY: number, gain: number, drag: number): void {
  bird.vx += (targetX - bird.x) * gain;
  bird.vy += (targetY - bird.y) * gain;
  bird.vx *= drag;
  bird.vy *= drag;
  bird.x += bird.vx;
  bird.y += bird.vy;
  if (Math.abs(bird.vx) > 0.2) bird.facingRight = bird.vx > 0;
}

function flyBird(scene: Scene, rng: Rng): void {
  const { bird } = scene;

  // A pizza in the air beats anything else he might be doing — but only if he
  // can fly. Full, eating or still climbing away, he watches it land.
  if (
    scene.pizza &&
    (bird.phase === 'escorting' || bird.phase === 'landing' || bird.phase === 'perched')
  ) {
    bird.phase = 'diving';
  }

  switch (bird.phase) {
    case 'perched': {
      // The perch he sat on is not the perch any more, so he has to fly to the
      // new one rather than be moved onto it.
      if (bird.perchedOn !== currentPerch(scene)) {
        bird.phase = 'escorting';
        break;
      }

      bird.x = perchX(scene);
      bird.y = perchY(scene);
      bird.vx = 0;
      bird.vy = 0;
      if (girlOut(scene)) bird.facingRight = scene.girl.dir === 1;
      if (rng() < 0.004) bird.phase = 'escorting';
      break;
    }

    case 'escorting': {
      const bob = Math.sin(scene.frame * 0.07) * HOVER_BOB;
      steer(
        bird,
        perchLeadX(scene, ESCORT_STEER),
        perchY(scene) - HOVER_HEIGHT + bob,
        ESCORT_STEER.gain,
        ESCORT_STEER.drag,
      );
      bird.flap += 0.35;
      // Keener to get on something that is going somewhere: dawdling above a
      // car he has already caught up with means the drive is over before he
      // ever lands on it.
      const keenness = Math.abs(perchVX(scene)) > 1 ? MOVING_PERCH_LANDING : LANDING_CHANCE;
      if (settledOnPerch(scene) && rng() < keenness) bird.phase = 'landing';
      break;
    }

    /**
     * The drop onto her shoulder, flown rather than jumped.
     *
     * `perched` puts him exactly on the shoulder every frame, so going straight
     * there from `escorting` teleported him the whole hover height at once —
     * forty pixels in a single frame, and further still if he was off to one
     * side. It read as fine when he happened to be close and as a snap when he
     * was not, which is exactly what it was.
     */
    case 'landing': {
      steer(
        bird,
        perchLeadX(scene, LANDING_STEER),
        perchY(scene),
        LANDING_STEER.gain,
        LANDING_STEER.drag,
      );
      bird.flap += 0.45;
      if (girlOut(scene)) bird.facingRight = scene.girl.dir === 1;
      // Arrived when he is on it and going along with it. Measured to a couple
      // of pixels in both axes and nothing else, a perch moving under him is a
      // window he can hardly hit — so he hovered at the roof, wings beating, for
      // a third of every drive.
      const arrived =
        Math.abs(bird.x - perchX(scene)) < ARRIVE_REACH &&
        Math.abs(bird.y - perchY(scene)) < ARRIVE_REACH &&
        Math.abs(bird.vx - perchVX(scene)) < ARRIVE_DRIFT;
      if (arrived) {
        bird.phase = 'perched';
        bird.perchedOn = currentPerch(scene);
        bird.vx = 0;
        bird.vy = 0;
      }
      break;
    }

    case 'diving': {
      const pizza = scene.pizza;
      // Nothing left to chase: it was caught by the floor, or it left the screen.
      if (!pizza) {
        bird.phase = 'escorting';
        break;
      }
      steer(bird, pizza.x, pizza.y, 0.035, 0.9);
      bird.flap += 0.5;
      if (Math.hypot(pizza.x - bird.x, pizza.y - bird.y) < CATCH_RADIUS) {
        scene.pizza = null;
        bird.phase = 'eating';
        bird.timer = EATING_FRAMES;
      }
      break;
    }

    case 'eating': {
      // Chewing on the way down — a whole pizza is more than he can carry.
      bird.y += (scene.ground - bird.y) * 0.14;
      bird.vx *= 0.8;
      bird.x += bird.vx;
      bird.flap += 0.2;
      if (--bird.timer <= 0) {
        bird.phase = 'full';
        bird.timer = FULL_FRAMES;
        bird.y = scene.ground;
        bird.vx = 0;
        bird.vy = 0;
      }
      break;
    }

    case 'full': {
      bird.y = scene.ground;
      bird.vx = 0;
      bird.vy = 0;
      if (--bird.timer <= 0) {
        bird.phase = 'takeoff';
        bird.timer = TAKEOFF_FRAMES;
        // The ring goes with the fullness it was reporting. Left to fade on its
        // own it would still be circling a bird already back in the air, which
        // is the one thing it is supposed to mean.
        scene.hearts = scene.hearts.filter((heart) => heart.kind !== 'ring');
      }
      break;
    }

    case 'takeoff': {
      steer(bird, perchX(scene), perchY(scene) - HOVER_HEIGHT, 0.02, 0.9);
      bird.flap += 0.6;
      if (--bird.timer <= 0) bird.phase = 'escorting';
      break;
    }
  }

  bird.x = clamp(bird.x, BIRD_EDGE, Math.max(BIRD_EDGE, scene.width - BIRD_EDGE));
  bird.y = clamp(bird.y, 8, scene.ground);
}

/** Puts a ring heart back on its orbit around the head it belongs to. */
function orbit(scene: Scene, heart: Heart): void {
  heart.x = scene.bird.x + Math.cos(heart.angle) * RING_RADIUS_X;
  heart.y = scene.bird.y - RING_HEIGHT + Math.sin(heart.angle) * RING_RADIUS_Y;
}

function runHearts(scene: Scene, rng: Rng): void {
  for (let i = scene.hearts.length - 1; i >= 0; i--) {
    const heart = scene.hearts[i];
    heart.life--;
    if (heart.kind === 'ring') {
      heart.angle += 0.06;
      orbit(scene, heart);
    } else {
      heart.y -= 0.7;
      heart.x += 0.15;
    }
    if (heart.life <= 0) scene.hearts.splice(i, 1);
  }

  if (scene.hearts.length >= MAX_HEARTS) return;

  if (scene.bird.phase === 'full' && scene.frame % HEART_INTERVAL === 0) {
    const heart: Heart = { kind: 'ring', angle: rng() * Math.PI * 2, x: 0, y: 0, life: RING_LIFE };
    orbit(scene, heart);
    scene.hearts.push(heart);
  } else if (
    scene.bird.phase === 'perched' &&
    // Not while she is inside: they are for her, and a bird alone in a tree
    // sending hearts at a shut door is the same unreachable state as a lit
    // window with nobody behind it.
    girlOut(scene) &&
    scene.frame % PERCHED_HEART_INTERVAL === 0
  ) {
    scene.hearts.push({
      kind: 'drift',
      angle: 0,
      x: scene.bird.x + 8,
      y: scene.bird.y - 14,
      life: DRIFT_LIFE,
    });
  }
}

/** How a column of smoke behaves: the oven's, and the school's thinner one. */
interface SmokeSpec {
  /** Frames between puffs, and how many may be in the air at once. */
  interval: number;
  most: number;
  rise: number;
  grow: number;
  radius: number;
  drift: number;
  life: number;
}

const OVEN_SMOKE: SmokeSpec = {
  interval: SMOKE_INTERVAL,
  most: MAX_PUFFS,
  rise: 0.55,
  grow: 0.22,
  radius: 4,
  drift: 0.15,
  life: 90,
};

/** Barely there: a school chimney on a quiet afternoon, not a pizza oven. */
const SCHOOL_SMOKE: SmokeSpec = {
  interval: 52,
  most: 7,
  rise: 0.26,
  grow: 0.09,
  radius: 1.8,
  drift: 0.05,
  life: 130,
};

/**
 * Ages a column of smoke, and adds to it from `source` — or from nowhere, when
 * `source` returns null, which is how the school stops smoking the moment she
 * leaves without the puffs already up there vanishing with her.
 */
function runSmoke(
  scene: Scene,
  smoke: Puff[],
  spec: SmokeSpec,
  source: () => { x: number; y: number } | null,
  rng: Rng,
): void {
  for (let i = smoke.length - 1; i >= 0; i--) {
    const puff = smoke[i];
    puff.life--;
    puff.y -= spec.rise;
    puff.x += puff.drift;
    puff.radius += spec.grow;
    if (puff.life <= 0) smoke.splice(i, 1);
  }

  if (scene.frame % spec.interval !== 0) return;
  if (smoke.length >= spec.most) return;

  const at = source();
  if (!at) return;

  const life = spec.life + Math.floor(rng() * (spec.life * 0.7));
  smoke.push({
    x: at.x + (rng() - 0.5) * 4,
    y: at.y,
    radius: spec.radius + rng() * (spec.radius * 0.7),
    drift: spec.drift + rng() * (spec.drift * 2.3),
    life,
    maxLife: life,
  });
}

export function step(scene: Scene, rng: Rng): void {
  scene.frame++;
  turnGirl(scene);
  walkGirl(scene, rng);
  // Moved before the oven runs, so a pizza released this frame stays at the
  // peel's tip for the frame it is released on rather than starting a frame's
  // flight away from the paddle that was holding it.
  movePizza(scene);
  runOven(scene, rng);
  flyBird(scene, rng);
  runHearts(scene, rng);
  runSquirrels(scene, rng);
  runSquirrelPairs(scene, rng);
  runSmoke(
    scene,
    scene.oven.smoke,
    OVEN_SMOKE,
    () => ({ x: scene.layout.ovenX, y: scene.ground - OVEN_HEIGHT - CHIMNEY_HEIGHT }),
    rng,
  );
  // Somebody is in, so the chimney is going.
  runSmoke(
    scene,
    scene.schoolSmoke,
    SCHOOL_SMOKE,
    () => (girlOut(scene) ? null : schoolChimney(scene).mouth),
    rng,
  );
}

const within = (value: number, centre: number, half: number) => Math.abs(value - centre) <= half;

/**
 * Is this point on the bird, wherever he currently is?
 *
 * The box follows how he is drawn, not just where his middle is: full, he is
 * drawn larger and sitting lower, and a box on his middle alone would leave his
 * head outside it — which is exactly where someone aims to wake him.
 */
export function hitsBird(scene: Scene, x: number, y: number): boolean {
  const full = scene.bird.phase === 'full';
  const scale = full ? FULL_SCALE : 1;
  const middle = scene.bird.y - (full ? FULL_LIFT : 0);
  return (
    within(x, scene.bird.x, (BIRD_HIT_WIDTH / 2) * scale) &&
    within(y, middle, (BIRD_HIT_HEIGHT / 2) * scale)
  );
}

/** Anyone standing on the ground, from their feet to the top of their head. */
function hitsStanding(
  scene: Scene,
  x: number,
  y: number,
  centre: number,
  halfWidth: number,
  height: number,
): boolean {
  return within(x, centre, halfWidth) && y >= scene.ground - height && y <= scene.ground + 8;
}

/** Her, standing on the ground — the whole of her, not just her head. */
export function hitsGirl(scene: Scene, x: number, y: number): boolean {
  // Lying down she is a third of her standing height, and a box the size of the
  // standing one would take clicks meant for the banana trees above her.
  const reach = lounging(scene) ? LOUNGER_BACK_HEIGHT + 8 : GIRL_HEIGHT;
  return hitsStanding(scene, x, y, scene.girl.x, GIRL_HIT_WIDTH / 2, reach);
}

/** Is this point on the pizzaiolo, who stands with his feet on the ground? */
export function hitsPizzaiolo(scene: Scene, x: number, y: number): boolean {
  return hitsStanding(
    scene,
    x,
    y,
    scene.layout.pizzaioloX,
    PIZZAIOLO_HIT_WIDTH / 2,
    PIZZAIOLO_HEIGHT,
  );
}

/** She can blow a kiss on her feet or on the lounger; not from inside or a car. */
function available(phase: GirlPhase): boolean {
  return phase === 'walking' || phase === 'lounging';
}

/**
 * Whether a call could reach him at all.
 *
 * Hovering he comes down; too full to fly he gets up. On her shoulder he is
 * already there, on his way down he has already been called, and a pizza in the
 * air or in his beak beats both — called off a dive he would go hungry for a
 * wave.
 */
function callable(phase: BirdPhase): boolean {
  return phase === 'escorting' || phase === 'full';
}

/**
 * One heart, from her mouth rather than from his.
 *
 * Capped with the rest of them: a click is a thing a user can do as fast as they
 * like, and a scene answering each one with a heart is a scene that can be
 * filled with hearts.
 */
function blowKiss(scene: Scene): void {
  if (scene.hearts.length >= MAX_HEARTS) return;
  const head = girlHead(scene);
  scene.hearts.push({ kind: 'kiss', angle: 0, x: head.x, y: head.y, life: DRIFT_LIFE });
}

/**
 * Where her head is, standing or lying down.
 *
 * Lying on the lounger she is horizontal, with her head at the raked end and a
 * third of her standing height off the ground — a kiss sent from where she
 * *stands* appears up in the banana leaves with nobody under it.
 */
export function girlHead(scene: Scene): { x: number; y: number } {
  if (lounging(scene)) {
    return {
      x: scene.layout.loungerX - LOUNGER_LENGTH / 2,
      y: scene.ground - LOUNGER_BACK_HEIGHT * 0.9,
    };
  }
  return { x: scene.girl.x + scene.girl.dir * 4, y: scene.ground - GIRL_HEIGHT * 0.9 };
}

/**
 * The three things a click can do, and nothing else. Calling a bird who is
 * already sitting on her, waking one who is not asleep, or hurrying an oven that
 * is already busy would each be worse than doing nothing, so each is refused
 * here rather than papered over in the loop.
 */
export function clickScene(scene: Scene, x: number, y: number): void {
  if (available(scene.girl.phase) && callable(scene.bird.phase) && hitsGirl(scene, x, y)) {
    blowKiss(scene);
    // Full, he is on the ground with a whole pizza inside him: being called is
    // as good a reason to get up as being prodded, which already works. The
    // takeoff still plays out, so he flies back rather than appearing.
    if (scene.bird.phase === 'full') scene.bird.timer = 0;
    else scene.bird.phase = 'landing';
    return;
  }

  if (scene.bird.phase === 'full' && hitsBird(scene, x, y)) {
    // Digested, with a little help. The takeoff itself still plays out.
    scene.bird.timer = 0;
    return;
  }

  if (hitsPizzaiolo(scene, x, y) && !scene.pizza && scene.oven.tossing === 0) {
    scene.oven.nextPizzaIn = 0;
  }
}

/**
 * The band this scene needs the app to reserve for it — the ground it stands on
 * plus everything standing on that ground. Derived rather than chosen, so the
 * scenery and the floor masking it cannot drift apart.
 *
 * It follows the width because the scenery does: a narrow window draws the whole
 * scene smaller, and a band sized for a full-width oven would then hold back a
 * strip of the user's list for empty sky.
 */
export function celloFloor(width: number): number {
  // Rounded up, not just rounded: a band half a pixel shorter than the scenery
  // standing in it leaves the top of the chimney drawn over the user's list, and
  // a fractional height gives the mask a seam to peek through.
  return Math.ceil(GROUND_ABOVE_FOOTER + SCENE_REACH * sceneScale(width));
}
