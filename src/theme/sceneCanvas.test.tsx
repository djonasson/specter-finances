// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMantineColorScheme } from '@mantine/core';
import { renderWithTheme, resizeTo } from '../test-utils';
import { SceneCanvas } from './sceneCanvas.tsx';
import type { SceneSpec } from './sceneCanvas';
import { sceneScale, GROUND_ABOVE_FOOTER } from './stage';
import type { SceneSize } from './stage';
import { footerHeight, MAX_PIXEL_RATIO } from './chrome';

/**
 * The wiring every canvas scene runs on, tested against a scene that does
 * nothing.
 *
 * It used to be covered through the cello's own test file, which was where it
 * lived before it was shared. That left one scene owning the contract of a
 * module three of them depend on: retire that scene and the coverage goes with
 * it, a mutation in `sceneCanvas.ts` reports as a cello failure, and every new
 * background copies a handful of the same wiring assertions — which is exactly
 * the "one of the copies goes quietly stale" the extraction exists to prevent.
 *
 * A fake spec is the point. What is under test is the canvas, the frame loop
 * and the stage, none of which should need a hedgehog to demonstrate.
 */

interface Fake {
  built: number;
}

type FakeSpec = Omit<SceneSpec<Fake>, 'isDark'>;

let context2d: CanvasRenderingContext2D;
let spec: {
  [K in keyof FakeSpec]-?: ReturnType<typeof vi.fn<NonNullable<FakeSpec[K]>>>;
};

const makeSpec = () => ({
  createScene: vi.fn<NonNullable<FakeSpec['createScene']>>(() => ({ built: 1 })),
  resizeScene: vi.fn<NonNullable<FakeSpec['resizeScene']>>(),
  step: vi.fn<NonNullable<FakeSpec['step']>>(),
  drawScene: vi.fn<NonNullable<FakeSpec['drawScene']>>(),
  clickScene: vi.fn<NonNullable<FakeSpec['clickScene']>>(),
});

beforeEach(() => {
  context2d = { clearRect: vi.fn(), setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
  // spyOn rather than assignment: a raw prototype assignment survives
  // restoreAllMocks and leaks into every file that runs after this one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context2d as never);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  spec = makeSpec();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

const render = (withClicks = true) =>
  renderWithTheme(<SceneCanvas spec={withClicks ? spec : { ...spec, clickScene: undefined }} />);

/** The frame loop runs off requestAnimationFrame, which the setup stubs out. */
function drawOneFrame(time = 1000) {
  const frame = vi.mocked(requestAnimationFrame).mock.calls[0][0];
  act(() => frame(time));
}

/** Captures the resolution media queries `watchPixelRatio` arms. */
function watchQueries() {
  // Only the resolution ones: Mantine asks for a colour-scheme query of its own
  // on the same global, and counting that as an arming makes every assertion
  // here off by one.
  const armed: { remove: ReturnType<typeof vi.fn>; fire: () => void }[] = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const listeners: (() => void)[] = [];
      const media = {
        matches: true,
        media: query,
        addEventListener: (_: string, fn: () => void) => listeners.push(fn),
        removeEventListener: vi.fn(),
        addListener: (fn: () => void) => listeners.push(fn),
        removeListener: vi.fn(),
        fire: () => listeners.slice().forEach((fn) => fn()),
      };
      if (query.includes('resolution'))
        armed.push({ remove: media.removeEventListener, fire: media.fire });
      return media;
    }),
  );
  return armed;
}

function SceneWithColourSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  return (
    <>
      <SceneCanvas spec={spec} />
      <button onClick={() => setColorScheme('dark')}>Go dark</button>
    </>
  );
}

