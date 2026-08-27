// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderWithTheme, resizeTo, rolling, shufflingBetween } from '../test-utils';
import { STAGED_BACKGROUNDS, stageFloorHeight } from './registry';
import { BackgroundFloor, BackgroundSpacer, SceneLayer } from './BackgroundStage';
import { FOOTER_HEIGHT, viewportSize } from './chrome';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
  // Whatever a test stubbed or spied, put back. Leaving a `clientWidth` spy
  // behind made the very next test measure a window that was not there — which
  // under a shuffled order is any test in the file, and showed up as roughly a
  // one-in-ten flake rather than as anything reproducible.
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Both of these render a single bare div or nothing at all, and the provider
 * around them injects a `<style>` of its own — so the assertion has to name the
 * div rather than take whatever came first.
 */
function renderStage(ui: Parameters<typeof renderWithTheme>[0], settings: Record<string, unknown>) {
  return renderWithTheme(ui, settings).container.querySelector('div');
}

/** The same, for a background nobody named: see the shuffle describe below. */
function renderShuffled(ui: Parameters<typeof renderWithTheme>[0], pool: string[]) {
  rolling(0);
  return renderStage(ui, shufflingBetween(...pool));
}

// The scene's canvas covers the whole viewport at a z-index above the app. These
// two are what make that survivable: the floor hides everything but the band the
// scene plays in, and the spacer keeps the last row of a list from being parked
// behind it. Rendered for the wrong background they hide content for no reason;
// missing for the right one they let a canvas cover the app.

describe('the floor a scene stands on', () => {
  it('appears for a background that draws over the app', () => {
    expect(renderStage(<BackgroundFloor />, { backgroundEffect: 'squirrel' })).not.toBeNull();
  });

  it.each(['none', 'matrix', 'gradient'])(
    'stays away from the %s background, which draws behind the app',
    (effect) => {
      expect(renderStage(<BackgroundFloor />, { backgroundEffect: effect })).toBeNull();
    },
  );

  it('is hidden from a screen reader, being a mask over an animation', () => {
    expect(renderStage(<BackgroundFloor />, { backgroundEffect: 'squirrel' })).toHaveAttribute(
      'aria-hidden',
    );
  });

  it('lets clicks through, so it cannot swallow a tap on the app behind it', () => {
    expect(
      renderStage(<BackgroundFloor />, { backgroundEffect: 'squirrel' })?.style.pointerEvents,
    ).toBe('none');
  });

  // The registry decides how much room a scene needs; a floor that ignored it
  // would mask the wrong band for one of them.
  it.each(STAGED_BACKGROUNDS)('is as tall as %s asked for', (effect) => {
    const height = parseInt(
      renderStage(<BackgroundFloor />, { backgroundEffect: effect })!.style.height,
    );
    expect(height).toBe(stageFloorHeight(effect, viewportSize().width));
  });
});

describe('the room left below the content', () => {
  it('is reserved for a background that draws over the app', () => {
    expect(renderStage(<BackgroundSpacer />, { backgroundEffect: 'squirrel' })).not.toBeNull();
  });

  it('is not taken from a background that draws behind the app', () => {
    expect(renderStage(<BackgroundSpacer />, { backgroundEffect: 'gradient' })).toBeNull();
  });

  // A spacer shorter than the floor leaves the last row behind it with no way to
  // scroll it clear, which is the whole failure it exists to prevent — and it has
  // to hold for every scene, not just the one that happened to be checked.
  it.each(STAGED_BACKGROUNDS)('clears the floor %s asked for', (effect) => {
    const spacer = parseInt(
      renderStage(<BackgroundSpacer />, { backgroundEffect: effect })!.style.height,
    );
    expect(spacer).toBeGreaterThan(stageFloorHeight(effect, viewportSize().width));
  });
});

// The band belongs to the scene on screen, not to the setting: a shuffle that
// landed on Cello needs Cello's floor and Cello's scroll room.
describe('the band a shuffled scene stands in', () => {
  it('is as tall as the background the shuffle landed on asked for', () => {
    const floor = renderShuffled(<BackgroundFloor />, ['cello']);
    expect(parseInt(floor!.style.height)).toBe(stageFloorHeight('cello', viewportSize().width));
  });

  it('reserves scroll room that clears the floor the scene stands in', () => {
    const spacer = parseInt(renderShuffled(<BackgroundSpacer />, ['cello'])!.style.height);
    expect(spacer).toBeGreaterThan(stageFloorHeight('cello', viewportSize().width));
  });

  it('stays away when the shuffle landed on a background drawn behind the app', () => {
    expect(renderShuffled(<BackgroundFloor />, ['matrix'])).toBeNull();
    cleanup();
    expect(renderShuffled(<BackgroundSpacer />, ['matrix'])).toBeNull();
  });
});

