// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ThemeProvider, useThemeSettings } from './ThemeContext';
import { DEFAULT_EXCLUDED, poolFrom } from './random';
import { BACKGROUND_NAMES } from './registry';
import { rolling, shufflingBetween } from '../test-utils';

const STORAGE_KEY = 'specter-theme';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);
const render = () => renderHook(() => useThemeSettings(), { wrapper });

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

/** Seed storage, then mount: every test here starts from what was stored. */
const renderWith = (settings: Record<string, unknown>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return render();
};

/** The card-transparency rule, which is only visible as injected CSS. */
const injectedCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((tag) => tag.textContent ?? '')
    .filter((css) => css.includes('mantine-Card-root'))
    .join('\n');

beforeEach(() => localStorage.clear());
// Unmounting matters here as much as clearing storage: the provider injects the
// card-transparency CSS into the document, and a left-over provider's rule would
// be indistinguishable from the next test's.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// Added retroactively. Everything here comes back out of localStorage, which
// anything on the origin can write and which survives every release — so the
// load path has to treat what it finds as untrusted. A bad value taken at face
// value renders the whole app unusable, and clearing storage is not something a
// user would think to do.

describe('reading stored settings', () => {
  it('starts from the defaults when nothing has been stored', () => {
    const { result } = render();
    expect(result.current.primaryColor).toBe('indigo');
    expect(result.current.backgroundEffect).toBe('none');
    expect(result.current.customColorHex).toBeNull();
  });

  it('restores what was stored', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ primaryColor: 'teal', backgroundEffect: 'matrix' }),
    );
    const { result } = render();
    expect(result.current.primaryColor).toBe('teal');
    expect(result.current.backgroundEffect).toBe('matrix');
  });

  it('falls back to the defaults rather than throwing on unparseable storage', () => {
    localStorage.setItem(STORAGE_KEY, 'not json at all');
    const { result } = render();
    expect(result.current.primaryColor).toBe('indigo');
  });

  it('fills in settings a stored older version never had', () => {
    // Storage outlives releases, so a value written before a setting existed
    // must not leave that setting undefined.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ primaryColor: 'teal' }));
    const { result } = render();
    expect(result.current.cardOpacity).toBeTypeOf('number');
    expect(result.current.gradient.colors).toHaveLength(3);
  });

  it('replaces a gradient that is not three colours', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gradient: { colors: ['#ffffff'], speed: 5 } }),
    );
    const { result } = render();
    expect(result.current.gradient.colors).toHaveLength(3);
  });

  it('replaces a gradient holding something that is not a colour', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gradient: { colors: ['#ffffff', 'red', 'javascript:alert(1)'] } }),
    );
    const { result } = render();
    result.current.gradient.colors.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
  });

  // Dropping the hex has to drop the choice that depended on it: the custom
  // colour only exists in the theme while its hex does, so leaving primaryColor
  // on 'custom' names a colour Mantine has never heard of — and it throws on
  // that, taking the whole app down at startup with no way back except clearing
  // storage by hand.
  it('drops a custom colour that is not a hex value, and the choice that needed it', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ primaryColor: 'custom', customColorHex: 'url(evil)' }),
    );
    const { result } = render();
    expect(result.current.customColorHex).toBeNull();
    expect(result.current.primaryColor).toBe('indigo');
  });

  it('survives storage naming a custom colour with no hex at all', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ primaryColor: 'custom' }));
    const { result } = render();
    expect(result.current.primaryColor).toBe('indigo');
  });

  it('keeps a custom colour that is a hex value', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ primaryColor: 'custom', customColorHex: '#ff8800' }),
    );
    const { result } = render();
    expect(result.current.customColorHex).toBe('#ff8800');
  });

  // A name from a build that had a background this one does not renders nothing
  // at all — an app that looks broken rather than a setting to change back.
  it('drops a background name no background answers to', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ backgroundEffect: 'pinball' }));
    const { result } = render();
    expect(result.current.backgroundEffect).toBe('none');
  });

  it('keeps a background name the app does have', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ backgroundEffect: 'squirrel' }));
    const { result } = render();
    expect(result.current.backgroundEffect).toBe('squirrel');
  });
});

