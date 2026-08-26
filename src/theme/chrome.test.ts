// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  canvasPixelRatio,
  fitCanvas,
  watchPixelRatio,
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

describe('watching for a change of screen', () => {
  /** A stand-in for the browser's, with its listeners visible. */
  function queries(matches = true) {
    const made: { query: string; on: Array<() => void>; off: Array<() => void> }[] = [];
    vi.stubGlobal('matchMedia', (query: string) => {
      const entry = { query, on: [] as Array<() => void>, off: [] as Array<() => void> };
      made.push(entry);
      return {
        matches,
        media: query,
        addEventListener: (_: string, fn: () => void) => entry.on.push(fn),
        removeEventListener: (_: string, fn: () => void) => entry.off.push(fn),
      };
    });
    return made;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks about the ratio the screen is actually at', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const made = queries();

    watchPixelRatio(() => {});

    expect(made).toHaveLength(1);
    expect(made[0].query).toBe('(resolution: 2dppx)');
    expect(made[0].on).toHaveLength(1);
  });

  // The old query can never fire again once the ratio has moved, so a watch
  // that did not re-arm would notice one change of monitor and no more.
  it('calls back and re-arms at the new ratio', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    const made = queries();
    const heard = vi.fn();
    watchPixelRatio(heard);

    vi.stubGlobal('devicePixelRatio', 3);
    made[0].on[0]();

    expect(heard).toHaveBeenCalledTimes(1);
    expect(made).toHaveLength(2);
    expect(made[1].query).toBe('(resolution: 3dppx)');
    expect(made[0].off).toHaveLength(1);
  });

  it('lets go of the query it is holding', () => {
    const made = queries();

    watchPixelRatio(() => {})();

    expect(made[0].off).toHaveLength(1);
  });

  // A MediaQueryList only fires on a change of match state, so one born false
  // can never fire at all — the watch would be dead with no way to notice.
  // Fractional display scaling reports ratios that need not serialise back to
  // something equal to themselves.
  it('does not hold a query that does not match to begin with', () => {
    const made = queries(false);

    watchPixelRatio(() => {});

    expect(made[0].on).toHaveLength(0);
  });

  // Safari 13 hands back a real MediaQueryList carrying only `addListener`. The
  // throw would land in an effect body before its cleanup closure exists, and
  // React unmounts the whole app over a background.
  it('carries on where the screen cannot be watched at all', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, media: '', addListener: () => {} }));

    expect(() => watchPixelRatio(() => {})()).not.toThrow();
  });

  it('carries on where there is no matchMedia at all', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(() => watchPixelRatio(() => {})()).not.toThrow();
  });
});

describe('fitting to the viewport rather than to the window', () => {
  // `innerWidth` counts a classic scrollbar; the containing block of a
  // `position: fixed` box does not. Sizing the element from it over-constrains
  // left/right/width, CSS drops `right`, and the last strip of the background is
  // drawn off the side of the screen.
  it('takes its width from the viewport, not from innerWidth', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 768);
    // A 15px scrollbar: the document is narrower than the window.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1009);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    const canvas = document.createElement('canvas');
    const ctx = { setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;

    const fitted = fitCanvas(canvas, ctx);

    expect(fitted.width).toBe(1009);
    expect(canvas.style.width).toBe('1009px');
  });
});
