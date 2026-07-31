import { useThemeSettings } from './ThemeContext';
import { MatrixBackground } from './MatrixBackground';
import { GradientBackground } from './GradientBackground';
import { SquirrelBackground } from './SquirrelBackground';

export function BackgroundEffect() {
  const { backgroundEffect, matrixSpeed } = useThemeSettings();

  if (backgroundEffect === 'matrix') return <MatrixBackground speed={matrixSpeed} />;
  if (backgroundEffect === 'gradient') return <GradientBackground />;
  if (backgroundEffect === 'squirrel') return <SquirrelBackground />;
  return null;
}
