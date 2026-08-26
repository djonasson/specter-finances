import '@testing-library/jest-dom/vitest';

// Runs for every suite, including the node-environment service tests — so
// everything here is guarded on a DOM actually being present.
if (typeof window !== 'undefined') {
  // Mantine reads matchMedia (useComputedColorScheme, visibleFrom/hiddenFrom)
  // and jsdom does not implement it.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  // Mantine's Combobox (Select) keeps the highlighted option in view. jsdom has
  // no layout, so it does not implement this at all.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // jsdom lays nothing out, so `documentElement.clientWidth` is 0 — and
  // `viewportSize` falls back to `innerWidth` on exactly that. Left alone, every
  // test in the suite would run down the fallback, which is the one branch that
  // cannot tell the document's measure from the window's apart, while a browser
  // always takes the other. Following the window here puts the whole suite on
  // the path production takes; a test wanting the two to differ — a scrollbar —
  // spies the getter itself, which wins over this.
  for (const [name, of] of [
    ['clientWidth', 'innerWidth'],
    ['clientHeight', 'innerHeight'],
  ] as const) {
    Object.defineProperty(document.documentElement, name, {
      configurable: true,
      get: () => window[of],
    });
  }

  // Mantine's ScrollArea/Table.ScrollContainer observe their container.
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}
