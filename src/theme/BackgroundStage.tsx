import { useThemeSettings } from './ThemeContext';
import { stageFloorHeight } from './registry';
import { FOOTER_HEIGHT } from './chrome';

/**
 * The two pieces of layout a background that draws over the app needs from the
 * page. They mount in different places — the floor outside the AppShell, the
 * spacer inside its main area — so they cannot be one component, but they read
 * the same flag off the same registry and are never right one without the other.
 */

/** Room to scroll the last row clear of the floor, not just level with it. */
const SPARE_SCROLL = 20;

/**
 * An opaque strip across the bottom of the window. The scene's canvas covers the
 * whole viewport at a z-index above the app, so without this it would be drawn
 * over the content it is meant to be standing in front of.
 */
export function BackgroundFloor() {
  const { backgroundEffect } = useThemeSettings();
  const height = stageFloorHeight(backgroundEffect);
  if (!height) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        bottom: FOOTER_HEIGHT,
        left: 0,
        right: 0,
        height,
        zIndex: 100,
        pointerEvents: 'none',
        background: 'var(--mantine-color-body)',
      }}
    />
  );
}

/**
 * Scroll room at the end of the page, so the last row of a list can be scrolled
 * clear of the floor above instead of sitting behind it forever.
 */
export function BackgroundSpacer() {
  const { backgroundEffect } = useThemeSettings();
  const floor = stageFloorHeight(backgroundEffect);
  if (!floor) return null;

  return <div aria-hidden style={{ height: floor + SPARE_SCROLL }} />;
}