describe('the canvas a scene stands on', () => {
  it('covers the viewport without claiming a layer of its own', () => {
    render();
    const canvas = document.querySelector('canvas')!;

    expect(canvas.style.position).toBe('fixed');
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    // The stage grants the layer: a z-index here is resolved inside the clip
    // `SceneLayer` puts round it and never reaches the page.
    expect(canvas.style.zIndex).toBe('');
  });

  it('sizes the buffer in device pixels and the element in CSS ones', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    resizeTo(800, 600);
    render();

    const canvas = document.querySelector('canvas')!;
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(canvas.style.width).toBe('800px');
  });

  // The literal, not the constant. Asserted against `MAX_PIXEL_RATIO` itself
  // both sides read the same symbol, and raising it to four passes — while the
  // buffer is the whole viewport repainted forty times a second, so its cost
  // grows with the square of that number.
  it('stops following the device beyond twice, however dense the screen', () => {
    vi.stubGlobal('devicePixelRatio', 4);
    resizeTo(800, 600);
    render();
    expect(document.querySelector('canvas')!.width).toBe(1600);
    expect(MAX_PIXEL_RATIO).toBe(2);
  });

  it("puts the screen's ratio on the context and leaves the scene its own scale", () => {
    vi.stubGlobal('devicePixelRatio', 2);
    resizeTo(400, 700);
    render();
    drawOneFrame();

    expect(context2d.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(spec.drawScene).toHaveBeenCalledWith(
      context2d,
      expect.anything(),
      false,
      sceneScale(400),
    );
  });
});

/**
 * What a window of this size becomes, in the scene's own units.
 *
 * The arithmetic written out at each assertion was three copies in this file
 * alone, and the ground's is the part with two readings that each cost a bug —
 * so a change to `stageFor` had three places here to follow it to, and any one
 * of them left behind would have gone on agreeing with itself.
 */
const stageOf = (width: number, height: number) => {
  const scale = sceneScale(width);
  return {
    width: width / scale,
    height: height / scale,
    ground: (height - footerHeight() - GROUND_ABOVE_FOOTER) / scale,
  };
};

/** Every field of a stage, to ten places. */
function expectStage(actual: SceneSize, width: number, height: number) {
  const want = stageOf(width, height);
  expect(actual.width).toBeCloseTo(want.width, 10);
  expect(actual.height).toBeCloseTo(want.height, 10);
  expect(actual.ground).toBeCloseTo(want.ground, 10);
}

describe('the stage a scene is handed', () => {
  it('lays it out in the scene’s own units, not the window’s', () => {
    resizeTo(360, 700);
    render();

    expectStage(spec.createScene.mock.calls[0][0], 360, 700);
  });

  // The two measurements are deliberately from different places, and each was a
  // bug. The width comes from the document, because a classic scrollbar counts
  // towards `innerWidth` but not towards the containing block of the fixed
  // canvas. The height comes from the window, because `clientHeight` is the
  // *layout* viewport — pinned on a phone, so it does not move when the URL bar
  // collapses, while the footer the ground is measured off does.
  it('measures the width off the document and the height off the window', () => {
    resizeTo(1024, 800);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1009);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(742);
    render();

    // The width off the document's 1009, the height off the window's 800.
    expectStage(spec.createScene.mock.calls[0][0], 1009, 800);
    // Not the layout viewport's 742, which a collapsing URL bar never changes.
    expect(spec.createScene.mock.calls[0][0].ground).not.toBeCloseTo(stageOf(1009, 742).ground, 10);
  });

  it('builds the scene once, and hands it randomness rather than taking it', () => {
    render();
    expect(spec.createScene).toHaveBeenCalledTimes(1);
    expect(typeof spec.createScene.mock.calls[0][1]).toBe('function');
  });

  it('carries on through a switch to dark rather than starting the scene over', async () => {
    const user = userEvent.setup();
    renderWithTheme(<SceneWithColourSchemeToggle />);
    expect(spec.createScene).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Go dark' }));

    // Under "auto" this happens by itself at sunset.
    expect(spec.createScene).toHaveBeenCalledTimes(1);
    drawOneFrame();
    expect(spec.drawScene).toHaveBeenLastCalledWith(context2d, expect.anything(), true, 1);
  });
});

