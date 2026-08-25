import { describe, it, expect } from 'vitest';
import {
  createScene,
  step,
  clickScene,
  resizeScene,
  hitsBird,
  hitsPizzaiolo,
  shoulderX,
  shoulderY,
  CHIMNEY_CAP,
  CHIMNEY_HEIGHT,
  EATING_FRAMES,
  FULL_FRAMES,
  FULL_LIFT,
  OVEN_HEIGHT,
  SCENE_REACH,
  TAKEOFF_FRAMES,
  TOSS_FRAMES,
  SCHOOL_HEIGHT,
  SCHOOL_WIDTH,
  TREE_HEIGHT,
  TREE_COUNT,
  TREE_CROWN_RADIUS,
  TREE_GAP,
  DOOR_FRAMES,
  SWAY_REACH,
  currentPerch,
  schoolChimney,
  schoolRoofY,
  CAR_WIDTH,
  CAR_ROOF_HEIGHT,
  perchX,
  perchY,
  perchVX,
  settledOnPerch,
  birdAtRest,
  atTheWheel,
  squirrelFacing,
  squirrelX,
  squirrelY,
  squirrelBehind,
  leafSway,
  SQUIRREL_REACH,
  homeward,
  BANANA_HEIGHT,
  BANANA_TRUNKS,
  bananaLean,
  bananaLeaves,
  girlOut,
  schoolLit,
  doorOpen,
  treeSway,
  peelSwing,
  peelSwingAt,
  peelTip,
  peelAngle,
  PEEL_CARRY_ABOVE,
  PEEL_CARRY_ALONG,
  PEEL_PIVOT,
  PEEL_RECOVER_FRAMES,
  GIRL_HEIGHT,
  DRIFT_LIFE,
  MAX_HEARTS,
  MAX_PUFFS,
  GROUND_ABOVE_FOOTER,
  SCENE_FULL_WIDTH,
  SCHOOL_REACH,
  SCENE_MIN_SCALE,
  sceneScale,
  PEEL_RELEASE_SWING,
} from './scene';
import type { Scene } from './scene';
import { stageFloorHeight } from '../registry';

// The scene is a toy, but it is the whole reason this file exists: the squirrel
// scene keeps every entity inside a `useEffect` closure, where a bird stuck in
// mid-dive forever, or hearts circling a bird who has already flown off, can
// only be found by watching the screen long enough. Here it is a state machine,
// and a state machine can be asked.

const SIZE = { width: 800, height: 600, ground: 500 };
/** How far to either side of the bird a ring heart can orbit. */
const RING_SPREAD = 24;

/**
 * A deterministic stand-in for `Math.random`, for the behaviour that only shows
 * itself over a long varied run. A fixed roll makes those degenerate: every
 * choice comes out the same way and the scene falls into a groove it would never
 * find on its own.
 */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic and unremarkable: never rolls a random transition. */
const steady = () => 0.5;
/** Rolls every chance that is offered — the perch, the lift-off, the lot. */
const eager = () => 0;
/**
 * Rolls the chances that get him *settled* and her into the school, but not the
 * one that lifts him off a perch again — so he actually stays sitting somewhere.
 * `eager` leaves the perch the frame after taking it, which hides anything that
 * only goes wrong to a bird who is sitting still.
 */
const patient = () => 0.005;

function scene(rng = steady): Scene {
  return createScene(SIZE, rng);
}

function run(s: Scene, frames: number, rng = steady): void {
  for (let i = 0; i < frames; i++) step(s, rng);
}

/** Runs until the predicate holds, and says so if it never does. */
function runUntil(s: Scene, predicate: (s: Scene) => boolean, limit: number, rng = steady): number {
  for (let i = 1; i <= limit; i++) {
    step(s, rng);
    if (predicate(s)) return i;
  }
  throw new Error(`never happened within ${limit} frames`);
}

/**
 * Stops the oven for good, for the tests that are about the bird sitting still:
 * a pizza in the air beats anything else he might be doing, so one arriving
 * mid-test is the difference between a landing and a dive.
 */
function quietOven(s: Scene): void {
  s.oven.nextPizzaIn = Number.MAX_SAFE_INTEGER;
}

/**
 * Takes the car out of the scene, for the tests that are about her walking: with
 * one parked in the middle she gets in when she reaches it, which is the whole
 * point of it being there and nothing to do with the door.
 */
function noCar(s: Scene): void {
  s.car = null;
  s.layout = { ...s.layout, carSchoolX: null, carHomeX: null };
}

/**
 * A scene whose oven has someone to cook for: no car, so there are no ends of
 * the scene to be at and she counts as home wherever she is walking.
 *
 * The alternative — waiting for her to walk to the home end — makes every pizza
 * test wait on the drive as well, and none of them are about the drive.
 */
function ovenScene(rng = steady): Scene {
  const s = scene(rng);
  noCar(s);
  return s;
}

/**
 * Puts the lounger out of her reach, for the tests that are about somewhere
 * else: she passes it twice a lap at the home end, and an afternoon on it is
 * time she is not spending walking to wherever the test is looking.
 */
function noLounger(s: Scene): void {
  s.layout = { ...s.layout, loungerX: s.layout.girlRight + 400 };
}

/** A scene with the oven stopped, which is most of what a test wants. */
function quietScene(rng = steady): Scene {
  const s = scene(rng);
  quietOven(s);
  return s;
}

/**
 * A scene with nothing in her way: no oven working, no car to get into, no
 * lounger to lie on. What the tests about the school and the door are about.
 */
function visitScene(rng = patient): Scene {
  const s = scene(rng);
  quietOven(s);
  noCar(s);
  noLounger(s);
  return s;
}

/** A scene run on until she has let herself into the school. */
function sceneInside(rng = patient): Scene {
  const s = visitScene(rng);
  runUntil(s, (x) => !girlOut(x), 12000, rng);
  return s;
}

/** The furthest the bird travels in any single frame over a stretch. */
function biggestHop(s: Scene, frames: number, rng = eager): number {
  let hop = 0;
  let px = s.bird.x;
  let py = s.bird.y;
  for (let i = 0; i < frames; i++) {
    step(s, rng);
    hop = Math.max(hop, Math.hypot(s.bird.x - px, s.bird.y - py));
    px = s.bird.x;
    py = s.bird.y;
  }
  return hop;
}

/** Puts a pizza where the bird will reach it, without waiting for the oven. */
function tossPizzaAt(s: Scene, x: number, y: number, vy = 0): void {
  s.pizza = { x, y, vx: 0, vy, spin: 0, rotation: 0 };
}

describe('the pizza coming out of the oven', () => {
  it('sends one up on its own, without anybody asking', () => {
    const s = ovenScene();
    const frames = runUntil(s, (s) => s.pizza !== null, 2000);
    expect(frames).toBeGreaterThan(TOSS_FRAMES);
  });

  it('brings the next one forward when the pizzaiolo is clicked', () => {
    const s = ovenScene();
    const waited = s.oven.nextPizzaIn;
    expect(waited).toBeGreaterThan(TOSS_FRAMES * 2);

    clickScene(s, s.layout.pizzaioloX, s.ground - 40);
    const frames = runUntil(s, (s) => s.pizza !== null, TOSS_FRAMES + 5);

    expect(frames).toBeLessThan(waited);
  });

  it('refuses to toss a second one while one is still in the air', () => {
    const s = scene();
    tossPizzaAt(s, 200, 100);
    const inTheAir = s.pizza;

    clickScene(s, s.layout.pizzaioloX, s.ground - 40);

    expect(s.oven.tossing).toBe(0);
    expect(s.pizza).toBe(inTheAir);
  });

  it('ignores a click on empty sky', () => {
    const s = scene();
    const waiting = s.oven.nextPizzaIn;

    clickScene(s, 10, 10);

    expect(s.oven.nextPizzaIn).toBe(waiting);
  });

  it('drops a pizza that reached the ground rather than leaving it lying there', () => {
    const s = scene();
    s.bird.phase = 'full';
    s.bird.timer = FULL_FRAMES;
    tossPizzaAt(s, 200, s.ground - 4, 6);

    step(s, steady);

    expect(s.pizza).toBeNull();
  });
});

describe('Cello and the pizza', () => {
  it('leaves her shoulder the moment one is in the air', () => {
    const s = scene();
    s.bird.phase = 'perched';
    tossPizzaAt(s, 300, 120);

    step(s, steady);

    expect(s.bird.phase).toBe('diving');
  });

  it('catches one he can reach, and eats it', () => {
    const s = scene();
    tossPizzaAt(s, s.bird.x, s.bird.y);

    step(s, steady);

    expect(s.bird.phase).toBe('eating');
    expect(s.pizza).toBeNull();
  });

  it('gives up on a pizza that is gone instead of chasing one that is not there', () => {
    const s = scene();
    tossPizzaAt(s, 40, s.ground - 60);
    step(s, steady);
    expect(s.bird.phase).toBe('diving');

    s.pizza = null;
    step(s, steady);

    expect(s.bird.phase).toBe('escorting');
  });

  it('watches a pizza land rather than diving for it while he is still full', () => {
    const s = scene();
    s.bird.phase = 'full';
    s.bird.timer = FULL_FRAMES;
    tossPizzaAt(s, s.bird.x, s.bird.y - 40);

    step(s, steady);

    expect(s.bird.phase).toBe('full');
  });
});

