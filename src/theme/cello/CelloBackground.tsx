import { useEffect, useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { canvasPixelRatio, fitCanvas, footerHeight } from '../chrome';
import {
  createScene,
  resizeScene,
  step,
  clickScene,
  sceneScale,
  GROUND_ABOVE_FOOTER,
} from './scene';
import { drawScene } from './draw';

/**
 * Wiring, and only wiring: a canvas, a frame loop, the window's size, and the
 * clicks. What the scene does with any of it is decided in `scene.ts`, which is
 * where the tests are — nothing here is worth asserting on and nothing here is
 * allowed to be interesting.
 */

/** ~40fps, the same budget the other canvas backgrounds keep to. */
const FRAME_INTERVAL = 25;

export function CelloBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = useComputedColorScheme('light') === 'dark';

  // Read by the frame loop rather than closed over, so the effect below does not
  // depend on it. Rebuilding on a colour-scheme change would restart the scene —
  // losing a pizza in mid-air and putting the bird back on his own — and under
  // "auto" that happens by itself when the phone flips to dark at sunset.
  const isDarkRef = useRef(isDark);
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let animationId: number;
    let lastTime = 0;

    /**
     * The stage, in the scene's own units.
     *
     * The scene is drawn at `scale`, so a window of 360px is a stage of 500 and
     * the scenery on it never changes size in the units it is written in. Every
     * measurement below is divided the same way, which is what keeps the ground
     * landing back on the same line of the screen.
     */
    function currentSize() {
      const scale = sceneScale(window.innerWidth);
      const ground = window.innerHeight - footerHeight() - GROUND_ABOVE_FOOTER;
      return {
        width: window.innerWidth / scale,
        height: window.innerHeight / scale,
        ground: ground / scale,
        scale,
      };
    }

    let size = currentSize();
    // `fitCanvas` puts the buffer in the screen's own pixels and scales the
    // context to match, so everything below still works in CSS pixels — and the
    // scene, in its own units on top of that.
    let { width: cssWidth, height: cssHeight, ratio } = fitCanvas(canvas, ctx);
    const scene = createScene(size, Math.random);

    /**
     * Two separate decisions, deliberately not one.
     *
     * The buffer is re-sized whenever the window or the ratio changes, but the
     * *scene* is only moved when its own measurements do. `resizeScene` is not
     * a no-op on unchanged input — it puts the girl back at the nearer end of
     * her walk, re-parks the car and re-clamps the bird — so folding the ratio
     * into one early-out teleported her mid-stride for a change of monitor that
     * altered nothing about the scene she stands in.
     */
    function resize() {
      const next = currentSize();
      const nextRatio = canvasPixelRatio();
      // Mobile browsers fire `resize` repeatedly as the URL bar collapses, often
      // with the same numbers. Reassigning the canvas size reallocates and
      // clears its backing store, so doing nothing is much cheaper than doing it
      // again with the values it already has.
      const sameWindow =
        next.width === size.width && next.height === size.height && next.ground === size.ground;
      if (sameWindow && nextRatio === ratio) return;

      ({ width: cssWidth, height: cssHeight, ratio } = fitCanvas(canvas, ctx));
      if (sameWindow) return;
      size = next;
      resizeScene(scene, next);
    }

    /**
     * A ratio change is not a resize event.
     *
     * Moving a window between monitors, or changing the display scale, can
     * leave `innerWidth` and `innerHeight` exactly where they were — and
     * `resize` is not specified to fire for it. Watching the window alone left
     * the old screen's buffer in place for the rest of the session, which for
     * an installed PWA left open for days is effectively forever, and in the
     * 1x-to-2x direction that is the very softness this exists to remove.
     * `matchMedia` on the current resolution does fire, and is re-armed at the
     * new one each time it does.
     */
    let ratioWatch: MediaQueryList | null = null;
    function watchPixelRatio() {
      ratioWatch?.removeEventListener('change', onRatioChange);
      // Guarded: jsdom and older browsers have no matchMedia, and a background
      // is never worth a crash.
      ratioWatch = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
      ratioWatch?.addEventListener('change', onRatioChange);
    }
    function onRatioChange() {
      resize();
      watchPixelRatio();
    }
    watchPixelRatio();

    function draw(time: number) {
      animationId = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      step(scene, Math.random);
      // In CSS pixels, like everything else drawn here: the context carries the
      // screen's ratio already.
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      drawScene(ctx, scene, isDarkRef.current, size.scale);
    }

    // The canvas takes no pointer events — it is drawn over the app, and a
    // click has to keep working on whatever is underneath it.
    function handleClick(event: MouseEvent) {
      // The window's coordinates are not the scene's on a narrow screen.
      clickScene(scene, event.clientX / size.scale, event.clientY / size.scale);
    }

    animationId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    document.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('click', handleClick);
      ratioWatch?.removeEventListener('change', onRatioChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
      }}
    />
  );
}
