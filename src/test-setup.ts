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

  // Mantine's ScrollArea/Table.ScrollContainer observe their container.
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}
