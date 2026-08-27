// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMantineColorScheme } from '@mantine/core';
import { renderWithTheme, resizeTo } from '../../test-utils';

vi.mock('./scene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./scene')>();
  return {
    ...actual,
    createScene: vi.fn(actual.createScene),
    resizeScene: vi.fn(actual.resizeScene),
    step: vi.fn(actual.step),
    clickScene: vi.fn(actual.clickScene),
  };
});
// jsdom implements no canvas, and every drawing call would land on the null it
// returns from getContext. Nothing here asserts on pixels.
vi.mock('./draw', () => ({ drawScene: vi.fn() }));

import { createScene, step, clickScene } from './scene';
import { sceneScale, GROUND_ABOVE_FOOTER } from '../stage';
import { drawScene } from './draw';
import { footerHeight } from '../chrome';
import { CiccioBackground } from './CiccioBackground';

/**
 * The wiring itself — the device-pixel buffer, the ratio watcher, the
 * two-decision resize, the teardown — is `useSceneCanvas`, and is covered once
 * against a real scene in `cello/CelloBackground.test.tsx`. Duplicating those
 * here would be five hundred lines asserting the same shared function twice.
 *
 * What is Ciccio's own, and is what this file asks: that the component hands
 * the hook *its* scene and *its* drawing, that the stage it is given is in this
 * scene's units, and that it declares no click handler while nothing in the
 * room is clickable.
 */

function RoomWithColourSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  return (
    <>
      <CiccioBackground />
      <button onClick={() => setColorScheme('dark')}>Go dark</button>
    </>
  );
}

let context2d: CanvasRenderingContext2D;

beforeEach(() => {
  context2d = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  // spyOn rather than assignment: a raw prototype assignment survives
  // restoreAllMocks and leaks into every file that runs after this one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context2d as never);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  // `restoreAllMocks` restores spies but not the `vi.fn`s the module mock is
  // built from, so their calls accumulate across the file and `mock.calls[0]`
  // becomes whatever the first test in the run happened to do.
  vi.mocked(createScene).mockClear();
  vi.mocked(step).mockClear();
  vi.mocked(drawScene).mockClear();
  vi.mocked(clickScene).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

function drawOneFrame() {
  const frame = vi.mocked(requestAnimationFrame).mock.calls[0][0];
  act(() => frame(1000));
}

describe('the canvas Ciccio stands on', () => {
  it('covers the viewport without claiming a layer of its own', () => {
    renderWithTheme(<CiccioBackground />);
    const canvas = document.querySelector('canvas')!;

    expect(canvas.style.position).toBe('fixed');
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    // The stage grants the layer: a z-index here is resolved inside the clip
    // `SceneLayer` puts round it and never reaches the page.
    expect(canvas.style.zIndex).toBe('');
  });
});

describe('the room the component builds', () => {
  it('lays it out in the scene’s own units, not the window’s', () => {
    resizeTo(360, 700);
    renderWithTheme(<CiccioBackground />);

    const stage = vi.mocked(createScene).mock.calls[0][0];
    const scale = sceneScale(360);
    expect(stage.width).toBeCloseTo(360 / scale, 10);
    expect(stage.height).toBeCloseTo(700 / scale, 10);
  });

  it('stands the ground clear of the footer, in those same units', () => {
    resizeTo(900, 800);
    renderWithTheme(<CiccioBackground />);

    const stage = vi.mocked(createScene).mock.calls[0][0];
    expect(stage.ground).toBeCloseTo(
      (800 - footerHeight() - GROUND_ABOVE_FOOTER) / sceneScale(900),
      10,
    );
  });

  it('drives its own scene and its own drawing, not another theme’s', () => {
    renderWithTheme(<CiccioBackground />);
    drawOneFrame();

    expect(step).toHaveBeenCalled();
    expect(drawScene).toHaveBeenCalledWith(
      context2d,
      expect.objectContaining({ ciccio: expect.anything(), squirrels: expect.anything() }),
      false,
      sceneScale(window.innerWidth),
    );
  });

  it('paints at the new scale after a resize, not the one it started at', () => {
    resizeTo(360, 700);
    renderWithTheme(<CiccioBackground />);

    resizeTo(1440, 900);
    drawOneFrame();

    expect(sceneScale(1440)).not.toBe(sceneScale(360));
    expect(drawScene).toHaveBeenLastCalledWith(
      context2d,
      expect.anything(),
      false,
      sceneScale(1440),
    );
  });

  // `clientX` is in CSS pixels and the scene works in its own units, so the one
  // thing between a tap and the room is that division. Off by the device ratio
  // as well and nothing is clickable where it is drawn, with no error anywhere.
  it('takes a click in window coordinates and asks the room in its own', () => {
    resizeTo(360, 700);
    renderWithTheme(<CiccioBackground />);

    act(() => {
      document.dispatchEvent(new MouseEvent('click', { clientX: 120, clientY: 300 }));
    });

    const scale = sceneScale(360);
    expect(clickScene).toHaveBeenCalledWith(expect.anything(), 120 / scale, 300 / scale);
  });

  it('drops the click listener when it goes away', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderWithTheme(<CiccioBackground />);
    unmount();
    expect(remove.mock.calls.map(([type]) => type)).toContain('click');
  });

  it('carries on through a switch to dark rather than starting the room over', async () => {
    const user = userEvent.setup();
    renderWithTheme(<RoomWithColourSchemeToggle />);
    expect(createScene).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Go dark' }));

    // Under "auto" this happens by itself at sunset. Rebuilding would put him
    // back at one end of the room with his friends re-placed around him.
    expect(createScene).toHaveBeenCalledTimes(1);
  });

  it('stops the frame loop and drops its listeners when it goes away', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderWithTheme(<CiccioBackground />);
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(remove.mock.calls.map(([type]) => type)).toContain('resize');
  });
});
