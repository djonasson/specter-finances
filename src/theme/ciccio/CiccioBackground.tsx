import { useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { watchPixelRatio } from '../chrome';
import { useSceneCanvas } from '../sceneCanvas';
import { createScene, resizeScene, step } from './scene';
import { drawScene } from './draw';

/**
 * Ciccio's room. The scene is in `scene.ts` and the drawing in `draw.ts`; the
 * wiring is `useSceneCanvas`, shared with every other canvas scene so that a
 * new one cannot get the buffer, the stage or the frame loop subtly wrong.
 *
 * Nothing is clickable yet, so no `clickScene` is handed over and the hook adds
 * no listener — the dance and the four click targets come with the next change.
 */
export function CiccioBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = useComputedColorScheme('light') === 'dark';

  useSceneCanvas(canvasRef, {
    createScene,
    resizeScene,
    step,
    drawScene,
    isDark: () => isDark,
    watchPixelRatio,
  });

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'fixed', inset: 0 }} />;
}
