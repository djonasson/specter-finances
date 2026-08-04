import { useThemeSettings } from './ThemeContext';
import { backgroundFor } from './registry';
import { BackgroundFloor } from './BackgroundStage';

export function BackgroundEffect() {
  const settings = useThemeSettings();
  const background = backgroundFor(settings.backgroundEffect);

  return (
    <>
      {background?.render(settings)}
      <BackgroundFloor />
    </>
  );
}
