import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useThemeSettings } from './ThemeContext';
import { drawsOverTheApp, stageFloorHeight } from './registry';
import { footerHeight, viewportSize, FOOTER_HEIGHT, BEHIND_Z, FLOOR_Z, SCENE_Z } from './chrome';

/**
 * The two pieces of layout a background that draws over the app needs from the
 * page. They mount in different places — the floor outside the AppShell, the
 * spacer inside its main area — so they cannot be one component, but they read
 * the same flag off the same registry and are never right one without the other.
 */

/**
 * How tall a band the background now showing needs, or zero if it needs none.
 *
 * All three pieces below turn on this one number — the floor is that tall, the
 * spacer clears it, and the layer is in front of the app exactly when it is not
 * zero — so they read it the same way rather than each asking the registry.
 */
function useStageFloor(): number {
  return stageFloorHeight(useThemeSettings().resolvedBackground, useStageWidth());
}

/**
 * The viewport's width, kept current.
 *
 * A scene may draw itself smaller on a narrow window and ask for a smaller band
 * with it, so the band is not a number to read once at mount: a phone turned to
 * landscape would go on masking the portrait band for the rest of the session.
 *
 * The **viewport's**, not the window's, because the scene standing in the band
 * is laid out in the same measure. Read from `innerWidth` the band is reserved
 * for a window a scrollbar wider than the one the scenery was arranged for, and
 * "the band covers the scenery" stops being true by construction and becomes
 * true only where `clientWidth <= innerWidth` — which is platform coincidence.
 */
function useStageWidth(): number {
  return useSyncExternalStore(subscribeToResize, readStageWidth, () => 0);
}

/**
 * The footer's height as the page actually laid it out.
 *
 * The mask and the clip are positioned from the footer's top edge, and a scene
 * puts its ground there too — but the scene measures it (`footerHeight`) while
 * these used the configured number. The two agree only while the footer is
 * exactly 60px: at a larger text size or a browser zoom the scenery stands
 * higher than the band drawn to hide it, so the top of it is painted over the
 * user's list while the ground paints into the navigation bar.
 */
function useFooterHeight(): number {
  return useSyncExternalStore(subscribeToResize, footerHeight, () => FOOTER_HEIGHT);
}

/**
 * One listener for the whole stage, however many pieces of it are on screen.
 *
 * Each piece subscribing for itself put three `resize` handlers on a window that
 * fires the event tens of times through a single drag, all to read one number
 * they all read the same way.
 */
const resizeListeners = new Set<() => void>();

/**
 * The width, held rather than measured on demand.
 *
 * `useSyncExternalStore` re-reads the snapshot after every commit to check for
 * tearing, and returning a fresh measurement each time closes a loop this
 * component can drive on its own: `BackgroundSpacer` adds page height, that can
 * bring a scrollbar into being, the scrollbar takes width from `clientWidth`,
 * the narrower width asks for a shorter band, the shorter spacer lets the page
 * fit again and the scrollbar goes. React sees the two readings disagree with
 * no notification behind them and re-renders synchronously each time — measured
 * at 162 alternating reads before "Maximum update depth exceeded" blanks the
 * whole tree, with no error boundary above it.
 *
 * Holding the value fixes the tearing check by construction and takes a forced
 * style-and-layout flush off every render of the app: `clientWidth` flushes
 * layout where `innerWidth` did not, and this is read on every expenses update.
 */
let stageWidth = 0;

function readStageWidth(): number {
  return stageWidth;
}

function announceResize(): void {
  stageWidth = viewportSize().width;
  for (const listener of resizeListeners) listener();
}

/**
 * Watching the document as well as the window.
 *
 * A scrollbar appearing or disappearing changes what a `position: fixed` box has
 * to fill and fires **no** `resize` event at all — so a long list arriving on a
 * route change silently left the band measured for the width before it. The
 * observer catches that; the window listener catches everything else.
 */
let watching: ResizeObserver | null = null;

