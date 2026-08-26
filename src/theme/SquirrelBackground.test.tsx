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
  // Spied rather than assigned: a raw assignment to the prototype is not
  // something `restoreAllMocks` can put back, and neither is a `spyOn` left
  // unrestored — both outlive the file and the next one sees them.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
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
  vi.restoreAllMocks();
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

  // The whole scene, drawn twice, on screens of different density.
  //
  // This is the regression the coordinate change exists to prevent: the scene
  // works in CSS pixels and its click handler compares the squirrel's own `x`
  // against a click's `clientX`, so reading the *buffer* as scene coordinates
  // puts him at twice his position and makes him impossible to rescue. Written
  // as bounds it could not catch that — things are legitimately thrown off
  // screen here, so any honest bound has a window of slack in it and a doubled
  // coordinate sits comfortably inside. Two renders have no slack at all: the
  // buffer may change, what is drawn on it may not.
  it('draws the same scene whatever the screen is made of', () => {
    const drawnAt = (ratio: number) => {
      vi.stubGlobal('devicePixelRatio', ratio);
      // The same scene both times: this one spawns from `Math.random`.
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      renderWithTheme(<SquirrelBackground />);
      runFrames(30);
      const placed = translations();
      cleanup();
      ctx.calls.length = 0;
      return placed;
    };

    const dense = drawnAt(2);
    const plain = drawnAt(1);

    expect(plain.length).toBeGreaterThan(0);
    expect(dense).toEqual(plain);
  });

  it('stands the squirrel in the middle of a window that changed size', () => {
    // Every acorn pinned to x = 0, so the only thing that can be drawn in the
    // middle is the squirrel. Left random, `resize` scatters twelve of them
    // across the window and several land in the middle on almost every run —
    // the assertion passed with the re-centring deleted.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderWithTheme(<SquirrelBackground />);
    resizeTo(400, 700);
    runFrames(1);

    const middle = translations().filter(([x]) => Math.abs(x - 200) < 60);
    expect(middle.length).toBeGreaterThan(0);
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

describe('not refitting for nothing', () => {
  // Refitting reallocates and zeroes a buffer four times the old size, puts the
  // squirrel back in the middle of the screen and restarts every falling acorn.
  // A mobile URL-bar collapse fires `resize` dozens of times a scroll.
  it('leaves the scene alone when nothing about the window changed', () => {
    renderWithTheme(<SquirrelBackground />);
    const canvas = document.querySelector('canvas')!;
    canvas.width = 1;

    resizeTo(window.innerWidth, window.innerHeight);

    expect(canvas.width).toBe(1);
  });

  it('still leaves the scene alone when there is a scrollbar', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1009);
    // A viewport height of its own, not `innerHeight` again: the guard has two
    // terms, and on iOS it is the height one that differs for the whole of a URL
    // bar collapse — the case the guard exists for.
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(700);
    renderWithTheme(<SquirrelBackground />);
    const canvas = document.querySelector('canvas')!;
    canvas.width = 1;

    resizeTo(1024, 768);

    expect(canvas.width).toBe(1);
  });

  it('refits when the ratio changes without the window changing', () => {
    // Only the resolution query: Mantine asks the same API about the colour
    // scheme, so the first listener registered is not necessarily this one's.
    const listeners: Array<() => void> = [];
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: (_: string, fn: () => void) => {
        if (query.includes('resolution')) listeners.push(fn);
      },
      removeEventListener: () => {},
    }));
    vi.stubGlobal('devicePixelRatio', 1);
    renderWithTheme(<SquirrelBackground />);
    const canvas = document.querySelector('canvas')!;
    expect(canvas.width).toBe(window.innerWidth);

    vi.stubGlobal('devicePixelRatio', 2);
    act(() => listeners[0]());

    expect(canvas.width).toBe(window.innerWidth * 2);
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
