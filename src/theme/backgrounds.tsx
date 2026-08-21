import { useThemeSettings } from './ThemeContext';
import { backgroundFor } from './registry';
import { BackgroundFloor, SceneLayer } from './BackgroundStage';

export function BackgroundEffect() {
  const settings = useThemeSettings();
  const background = backgroundFor(settings.backgroundEffect);

  return (
    <>
      {/* The stage decides which layer this background belongs on, and what it
          may paint over. A background only says how tall a band it needs. */}
      <SceneLayer>{background?.render(settings)}</SceneLayer>
      <BackgroundFloor />
    </>
  );
}
