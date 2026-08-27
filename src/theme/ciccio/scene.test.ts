import { describe, it, expect } from 'vitest';
import {
  createScene,
  resizeScene,
  layoutFor,
  ciccioFloor,
  ciccioY,
  squirrelY,
  SCENE_REACH,
  SEAT_HEIGHT,
  MIN_WANDER,
  FLANK_GAP,
  OVEN_WIDTH,
  BED_WIDTH,
  SOFA_WIDTH,
  TV_WIDTH,
} from './scene';
import { sceneScale } from '../stage';

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

    // Left to right: the oven, then the bed against the back, then the sofa
    // with the television beyond it. Nothing may leave the stage on either
    // side — a click target off the edge is a dead feature, and the oven and
    // the television are two of the four things anybody can click.
    expect(l.ovenX - OVEN_WIDTH / 2).toBeGreaterThanOrEqual(0);
    expect(l.tvX + TV_WIDTH / 2).toBeLessThanOrEqual(stage.width);
    expect(l.ovenX).toBeLessThan(l.bedX);
    expect(l.bedX).toBeLessThan(l.sofaX);
    expect(l.sofaX).toBeLessThan(l.tvX);
  });

  it.each(WIDTHS)('never lets the sofa and the television overlap at %ipx', (width) => {
    const l = layoutFor(stageOf(width).width);
    expect(l.sofaX + SOFA_WIDTH / 2).toBeLessThanOrEqual(l.tvX - TV_WIDTH / 2);
  });

  // The whole reason there is no `bed: Bed | null`. The bed stands against the
  // back *inside* his walk rather than competing with it, so there is no width
  // at which it has to be given up — and a null arm that can never be taken is
  // dead weight in `resizeScene`, in the drawing and in every reader for ever.
  it.each(WIDTHS)('keeps the bed inside his walk at %ipx, so it never has to go', (width) => {
    const l = layoutFor(stageOf(width).width);
    expect(l.bedX - BED_WIDTH / 2).toBeGreaterThanOrEqual(l.wanderLeft - BED_WIDTH);
    expect(l.bedX).toBeGreaterThan(l.wanderLeft);
    expect(l.bedX).toBeLessThan(l.wanderRight);
  });

  it.each(WIDTHS)('leaves him a walk worth walking at %ipx, flanks included', (width) => {
    const l = layoutFor(stageOf(width).width);
    expect(l.wanderRight - l.wanderLeft).toBeGreaterThanOrEqual(MIN_WANDER);
  });

  // He is between them by layout, not by a clamp fighting the layout every
  // frame: his range is inset by a flank on each side, so a squirrel always has
  // somewhere to stand that is still inside the room.
  it.each(WIDTHS)('insets his range so a squirrel always has room beside him at %ipx', (width) => {
    const stage = stageOf(width);
    const l = layoutFor(stage.width);
    expect(l.wanderLeft - FLANK_GAP).toBeGreaterThan(0);
    expect(l.wanderRight + FLANK_GAP).toBeLessThan(stage.width);
  });

  it('gives a wider window a wider walk, rather than bigger furniture', () => {
    const narrow = layoutFor(stageOf(360).width);
    const wide = layoutFor(stageOf(1440).width);
    expect(wide.wanderRight - wide.wanderLeft).toBeGreaterThan(
      narrow.wanderRight - narrow.wanderLeft,
    );
    // The oven is the same size in scene units at both: the scene is drawn
    // smaller on a phone, never laid out differently.
    expect(wide.ovenX).toBe(narrow.ovenX);
  });
});

describe('the band the room asks the app to reserve', () => {
  it('covers the tallest thing standing in the room, at every width', () => {
    for (const width of WIDTHS) {
      expect(ciccioFloor(width)).toBeGreaterThanOrEqual(SCENE_REACH * sceneScale(width));
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
    s.ciccio.x = s.layout.sofaX;
    resizeScene(s, stageOf(360));

    expect(s.ciccio.at).toBe('sofa');
    expect(s.ciccio.x).toBe(s.layout.sofaX);
    expect(ciccioY(s)).toBe(s.ground - SEAT_HEIGHT.sofa);
  });

  it('moves the ground everyone stands on, not only the walls', () => {
    const s = sceneAt(900);
    resizeScene(s, { width: 900, height: 400, ground: 300 });
    expect(s.ground).toBe(300);
    expect(ciccioY(s)).toBe(300);
  });
});
