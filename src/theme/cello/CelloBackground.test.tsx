// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMantineColorScheme } from '@mantine/core';
import { renderWithTheme, resizeTo } from '../../test-utils';

// The scene itself is tested in scene.test.ts; what is left here is the wiring,
// and the wiring has one thing worth pinning: it must not throw the scene away.
// A colour-scheme change used to rebuild the effect, which under "auto" happens
// by itself when the phone flips to dark at sunset — a pizza in mid-air and the
// bird's whole afternoon, gone, for a change of palette.
vi.mock('./scene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./scene')>();
  return {
    ...actual,
    createScene: vi.fn(actual.createScene),
    resizeScene: vi.fn(actual.resizeScene),
    clickScene: vi.fn(actual.clickScene),
  };
});

// jsdom implements no canvas, and every drawing call would land on the null it
// returns from getContext. Nothing here asserts on pixels.
vi.mock('./draw', () => ({ drawScene: vi.fn() }));

import {
  createScene,
  resizeScene,
  clickScene,
  sceneScale,
  GROUND_ABOVE_FOOTER,
  SCENE_FULL_WIDTH,
} from './scene';
import type { Scene } from './scene';
import { drawScene } from './draw';
import { footerHeight } from '../chrome';
import { CelloBackground } from './CelloBackground';

// Only what the frame loop itself touches: everything else goes through
// drawScene, which is mocked.
const context2d = {
  clearRect: vi.fn(),
  setTransform: vi.fn(),
} as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  vi.mocked(createScene).mockClear();
  vi.mocked(resizeScene).mockClear();
  vi.mocked(clickScene).mockClear();
  vi.mocked(drawScene).mockClear();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => context2d) as never;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** The scene, plus the one control that used to tear it down. */
function SceneWithColourSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  return (
    <>
      <CelloBackground />
      <button onClick={() => setColorScheme('dark')}>Go dark</button>
    </>
  );
}

describe('keeping the scene alive', () => {
  it('carries on through a switch to dark rather than starting the scene over', async () => {
    const user = userEvent.setup();
    renderWithTheme(<SceneWithColourSchemeToggle />);
    expect(createScene).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Go dark' }));

    expect(createScene).toHaveBeenCalledTimes(1);
  });

  it('leaves the scene alone when the window is resized to the size it already had', () => {
    renderWithTheme(<CelloBackground />);
    resizeTo(window.innerWidth, window.innerHeight);
    expect(resizeScene).not.toHaveBeenCalled();
  });

  it('moves the scene into a window that really did change size', () => {
    renderWithTheme(<CelloBackground />);
    resizeTo(400, 700);
    expect(resizeScene).toHaveBeenCalledTimes(1);
    expect(createScene).toHaveBeenCalledTimes(1);
  });
});

describe("drawing at the screen's own resolution", () => {
  /** The frame loop runs off requestAnimationFrame, which the setup stubs out. */
  function drawOneFrame() {
    const frame = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    act(() => frame(1000));
  }

  it('sizes the canvas buffer in device pixels, not CSS ones', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    renderWithTheme(<CelloBackground />);

    const canvas = document.querySelector('canvas')!;
    expect(canvas.width).toBe(window.innerWidth * 2);
    expect(canvas.height).toBe(window.innerHeight * 2);
  });

  // The buffer is the whole viewport, cleared and repainted forty times a
  // second: its cost grows with the square of the ratio, and a phone at 3 is
  // the device least able to pay it. Two is where the sharpness stops being
  // worth the paint.
  it('stops following the device beyond twice, however dense the screen', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    renderWithTheme(<CelloBackground />);

    expect(document.querySelector('canvas')!.width).toBe(window.innerWidth * 2);
  });

  // Without this the element lays out at its *attribute* size, so a buffer in
  // device pixels makes the canvas itself wider than the window.
  it('keeps the canvas the size of the window on screen', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    renderWithTheme(<CelloBackground />);

    const canvas = document.querySelector('canvas')!;
    expect(canvas.style.width).toBe(`${window.innerWidth}px`);
    expect(canvas.style.height).toBe(`${window.innerHeight}px`);
  });

  // Two scales, applied in two places and deliberately not multiplied together
  // here: the screen's ratio goes on the context once, and the scene's own
  // scale goes on top of it every frame.
  it("puts the screen's ratio on the context and leaves the scene its own scale", () => {
    vi.stubGlobal('devicePixelRatio', 2);
    // Set here rather than inherited: an earlier test in this file assigns
    // `window.innerWidth` directly and jsdom never puts it back, so a scene
    // scale of 1 would let a regression that dropped the scale entirely still
    // satisfy this.
    window.innerWidth = 400;
    renderWithTheme(<CelloBackground />);
    drawOneFrame();

    expect(context2d.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(sceneScale(400)).not.toBe(1);
    expect(vi.mocked(drawScene).mock.calls[0][3]).toBeCloseTo(sceneScale(400));
  });

  // Dragging a window between monitors changes nothing about the scene's own
  // measurements, so the early-out would otherwise keep the old screen's buffer.
  it('re-sizes the buffer when only the pixel ratio changes', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    renderWithTheme(<CelloBackground />);
    const canvas = document.querySelector('canvas')!;
    expect(canvas.width).toBe(window.innerWidth);

    vi.stubGlobal('devicePixelRatio', 2);
    resizeTo(window.innerWidth, window.innerHeight);

    expect(canvas.width).toBe(window.innerWidth * 2);
  });
});

describe('letting go', () => {
  it('stops the frame loop and drops its listeners when it goes away', () => {
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderWithTheme(<CelloBackground />);
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('click', expect.any(Function));
  });
});

