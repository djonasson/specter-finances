// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithTheme, resizeTo } from '../test-utils';
import { SquirrelBackground } from './SquirrelBackground';

// This scene predates the split that gave Cello a pure `scene.ts`: it holds
// every acorn, icicle and mood inside one `useEffect` closure, so none of it can
// be read directly. What *is* observable is what it asks the canvas to do, so
// these tests record the drawing calls and assert on those.
//
// The contract they pin is the coordinate space. Everything here is positioned
// against the window in CSS pixels — the squirrel's own position is compared
// against `clientX` on a click, and the ground is drawn across the width — so
// whatever the canvas buffer is sized in, the drawing has to keep arriving in
// those units.

/** Every call the scene makes, in order, with its arguments. */
type Call = { name: string; args: unknown[] };

function recordingContext() {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args });
    };
  const ctx = {
    calls,
    measureText: (text: string) => ({ width: text.length * 6 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D & { calls: Call[] };

  for (const name of [
    'arc',
    'beginPath',
    'bezierCurveTo',
    'clearRect',
    'clip',
    'closePath',
    'ellipse',
    'fill',
    'fillRect',
    'fillText',
    'lineTo',
    'moveTo',
    'restore',
    'rotate',
    'roundRect',
    'save',
    'scale',
    'setTransform',
    'stroke',
    'translate',
  ]) {
    (ctx as unknown as Record<string, unknown>)[name] = record(name);
  }
  return ctx;
}

let ctx: CanvasRenderingContext2D & { calls: Call[] };

beforeEach(() => {
  ctx = recordingContext();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
  // jsdom has no Path2D, and the tail is built out of one.
  vi.stubGlobal(
    'Path2D',
    class {
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      ellipse() {}
      closePath() {}
    },
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Drives the frame loop by hand.
 *
 * The scene throttles itself to ~40fps off the timestamp it is handed, so the
 * times step far enough apart that every call actually draws.
 */
function runFrames(count: number) {
  for (let i = 0; i < count; i++) {
    const frame = vi.mocked(requestAnimationFrame).mock.calls.at(-1)![0];
    act(() => frame((i + 1) * 30));
  }
}

/** Everything the scene translated to, which is where it put its figures. */
function translations() {
  return ctx.calls.filter((call) => call.name === 'translate').map((call) => call.args as number[]);
}

describe('covering the window', () => {
  it("clears the whole window before each frame, in the window's own units", () => {
    renderWithTheme(<SquirrelBackground />);
    runFrames(1);

    const cleared = ctx.calls.filter((call) => call.name === 'clearRect');
    expect(cleared.length).toBeGreaterThan(0);
    expect(cleared[0].args).toEqual([0, 0, window.innerWidth, window.innerHeight]);
  });

  it('draws the ground the full width of the window', () => {
    renderWithTheme(<SquirrelBackground />);
    runFrames(1);

    const acrossTheBottom = ctx.calls.some(
      (call) =>
        call.name === 'lineTo' &&
        (call.args as number[])[0] === window.innerWidth &&
        (call.args as number[])[1] === window.innerHeight,
    );
    expect(acrossTheBottom).toBe(true);
  });

  // Its position is compared against a click's `clientX`, so a squirrel drawn
  // anywhere but the window's own coordinates is a squirrel nobody can rescue.
  it('keeps everything it draws inside the window', () => {
    renderWithTheme(<SquirrelBackground />);
    runFrames(40);

    const placed = translations();
    expect(placed.length).toBeGreaterThan(0);
    for (const [x, y] of placed) {
      expect(x).toBeGreaterThanOrEqual(-window.innerWidth);
      expect(x).toBeLessThanOrEqual(window.innerWidth * 2);
      expect(y).toBeLessThanOrEqual(window.innerHeight * 2);
    }
  });

  it('stands the squirrel in the middle of a window that changed size', () => {
    renderWithTheme(<SquirrelBackground />);
    resizeTo(400, 700);
    runFrames(1);

    // Nothing else is drawn near the middle of the floor on the first frame
    // after a resize, which is where `resize` puts him.
    const middle = translations().some(([x]) => Math.abs(x - 200) < 60);
    expect(middle).toBe(true);
  });
});

describe("drawing at the screen's own resolution", () => {
  it("gives the buffer the screen's pixels and the element the window's", () => {
    vi.stubGlobal('devicePixelRatio', 2);
    renderWithTheme(<SquirrelBackground />);

    const canvas = document.querySelector('canvas')!;
    expect(canvas.width).toBe(window.innerWidth * 2);
    expect(canvas.height).toBe(window.innerHeight * 2);
    expect(canvas.style.width).toBe(`${window.innerWidth}px`);
    expect(canvas.style.height).toBe(`${window.innerHeight}px`);
  });

  // Which is what lets every one of the tests above stay written in CSS pixels:
  // the scene is unchanged, the buffer under it is denser.
  it("scales the context so the scene keeps drawing in the window's units", () => {
    vi.stubGlobal('devicePixelRatio', 2);
    renderWithTheme(<SquirrelBackground />);
    runFrames(1);

    expect(ctx.calls.some((call) => call.name === 'setTransform')).toBe(true);
    const cleared = ctx.calls.filter((call) => call.name === 'clearRect');
    expect(cleared[0].args).toEqual([0, 0, window.innerWidth, window.innerHeight]);
  });
});

describe('letting go', () => {
  it('stops the frame loop and drops its listeners when it goes away', () => {
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderWithTheme(<SquirrelBackground />);
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('click', expect.any(Function));
  });
});