// The band is the scene's own height, and the scene is drawn smaller on a narrow
// window — so the floor has to be re-measured when the window changes, not read
// once at mount. Left as a mount-time number it masks the wrong band for the
// rest of the session, which on a phone rotated to landscape is most of it.
describe('the band following the window', () => {
  it('shrinks the floor when the window narrows', () => {
    window.innerWidth = 1440;
    const floor = renderStage(<BackgroundFloor />, { backgroundEffect: 'cello' })!;
    const wide = parseInt(floor.style.height);

    resizeTo(360);
    expect(parseInt(floor.style.height)).toBeLessThan(wide);
    expect(parseInt(floor.style.height)).toBe(stageFloorHeight('cello', 360));
  });

  it('shrinks the scroll room with it, so the two cannot disagree', () => {
    window.innerWidth = 1440;
    const spacer = renderStage(<BackgroundSpacer />, { backgroundEffect: 'cello' })!;
    const wide = parseInt(spacer.style.height);

    resizeTo(360);
    expect(parseInt(spacer.style.height)).toBeLessThan(wide);
  });
});

describe('measuring the same viewport the scene is drawn in', () => {
  // The band and the scenery standing in it have to be worked out from one
  // width. `CelloBackground` lays the scene out in `viewportSize()`, so a stage
  // reading `innerWidth` reserves a band for a window a scrollbar wider than
  // the one the scene was arranged for — the invariant that the band covers the
  // scenery stops holding by construction and holds only by platform
  // coincidence. `viewportSize` exists so there is one answer.
  it('takes its width from the viewport, not from the window', () => {
    vi.stubGlobal('innerWidth', 1024);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(600);

    const floor = renderStage(<BackgroundFloor />, { backgroundEffect: 'cello' });

    expect(stageFloorHeight('cello', 600)).not.toBe(stageFloorHeight('cello', 1024));
    expect(parseInt(floor!.style.height)).toBe(stageFloorHeight('cello', 600));
  });
});

describe('what the stage costs the window', () => {
  it('listens for a resize once, however many pieces of the stage are mounted', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    renderWithTheme(
      <>
        <BackgroundFloor />
        <BackgroundSpacer />
      </>,
      { backgroundEffect: 'cello' },
    );

    const resizes = addListener.mock.calls.filter(([event]) => event === 'resize');
    expect(resizes).toHaveLength(1);
    addListener.mockRestore();
  });
});

// The scene's ground is measured from the footer as it is actually laid out
// (`footerHeight()`), while the mask over it used the configured number. They
// agree only while the footer is exactly the height the constant says: at a
// larger text size or a browser zoom the scenery rises above its own mask and is
// drawn over the user's list, with the ground painting into the nav bar.
describe('lining up with the footer as it is really laid out', () => {
  function footerOfHeight(height: number) {
    const footer = document.createElement('div');
    footer.className = 'mantine-AppShell-footer';
    footer.getBoundingClientRect = () => ({ height }) as DOMRect;
    document.body.appendChild(footer);
    return footer;
  }

  it('anchors the floor to the footer that is there, not to the constant', () => {
    const footer = footerOfHeight(FOOTER_HEIGHT + 30);
    const floor = renderStage(<BackgroundFloor />, { backgroundEffect: 'cello' })!;

    expect(floor.style.bottom).toBe(`${FOOTER_HEIGHT + 30}px`);
    footer.remove();
  });

  it('clips the scene off that same footer', () => {
    const footer = footerOfHeight(FOOTER_HEIGHT + 30);
    const { container } = renderWithTheme(
      <SceneLayer>
        <div />
      </SceneLayer>,
      { backgroundEffect: 'cello' },
    );

    const layer = container.querySelector<HTMLElement>('[data-scene-layer]')!;
    expect(layer.style.clipPath).toBe(`inset(0 0 ${FOOTER_HEIGHT + 30}px 0)`);
    footer.remove();
  });

  it('falls back to the configured height when there is no footer to measure', () => {
    // The sign-in screen has no AppShell at all.
    const floor = renderStage(<BackgroundFloor />, { backgroundEffect: 'cello' })!;
    expect(floor.style.bottom).toBe(`${FOOTER_HEIGHT}px`);
  });
});