describe('being too full to fly', () => {
  /** Fast-forwards to the moment he has just swallowed one. */
  function stuffed(): Scene {
    const s = scene();
    tossPizzaAt(s, s.bird.x, s.bird.y);
    step(s, steady);
    run(s, EATING_FRAMES);
    return s;
  }

  it('sits him on the ground once the pizza is down', () => {
    const s = stuffed();
    expect(s.bird.phase).toBe('full');
    expect(s.bird.y).toBe(s.ground);
  });

  it('does not fly off while he is still digesting', () => {
    const s = stuffed();
    for (let i = 0; i < FULL_FRAMES - 1; i++) {
      step(s, eager);
      expect(s.bird.phase).toBe('full');
      expect(s.bird.y).toBe(s.ground);
    }
  });

  it('circles hearts over him, and only while he is down there', () => {
    const s = stuffed();
    run(s, 60);
    expect(s.hearts.some((heart) => heart.kind === 'ring')).toBe(true);

    runUntil(s, (s) => s.bird.phase !== 'full', FULL_FRAMES + 5);

    expect(s.hearts.some((heart) => heart.kind === 'ring')).toBe(false);
  });

  // The ring is meant to be over *him*. Working its position out at drawing time
  // was how it could go on circling a bird who had moved.
  it('keeps the ring over his head rather than over where he landed', () => {
    const s = stuffed();
    runUntil(s, (s) => s.hearts.length > 0, 60);
    const heart = s.hearts[0];

    expect(Math.abs(heart.x - s.bird.x)).toBeLessThanOrEqual(RING_SPREAD);
    expect(heart.y).toBeLessThan(s.bird.y);
  });

  it('gets back into the air on his own, given long enough', () => {
    const s = stuffed();
    runUntil(s, (s) => s.bird.phase === 'escorting', FULL_FRAMES + TAKEOFF_FRAMES + 10);
    expect(s.bird.y).toBeLessThan(s.ground);
  });

  it('takes off when he is clicked, rather than waiting it out', () => {
    const s = stuffed();
    expect(s.bird.timer).toBe(FULL_FRAMES);

    clickScene(s, s.bird.x, s.bird.y);
    step(s, steady);

    expect(s.bird.phase).toBe('takeoff');
  });

  // Full, he is drawn bigger and sitting lower, and his head is the obvious
  // place to aim. A hit box on his middle alone left it outside.
  it('wakes when he is clicked on the head, where anyone would aim', () => {
    const s = stuffed();
    expect(hitsBird(s, s.bird.x, s.bird.y - FULL_LIFT - 20)).toBe(true);

    clickScene(s, s.bird.x, s.bird.y - FULL_LIFT - 20);
    step(s, steady);

    expect(s.bird.phase).toBe('takeoff');
  });

  it('ignores a click on him while he is flying, there being nothing to wake', () => {
    const s = scene();
    s.bird.phase = 'escorting';

    clickScene(s, s.bird.x, s.bird.y);
    step(s, steady);

    expect(s.bird.phase).toBe('escorting');
  });

  it('ignores a click that lands beside him', () => {
    const s = stuffed();
    clickScene(s, s.bird.x + 200, s.bird.y);
    step(s, steady);
    expect(s.bird.phase).toBe('full');
  });
});

describe('Cello and the girl', () => {
  it('rides along on her shoulder rather than staying where she was', () => {
    const s = scene();
    s.bird.phase = 'perched';
    step(s, steady);
    const before = s.bird.x;

    run(s, 30);

    expect(s.girl.x).not.toBe(before);
    expect(s.bird.x).toBeCloseTo(shoulderX(s), 5);
    expect(s.bird.y).toBeCloseTo(shoulderY(s), 5);
  });

  it('follows her when she turns round, instead of being left behind', () => {
    const s = scene();
    s.girl.x = s.layout.girlRight;
    s.girl.dir = 1;
    s.bird.phase = 'perched';

    step(s, steady);
    expect(s.girl.dir).toBe(-1);
    run(s, 40);

    expect(s.bird.x).toBeCloseTo(shoulderX(s), 5);
  });

  it('makes his way back to her after eating, not to where he ate', () => {
    const s = scene();
    s.bird.phase = 'escorting';
    s.bird.x = s.layout.girlLeft;
    s.girl.x = s.layout.girlRight;
    const away = Math.abs(s.bird.x - shoulderX(s));

    run(s, 120);

    expect(Math.abs(s.bird.x - shoulderX(s))).toBeLessThan(away);
  });

  // The ring above a full bird is what says "wait for me". A heart he lets go
  // while perched has to read as something else, or being in love and being too
  // heavy to fly look the same.
  it('lets a heart go for her now and then, without putting a ring over his head', () => {
    const s = scene();
    s.bird.phase = 'perched';

    runUntil(s, (s) => s.hearts.length > 0, 400);

    expect(s.hearts.every((heart) => heart.kind === 'drift')).toBe(true);
  });
});

describe('the girl walking the scene', () => {
  it('turns round before she reaches the pizzaiolo, rather than walking through the oven', () => {
    const s = scene();
    s.girl.x = s.layout.girlRight - 1;
    s.girl.dir = 1;

    run(s, 200);

    expect(s.girl.x).toBeLessThanOrEqual(s.layout.girlRight);
    expect(s.layout.girlRight).toBeLessThan(s.layout.pizzaioloX);
  });

  it('stays on the screen at the other end too', () => {
    const s = scene();
    s.girl.x = s.layout.girlLeft;
    s.girl.dir = -1;

    run(s, 200);

    expect(s.girl.x).toBeGreaterThanOrEqual(s.layout.girlLeft);
  });
});

describe('a window that changed size', () => {
  it('does not strand a perched bird off the edge of a narrower one', () => {
    const s = scene();
    s.girl.x = 760;
    s.bird.phase = 'perched';
    step(s, steady);

    resizeScene(s, { width: 360, height: 600, ground: 480 });

    expect(s.girl.x).toBeLessThanOrEqual(s.layout.girlRight);
    expect(s.bird.x).toBeCloseTo(shoulderX(s), 5);
    expect(s.bird.y).toBe(shoulderY(s));
  });

  it('puts a bird who was sitting on the old ground down on the new one', () => {
    const s = scene();
    s.bird.phase = 'full';
    s.bird.y = s.ground;

    resizeScene(s, { width: 800, height: 400, ground: 320 });

    expect(s.bird.y).toBe(320);
  });

  it('keeps a pizza inside the window it is falling through', () => {
    const s = scene();
    tossPizzaAt(s, 780, 100);

    resizeScene(s, { width: 360, height: 600, ground: 480 });

    expect(s.pizza!.x).toBeLessThanOrEqual(360);
  });
});

describe('what the scene refuses to accumulate', () => {
  it('stops the chimney smoke growing for as long as the app is left open', () => {
    const s = scene();
    run(s, 4000);
    expect(s.oven.smoke.length).toBeLessThanOrEqual(MAX_PUFFS);
  });

  it('stops the hearts piling up over a bird left to digest', () => {
    const s = scene();
    s.bird.phase = 'full';
    s.bird.timer = 100000;
    run(s, 4000);
    expect(s.hearts.length).toBeLessThanOrEqual(MAX_HEARTS);
  });

  // Two pizzas up at once means one of them is uncatchable, and a pizza nobody
  // eats is the scene's one way of looking broken.
  it('never replaces a pizza that is still in the air, however long it runs', () => {
    // The slot holds one, so a second pizza does not pile up — it overwrites,
    // and the first one is simply gone mid-flight. Asserted as identity rather
    // than as "no toss while one is up": the peel now follows through after
    // letting go, so a swing carrying on above a pizza in flight is ordinary.
    const s = scene();
    let previous = s.pizza;
    for (let i = 0; i < 6000; i++) {
      step(s, steady);
      // Clicking the pizzaiolo on every single frame, which is the shortest path
      // to a second pizza if the guard were only in the oven's own timer.
      clickScene(s, s.layout.pizzaioloX, s.ground - 40);
      if (previous !== null && s.pizza !== null) expect(s.pizza).toBe(previous);
      previous = s.pizza;
    }
  });
});

// The scene's canvas is drawn *over* the app, and only the band the registry
// reserves is masked. Anything standing on the ground that reaches above that
// band is painted across the user's own expense list.
describe('staying inside the room it asked for', () => {
  it('reserves a floor that covers the scenery standing on the ground', () => {
    // At every width, since both the scenery and the band it asks for follow it.
    for (const width of [360, 700, 1440]) {
      expect(stageFloorHeight('cello', width)).toBeGreaterThanOrEqual(
        SCENE_REACH * sceneScale(width),
      );
    }
  });

  // What has to fit is where he *settles*, which is where he spends nearly all
  // of his time. Chasing a thrown pizza takes him far higher on purpose — that,
  // like the squirrel's falling acorns, is meant to be seen over the app — and
  // the seconds spent coming back down from a catch are the tail of it.
  it('never settles above the reach the floor was measured from', () => {
    const s = scene();
    // No pizza for the whole run, so he only ever hovers and perches.
    s.oven.nextPizzaIn = Number.MAX_SAFE_INTEGER;

    for (let i = 0; i < 3000; i++) {
      step(s, eager);
      // Landing counts as settling: it is the drop onto her shoulder, flown
      // rather than jumped, and it stays inside the same band.
      expect(['escorting', 'landing', 'perched']).toContain(s.bird.phase);
      expect(s.ground - s.bird.y).toBeLessThanOrEqual(SCENE_REACH);
    }
  });

  it('keeps the chimney inside it too', () => {
    const s = scene();
    expect(OVEN_HEIGHT + CHIMNEY_HEIGHT + CHIMNEY_CAP).toBeLessThanOrEqual(SCENE_REACH);
    expect(s.layout.ovenX).toBeGreaterThan(0);
  });
});

describe('where a click has to land', () => {
  it('finds the bird where he is, not where he started', () => {
    const s = scene();
    s.bird.x = 123;
    s.bird.y = 234;
    expect(hitsBird(s, 123, 234)).toBe(true);
    expect(hitsBird(s, 123, 234 - 100)).toBe(false);
  });

  it('finds the pizzaiolo standing on the ground, not floating above it', () => {
    const s = scene();
    expect(hitsPizzaiolo(s, s.layout.pizzaioloX, s.ground - 10)).toBe(true);
    expect(hitsPizzaiolo(s, s.layout.pizzaioloX, s.ground - 400)).toBe(false);
    expect(hitsPizzaiolo(s, s.layout.pizzaioloX - 300, s.ground - 10)).toBe(false);
  });
});

// ── The park, the school and the car ──

// The left of the scene is scenery with one moving part: she lets herself into
// the school now and then, and while she is gone the bird has nowhere to sit but
// a tree. Two ways that can go wrong — her never coming back out, and the
// scenery growing without the band the app reserves growing with it, which would
// quietly start painting over the expense list.

