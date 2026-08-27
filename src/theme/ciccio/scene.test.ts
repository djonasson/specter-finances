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
  SQUIRREL_CALL,
  step,
  flankX,
  MIN_FLANK,
  layoutFor,
  ciccioFloor,
  ciccioY,
  squirrelY,
  SCENE_REACH,
  SEAT_HEIGHT,
  MIN_WANDER,
  FLANK_GAP,
  OVEN_WIDTH,
  OVEN_HOOD_TOP,
  BED_WIDTH,
  BED_HEAD,
  SOFA_WIDTH,
  SOFA_BACK,
  TV_WIDTH,
  TV_PANEL,
  TV_HANGS_AT,
  WALL_HEIGHT,
} from './scene';
import { sceneScale } from '../stage';
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
    for (const height of [OVEN_HOOD_TOP, BED_HEAD, SOFA_BACK, TV_HANGS_AT + TV_PANEL]) {
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

  // The drawing takes insets off this — a trim inside a border inside the rug —
  // and a canvas arc with a negative radius throws, which inside the frame loop
  // means the scene stops for the life of the tab. `layoutFor` floors it, so
  // there is no guard in `draw.ts` to go stale; this is what says so.
  it.each(WIDTHS)('never hands the drawing a rug too small to inset at %ipx', (width) => {
    expect(layoutFor(stageOf(width).width).rugWidth).toBeGreaterThanOrEqual(90);
  });

  it('gives a wider window a wider walk, rather than bigger furniture', () => {
    const narrow = layoutFor(stageOf(360).width);
    const wide = layoutFor(stageOf(1440).width);
    expect(wide.wanderRight - wide.wanderLeft).toBeGreaterThan(
      narrow.wanderRight - narrow.wanderLeft,
    );
    // The bed and the kitchen are the same size in scene units at both: the
    // scene is drawn smaller on a phone, never laid out differently.
    expect(wide.bedX).toBe(narrow.bedX);
    expect(wide.ovenX).toBe(narrow.ovenX);
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

  it('takes its reach from the furniture, so a piece that grows is counted', () => {
    // Every piece, and anybody sitting on anything, is inside the reach. This
    // is the assertion that goes red when a new piece is added to the room and
    // not to the table the reach is measured from.
    const tallest = Math.max(...Object.values(SEAT_HEIGHT));
    expect(SCENE_REACH).toBeGreaterThanOrEqual(tallest);
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
    s.ciccio.at = 'sofa';
    expect(ciccioY(s)).toBe(s.ground - SEAT_HEIGHT.sofa);
    s.ciccio.at = 'bed';
    expect(ciccioY(s)).toBe(s.ground - SEAT_HEIGHT.bed);
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
    s.ciccio.x = s.layout.loungeX;
    resizeScene(s, stageOf(360));

    expect(s.ciccio.at).toBe('sofa');
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

const steady = () => 0.5;
/** Rolls every chance offered, so a turn is taken wherever one is available. */
const eager = () => 0;

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
    const s = sceneAt(900);
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
  it('never lets him out from between them, on any window, ever', () => {
    for (const width of WIDTHS) {
      const s = sceneAt(width);
      for (let i = 0; i < 3000; i++) {
        step(s, eager);
        const [left, right] = s.squirrels;
        expect(left.x).toBeLessThanOrEqual(s.ciccio.x - MIN_FLANK);
        expect(right.x).toBeGreaterThanOrEqual(s.ciccio.x + MIN_FLANK);
      }
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
    const s = sceneAt(900);
    run(s, 400, steady);
    for (let i = 0; i < 2000; i++) {
      step(s, steady);
      for (const q of s.squirrels) {
        const gap = Math.abs(q.x - s.ciccio.x);
        expect(gap).toBeGreaterThanOrEqual(MIN_FLANK);
        expect(gap).toBeLessThanOrEqual(FLANK_GAP + 2);
      }
    }
  });

  // The max-step invariant, and the assertion that will still be here when
  // there is furniture to climb: nobody in this scene may cover ground in one
  // frame that they should have taken several to cover.
  it('moves nobody further in a frame than they can walk', () => {
    const s = sceneAt(1440);
    let previous = s.squirrels.map((q) => q.x);
    for (let i = 0; i < 4000; i++) {
      step(s, eager);
      const now = s.squirrels.map((q) => q.x);
      now.forEach((x, j) => expect(Math.abs(x - previous[j])).toBeLessThanOrEqual(1));
      previous = now;
    }
  });

  // Nobody has climbed on anything yet, but the height an animal is drawn at is
  // owned by its spot from the first frame — so the day a sofa is added, a
  // hedgehog cannot arrive on it a whole cushion's height in one frame.
  it('moves nobody vertically while everyone is on the floor', () => {
    const s = sceneAt(900);
    for (let i = 0; i < 1500; i++) {
      step(s, eager);
      expect(ciccioY(s)).toBe(s.ground);
      for (const q of s.squirrels) expect(squirrelY(s, q)).toBe(s.ground);
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
    clickScene(s, s.ciccio.x, s.ground - 10);
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
      clickScene(s, s.ciccio.x, s.ground - 10);
      s.ciccio.spin = (start / 40) * Math.PI * 2;
      expect(() => runUntil(s, (x) => x.ciccio.phase !== 'wobbling', 5000)).not.toThrow();
    }
  });

  it('stays on the spot, rather than wandering off mid-spin', () => {
    const s = sceneAt(900);
    const where = s.ciccio.x;
    clickScene(s, s.ciccio.x, s.ground - 10);
    run(s, 20, steady);
    expect(s.ciccio.phase).toBe('wobbling');
    expect(s.ciccio.x).toBe(where);
  });

  it('never lifts him off the floor while he turns', () => {
    const s = sceneAt(900);
    clickScene(s, s.ciccio.x, s.ground - 10);
    for (let i = 0; i < 200; i++) {
      step(s, steady);
      expect(ciccioY(s)).toBe(s.ground);
      expect(s.ciccio.at).toBe('floor');
    }
  });

  it('refuses a second dance while the first is still going', () => {
    const s = sceneAt(900);
    clickScene(s, s.ciccio.x, s.ground - 10);
    run(s, 10, steady);
    const spin = s.ciccio.spin;
    clickScene(s, s.ciccio.x, s.ground - 10);
    expect(s.ciccio.spin).toBe(spin);
  });

  // Drawn about a horizontal scale, he passes through nothing at all twice a
  // turn and blinks out. He is a round animal: end-on he is still a blob.
  it('never draws him down to a sliver as he comes edge-on', () => {
    const s = sceneAt(900);
    clickScene(s, s.ciccio.x, s.ground - 10);
    for (let i = 0; i < 400; i++) {
      step(s, steady);
      expect(Math.abs(ciccioFacing(s))).toBeGreaterThanOrEqual(CICCIO_NARROWEST);
    }
  });

  it('turns him the whole way round, showing both sides of him', () => {
    const s = sceneAt(900);
    s.ciccio.facing = 1;
    clickScene(s, s.ciccio.x, s.ground - 10);
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
    clickScene(s, s.ciccio.x, s.ground - 10);
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
