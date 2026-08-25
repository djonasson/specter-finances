import { useThemeSettings } from './ThemeContext';
import { backgroundFor } from './registry';
import { BackgroundFloor, SceneLayer } from './BackgroundStage';

export function BackgroundEffect() {
  const settings = useThemeSettings();
  // The background on screen, which is not always the one in the setting: a
  // `random` choice names no background at all, only the pool it shuffles.
  const background = backgroundFor(settings.resolvedBackground);

  return (
    <>
      {/* The stage decides which layer this background belongs on, and what it
          may paint over. A background only says how tall a band it needs. */}
      <SceneLayer>{background?.render(settings)}</SceneLayer>
      <BackgroundFloor />
    </>
  );
}