describe('two decisions, not one', () => {
  it('leaves the scene alone when the window is the size it already was', () => {
    render();
    resizeTo(window.innerWidth, window.innerHeight);
    expect(spec.resizeScene).not.toHaveBeenCalled();
  });

  it('moves the scene when the stage really changed', () => {
    resizeTo(800, 600);
    render();
    resizeTo(1200, 600);
    expect(spec.resizeScene).toHaveBeenCalledTimes(1);
  });

  // The buffer and the scene are separate: `resizeScene` is not a no-op on
  // unchanged input, so folding the ratio into one early-out moves the whole
  // cast for a change of monitor that altered nothing about the stage.
  // Without the early-out, every one of the dozens of resize events a URL bar
  // collapse sends reallocates the buffer — which zeroes it — and re-places the
  // whole cast.
  it('does nothing at all when neither the stage nor the ratio moved', () => {
    resizeTo(800, 600);
    render();
    const before = document.querySelector('canvas')!;
    const setTransforms = vi.mocked(context2d.setTransform).mock.calls.length;

    act(() => window.dispatchEvent(new Event('resize')));

    expect(vi.mocked(context2d.setTransform).mock.calls.length).toBe(setTransforms);
    expect(document.querySelector('canvas')).toBe(before);
    expect(spec.resizeScene).not.toHaveBeenCalled();
  });

  // A resize builds no second scene: rebuilt, everything mid-flight is lost and
  // the cast is re-placed on every drag of a window edge.
  it('never builds the scene again, however the window is dragged about', () => {
    resizeTo(800, 600);
    render();
    for (const width of [900, 1000, 1100, 640]) resizeTo(width, 600);
    expect(spec.createScene).toHaveBeenCalledTimes(1);
    expect(spec.resizeScene).toHaveBeenCalledTimes(4);
  });

  // And what it is handed is the stage, in the scene's own units — not the
  // window, and not a stage with the ground left at nothing.
  it('hands the resize the same shape it handed the build', () => {
    resizeTo(800, 600);
    render();
    resizeTo(1200, 700);

    const built = spec.createScene.mock.calls[0][0];
    const moved = spec.resizeScene.mock.calls[0][1];
    // Against a written-out list, not against the other object: both come out
    // of the same zero-argument `stageFor()`, so comparing their keys compared
    // a factory's output with itself and held whatever that factory returned.
    // Add a field to a stage or drop `ground` from it and this stayed green
    // both ways, while reading as though it pinned "the resize gets a whole
    // stage, not a partial one" — the one thing it did not check.
    expect(Object.keys(built).sort()).toEqual(['ground', 'height', 'scale', 'width']);
    expect(Object.keys(moved).sort()).toEqual(['ground', 'height', 'scale', 'width']);
    expectStage(moved, 1200, 700);
  });

  it('refits the buffer for a change of ratio without moving the scene', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    resizeTo(800, 600);
    render();

    vi.stubGlobal('devicePixelRatio', 2);
    act(() => window.dispatchEvent(new Event('resize')));

    expect(document.querySelector('canvas')!.width).toBe(1600);
    expect(spec.resizeScene).not.toHaveBeenCalled();
  });

  // The guard's third term. The ground carries the *measured* footer, so
  // dropping it leaves a scene standing where it was while the band moves.
  it('moves the scene when only the ground has changed, the window having not', () => {
    const footer = document.createElement('div');
    footer.className = 'mantine-AppShell-footer';
    let height = 60;
    footer.getBoundingClientRect = () => ({ height }) as DOMRect;
    document.body.appendChild(footer);
    try {
      render();
      height = 120;
      act(() => window.dispatchEvent(new Event('resize')));
      expect(spec.resizeScene).toHaveBeenCalledTimes(1);
    } finally {
      footer.remove();
    }
  });

  // The stage is *re-held*, not merely compared: `size.scale` is what the
  // drawing is painted at and what a click is divided by, so leaving it at the
  // launch value paints a landscape phone at its portrait scale and puts every
  // tap in the wrong place, with nothing to see but a scene that stopped
  // responding.
  it('paints at the new scale after a resize, not the one it started at', () => {
    resizeTo(360, 700);
    render();
    resizeTo(1440, 900);
    drawOneFrame();

    expect(sceneScale(1440)).not.toBe(sceneScale(360));
    expect(spec.drawScene).toHaveBeenLastCalledWith(
      context2d,
      expect.anything(),
      false,
      sceneScale(1440),
    );
  });
});