describe('the left of the scene', () => {
  it('runs park, school, car, then the walking space, then the oven', () => {
    const { treeXs, schoolX, carSchoolX, carHomeX, ovenX } = scene().layout;

    for (const x of treeXs) expect(x).toBeLessThan(schoolX);
    expect(carSchoolX).not.toBeNull();
    expect(schoolX).toBeLessThan(carSchoolX!);
    expect(carSchoolX!).toBeLessThan(carHomeX!);
    expect(carHomeX!).toBeLessThan(ovenX);
  });

  it('parks the car clear of the school wall rather than inside it', () => {
    const { schoolX, carSchoolX } = scene().layout;
    expect(carSchoolX! - CAR_WIDTH / 2).toBeGreaterThan(schoolX + SCHOOL_WIDTH / 2);
  });

  it('plants every tree the park says it has', () => {
    expect(scene().layout.treeXs).toHaveLength(TREE_COUNT);
  });

  // The oven already slides rather than crushing the walk; the left has to give
  // way the same way, or on a phone she would have nowhere left to pace.
  it.each([320, 360, 414, 768, 1440])('never lets the school cross the oven at %ipx', (width) => {
    const s = scene();
    resizeScene(s, { ...SIZE, width });
    expect(s.layout.schoolX).toBeLessThan(s.layout.ovenX);
    expect(s.layout.girlLeft).toBeLessThanOrEqual(s.layout.girlRight);
  });

  // The whole visit was dead on a 320px phone: the door sat past the end of her
  // walk, so she could never cross it, and she paced inside the school's own
  // footprint stopping three pixels short of a door she could not open.
  it.each([320, 360, 390, 414, 600, 768, 1440])(
    'keeps the door somewhere she actually walks at %ipx',
    (width) => {
      const s = scene();
      resizeScene(s, { ...SIZE, width });
      const { girlLeft, girlRight, doorX } = s.layout;

      expect(doorX).toBeGreaterThanOrEqual(girlLeft);
      // And with room beyond it, or she reaches it only by turning on it.
      expect(doorX).toBeLessThan(girlRight);
    },
  );

  // The car grew rightwards out of the school and was drawn straight through him
  // at every phone width.
  it.each([320, 360, 390, 414, 600, 768, 1440])(
    'never parks the car on top of the pizzaiolo at %ipx',
    (width) => {
      const s = scene();
      resizeScene(s, { ...SIZE, width });
      const { carSchoolX, carHomeX, pizzaioloX } = s.layout;

      // Either spot, since it waits at both — or no spots at all, on a window
      // with no room for one.
      for (const spot of [carSchoolX, carHomeX]) {
        if (spot !== null) expect(spot + CAR_WIDTH / 2).toBeLessThan(pizzaioloX);
      }
    },
  );

  it('keeps the school on screen even when everything else has given way', () => {
    const s = scene();
    resizeScene(s, { ...SIZE, width: 320 });
    expect(s.layout.schoolX - SCHOOL_WIDTH / 2).toBeGreaterThanOrEqual(0);
  });

  it('lets the far trees go over the left edge before the school moves', () => {
    const s = scene();
    resizeScene(s, { ...SIZE, width: 320 });
    // The park is the least load-bearing thing on that side, so it goes first.
    expect(Math.min(...s.layout.treeXs)).toBeLessThan(TREE_CROWN_RADIUS);
    expect(s.layout.schoolX).toBeGreaterThan(0);
  });

  it('counts the bird up his tree in the band it reserves', () => {
    // Derived, never chosen: scenery must not be able to outgrow the mask. Taken
    // off where he actually sits rather than off the constants SCENE_REACH is a
    // `Math.max` of — compared with those it is `a <= max(a, …)`, which holds
    // whatever anything is set to.
    const s = sceneInside();
    runUntil(s, (x) => x.bird.phase === 'perched', 3000, patient);
    expect(s.ground - s.bird.y).toBeLessThanOrEqual(SCENE_REACH);
  });
});

describe('letting herself into the school', () => {
  it('goes in at the door and nowhere else', () => {
    const s = sceneInside();
    expect(s.girl.x).toBe(s.layout.doorX);
  });

  it('walks past the door most times rather than going in on every pass', () => {
    // `steady` rolls 0.5, above the visit chance, so she only ever paces.
    const s = scene();
    noCar(s);
    run(s, 3000);
    expect(s.girl.phase).toBe('walking');
  });

  it('keeps the whole width to walk in, door or no door', () => {
    const s = scene();
    const seen: number[] = [];
    run(s, 6000);
    for (let i = 0; i < 4000; i++) {
      step(s, steady);
      if (s.girl.phase === 'walking') seen.push(s.girl.x);
    }
    // Both ends, not just the stretch between the door and the oven.
    expect(Math.min(...seen)).toBeLessThan(s.layout.doorX);
    expect(Math.max(...seen)).toBeGreaterThan(s.layout.doorX);
  });

  it('comes back out, and walks away from the door rather than straight back in', () => {
    const s = sceneInside();
    const door = s.layout.doorX;
    runUntil(s, (x) => x.girl.phase === 'walking', 4000, patient);

    run(s, 60, patient);
    expect(Math.abs(s.girl.x - door)).toBeGreaterThan(10);
    expect(s.girl.phase).toBe('walking');
  });

  it('does not leave her standing in the doorway forever', () => {
    const s = visitScene(patient);
    runUntil(s, (x) => x.girl.phase === 'entering', 12000, patient);
    expect(runUntil(s, (x) => x.girl.phase === 'inside', 200, patient)).toBeLessThanOrEqual(
      DOOR_FRAMES,
    );
  });

  it('opens the door to step through and shuts it again behind her', () => {
    const s = visitScene(patient);
    runUntil(s, (x) => x.girl.phase === 'entering', 12000, patient);

    const widths = [doorOpen(s)];
    while (s.girl.phase === 'entering') {
      step(s, patient);
      widths.push(doorOpen(s));
    }
    expect(Math.max(...widths)).toBeGreaterThan(0.9);
    // Shut once she is through: a door left standing open reads as a bug.
    expect(doorOpen(s)).toBe(0);
  });

  it('keeps the door shut while she is walking', () => {
    expect(doorOpen(scene())).toBe(0);
  });

  // Derived from her phase rather than stored, so a lit window with nobody in it
  // is unreachable. This pins the observable half of that.
  it('lights the window while she is in there and not after', () => {
    const s = sceneInside();
    expect(schoolLit(s)).toBe(true);

    runUntil(s, (x) => x.girl.phase === 'walking', 4000, patient);
    expect(schoolLit(s)).toBe(false);
  });
});

describe('the bird while she is inside', () => {
  it('makes the nearest tree his perch, there being no shoulder', () => {
    const s = sceneInside();

    expect(currentPerch(s)).toBe('tree');
    // Within the crown's own sway: he rides the tree rather than being pinned to
    // the trunk while it moves around him.
    expect(Math.abs(perchX(s) - s.layout.treeXs[0])).toBeLessThanOrEqual(SWAY_REACH);

    // In the crown rather than balanced on top of it: what a bird does, and
    // 27px of the user's list that stays visible, since the band the app
    // reserves is measured from wherever he settles highest.
    const sits = s.ground - perchY(s);
    expect(sits).toBeLessThan(TREE_HEIGHT);
    expect(sits).toBeGreaterThan(TREE_HEIGHT - TREE_CROWN_RADIUS * 2);
  });

  it('goes back to her shoulder the moment she is out', () => {
    const s = sceneInside();
    runUntil(s, (x) => x.girl.phase === 'walking', 4000, patient);

    expect(currentPerch(s)).toBe('shoulder');
    expect(perchX(s)).toBe(shoulderX(s));
    expect(perchY(s)).toBe(shoulderY(s));
  });

  it('actually gets to the tree rather than hanging where she left him', () => {
    const s = sceneInside();
    const treeX = s.layout.treeXs[0];
    expect(runUntil(s, (x) => Math.abs(x.bird.x - treeX) < 20, 1500, patient)).toBeGreaterThan(0);
  });

  it('never leaves him below the ground or off the side while he waits', () => {
    const s = sceneInside();
    for (let i = 0; i < 400; i++) {
      step(s, patient);
      expect(s.bird.y).toBeLessThanOrEqual(s.ground);
      expect(s.bird.x).toBeGreaterThanOrEqual(0);
      expect(s.bird.x).toBeLessThanOrEqual(s.width);
    }
  });
});

describe('coming down onto her shoulder', () => {
  // `perched` puts him exactly on his perch, so entering it straight from a
  // hover teleported him the whole hover height in one frame — fine when he was
  // near, a snap when he was not, which is what made it look random.
  it('flies the last of the way down rather than jumping it', () => {
    const s = scene(eager);
    runUntil(s, (x) => x.bird.phase === 'landing', 3000, eager);

    let frames = 0;
    let biggest = 0;
    let previous = s.bird.y;
    while (s.bird.phase === 'landing') {
      step(s, eager);
      biggest = Math.max(biggest, Math.abs(s.bird.y - previous));
      previous = s.bird.y;
      frames++;
    }

    expect(s.bird.phase).toBe('perched');
    expect(biggest).toBeLessThan(6);
    expect(frames).toBeGreaterThan(4);
    // And he was already there when the phase changed, so there is no last jump.
    expect(Math.abs(s.bird.y - shoulderY(s))).toBeLessThan(3);
  });
});

describe('when his perch moves out from under him', () => {
  // He sat in the tree while she was inside and then simply appeared on her
  // shoulder the frame she stepped back out — the whole distance in one frame.
  it('flies to her shoulder when she comes out instead of appearing on it', () => {
    const s = sceneInside();
    // Settled in the tree first, or there is no jump to make.
    runUntil(s, (x) => x.bird.phase === 'perched', 2000, patient);
    expect(s.bird.perchedOn).toBe('tree');

    runUntil(s, (x) => x.girl.phase === 'walking', 4000, patient);
    const trip = Math.hypot(s.bird.x - shoulderX(s), s.bird.y - shoulderY(s));

    // Still up a tree with the trip ahead of him. Unfixed this was zero: he had
    // already arrived, in the frame she stepped out.
    expect(trip).toBeGreaterThan(20);
    expect(biggestHop(s, 400, patient)).toBeLessThan(trip / 5);
    // And he does arrive, rather than drifting off after her.
    runUntil(s, (x) => x.bird.phase === 'perched', 3000, patient);
    expect(Math.abs(s.bird.x - shoulderX(s))).toBeLessThan(3);
  });

  it('leaves her shoulder under its own power when she goes in', () => {
    const s = visitScene(patient);
    runUntil(s, (x) => x.bird.phase === 'perched', 4000, patient);
    runUntil(s, (x) => !girlOut(x), 12000, patient);
    const trip = Math.hypot(s.bird.x - perchX(s), s.bird.y - perchY(s));

    expect(trip).toBeGreaterThan(20);
    expect(biggestHop(s, 400, patient)).toBeLessThan(trip / 5);
  });

  // Identity, not distance: `perched` may not doubt that it is at its perch, or
  // every deliberate placement becomes ambiguous.
  it('leaves a bird alone whose perch has not changed', () => {
    const s = visitScene(patient);
    runUntil(s, (x) => x.bird.phase === 'perched', 4000, patient);

    run(s, 200, patient);

    expect(s.bird.phase).toBe('perched');
    expect(s.bird.perchedOn).toBe('shoulder');
  });
});

describe('the trees in the wind', () => {
  it('leans them without ever letting one wander off the park', () => {
    // Against the park's own ground rather than against SWAY_REACH: a sway of
    // `sin(t) * SWAY_REACH` is inside SWAY_REACH by arithmetic, whatever it is
    // set to.
    const s = scene();
    const planted = s.layout.treeXs.slice();
    for (let i = 0; i < 500; i++) {
      step(s, steady);
      for (let t = 0; t < TREE_COUNT; t++) {
        expect(Math.abs(treeSway(s, t) + planted[t] - s.layout.treeXs[t])).toBeLessThan(
          TREE_GAP / 2,
        );
      }
    }
  });

  it('does not sway them all in step, which would read as the page moving', () => {
    const s = scene();
    run(s, 40);
    expect(treeSway(s, 0)).not.toBe(treeSway(s, 1));
  });
});

// He is making them for her, so an empty terrace means an idle oven — otherwise
// pizzas pile up unwatched while she is in the school and the bird, who cannot
// resist one, never gets to the trees at all.

