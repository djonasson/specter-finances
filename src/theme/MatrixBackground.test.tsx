// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { resizeTo } from '../test-utils';
import { MatrixBackground } from './MatrixBackground';

// Rain, and nothing else: there is no state here worth asserting on beyond
// where it is drawn. What these do pin is the coordinate space — the buffer is
// in the screen's pixels and everything drawn on it is in the window's, which
// is the one thing about this file that can be wrong without anything failing.

type Call = { name: string; args: unknown[] };

function recordingContext() {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args });
    };
  const ctx = { calls } as unknown as CanvasRenderingContext2D & { calls: Call[] };
  for (const name of ['fillRect', 'fillText', 'setTransform']) {
    (ctx as unknown as Record<string, unknown>)[name] = record(name);
  }
  return ctx;
}

let ctx: CanvasRenderingContext2D & { calls: Call[] };

beforeEach(() => {
  ctx = recordingContext();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
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

function runFrame(at = 1000) {
  const frame = vi.mocked(requestAnimationFrame).mock.calls.at(-1)![0];
  act(() => frame(at));
}

describe("drawing at the screen's own resolution", () => {
  it("gives the buffer the screen's pixels and the element the window's", () => {
    vi.stubGlobal('devicePixelRatio', 2);
    render(<MatrixBackground speed={5} />);

    const canvas = document.querySelector('canvas')!;
    expect(canvas.width).toBe(window.innerWidth * 2);
    expect(canvas.height).toBe(window.innerHeight * 2);
    expect(canvas.style.width).toBe(`${window.innerWidth}px`);
    expect(canvas.style.height).toBe(`${window.innerHeight}px`);
    expect(ctx.calls.some((call) => call.name === 'setTransform')).toBe(true);
  });

  // The fade that leaves the trails behind has to cover the window exactly: over
  // a denser buffer it would clear a corner of the screen and leave the rest to
  // smear.
  it("fades the whole window each frame, in the window's own units", () => {
    vi.stubGlobal('devicePixelRatio', 2);
    render(<MatrixBackground speed={5} />);
    runFrame();

    const fades = ctx.calls.filter((call) => call.name === 'fillRect');
    expect(fades.length).toBeGreaterThan(0);
    expect(fades[0].args).toEqual([0, 0, window.innerWidth, window.innerHeight]);
  });

  it('fills the window with columns rather than a fraction of it', () => {
    render(<MatrixBackground speed={5} />);
    runFrame();

    const xs = ctx.calls
      .filter((call) => call.name === 'fillText')
      .map((call) => (call.args as [string, number, number])[1]);
    expect(xs.length).toBeGreaterThan(0);
    // The rightmost column starts within one character of the window's edge.
    expect(Math.max(...xs)).toBeGreaterThan(window.innerWidth - 28);
    expect(Math.max(...xs)).toBeLessThanOrEqual(window.innerWidth);
  });

  it('re-columns for a window that changed size', () => {
    render(<MatrixBackground speed={5} />);
    resizeTo(400, 700);
    runFrame();

    const xs = ctx.calls
      .filter((call) => call.name === 'fillText')
      .map((call) => (call.args as [string, number, number])[1]);
    expect(Math.max(...xs)).toBeLessThanOrEqual(400);
    expect(Math.max(...xs)).toBeGreaterThan(400 - 28);
  });
});

describe('not refitting for nothing', () => {
  // Mobile browsers fire `resize` dozens of times as the URL bar collapses, with
  // the same numbers each time. Refitting reallocates and zeroes the buffer —
  // four times the bytes now it is in device pixels — and re-randomises every
  // drop, so the rain visibly restarts.
  it('leaves the buffer alone when nothing about the window changed', () => {
    render(<MatrixBackground speed={5} />);
    const canvas = document.querySelector('canvas')!;
    canvas.width = 1;

    resizeTo(window.innerWidth, window.innerHeight);

    expect(canvas.width).toBe(1);
  });

  it('does refit when the window really did change', () => {
    render(<MatrixBackground speed={5} />);

    resizeTo(400, 700);

    expect(document.querySelector('canvas')!.width).toBe(400 * Math.min(devicePixelRatio || 1, 2));
  });
});

describe('letting go', () => {
  it('stops the frame loop and drops its listener when it goes away', () => {
    const removeWindow = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<MatrixBackground speed={5} />);
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
