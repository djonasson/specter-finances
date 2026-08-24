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
  DOOR_FRAMES,
  SWAY_REACH,
  currentPerch,
  schoolChimney,
  schoolRoofY,
  CAR_WIDTH,
  perchX,
  perchY,
  girlOut,
  schoolLit,
  doorOpen,
  treeSway,
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

/** A scene run on until she has let herself into the school. */
function sceneInside(rng = patient): Scene {
  const s = scene(rng);
  quietOven(s);
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
    const s = scene();
    const frames = runUntil(s, (s) => s.pizza !== null, 2000);
    expect(frames).toBeGreaterThan(TOSS_FRAMES);
  });

  it('brings the next one forward when the pizzaiolo is clicked', () => {
    const s = scene();
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
    expect(s.oven.smoke.length).toBeLessThanOrEqual(24);
  });

  it('stops the hearts piling up over a bird left to digest', () => {
    const s = scene();
    s.bird.phase = 'full';
    s.bird.timer = 100000;
    run(s, 4000);
    expect(s.hearts.length).toBeLessThanOrEqual(14);
  });

  // Two pizzas up at once means one of them is uncatchable, and a pizza nobody
  // eats is the scene's one way of looking broken.
  it('never starts a toss with a pizza already in the air, however long it runs', () => {
    const s = scene();
    for (let i = 0; i < 6000; i++) {
      step(s, steady);
      // Clicking the pizzaiolo on every single frame, which is the shortest path
      // to a second pizza if the guard were only in the oven's own timer.
      clickScene(s, s.layout.pizzaioloX, s.ground - 40);
      expect(s.pizza !== null && s.oven.tossing > 0).toBe(false);
    }
  });
});

// The scene's canvas is drawn *over* the app, and only the band the registry
// reserves is masked. Anything standing on the ground that reaches above that
// band is painted across the user's own expense list.
describe('staying inside the room it asked for', () => {
  it('reserves a floor that covers the scenery standing on the ground', () => {
    expect(stageFloorHeight('cello')).toBeGreaterThanOrEqual(SCENE_REACH);
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
    const { treeXs, schoolX, carX, ovenX } = scene().layout;

    for (const x of treeXs) expect(x).toBeLessThan(schoolX);
    expect(carX).not.toBeNull();
    expect(schoolX).toBeLessThan(carX!);
    expect(carX!).toBeLessThan(ovenX);
  });

  it('parks the car clear of the school wall rather than inside it', () => {
    const { schoolX, carX } = scene().layout;
    expect(carX! - CAR_WIDTH / 2).toBeGreaterThan(schoolX + SCHOOL_WIDTH / 2);
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
      const { carX, pizzaioloX } = s.layout;

      // Or does not park it at all, on a window with no room for one.
      if (carX !== null) expect(carX + CAR_WIDTH / 2).toBeLessThan(pizzaioloX);
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

  it('counts the school and the bird in a tree in the band it reserves', () => {
    // Derived, never chosen: scenery must not be able to outgrow the mask.
    expect(SCENE_REACH).toBeGreaterThanOrEqual(SCHOOL_HEIGHT);
    expect(SCENE_REACH).toBeGreaterThan(TREE_HEIGHT);
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
    runUntil(s, (x) => x.girl.phase === 'walking', 4000, patient);
    expect(s.girl.dir).toBe(1);
  });

  it('does not leave her standing in the doorway forever', () => {
    const s = scene(patient);
    quietOven(s);
    runUntil(s, (x) => x.girl.phase === 'entering', 12000, patient);
    expect(runUntil(s, (x) => x.girl.phase === 'inside', 200, patient)).toBeLessThanOrEqual(
      DOOR_FRAMES,
    );
  });

  it('opens the door to step through and shuts it again behind her', () => {
    const s = scene(patient);
    quietOven(s);
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
    const s = scene(patient);
    quietOven(s);
    runUntil(s, (x) => x.bird.phase === 'perched', 4000, patient);
    runUntil(s, (x) => !girlOut(x), 12000, patient);
    const trip = Math.hypot(s.bird.x - perchX(s), s.bird.y - perchY(s));

    expect(trip).toBeGreaterThan(20);
    expect(biggestHop(s, 400, patient)).toBeLessThan(trip / 5);
  });

  // Identity, not distance: `perched` may not doubt that it is at its perch, or
  // every deliberate placement becomes ambiguous.
  it('leaves a bird alone whose perch has not changed', () => {
    const s = scene(patient);
    quietOven(s);
    runUntil(s, (x) => x.bird.phase === 'perched', 4000, patient);

    run(s, 200, patient);

    expect(s.bird.phase).toBe('perched');
    expect(s.bird.perchedOn).toBe('shoulder');
  });
});

describe('the trees in the wind', () => {
  it('leans them without ever letting one wander off', () => {
    const s = scene();
    for (let i = 0; i < 500; i++) {
      step(s, steady);
      for (let t = 0; t < TREE_COUNT; t++)
        expect(Math.abs(treeSway(s, t))).toBeLessThanOrEqual(SWAY_REACH);
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
    runUntil(s, (x) => !girlOut(x), 8000, eager);
    s.pizza = null;

    run(s, 400, eager);

    expect(s.pizza).toBeNull();
    expect(s.oven.tossing).toBe(0);
  });

  it('does not spend her whole visit counting down to one', () => {
    const s = scene(eager);
    runUntil(s, (x) => !girlOut(x), 8000, eager);
    const waiting = s.oven.nextPizzaIn;

    run(s, 300, eager);

    // Frozen, not ticking: otherwise she is met by a pizza the instant she is
    // back through the door.
    expect(s.oven.nextPizzaIn).toBe(waiting);
  });

  it('gets going again once she is back out', () => {
    const s = scene(eager);
    runUntil(s, (x) => !girlOut(x), 8000, eager);
    runUntil(s, (x) => x.girl.phase === 'walking', 4000, eager);
    const waiting = s.oven.nextPizzaIn;

    run(s, 30, eager);

    expect(s.oven.nextPizzaIn).toBeLessThan(waiting);
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
    const s = scene(patient);
    quietOven(s);
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