describe('the oven while she is at school', () => {
  it('stops making pizzas once there is nobody to make them for', () => {
    const s = scene(eager);
    noLounger(s);
    runUntil(s, (x) => !girlOut(x), 8000, eager);
    s.pizza = null;

    run(s, 400, eager);

    expect(s.pizza).toBeNull();
    expect(s.oven.tossing).toBe(0);
  });

  it('does not spend her whole visit counting down to one', () => {
    const s = scene(eager);
    noLounger(s);
    runUntil(s, (x) => !girlOut(x), 8000, eager);
    const waiting = s.oven.nextPizzaIn;

    run(s, 300, eager);

    // Frozen, not ticking: otherwise she is met by a pizza the instant she is
    // back through the door.
    expect(s.oven.nextPizzaIn).toBe(waiting);
  });

  it('gets going again once she is back out', () => {
    const s = ovenScene(eager);
    noLounger(s);
    runUntil(s, (x) => !girlOut(x), 8000, eager);
    runUntil(s, (x) => x.girl.phase === 'walking', 4000, eager);
    // Set rather than read: a countdown that happened to be frozen at zero is
    // spent the moment she is back out, and the reset that follows a toss says
    // nothing about whether it was ticking. A swing already under way would
    // reset it too, so that is cleared with it.
    s.oven.tossing = 0;
    s.oven.recovering = 0;
    s.oven.nextPizzaIn = 200;

    run(s, 30, eager);

    expect(s.oven.nextPizzaIn).toBe(170);
  });
});

// She is in there with the light on, so the chimney is going — gently, and only
// then. The stack itself has to sit *on* the slope: drawn square, one corner is
// buried in the roof and the other hangs over thin air.

describe('the school chimney', () => {
  it('stands with both feet on the roof, not across the ridge', () => {
    const s = scene();
    const { left, right, top } = schoolChimney(s);

    // Its foot follows the pitch, so both sides meet the roof.
    expect(schoolRoofY(s, left)).toBeLessThan(schoolRoofY(s, right));
    expect(top).toBeLessThan(schoolRoofY(s, left));
    // On the right-hand slope, clear of the ridge.
    expect(left).toBeGreaterThan(s.layout.schoolX);
  });

  it('is counted in the band the app reserves, being taller than the ridge', () => {
    const s = scene();
    expect(s.ground - schoolChimney(s).mouth.y).toBeGreaterThan(SCHOOL_HEIGHT);
    expect(SCENE_REACH).toBeGreaterThanOrEqual(s.ground - schoolChimney(s).mouth.y);
  });

  it('smokes only while there is somebody inside', () => {
    const s = visitScene(patient);
    run(s, 600, patient);
    expect(s.schoolSmoke).toHaveLength(0);

    runUntil(s, (x) => !girlOut(x), 12000, patient);
    expect(runUntil(s, (x) => x.schoolSmoke.length > 0, 200, patient)).toBeGreaterThan(0);
  });

  it('lets the last of it drift off after she leaves rather than vanishing with her', () => {
    const s = sceneInside();
    runUntil(s, (x) => x.schoolSmoke.length > 0, 200, patient);
    runUntil(s, (x) => x.girl.phase === 'walking', 4000, patient);

    // Still up there the frame she steps out, and gone a while later.
    expect(s.schoolSmoke.length).toBeGreaterThan(0);
    run(s, 400, patient);
    expect(s.schoolSmoke).toHaveLength(0);
  });

  it('smokes far more thinly than the pizza oven', () => {
    const s = sceneInside();
    run(s, 1200, patient);
    // The oven was stopped for this test, so this is the school's own ceiling.
    expect(s.schoolSmoke.length).toBeLessThan(10);
  });
});

// The peel's geometry lives in this file rather than in `draw.ts` because this
// is where it can be asserted on — and because the two disagreeing is exactly
// what the throw looked like: the pizza was born beside his head while the peel
// held it a whole arm's length up and to the right, so it hopped backwards out
// of the paddle at the moment of release.
describe('the pizzaiolo throwing a pizza', () => {
  /** Runs to the frame the pizza leaves the peel. */
  function atRelease(): Scene {
    const s = ovenScene();
    runUntil(s, (x) => x.pizza !== null, 2000);
    return s;
  }

  it('lets it go from the tip of the peel, where it was riding', () => {
    const s = atRelease();
    const tip = peelTip(s);
    expect(Math.hypot(s.pizza!.x - tip.x, s.pizza!.y - tip.y)).toBeLessThan(2);
  });

  it('throws it square to the peel, which is the only way a swing can throw', () => {
    // A pizza leaving a swinging paddle goes off at a right angle to it. Nothing
    // of the throw may run *along* the paddle: that is a pizza being pushed off
    // the end rather than thrown, which is how it read when the velocity was
    // three random numbers unrelated to the arc.
    // Square to the *radius* — the line from his hands to where the pizza sits,
    // which is not quite the line of the paddle, since it rides above the blade.
    // Taken from where the pizza actually is rather than from the release
    // constant: read off that, the reference point moves with any change to it
    // and the test can never notice the throw leaving from the wrong place.
    const s = atRelease();
    const pivot = { x: s.layout.pizzaioloX + PEEL_PIVOT.x, y: s.ground + PEEL_PIVOT.y };
    const radius = { x: s.pizza!.x - pivot.x, y: s.pizza!.y - pivot.y };
    const length = Math.hypot(radius.x, radius.y);
    const speed = Math.hypot(s.pizza!.vx, s.pizza!.vy);
    const outwards = (s.pizza!.vx * radius.x + s.pizza!.vy * radius.y) / (length * speed);
    expect(Math.abs(outwards)).toBeLessThan(0.1);
  });

  it('still throws it up and back over the scene', () => {
    const s = atRelease();
    expect(s.pizza!.vy).toBeLessThan(0);
    expect(s.pizza!.vx).toBeLessThan(0);
  });

  it('throws it hard enough to clear his own head', () => {
    // Tangential speed alone is the speed of the paddle, which lobs it barely
    // higher than it started. A throw has a wrist in it.
    const s = atRelease();
    expect(Math.hypot(s.pizza!.vx, s.pizza!.vy)).toBeGreaterThan(6);
  });

  it('lets it go from where the paddle is drawing it, not from a mirror of that', () => {
    // Worked out the way `draw.ts` does it — rotate the carry point about the
    // pivot — rather than by asking `peelTip`. Both peel tests above take their
    // reference from `peelTip` itself, so a sign error inside it moves the test
    // with the bug: the pizza left 24px from the paddle, under the blade rather
    // than on it, and nothing went red.
    const s = atRelease();
    const angle = peelAngle(peelSwing(s));
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const drawn = {
      x: s.layout.pizzaioloX + PEEL_PIVOT.x + PEEL_CARRY_ALONG * cos - PEEL_CARRY_ABOVE * sin,
      y: s.ground + PEEL_PIVOT.y + PEEL_CARRY_ALONG * sin + PEEL_CARRY_ABOVE * cos,
    };

    expect(Math.hypot(s.pizza!.x - drawn.x, s.pizza!.y - drawn.y)).toBeLessThan(1);
  });

  it('lobs it over the scene rather than skimming it sideways', () => {
    // The shape of the throw, which no other assertion here pins: released too
    // far round the arc the tip is travelling almost straight sideways, and the
    // pizza leaves fast and flat instead of going up and over. Measured as the
    // height it actually reaches, so it cannot be satisfied by the constants.
    const s = atRelease();
    const from = s.pizza!.y;
    let apex = from;
    while (s.pizza && s.pizza.vy < 0) {
      step(s, steady);
      if (s.pizza) apex = Math.min(apex, s.pizza.y);
    }

    expect(from - apex).toBeGreaterThan(75);
  });

  it('swings faster into the release than it starts', () => {
    // A peel moving at one speed from rest to release reads as a lever being
    // cranked; a throw accelerates.
    const opening = peelSwingAt(TOSS_FRAMES / 3) - peelSwingAt(0);
    const closing = peelSwingAt(TOSS_FRAMES) - peelSwingAt((TOSS_FRAMES / 3) * 2);
    expect(closing).toBeGreaterThan(opening);
  });

  it('carries the arm on past the release rather than stopping dead on it', () => {
    const s = atRelease();
    const held = peelSwing(s);
    expect(held).toBeGreaterThanOrEqual(PEEL_RELEASE_SWING);

    runUntil(s, (x) => x.oven.tossing === 0, TOSS_FRAMES);
    expect(peelSwing(s)).toBeGreaterThan(held);
  });

  it('lets the peel come back down to level rather than snapping there', () => {
    const s = atRelease();
    runUntil(s, (x) => x.oven.tossing === 0, TOSS_FRAMES);

    const swings = [peelSwing(s)];
    for (let i = 0; i < PEEL_RECOVER_FRAMES; i++) {
      step(s, steady);
      swings.push(peelSwing(s));
    }
    for (let i = 1; i < swings.length; i++) expect(swings[i]).toBeLessThan(swings[i - 1]);
    expect(swings.at(-1)).toBe(0);
  });

  it('throws one pizza per swing, whatever becomes of the first', () => {
    // The arm carries on for a few frames after letting go, and "am I still
    // carrying it" was answered with "is there a pizza in the scene" — so a
    // pizza that left the scene inside that window armed the release again.
    const s = atRelease();
    s.pizza = null;

    while (s.oven.tossing > 0) {
      step(s, steady);
      expect(s.pizza).toBeNull();
    }
  });

  it('holds the peel level whenever there is nothing being thrown', () => {
    const s = ovenScene();
    quietOven(s);
    run(s, 30);
    expect(peelSwing(s)).toBe(0);
  });
});

// A phone is not a small desktop: at 360px the oven, the pizzaiolo and the
// school take up nearly the whole width, and there is no room left for a car or
// for her to walk anywhere. The scene is drawn smaller instead, which is the
// same thing a set designer would do — and because the scene then works in its
// own units, everything below it goes on measuring in the sizes it always had.
describe('how big the scene is drawn', () => {
  it('draws at full size on a window with room for it', () => {
    expect(sceneScale(1440)).toBe(1);
    expect(sceneScale(SCENE_FULL_WIDTH)).toBe(1);
  });

  it('never shrinks past the point where the scenery stops reading', () => {
    expect(sceneScale(360)).toBe(SCENE_MIN_SCALE);
    expect(sceneScale(120)).toBe(SCENE_MIN_SCALE);
    expect(sceneScale(0)).toBe(SCENE_MIN_SCALE);
  });

  it('shrinks smoothly between the two rather than stepping', () => {
    const between = sceneScale((360 + SCENE_FULL_WIDTH) / 2);
    expect(between).toBeGreaterThan(SCENE_MIN_SCALE);
    expect(between).toBeLessThan(1);
  });

  it('never grows as the window narrows', () => {
    let previous = sceneScale(2000);
    for (let width = 1990; width >= 200; width -= 10) {
      const scale = sceneScale(width);
      expect(scale).toBeLessThanOrEqual(previous);
      previous = scale;
    }
  });

  // The point of the exercise: a phone gets room for the whole scene, measured
  // in the units the layout is written in.
  it('gives a phone a wider stage than its screen, in scene units', () => {
    expect(360 / sceneScale(360)).toBeGreaterThan(360);
  });
});