describe('a tap on the scene', () => {
  // The one number between a finger and the room. Divided by the device ratio
  // as well, or not at all, nothing is clickable where it is drawn and there is
  // no error anywhere to say so.
  it('divides a real click by the scene scale and by nothing else', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    resizeTo(414, 800);
    render();

    act(() => document.dispatchEvent(new MouseEvent('click', { clientX: 207, clientY: 400 })));

    const scale = sceneScale(414);
    const [, x, y] = spec.clickScene.mock.calls[0];
    expect(x).toBeCloseTo(207 / scale, 10);
    expect(y).toBeCloseTo(400 / scale, 10);
    expect(x).not.toBeCloseTo(207 / (scale * 3), 10);
  });

  it('takes a click in window coordinates and asks the scene in its own', () => {
    resizeTo(360, 700);
    render();

    act(() => document.dispatchEvent(new MouseEvent('click', { clientX: 120, clientY: 300 })));

    const scale = sceneScale(360);
    expect(spec.clickScene).toHaveBeenCalledWith(expect.anything(), 120 / scale, 300 / scale);
  });

  it('divides by the new scale after a resize, not the one it started at', () => {
    resizeTo(360, 700);
    render();
    resizeTo(1440, 900);

    act(() => document.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200 })));

    const scale = sceneScale(1440);
    expect(spec.clickScene).toHaveBeenLastCalledWith(expect.anything(), 100 / scale, 200 / scale);
  });

  // A document-wide listener that does nothing is still one every click in the
  // application runs through.
  it('takes no clicks at all from a scene with nothing to click', () => {
    const add = vi.spyOn(document, 'addEventListener');
    render(false);
    expect(add.mock.calls.map(([type]) => type)).not.toContain('click');
  });
});

describe('following the display', () => {
  it('arms a resolution query and lets the old one go when it re-arms', () => {
    const armed = watchQueries();
    render();
    expect(armed).toHaveLength(1);

    // A change of ratio re-arms at the new one: a query born at 1dppx can never
    // *change* to 1dppx again, so left un-rearmed it is dead for the session.
    act(() => armed[0].fire());

    expect(armed.length).toBeGreaterThan(1);
    expect(armed[0].remove).toHaveBeenCalled();
  });

  it('stops the frame loop and drops everything it held when it goes away', () => {
    const armed = watchQueries();
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render();
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(removeWindow.mock.calls.map(([type]) => type)).toContain('resize');
    expect(removeDocument.mock.calls.map(([type]) => type)).toContain('click');
    expect(armed.at(-1)!.remove).toHaveBeenCalled();
  });
});

describe('the frame loop', () => {
  it('steps the scene, clears the canvas and draws, in that order', () => {
    resizeTo(900, 700);
    render();
    drawOneFrame();

    expect(spec.step).toHaveBeenCalledTimes(1);
    expect(context2d.clearRect).toHaveBeenCalledWith(0, 0, 900, 700);
    expect(spec.drawScene).toHaveBeenCalledTimes(1);
  });

  // Throttled to the ~40fps every canvas background keeps to: a frame asked for
  // sooner than that is re-requested and dropped.
  it('drops a frame that arrives before its slot', () => {
    render();
    drawOneFrame(1000);
    const frame = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    act(() => frame(1005));
    expect(spec.step).toHaveBeenCalledTimes(1);
  });
});