function subscribeToResize(onChange: () => void): () => void {
  if (resizeListeners.size === 0) {
    stageWidth = viewportSize().width;
    window.addEventListener('resize', announceResize);
    watching = typeof ResizeObserver === 'function' ? new ResizeObserver(announceResize) : null;
    watching?.observe(document.documentElement);
  }
  resizeListeners.add(onChange);
  return () => {
    resizeListeners.delete(onChange);
    if (resizeListeners.size === 0) {
      window.removeEventListener('resize', announceResize);
      watching?.disconnect();
      watching = null;
    }
  };
}

/** Room to scroll the last row clear of the floor, not just level with it. */
const SPARE_SCROLL = 20;

/**
 * An opaque strip across the bottom of the window. The scene's canvas covers the
 * whole viewport at a z-index above the app, so without this it would be drawn
 * over the content it is meant to be standing in front of.
 */
export function BackgroundFloor() {
  const height = useStageFloor();
  const footer = useFooterHeight();
  if (!height) return null;

  return (
    <div
      aria-hidden
      data-scene-floor
      style={{
        position: 'fixed',
        bottom: footer,
        left: 0,
        right: 0,
        height,
        zIndex: FLOOR_Z,
        pointerEvents: 'none',
        background: 'var(--mantine-color-body)',
      }}
    />
  );
}

/**
 * Where a background is put, and what it is allowed to paint on.
 *
 * Both decided here, for every background, because neither was ever a theme's to
 * decide. A scene draws on a canvas fixed across the whole viewport, which puts
 * the app's own navigation bar underneath it — Cello's opaque ground painted
 * over all five buttons and left an app that could not be navigated, with no
 * error to notice.
 *
 * A background declares only **how tall a band it needs** (`floor`, in the
 * registry). The stage turns that into a layer:
 *
 * - a band to stand in → `SCENE_Z`, in front of the list, clipped off the footer
 * - no band            → `BEHIND_Z`, behind the app, clipped off nothing
 *
 * That direction matters. When the scenes named their own layer, a new one
 * copying Cello's shape — which CLAUDE.md tells you to do — copied `zIndex: 101`
 * and could forget `floor`: no clip, no mask, no spacer, and a canvas painting
 * over the whole nav bar. Forgetting is now the *safe* direction: a scene with
 * no floor renders behind the app, which looks wrong rather than breaking the
 * app, and nothing a background writes in its own file can put it in front.
 *
 * `clip-path` rather than `overflow: hidden`, because the canvas inside is
 * `position: fixed` and would escape an ancestor's overflow. It clips only the
 * backgrounds that stand in a band: a full-page gradient is *meant* to run under
 * the translucent footer, and clipping it left a hard-edged strip there.
 *
 * Clipping also creates a stacking context, which is a one-way door — inside it
 * a child's own z-index never reaches the page. That is what makes this element
 * the only writer of the layer, and it is also how the gradient and matrix broke
 * when they were wrapped indiscriminately: their `-1` stopped reaching the page
 * and they were hoisted in front of every row, chart and form.
 *
 * `pointer-events: none` for the same reason it is here: no background should be
 * able to swallow a tap on the app behind it.
 */
export function SceneLayer({ children }: { children: ReactNode }) {
  const footer = useFooterHeight();
  // Asked of the background rather than measured off its band: which layer a
  // scene belongs on is a fact about the scene, and reading it as "a height
  // above zero at this width" both re-derives it and drags a resize
  // subscription into a component that has no use for the width.
  const overTheApp = drawsOverTheApp(useThemeSettings().resolvedBackground);

  return (
    <div
      aria-hidden
      data-scene-layer
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: overTheApp ? SCENE_Z : BEHIND_Z,
        pointerEvents: 'none',
        ...(overTheApp ? { clipPath: `inset(0 0 ${footer}px 0)` } : {}),
      }}
    >
      {children}
    </div>
  );
}

/**
 * Scroll room at the end of the page, so the last row of a list can be scrolled
 * clear of the floor above instead of sitting behind it forever.
 */
export function BackgroundSpacer() {
  const floor = useStageFloor();
  if (!floor) return null;

  return <div aria-hidden style={{ height: floor + SPARE_SCROLL }} />;
}