// The Fiat was scenery: parked outside the school and never touched. Now it is
// the middle of the scene — she walks the two ends, where the park and the oven
// are, and drives the empty stretch between them with the bird in the seat.
describe('the drive between the ends of the scene', () => {
  /** A window with no room to park a car clear of the pizzaiolo. */
  function cramped(): Scene {
    const s = createScene({ width: 300, height: 600, ground: 500 }, steady);
    quietOven(s);
    return s;
  }

  const drivingPhases = ['boarding', 'driving', 'alighting'];

  it('waits at whichever end of the scene she was dropped into', () => {
    // Parked at a fixed end, half the sessions start with the car on the far
    // side of the one stretch she never walks — so she would have to cross it on
    // foot to reach the thing that exists to carry her across it.
    expect(createScene(SIZE, () => 0.02).car!.at).toBe('school');
    expect(createScene(SIZE, () => 0.98).car!.at).toBe('home');
  });

  it('leaves the car parked where it stands until she takes it', () => {
    const s = quietScene();
    expect(s.car).not.toBeNull();
    expect(s.car!.x).toBe(s.car!.at === 'school' ? s.layout.carSchoolX : s.layout.carHomeX);
  });

  it('parks both ends inside the stretch she can walk, or she could never reach it', () => {
    const s = quietScene();
    for (const spot of [s.layout.carSchoolX!, s.layout.carHomeX!]) {
      expect(spot).toBeGreaterThanOrEqual(s.layout.girlLeft);
      expect(spot).toBeLessThanOrEqual(s.layout.girlRight);
    }
  });

  it('remembers which end it is parked at rather than working it out from where it stands', () => {
    // The same rule the bird's `perchedOn` follows. Recovered by comparing its x
    // to a layout number, the first thing that nudges the car by a pixel — a
    // rounding, a bump, a parallax drift — makes it unboardable for ever, with
    // nothing to see but a girl who has stopped taking the car.
    // Both ends: started at the home end only, the school arm of the rule is
    // never reached and can be broken freely.
    for (const start of [() => 0.02, () => 0.98]) {
      const s = createScene(SIZE, start);
      quietOven(s);
      noLounger(s);
      s.car!.x += 3;

      runUntil(s, (x) => x.girl.phase === 'boarding', 8000);
    }
  });

  it('drives her the length of the middle and leaves her walking at the far end', () => {
    const s = quietScene();
    runUntil(s, (x) => x.girl.phase === 'driving', 6000);
    const from = s.car!.x;

    runUntil(s, (x) => x.girl.phase === 'walking', 4000);
    expect(Math.abs(s.car!.x - from)).toBeGreaterThan(40);
    expect([s.layout.carSchoolX, s.layout.carHomeX]).toContain(s.car!.x);
    expect(s.girl.x).toBeCloseTo(s.car!.x, 0);
  });

  it('gets in and gets out rather than appearing behind the wheel', () => {
    const s = quietScene();
    const seen = new Set<string>();
    for (let i = 0; i < 6000; i++) {
      step(s, steady);
      seen.add(s.girl.phase);
      if (seen.has('alighting')) break;
    }
    expect(seen).toContain('boarding');
    expect(seen).toContain('driving');
    expect(seen).toContain('alighting');
  });

  it('keeps her with the car for every frame it is moving', () => {
    const s = quietScene();
    runUntil(s, (x) => x.girl.phase === 'driving', 6000);
    for (let i = 0; i < 200 && s.girl.phase === 'driving'; i++) {
      step(s, steady);
      if (s.girl.phase === 'driving') expect(Math.abs(s.girl.x - s.car!.x)).toBeLessThan(20);
    }
  });

  it('starts her at one end of the scene, never in the stretch she never walks', () => {
    // Dropped into the middle she has to walk out of it, and the walk out is the
    // whole journey the car exists to make.
    for (const seed of [1, 4, 7, 99, 1234]) {
      const s = createScene(SIZE, seeded(seed));
      const middle = s.girl.x > s.layout.carSchoolX! + 2 && s.girl.x < s.layout.carHomeX! - 2;
      expect(middle).toBe(false);
    }
  });

  it('never walks between home and school, whatever the day throws up', () => {
    // The invariant from the first frame, over a varied run: the earlier version
    // of this waited for the first drive, which hid a scene that starts her in
    // the middle.
    for (const seed of [1, 99]) {
      const rng = seeded(seed);
      const s = createScene(SIZE, rng);
      quietOven(s);
      const { carSchoolX, carHomeX } = s.layout;
      for (let i = 0; i < 30000; i++) {
        step(s, rng);
        if (s.girl.phase !== 'walking') continue;
        const inTheMiddle = s.girl.x > carSchoolX! + 2 && s.girl.x < carHomeX! - 2;
        expect(inTheMiddle).toBe(false);
      }
    }
  });

  it('puts her back to an end when a resize leaves her stranded in the middle', () => {
    const s = quietScene();
    runUntil(s, (x) => x.girl.phase === 'walking' && x.girl.x >= x.layout.carHomeX!, 8000);

    resizeScene(s, { ...SIZE, width: SIZE.width * 2 });
    const middle = s.girl.x > s.layout.carSchoolX! + 2 && s.girl.x < s.layout.carHomeX! - 2;
    expect(middle).toBe(false);
  });

  it('pulls away and draws up gently rather than starting at full speed', () => {
    const s = quietScene();
    runUntil(s, (x) => x.girl.phase === 'driving', 6000);
    const speeds: number[] = [];
    let previous = s.car!.x;
    while (s.girl.phase === 'driving') {
      step(s, steady);
      speeds.push(Math.abs(s.car!.x - previous));
      previous = s.car!.x;
    }
    const quickest = Math.max(...speeds);
    expect(speeds[0]).toBeLessThan(quickest);
    expect(speeds.at(-1)!).toBeLessThan(quickest);
  });

  it('counts him settled when he is keeping station, not when he is still', () => {
    // What "settled" has to mean on a perch that is moving: he matches its
    // speed. Measured against zero — as it was — a bird holding station over a
    // car doing 3px a frame is never settled, so he can only ever land on things
    // that have stopped, and rides in the car happened only in the pause while
    // she was getting in.
    const s = quietScene();
    runUntil(s, (x) => x.girl.phase === 'driving', 6000);

    s.bird.x = perchX(s);
    s.bird.vx = perchVX(s);
    expect(settledOnPerch(s)).toBe(true);

    s.bird.vx = perchVX(s) + 3;
    expect(settledOnPerch(s)).toBe(false);
  });

  it('rides along with a car that is already moving, not only one standing still', () => {
    const s = quietScene(patient);
    runUntil(s, (x) => x.girl.phase === 'driving', 6000, patient);
    // Put him back in the air mid-drive, which is where he spends nearly all of
    // one: on the old rule he could not come down again until the car stopped.
    s.bird.phase = 'escorting';
    s.bird.x = perchX(s);
    s.bird.y = perchY(s) - 30;
    s.bird.vx = perchVX(s);

    runUntil(s, (x) => x.bird.phase === 'perched', 200, patient);
    expect(s.bird.perchedOn).toBe('car');
    expect(s.girl.phase).toBe('driving');
  });

  it('actually rides, for a good part of the drive rather than now and then', () => {
    // The measurement that matters: chasing where the car *is* leaves a bird
    // trailing it by more than the distance that counts as arriving, so he flew
    // above it for the whole trip and rode about one drive in twenty.
    const rng = seeded(11);
    const s = quietScene(rng);
    let driving = 0;
    let riding = 0;
    for (let i = 0; i < 60000; i++) {
      step(s, rng);
      if (s.girl.phase !== 'driving') continue;
      driving++;
      if (s.bird.phase === 'perched' && s.bird.perchedOn === 'car') riding++;
    }
    expect(driving).toBeGreaterThan(500);
    expect((riding / driving) * 100).toBeGreaterThan(45);
  });

  it('says when she is at the wheel, so the drawing need not read her phase', () => {
    const s = quietScene();
    for (const phase of ['walking', 'boarding', 'alighting', 'lounging', 'inside'] as const) {
      s.girl.phase = phase;
      expect(atTheWheel(s)).toBe(false);
    }
    s.girl.phase = 'driving';
    expect(atTheWheel(s)).toBe(true);
  });

  it('turns the squirrels to face the way they are going, and each other to kiss', () => {
    const s = quietScene(seeded(4));
    const rng = seeded(4);
    runUntil(s, (x) => x.squirrels.every((q) => q.phase === 'kissing'), 30000, rng);

    // Facing in, towards one another, rather than out over the park.
    const [one, two] = s.squirrels;
    const middle = (squirrelX(s, one) + squirrelX(s, two)) / 2;
    for (const squirrel of s.squirrels) {
      const towardsTheOther = middle > squirrelX(s, squirrel) ? 1 : -1;
      expect(squirrelFacing(s, squirrel)).toBe(towardsTheOther);
    }
  });

  it('folds his wings once he is sitting on something', () => {
    // Beating them while perched is a bird hovering an inch above the roof,
    // which is what it looked like.
    const s = quietScene();
    for (const phase of ['perched', 'full', 'eating'] as const) {
      s.bird.phase = phase;
      expect(birdAtRest(s)).toBe(true);
    }
    for (const phase of ['escorting', 'landing', 'diving', 'takeoff'] as const) {
      s.bird.phase = phase;
      expect(birdAtRest(s)).toBe(false);
    }
  });

  it('gets his feet down instead of hovering at the roof beating his wings', () => {
    // Arrival measured to a couple of pixels in both axes is a window he can
    // barely hit while the perch is moving under him, so he flew *at* the roof
    // for a third of every drive — which is a bird sitting on a car flapping.
    const rng = seeded(5);
    const s = quietScene(rng);
    let driving = 0;
    let landing = 0;
    for (let i = 0; i < 60000; i++) {
      step(s, rng);
      if (s.girl.phase !== 'driving') continue;
      driving++;
      if (s.bird.phase === 'landing') landing++;
    }
    expect(driving).toBeGreaterThan(500);
    expect((landing / driving) * 100).toBeLessThan(15);
  });

  it('takes the bird along, in the seat beside her', () => {
    const s = quietScene(patient);
    runUntil(s, (x) => x.girl.phase === 'driving', 6000, patient);
    expect(currentPerch(s)).toBe('car');

    runUntil(s, (x) => x.bird.phase === 'perched', 400, patient);
    // One frame on: he arrives *near* the perch and is pinned to it from the
    // next frame, which is the frame this is about.
    step(s, patient);
    expect(s.bird.perchedOn).toBe('car');
    expect(s.bird.x).toBeCloseTo(perchX(s), 0);
    expect(s.bird.y).toBeCloseTo(perchY(s), 0);
  });

  it('rides on the roof, not down over the front wheel', () => {
    const s = quietScene(patient);
    runUntil(s, (x) => x.girl.phase === 'driving', 6000, patient);

    // Standing *on* the roof: his middle is a body's half-height above it, or
    // half the bird is inside the car.
    expect(s.ground - perchY(s)).toBeGreaterThan(CAR_ROOF_HEIGHT);
    expect(Math.abs(perchX(s) - s.car!.x)).toBeLessThan(CAR_WIDTH / 4);
  });

  it('sits back over the middle of the roof, whichever way it is going', () => {
    // The roof is behind the middle of a 500, so where he sits depends on which
    // way the car is pointing — over the nose he would be on the bonnet.
    // A varied roll: a fixed one has her lying on the lounger at every pass, so
    // she never gets back to the car for the return leg.
    const rng = seeded(3);
    const s = quietScene(rng);
    runUntil(s, (x) => x.girl.phase === 'driving' && x.car!.dir === 1, 40000, rng);
    expect(perchX(s)).toBeLessThan(s.car!.x);

    runUntil(s, (x) => x.girl.phase === 'driving' && x.car!.dir === -1, 40000, rng);
    expect(perchX(s)).toBeGreaterThan(s.car!.x);
  });

  it('puts him back on her shoulder once she is out of the car', () => {
    const s = quietScene(patient);
    runUntil(s, (x) => x.girl.phase === 'driving', 6000, patient);
    runUntil(s, (x) => x.girl.phase === 'walking', 4000, patient);

    expect(currentPerch(s)).toBe('shoulder');
    runUntil(s, (x) => x.bird.phase === 'perched', 600, patient);
    expect(s.bird.perchedOn).toBe('shoulder');
  });

  it('still lets a pizza beat the drive, and takes him back to the car after', () => {
    const s = quietScene(patient);
    runUntil(s, (x) => x.girl.phase === 'driving', 6000, patient);
    // Within reach but not on top of him, or he catches it the same frame and
    // there is no dive to see.
    tossPizzaAt(s, s.bird.x + 70, s.bird.y - 40);
    step(s, patient);
    expect(s.bird.phase).toBe('diving');

    // And when it is over, the seat is still where he belongs — nothing about
    // the drive had to know a pizza had happened.
    s.pizza = null;
    step(s, patient);
    expect(s.bird.phase).toBe('escorting');
    if (s.girl.phase === 'driving') expect(currentPerch(s)).toBe('car');
  });

  it('leaves the car out of a window with no room to park one', () => {
    const s = cramped();
    expect(s.car).toBeNull();
    expect(s.layout.carSchoolX).toBeNull();
    for (let i = 0; i < 4000; i++) {
      step(s, steady);
      expect(drivingPhases).not.toContain(s.girl.phase);
    }
  });

  it('puts her back on her feet when a window loses the car underneath her', () => {
    const s = quietScene();
    runUntil(s, (x) => x.girl.phase === 'driving', 6000);

    resizeScene(s, { width: 300, height: 600, ground: 500 });
    expect(s.car).toBeNull();
    expect(s.girl.phase).toBe('walking');
    expect(s.girl.x).toBeLessThanOrEqual(s.layout.girlRight);
  });
});

