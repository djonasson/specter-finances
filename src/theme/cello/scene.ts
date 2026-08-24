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
const TREE_GAP = 44;
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
const SCHOOL_REACH = Math.max(
  SCHOOL_HEIGHT,
  SCHOOL_WALL_HEIGHT +
    SCHOOL_ROOF_HEIGHT * (1 - CHIMNEY_ALONG) +
    SCHOOL_CHIMNEY_HEIGHT +
    SCHOOL_CHIMNEY_CAP,
);
/** The school centre on a window wide enough to hold the whole left side. */
const SCHOOL_HOME = 191;

/**
 * Taken off a photograph of the car rather than guessed: a 500 is 2.27 times as
 * long as it is tall, its wheels are near enough a fifth of its length, and it
 * has almost no overhang at either end. Drawn by eye it comes out a Beetle.
 */
export const CAR_WIDTH = 70;
/** Ground to the top of the roof. The belt line is a fraction of it, in `draw.ts`. */
export const CAR_ROOF_HEIGHT = 29;
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
/**
 * Long enough to be a visit rather than a flicker: at ~40fps this is fifteen to
 * thirty-five seconds. It also has to outlast a pizza — if he is mid-mouthful
 * when she goes in he finishes it first, and a short stay meant she was back out
 * before he ever reached the trees.
 */
const INSIDE_MIN = 600;
const INSIDE_SPREAD = 800;
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
/** The pizzaiolo stands this far to the oven's left, clear of it, peel in hand. */
const PIZZAIOLO_OFFSET = 78;
export const PIZZAIOLO_HEIGHT = 82;
/** She turns before she reaches him rather than walking through the oven. */
const GIRL_CLEARANCE = 52;

const BIRD_HIT_WIDTH = 48;
const BIRD_HIT_HEIGHT = 44;
const PIZZAIOLO_HIT_WIDTH = 64;

const SMOKE_INTERVAL = 20;
const MAX_PUFFS = 24;
const HEART_INTERVAL = 26;
const MAX_HEARTS = 14;
/** A perched bird's occasional heart for the girl, rarer than the full one's. */
const PERCHED_HEART_INTERVAL = 110;
export const RING_LIFE = 120;
export const DRIFT_LIFE = 70;
/** The orbit a ring heart travels, measured from the bird's middle. */
const RING_HEIGHT = 46;
const RING_RADIUS_X = 22;
const RING_RADIUS_Y = 7;

/**
 * `escorting` and `perched` are the two idle states — above her, or on her
 * shoulder. Everything else is one trip through a pizza.
 */
/**
 * How far above the ground the scene reaches with nothing in the air: the top of
 * the chimney cap, and the bird at the top of his hover.
 *
 * The floor the app reserves is derived from this rather than picked to look
 * right, so a taller oven or a higher hover cannot quietly start drawing over
 * the app's own content. What is *thrown* is deliberately not counted — a pizza
 * sailing up over the app, like the squirrel's falling acorns, is the point.
 */
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
const PERCH_HEIGHT = {
  shoulder: SHOULDER_HEIGHT,
  tree: TREE_TRUNK_HEIGHT + TREE_CROWN_RADIUS,
} as const;

/** Which of them he is on, or would be if he flew home now. */
export type Perch = keyof typeof PERCH_HEIGHT;

export const SCENE_REACH = Math.max(
  OVEN_HEIGHT + CHIMNEY_HEIGHT + CHIMNEY_CAP,
  SCHOOL_REACH,
  // Whichever perch is highest, plus how far above it he gets. Taken off the
  // same list `perchY` places him with, so a perch added there cannot be
  // forgotten here — which is the one way the band could silently go stale.
  Math.max(...Object.values(PERCH_HEIGHT)) + BIRD_ABOVE_PERCH,
);

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
 * `walking` is the pacing she has always done. The other three are one visit to
 * the school: through the door, a while inside with the light on, and back out.
 */
export type GirlPhase = 'walking' | 'entering' | 'inside' | 'leaving';

