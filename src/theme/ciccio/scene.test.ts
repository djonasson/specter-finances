import { describe, it, expect } from 'vitest';
import {
  createScene,
  resizeScene,
  clickScene,
  say,
  ciccioFacing,
  CICCIO_NARROWEST,
  CICCIO_CALL,
  CICCIO_GRATIN,
  MAX_STEAM,
  SQUIRREL_SPEED,
  MAX_CLIMB,
  dashingForFood,
  serveGratin,
  tapCiccio as tapHimWhereHeStands,
  CAT_CALL,
  CLIMB_MAX,
  SQUIRREL_SCOLD,
  SQUIRREL_REACH,
  scolder,
  scoldingAt,
  hitsSquirrel,
  showingZebra,
  CAT_NEAR,
  MAX_HEARTS,
  SQUIRREL_CALL,
  step,
  flankX,
  MIN_FLANK,
  FLANK_SETTLED,
  WALK_SPEED,
  RUN_SPEED,
  layoutFor,
  ciccioFloor,
  ciccioY,
  squirrelY,
  SCENE_REACH,
  SEAT_HEIGHT,
  MIN_WANDER,
  FLANK_GAP,
  OVEN_WIDTH,
  OVEN_TOP,
  CICCIO_HEIGHT,
  BED_WIDTH,
  BED_HEAD,
  SOFA_WIDTH,
  SOFA_BACK,
  TV_WIDTH,
  TV_PANEL,
  TV_HANGS_AT,
  WALL_HEIGHT,
} from './scene';
import { sceneScale, GROUND_ABOVE_FOOTER } from '../stage';
import { stageFloorHeight } from '../registry';

/** The widths the app is actually opened at, narrowest phone to desktop. */
const WIDTHS = [280, 320, 360, 390, 414, 600, 768, 900, 1440];

/** The stage a window of this width gives the scene, in the scene's own units. */
const stageOf = (width: number) => ({
  width: width / sceneScale(width),
  height: 700 / sceneScale(width),
  ground: 600 / sceneScale(width),
});

const sceneAt = (width: number) => createScene(stageOf(width), () => 0.5);

/**
 * Puts him somewhere no fixed target overlaps, and taps him there.
 *
 * The room is hit-tested before the animals, deliberately — his box is enormous
 * and the oven never moves — so a tap at his own position lands on the cooker
 * whenever he happens to be standing at it. Which, with the kitchen now in the
 * middle of the room, is exactly where a scene built with a steady roll starts
 * him.
 */
function tapCiccio(s: ReturnType<typeof sceneAt>) {
  // The open floor between the bed and the kitchen, which is clear of every
  // fixed target at every width.
  const bedRight = s.layout.bedX + BED_WIDTH / 2;
  const kitchenLeft = s.layout.ovenX - OVEN_WIDTH / 2;
  s.ciccio.x = (bedRight + kitchenLeft) / 2;
  clickScene(s, s.ciccio.x, s.ground - 10);
}

/** The same room with nothing on the rota and no cat due: an ordinary walk. */
function quietScene(width: number) {
  const s = sceneAt(width);
  s.routine = { next: 0, wait: Number.MAX_SAFE_INTEGER };
  s.catNextIn = Number.MAX_SAFE_INTEGER;
  return s;
}

describe('the room, laid out', () => {
  it.each(WIDTHS)('stands everything on screen at %ipx, in the order it is drawn', (width) => {
    const stage = stageOf(width);
    const l = layoutFor(stage.width);

    // Bed, then kitchen, then living room — the order somebody would walk
    // through a studio flat. Nothing may leave the stage on either side: a
    // click target off the edge is a dead feature, and the oven and the
    // television are two of the four things anybody can click.
    expect(l.bedX - BED_WIDTH / 2).toBeGreaterThanOrEqual(0);
    expect(l.loungeX + SOFA_WIDTH / 2).toBeLessThanOrEqual(stage.width);
    expect(l.bedX).toBeLessThan(l.ovenX);
    expect(l.ovenX).toBeLessThan(l.loungeX);
  });

  it.each(WIDTHS)('leaves the kitchen clear of both its neighbours at %ipx', (width) => {
    const l = layoutFor(stageOf(width).width);
    expect(l.bedX + BED_WIDTH / 2).toBeLessThanOrEqual(l.ovenX - OVEN_WIDTH / 2);
    expect(l.ovenX + OVEN_WIDTH / 2).toBeLessThanOrEqual(l.loungeX - SOFA_WIDTH / 2);
  });

  // The television is hung above the sofa rather than stood beside it, so the
  // living room costs the room one sofa's width and the set cannot drift off
  // the furniture it belongs to. One number, not two that can disagree.
  it.each(WIDTHS)('hangs the television on the wall over its own sofa at %ipx', (width) => {
    const l = layoutFor(stageOf(width).width);
    expect(TV_WIDTH).toBeLessThan(SOFA_WIDTH);
    expect(TV_HANGS_AT).toBeGreaterThanOrEqual(SOFA_BACK);
    expect(TV_HANGS_AT + TV_PANEL).toBeLessThanOrEqual(WALL_HEIGHT);
    expect(l.loungeX).toBeGreaterThan(0);
  });

  it.each(WIDTHS)('keeps the whole room under its own ceiling at %ipx', (width) => {
    void width;
    // Everything in the room stands against the wall, and the wall is the
    // reach. A piece taller than the room would be drawn over the user's list.
    for (const height of [OVEN_TOP, BED_HEAD, SOFA_BACK, TV_HANGS_AT + TV_PANEL]) {
      expect(height).toBeLessThanOrEqual(WALL_HEIGHT);
    }
  });

  // The whole reason there is no `bed: Bed | null`. Everything stands against
  // the back wall and he walks the strip in front of all of it, so no piece
  // ever competes with his floor — and a null arm that can never be taken is
  // dead weight in `resizeScene`, in the drawing and in every reader for ever.
  it.each(WIDTHS)('leaves him a walk worth walking at %ipx, flanks included', (width) => {
    const l = layoutFor(stageOf(width).width);
    expect(l.wanderRight - l.wanderLeft).toBeGreaterThanOrEqual(MIN_WANDER);
  });

  it.each(WIDTHS)('insets his range so a squirrel always has room beside him at %ipx', (width) => {
    const stage = stageOf(width);
    const l = layoutFor(stage.width);
    expect(l.wanderLeft - FLANK_GAP).toBeGreaterThanOrEqual(0);
    expect(l.wanderRight + FLANK_GAP).toBeLessThanOrEqual(stage.width);
  });

  it('gives a wider window a wider walk, rather than bigger furniture', () => {
    const narrow = layoutFor(stageOf(360).width);
    const wide = layoutFor(stageOf(1440).width);
    expect(wide.wanderRight - wide.wanderLeft).toBeGreaterThan(
      narrow.wanderRight - narrow.wanderLeft,
    );
    // The bed is anchored to its own wall and does not move; the kitchen is
    // placed *along* the span, so it moves away from the bed as the room grows.
    // That is the difference between three areas and a bedsit with a cooker in
    // it — at 1280 the gap between the two is 337 units, at 320 it is 37.
    expect(wide.bedX).toBe(narrow.bedX);
    expect(wide.ovenX).toBeGreaterThan(narrow.ovenX);
    expect(wide.ovenX - wide.bedX).toBeGreaterThan((narrow.ovenX - narrow.bedX) * 2);
  });
});

describe('the band the room asks the app to reserve', () => {
  it('covers the tallest thing standing in the room, at every width', () => {
    for (const width of WIDTHS) {
      expect(ciccioFloor(width)).toBeGreaterThanOrEqual(SCENE_REACH * sceneScale(width));
    }
  });

  it('is the band the registry actually reserves, not one this file computed', () => {
    for (const width of WIDTHS) {
      expect(stageFloorHeight('ciccio', width)).toBe(ciccioFloor(width));
    }
  });

  // The user's own list scrolls above this. Cello reserves 171px and that was
  // the agreed ceiling; a taller oven should fail the suite rather than quietly
  // eat a row of expenses.
  it('costs no more of the screen than the cello does', () => {
    expect(ciccioFloor(1440)).toBeLessThanOrEqual(171);
  });

  // Dropping the wall from the reach leaves the band covering the furniture but
  // not the room it stands in — the top of the wall is then painted over the
  // user's own list, which is the one thing the band exists to prevent.
  it('reserves enough for the room itself, not only for what is in it', () => {
    expect(SCENE_REACH).toBeGreaterThanOrEqual(WALL_HEIGHT);
    for (const width of WIDTHS) {
      expect(ciccioFloor(width)).toBeGreaterThanOrEqual(
        GROUND_ABOVE_FOOTER + WALL_HEIGHT * sceneScale(width),
      );
    }
  });

  // Named one at a time, deliberately. Written as `SCENE_REACH >=
  // max(...SEAT_HEIGHT)` it restated the definition — true for any values any
  // of these could hold, so raising the oven past the wall or hanging the
  // television higher left it green while the top of both was painted over the
  // user's own list.
  it.each([
    ['the oven', OVEN_TOP],
    ['the television, at the height it hangs at', TV_HANGS_AT + TV_PANEL],
    ['the back of the sofa', SOFA_BACK],
    ['the head of the bed', BED_HEAD],
    ['the wall they all stand against', WALL_HEIGHT],
  ])('reserves enough for %s', (_piece, height) => {
    expect(SCENE_REACH).toBeGreaterThanOrEqual(height);
  });

  it('counts whoever is sitting on the tallest thing they can sit on', () => {
    expect(SCENE_REACH).toBeGreaterThanOrEqual(
      Math.max(...Object.values(SEAT_HEIGHT)) + Math.max(CICCIO_HEIGHT, SQUIRREL_REACH),
    );
  });
});

