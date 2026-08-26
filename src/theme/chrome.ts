/**
 * Where the app's own chrome sits, for the backgrounds that have to line up with
 * it. A scene that draws over the app stands on the footer, and the floor that
 * masks it is positioned from the same edge — so the two have to agree, and the
 * number was previously written out separately in both.
 */

/** Matches the AppShell footer height set in `App.tsx`. */
export const FOOTER_HEIGHT = 60;
/** And its header, which the squirrel's icicles hang from. */
export const HEADER_HEIGHT = 56;

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
  return chromeHeight('.mantine-AppShell-footer', FOOTER_HEIGHT);
}

/**
 * The header's, on the same terms — a background hangs things from its bottom
 * edge.
 *
 * It lived in `SquirrelBackground` with a fallback of its own and without the
 * zero guard, which is the whole reason this one is shared: the two readings
 * are the same question and there is no version of it that should differ.
 */
export function headerHeight(): number {
  return chromeHeight('.mantine-AppShell-header', HEADER_HEIGHT);
}

function chromeHeight(selector: string, fallback: number): number {
  const element = document.querySelector(selector);
  if (!element) return fallback;
  return element.getBoundingClientRect().height || fallback;
}

/**
 * The most of the screen's own pixels a background will draw.
 *
 * A background canvas covers the whole viewport and is repainted tens of times
 * a second for as long as the app is open, so its cost grows with the square of
 * this. A phone at 3 would paint nine times the pixels of a CSS-sized buffer,
 * and most of them never hold anything — a scene only reaches its floor up the
 * screen. Two takes the whole of the sharpness that matters and a fraction of
 * the paint.
 */
export const MAX_PIXEL_RATIO = 2;

/** What a background should draw at, given the screen it is on. */
export function canvasPixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

/**
 * How big the viewport is: its width as CSS lays it out, its height as the
 * window reports it.
 *
 * The two axes are asked differently on purpose, and it is not tidiness that
 * decides it. A classic scrollbar takes **width** from the containing block of
 * a `position: fixed` box while still counting towards `innerWidth`, so a
 * canvas sized from the window has its last strip drawn off the side of the
 * screen — which is what `clientWidth` is here for. The height has no such
 * problem and a worse one of its own: `clientHeight` is the layout viewport,
 * pinned to the small viewport on a phone, so it does **not** move when the URL
 * bar collapses. The footer is measured with `getBoundingClientRect`, which
 * does. Taking the height from it detached the scene's ground from the
 * navigation bar it stands on — permanently, since a height that cannot change
 * also tells every resize guard that nothing has.
 *
 * Not `innerWidth`: a classic scrollbar counts towards that but not towards the
 * containing block of a `position: fixed` box, so a canvas sized from it has
 * `left`, `right` and `width` all constrained, CSS drops `right`, and the last
 * strip of the background is drawn off the side of the screen.
 *
 * One definition, because a background that fits to one measure and decides
 * whether to re-fit by another never re-fits — or never stops. That is not
 * hypothetical: the guards were comparing `innerWidth` against what `fitCanvas`
 * had measured, so on any desktop with a scrollbar they never once fired.
 */
export function viewportSize(): { width: number; height: number } {
  // Falling back on a falsy reading, not only on a missing one: `clientWidth` is
  // 0 in jsdom and wherever the document is not laid out, and a canvas sized to
  // zero draws nothing and — since the guards then agree it has not changed —
  // never recovers. `documentElement` itself is not nullable, so there is
  // nothing here to optional-chain.
  return {
    width: document.documentElement.clientWidth || window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Point a full-window canvas at the screen's own pixels, and hand back the size
 * to draw in.
 *
 * Every canvas background is `position: fixed; inset: 0`, so CSS stretches it
 * over the viewport whatever its buffer holds. Sized in CSS pixels the scene was
 * drawn at a fraction of the screen's resolution and blown back up by the
 * display — soft on a laptop at 1.25, and on a phone at 3 every edge upscaled
 * threefold. Three things have to happen together, which is why they live here
 * rather than in any one background: the buffer goes in device pixels, the CSS
 * size is set explicitly (a canvas with no size in its style lays out at its
 * *attribute* size, so a device-pixel buffer makes the element wider than the
 * window), and the context is scaled so everything drawn afterwards still works
 * in CSS pixels — which is what lets a background use the returned width and
 * height and know nothing else about any of this.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): { width: number; height: number; ratio: number } {
  const ratio = canvasPixelRatio();
  const { width, height } = viewportSize();
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  // Absolute, not relative: resizing a canvas resets its transform, and this
  // runs again on every resize.
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { width, height, ratio };
}

/**
 * Call `onChange` whenever the screen's pixel density changes, and hand back the
 * teardown.
 *
 * A ratio change is **not** a resize event: moving a window between monitors, or
 * changing the display scale, can leave `innerWidth` and `innerHeight` exactly
 * where they were, and `resize` is not specified to fire. A background watching
 * the window alone keeps the launch screen's buffer for as long as the tab
 * lives — which for an installed PWA is days — and in the 1x-to-2x direction
 * that is the very softness `fitCanvas` exists to remove.
 *
 * It lives here rather than in a scene for the same reason `fitCanvas` does: all
 * three canvas backgrounds need it, and one that forgot would simply be blurry
 * on a second monitor, with nothing failing anywhere.
 */
export function watchPixelRatio(onChange: () => void): () => void {
  let query: MediaQueryList | null = null;
  let watchingRatio = false;

  const fired = () => {
    onChange();
    arm();
  };

  function arm() {
    query?.removeEventListener('change', fired);
    // Guarded on the listener, not only on `matchMedia`. Safari 13 and iOS 13
    // return a real MediaQueryList carrying `addListener` and no
    // `addEventListener`, and the throw would land in an effect body before its
    // cleanup closure exists — React unmounts the whole app over a background.
    const next = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query = typeof next?.addEventListener === 'function' ? next : null;
    query?.addEventListener('change', fired);
    // Attached whatever it reports, but remembering whether it can be trusted.
    // A query born false can never *change* to false, so it would never fire —
    // fractional display scaling reports ratios like 1.100000023841858, whose
    // serialised dppx need not compare equal to itself. Refusing to attach at
    // all would be a one-way door: `arm` is reachable only from `fired`, so one
    // bad reading would end the watch for the life of the tab.
    watchingRatio = query !== null && query.matches;
  }

  arm();
  // The fallback, for when it cannot: a resize is the only other moment the
  // ratio is worth re-reading, and re-arming there gives a query that was born
  // false a chance to be replaced by one that is not.
  const onResize = () => {
    if (!watchingRatio) arm();
  };
  window.addEventListener('resize', onResize);

  return () => {
    query?.removeEventListener('change', fired);
    window.removeEventListener('resize', onResize);
    query = null;
  };
}
