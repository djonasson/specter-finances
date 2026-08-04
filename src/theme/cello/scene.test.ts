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
      expect(s.bird.phase === 'escorting' || s.bird.phase === 'perched').toBe(true);
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