describe('who stands where', () => {
  it('starts him on the floor, between the two of them', () => {
    const s = sceneAt(900);
    expect(s.ciccio.at).toBe('floor');
    expect(s.squirrels).toHaveLength(2);
    const [left, right] = s.squirrels;
    expect(left.side).toBe(-1);
    expect(right.side).toBe(1);
    expect(left.x).toBeLessThan(s.ciccio.x);
    expect(right.x).toBeGreaterThan(s.ciccio.x);
  });

  it('puts everyone on the ground, since nobody has climbed on anything yet', () => {
    const s = sceneAt(900);
    expect(ciccioY(s)).toBe(s.ground);
    for (const squirrel of s.squirrels) expect(squirrelY(s, squirrel)).toBe(s.ground);
  });

  it('lifts him by the seat he is on, off the one table that says how high it is', () => {
    const s = sceneAt(900);
    // `lift` is how far onto it he has got: named a seat and not yet up it, he
    // is still on the floor, which is the whole of what makes a climb safe to
    // interrupt.
    s.ciccio.at = 'sofa';
    expect(ciccioY(s)).toBe(s.ground);
    s.ciccio.lift = 1;
    expect(ciccioY(s)).toBe(s.ground - SEAT_HEIGHT.sofa);
    s.ciccio.at = 'bed';
    expect(ciccioY(s)).toBe(s.ground - SEAT_HEIGHT.bed);
    s.ciccio.lift = 0.5;
    expect(ciccioY(s)).toBe(s.ground - SEAT_HEIGHT.bed / 2);
  });

  // And the seats are seats. Asserted as a height off the floor rather than
  // against the constant, which is the same number on both sides and passes
  // just as happily for a cushion lying flat on the ground.
  it('has both seats stand somebody clear of the floor', () => {
    const s = sceneAt(900);
    for (const at of ['sofa', 'bed'] as const) {
      s.ciccio.at = at;
      s.ciccio.lift = 1;
      expect(s.ground - ciccioY(s)).toBeGreaterThan(10);
      for (const q of s.squirrels) {
        q.at = at;
        q.lift = 1;
        expect(s.ground - squirrelY(s, q)).toBeGreaterThan(10);
      }
    }
  });

  it('starts him inside his own walk, not wherever the middle happens to be', () => {
    for (const width of WIDTHS) {
      const s = sceneAt(width);
      expect(s.ciccio.x).toBeGreaterThanOrEqual(s.layout.wanderLeft);
      expect(s.ciccio.x).toBeLessThanOrEqual(s.layout.wanderRight);
    }
  });
});

describe('a window that changes size', () => {
  it('re-lays the room and keeps him inside the new walk', () => {
    const s = sceneAt(1440);
    s.ciccio.x = s.layout.wanderRight;
    resizeScene(s, stageOf(320));

    expect(s.layout).toEqual(layoutFor(stageOf(320).width));
    expect(s.ciccio.x).toBeLessThanOrEqual(s.layout.wanderRight);
    expect(s.ciccio.x).toBeGreaterThanOrEqual(s.layout.wanderLeft);
  });

  it('keeps him between them through the resize, not just after it settles', () => {
    for (const width of WIDTHS) {
      const s = sceneAt(1440);
      resizeScene(s, stageOf(width));
      const [left, right] = s.squirrels;
      expect(left.x).toBeLessThan(s.ciccio.x);
      expect(right.x).toBeGreaterThan(s.ciccio.x);
    }
  });

  // `at` is carried, never recovered by comparing his x to the new sofa's x:
  // the first thing that nudges the sofa a unit would leave him unable to get
  // off it, with no error and nothing to see but a hedgehog who stopped moving.
  it('leaves him on the seat he was on, however far that seat moved', () => {
    const s = sceneAt(1440);
    s.ciccio.at = 'sofa';
    s.ciccio.lift = 1;
    s.ciccio.x = s.layout.loungeX;
    resizeScene(s, stageOf(360));

    expect(s.ciccio.at).toBe('sofa');
    expect(s.ciccio.lift).toBe(1);
    expect(s.ciccio.x).toBe(s.layout.loungeX);
    expect(ciccioY(s)).toBe(s.ground - SEAT_HEIGHT.sofa);
  });

  it('moves the ground everyone stands on, not only the walls', () => {
    const s = sceneAt(900);
    resizeScene(s, { width: 900, height: 400, ground: 300 });
    expect(s.ground).toBe(300);
    expect(ciccioY(s)).toBe(300);
  });
});

// ---------------------------------------------------------------------------

/** Run the scene forward, the way the frame loop would. */
function run(scene: ReturnType<typeof sceneAt>, frames: number, rng = () => 0.5) {
  for (let i = 0; i < frames; i++) step(scene, rng);
}

/** Steps until the predicate holds, and says so rather than hanging if it never does. */
function runUntil(
  scene: ReturnType<typeof sceneAt>,
  holds: (s: ReturnType<typeof sceneAt>) => boolean,
  limit: number,
  rng = () => 0.5,
) {
  for (let i = 0; i < limit; i++) {
    if (holds(scene)) return i;
    step(scene, rng);
  }
  throw new Error(`never happened within ${limit} frames`);
}

/** A small deterministic PRNG, for behaviour that only shows over a long run. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const steady = () => 0.5;
/** Rolls every chance offered, so a turn is taken wherever one is available. */
const eager = () => 0;
/**
 * Rolls the chance he goes to bed but not the one the television comes on by
 * itself. With `eager` the set switches on every frame it is off, so he is
 * always on his way to the sofa and the bed is unreachable.
 */
const sleepy = () => 0.0005;

describe('a hedgehog wandering his own floor', () => {
  it('never walks out of the room, however long it is left running', () => {
    for (const width of WIDTHS) {
      const s = sceneAt(width);
      run(s, 4000, eager);
      expect(s.ciccio.x).toBeGreaterThanOrEqual(s.layout.wanderLeft);
      expect(s.ciccio.x).toBeLessThanOrEqual(s.layout.wanderRight);
    }
  });

  it('turns round at the ends rather than stopping against them', () => {
    const s = sceneAt(900);
    s.ciccio.x = s.layout.wanderRight;
    s.ciccio.dir = 1;
    run(s, 2, steady);
    expect(s.ciccio.dir).toBe(-1);
    expect(s.ciccio.x).toBeLessThan(s.layout.wanderRight);
  });

  it('walks the whole floor given long enough, not a patch of it', () => {
    // A quiet afternoon: the rota sending him off to eat is a different
    // question, and it takes him off his walk half way through this one.
    const s = quietScene(900);
    let low = s.ciccio.x;
    let high = s.ciccio.x;
    for (let i = 0; i < 6000; i++) {
      step(s, steady);
      low = Math.min(low, s.ciccio.x);
      high = Math.max(high, s.ciccio.x);
    }
    const walk = s.layout.wanderRight - s.layout.wanderLeft;
    expect(high - low).toBeGreaterThan(walk * 0.9);
  });

  // `dir` snaps and `facing` eases, and they are two fields for a reason: the
  // nose is drawn off `facing`, and a turn taken in one frame reads as the
  // hedgehog flinching rather than turning round.
  it('turns its nose round over several frames, not in one', () => {
    const s = sceneAt(900);
    s.ciccio.dir = 1;
    run(s, 60, steady);
    expect(s.ciccio.facing).toBeCloseTo(1, 5);

    s.ciccio.dir = -1;
    step(s, steady);
    expect(s.ciccio.facing).toBeLessThan(1);
    expect(s.ciccio.facing).toBeGreaterThan(-1);
  });

  it('always ends a turn facing the way it is going', () => {
    const s = sceneAt(900);
    s.ciccio.dir = -1;
    run(s, 120, steady);
    expect(s.ciccio.facing).toBeCloseTo(-1, 5);
  });
});

