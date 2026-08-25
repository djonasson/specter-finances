// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  canvasPixelRatio,
  fitCanvas,
  FOOTER_HEIGHT,
  footerHeight,
  MAX_PIXEL_RATIO,
} from './chrome';

afterEach(() => {
  document.body.replaceChildren();
});

function mountFooter(height: number | null) {
  const footer = document.createElement('div');
  footer.className = 'mantine-AppShell-footer';
  if (height !== null) {
    footer.getBoundingClientRect = () => ({ height }) as DOMRect;
  }
  document.body.append(footer);
}

// A scene that draws over the app stands on the footer, and the floor that masks
// it is positioned from the same edge. Getting this number wrong does not throw
// — it silently puts the scene's ground behind the navigation bar.

describe('finding the footer', () => {
  it('measures the footer the layout actually rendered', () => {
    mountFooter(72);
    expect(footerHeight()).toBe(72);
  });

  it('falls back to the configured height when there is no footer at all', () => {
    // The sign-in screen renders no AppShell.
    expect(footerHeight()).toBe(FOOTER_HEIGHT);
  });

  // jsdom reports zero, and so does a real browser before first layout. Taken at
  // face value it drops the scene's ground to the very bottom of the window.
  it('falls back when the footer is there but has not been laid out yet', () => {
    mountFooter(0);
    expect(footerHeight()).toBe(FOOTER_HEIGHT);
  });
});

describe('fitting a background canvas to the screen', () => {
  function canvasAndContext() {
    const canvas = document.createElement('canvas');
    const ctx = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
    return { canvas, ctx };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives the buffer the screen's pixels and the element the window's", () => {
    vi.stubGlobal('devicePixelRatio', 2);
    vi.stubGlobal('innerWidth', 400);
    vi.stubGlobal('innerHeight', 700);
    const { canvas, ctx } = canvasAndContext();

    const fitted = fitCanvas(canvas, ctx);

    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(1400);
    // Without this the element lays out at its *attribute* size, which in device
    // pixels is wider than the window it is supposed to cover.
    expect(canvas.style.width).toBe('400px');
    expect(canvas.style.height).toBe('700px');
    expect(fitted).toEqual({ width: 400, height: 700, ratio: 2 });
  });

  // So that everything drawn afterwards keeps working in CSS pixels and no
  // background has to know the buffer is denser than it is.
  it('scales the context by the ratio it used', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { canvas, ctx } = canvasAndContext();

    fitCanvas(canvas, ctx);

    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  // The buffer covers the whole viewport and is repainted for as long as the app
  // is open, so its cost grows with the square of this.
  it('stops following the device past the cap', () => {
    vi.stubGlobal('devicePixelRatio', 4);
    expect(canvasPixelRatio()).toBe(MAX_PIXEL_RATIO);
  });

  it('draws at one on a screen that reports no ratio at all', () => {
    vi.stubGlobal('devicePixelRatio', undefined);
    expect(canvasPixelRatio()).toBe(1);
  });
});
