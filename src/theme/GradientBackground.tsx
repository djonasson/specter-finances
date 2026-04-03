import { useComputedColorScheme } from '@mantine/core';
import chroma from 'chroma-js';
import { useThemeSettings } from './ThemeContext';

export function GradientBackground() {
  const { gradient } = useThemeSettings();
  const isDark = useComputedColorScheme('light') === 'dark';
  const colors = gradient.colors.map((c: string) =>
    isDark ? chroma(c).darken(2).hex() : c
  );
  const [c1, c2, c3] = colors;
  const duration = Math.round(33 - gradient.speed * 3);

  const style: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: -1,
    pointerEvents: 'none',
    background: `linear-gradient(-45deg, ${c1}, ${c2}, ${c3}, ${c1})`,
    backgroundSize: '400% 400%',
    animation: `gradientShift ${duration}s ease infinite`,
  };

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div style={style} />
    </>
  );
}