describe('two squirrels who love him', () => {
  // The invariant the whole scene is about. Asserted every single frame rather
  // than at the end, because the way it breaks is transient: he outruns one,
  // it ends up the wrong side of him, and from then on the pair is inverted.
  // Being between them converges rather than being held down — he outruns them
  // for a gratin, and a squirrel he overtook has to run back. So the invariant
  // is stated as: whenever one is on the wrong side of him it is *travelling*
  // to the right one, and it never takes long.
  it('never leaves one on the wrong side of him without it running back', () => {
    for (const width of WIDTHS) {
      const s = sceneAt(width);
      let wrongFor = 0;
      for (let i = 0; i < 4000; i++) {
        step(s, eager);
        const [left, right] = s.squirrels;
        const wrong = left.x > s.ciccio.x - MIN_FLANK || right.x < s.ciccio.x + MIN_FLANK;
        wrongFor = wrong ? wrongFor + 1 : 0;
        expect(wrongFor).toBeLessThan(700);
      }
    }
  });

  it('settles them either side of him, given a quiet afternoon', () => {
    const s = quietScene(1280);
    run(s, 6400, steady);
    const [left, right] = s.squirrels;
    expect(left.x).toBeLessThan(s.ciccio.x);
    expect(right.x).toBeGreaterThan(s.ciccio.x);
    for (const q of s.squirrels) {
      // Within the dead zone of where they want to stand: closer than that and
      // they would shuffle a fraction every frame for ever.
      expect(Math.abs(Math.abs(q.x - s.ciccio.x) - FLANK_GAP)).toBeLessThanOrEqual(FLANK_SETTLED);
    }
  });

  it('keeps them in the room while it keeps them beside him', () => {
    const s = sceneAt(320);
    for (let i = 0; i < 2000; i++) {
      step(s, eager);
      for (const squirrel of s.squirrels) {
        expect(squirrel.x).toBeGreaterThanOrEqual(0);
        expect(squirrel.x).toBeLessThanOrEqual(s.width);
      }
    }
  });

  // They are never *still* — he never stops walking — so what settles is the
  // gap, not the position. Once they have caught him it stays between the
  // nearest they may be squeezed and a little past where they want to stand.
  it('closes the gap and then holds it, rather than trailing further every lap', () => {
    // A quiet afternoon: nothing on the rota, no cat. What is being asked is
    // whether an ordinary walk lets them drift, and a dash for a gratin — where
    // he is *meant* to pull away — would answer a different question.
    const s = quietScene(900);
    run(s, 400, steady);
    for (let i = 0; i < 4000; i++) {
      step(s, steady);
      for (const q of s.squirrels) {
        const gap = Math.abs(q.x - s.ciccio.x);
        expect(gap).toBeGreaterThanOrEqual(MIN_FLANK);
        expect(gap).toBeLessThanOrEqual(FLANK_GAP + 2);
      }
    }
  });

  // The max-step invariant, and the assertion that will still be here when
  // there is furniture to climb: nobody in this room may cover ground in one
  // frame that they should have taken several to cover. Asserted against the
  // fastest anybody moves, which is a squirrel keeping up with a dash for food.
  it('moves nobody further in a frame than they can travel', () => {
    const s = sceneAt(1440);
    let previous = s.squirrels.map((q) => q.x);
    for (let i = 0; i < 4000; i++) {
      step(s, eager);
      const now = s.squirrels.map((q) => q.x);
      // A hair of slack: these are sums of floats, not exact steps.
      now.forEach((x, j) =>
        expect(Math.abs(x - previous[j])).toBeLessThanOrEqual(SQUIRREL_SPEED + 1e-9),
      );
      previous = now;
    }
  });

  // The one ahead of him is pushed along rather than chasing, so it sits on the
  // edge of the dead zone: in it one frame, out of it the next. Recomputing
  // `facing` from the movement therefore flipped it every frame, and since the
  // drawing mirrors the whole figure about `facing`, that squirrel strobed.
  //
  // This is the assertion that catches it, rather than "the facing never
  // changes" — it must change, once, each time the pair turns round. What it
  // may never do is change twice in a handful of frames.
  it('never turns a squirrel round twice in the space of a few frames', () => {
    const s = sceneAt(1280);
    run(s, 300, steady);
    const lastFlip = s.squirrels.map(() => -Infinity);
    const previous = s.squirrels.map((q) => Math.sign(q.facing));
    for (let frame = 0; frame < 4000; frame++) {
      step(s, steady);
      s.squirrels.forEach((q, j) => {
        const now = Math.sign(q.facing);
        if (now !== previous[j]) {
          expect(frame - lastFlip[j]).toBeGreaterThan(30);
          lastFlip[j] = frame;
          previous[j] = now;
        }
      });
    }
  });

  // And the other half of the same bug: a squirrel that faces him while being
  // pushed walks backwards down the room for the whole length of his walk.
  it('walks a squirrel the way it is facing, never backwards', () => {
    const s = sceneAt(1280);
    run(s, 300, steady);
    for (let i = 0; i < 3000; i++) {
      const before = s.squirrels.map((q) => q.x);
      step(s, steady);
      s.squirrels.forEach((q, j) => {
        const moved = q.x - before[j];
        // Only judge frames where it actually travelled: the clamp that keeps
        // it off him nudges it a fraction, and that is not walking.
        if (Math.abs(moved) > 0.3) expect(Math.sign(moved)).toBe(Math.sign(q.facing));
      });
    }
  });

  it('places them off him, so where he is decides where they are', () => {
    const s = sceneAt(900);
    run(s, 600, steady);
    expect(flankX(s, -1)).toBeLessThan(s.ciccio.x);
    expect(flankX(s, 1)).toBeGreaterThan(s.ciccio.x);
  });
});

describe('a frame that does nothing to the room', () => {
  it('counts frames, so anything wanting a clock has one that is not the wall', () => {
    const s = sceneAt(900);
    expect(s.frame).toBe(0);
    run(s, 10, steady);
    expect(s.frame).toBe(10);
  });
});

// ---------------------------------------------------------------------------

describe('the wobble, which is his dance', () => {
  it('spins right round and comes back to wandering', () => {
    const s = sceneAt(900);
    tapCiccio(s);
    expect(s.ciccio.phase).toBe('wobbling');

    const frames = runUntil(s, (x) => x.ciccio.phase === 'wandering', 4000);
    expect(frames).toBeGreaterThan(20);
    expect(s.ciccio.spin).toBe(0);
  });

  // Exiting on `spin % TAU` makes the last frame depend on where the spin
  // started and on how far one frame carries it, so some starts never land in
  // the window and he spins for ever. Accumulated and compared against a total,
  // every start terminates.
  it('terminates from every angle it could start at', () => {
    for (let start = 0; start < 40; start++) {
      const s = sceneAt(900);
      tapCiccio(s);
      s.ciccio.spin = (start / 40) * Math.PI * 2;
      expect(() => runUntil(s, (x) => x.ciccio.phase !== 'wobbling', 5000)).not.toThrow();
    }
  });

  it('stays on the spot, rather than wandering off mid-spin', () => {
    const s = sceneAt(900);
    tapCiccio(s);
    const where = s.ciccio.x;
    run(s, 20, steady);
    expect(s.ciccio.phase).toBe('wobbling');
    expect(s.ciccio.x).toBe(where);
  });

  it('never lifts him off the floor while he turns', () => {
    const s = sceneAt(900);
    tapCiccio(s);
    for (let i = 0; i < 200; i++) {
      step(s, steady);
      expect(ciccioY(s)).toBe(s.ground);
      expect(s.ciccio.at).toBe('floor');
    }
  });

  it('refuses a second dance while the first is still going', () => {
    const s = sceneAt(900);
    tapCiccio(s);
    run(s, 10, steady);
    const spin = s.ciccio.spin;
    tapCiccio(s);
    expect(s.ciccio.spin).toBe(spin);
  });

  // Drawn about a horizontal scale, he passes through nothing at all twice a
  // turn and blinks out. He is a round animal: end-on he is still a blob.
  it('never draws him down to a sliver as he comes edge-on', () => {
    const s = sceneAt(900);
    tapCiccio(s);
    for (let i = 0; i < 400; i++) {
      step(s, steady);
      expect(Math.abs(ciccioFacing(s))).toBeGreaterThanOrEqual(CICCIO_NARROWEST);
    }
  });

  it('turns him the whole way round, showing both sides of him', () => {
    const s = sceneAt(900);
    s.ciccio.facing = 1;
    tapCiccio(s);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      step(s, steady);
      seen.add(Math.sign(ciccioFacing(s)));
    }
    expect([...seen].sort()).toEqual([-1, 1]);
  });

  it('keeps his walking facing across the dance rather than resuming flipped', () => {
    const s = sceneAt(900);
    run(s, 120, steady);
    const facing = s.ciccio.facing;
    tapCiccio(s);
    runUntil(s, (x) => x.ciccio.phase === 'wandering', 4000);
    // `spin` turns him; `facing` is the walk's and is left alone, or the walk
    // resumes from wherever the spin last happened to leave it.
    expect(s.ciccio.facing).toBeCloseTo(facing, 5);
  });
});

