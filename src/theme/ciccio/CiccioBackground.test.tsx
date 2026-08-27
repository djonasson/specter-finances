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
import { CiccioBackground } from './CiccioBackground';

/**
 * Only what is Ciccio's.
 *
 * The canvas, the frame loop, the buffer in device pixels, the two-decision
 * resize, the click division and the teardown are `SceneCanvas`, and are
 * covered once in `sceneCanvas.test.tsx` against a scene that does nothing.
 * Asserting them again here would be the same shared function tested twice,
 * once per background — which is the duplication the extraction removed.
 *
 * What is left is the one thing this file can get wrong on its own: handing the
 * canvas somebody else's three modules.
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
  // `restoreAllMocks` restores spies but not the `vi.fn`s a module mock is built
  // from, so their calls accumulate across the file and `mock.calls[0]` becomes
  // whatever the first test in the run happened to do.
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

describe('the room the component builds', () => {
  it('drives its own scene and its own drawing, not another theme’s', () => {
    renderWithTheme(<CiccioBackground />);
    act(() => vi.mocked(requestAnimationFrame).mock.calls[0][0](1000));

    expect(step).toHaveBeenCalled();
    expect(drawScene).toHaveBeenCalledWith(
      context2d,
      expect.objectContaining({ ciccio: expect.anything(), squirrels: expect.anything() }),
      false,
      expect.any(Number),
    );
  });

  it('hands its clicks to its own scene', () => {
    renderWithTheme(<CiccioBackground />);
    act(() => document.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 90 })));
    expect(clickScene).toHaveBeenCalled();
  });
});
