import type { ReactNode } from 'react';
import { MatrixBackground } from './MatrixBackground';
import { GradientBackground } from './GradientBackground';
import { SquirrelBackground } from './SquirrelBackground';
import { CelloBackground, CELLO_FLOOR } from './cello/CelloBackground';
import type { GradientSettings } from './ThemeContext';

/**
 * What a background is handed to draw itself. The settings object the provider
 * holds satisfies this, so a background that needs a new knob declares it here
 * rather than reaching into the context and coupling itself to the app.
 */
export interface BackgroundProps {
  matrixSpeed: number;
  gradient: GradientSettings;
}

export interface BackgroundDescriptor {
  value: string;
  /** The only copy the picker shows. */
  label: string;
  render: (props: BackgroundProps) => ReactNode;
  /**
   * How tall a band this background needs to stand in, or absent if it does not
   * stand in one at all. Present means the background draws *over* the app — its
   * canvas sits at z-index 101, not -1 — and three things follow from that,
   * always together: an opaque floor masking everything above the band, scroll
   * room under the content so the last row is not hidden behind that floor, and
   * a header and footer the card-transparency tint leaves alone, since the scene
   * would otherwise show through the chrome it stands on.
   *
   * The height belongs to the scene, not to the layout: a background whose
   * tallest thing is a bird needs far less of the screen than one with a domed
   * oven and two people beside it. It covers what the scene *stands* in, not
   * what it throws — a pizza sailing up over the app, like the squirrel's
   * falling acorns, is meant to be seen there.
   */
  floor?: number;
}

/**
 * Every background the app has, and the only place any of them is named.
 *
 * App code asks this list what a background needs — it never asks which one is
 * showing. That is what keeps a theme's quirks inside `src/theme/`: adding one
 * is a single entry here, and no `if` anywhere else.
 */
export const BACKGROUNDS = [
  { value: 'none', label: 'None', render: () => null },
  {
    value: 'matrix',
    label: 'Matrix',
    render: ({ matrixSpeed }) => <MatrixBackground speed={matrixSpeed} />,
  },
  {
    value: 'gradient',
    label: 'Gradient',
    render: ({ gradient }) => <GradientBackground gradient={gradient} />,
  },
  {
    value: 'squirrel',
    label: 'Squirrel',
    render: () => <SquirrelBackground />,
    floor: 80,
  },
  {
    value: 'cello',
    label: 'Cello',
    render: () => <CelloBackground />,
    // Taller than the squirrel's: this scene has a domed oven on a plinth and
    // two people standing beside it, not one bird's worth of ground. The scene
    // works the number out from its own geometry rather than being told it.
    floor: CELLO_FLOOR,
  },
] as const satisfies readonly BackgroundDescriptor[];

/** The picker's options, shaped once here rather than on every render. */
/** Every background's name, shaped once here rather than on every call that wants them. */
export const BACKGROUND_NAMES: BackgroundName[] = BACKGROUNDS.map(({ value }) => value);

export const BACKGROUND_OPTIONS = BACKGROUNDS.map(({ value, label }) => ({ value, label }));

/**
 * Derived from the list rather than written beside it, so a background cannot be
 * half-added: a name that is not in `BACKGROUNDS` does not compile.
 *
 * Named for the setting rather than the effect, because `BackgroundEffect` is
 * already the component in `backgrounds.tsx` that renders one of these.
 */
export type BackgroundName = (typeof BACKGROUNDS)[number]['value'];

/**
 * The background that draws nothing. Named here rather than spelled out wherever
 * something falls back to it, so the fallback is typed as a background.
 */
export const PLAIN_BACKGROUND = 'none' satisfies BackgroundName;

export function backgroundFor(value: string): BackgroundDescriptor | undefined {
  return BACKGROUNDS.find((background) => background.value === value);
}

/**
 * Storage outlives releases and any page on this origin can write it, so a
 * stored background name is not to be trusted — it may name an effect a later
 * build removed, or one an earlier build never had.
 */
export function isBackgroundName(value: unknown): value is BackgroundName {
  return typeof value === 'string' && BACKGROUNDS.some((background) => background.value === value);
}

/** See `floor` above: how tall a band this background stands in, if any. */
export function stageFloorHeight(value: string): number {
  return backgroundFor(value)?.floor ?? 0;
}

/** Derived from the same number, so the two can never disagree. */
export function drawsOverTheApp(value: string): boolean {
  return stageFloorHeight(value) > 0;
}

/** The ones that draw over the app, for anything that has to cover them all. */
export const STAGED_BACKGROUNDS = BACKGROUNDS.filter((background) =>
  drawsOverTheApp(background.value),
).map((background) => background.value);

/**
 * The picker's other entry: shuffle between the backgrounds the user ticked,
 * once per launch.
 *
 * Deliberately *not* an entry in `BACKGROUNDS` — it has nothing to render and no
 * floor to stand in, so the stage would be asking it for both and getting the
 * wrong answer. It is a choice about which background to show, and everything
 * downstream reads the background it resolved to instead.
 */
export const RANDOM_BACKGROUND = 'random';

/** What the setting may hold: a background, or the instruction to pick one. */
export type BackgroundChoice = BackgroundName | typeof RANDOM_BACKGROUND;

/** The picker's own options: the backgrounds, plus the shuffle. */
export const BACKGROUND_CHOICE_OPTIONS = [
  ...BACKGROUND_OPTIONS,
  { value: RANDOM_BACKGROUND, label: 'Random' },
];

/** As `isBackgroundName`, for the setting that may also hold the shuffle. */
export function isBackgroundChoice(value: unknown): value is BackgroundChoice {
  return value === RANDOM_BACKGROUND || isBackgroundName(value);
}