describe('what the three of them say', () => {
  it('gives him something to say now and then, unprompted', () => {
    const s = sceneAt(900);
    runUntil(s, (x) => x.ciccio.say !== null, 40000, eager);
    expect(s.ciccio.say!.line).toBe(CICCIO_CALL);
  });

  it('takes it away again, so a bubble is not left hanging', () => {
    const s = sceneAt(900);
    runUntil(s, (x) => x.ciccio.say !== null, 40000, eager);
    runUntil(s, (x) => x.ciccio.say === null, 4000, steady);
  });

  it('lets a new line replace the one showing rather than queue behind it', () => {
    const s = sceneAt(900);
    say(s.ciccio, CICCIO_CALL);
    const first = s.ciccio.say!.left;
    say(s.ciccio, CICCIO_GRATIN);
    expect(s.ciccio.say!.line).toBe(CICCIO_GRATIN);
    expect(s.ciccio.say!.left).toBeGreaterThanOrEqual(first);
  });

  // Each squirrel carries its own, for the reason each carries its own `side`:
  // shared, one could never speak while the other was speaking, and it would
  // look like a bug in the flanking.
  it('lets both squirrels speak at once, each for itself', () => {
    const s = sceneAt(900);
    say(s.squirrels[0], SQUIRREL_CALL);
    say(s.squirrels[1], SQUIRREL_CALL);
    expect(s.squirrels.map((q) => q.say?.line)).toEqual([SQUIRREL_CALL, SQUIRREL_CALL]);
  });
});

// ---------------------------------------------------------------------------

describe('a potato gratin', () => {
  it('puts one out on its own, without anybody asking', () => {
    const s = sceneAt(900);
    runUntil(s, (x) => x.gratin !== null, 60000, eager);
    expect(s.gratin!.x).toBeGreaterThanOrEqual(s.layout.wanderLeft);
    expect(s.gratin!.x).toBeLessThanOrEqual(s.layout.wanderRight);
  });

  it('serves one at once when the oven is clicked', () => {
    const s = sceneAt(900);
    clickScene(s, s.layout.ovenX, s.ground - 30);
    expect(s.gratin).not.toBeNull();
  });

  // One slot, by construction. The timer must also stop while one is out, or it
  // runs down during a long meal and a second appears the frame the first is
  // finished — one gratin per meal, for ever after.
  it('never puts a second one out, however fast the oven is clicked', () => {
    const s = sceneAt(900);
    clickScene(s, s.layout.ovenX, s.ground - 30);
    const first = s.gratin;
    for (let i = 0; i < 6000; i++) {
      clickScene(s, s.layout.ovenX, s.ground - 30);
      step(s, eager);
      if (s.gratin) expect(s.gratin).toBe(first);
      else break;
    }
  });

  it('sends him running for it, and he says so on the way', () => {
    const s = sceneAt(900);
    s.ciccio.x = s.layout.wanderRight;
    clickScene(s, s.layout.ovenX, s.ground - 30);

    // The tap sends him at once rather than leaving him to notice on his own
    // turn, and the line is said on whichever path found the food.
    expect(s.ciccio.phase).toBe('heading');
    expect(s.ciccio.say!.line).toBe(CICCIO_GRATIN);
    step(s, steady);
    expect(s.ciccio.dir).toBe(-1);
  });

  it('says it on the path he finds it by himself too, not only when tapped', () => {
    const s = sceneAt(900);
    runUntil(s, (x) => x.gratin !== null, 60000, eager);
    runUntil(s, (x) => x.ciccio.phase === 'heading', 400);
    expect(s.ciccio.say!.line).toBe(CICCIO_GRATIN);
  });

  // Keyed on the goal *holding* rather than on the frame it was set, he shouts
  // it every frame of the run.
  it('says it once when he spots it, not all the way across the room', () => {
    const s = sceneAt(900);
    s.ciccio.x = s.layout.wanderLeft;
    clickScene(s, s.layout.ovenX, s.ground - 30);
    s.gratin!.x = s.layout.wanderRight;
    runUntil(s, (x) => x.ciccio.phase === 'heading', 400);

    runUntil(s, (x) => x.ciccio.say === null, 4000, steady);
    // Still running for it, and no longer saying anything.
    expect(s.ciccio.phase).toBe('heading');
    expect(s.ciccio.say).toBeNull();
  });

  it('does a happy dance when he gets there, and then eats it', () => {
    const s = sceneAt(900);
    clickScene(s, s.layout.ovenX, s.ground - 30);
    runUntil(s, (x) => x.ciccio.phase === 'wobbling', 6000);
    // The same wobble, told to hand off to eating rather than to wandering.
    expect(s.ciccio.after).toBe('eating');
    runUntil(s, (x) => x.ciccio.phase === 'eating', 6000);
    runUntil(s, (x) => x.gratin === null, 6000);
    expect(s.ciccio.phase).toBe('wandering');
  });

  it('arrives on the spot rather than stepping over it and back', () => {
    const s = sceneAt(1440);
    s.ciccio.x = s.layout.wanderRight;
    clickScene(s, s.layout.ovenX, s.ground - 30);
    const where = s.gratin!.x;

    runUntil(s, (x) => x.ciccio.phase === 'heading', 400);
    runUntil(s, (x) => x.ciccio.phase !== 'heading', 8000);
    expect(s.ciccio.x).toBe(where);
  });

  // A stale `after` from a click-dance far from any food would have him eating
  // the carpet. The entry is guarded rather than trusted.
  it('does not eat thin air when the dance was not about food', () => {
    const s = sceneAt(900);
    s.ciccio.after = 'eating';
    tapCiccio(s);
    runUntil(s, (x) => x.ciccio.phase === 'wandering', 4000);
    expect(s.ciccio.phase).toBe('wandering');
  });

  it('keeps it inside his walk when the window changes, so it stays reachable', () => {
    const s = sceneAt(1440);
    clickScene(s, s.layout.ovenX, s.ground - 30);
    s.gratin!.x = s.layout.wanderRight;
    resizeScene(s, stageOf(320));
    expect(s.gratin).not.toBeNull();
    expect(s.gratin!.x).toBeLessThanOrEqual(s.layout.wanderRight);
    expect(s.gratin!.x).toBeGreaterThanOrEqual(s.layout.wanderLeft);
  });

  it('pulls further ahead of them the whole way, then lets them catch up', () => {
    const s = sceneAt(1440);
    // Settled at his sides, and started from the far end of the room: created
    // they are placed beside wherever he was dropped, and a dash begun before
    // they have caught up measures the catching up rather than the dash. The
    // kitchen is in the middle of the room, so starting him anywhere near it
    // gives a dash too short to measure anything over.
    s.ciccio.x = s.layout.wanderRight;
    run(s, 700, steady);
    // Served rather than tapped: a tap sends him at the summoning pace, which
    // is faster again, and the gap then grows whatever the squirrels' own top
    // speed is. It is the ordinary dash this is about.
    serveGratin(s);
    runUntil(s, (x) => x.ciccio.phase === 'heading', 200);
    expect(s.ciccio.goal!.urgent).toBe(false);

    run(s, 20, steady);
    expect(dashingForFood(s)).toBe(true);
    const early = s.squirrels.map((q) => (s.ciccio.x - q.x) * s.ciccio.dir);

    // They are running too, not ambling. Well over twice what keeping up with
    // his walk costs them: at a fifth under his own pace neither he nor they
    // read as running, and the gap crept open a quarter of a unit a frame.
    const before = s.squirrels.map((q) => q.x);
    step(s, steady);
    s.squirrels.forEach((q, i) => {
      expect(Math.abs(q.x - before[i])).toBeGreaterThan(WALK_SPEED * 2);
    });

    // The gap *grows*. A fixed trailing distance reads as the walk with
    // everybody shifted along, which is exactly what a constant offset gave —
    // so what makes this true is that they may not travel as fast as he can.
    run(s, 50, steady);
    expect(dashingForFood(s)).toBe(true);
    s.squirrels.forEach((q, i) => {
      expect((s.ciccio.x - q.x) * s.ciccio.dir).toBeGreaterThan(early[i] + 20);
    });

    // And the moment he stops to eat they close back up, either side of him.
    runUntil(s, (x) => x.ciccio.phase === 'eating', 8000);
    run(s, 200, steady);
    const [left, right] = s.squirrels;
    expect(left.x).toBeLessThan(s.ciccio.x);
    expect(right.x).toBeGreaterThan(s.ciccio.x);
    for (const q of s.squirrels) {
      expect(Math.abs(q.x - s.ciccio.x)).toBeGreaterThan(FLANK_GAP - FLANK_SETTLED - 1);
    }
  });

  it('caps the steam rather than growing it for as long as the app is open', () => {
    const s = sceneAt(900);
    clickScene(s, s.layout.ovenX, s.ground - 30);
    for (let i = 0; i < 4000; i++) {
      step(s, eager);
      if (s.gratin) expect(s.gratin.steam.length).toBeLessThanOrEqual(MAX_STEAM);
      else clickScene(s, s.layout.ovenX, s.ground - 30);
    }
  });
});

// ---------------------------------------------------------------------------

/** Runs until he is settled on the named spot, or says it never happened. */
function settleOn(s: ReturnType<typeof sceneAt>, at: 'sofa' | 'bed', limit = 60000) {
  const rng = at === 'bed' ? sleepy : eager;
  // `at` names the seat from the moment the climb starts, so being *on* it is
  // the lift being finished.
  runUntil(s, (x) => x.ciccio.at === at && x.ciccio.lift >= 1, limit, rng);
}

