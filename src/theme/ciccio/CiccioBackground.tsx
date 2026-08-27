import { useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { watchPixelRatio } from '../chrome';
import { useSceneCanvas } from '../sceneCanvas';
import { createScene, resizeScene, step, clickScene } from './scene';
import { drawScene } from './draw';

/**
 * Ciccio's room. The scene is in `scene.ts` and the drawing in `draw.ts`; the
 * wiring is `useSceneCanvas`, shared with every other canvas scene so that a
 * new one cannot get the buffer, the stage or the frame loop subtly wrong.
 *
 * Clicking him sets him dancing and clicking a squirrel gets its name out of
 * it, so a `clickScene` is handed over and the hook listens on the document —
 * the canvas has `pointer-events: none`, so none of it costs the app a tap.
 */
export function CiccioBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = useComputedColorScheme('light') === 'dark';

  useSceneCanvas(canvasRef, {
    createScene,
    resizeScene,
    step,
    drawScene,
    clickScene,
    isDark: () => isDark,
    watchPixelRatio,
  });

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'fixed', inset: 0 }} />;
}
