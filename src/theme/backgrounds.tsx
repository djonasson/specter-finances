import { useEffect, useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import chroma from 'chroma-js';
import { useThemeSettings } from './ThemeContext';

function MatrixCanvas({ speed }: { speed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    let animationId: number;
    const fontSize = 14;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    let columns: number;
    let drops: number[];
    // speed 1 = ~150ms between frames, speed 10 = ~16ms (full 60fps)
    const frameInterval = Math.round(166 - speed * 15);
    let lastTime = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      const maxRow = Math.floor(canvas.height / fontSize);
      drops = Array.from({ length: columns }, () => Math.floor(Math.random() * maxRow));
    }

    function draw(time: number) {
      animationId = requestAnimationFrame(draw);
      if (time - lastTime < frameInterval) return;
      lastTime = time;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f0';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    resize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  );
}

function GradientBackground() {
  const { gradient } = useThemeSettings();
  const isDark = useComputedColorScheme('light') === 'dark';
  const colors = gradient.colors.map((c) =>
    isDark ? chroma(c).darken(2).hex() : c
  );
  const [c1, c2, c3] = colors;
  // speed 1 = 30s, speed 10 = 3s
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

export function BackgroundEffect() {
  const { backgroundEffect, matrixSpeed } = useThemeSettings();

  if (backgroundEffect === 'matrix') return <MatrixCanvas speed={matrixSpeed} />;
  if (backgroundEffect === 'gradient') return <GradientBackground />;
  return null;
}