describe('watching television', () => {
  it('comes on when it is clicked, and calls him over', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    expect(s.tv.on).toBe(true);

    settleOn(s, 'sofa');
    expect(s.ciccio.phase).toBe('sitting');
  });

  it('sits him down between the two of them, not on the end', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    settleOn(s, 'sofa');
    runUntil(s, (x) => x.squirrels.every((q) => q.at === 'sofa' && q.lift >= 1), 4000, eager);

    const [left, right] = s.squirrels;
    expect(left.x).toBeLessThan(s.ciccio.x);
    expect(right.x).toBeGreaterThan(s.ciccio.x);
    // The seat part of its height — one of them may already be off up the wall,
    // which `squirrelY` includes because that is where it is drawn.
    expect(squirrelY(s, left) + left.climb).toBe(s.ground - SEAT_HEIGHT.sofa * left.lift);
    expect(left.lift).toBe(1);
  });

  // Ticked only while he is seated, a television he never reaches never expires
  // and the sofa is where he lives from then on.
  it('turns itself off again even if he never gets there', () => {
    const s = sceneAt(1280);
    s.ciccio.x = s.layout.wanderLeft;
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    s.ciccio.goal = null;
    s.ciccio.phase = 'wandering';
    runUntil(s, (x) => !x.tv.on, 60000, steady);
  });

  // Derived from the time left, the way the lit window is: a zebra on a set
  // that is not about to go off is not a state the scene can reach, and there
  // is nothing to keep in step.
  it('turns the screen over to a zebra for the closing seconds', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    expect(s.tv.on).toBe(true);
    expect(showingZebra(s)).toBe(false);

    runUntil(s, (x) => showingZebra(x), 60000, steady);
    // And only at the end of it — a few seconds, not the whole programme.
    expect(s.tv.showLeft).toBeLessThan(300);

    runUntil(s, (x) => !x.tv.on, 4000, steady);
    expect(showingZebra(s)).toBe(false);
  });

  it('walks him to the sofa faster than he potters, but does not run him', () => {
    const s = sceneAt(1440);
    s.ciccio.x = s.layout.wanderLeft;
    // The rota's own errand, not a tap: taps get their own, quicker pace.
    s.tv.on = true;
    s.tv.showLeft = 100000;
    runUntil(s, (x) => x.ciccio.phase === 'heading', 400, steady);
    expect(s.ciccio.goal!.urgent).toBe(false);

    const before = s.ciccio.x;
    step(s, steady);
    const pace = Math.abs(s.ciccio.x - before);
    expect(pace).toBeGreaterThan(WALK_SPEED);
    expect(pace).toBeLessThan(RUN_SPEED);
  });

  it('gets him back off the sofa once the programme has finished', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    settleOn(s, 'sofa');
    runUntil(s, (x) => x.ciccio.at === 'floor', 60000, steady);
    expect(s.ciccio.phase).toBe('wandering');
  });

  // A stored `on` could outlive the room it belongs to, which is the price of
  // storing it rather than deriving it. It does not, and the reason is the
  // layout: there is a living room at every width. This is what says so — a
  // resize down to the narrowest window the app is opened at, still with a
  // sofa under the set that is on.
  it('always has a room for the set that is on, however narrow the window', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    settleOn(s, 'sofa');
    resizeScene(s, stageOf(320));

    expect(s.tv.on).toBe(true);
    expect(s.layout.loungeX - SOFA_WIDTH / 2).toBeGreaterThan(0);
    expect(s.layout.loungeX + SOFA_WIDTH / 2).toBeLessThanOrEqual(stageOf(320).width);
  });

  // Where the drawing puts a figure and where a tap looks for it are the same
  // number. A squirrel up the wall was hit-tested at floor level, so the one
  // interaction a stuck squirrel has had to be aimed at the empty floor beneath.
  // The set and a squirrel up the wall share the same stretch of wall, and the
  // set's box is the wider of the two — so the one interaction the whole rescue
  // has was answered by restarting the programme instead.
  it('answers a tap on a stuck squirrel rather than the set behind it', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    settleOn(s, 'sofa');
    s.tv.showLeft = 40000;

    const squirrel = s.squirrels[0];
    squirrel.x = s.layout.loungeX;
    squirrel.climb = CLIMB_MAX;
    squirrel.say = null;

    clickScene(s, squirrel.x, squirrelY(s, squirrel) - 20);
    expect(s.tv.showLeft).toBe(40000);
    expect(s.chatter).not.toBeNull();
  });

  it('finds a squirrel where it is drawn, not where its feet started', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    settleOn(s, 'sofa');
    const squirrel = s.squirrels[0];
    squirrel.climb = CLIMB_MAX;

    expect(hitsSquirrel(s, squirrel, squirrel.x, squirrelY(s, squirrel) - 10)).toBe(true);
    expect(hitsSquirrel(s, squirrel, squirrel.x, s.ground - 5)).toBe(false);
  });
});

describe('going to bed', () => {
  it('takes himself off to bed now and then, and gets up again', () => {
    const s = sceneAt(1280);
    settleOn(s, 'bed');
    expect(s.ciccio.phase).toBe('sleeping');
    runUntil(s, (x) => x.ciccio.at === 'floor', 60000, sleepy);
  });

  it('has them lie down either side of him', () => {
    const s = sceneAt(1280);
    settleOn(s, 'bed');
    runUntil(s, (x) => x.squirrels.every((q) => q.at === 'bed' && q.lift >= 1), 6000, sleepy);

    const [left, right] = s.squirrels;
    expect(left.x).toBeLessThan(s.ciccio.x);
    expect(right.x).toBeGreaterThan(s.ciccio.x);
    expect(right.lift).toBe(1);
    expect(squirrelY(s, right)).toBe(s.ground - SEAT_HEIGHT.bed);
  });
});

describe('getting on and off the furniture', () => {
  // The bird-teleport, in a room. Without frames that own the change of height,
  // he is on the rug the frame after he was on a cushion — and three animals
  // snap at once, on a food interrupt, which is the least predictable moment.
  it('never moves anybody vertically faster than they can climb', () => {
    const s = sceneAt(1280);
    let previous = [ciccioY(s), ...s.squirrels.map((q) => squirrelY(s, q))];
    for (let i = 0; i < 30000; i++) {
      step(s, eager);
      if (i % 400 === 0) clickScene(s, s.layout.ovenX, s.ground - 30);
      const now = [ciccioY(s), ...s.squirrels.map((q) => squirrelY(s, q))];
      now.forEach((y, j) =>
        expect(Math.abs(y - previous[j])).toBeLessThanOrEqual(MAX_CLIMB + 1e-9),
      );
      previous = now;
    }
  });

  // `wandering | wobbling | heading` implies he is on the floor. The only way
  // off a seat is `dismounting`, which owns the frames the height is given up
  // in, and the only way on is `mounting`.
  it('is only ever on furniture in a phase that means it', () => {
    const s = sceneAt(1280);
    for (let i = 0; i < 30000; i++) {
      step(s, eager);
      if (['wandering', 'wobbling', 'heading', 'eating'].includes(s.ciccio.phase)) {
        expect(s.ciccio.at).toBe('floor');
      }
    }
  });

  // The floor case is covered above, over every width. What is left to ask is
  // whether it still holds once they are *on* something — where their places
  // come from his seat rather than from his walk.
  it('keeps him between them on the furniture, not only on the floor', () => {
    const s = sceneAt(1280);
    let seated = 0;
    for (let i = 0; i < 30000; i++) {
      step(s, eager);
      if (s.ciccio.at === 'floor') continue;
      seated++;
      const [left, right] = s.squirrels;
      expect(left.x).toBeLessThan(s.ciccio.x);
      expect(right.x).toBeGreaterThan(s.ciccio.x);
    }
    // And that the question was actually asked.
    expect(seated).toBeGreaterThan(1000);
  });

  it('never leaves anybody on a spot the room does not have', () => {
    const s = sceneAt(1280);
    for (let i = 0; i < 4000; i++) {
      step(s, eager);
      if (i % 700 === 0) resizeScene(s, stageOf([320, 414, 900, 1440][(i / 700) % 4]));
      for (const at of [s.ciccio.at, ...s.squirrels.map((q) => q.at)]) {
        expect(['floor', 'sofa', 'bed']).toContain(at);
      }
    }
  });
});

