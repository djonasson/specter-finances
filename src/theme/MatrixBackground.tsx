import { useEffect, useRef } from 'react';
import { canvasPixelRatio as pixelRatio, fitCanvas } from './chrome';

export function MatrixBackground({ speed }: { speed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    let animationId: number;
    const fontSize = 14;
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    let columns: number;
    let drops: number[];
    // In CSS pixels: the buffer behind it is denser, and `fitCanvas` has already
    // scaled the context so that nothing here has to know.
    let width = 0;
    let height = 0;
    let ratio = 0;
    const frameInterval = Math.round(166 - speed * 15);
    let lastTime = 0;

    function resize() {
      // Mobile browsers fire `resize` repeatedly as the URL bar collapses, often
      // with the same numbers, and refitting reallocates and zeroes the whole
      // buffer — four times the bytes now it is in device pixels — then
      // re-randomises every drop, so the rain visibly restarts. Cello carries
      // the same guard for the same reason.
      if (window.innerWidth === width && window.innerHeight === height && ratio === pixelRatio())
        return;
      ({ width, height, ratio } = fitCanvas(canvas, ctx));
      columns = Math.floor(width / fontSize);
      const maxRow = Math.floor(height / fontSize);
      drops = Array.from({ length: columns }, () => Math.floor(Math.random() * maxRow));
    }

    function draw(time: number) {
      animationId = requestAnimationFrame(draw);
      if (time - lastTime < frameInterval) return;
      lastTime = time;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#0f0';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
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
      }}
    />
  );
}
