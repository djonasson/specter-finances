/**
 * Where the app's own chrome sits, for the backgrounds that have to line up with
 * it. A scene that draws over the app stands on the footer, and the floor that
 * masks it is positioned from the same edge — so the two have to agree, and the
 * number was previously written out separately in both.
 */

/** Matches the AppShell footer height set in `App.tsx`. */
export const FOOTER_HEIGHT = 60;

/**
 * Where each layer of the background system sits, as one ladder.
 *
 * Written together because each is meaningless without the others: the whole
 * content of `SCENE_Z` is "one above the floor". Naming only one of a pair reads
 * as though the other were not load-bearing.
 *
 * - `BEHIND_Z` — a background that paints behind the app, which is most of them.
 * - `FLOOR_Z` — the opaque band that hides the user's list where a scene stands.
 * - `SCENE_Z` — a scene standing in that band, drawn against it.
 *
 * All three belong to `SceneLayer`, never to a scene: a background says how tall
 * a band it needs and the stage decides what that means, so no scene can put
 * itself in front of the app by writing a number in its own file.
 */
export const BEHIND_Z = -1;
export const FLOOR_Z = 100;
export const SCENE_Z = FLOOR_Z + 1;

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
