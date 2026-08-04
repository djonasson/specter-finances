// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMantineColorScheme } from '@mantine/core';
import { renderWithTheme } from '../../test-utils';

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
  };
});

// jsdom implements no canvas, and every drawing call would land on the null it
// returns from getContext. Nothing here asserts on pixels.
vi.mock('./draw', () => ({ drawScene: vi.fn() }));

import { createScene, resizeScene } from './scene';
import { CelloBackground } from './CelloBackground';

const context2d = {} as CanvasRenderingContext2D;

beforeEach(() => {
  vi.mocked(createScene).mockClear();
  vi.mocked(resizeScene).mockClear();
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

const resizeTo = (width: number, height: number) =>
  act(() => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event('resize'));
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