// The one thing in the scene the app's own user can start. Clicking the bird
// already helps him digest and clicking the pizzaiolo already orders a pizza;
// this is her half of it, and the only one of the three that is about the two of
// them rather than about the food.
describe('calling him down with a kiss', () => {
  /** Her, walking, with him hovering above her and no pizza to distract him. */
  function walking(): Scene {
    const s = quietScene();
    noCar(s);
    s.bird.phase = 'escorting';
    return s;
  }

  const kisses = (s: Scene) => s.hearts.filter((heart) => heart.kind === 'kiss');
  const clickHer = (s: Scene) => clickScene(s, s.girl.x, s.ground - GIRL_HEIGHT / 2);

  it('blows him a kiss and brings him down to her shoulder', () => {
    const s = walking();
    clickHer(s);

    expect(kisses(s)).toHaveLength(1);
    expect(s.bird.phase).toBe('landing');
  });

  it('sends the kiss up from her rather than from wherever he happens to be', () => {
    const s = walking();
    s.bird.x = s.girl.x + 120;
    clickHer(s);

    // Beside her mouth rather than exactly at her middle, and nowhere near him.
    expect(Math.abs(kisses(s)[0].x - s.girl.x)).toBeLessThan(8);
    expect(Math.abs(kisses(s)[0].x - s.bird.x)).toBeGreaterThan(100);
    // From her mouth: up where her head is, not somewhere about her knees.
    expect(s.ground - kisses(s)[0].y).toBeGreaterThan(GIRL_HEIGHT * 0.75);
    expect(s.ground - kisses(s)[0].y).toBeLessThan(GIRL_HEIGHT * 1.1);
  });

  it('sends it from where her head is when she is lying down, not where she stands', () => {
    // Lying down her head is at the raked end of the lounger, a third of her
    // standing height off the ground: sent from where she stands, the heart
    // appears up in the banana leaves with nobody under it.
    const s = quietScene(eager);
    runUntil(s, (x) => x.girl.phase === 'lounging', 20000, eager);
    s.bird.phase = 'escorting';
    s.hearts.length = 0;

    clickScene(s, s.girl.x, s.ground - 12);
    const kiss = s.hearts.find((heart) => heart.kind === 'kiss')!;

    expect(s.ground - kiss.y).toBeLessThan(GIRL_HEIGHT * 0.6);
    expect(kiss.x).toBeLessThan(s.layout.loungerX);
  });

  it('lets the kiss rise and fade like the ones he sends her', () => {
    const s = walking();
    clickHer(s);
    const from = kisses(s)[0].y;

    run(s, 10);
    expect(kisses(s)[0].y).toBeLessThan(from);

    run(s, DRIFT_LIFE);
    expect(kisses(s)).toHaveLength(0);
  });

  it('does nothing at all when he is already sitting on her shoulder', () => {
    const s = walking();
    s.bird.phase = 'perched';
    s.bird.perchedOn = 'shoulder';
    s.bird.x = shoulderX(s);
    s.bird.y = shoulderY(s);

    clickHer(s);

    expect(kisses(s)).toHaveLength(0);
    expect(s.bird.phase).toBe('perched');
  });

  it('does not interrupt him on his way down, having already been called', () => {
    const s = walking();
    s.bird.phase = 'landing';
    clickHer(s);
    expect(kisses(s)).toHaveLength(0);
  });

  it.each(['diving', 'eating', 'takeoff'] as const)(
    'leaves him to the pizza when he is %s',
    (phase) => {
      // A pizza in the air beats anything else he might be doing, and a click is
      // not an exception: called off a dive he would go hungry for a wave. Nor
      // is one needed on the way back up — he is already coming.
      const s = walking();
      s.bird.phase = phase;
      clickHer(s);

      expect(kisses(s)).toHaveLength(0);
      expect(s.bird.phase).toBe(phase);
    },
  );

  it('gets him up off the ground when he is lying there too full to fly', () => {
    // He is full for four hundred frames at a time, which is most of the scene's
    // life: a call that does nothing through all of it is a control that looks
    // broken. Clicking *him* already cuts it short — "digested, with a little
    // help" — and being called by her is at least as good a reason.
    const s = walking();
    s.bird.phase = 'full';
    s.bird.timer = 300;

    clickHer(s);

    expect(kisses(s)).toHaveLength(1);
    expect(s.bird.timer).toBe(0);
  });

  it('reaches her without having to be clicked on the nose', () => {
    // She is a few pixels wide on a screen a thousand across; a target only as
    // wide as she is drawn is a target most taps miss.
    const s = walking();
    clickScene(s, s.girl.x + 30, s.ground - 30);
    expect(kisses(s)).toHaveLength(1);
  });

  it('has nobody to kiss while she is inside the school', () => {
    const s = sceneInside();
    s.bird.phase = 'escorting';
    clickScene(s, s.layout.doorX, s.ground - GIRL_HEIGHT / 2);

    expect(kisses(s)).toHaveLength(0);
  });

  it.each(['boarding', 'alighting'] as const)('has no kiss to blow while %s', (phase) => {
    // She is at the car, half in it: the two phases either side of a drive were
    // the gap through which "not from inside or a car" could be widened.
    const s = walking();
    s.girl.phase = phase;
    clickHer(s);
    expect(kisses(s)).toHaveLength(0);
  });

  it('has no shoulder to call him to while she is driving', () => {
    const s = quietScene();
    runUntil(s, (x) => x.girl.phase === 'driving', 6000);
    s.bird.phase = 'escorting';
    clickHer(s);

    expect(kisses(s)).toHaveLength(0);
    expect(s.bird.phase).toBe('escorting');
  });

  it('ignores a click that lands nowhere near her', () => {
    const s = walking();
    clickScene(s, s.girl.x + 200, s.ground - GIRL_HEIGHT / 2);

    expect(kisses(s)).toHaveLength(0);
    expect(s.bird.phase).toBe('escorting');
  });

  it('does not let a hundred clicks fill the sky with hearts', () => {
    const s = walking();
    for (let i = 0; i < 100; i++) {
      s.bird.phase = 'escorting';
      clickHer(s);
    }
    expect(s.hearts.length).toBeLessThanOrEqual(MAX_HEARTS);
  });
});

// Driving somewhere and not going in is not an errand, it is a car park. The
// school visit used to be a chance she took on any pass; arriving by car makes
// it the reason she came.
describe('turning round with a bird on her shoulder', () => {
  it('carries him across her rather than snapping him to the other side', () => {
    // The shoulder he sits on is the one behind her, so a turn moves it the
    // width of her body — and `perched` pins him to it every frame. Unfixed that
    // is a 26px teleport across her, twice a lap, for the whole scene's life.
    const s = quietScene();
    noCar(s);
    s.bird.phase = 'perched';
    s.bird.perchedOn = 'shoulder';

    runUntil(s, (x) => x.girl.x >= x.layout.girlRight - 1, 6000);
    expect(biggestHop(s, 80, steady)).toBeLessThan(4);
  });

  it('does end up on the other shoulder once she has turned', () => {
    const s = quietScene();
    noCar(s);
    runUntil(s, (x) => x.girl.x >= x.layout.girlRight - 1, 6000);
    const before = shoulderX(s) - s.girl.x;

    run(s, 120);
    expect(shoulderX(s) - s.girl.x).toBeCloseTo(-before, 1);
  });
});

