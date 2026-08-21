import { useEffect, useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { footerHeight } from '../chrome';
import { createScene, resizeScene, step, clickScene, SCENE_REACH } from './scene';
import { drawScene } from './draw';

/**
 * Wiring, and only wiring: a canvas, a frame loop, the window's size, and the
 * clicks. What the scene does with any of it is decided in `scene.ts`, which is
 * where the tests are — nothing here is worth asserting on and nothing here is
 * allowed to be interesting.
 */

/** The scene stands this far above the app's footer. */
const GROUND_ABOVE_FOOTER = 34;

/**
 * The band this scene needs the app to reserve for it — the ground it stands on
 * plus everything standing on that ground. Derived rather than chosen, so the
 * scenery and the floor masking it cannot drift apart.
 */
export const CELLO_FLOOR = GROUND_ABOVE_FOOTER + SCENE_REACH;
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

    function currentSize() {
      const height = window.innerHeight;
      return {
        width: window.innerWidth,
        height,
        ground: height - footerHeight() - GROUND_ABOVE_FOOTER,
      };
    }

    let size = currentSize();
    canvas.width = size.width;
    canvas.height = size.height;
    const scene = createScene(size, Math.random);

    function resize() {
      const next = currentSize();
      // Mobile browsers fire `resize` repeatedly as the URL bar collapses, often
      // with the same numbers. Reassigning the canvas size reallocates and
      // clears its backing store, so doing nothing is much cheaper than doing it
      // again with the values it already has.
      if (next.width === size.width && next.height === size.height && next.ground === size.ground) {
        return;
      }
      size = next;
      canvas.width = next.width;
      canvas.height = next.height;
      resizeScene(scene, next);
    }

    function draw(time: number) {
      animationId = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      step(scene, Math.random);
      ctx.clearRect(0, 0, size.width, size.height);
      drawScene(ctx, scene, isDarkRef.current);
    }

    // The canvas takes no pointer events — it is drawn over the app, and a
    // click has to keep working on whatever is underneath it.
    function handleClick(event: MouseEvent) {
      clickScene(scene, event.clientX, event.clientY);
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
