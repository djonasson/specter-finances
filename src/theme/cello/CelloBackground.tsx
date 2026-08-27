import { useEffect, useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { canvasPixelRatio, fitCanvas, watchPixelRatio } from '../chrome';
import { createScene, resizeScene, step, clickScene } from './scene';
import { stageFor } from '../stage';
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

    let size = stageFor();
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
      const nextRatio = canvasPixelRatio();
      const next = stageFor();
      // Every term the scene is built from, the footer's measured height
      // included: reading the viewport alone and returning early left
      // `footerHeight` unmeasured, so a footer that laid out at a different
      // height than the fallback the sign-in screen gave it kept the scene's
      // ground where it was for the session — while the band drawn to hide it
      // moved. Both of these reads force layout, so there is no cheap one to
      // put first.
      const sameStage =
        next.width === size.width && next.height === size.height && next.ground === size.ground;
      if (sameStage && nextRatio === ratio) return;

      ({ width: cssWidth, height: cssHeight, ratio } = fitCanvas(canvas, ctx));
      // The buffer and the scene are two decisions: a change of monitor alters
      // nothing about the stage she stands on, and `resizeScene` puts her back
      // at the nearer end of her walk.
      if (sameStage) return;
      size = next;
      resizeScene(scene, next);
    }

    const stopWatchingRatio = watchPixelRatio(resize);

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
      stopWatchingRatio();
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