describe('the errand at the school', () => {
  /**
   * Runs until she has actually *driven* to the school and got out.
   *
   * Waiting only for "the car is at the school and she is walking" is satisfied
   * by a scene that started that way, which is a girl who never took a car
   * anywhere and has no errand to run.
   */
  function drivenToSchool(rng = steady): Scene {
    const s = quietScene(rng);
    runUntil(s, (x) => x.girl.phase === 'driving' && x.girl.dir === -1, 20000, rng);
    runUntil(s, (x) => x.girl.phase === 'walking', 4000, rng);
    return s;
  }

  it('goes into the building once she has driven there, chance or no chance', () => {
    // `steady` rolls 0.5, above VISIT_CHANCE, so nothing here is luck.
    const s = drivenToSchool();
    runUntil(s, (x) => x.girl.phase === 'entering', 3000);
  });

  it('walks out into the park rather than straight back to the car', () => {
    const s = drivenToSchool();
    runUntil(s, (x) => !girlOut(x), 3000);
    runUntil(s, (x) => x.girl.phase === 'walking', 3000);

    // West, where the park is — the car is east of the door, and leaving towards
    // it would mean the park is never walked at all.
    expect(s.girl.dir).toBe(-1);
  });

  it('still only sometimes goes in when she arrives on foot', () => {
    // The errand is what the drive buys; a pass on foot is as it always was.
    const s = quietScene();
    noCar(s);
    run(s, 4000);
    expect(s.girl.phase).toBe('walking');
  });
});

// He is making them for her, and she is not there to eat one: the oven is quiet
// while she is at the school end, and gets going when she is on her way home.
describe('the oven waiting for her to come home', () => {
  const countdownOver = (s: Scene, frames: number) => {
    const before = s.oven.nextPizzaIn;
    run(s, frames);
    return before - s.oven.nextPizzaIn;
  };

  function at(phase: (s: Scene) => boolean, rng = steady): Scene {
    const s = scene(rng);
    s.oven.nextPizzaIn = 4000;
    runUntil(s, phase, 20000, rng);
    s.oven.nextPizzaIn = 4000;
    return s;
  }

  it('does nothing while she is walking the school end', () => {
    const s = at((x) => x.girl.phase === 'walking' && x.girl.x < x.layout.carSchoolX!);
    expect(countdownOver(s, 40)).toBe(0);
  });

  it('does nothing while she is getting into the car at the school', () => {
    // The one place the two ends can be told apart on foot: walking, she is
    // never between them, so "at the home end" and "past the school's car" agree
    // everywhere except the few frames she spends standing at a car door.
    const s = at((x) => x.girl.phase === 'boarding' && x.car!.at === 'school');
    expect(countdownOver(s, 8)).toBe(0);
  });

  it('does nothing the moment she steps out at the school, not a step later', () => {
    // The boundary itself: sampled deeper into the school end, "home" could be
    // read off the wrong spot entirely and both readings would agree.
    const s = at((x) => x.girl.phase === 'walking' && x.girl.x <= x.layout.carSchoolX! + 1);
    expect(countdownOver(s, 10)).toBe(0);
  });

  it('does nothing while she is being driven to school', () => {
    const s = at((x) => x.girl.phase === 'driving' && x.girl.dir === -1);
    expect(countdownOver(s, 20)).toBe(0);
  });

  it('gets going while she is being driven home', () => {
    const s = at((x) => x.girl.phase === 'driving' && x.girl.dir === 1);
    expect(countdownOver(s, 20)).toBe(20);
  });

  it('gets going while she is walking the home end', () => {
    const s = at((x) => x.girl.phase === 'walking' && x.girl.x > x.layout.carHomeX!);
    expect(countdownOver(s, 40)).toBe(40);
  });

  it('keeps to the old rule on a window with no car to have ends', () => {
    // Nothing to be at either end of: she is simply out, as she always was.
    const s = scene();
    noCar(s);
    s.oven.nextPizzaIn = 4000;
    expect(countdownOver(s, 40)).toBe(40);
  });
});

// How she spends her day, which is the difference between a scene that reads as
// somebody living at the oven end and one that reads as somebody who is never
// home. Measured rather than assumed: the parts are set by five constants
// pulling against each other, and no single one of them says what the day looks
// like.
describe('how her day divides', () => {
  function day(seed: number) {
    const rng = seeded(seed);
    const s = createScene({ width: 1440, height: 900, ground: 800 }, rng);
    const tally = { home: 0, driving: 0, work: 0, lounging: 0 };
    const frames = 120000;
    for (let i = 0; i < frames; i++) {
      step(s, rng);
      const { phase, x } = s.girl;
      if (phase === 'lounging') tally.lounging++;
      if (phase === 'driving' || phase === 'boarding' || phase === 'alighting') tally.driving++;
      // Lying on the lounger under the banana trees is being at home, and is
      // most of what being at home looks like.
      else if (phase === 'lounging' || (phase === 'walking' && x >= s.layout.carHomeX!)) {
        tally.home++;
      } else tally.work++;
    }
    return {
      home: (tally.home / frames) * 100,
      driving: (tally.driving / frames) * 100,
      work: (tally.work / frames) * 100,
      lounging: (tally.lounging / frames) * 100,
    };
  }

  it.each([1, 7, 99])('spends her day at home, driving and at school (seed %i)', (seed) => {
    const { home, driving, work, lounging } = day(seed);

    // A good part of being home is spent on the lounger. Pinned as a share
    // rather than left to `LOUNGE_CHANCE`, which says nothing about how often
    // she actually gets an afternoon out of it.
    expect(lounging).toBeGreaterThanOrEqual(9);
    expect(lounging).toBeLessThanOrEqual(24);

    expect(home).toBeGreaterThanOrEqual(38);
    expect(home).toBeLessThanOrEqual(52);
    expect(driving).toBeGreaterThanOrEqual(13);
    expect(driving).toBeLessThanOrEqual(22);
    expect(work).toBeGreaterThanOrEqual(28);
    expect(work).toBeLessThanOrEqual(47);
  });
});

