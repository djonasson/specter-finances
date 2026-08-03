// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { watchForUpdates, UPDATE_CHECK_INTERVAL_MS } from './swUpdates';

/** Drives the clock and the page's visibility by hand. */
function harness(startVisible = true) {
  let visible = startVisible;
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() =>
    visible ? 'visible' : 'hidden',
  );

  let clock = 0;
  const registration = { update: vi.fn() };
  const stop = watchForUpdates(registration, { now: () => clock });

  return {
    registration,
    stop,
    advance: (ms: number) => {
      clock += ms;
    },
    show: () => {
      visible = true;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    hide: () => {
      visible = false;
      document.dispatchEvent(new Event('visibilitychange'));
    },
    refocus: () => window.dispatchEvent(new Event('focus')),
  };
}

afterEach(() => vi.restoreAllMocks());

// This replaced a setInterval that re-fetched the worker every minute for as
// long as the tab existed. An installed PWA is left open for days, so almost
// all of that work happened while nobody was looking.

describe('watchForUpdates', () => {
  it('checks once as soon as it starts, for a tab already in front of someone', () => {
    const { registration } = harness();
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('checks nothing at all while the page is in the background', () => {
    const { registration } = harness(false);
    expect(registration.update).not.toHaveBeenCalled();
  });

  it('checks when the app comes back to the foreground', () => {
    const h = harness(false);
    h.advance(UPDATE_CHECK_INTERVAL_MS);
    h.show();
    expect(h.registration.update).toHaveBeenCalledTimes(1);
  });

  it('checks when the window is refocused', () => {
    const h = harness();
    h.advance(UPDATE_CHECK_INTERVAL_MS);
    h.refocus();
    expect(h.registration.update).toHaveBeenCalledTimes(2);
  });

  // Flicking between windows must not become a burst of requests.
  it('will not check twice inside the interval, however often it is asked', () => {
    const h = harness();
    h.refocus();
    h.hide();
    h.show();
    h.refocus();
    expect(h.registration.update).toHaveBeenCalledTimes(1);
  });

  it('checks again once the interval has passed', () => {
    const h = harness();
    h.advance(UPDATE_CHECK_INTERVAL_MS);
    h.refocus();
    expect(h.registration.update).toHaveBeenCalledTimes(2);
  });

  it('stops checking once detached, so a torn-down app makes no requests', () => {
    const h = harness();
    h.stop();
    h.advance(UPDATE_CHECK_INTERVAL_MS * 10);
    h.refocus();
    h.show();
    expect(h.registration.update).toHaveBeenCalledTimes(1);
  });
});