describe('changing settings', () => {
  it('remembers a chosen colour across a restart', () => {
    const { result } = render();
    act(() => result.current.setPrimaryColor('grape'));
    expect(stored().primaryColor).toBe('grape');

    const second = render();
    expect(second.result.current.primaryColor).toBe('grape');
  });

  it('clears the custom colour when a named one is chosen', () => {
    const { result } = render();
    act(() => result.current.setCustomColor('#ff8800'));
    expect(result.current.customColorHex).toBe('#ff8800');

    act(() => result.current.setPrimaryColor('grape'));
    expect(result.current.customColorHex).toBeNull();
  });

  it('records a custom colour under its own primary key', () => {
    const { result } = render();
    act(() => result.current.setCustomColor('#ff8800'));
    expect(result.current.primaryColor).toBe('custom');
  });

  it('stores the background effect, the matrix speed and the card opacity', () => {
    const { result } = render();
    act(() => result.current.setBackgroundEffect('gradient'));
    act(() => result.current.setMatrixSpeed(3));
    act(() => result.current.setCardOpacity(0.5));

    expect(stored()).toMatchObject({
      backgroundEffect: 'gradient',
      matrixSpeed: 3,
      cardOpacity: 0.5,
    });
  });

  it('changes one part of the gradient without losing the rest', () => {
    const { result } = render();
    const before = result.current.gradient.colors;
    act(() => result.current.setGradient({ speed: 9 }));
    expect(result.current.gradient.speed).toBe(9);
    expect(result.current.gradient.colors).toEqual(before);
  });

  it('replaces the gradient colours as a set', () => {
    const { result } = render();
    const colors: [string, string, string] = ['#111111', '#222222', '#333333'];
    act(() => result.current.setGradient({ colors }));
    expect(result.current.gradient.colors).toEqual(colors);
    expect(stored().gradient.colors).toEqual(colors);
  });

  it('puts everything back, and remembers that too', () => {
    const { result } = render();
    act(() => result.current.setPrimaryColor('grape'));
    act(() => result.current.setBackgroundEffect('matrix'));

    act(() => result.current.resetTheme());

    expect(result.current.primaryColor).toBe('indigo');
    expect(result.current.backgroundEffect).toBe('none');
    expect(stored().primaryColor).toBe('indigo');
  });
});

// The card-transparency rule is injected as CSS rather than applied as an
// element opacity, so the text on a card stays fully opaque at every setting.
// Which selectors it names is the whole behaviour, and it is not visible from
// the hook's return value.
describe('the card transparency rule', () => {
  it('says nothing at all when there is no background to see through the cards', () => {
    renderWith({ backgroundEffect: 'none', cardOpacity: 50 });
    expect(injectedCss()).toBe('');
  });

  it('says nothing when the cards are meant to stay solid', () => {
    renderWith({ backgroundEffect: 'matrix', cardOpacity: 100 });
    expect(injectedCss()).toBe('');
  });

  it('tints the header and footer along with the cards, for a background drawn behind the app', () => {
    renderWith({ backgroundEffect: 'matrix', cardOpacity: 50 });
    expect(injectedCss()).toContain('.mantine-AppShell-header');
    expect(injectedCss()).toContain('.mantine-AppShell-footer');
  });

  // A scene that draws over the app stands on the header and footer. Tinting
  // them would show the scene through the very chrome it is drawn in front of.
  it('leaves the header and footer alone for a background drawn over the app', () => {
    renderWith({ backgroundEffect: 'squirrel', cardOpacity: 50 });
    expect(injectedCss()).toContain('.mantine-Card-root');
    expect(injectedCss()).not.toContain('.mantine-AppShell-header');
    expect(injectedCss()).not.toContain('.mantine-AppShell-footer');
  });
});

describe('using the context', () => {
  it('refuses to be used outside its provider rather than handing back nothing', () => {
    expect(() => renderHook(() => useThemeSettings())).toThrow(
      'useThemeSettings must be used within ThemeProvider',
    );
  });
});

