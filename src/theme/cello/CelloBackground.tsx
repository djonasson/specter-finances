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

    let size = currentSize();
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      resizeScene(scene, next);
    }

    function draw(time: number) {
      animationId = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      step(scene, Math.random);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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
