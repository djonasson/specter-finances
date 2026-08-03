// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ThemeProvider, useThemeSettings } from './ThemeContext';

const STORAGE_KEY = 'specter-theme';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);
const render = () => renderHook(() => useThemeSettings(), { wrapper });

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

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

describe('using the context', () => {
  it('refuses to be used outside its provider rather than handing back nothing', () => {
    expect(() => renderHook(() => useThemeSettings())).toThrow(
      'useThemeSettings must be used within ThemeProvider',
    );
  });
});
