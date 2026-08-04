import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { MantineProvider, createTheme, localStorageColorSchemeManager } from '@mantine/core';
import type { MantineColorsTuple } from '@mantine/core';
import { generateColors } from '@mantine/colors-generator';
import { drawsOverTheApp, isBackgroundName } from './registry';
import type { BackgroundName } from './registry';

interface GradientSettings {
  colors: [string, string, string]; // three hex stops
  speed: number; // 1–10, default 5
}

interface ThemeSettings {
  primaryColor: string;
  customColorHex: string | null;
  backgroundEffect: BackgroundName;
  matrixSpeed: number; // 1 (slowest) to 10 (fastest), default 6
  cardOpacity: number; // 0 (fully transparent) to 100 (fully opaque), default 80
  gradient: GradientSettings;
}

interface ThemeContextValue extends ThemeSettings {
  setPrimaryColor: (colorKey: string) => void;
  setCustomColor: (hex: string) => void;
  setBackgroundEffect: (effect: BackgroundName) => void;
  setMatrixSpeed: (speed: number) => void;
  setCardOpacity: (opacity: number) => void;
  setGradient: (gradient: Partial<GradientSettings>) => void;
  resetTheme: () => void;
}

export type { GradientSettings };

/** Exported so the tests seed and read settings through the same name as the app. */
export const STORAGE_KEY = 'specter-theme';

const DEFAULT_GRADIENT: GradientSettings = {
  colors: ['#4c6ef5', '#23a6d5', '#23d5ab'],
  speed: 5,
};

const DEFAULT_SETTINGS: ThemeSettings = {
  primaryColor: 'indigo',
  customColorHex: null,
  backgroundEffect: 'none',
  matrixSpeed: 6,
  cardOpacity: 80,
  gradient: DEFAULT_GRADIENT,
};

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Merge stored settings over the defaults, discarding anything malformed.
 *
 * JSON.parse is `any`, and the spread lets stored keys override the defaults —
 * so a gradient written by an older build (wrong length, non-hex string) used
 * to reach chroma(), which throws. That happens at the App root with no error
 * boundary above it, i.e. a blank white app recoverable only by clearing
 * localStorage by hand.
 */
function loadSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const stored = JSON.parse(raw) as Partial<ThemeSettings>;
    const merged = { ...DEFAULT_SETTINGS, ...stored };

    const colors = merged.gradient?.colors;
    const usableGradient =
      Array.isArray(colors) && colors.length === 3 && colors.every((c) => HEX.test(String(c)));
    if (!usableGradient) merged.gradient = DEFAULT_GRADIENT;

    if (merged.customColorHex !== null && !HEX.test(String(merged.customColorHex))) {
      merged.customColorHex = DEFAULT_SETTINGS.customColorHex;
    }

    // A stored name can outlive the background it named, or name one this build
    // has never had. Taken at face value it renders nothing at all, which looks
    // like a broken app rather than a setting to change.
    if (!isBackgroundName(merged.backgroundEffect)) {
      merged.backgroundEffect = DEFAULT_SETTINGS.backgroundEffect;
    }

    // The custom colour only exists in the theme while its hex does, so a
    // primaryColor of 'custom' without one names a colour Mantine has never
    // heard of — and MantineProvider throws on that, taking the whole app down
    // at startup with no way back except clearing storage by hand. Dropping a
    // bad hex therefore has to drop the choice that depended on it.
    if (merged.primaryColor === 'custom' && !merged.customColorHex) {
      merged.primaryColor = DEFAULT_SETTINGS.primaryColor;
    }

    return merged;
  } catch {
    /* ignore malformed stored settings */
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: ThemeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const colorSchemeManager = localStorageColorSchemeManager({
  key: 'specter-color-scheme',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings);

  const update = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const setPrimaryColor = useCallback(
    (colorKey: string) => update({ primaryColor: colorKey, customColorHex: null }),
    [update],
  );

  const setCustomColor = useCallback(
    (hex: string) => update({ primaryColor: 'custom', customColorHex: hex }),
    [update],
  );

  const setBackgroundEffect = useCallback(
    (effect: BackgroundName) => update({ backgroundEffect: effect }),
    [update],
  );

  const setMatrixSpeed = useCallback((speed: number) => update({ matrixSpeed: speed }), [update]);

  const setCardOpacity = useCallback(
    (opacity: number) => update({ cardOpacity: opacity }),
    [update],
  );

  const setGradient = useCallback(
    (partial: Partial<GradientSettings>) =>
      setSettings((prev) => {
        const next = { ...prev, gradient: { ...prev.gradient, ...partial } };
        if (partial.colors) next.gradient.colors = partial.colors;
        saveSettings(next);
        return next;
      }),
    [],
  );

  const resetTheme = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  const theme = useMemo(() => {
    const colors: Record<string, MantineColorsTuple> = {};
    if (settings.customColorHex) {
      colors.custom = generateColors(settings.customColorHex);
    }
    return createTheme({
      primaryColor: settings.primaryColor,
      colors,
      fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
    });
  }, [settings.primaryColor, settings.customColorHex]);

  const value: ThemeContextValue = {
    ...settings,
    setPrimaryColor,
    setCustomColor,
    setBackgroundEffect,
    setMatrixSpeed,
    setCardOpacity,
    setGradient,
    resetTheme,
  };

  // A background that draws over the app stands on the header and footer, so
  // they stay opaque: tinting them would show the scene through the very chrome
  // it is drawn in front of. The registry says which backgrounds those are.
  const chromeStaysOpaque = drawsOverTheApp(settings.backgroundEffect);
  // Fade only the surface, never the content. Setting `opacity` on the element
  // would fade its text too — at the low end of the slider that is a guaranteed
  // WCAG AA failure, and it can't be undone on hover because touch devices have
  // no hover. Tinting the background colour keeps text fully opaque, and the
  // backdrop blur keeps the animated background from bleeding through behind it.
  const cardOpacityStyle =
    settings.backgroundEffect !== 'none' && settings.cardOpacity < 100
      ? `
      .mantine-Card-root${
        !chromeStaysOpaque
          ? `,
      .mantine-AppShell-header,
      .mantine-AppShell-footer`
          : ''
      } {
        background-color: color-mix(
          in srgb,
          var(--mantine-color-body) ${settings.cardOpacity}%,
          transparent
        ) !important;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .mantine-AppShell-main {
        background: transparent !important;
      }
    `
      : '';

  return (
    <ThemeContext.Provider value={value}>
      <MantineProvider
        theme={theme}
        defaultColorScheme="auto"
        colorSchemeManager={colorSchemeManager}
      >
        {cardOpacityStyle && <style>{cardOpacityStyle}</style>}
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useThemeSettings(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeSettings must be used within ThemeProvider');
  return ctx;
}
