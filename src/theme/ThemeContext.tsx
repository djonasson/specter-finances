import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  MantineProvider,
  createTheme,
  localStorageColorSchemeManager,
} from '@mantine/core';
import type { MantineColorsTuple } from '@mantine/core';
import { generateColors } from '@mantine/colors-generator';

export type BackgroundEffect = 'none' | 'matrix' | 'gradient';

interface ThemeSettings {
  primaryColor: string;
  customColorHex: string | null;
  backgroundEffect: BackgroundEffect;
}

interface ThemeContextValue extends ThemeSettings {
  setPrimaryColor: (colorKey: string) => void;
  setCustomColor: (hex: string) => void;
  setBackgroundEffect: (effect: BackgroundEffect) => void;
  resetTheme: () => void;
}

const STORAGE_KEY = 'specter-theme';

const DEFAULT_SETTINGS: ThemeSettings = {
  primaryColor: 'indigo',
  customColorHex: null,
  backgroundEffect: 'none',
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
    resetTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MantineProvider
        theme={theme}
        defaultColorScheme="auto"
        colorSchemeManager={colorSchemeManager}
      >
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
