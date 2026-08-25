import { useEffect, useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { footerHeight } from '../chrome';
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

    /**
     * The backing store is sized in **device** pixels, not CSS ones.
     *
     * The canvas is `position: fixed; inset: 0`, so CSS stretches it over the
     * whole viewport whatever its buffer holds. Sized at `innerWidth`, a screen
     * with a device pixel ratio above 1 drew the scene at a fraction of the
     * resolution and had the display blow it back up — soft on a laptop at
     * 1.25, and on a phone at 3 the whole scene rendered at a third of its size
     * and was upscaled over every edge in it.
     */
    function pixelRatio() {
      return window.devicePixelRatio || 1;
    }

    function sizeBuffer() {
      const dpr = pixelRatio();
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      // And the CSS size in CSS pixels, explicitly. A canvas with no width or
      // height in its style lays out at its *attribute* size, so a buffer in
      // device pixels made the element itself bigger than the window and hung
      // the scene off the right of it.
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }

    let size = currentSize();
    let ratio = pixelRatio();
    sizeBuffer();
    const scene = createScene(size, Math.random);

    function resize() {
      const next = currentSize();
      // Mobile browsers fire `resize` repeatedly as the URL bar collapses, often
      // with the same numbers. Reassigning the canvas size reallocates and
      // clears its backing store, so doing nothing is much cheaper than doing it
      // again with the values it already has.
      // The ratio counts too: dragging the window to a monitor with a different
      // one changes nothing about the scene's own measurements, and leaving the
      // buffer alone would keep drawing it at the old screen's resolution.
      const nextRatio = pixelRatio();
      if (
        next.width === size.width &&
        next.height === size.height &&
        next.ground === size.ground &&
        nextRatio === ratio
      ) {
        return;
      }
      size = next;
      ratio = nextRatio;
      sizeBuffer();
      resizeScene(scene, next);
    }

    function draw(time: number) {
      animationId = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      step(scene, Math.random);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Scene units to device pixels in one step: `drawScene` applies exactly
      // one `ctx.scale`, and the buffer is in device pixels.
      drawScene(ctx, scene, isDarkRef.current, size.scale * ratio);
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
