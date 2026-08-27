// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithTheme } from '../../test-utils';

vi.mock('./scene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./scene')>();
  return {
    ...actual,
    createScene: vi.fn(actual.createScene),
    step: vi.fn(actual.step),
    clickScene: vi.fn(actual.clickScene),
  };
});
// jsdom implements no canvas, and every drawing call would land on the null it
// returns from getContext. Nothing here asserts on pixels.
vi.mock('./draw', () => ({ drawScene: vi.fn() }));

import { createScene, step, clickScene } from './scene';
import { drawScene } from './draw';
import { CelloBackground } from './CelloBackground';

/**
 * Only what is the cello's.
 *
 * This file used to hold the whole of the canvas wiring, because that is where
 * the wiring lived. It is `SceneCanvas` now, shared by every scene and covered
 * once in `sceneCanvas.test.tsx` against a scene that does nothing — which is
 * where those tests belong: left here, one background owned the contract of a
 * module three of them depend on, and retiring this theme would have taken the
 * coverage with it.
 */

let context2d: CanvasRenderingContext2D;

beforeEach(() => {
  context2d = { clearRect: vi.fn(), setTransform: vi.fn() } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context2d as never);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.mocked(createScene).mockClear();
  vi.mocked(step).mockClear();
  vi.mocked(clickScene).mockClear();
  vi.mocked(drawScene).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the street the component builds', () => {
  it('drives its own scene and its own drawing, not another theme\u2019s', () => {
    renderWithTheme(<CelloBackground />);
    act(() => vi.mocked(requestAnimationFrame).mock.calls[0][0](1000));

    expect(step).toHaveBeenCalled();
    expect(drawScene).toHaveBeenCalledWith(
      context2d,
      expect.objectContaining({ girl: expect.anything(), bird: expect.anything() }),
      false,
      expect.any(Number),
    );
  });

  it('hands its clicks to its own scene', () => {
    renderWithTheme(<CelloBackground />);
    act(() => document.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 90 })));
    expect(clickScene).toHaveBeenCalled();
  });
});