// The scene is drawn smaller on a narrow window and goes on measuring in the
// units it was written in, so the stage it is handed is the window divided by
// that scale. Getting this wrong in either direction is invisible in the scene's
// own tests: they would still pass, on a stage the wrong size.
describe('the stage the window gives it', () => {
  const stageOf = (call: number) => vi.mocked(createScene).mock.calls[call][0];

  it('hands over a stage in scene units, wider than the phone it is on', () => {
    window.innerWidth = 360;
    window.innerHeight = 700;
    renderWithTheme(<CelloBackground />);

    const stage = stageOf(0);
    expect(stage.width).toBeCloseTo(360 / sceneScale(360));
    expect(stage.width).toBeGreaterThan(360);
  });

  it('sizes the canvas itself in screen pixels, whatever the scene measures in', () => {
    // The stage is in scene units and the backing store is not: sized in scene
    // units it would be a 500px canvas stretched over a 360px window, with every
    // scene element drawn nearly forty per cent out.
    window.innerWidth = 360;
    window.innerHeight = 700;
    const { container } = renderWithTheme(<CelloBackground />);

    const canvas = container.querySelector('canvas')!;
    expect(canvas.width).toBe(360);
    expect(canvas.height).toBe(700);
  });

  it('resizes the backing store with the window', () => {
    window.innerWidth = 1200;
    window.innerHeight = 800;
    const { container } = renderWithTheme(<CelloBackground />);
    resizeTo(360, 700);

    const canvas = container.querySelector('canvas')!;
    expect(canvas.width).toBe(360);
  });

  it('leaves a roomy window measuring one to one', () => {
    // Wide enough that the scene is drawn at full size, taken from the width
    // that decides it rather than from a number that happens to be past it.
    const roomy = SCENE_FULL_WIDTH + 200;
    window.innerWidth = roomy;
    window.innerHeight = 900;
    renderWithTheme(<CelloBackground />);

    expect(stageOf(0).width).toBeCloseTo(roomy);
  });

  it('puts the ground in scene units too, or the scenery stands off the floor', () => {
    window.innerWidth = 360;
    window.innerHeight = 700;
    renderWithTheme(<CelloBackground />);

    const stage = stageOf(0);
    // Whatever the scale, the ground has to land back on the same screen line.
    expect(stage.ground * sceneScale(360)).toBeCloseTo(700 - footerHeight() - GROUND_ABOVE_FOOTER);
  });

  it('re-measures the stage when the window changes size', () => {
    window.innerWidth = 1440;
    window.innerHeight = 900;
    renderWithTheme(<CelloBackground />);
    resizeTo(360, 700);

    const stage = vi.mocked(resizeScene).mock.calls[0][1];
    expect(stage.width).toBeCloseTo(360 / sceneScale(360));
  });

  it('tells the drawing what scale to paint at', () => {
    window.innerWidth = 360;
    window.innerHeight = 700;
    renderWithTheme(<CelloBackground />);
    act(() => {
      vi.mocked(requestAnimationFrame).mock.calls[0][0](1000);
    });

    expect(drawScene).toHaveBeenCalledWith(context2d, expect.anything(), false, sceneScale(360));
  });

  it('takes a click in window coordinates and asks the scene in its own', () => {
    window.innerWidth = 360;
    window.innerHeight = 700;
    renderWithTheme(<CelloBackground />);

    act(() => {
      document.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 200 }));
    });

    const scale = sceneScale(360);
    expect(clickScene).toHaveBeenCalledWith(expect.anything(), 100 / scale, 200 / scale);
  });
});

// The one test that goes the whole way: a real click, in window coordinates, on
// a real scene, through the real listener. Everything either side of this was
// covered — the scene answers a click, and the wiring divides by the scale — and
// between them sat the question actually being asked, which is whether clicking
// the girl on the screen does anything at all.
describe('clicking the scene through the window', () => {
  const sceneFrom = () => vi.mocked(createScene).mock.results[0].value as Scene;

  /** Runs frames until the predicate holds, driving the loop by hand. */
  function pumpUntil(holds: (s: Scene) => boolean, limit = 20000) {
    const scene = sceneFrom();
    for (let i = 0; i < limit; i++) {
      const frame = vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0];
      act(() => frame?.(i * 100));
      if (holds(scene)) return scene;
    }
    throw new Error('never happened');
  }

  it('blows a kiss when she is clicked where she is drawn', () => {
    window.innerWidth = 1539;
    window.innerHeight = 1559;
    renderWithTheme(<CelloBackground />);

    const scene = pumpUntil((s) => s.girl.phase === 'walking' && s.bird.phase === 'escorting');
    const hearts = scene.hearts.length;

    act(() => {
      document.dispatchEvent(
        new MouseEvent('click', { clientX: scene.girl.x, clientY: scene.ground - 30 }),
      );
    });

    expect(scene.hearts.length).toBe(hearts + 1);
  });

  it('finds her on a narrow window, where the scene is drawn smaller than it measures', () => {
    // The coordinates the browser reports are the window's, and the scene thinks
    // in its own: undivided, every click lands to the right of and below where
    // she actually is, and on a phone nothing is ever clickable.
    window.innerWidth = 360;
    window.innerHeight = 700;
    renderWithTheme(<CelloBackground />);

    const scene = pumpUntil((s) => s.girl.phase === 'walking' && s.bird.phase === 'escorting');
    const hearts = scene.hearts.length;
    const scale = sceneScale(360);

    act(() => {
      document.dispatchEvent(
        new MouseEvent('click', {
          clientX: scene.girl.x * scale,
          clientY: (scene.ground - 30) * scale,
        }),
      );
    });

    expect(scene.hearts.length).toBe(hearts + 1);
  });
});