describe('how his day divides', () => {
  // Measured over seeded days rather than asserted from the constants: the
  // split is set by half a dozen chances pulling against each other and no one
  // of them states it. This is also the only thing that would catch "he never
  // sleeps any more" after somebody tunes the oven.
  function day(seed: number) {
    const rng = seeded(seed);
    const s = createScene(stageOf(1280), rng);
    const tally = { about: 0, eating: 0, watching: 0, sleeping: 0 };
    const FRAMES = 90000;
    for (let i = 0; i < FRAMES; i++) {
      step(s, rng);
      if (s.ciccio.at === 'bed') tally.sleeping++;
      else if (s.ciccio.at === 'sofa') tally.watching++;
      else if (s.ciccio.phase === 'eating') tally.eating++;
      else tally.about++;
    }
    return Object.fromEntries(
      Object.entries(tally).map(([k, v]) => [k, Math.round((v / FRAMES) * 100)]),
    ) as Record<keyof typeof tally, number>;
  }

  // Bands, not numbers, and measured rather than chosen: over three seeded days
  // this comes out around 63-75% about the room, 2% with his head in a dish,
  // 16-25% in front of the television and 3-14% asleep. What the bands protect
  // is that none of the four ever goes to nothing — which is exactly what
  // happened when the oven was tuned to bake every 1400 frames and he spent the
  // whole day walking towards food he kept being interrupted for.
  it.each([1, 7, 99])('spends it about the room, eating, watching and asleep (seed %i)', (seed) => {
    const share = day(seed);
    expect(share.about).toBeGreaterThan(45);
    expect(share.about).toBeLessThan(88);
    expect(share.eating).toBeGreaterThanOrEqual(1);
    expect(share.watching).toBeGreaterThan(8);
    expect(share.watching).toBeLessThan(40);
    expect(share.sleeping).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------

describe('answering a tap on a thing', () => {
  // A tap that starts three animals walking across a wide room is a tap with a
  // second and a half of nothing happening where the finger was.
  it('starts turning the bed down the moment it is clicked', () => {
    const s = sceneAt(1440);
    expect(s.bed.turned).toBe(0);

    clickScene(s, s.layout.bedX, s.ground - 20);
    step(s, steady);
    expect(s.bed.turned).toBeGreaterThan(0);

    runUntil(s, (x) => x.bed.turned >= 0.99, 200, steady);
  });

  // Derived, not stored: a bed made up for nobody is not a state to reach.
  it('makes it up again once nobody is coming', () => {
    const s = sceneAt(1440);
    clickScene(s, s.layout.bedX, s.ground - 20);
    runUntil(s, (x) => x.bed.turned >= 0.99, 200, steady);

    s.ciccio.goal = null;
    s.ciccio.phase = 'wandering';
    s.ciccio.at = 'floor';
    runUntil(s, (x) => x.bed.turned <= 0.01, 200, steady);
  });

  it.each([
    ['the oven', (s: ReturnType<typeof sceneAt>) => [s.layout.ovenX, s.ground - 30] as const],
    ['the bed', (s: ReturnType<typeof sceneAt>) => [s.layout.bedX, s.ground - 20] as const],
    [
      'the television',
      (s: ReturnType<typeof sceneAt>) => [s.layout.loungeX, s.ground - TV_HANGS_AT - 10] as const,
    ],
  ])('drops whatever he was doing and sets off for %s', (_name, where) => {
    const s = sceneAt(1440);
    // Mid-dance, which is the phase least likely to give way on its own.
    tapCiccio(s);
    expect(s.ciccio.phase).toBe('wobbling');

    const [x, y] = where(s);
    clickScene(s, x, y);

    expect(s.ciccio.phase).toBe('heading');
    expect(s.ciccio.goal!.urgent).toBe(true);
    expect(s.ciccio.spin).toBe(0);
  });

  it('gets him off the furniture first rather than teleporting him down', () => {
    const s = sceneAt(1440);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    runUntil(s, (x) => x.ciccio.at === 'sofa' && x.ciccio.phase === 'sitting', 60000, eager);

    clickScene(s, s.layout.bedX, s.ground - 20);
    expect(s.ciccio.phase).toBe('dismounting');
    expect(s.ciccio.at).toBe('sofa');
  });

  it('answers a tap far faster than he would have got there on his own', () => {
    const summoned = sceneAt(1440);
    summoned.ciccio.x = summoned.layout.wanderLeft;
    clickScene(summoned, summoned.layout.loungeX, summoned.ground - TV_HANGS_AT - 10);
    const quick = runUntil(summoned, (x) => x.ciccio.at === 'sofa', 60000, steady);

    const strolled = sceneAt(1440);
    strolled.ciccio.x = strolled.layout.wanderLeft;
    strolled.tv.on = true;
    strolled.tv.showLeft = 100000;
    const slow = runUntil(strolled, (x) => x.ciccio.at === 'sofa', 60000, steady);

    expect(quick * 2).toBeLessThan(slow);
  });
});

describe('the round they speak in', () => {
  // "Susin! Ciccio Ciccio! Susin!" — one phrase in three voices, in that order.
  // Rolled as three independent chances they talked over each other and it was
  // never the phrase it is meant to be.
  it('goes left squirrel, then him, then right squirrel', () => {
    const s = sceneAt(1280);
    tapCiccio(s);

    // Recorded as each one *starts* speaking, so the order is the order they
    // took their turns rather than whoever happens to still have a bubble up.
    const heard: string[] = [];
    const speaking = [false, false, false];
    for (let i = 0; i < 400; i++) {
      step(s, steady);
      [s.squirrels[0], s.ciccio, s.squirrels[1]].forEach((who, j) => {
        const up = who.say !== null;
        if (up && !speaking[j]) heard.push(who.say!.line);
        speaking[j] = up;
      });
      if (heard.length === 3) break;
    }
    expect(heard).toEqual([SQUIRREL_CALL, CICCIO_CALL, SQUIRREL_CALL]);
  });

  it('leaves a gap between the three, rather than saying them at once', () => {
    const s = sceneAt(1280);
    tapCiccio(s);
    step(s, steady);
    expect(s.squirrels[0].say).not.toBeNull();
    expect(s.ciccio.say).toBeNull();
    expect(s.squirrels[1].say).toBeNull();
  });

  it('does not start a second round on top of the one going on', () => {
    const s = sceneAt(1280);
    tapCiccio(s);
    step(s, steady);
    const round = s.chatter;
    clickScene(s, s.squirrels[0].x, s.ground - 10);
    expect(s.chatter).toBe(round);
  });

  // His own, about something he has seen — not a greeting anybody answers.
  it('keeps the gratin line his alone', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.ovenX, s.ground - 30);
    expect(s.ciccio.say!.line).toBe(CICCIO_GRATIN);
    expect(s.squirrels.map((q) => q.say)).toEqual([null, null]);
  });
});

// ---------------------------------------------------------------------------

describe('the little blue cat', () => {
  // Measured, because "now and then" is exactly the sort of thing that is
  // quietly never: at 6400 frames between visits the first cat took nearly
  // three minutes to arrive, and the visit is one of the two best things in the
  // scene. Nobody watches a background for three minutes on the off-chance.
  it('calls within the first minute, and keeps calling', () => {
    const rng = seeded(3);
    const s = createScene(stageOf(1280), rng);
    let first = -1;
    let visits = 0;
    let had = false;
    // Fifty minutes at the rate the frame loop is throttled to.
    for (let i = 0; i < 120000; i++) {
      step(s, rng);
      if (s.cat && first < 0) first = i;
      if (s.cat && !had) visits++;
      had = s.cat !== null;
    }
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(60 * 40);
    expect(visits).toBeGreaterThan(10);
  });

  /** Runs until a cat has let itself in. */
  function withCat(width = 1280) {
    const s = sceneAt(width);
    runUntil(s, (x) => x.cat !== null, 60000, eager);
    return s;
  }

  it('lets itself in now and then, from one side or the other', () => {
    const sides = new Set<number>();
    for (const seed of [1, 4, 7, 12, 30]) {
      const rng = seeded(seed);
      const s = createScene(stageOf(1280), rng);
      for (let i = 0; i < 40000 && !s.cat; i++) step(s, rng);
      if (s.cat) sides.add(s.cat.from);
    }
    // Always from off-stage, and not always the same edge.
    expect(sides.size).toBe(2);
  });

  it('comes in from off the edge rather than appearing in the middle', () => {
    const s = withCat();
    expect(s.cat!.x < 0 || s.cat!.x > s.width).toBe(true);
  });

  it('freezes him and puts his spines up as it comes', () => {
    const s = withCat();
    expect(s.ciccio.phase).toBe('bristling');

    const where = s.ciccio.x;
    run(s, 40, steady);
    expect(s.ciccio.x).toBe(where);
    expect(s.ciccio.bristle).toBeGreaterThan(0);
    runUntil(s, (x) => x.ciccio.bristle >= 0.99, 400, steady);
  });

  it('walks up to him, meows, and only then is he let down', () => {
    const s = withCat();
    runUntil(s, (x) => x.cat!.phase === 'meowing', 4000, steady);
    expect(s.cat!.say!.line).toBe(CAT_CALL);
    expect(Math.abs(s.cat!.x - s.ciccio.x)).toBeLessThanOrEqual(CAT_NEAR + 2);

    // The spines only come down once it has spoken kindly to him.
    runUntil(s, (x) => x.ciccio.bristle <= 0.01, 4000, steady);
  });

  it('gives him a kiss once he has relaxed, and not before', () => {
    const s = withCat();
    runUntil(s, (x) => x.cat!.phase === 'kissing', 6000, steady);
    expect(s.ciccio.bristle).toBeLessThan(0.4);
    runUntil(s, (x) => x.hearts.length > 0, 60, steady);
  });

  it('sees itself out, and gives him his afternoon back', () => {
    const s = withCat();
    runUntil(s, (x) => x.cat === null, 20000, steady);
    // Back to his own business — whatever that turns out to be by then, since
    // an oven does not stop baking because a cat called.
    expect(s.ciccio.phase).not.toBe('bristling');
    runUntil(s, (x) => x.ciccio.bristle === 0, 200, steady);
  });

  it('never leaves two cats in the room at once', () => {
    const s = sceneAt(1280);
    let seen: unknown = null;
    for (let i = 0; i < 40000; i++) {
      step(s, eager);
      if (s.cat && seen && s.cat !== seen) {
        // A new cat is only allowed once the last one has gone.
        expect(seen).toBeNull();
      }
      seen = s.cat;
    }
  });

  it('caps the hearts rather than growing them for as long as the app is open', () => {
    const s = sceneAt(1280);
    for (let i = 0; i < 40000; i++) {
      step(s, eager);
      expect(s.hearts.length).toBeLessThanOrEqual(MAX_HEARTS);
    }
  });

  // He cannot be startled off a sofa he is sitting on, or out of a meal: the
  // cat only calls when he is up and about, which is the one state that has
  // somewhere sensible to go back to.
  // Sampled *before* the frame that lets it in, because by the end of that
  // frame he is already `bristling` at it: asked afterwards, the phase list has
  // to admit `bristling`, which every arrival satisfies whatever he was doing
  // beforehand. Dropping `at === 'floor'` from the guard then left it green
  // while a cat let itself in on a sleeping hedgehog and froze him in mid air
  // over the mattress.
  // Ticked on every frame it went as far as −1500 over a busy day, so the cat
  // walked in on the very frame he swallowed the last bite or stepped off the
  // sofa. It counts pottering, so it never goes below nought and there is
  // always a stretch of it between the last thing he did and the visit.
  it('counts the time he has free, rather than running down through his meals', () => {
    const s = sceneAt(1280);
    let least = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 40000; i++) {
      step(s, eager);
      least = Math.min(least, s.catNextIn);
    }
    expect(least).toBe(0);
  });

  it('does not call while he is eating, seated or asleep', () => {
    const s = sceneAt(1280);
    for (let i = 0; i < 40000; i++) {
      const before = { phase: s.ciccio.phase, at: s.ciccio.at, gratin: s.gratin, cat: s.cat };
      step(s, eager);
      // The frame it is *let in*, not any frame it is on its way over: it walks
      // the room in `arriving` with the timer still at nought, and by the
      // second of those he is already `bristling` at it.
      if (s.cat && !before.cat) {
        expect(before.at).toBe('floor');
        expect(['wandering', 'wobbling']).toContain(before.phase);
        expect(before.gratin).toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('one of them gets stuck up the wall', () => {
  /**
   * A climb that is left to run its course.
   *
   * `eager` rolls every chance there is, which now includes the other one
   * calling it back down — so it starts the climb with `eager` and then hands
   * over to `steady`, which rolls neither. There is no single value that starts
   * a climb without also cutting it short, since being called back is by design
   * the likelier of the two.
   */
  function leftToClimb(width = 1280) {
    const s = watching(width);
    runUntil(s, (x) => x.rescue !== null, 60000, eager);
    return s;
  }

  // The rescue is abandoned when they stop watching, but *coming down* has to
  // outlive the abandoning. Tapping the set while he is already on the sofa
  // takes him off it and puts him back on in 29 frames — half what a descent
  // from the top of the wall needs — so the programme resumed with both of
  // them left hanging beside the sofa, one upside down, no rescue to move them
  // and `followSquirrels` skipping anybody off the ground. They stayed there
  // until another rescue happened to pick them up, on average eleven minutes
  // later, and a recalled one moves only the climber so the second could hang
  // there for the life of the tab.
  it('brings them down even when the programme resumes half way through', () => {
    const s = leftToClimb();
    // All the way to the top, which is the height an interrupt cannot unwind.
    runUntil(s, (x) => x.squirrels.some((q) => q.headDown), 60000, steady);

    // The interrupt that is too short to finish the descent.
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    run(s, 400, steady);

    expect(s.rescue).toBeNull();
    for (const squirrel of s.squirrels) {
      expect(squirrel.climb).toBe(0);
      expect(squirrel.headDown).toBe(false);
    }
  });

  // And nobody starts one while either of them is still moving vertically.
  // Rolled on a squirrel still settling onto the cushion it added the wall to
  // that same frame — 1.7 units of sofa and 0.55 of wall at once, past what
  // either alone is allowed.
  it('waits until they are both sitting still before anybody climbs', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    for (let i = 0; i < 4000; i++) {
      step(s, eager);
      s.tv.showLeft = Number.MAX_SAFE_INTEGER;
      if (s.rescue) {
        for (const squirrel of s.squirrels) {
          expect(squirrel.lift).toBeGreaterThanOrEqual(1);
        }
        return;
      }
    }
    throw new Error('no rescue was ever started');
  });

  /** Sat in front of the television, which is the only time this happens. */
  function watching(width = 1280) {
    const s = sceneAt(width);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    runUntil(s, (x) => x.ciccio.phase === 'sitting', 60000, steady);
    s.tv.showLeft = Number.MAX_SAFE_INTEGER;
    return s;
  }

  it('only ever happens on the sofa', () => {
    const s = sceneAt(1280);
    for (let i = 0; i < 40000; i++) {
      step(s, eager);
      if (s.rescue) expect(s.ciccio.at).toBe('sofa');
    }
  });

  it('goes straight up, and stops at the top', () => {
    const s = leftToClimb();
    const climber = s.squirrels[s.rescue!.climber];
    const where = climber.x;

    runUntil(s, (x) => x.rescue!.phase === 'stuck', 4000, steady);
    expect(climber.climb).toBe(CLIMB_MAX);
    // Straight up: it does not wander sideways on the way.
    expect(climber.x).toBe(where);
  });

  // Derived from the wall rather than picked, so a taller squirrel or a lower
  // ceiling moves it instead of putting one through the roof.
  it('never climbs out through the top of the room', () => {
    const s = leftToClimb();
    for (let i = 0; i < 4000; i++) {
      step(s, steady);
      for (const q of s.squirrels) {
        expect(SEAT_HEIGHT[q.at] + q.climb + SQUIRREL_REACH).toBeLessThanOrEqual(WALL_HEIGHT);
      }
    }
  });

  // Every climb ran the whole drama before this: a lot of ceremony for
  // something meant to happen "sometimes", and only one version of it to see.
  it('sometimes gets it told off part way up, and it comes down by itself', () => {
    const s = watching();
    runUntil(s, (x) => x.rescue?.phase === 'recalled', 60000, eager);
    const rescue = s.rescue!;
    const climber = s.squirrels[rescue.climber];
    const other = s.squirrels[rescue.climber === 0 ? 1 : 0];

    // Told off on the way up rather than after being fetched down.
    expect(other.say!.line).toBe(SQUIRREL_SCOLD);
    expect(climber.climb).toBeGreaterThan(0);
    expect(climber.headDown).toBe(false);
    // And nobody has to go up after it.
    expect(other.climb).toBe(0);

    runUntil(s, (x) => x.rescue === null, 4000, steady);
    expect(other.climb).toBe(0);
    expect(climber.climb).toBe(0);
  });

  // Both endings have to be reachable, and neither so rare that watching the
  // scene only ever shows one of them. Measured over a long run rather than
  // asserted from the chance, which states neither.
  it('splits between the two endings rather than always doing the same one', () => {
    const rng = seeded(5);
    const s = createScene(stageOf(1280), rng);
    let recalled = 0;
    let stuck = 0;
    let seen: string | null = null;
    for (let i = 0; i < 300000; i++) {
      step(s, rng);
      // Keep something on the television, or they are rarely sat down at all.
      if (s.tv.on) s.tv.showLeft = 5000;
      if (!s.tv.on && s.ciccio.phase === 'wandering' && i % 900 === 0) {
        clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
      }
      const phase = s.rescue?.phase ?? null;
      if (phase === 'recalled' && seen !== 'recalled') recalled++;
      if (phase === 'stuck' && seen !== 'stuck') stuck++;
      seen = phase;
    }
    expect(recalled).toBeGreaterThan(20);
    expect(stuck).toBeGreaterThan(20);
    // Neither ending more than three times as common as the other.
    expect(Math.max(recalled, stuck)).toBeLessThan(Math.min(recalled, stuck) * 3);
  });

  // Bounded at both ends. Called back on the first frame it has not left the
  // sofa and the whole thing is a twitch; called back near the top it may as
  // well have finished, and it reads as the other one changing its mind.
  it('calls it back from the middle of the climb, not either end of it', () => {
    const s = sceneAt(1280);
    let seen = 0;
    let phase: string | null = null;
    for (let i = 0; i < 120000; i++) {
      step(s, eager);
      if (s.tv.on) s.tv.showLeft = 5000;
      if (s.rescue?.phase === 'recalled' && phase !== 'recalled') {
        const up = s.squirrels[s.rescue.climber].climb / CLIMB_MAX;
        expect(up).toBeGreaterThan(0.2);
        expect(up).toBeLessThan(0.85);
        seen++;
      }
      phase = s.rescue?.phase ?? null;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('turns head-down at the top and cannot get itself back', () => {
    const s = leftToClimb();
    runUntil(s, (x) => x.rescue?.phase === 'stuck', 12000, steady);
    const climber = s.squirrels[s.rescue!.climber];
    expect(climber.headDown).toBe(true);

    // It stays up there a good while before help arrives.
    run(s, 60, steady);
    expect(climber.climb).toBe(CLIMB_MAX);
  });

  it('sends the other one up to fetch it', () => {
    const s = leftToClimb();
    runUntil(s, (x) => x.rescue?.phase === 'fetching', 20000, steady);
    const rescue = s.rescue!;
    const other = s.squirrels[rescue.climber === 0 ? 1 : 0];
    runUntil(s, (x) => x.rescue!.phase === 'descending', 4000, steady);
    expect(other.climb).toBeGreaterThan(0);
  });

  // Stepped down at the same rate, the rescuer reaches the bottom first — it
  // started lower — and leaves him to finish on his own, which rather undoes
  // the point of anybody having gone up.
  it('brings it down with him rather than racing him to the bottom', () => {
    const s = leftToClimb();
    runUntil(s, (x) => x.rescue?.phase === 'descending', 30000, steady);
    const rescue = s.rescue!;
    const climber = s.squirrels[rescue.climber];
    const other = s.squirrels[rescue.climber === 0 ? 1 : 0];

    while (s.rescue?.phase === 'descending') {
      step(s, steady);
      // Always underneath him, and never already home while he is still up.
      expect(other.climb).toBeLessThan(climber.climb + 0.01);
      if (climber.climb > 0.5) expect(other.climb).toBeGreaterThan(0);
    }
    expect(climber.climb).toBe(0);
    expect(other.climb).toBe(0);
  });

  it('brings them both down and then tells it off', () => {
    const s = leftToClimb();
    runUntil(s, (x) => x.rescue?.phase === 'scolding', 30000, steady);
    const rescue = s.rescue!;
    const other = s.squirrels[rescue.climber === 0 ? 1 : 0];

    expect(s.squirrels.every((q) => q.climb === 0)).toBe(true);
    expect(s.squirrels[rescue.climber].headDown).toBe(false);
    expect(other.say!.line).toBe(SQUIRREL_SCOLD);
    expect(scolder(s)).toBe(other);
    expect(scoldingAt(s)).toBeGreaterThanOrEqual(0);

    runUntil(s, (x) => x.rescue === null, 4000, steady);
    expect(scoldingAt(s)).toBeNull();
  });

  // A squirrel left half way up a wall because a gratin came out would be up
  // there for the life of the tab.
  it('gets them down if he leaves the sofa half way through', () => {
    const s = leftToClimb();
    runUntil(s, (x) => x.rescue?.phase === 'stuck', 12000, steady);
    expect(s.squirrels[s.rescue!.climber].climb).toBeGreaterThan(0);

    // He is called away — the one thing that must not leave a squirrel up a
    // wall for the life of the tab.
    clickScene(s, s.layout.ovenX, s.ground - 30);
    runUntil(s, (x) => x.squirrels.every((q) => q.climb === 0), 4000, steady);
    expect(s.rescue).toBeNull();
    expect(s.squirrels.every((q) => !q.headDown)).toBe(true);
  });

  it('never leaves one of them hanging in the air for long once they are off it', () => {
    const s = sceneAt(1280);
    let airborneOff = 0;
    for (let i = 0; i < 40000; i++) {
      step(s, eager);
      const up = s.squirrels.some((q) => q.climb > 0);
      airborneOff = up && s.ciccio.at !== 'sofa' ? airborneOff + 1 : 0;
      // Long enough to climb down from the top and no longer.
      expect(airborneOff).toBeLessThan(200);
    }
  });
});

// ---------------------------------------------------------------------------

describe('interrupting a climb, and the room afterwards', () => {
  /** Frames into a climb, so an interrupt can be aimed at the middle of one. */
  function partWayOnto(s: ReturnType<typeof sceneAt>, at: 'sofa' | 'bed', frames: number) {
    const rng = at === 'bed' ? sleepy : eager;
    runUntil(s, (x) => x.ciccio.phase === 'mounting', 60000, rng);
    run(s, frames, steady);
    return s;
  }

  // A tap on him while he was seated set the phase and left `at` naming the
  // sofa, so he walked the room a cushion's height in the air — and since the
  // rota only starts something while he is on the floor, it never ran again.
  it('gets him off the sofa when he is tapped there, rather than stranding him', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
    settleOn(s, 'sofa');

    clickScene(s, s.ciccio.x, ciccioY(s) - 10);
    runUntil(s, (x) => x.ciccio.at === 'floor', 400, steady);
    expect(ciccioY(s)).toBe(s.ground);

    // And the rota is running again, which it could not while he was up there.
    s.tv.on = false;
    runUntil(s, (x) => x.ciccio.goal !== null || x.gratin !== null, 8000, steady);
  });

  // The other half of the same deadlock: neither gate will issue a goal while
  // one is already set, so an orphaned errand stops everything for ever.
  it('drops the errand it interrupts rather than orphaning it', () => {
    const s = sceneAt(1280);
    serveGratin(s);
    runUntil(s, (x) => x.ciccio.phase === 'heading', 400, steady);

    tapHimWhereHeStands(s);
    expect(s.ciccio.goal).toBeNull();

    // He notices it again once the dance is over, which he could not before.
    runUntil(s, (x) => x.ciccio.phase === 'eating', 20000, steady);
  });

  it.each([
    ['a mount', (s: ReturnType<typeof sceneAt>) => partWayOnto(s, 'sofa', 13)],
    [
      'a dismount',
      (s: ReturnType<typeof sceneAt>) => {
        clickScene(s, s.layout.loungeX, s.ground - TV_HANGS_AT - 10);
        settleOn(s, 'sofa');
        s.tv.on = false;
        s.ciccio.timer = 0;
        runUntil(s, (x) => x.ciccio.phase === 'dismounting', 4000, steady);
        run(s, 13, steady);
        return s;
      },
    ],
  ])('never drops him when a tap interrupts %s', (_name, setUp) => {
    const s = sceneAt(1280);
    setUp(s);
    const before = ciccioY(s);
    expect(Math.abs(before - s.ground)).toBeGreaterThan(1);

    clickScene(s, s.layout.bedX, s.ground - 20);
    for (let i = 0; i < 200; i++) {
      const was = ciccioY(s);
      step(s, steady);
      expect(Math.abs(ciccioY(s) - was)).toBeLessThanOrEqual(MAX_CLIMB + 1e-9);
    }
  });

  // A squirrel coming off the wall *and* off the sofa on the same frame moved
  // 2.8 units, well past what either alone is allowed. It comes down the wall
  // first now.
  it('never moves anybody vertically faster than they can climb, over a long day', () => {
    for (const seed of [1, 4, 9]) {
      const rng = seeded(seed);
      const s = createScene(stageOf(1280), rng);
      let previous = [ciccioY(s), ...s.squirrels.map((q) => squirrelY(s, q))];
      for (let i = 0; i < 60000; i++) {
        step(s, rng);
        const now = [ciccioY(s), ...s.squirrels.map((q) => squirrelY(s, q))];
        now.forEach((y, j) =>
          expect(Math.abs(y - previous[j])).toBeLessThanOrEqual(MAX_CLIMB + 1e-9),
        );
        previous = now;
      }
    }
  });

  it.each([
    ['the television', 'sit' as const, (s: ReturnType<typeof sceneAt>) => s.layout.loungeX],
    ['the bed', 'sleep' as const, (s: ReturnType<typeof sceneAt>) => s.layout.bedX],
  ])('re-aims an errand to %s when the room is resized under it', (_name, then, where) => {
    const s = sceneAt(1280);
    // A gratin out at the same time, which is what used to capture every goal.
    serveGratin(s);
    s.ciccio.goal = { x: where(s), then, urgent: true };
    s.ciccio.phase = 'heading';

    resizeScene(s, stageOf(400));
    expect(s.ciccio.goal!.then).toBe(then);
    expect(s.ciccio.goal!.x).toBe(where(s));

    runUntil(s, (x) => x.ciccio.at !== 'floor', 20000, steady);
    expect(s.ciccio.at).toBe(then === 'sit' ? 'sofa' : 'bed');
    expect(Math.abs(s.ciccio.x - where(s))).toBeLessThan(1);
  });

  it('lets an errand for a gratin that is gone go, rather than walking to nothing', () => {
    const s = sceneAt(1280);
    serveGratin(s);
    runUntil(s, (x) => x.ciccio.phase === 'heading', 400, steady);
    s.gratin = null;

    resizeScene(s, stageOf(900));
    expect(s.ciccio.goal).toBeNull();
  });
});