// Two squirrels living in the park. They are scenery with a life of their own —
// nothing else in the scene knows about them, and they know about nothing else —
// but scenery that moves still has to stay inside the room the app reserved.
describe('the squirrels in the park', () => {
  it('puts two of them in the park, each in a tree the park actually has', () => {
    const s = quietScene();
    expect(s.squirrels).toHaveLength(2);
    for (const squirrel of s.squirrels) {
      expect(squirrel.tree).toBeGreaterThanOrEqual(0);
      expect(squirrel.tree).toBeLessThan(s.layout.treeXs.length);
    }
  });

  it('keeps them between the foot of a trunk and the top of a crown', () => {
    const s = quietScene(eager);
    for (let i = 0; i < 6000; i++) {
      step(s, eager);
      for (const squirrel of s.squirrels) {
        expect(squirrelY(s, squirrel)).toBeLessThanOrEqual(s.ground);
        expect(squirrelY(s, squirrel)).toBeGreaterThanOrEqual(s.ground - SQUIRREL_REACH);
      }
    }
  });

  // The band the app gives up is measured from the tallest thing standing in the
  // scene. A squirrel that climbed above the bird's own place in the crown would
  // be drawn over the user's list, and nothing else would say so.
  it("never climbs above the bird's own perch in the tree", () => {
    expect(SQUIRREL_REACH).toBeLessThanOrEqual(SCENE_REACH);
  });

  it('goes round the trunk on the way up rather than straight up one side', () => {
    // A squirrel climbing a perfectly vertical line reads as a lift, not an
    // animal.
    const s = quietScene(steady);
    const squirrel = s.squirrels[0];
    const offsets: number[] = [];
    for (let i = 0; i < 400; i++) {
      step(s, steady);
      if (squirrel.phase === 'climbing') {
        offsets.push(squirrelX(s, squirrel) - s.layout.treeXs[squirrel.tree]);
      }
    }

    expect(Math.max(...offsets)).toBeGreaterThan(3);
    expect(Math.min(...offsets)).toBeLessThan(-3);
  });

  it('passes behind the tree as it comes round, and in front again', () => {
    const s = quietScene(steady);
    const squirrel = s.squirrels[0];
    const sides = new Set<boolean>();
    for (let i = 0; i < 600; i++) {
      step(s, steady);
      sides.add(squirrelBehind(squirrel));
    }
    expect(sides.size).toBe(2);
  });

  it('climbs rather than jumping up its tree', () => {
    const s = quietScene(steady);
    let previous = s.squirrels.map((squirrel) => squirrelY(s, squirrel));
    for (let i = 0; i < 3000; i++) {
      step(s, steady);
      const now = s.squirrels.map((squirrel) => squirrelY(s, squirrel));
      now.forEach((y, at) => expect(Math.abs(y - previous[at])).toBeLessThan(4));
      previous = now;
    }
  });

  it('crosses to a neighbouring tree rather than appearing in it', () => {
    const s = quietScene(eager);
    const crossed = runUntil(
      s,
      (x) => x.squirrels.some((q) => q.phase === 'crossing'),
      8000,
      eager,
    );
    expect(crossed).toBeGreaterThan(0);

    const squirrel = s.squirrels.find((q) => q.phase === 'crossing')!;
    let previous = squirrelX(s, squirrel);
    for (let i = 0; i < 200 && squirrel.phase === 'crossing'; i++) {
      step(s, eager);
      const now = squirrelX(s, squirrel);
      expect(Math.abs(now - previous)).toBeLessThan(8);
      previous = now;
    }
    expect(squirrel.phase).not.toBe('crossing');
  });

  it('lands in a tree it can actually be in, however long it runs', () => {
    const s = quietScene(eager);
    for (let i = 0; i < 20000; i++) {
      step(s, eager);
      for (const squirrel of s.squirrels) {
        expect(squirrel.tree).toBeLessThan(s.layout.treeXs.length);
        expect(squirrel.tree).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('does not have both of them doing the same thing forever', () => {
    const s = quietScene();
    let differed = false;
    for (let i = 0; i < 4000 && !differed; i++) {
      step(s, steady);
      differed =
        s.squirrels[0].phase !== s.squirrels[1].phase ||
        Math.abs(s.squirrels[0].up - s.squirrels[1].up) > 0.05;
    }
    expect(differed).toBe(true);
  });
});

// Home is not only somewhere she walks: sometimes she lies down under the banana
// trees and lets the afternoon happen. The pizzaiolo goes on working, because
// she is still home — that is the whole point of where the lounger is.
describe('the lounger at the home end', () => {
  const lying = (rng = eager) => {
    const s = quietScene(rng);
    runUntil(s, (x) => x.girl.phase === 'lounging', 20000, rng);
    return s;
  };

  it('stands the lounger and its trees at the home end, inside her walk', () => {
    const { loungerX, bananaXs, carHomeX, girlRight, girlLeft } = quietScene().layout;
    expect(loungerX).toBeGreaterThanOrEqual(carHomeX!);
    expect(loungerX).toBeLessThanOrEqual(girlRight);
    expect(bananaXs).toHaveLength(2);
    for (const x of bananaXs) {
      expect(x).toBeGreaterThan(girlLeft);
      expect(x).toBeLessThan(girlRight + BANANA_HEIGHT);
    }
  });

  it('stands one of them shorter than the other', () => {
    // Two of the same plant side by side read as wallpaper.
    expect(new Set(BANANA_TRUNKS).size).toBe(BANANA_TRUNKS.length);
  });

  it('keeps the banana trees inside the band the app already reserved', () => {
    // Anything standing on the ground and reaching above the band is painted
    // over the user's own list.
    expect(BANANA_HEIGHT).toBeLessThanOrEqual(SCENE_REACH);
  });

  it('lies down on it now and then, and gets up again', () => {
    const s = lying();
    expect(Math.abs(s.girl.x - s.layout.loungerX)).toBeLessThan(2);

    runUntil(s, (x) => x.girl.phase === 'walking', 4000, eager);
  });

  it('lies down coming from either side of it', () => {
    // The door is caught only on the way west (`wasRightOfDoor`); the lounger is
    // deliberately not, and nothing else says so. One-sided, she would walk past
    // it half the time for no reason a viewer could see.
    const rng = seeded(12);
    const s = quietScene(rng);
    const from = new Set<number>();
    let previous = s.girl.phase;
    let heading = s.girl.dir;

    for (let i = 0; i < 120000 && from.size < 2; i++) {
      const wasHeading = s.girl.dir;
      step(s, rng);
      if (s.girl.phase === 'lounging' && previous !== 'lounging') from.add(wasHeading);
      previous = s.girl.phase;
      heading = wasHeading;
    }

    expect(from).toEqual(new Set([1, -1]));
    expect(heading).toBeDefined();
  });

  it('does not lie straight back down on the frame she gets up', () => {
    // She is pinned to the lounger while she lies on it, so the frame she stands
    // up she is still exactly on it — and "caught on the way past" was true of
    // standing still. With a roll that always takes the chance, that is an
    // afternoon she never gets up from.
    const s = quietScene(eager);
    runUntil(s, (x) => x.girl.phase === 'lounging', 20000, eager);
    runUntil(s, (x) => x.girl.phase === 'walking', 2000, eager);

    step(s, eager);
    expect(s.girl.phase).toBe('walking');
  });

  it('walks past it most times rather than lying down on every pass', () => {
    // `steady` rolls 0.5, above the chance, so she only ever walks by.
    const s = quietScene();
    run(s, 6000);
    expect(s.girl.phase).not.toBe('lounging');
  });

  it('is still at home while she is lying on it, so the oven keeps working', () => {
    const s = lying();
    expect(homeward(s)).toBe(true);
  });

  it('gives him somewhere to be beside her rather than a shoulder that has gone', () => {
    const s = lying();
    expect(['lounger', 'banana']).toContain(currentPerch(s));
  });

  it('keeps to one of them for the whole lie-down rather than swapping under him', () => {
    // A perch that changed every frame would have him bouncing between the
    // lounger and a tree for as long as she lay there: `perched` follows the
    // perch, and `perchedOn` puts him back in the air whenever it changes.
    const s = lying();
    const chosen = currentPerch(s);
    for (let i = 0; i < 400 && s.girl.phase === 'lounging'; i++) {
      step(s, eager);
      if (s.girl.phase === 'lounging') expect(currentPerch(s)).toBe(chosen);
    }
  });

  it('can still be called over while she is lying down', () => {
    const s = lying();
    s.bird.phase = 'escorting';
    s.hearts.length = 0;

    clickScene(s, s.girl.x, s.ground - 12);
    expect(s.hearts.filter((heart) => heart.kind === 'kiss')).toHaveLength(1);
  });
});

// The banana leaves move in the same wind the park's crowns do, and for the same
// reason it is in this file: a sway nothing can assert is a sway nobody notices
// is broken.
// The band is derived from these constants, and a constant that under-reports
// the scenery is the one way the floor can go stale without anything looking
// wrong until a scene grows into the gap.
describe('the reach each part of the scene declares', () => {
  it('covers the school as high as its chimney really stands', () => {
    // Measured at the stack's *left* corner, which is the higher one: the roof
    // is a slope, so taking the height at its centre under-reports the top by
    // the rise across half the stack.
    const s = quietScene();
    expect(SCHOOL_REACH).toBeGreaterThanOrEqual(s.ground - schoolChimney(s).top);
  });

  it('covers a squirrel wherever it actually gets to, band and all', () => {
    // Asserted against the band the app reserves rather than against
    // SQUIRREL_REACH, which is defined from the same arc it would be bounding —
    // a bound that moves with the thing it bounds cannot fail.
    const s = quietScene(seeded(9));
    const rng = seeded(9);
    for (let i = 0; i < 20000; i++) {
      step(s, rng);
      for (const squirrel of s.squirrels) {
        expect(s.ground - squirrelY(s, squirrel)).toBeLessThanOrEqual(SCENE_REACH);
      }
    }
  });

  it('reserves the ground clearance under the scenery, not only the scenery', () => {
    // The scene stands GROUND_ABOVE_FOOTER above the footer, so a band measured
    // from the scenery alone ends short of the ground line and the ground — and
    // everyone standing on it — is painted over the nav bar.
    for (const width of [360, 700, 1440]) {
      expect(stageFloorHeight('cello', width)).toBeGreaterThanOrEqual(
        GROUND_ABOVE_FOOTER + SCENE_REACH * sceneScale(width),
      );
    }
  });
});

describe('the banana plants as the scene knows them', () => {
  it('leans them, and carries a bird sitting in one along with it', () => {
    // The park's trees do this already: "swaying with the crown he is sitting
    // in, rather than held at the trunk while the tree moves around him". A lean
    // that lives only in the drawing cannot be followed by a perch.
    const s = quietScene();
    const seen = new Set<number>();
    let sawTheBirdMove = false;
    let previous: number | null = null;

    for (let i = 0; i < 300; i++) {
      step(s, steady);
      seen.add(+bananaLean(s, 0).toFixed(3));
      s.girl.phase = 'lounging';
      s.girl.restPerch = 'banana';
      const perch = perchX(s);
      if (previous !== null && perch !== previous) sawTheBirdMove = true;
      previous = perch;
    }

    expect(seen.size).toBeGreaterThan(20);
    expect(sawTheBirdMove).toBe(true);
  });

  it('does not lean both plants as one', () => {
    const s = quietScene();
    run(s, 30);
    expect(bananaLean(s, 0)).not.toBeCloseTo(bananaLean(s, 1), 3);
  });

  it('gives each leaf the same shape every time it is asked', () => {
    // The shape is a hash of the leaf's own indices: a leaf that took a fresh
    // number each frame would flap through every shape it has.
    expect(bananaLeaves(0)).toEqual(bananaLeaves(0));
    expect(bananaLeaves(0)).not.toEqual(bananaLeaves(1));
  });

  it('counts the leaves into the height it declares, not just the stem', () => {
    // Derived, never chosen: the plant is its stem plus however far the leaves
    // arch above the crown, and that reach is part of the scene, not of the
    // drawing.
    expect(BANANA_HEIGHT).toBeGreaterThan(Math.max(...BANANA_TRUNKS));
    expect(BANANA_HEIGHT).toBeLessThanOrEqual(SCENE_REACH);
  });
});

describe('the wind in the banana leaves', () => {
  it('moves them, rather than holding them still', () => {
    const s = quietScene();
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      step(s, steady);
      seen.add(+leafSway(s, 0, 0).toFixed(3));
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('does not move them all as one, which would be a flag rather than a plant', () => {
    const s = quietScene();
    run(s, 30);
    const first = leafSway(s, 0, 0);
    expect(leafSway(s, 0, 3)).not.toBeCloseTo(first, 3);
    expect(leafSway(s, 1, 0)).not.toBeCloseTo(first, 3);
  });
});

// They have the run of the whole park, and they are fond of each other.
describe('the squirrels getting about, and getting together', () => {
  /** Varied, because every one of these is a thing that happens now and then. */
  const wind = seeded(4);

  it('jumps to any tree in the park, not only the one next door', () => {
    const s = quietScene(wind);
    let farJump = false;
    for (let i = 0; i < 20000 && !farJump; i++) {
      for (const squirrel of s.squirrels) {
        if (squirrel.phase === 'crossing' && Math.abs(squirrel.towards - squirrel.tree) > 1) {
          farJump = true;
        }
      }
      step(s, wind);
    }
    expect(farJump).toBe(true);
  });

  it('climbs every tree the park has, given long enough', () => {
    const s = quietScene(wind);
    const visited = new Set<number>();
    for (let i = 0; i < 40000; i++) {
      step(s, wind);
      for (const squirrel of s.squirrels) visited.add(squirrel.tree);
    }
    expect(visited.size).toBe(s.layout.treeXs.length);
  });

  it('goes to the tree the other one is in, rather than only ever by chance', () => {
    const s = quietScene(wind);
    runUntil(s, (x) => x.squirrels[0].tree === x.squirrels[1].tree, 20000, wind);
  });

  it('meets at the top of the tree to kiss, not halfway up the trunk', () => {
    const s = quietScene(wind);
    runUntil(s, (x) => x.squirrels.every((q) => q.phase === 'kissing'), 30000, wind);

    expect(s.squirrels[0].tree).toBe(s.squirrels[1].tree);
    for (const squirrel of s.squirrels) expect(squirrel.up).toBe(1);
  });

  it('sits them side by side, not one inside the other', () => {
    const s = quietScene(wind);
    runUntil(s, (x) => x.squirrels.every((q) => q.phase === 'kissing'), 30000, wind);

    const apart = Math.abs(squirrelX(s, s.squirrels[0]) - squirrelX(s, s.squirrels[1]));
    expect(apart).toBeGreaterThan(5);
  });

  it('puts hearts over them while they are at it', () => {
    const s = quietScene(wind);
    runUntil(s, (x) => x.squirrels.every((q) => q.phase === 'kissing'), 30000, wind);
    s.hearts.length = 0;

    // Over *them*: the bird sends hearts of his own from the other side of the
    // scene, and the first one along is as likely to be his.
    const overThem = (x: Scene) =>
      x.hearts.some((heart) => Math.abs(heart.x - squirrelX(x, x.squirrels[0])) < 20);
    runUntil(s, overThem, 200, wind);

    const heart = s.hearts.find((h) => Math.abs(h.x - squirrelX(s, s.squirrels[0])) < 20)!;
    expect(heart.y).toBeLessThan(s.ground - TREE_HEIGHT / 2);
  });

  it('goes back to climbing when they are done', () => {
    const s = quietScene(wind);
    runUntil(s, (x) => x.squirrels.every((q) => q.phase === 'kissing'), 30000, wind);
    runUntil(s, (x) => x.squirrels.every((q) => q.phase !== 'kissing'), 400, wind);
  });

  it('never lets the pair of them fill the sky with hearts', () => {
    const s = quietScene(wind);
    run(s, 30000, wind);
    expect(s.hearts.length).toBeLessThanOrEqual(MAX_HEARTS);
  });
});
