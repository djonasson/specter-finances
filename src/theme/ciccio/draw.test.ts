import { describe, it, expect } from 'vitest';
import { drawScene } from './draw';
import {
  createScene,
  say,
  step,
  clickScene,
  squirrelAsleep,
  startBaking,
  ovenBaking,
  CAT_CALL,
  CICCIO_CALL,
  SQUIRREL_CALL,
} from './scene';
import { sceneScale } from '../stage';

/**
 * What this file is for, and what it is deliberately not for.
 *
 * `draw.ts` is on CLAUDE.md's "still uncovered, and the reason" list because
 * canvas drawing has no assertable output — there is no way to ask whether a
 * hedgehog looks like a hedgehog. That exemption covers *what a scene draws*.
 *
 * It does not cover **whether something is drawn at all**, which is behaviour
 * and was a bug: the scene built, ticked and typed the cat's line all along and
 * nothing here ever drew it, so the meow the code calls "the point of the visit"
 * was silent for the whole of every visit — under a comment saying it was drawn.
 * A stubbed context records the text that reaches the canvas, which is enough to
 * ask that question of every speaker in the room.
 */
/** Steps until it happens, and says so rather than falling off the end. */
function runUntil(
  scene: ReturnType<typeof sceneAt>,
  done: (s: ReturnType<typeof sceneAt>) => boolean,
  limit: number,
  rng: () => number,
) {
  for (let i = 0; i < limit; i++) {
    if (done(scene)) return;
    step(scene, rng);
  }
  throw new Error(`never happened within ${limit} frames`);
}

function recordingContext() {
  const text: string[] = [];
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key === 'fillText') return (line: string) => void text.push(line);
      if (key === 'measureText') return () => ({ width: 40 });
      if (key === 'canvas') return { width: 1280, height: 700 };
      if (key === 'createLinearGradient')
        return () => ({ addColorStop: () => {} }) as unknown as CanvasGradient;
      if (key === 'setLineDash') return () => {};
      if (key in target) return target[key];
      // Everything else is a paint call: record the name and swallow it.
      return (...args: unknown[]) => {
        calls.push(key);
        return args.length === 0 ? undefined : undefined;
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, text, calls };
}

const sceneAt = (width: number) =>
  createScene(
    {
      width: width / sceneScale(width),
      height: 700 / sceneScale(width),
      ground: 600 / sceneScale(width),
    },
    () => 0.5,
  );

const drawn = (scene: ReturnType<typeof sceneAt>) => {
  const { ctx, text } = recordingContext();
  drawScene(ctx, scene, false, sceneScale(1280));
  return text;
};

describe('what reaches the canvas', () => {
  it('draws nothing anybody says while nobody is saying anything', () => {
    expect(drawn(sceneAt(1280))).toEqual([]);
  });

  it('draws his line when he has one', () => {
    const s = sceneAt(1280);
    say(s.ciccio, CICCIO_CALL);
    expect(drawn(s)).toContain(CICCIO_CALL);
  });

  it('draws a squirrel’s line when it has one', () => {
    const s = sceneAt(1280);
    say(s.squirrels[0], SQUIRREL_CALL);
    expect(drawn(s)).toContain(SQUIRREL_CALL);
  });

  // The one that was missing. Everything else about the visit worked.
  it('draws the cat’s meow, which is the whole point of its visit', () => {
    const s = sceneAt(1280);
    // Let a cat in the way the scene does, then run to the frame it speaks.
    s.catNextIn = 1;
    for (let i = 0; i < 4000 && s.cat?.say == null; i++) step(s, () => 0.5);
    expect(s.cat?.say?.line).toBe(CAT_CALL);
    expect(drawn(s)).toContain(CAT_CALL);
  });

  // Three sleepers, three sets of "z"s. The squirrels shared his bed and had
  // none of their own.
  it('draws a “z” for every one of them asleep in the bed, not just for him', () => {
    const s = sceneAt(1280);
    clickScene(s, s.layout.bedX, s.ground - 10);
    runUntil(
      s,
      (x) => x.squirrels.every((q) => squirrelAsleep(x, q)),
      20000,
      () => 0.0005,
    );
    expect(s.ciccio.phase).toBe('sleeping');
    // Two "z"s per sleeper, and there are three of them.
    expect(drawn(s).filter((line) => line === 'z')).toHaveLength(6);
  });

  it('draws no “z” at all while everybody is up', () => {
    const s = sceneAt(1280);
    expect(drawn(s).filter((line) => line === 'z')).toHaveLength(0);
  });

  // The oven's light and its dish are one fact, and a canvas is the only place
  // to see that they agree: a lit oven with an empty shelf would draw the glow
  // and nothing in it.
  it('paints nothing behind the oven door while nothing is baking', () => {
    const cold = recordingContext();
    const s = sceneAt(1280);
    expect(ovenBaking(s)).toBe(false);
    drawScene(cold.ctx, s, false, sceneScale(1280));

    const hot = recordingContext();
    startBaking(s);
    drawScene(hot.ctx, s, false, sceneScale(1280));

    // A lit oven with a dish in it is strictly more drawing than a dark one.
    expect(hot.calls.length).toBeGreaterThan(cold.calls.length);
  });

  // The trail's own loop was never once executed by the suite: every draw ran
  // with nothing in the air, because the oven test starts a bake and draws
  // without stepping, so no puff has been born yet.
  it('draws the scent once there is any in the air', () => {
    const s = sceneAt(1280);
    startBaking(s);
    runUntil(
      s,
      (x) => x.scent.length > 0,
      200,
      () => 0.5,
    );

    const bare = recordingContext();
    const withScent = recordingContext();
    const empty = sceneAt(1280);
    drawScene(bare.ctx, empty, false, sceneScale(1280));
    drawScene(withScent.ctx, s, false, sceneScale(1280));
    // Against a room with nothing in the air, not against zero: the sofa and
    // the cat draw curves of their own.
    const curves = (r: typeof bare) => r.calls.filter((c) => c === 'quadraticCurveTo').length;
    expect(curves(withScent)).toBe(curves(bare) + s.scent.length);
  });

  it('draws a whole frame in both colour schemes without throwing', () => {
    for (const dark of [true, false]) {
      const { ctx, calls } = recordingContext();
      const s = sceneAt(1280);
      drawScene(ctx, s, dark, sceneScale(1280));
      expect(calls.length).toBeGreaterThan(0);
    }
  });
});
