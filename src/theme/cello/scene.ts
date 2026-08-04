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
export const SCENE_REACH = Math.max(
  OVEN_HEIGHT + CHIMNEY_HEIGHT + CHIMNEY_CAP,
  SHOULDER_HEIGHT + HOVER_HEIGHT + HOVER_BOB + BIRD_REACH,
);

export type BirdPhase = 'escorting' | 'perched' | 'diving' | 'eating' | 'full' | 'takeoff';

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
}

export interface Girl {
  x: number;
  dir: 1 | -1;
  /** Walk-cycle counter, so the legs move with the distance covered. */
  step: number;
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
 * The oven sits on the right, the girl walks the space left of it. On a narrow
 * window that space shrinks rather than the oven sliding off the edge.
 */
function layoutFor(width: number): Layout {
  const ovenX = Math.max(width * 0.62, width - 84);
  const pizzaioloX = ovenX - PIZZAIOLO_OFFSET;
  const girlRight = pizzaioloX - GIRL_CLEARANCE;
  return { ovenX, pizzaioloX, girlLeft: GIRL_MARGIN, girlRight: Math.max(GIRL_MARGIN, girlRight) };
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
    },
    girl: { x: girlX, dir: rng() < 0.5 ? -1 : 1, step: 0 },
    oven: { nextPizzaIn: pizzaInterval(rng), tossing: 0, smoke: [] },
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

  scene.girl.x = clamp(scene.girl.x, scene.layout.girlLeft, scene.layout.girlRight);
  scene.bird.x = clamp(scene.bird.x, 0, size.width);
  scene.bird.y = clamp(scene.bird.y, 0, size.ground);
  if (scene.bird.phase === 'perched') {
    scene.bird.x = shoulderX(scene);
    scene.bird.y = shoulderY(scene);
  }
  if (scene.bird.phase === 'full') scene.bird.y = size.ground;
  if (scene.pizza) scene.pizza.x = clamp(scene.pizza.x, 0, size.width);
}

function walkGirl(scene: Scene): void {
  const { girlLeft, girlRight } = scene.layout;
  scene.girl.x += scene.girl.dir * GIRL_SPEED;
  if (scene.girl.x <= girlLeft) {
    scene.girl.x = girlLeft;
    scene.girl.dir = 1;
  } else if (scene.girl.x >= girlRight) {
    scene.girl.x = girlRight;
    scene.girl.dir = -1;
  }
  scene.girl.step += GIRL_SPEED;
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
  if (scene.pizza && (bird.phase === 'escorting' || bird.phase === 'perched')) {
    bird.phase = 'diving';
  }

  switch (bird.phase) {
    case 'perched': {
      bird.x = shoulderX(scene);
      bird.y = shoulderY(scene);
      bird.vx = 0;
      bird.vy = 0;
      bird.facingRight = scene.girl.dir === 1;
      if (rng() < 0.004) bird.phase = 'escorting';
      break;
    }

    case 'escorting': {
      const bob = Math.sin(scene.frame * 0.07) * HOVER_BOB;
      steer(bird, shoulderX(scene), shoulderY(scene) - HOVER_HEIGHT + bob, 0.012, 0.92);
      bird.flap += 0.35;
      const settled = Math.abs(bird.x - shoulderX(scene)) < 14 && Math.abs(bird.vx) < 0.8;
      if (settled && rng() < 0.01) bird.phase = 'perched';
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
      steer(bird, shoulderX(scene), shoulderY(scene) - HOVER_HEIGHT, 0.02, 0.9);
      bird.flap += 0.6;
      if (--bird.timer <= 0) bird.phase = 'escorting';
      break;
    }
  }

  bird.x = clamp(bird.x, 8, Math.max(8, scene.width - 8));
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
  } else if (scene.bird.phase === 'perched' && scene.frame % PERCHED_HEART_INTERVAL === 0) {
    scene.hearts.push({
      kind: 'drift',
      angle: 0,
      x: scene.bird.x + 8,
      y: scene.bird.y - 14,
      life: DRIFT_LIFE,
    });
  }
}

function runSmoke(scene: Scene, rng: Rng): void {
  const { smoke } = scene.oven;

  for (let i = smoke.length - 1; i >= 0; i--) {
    const puff = smoke[i];
    puff.life--;
    puff.y -= 0.55;
    puff.x += puff.drift;
    puff.radius += 0.22;
    if (puff.life <= 0) smoke.splice(i, 1);
  }

  if (scene.frame % SMOKE_INTERVAL !== 0) return;
  if (smoke.length >= MAX_PUFFS) return;

  const life = 90 + Math.floor(rng() * 60);
  smoke.push({
    x: scene.layout.ovenX + (rng() - 0.5) * 4,
    y: scene.ground - OVEN_HEIGHT - CHIMNEY_HEIGHT,
    radius: 4 + rng() * 3,
    drift: 0.15 + rng() * 0.35,
    life,
    maxLife: life,
  });
}

export function step(scene: Scene, rng: Rng): void {
  scene.frame++;
  walkGirl(scene);
  runOven(scene, rng);
  movePizza(scene);
  flyBird(scene, rng);
  runHearts(scene, rng);
  runSmoke(scene, rng);
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