// "Random" is stored as the choice; what the app draws is the background it
// resolved to for this launch. Everything that reacts to a background — the
// floor it stands in, the chrome the tint leaves alone, the scene itself — has
// to read the resolved one, or a shuffled Cello draws over an untinted app with
// no floor under it.
describe('shuffling between chosen backgrounds', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps showing exactly the background that was chosen, when one was', () => {
    // The unchanged path: a stored background resolves to itself, so every
    // existing setting renders what it always did.
    const { result } = renderWith({ backgroundEffect: 'squirrel' });
    expect(result.current.backgroundEffect).toBe('squirrel');
    expect(result.current.resolvedBackground).toBe('squirrel');
  });

  it('resolves to the plain background when nothing was chosen', () => {
    const { result } = render();
    expect(result.current.resolvedBackground).toBe('none');
  });

  it('picks one of the ticked backgrounds, and remembers the choice as random', () => {
    rolling(0.99);
    const { result } = renderWith(shufflingBetween('matrix', 'cello'));
    expect(result.current.backgroundEffect).toBe('random');
    expect(result.current.resolvedBackground).toBe('cello');
  });

  it('shuffles between every background but the plain one until told otherwise', () => {
    rolling(0);
    const { result } = renderWith({ backgroundEffect: 'random' });
    expect(result.current.randomPool).toEqual(poolFrom(DEFAULT_EXCLUDED));
    expect(result.current.resolvedBackground).not.toBe('none');
  });

  it('ignores a stored exclusion list that is not a list of backgrounds at all', () => {
    rolling(0);
    const { result } = renderWith({ backgroundEffect: 'random', randomExcluded: 'cello' });
    expect(result.current.randomPool).toEqual(poolFrom(DEFAULT_EXCLUDED));
  });

  // The direction that matters: an unrecognised stored name must not read as
  // "the user turned everything off" and leave a blank screen nobody asked for.
  it('shuffles everything again when no stored name is one this build knows', () => {
    rolling(0);
    const { result } = renderWith({
      backgroundEffect: 'random',
      randomExcluded: ['squirrelX', 'celloX'],
    });
    expect(result.current.randomPool).toEqual(BACKGROUND_NAMES);
  });

  it('shows nothing rather than something unticked when every background is turned off', () => {
    const { result } = renderWith(shufflingBetween());
    expect(result.current.randomPool).toEqual([]);
    expect(result.current.resolvedBackground).toBe('none');
  });

  it('draws the plain background when it is the one thing left ticked', () => {
    // Not the same state as an empty pool, and the drawer says so differently:
    // this one is a choice, and the screen is blank because that is what was
    // asked for.
    const { result } = renderWith(shufflingBetween('none'));
    expect(result.current.randomPool).toEqual(['none']);
    expect(result.current.resolvedBackground).toBe('none');
  });

  it('holds its pick for the whole session rather than re-rolling on every change', () => {
    // A scene that restarted every time a slider moved would be unusable.
    const roll = rolling(0);
    const { result } = renderWith(shufflingBetween('matrix', 'cello'));
    expect(result.current.resolvedBackground).toBe('matrix');

    roll.mockReturnValue(0.99);
    act(() => result.current.setCardOpacity(60));
    expect(result.current.resolvedBackground).toBe('matrix');
  });

  it('rolls again when random is chosen afresh', () => {
    const roll = rolling(0);
    const { result } = renderWith({
      ...shufflingBetween('matrix', 'cello'),
      backgroundEffect: 'cello',
    });

    roll.mockReturnValue(0.99);
    act(() => result.current.setBackgroundEffect('random'));
    expect(result.current.resolvedBackground).toBe('cello');
  });

  it('rolls again on being asked to shuffle, the picker having nothing left to change', () => {
    // Re-picking "Random" in a Select that already holds it fires no onChange,
    // so without this there is no way back to the dice short of a relaunch.
    const roll = rolling(0);
    const { result } = renderWith(shufflingBetween('matrix', 'cello'));
    expect(result.current.resolvedBackground).toBe('matrix');

    roll.mockReturnValue(0.99);
    act(() => result.current.shuffleBackground());
    expect(result.current.resolvedBackground).toBe('cello');
  });

  it('writes nothing to storage when all that changed is the roll', () => {
    // The roll is not a setting. A button made to be pressed repeatedly must not
    // rewrite the whole settings blob each press to persist nothing.
    const roll = rolling(0);
    const { result } = renderWith(shufflingBetween('matrix', 'cello'));
    const before = localStorage.getItem(STORAGE_KEY);

    roll.mockReturnValue(0.99);
    act(() => result.current.shuffleBackground());

    expect(result.current.resolvedBackground).toBe('cello');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('rolls again when the background it is showing is unticked', () => {
    rolling(0);
    const { result } = renderWith(shufflingBetween('matrix', 'cello'));
    expect(result.current.resolvedBackground).toBe('matrix');

    act(() => result.current.setRandomPool(['cello']));
    expect(result.current.resolvedBackground).toBe('cello');
  });

  it('leaves the background on screen alone when a different one is ticked', () => {
    const roll = rolling(0);
    const { result } = renderWith(shufflingBetween('matrix', 'cello'));
    expect(result.current.resolvedBackground).toBe('matrix');

    roll.mockReturnValue(0.99);
    act(() => result.current.setRandomPool(['matrix', 'gradient', 'cello']));
    expect(result.current.resolvedBackground).toBe('matrix');
  });

  // Two writers of one pair of values — the pool and the roll taken from it —
  // and React hands both of them the same render scope inside a batch. Read from
  // there rather than from the queued state, the roll comes off a pool that no
  // longer exists.
  it('rolls from the pool as it stands, not as it stood when the handler began', () => {
    rolling(0);
    const { result } = renderWith({
      ...shufflingBetween('matrix', 'cello'),
      backgroundEffect: 'cello',
    });

    act(() => {
      result.current.setRandomPool([]);
      result.current.setBackgroundEffect('random');
    });

    expect(result.current.randomPool).toEqual([]);
    expect(result.current.resolvedBackground).toBe('none');
  });

  it('never ends a batch of pool changes showing a background outside the last one', () => {
    // Two rolls, so the answer differs from the one a stale read gives: the
    // first change re-rolls to gradient, which the second change must then
    // notice is gone. Reading the roll out of the render scope sees the *first*
    // pool's matrix instead, keeps it, and never re-rolls at all.
    const roll = rolling(0);
    const { result } = renderWith(shufflingBetween('matrix', 'gradient', 'cello'));
    expect(result.current.resolvedBackground).toBe('matrix');

    act(() => {
      result.current.setRandomPool(['gradient', 'cello']);
      roll.mockReturnValue(0.99);
      result.current.setRandomPool(['matrix', 'cello']);
    });

    expect(result.current.randomPool).toEqual(['matrix', 'cello']);
    expect(result.current.resolvedBackground).toBe('cello');
  });

  it('remembers what was turned off across a restart', () => {
    rolling(0);
    const { result } = render();
    act(() => result.current.setRandomPool(['cello']));
    expect(stored().randomExcluded).toEqual(['none', 'matrix', 'gradient', 'squirrel']);

    cleanup();
    const second = render();
    expect(second.result.current.randomPool).toEqual(['cello']);
  });

  it('does not remember the background it happened to land on', () => {
    // Once per launch means a fresh pick each launch, so the roll is not a
    // setting. Storing it would freeze the first shuffle forever.
    rolling(0);
    renderWith(shufflingBetween('matrix', 'cello'));
    expect(stored().backgroundEffect).toBe('random');
    expect(stored()).not.toHaveProperty('rolled');
  });

  it('puts the shuffle back with the rest of the settings', () => {
    rolling(0);
    const { result } = renderWith(shufflingBetween('cello'));

    act(() => result.current.resetTheme());
    expect(result.current.backgroundEffect).toBe('none');
    expect(result.current.randomPool).toEqual(poolFrom(DEFAULT_EXCLUDED));
    expect(stored().randomExcluded).toEqual([...DEFAULT_EXCLUDED]);
  });
});

describe('the card transparency rule, when the background was shuffled', () => {
  afterEach(() => vi.restoreAllMocks());

  it('leaves the chrome alone when the shuffle landed on a scene that stands on it', () => {
    rolling(0);
    renderWith({ ...shufflingBetween('cello'), cardOpacity: 50 });
    expect(injectedCss()).toContain('.mantine-Card-root');
    expect(injectedCss()).not.toContain('.mantine-AppShell-header');
  });

  it('tints the chrome when the shuffle landed on a background drawn behind the app', () => {
    rolling(0);
    renderWith({ ...shufflingBetween('matrix'), cardOpacity: 50 });
    expect(injectedCss()).toContain('.mantine-AppShell-header');
  });

  // The rule turns on there being something to see through the cards. A shuffle
  // with nothing to pick from draws nothing, so tinting the chrome over it is
  // translucent furniture over a bare page.
  it('says nothing at all when the shuffle resolved to the plain background', () => {
    renderWith({ ...shufflingBetween(), cardOpacity: 50 });
    expect(injectedCss()).toBe('');
  });
});
