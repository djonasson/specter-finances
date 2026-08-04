/**
 * Where the app's own chrome sits, for the backgrounds that have to line up with
 * it. A scene that draws over the app stands on the footer, and the floor that
 * masks it is positioned from the same edge — so the two have to agree, and the
 * number was previously written out separately in both.
 */

/** Matches the AppShell footer height set in `App.tsx`. */
export const FOOTER_HEIGHT = 60;

/**
 * The footer's height as laid out, falling back to the configured one.
 *
 * The fallback covers two cases, not one: no footer (the sign-in screen has no
 * AppShell) and a footer that is mounted but not yet laid out, which reports
 * zero. Taking that zero at face value would put the scene's ground at the very
 * bottom of the window, behind the navigation bar.
 */
export function footerHeight(): number {
  const footer = document.querySelector('.mantine-AppShell-footer');
  if (!footer) return FOOTER_HEIGHT;
  return footer.getBoundingClientRect().height || FOOTER_HEIGHT;
}
