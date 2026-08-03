/** How long to leave between two update checks, however often we are asked. */
export const UPDATE_CHECK_INTERVAL_MS = 60_000;

interface Updatable {
  update: () => unknown;
}

/**
 * Check for a new version when the app comes back to the foreground.
 *
 * It used to be a `setInterval` every minute, which kept re-fetching the worker
 * and revalidating the precache for as long as the tab existed — including all
 * the hours nobody was looking at it. An installed PWA is left open for days, so
 * that is a lot of work for a check that only matters when someone is about to
 * use the thing.
 *
 * Foreground is the moment that matters, and the interval survives as a floor so
 * flicking between windows cannot turn into a burst of requests.
 *
 * Returns a function that stops the checks.
 */
export function watchForUpdates(
  registration: Updatable,
  options: { now?: () => number; intervalMs?: number } = {},
): () => void {
  const now = options.now ?? (() => Date.now());
  const intervalMs = options.intervalMs ?? UPDATE_CHECK_INTERVAL_MS;

  let lastCheck = -Infinity;

  const check = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    const at = now();
    if (at - lastCheck < intervalMs) return;
    lastCheck = at;
    registration.update();
  };

  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  check();

  return () => {
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
  };
}
