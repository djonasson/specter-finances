import { useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { useSceneCanvas, type SceneSpec } from './sceneCanvas';

/**
 * The canvas a scene is drawn on, and the one place it is described.
 *
 * A scene supplies its three modules and nothing else. What this removes from
 * each background is exactly the part that fails *silently* when it is copied
 * and something is left out: the explicit `position: fixed; inset: 0` (a canvas
 * with no CSS size lays out at its device-pixel attribute size, which is wider
 * than the window it covers), the `aria-hidden`, and the **absence** of a
 * z-index — the stage grants the layer, and one set here is resolved inside the
 * clip `SceneLayer` puts round it and never reaches the page.
 *
 * The colour scheme is read here rather than by each scene so that no scene has
 * to know that passing it as a value would restart the scene at sunset.
 */
export function SceneCanvas<S>({ spec }: { spec: Omit<SceneSpec<S>, 'isDark'> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = useComputedColorScheme('light') === 'dark';

  useSceneCanvas(canvasRef, { ...spec, isDark } as SceneSpec<S>);

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'fixed', inset: 0 }} />;
}