export interface Girl {
  x: number;
  dir: 1 | -1;
  /** Walk-cycle counter, so the legs move with the distance covered. */
  step: number;
  phase: GirlPhase;
  /** Frames left in a phase that ends on a timer. */
  timer: number;
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
 * `ring` hearts circle a bird too full to fly — that is the "wait for me" sign,
 * and nothing else uses it. A `drift` heart is a single one he lets go while
 * perched, rising off to one side, so being in love does not read as being full.
 *
 * Both carry a real `x`/`y`: a ring heart's orbit is advanced here rather than
 * worked out again at drawing time, so "the ring follows the bird" is something
 * a test can hold rather than something only the screen knows.
 */
export interface Heart {
  kind: 'ring' | 'drift';
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
  /** `null` on a window too narrow to park it clear of the pizzaiolo. */
  carX: number | null;
}

export interface Scene {
  width: number;
  height: number;
  /** The line everyone stands on: feet, oven base, the bottom of a splat. */
  ground: number;
  layout: Layout;
  bird: Bird;
  girl: Girl;
  oven: { nextPizzaIn: number; tossing: number; smoke: Puff[] };
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
  const parkable = carRight <= pizzaioloX - PIZZAIOLO_ROOM;

  return {
    ovenX,
    pizzaioloX,
    treeXs,
    schoolX,
    doorX,
    carX: parkable ? schoolX + SCHOOL_WIDTH / 2 + CAR_GAP + CAR_WIDTH / 2 : null,
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
 * pizza mid-visit goes on working without knowing she is gone.
 */
/** Whichever perch is his while she is where she is. */
export function currentPerch(scene: Scene): Perch {
  return girlOut(scene) ? 'shoulder' : 'tree';
}

export function perchX(scene: Scene): number {
  if (girlOut(scene)) return shoulderX(scene);
  // Swaying with the crown he is sitting in, rather than held at the trunk while
  // the tree moves around him — and inside the same edge the bird is clamped to,
  // or on a narrow window he would steer forever at a perch he cannot reach and
  // never finish landing.
  const tree = scene.layout.treeXs[0] + treeSway(scene, 0);
  return clamp(tree, BIRD_EDGE, Math.max(BIRD_EDGE, scene.width - BIRD_EDGE));
}

export function perchY(scene: Scene): number {
  return scene.ground - PERCH_HEIGHT[currentPerch(scene)];
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

/** How far this crown is leaning right now. Pure, so the sway can be asserted. */
export function treeSway(scene: Scene, index: number): number {
  return Math.sin(scene.frame * SWAY_SPEED + index * 1.7) * SWAY_REACH;
}

export function shoulderX(scene: Scene): number {
  return scene.girl.x - scene.girl.dir * SHOULDER_BACK;
}

export function shoulderY(scene: Scene): number {
  return scene.ground - SHOULDER_HEIGHT;
}

const pizzaInterval = (rng: Rng) => PIZZA_INTERVAL_MIN + Math.floor(rng() * PIZZA_INTERVAL_SPREAD);

export function createScene(size: SceneSize, rng: Rng): Scene {
  const layout = layoutFor(size.width);
  const girlX = clamp(
    layout.girlLeft + rng() * Math.max(1, layout.girlRight - layout.girlLeft),
    layout.girlLeft,
    layout.girlRight,
  );

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
    girl: { x: girlX, dir: rng() < 0.5 ? -1 : 1, step: 0, phase: 'walking', timer: 0 },
    oven: { nextPizzaIn: pizzaInterval(rng), tossing: 0, smoke: [] },
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

  scene.girl.x =
    girlOut(scene) && scene.girl.phase === 'walking'
      ? clamp(scene.girl.x, scene.layout.girlLeft, scene.layout.girlRight)
      : scene.layout.doorX;
  scene.bird.x = clamp(scene.bird.x, 0, size.width);
  scene.bird.y = clamp(scene.bird.y, 0, size.ground);
  if (scene.bird.phase === 'perched') {
    scene.bird.x = perchX(scene);
    scene.bird.y = perchY(scene);
  }
  if (scene.bird.phase === 'full') scene.bird.y = size.ground;
  if (scene.pizza) scene.pizza.x = clamp(scene.pizza.x, 0, size.width);
}

function walkGirl(scene: Scene, rng: Rng): void {
  const { girl } = scene;
  const { girlLeft, girlRight, doorX } = scene.layout;

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
      // Back out, and away from the door rather than straight into it again.
      girl.phase = 'walking';
      girl.dir = 1;
    }
    return;
  }

  const wasRightOfDoor = girl.x > doorX;
  girl.x += girl.dir * GIRL_SPEED;

  // Caught on the way past, walking left — most passes she carries on by.
  if (girl.dir === -1 && wasRightOfDoor && girl.x <= doorX && rng() < VISIT_CHANCE) {
    girl.x = doorX;
    girl.phase = 'entering';
    girl.timer = DOOR_FRAMES;
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

function runOven(scene: Scene, rng: Rng): void {
  const { oven } = scene;

  if (oven.tossing > 0) {
    oven.tossing--;
    if (oven.tossing === 0) {
      // Released at the top of the swing, up and to the left, over the scene.
      scene.pizza = {
        x: scene.layout.pizzaioloX - 18,
        y: scene.ground - PIZZAIOLO_HEIGHT - 6,
        vx: -(1.1 + rng() * 1.2),
        vy: -(7 + rng() * 1.6),
        spin: (rng() - 0.5) * 0.16,
        rotation: 0,
      };
      oven.nextPizzaIn = pizzaInterval(rng);
    }
    return;
  }

  // He is making them for her. While she is inside, the oven waits — and the
  // countdown waits with it, so she is not met by one the instant she is back.
  if (!girlOut(scene)) return;

  if (oven.nextPizzaIn > 0) oven.nextPizzaIn--;
  // A pizza already in the air means this one waits: two at once would leave one
  // of them uncatchable, and a pizza nobody eats is a pizza wasted.
  if (oven.nextPizzaIn <= 0 && !scene.pizza) oven.tossing = TOSS_FRAMES;
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
      steer(bird, perchX(scene), perchY(scene) - HOVER_HEIGHT + bob, 0.012, 0.92);
      bird.flap += 0.35;
      const settled = Math.abs(bird.x - perchX(scene)) < 14 && Math.abs(bird.vx) < 0.8;
      if (settled && rng() < 0.01) bird.phase = 'landing';
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
      steer(bird, perchX(scene), perchY(scene), 0.05, 0.82);
      bird.flap += 0.45;
      if (girlOut(scene)) bird.facingRight = scene.girl.dir === 1;
      const arrived =
        Math.abs(bird.x - perchX(scene)) < 2.5 && Math.abs(bird.y - perchY(scene)) < 2.5;
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
  walkGirl(scene, rng);
  runOven(scene, rng);
  movePizza(scene);
  flyBird(scene, rng);
  runHearts(scene, rng);
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

/** Is this point on the pizzaiolo, who stands with his feet on the ground? */
export function hitsPizzaiolo(scene: Scene, x: number, y: number): boolean {
  return (
    within(x, scene.layout.pizzaioloX, PIZZAIOLO_HIT_WIDTH / 2) &&
    y >= scene.ground - PIZZAIOLO_HEIGHT &&
    y <= scene.ground + 8
  );
}

/**
 * The two things a click can do, and nothing else. Waking a bird who is not
 * asleep or hurrying an oven that is already busy would both be worse than
 * doing nothing, so both are refused here rather than papered over in the loop.
 */
export function clickScene(scene: Scene, x: number, y: number): void {
  if (scene.bird.phase === 'full' && hitsBird(scene, x, y)) {
    // Digested, with a little help. The takeoff itself still plays out.
    scene.bird.timer = 0;
    return;
  }

  if (hitsPizzaiolo(scene, x, y) && !scene.pizza && scene.oven.tossing === 0) {
    scene.oven.nextPizzaIn = 0;
  }
}
