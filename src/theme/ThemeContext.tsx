import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  MantineProvider,
  createTheme,
  localStorageColorSchemeManager,
} from '@mantine/core';
import type { MantineColorsTuple } from '@mantine/core';
import { generateColors } from '@mantine/colors-generator';

export type BackgroundEffect = 'none' | 'matrix' | 'gradient' | 'squirrel';

interface GradientSettings {
  colors: [string, string, string]; // three hex stops
  speed: number; // 1–10, default 5
}

interface ThemeSettings {
  primaryColor: string;
  customColorHex: string | null;
  backgroundEffect: BackgroundEffect;
  matrixSpeed: number; // 1 (slowest) to 10 (fastest), default 6
  cardOpacity: number; // 0 (fully transparent) to 100 (fully opaque), default 80
  gradient: GradientSettings;
}

interface ThemeContextValue extends ThemeSettings {
  setPrimaryColor: (colorKey: string) => void;
  setCustomColor: (hex: string) => void;
  setBackgroundEffect: (effect: BackgroundEffect) => void;
  setMatrixSpeed: (speed: number) => void;
  setCardOpacity: (opacity: number) => void;
  setGradient: (gradient: Partial<GradientSettings>) => void;
  resetTheme: () => void;
}

export type { GradientSettings };

const STORAGE_KEY = 'specter-theme';

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

function loadSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
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
    [update]
  );

  const setCustomColor = useCallback(
    (hex: string) => update({ primaryColor: 'custom', customColorHex: hex }),
    [update]
  );

  const setBackgroundEffect = useCallback(
    (effect: BackgroundEffect) => update({ backgroundEffect: effect }),
    [update]
  );

  const setMatrixSpeed = useCallback(
    (speed: number) => update({ matrixSpeed: speed }),
    [update]
  );

  const setCardOpacity = useCallback(
    (opacity: number) => update({ cardOpacity: opacity }),
    [update]
  );

  const setGradient = useCallback(
    (partial: Partial<GradientSettings>) =>
      setSettings((prev) => {
        const next = { ...prev, gradient: { ...prev.gradient, ...partial } };
        if (partial.colors) next.gradient.colors = partial.colors;
        saveSettings(next);
        return next;
      }),
    []
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

  const cardOpacityStyle = settings.backgroundEffect !== 'none' && settings.cardOpacity < 100
    ? `
      .mantine-Card-root,
      .mantine-AppShell-header,
      .mantine-AppShell-footer {
        opacity: ${settings.cardOpacity / 100} !important;
      }
      .mantine-Card-root:hover,
      .mantine-AppShell-header:hover {
        opacity: 1 !important;
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

export function useThemeSettings(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeSettings must be used within ThemeProvider');
  return ctx;
}
