import { useEffect, useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';
import { useThemeSettings } from './ThemeContext';

function MatrixCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    let animationId: number;
    const fontSize = 14;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    let columns: number;
    let drops: number[];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = Array(columns).fill(1);
    }

    function draw() {
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
      animationId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

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
  const colorScheme = useComputedColorScheme('light');
  const isDark = colorScheme === 'dark';

  const style: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: -1,
    pointerEvents: 'none',
    background: isDark
      ? 'linear-gradient(-45deg, var(--mantine-primary-color-filled), #1a5276, #1a7a6d, var(--mantine-primary-color-light))'
      : 'linear-gradient(-45deg, var(--mantine-primary-color-filled), #23a6d5, #23d5ab, var(--mantine-primary-color-light))',
    opacity: isDark ? 0.3 : 1,
    backgroundSize: '400% 400%',
    animation: 'gradientShift 15s ease infinite',
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
  const { backgroundEffect } = useThemeSettings();

  if (backgroundEffect === 'matrix') return <MatrixCanvas />;
  if (backgroundEffect === 'gradient') return <GradientBackground />;
  return null;
}
