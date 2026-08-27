import { SceneCanvas } from '../sceneCanvas.tsx';
import { createScene, resizeScene, step, clickScene } from './scene';
import { drawScene } from './draw';

/**
 * Ciccio's scene. What happens is in `scene.ts`, what it looks like is in
 * `draw.ts`, and the canvas, the frame loop and the clicks are `SceneCanvas` —
 * shared with every other scene, so a new one cannot get the buffer, the stage
 * or the resize guard subtly wrong.
 */
export function CiccioBackground() {
  return <SceneCanvas spec={{ createScene, resizeScene, step, drawScene, clickScene }} />;
}
