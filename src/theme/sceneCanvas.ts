import { useEffect, useRef, type RefObject } from 'react';
import { canvasPixelRatio, fitCanvas } from './chrome';
import { stageFor } from './stage';
import type { SceneSize } from './stage';

/**
 * The wiring every canvas scene needs, and none of what any of them does.
 *
 * A scene is three modules — a pure `scene.ts`, a `draw.ts` that may not mutate
 * it, and a component. This is the component, for all of them: a canvas fitted
 * to the screen's own pixels, a throttled frame loop, a stage re-measured when
 * the window or the display changes, and clicks handed on in the scene's own
 * units.
 *
 * It is shared for the reason `stageFor` and `fitCanvas` are shared: a scene
 * that got any of it subtly wrong would not fail, it would merely be blurry, or
 * stand its scenery in the wrong place, or answer taps where nothing is drawn.
 * Every one of the guards below cost a real bug to find, and the alternative is
 * each new scene copying them and one of the copies going quietly stale.
 */

/** ~40fps, the budget every canvas background keeps to. */
const FRAME_INTERVAL = 25;

export interface SceneSpec<S> {
  createScene: (size: SceneSize, rng: () => number) => S;
  /** Mutates in place. Not a no-op on unchanged input — see the guard below. */
  resizeScene: (scene: S, size: SceneSize) => void;
  step: (scene: S, rng: () => number) => void;
  drawScene: (ctx: CanvasRenderingContext2D, scene: S, isDark: boolean, scale: number) => void;
  /** Given the point in the scene's own units. Omitted if nothing is clickable. */
  clickScene?: (scene: S, x: number, y: number) => void;
  /** Read every frame rather than closed over, so a theme flip does not restart. */
  isDark: () => boolean;
  /** Re-arms when the display's pixel ratio changes; see `watchPixelRatio`. */
  watchPixelRatio: (onChange: () => void) => () => void;
}

export function useSceneCanvas<S>(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  spec: SceneSpec<S>,
): void {
  // Held in a ref so the effect below can depend on nothing and run once. The
  // spec is a fresh object on every render of the caller, and depending on it
  // would tear the scene down and rebuild it on every render — losing whatever
  // was mid-flight and re-placing the whole cast.
  const specRef = useRef(spec);
  useEffect(() => {
    specRef.current = spec;
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { createScene, resizeScene, step, drawScene, clickScene, watchPixelRatio } =
      specRef.current;

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
     * a no-op on unchanged input — it re-places everything the scene holds — so
     * folding the ratio into one early-out moves the whole cast for a change of
     * monitor that altered nothing about the stage they stand on.
     */
    function resize() {
      const nextRatio = canvasPixelRatio();
      const next = stageFor();
      // Every term the scene is built from, the footer's measured height
      // included: reading the viewport alone and returning early left the
      // footer unmeasured, so a footer that laid out at a different height than
      // the fallback the sign-in screen gave it kept the scene's ground where
      // it was for the session — while the band drawn to hide it moved.
      const sameStage =
        next.width === size.width && next.height === size.height && next.ground === size.ground;
      if (sameStage && nextRatio === ratio) return;

      ({ width: cssWidth, height: cssHeight, ratio } = fitCanvas(canvas, ctx));
      if (sameStage) return;

      // Re-held, not just compared: `size.scale` is what the drawing is painted
      // at and what a click is divided by, so leaving it at the launch value
      // paints a landscape phone at its portrait scale and puts every tap in
      // the wrong place, with nothing to see but a scene that stopped
      // responding.
      size = next;
      resizeScene(scene, next);
    }

    const stopWatchingRatio = watchPixelRatio(resize);

    function draw(time: number) {
      animationId = requestAnimationFrame(draw);
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;

      step(scene, Math.random);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      drawScene(ctx, scene, specRef.current.isDark(), size.scale);
    }

    /**
     * The canvas has `pointer-events: none` so it costs the app no taps, which
     * is also why this listens on the document rather than on the canvas.
     * `clientX` is already in CSS pixels, so it is divided by the scene's own
     * scale and by nothing else — the device ratio lives on the context.
     */
    function handleClick(event: MouseEvent) {
      clickScene?.(scene, event.clientX / size.scale, event.clientY / size.scale);
    }

    animationId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    if (clickScene) document.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      if (clickScene) document.removeEventListener('click', handleClick);
      stopWatchingRatio();
    };
  }, [canvasRef]);
}
