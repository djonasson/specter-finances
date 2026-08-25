import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { MantineProvider, createTheme, localStorageColorSchemeManager } from '@mantine/core';
import type { MantineColorsTuple } from '@mantine/core';
import { generateColors } from '@mantine/colors-generator';
import {
  drawsOverTheApp,
  isBackgroundChoice,
  PLAIN_BACKGROUND,
  RANDOM_BACKGROUND,
} from './registry';
import type { BackgroundChoice, BackgroundName } from './registry';
import { DEFAULT_EXCLUDED, excludedFor, pickBackground, poolFrom, toExcluded } from './random';

interface GradientSettings {
  colors: [string, string, string]; // three hex stops
  speed: number; // 1–10, default 5
}

interface ThemeSettings {
  primaryColor: string;
  customColorHex: string | null;
  backgroundEffect: BackgroundChoice;
  /**
   * The backgrounds a `random` choice leaves *out*, never the ones it shuffles
   * between — see `poolFrom`. Stored the other way round, a background added to
   * the registry later would join nobody's shuffle.
   */
  randomExcluded: BackgroundName[];
  matrixSpeed: number; // 1 (slowest) to 10 (fastest), default 6
  cardOpacity: number; // 0 (fully transparent) to 100 (fully opaque), default 80
  gradient: GradientSettings;
}

interface ThemeContextValue extends ThemeSettings {
  /** The backgrounds a `random` choice shuffles between, derived from the registry. */
  randomPool: BackgroundName[];
  /**
   * The background actually on screen: the chosen one, or the one this launch's
   * shuffle landed on. Everything that reacts to a background reads this — the
   * floor it stands in, the chrome the card tint leaves alone, the scene itself
   * — since `backgroundEffect` may name no background at all.
   */
  resolvedBackground: BackgroundName;
  setPrimaryColor: (colorKey: string) => void;
  setCustomColor: (hex: string) => void;
  setBackgroundEffect: (effect: BackgroundChoice) => void;
  /** Takes the backgrounds to shuffle between; what is stored is the rest. */
  setRandomPool: (pool: readonly string[]) => void;
  /** Rolls again now, for the picker that cannot re-offer a choice already made. */
  shuffleBackground: () => void;
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
  backgroundEffect: PLAIN_BACKGROUND,
  randomExcluded: [...DEFAULT_EXCLUDED],
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
    if (!isBackgroundChoice(merged.backgroundEffect)) {
      merged.backgroundEffect = DEFAULT_SETTINGS.backgroundEffect;
    }

    // Same reasoning, over a list — and in the direction that fails safe: an
    // unrecognised name here puts a background back into the shuffle rather than
    // emptying it. See `toExcluded`.
    merged.randomExcluded = toExcluded(merged.randomExcluded);

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

/**
 * The settings, plus the background this launch's shuffle landed on.
 *
 * One state atom rather than two, because the roll is only meaningful against
 * the pool it came from: kept apart, the writer of one reads the other out of
 * the render scope, which inside a React batch is the value *before* the batch.
 * Together, every writer sees the pair as it actually stands.
 */
interface ThemeState {
  settings: ThemeSettings;
  /**
   * Rolled once, when the app starts, and held for the session: a scene that
   * restarted every time a slider moved would be unusable. Deliberately not
   * stored — once per launch means a fresh pick each launch, and a stored roll
   * would freeze the first shuffle forever.
   */
  rolled: BackgroundName;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [{ settings, rolled }, setState] = useState<ThemeState>(() => {
    const loaded = loadSettings();
    return {
      settings: loaded,
      rolled: pickBackground(poolFrom(loaded.randomExcluded), Math.random()),
    };
  });

  // Not memoised: the context value it goes into is rebuilt every render anyway,
  // so nothing downstream could hold on to a stable identity even if it had one.
  const randomPool = poolFrom(settings.randomExcluded);

  const resolvedBackground =
    settings.backgroundEffect === RANDOM_BACKGROUND ? rolled : settings.backgroundEffect;

