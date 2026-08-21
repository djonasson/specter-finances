import type { ReactNode } from 'react';
import { useThemeSettings } from './ThemeContext';
import { stageFloorHeight } from './registry';
import { FOOTER_HEIGHT, BEHIND_Z, FLOOR_Z, SCENE_Z } from './chrome';

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
  return stageFloorHeight(useThemeSettings().backgroundEffect);
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
  if (!height) return null;

  return (
    <div
      aria-hidden
      data-scene-floor
      style={{
        position: 'fixed',
        bottom: FOOTER_HEIGHT,
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
  const overTheApp = useStageFloor() > 0;

  return (
    <div
      aria-hidden
      data-scene-layer
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: overTheApp ? SCENE_Z : BEHIND_Z,
        pointerEvents: 'none',
        ...(overTheApp ? { clipPath: `inset(0 0 ${FOOTER_HEIGHT}px 0)` } : {}),
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