  /**
   * Writes a settings change and the roll that goes with it in one update.
   *
   * `rollFor` is handed the roll as it stands and the pool the change leaves
   * behind — both from inside the updater, which is the whole point: read off
   * the render scope instead and a second change in the same React batch rolls
   * against the pool the first one already replaced. The roll *value* is drawn
   * by the caller, outside: React invokes updaters twice under StrictMode, so
   * `Math.random()` in here would be computed once and thrown away.
   */
  const updateWithRoll = useCallback(
    (
      partial: Partial<ThemeSettings>,
      rollFor: (rolled: BackgroundName, pool: BackgroundName[]) => BackgroundName,
    ) => {
      setState((prev) => {
        const next = { ...prev.settings, ...partial };
        saveSettings(next);
        return { settings: next, rolled: rollFor(prev.rolled, poolFrom(next.randomExcluded)) };
      });
    },
    [],
  );

  /** A settings change that leaves the shuffle where it is. */
  const update = useCallback(
    (partial: Partial<ThemeSettings>) => updateWithRoll(partial, (rolled) => rolled),
    [updateWithRoll],
  );

  const setPrimaryColor = useCallback(
    (colorKey: string) => update({ primaryColor: colorKey, customColorHex: null }),
    [update],
  );

  const setCustomColor = useCallback(
    (hex: string) => update({ primaryColor: 'custom', customColorHex: hex }),
    [update],
  );

  const setBackgroundEffect = useCallback(
    (effect: BackgroundChoice) => {
      const roll = Math.random();
      // Choosing the shuffle is itself an ask for a background, so it rolls now
      // rather than showing whatever the last roll happened to be.
      updateWithRoll({ backgroundEffect: effect }, (rolled, pool) =>
        effect === RANDOM_BACKGROUND ? pickBackground(pool, roll) : rolled,
      );
    },
    [updateWithRoll],
  );

  const setRandomPool = useCallback(
    (pool: readonly string[]) => {
      const roll = Math.random();
      const randomExcluded = excludedFor(pool);
      // Re-roll only when the background on screen is no longer one of them:
      // doing it on every tick would yank the scene away while someone is still
      // building the list.
      updateWithRoll({ randomExcluded }, (rolled, nextPool) =>
        nextPool.includes(rolled) ? rolled : pickBackground(nextPool, roll),
      );
    },
    [updateWithRoll],
  );

  const shuffleBackground = useCallback(() => {
    const roll = Math.random();
    // Deliberately not `updateWithRoll`: nothing about the settings changes, and
    // a button meant to be pressed repeatedly should not rewrite storage each
    // time to persist a value that is never persisted.
    setState((prev) => ({
      ...prev,
      rolled: pickBackground(poolFrom(prev.settings.randomExcluded), roll),
    }));
  }, []);

  const setMatrixSpeed = useCallback((speed: number) => update({ matrixSpeed: speed }), [update]);

  const setCardOpacity = useCallback(
    (opacity: number) => update({ cardOpacity: opacity }),
    [update],
  );

  const setGradient = useCallback(
    (partial: Partial<GradientSettings>) =>
      setState((prev) => {
        const next = { ...prev.settings, gradient: { ...prev.settings.gradient, ...partial } };
        saveSettings(next);
        return { ...prev, settings: next };
      }),
    [],
  );

  // A complete settings object, so the spread inside `update` is a replacement.
  const resetTheme = useCallback(() => update(DEFAULT_SETTINGS), [update]);

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
    randomPool,
    resolvedBackground,
    setPrimaryColor,
    setCustomColor,
    setBackgroundEffect,
    setRandomPool,
    shuffleBackground,
    setMatrixSpeed,
    setCardOpacity,
    setGradient,
    resetTheme,
  };

  // A background that draws over the app stands on the header and footer, so
  // they stay opaque: tinting them would show the scene through the very chrome
  // it is drawn in front of. The registry says which backgrounds those are.
  const chromeStaysOpaque = drawsOverTheApp(resolvedBackground);
  // Fade only the surface, never the content. Setting `opacity` on the element
  // would fade its text too — at the low end of the slider that is a guaranteed
  // WCAG AA failure, and it can't be undone on hover because touch devices have
  // no hover. Tinting the background colour keeps text fully opaque, and the
  // backdrop blur keeps the animated background from bleeding through behind it.
  const cardOpacityStyle =
    resolvedBackground !== PLAIN_BACKGROUND && settings.cardOpacity < 100
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
