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

interface Acorn {
  x: number;
  y: number;
  speed: number;
  wobble: number;
  wobbleSpeed: number;
  size: number;
  rotation: number;
  rotSpeed: number;
}

type Mood = 'neutral' | 'happy' | 'annoyed';

interface Squirrel {
  x: number;
  y: number;
  targetAcorn: number;
  vx: number;
  vy: number;
  mood: Mood;
  moodTimer: number; // frames remaining for current mood
}

function drawAcorn(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, isDark: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  // Acorn cap
  ctx.fillStyle = isDark ? '#8B6914' : '#6B4C12';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.15, size * 0.55, size * 0.35, 0, Math.PI, 0);
  ctx.fill();
  // Cap grid lines
  ctx.strokeStyle = isDark ? '#A07818' : '#8B6914';
  ctx.lineWidth = 0.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * size * 0.15, -size * 0.15);
    ctx.lineTo(i * size * 0.12, -size * 0.45);
    ctx.stroke();
  }
  // Stem
  ctx.strokeStyle = isDark ? '#6B4C12' : '#4a3408';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.45);
  ctx.lineTo(0, -size * 0.6);
  ctx.stroke();
  // Acorn body
  ctx.fillStyle = isDark ? '#C8922A' : '#A0721E';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.2, size * 0.45, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = isDark ? 'rgba(255,255,200,0.2)' : 'rgba(255,255,200,0.3)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.12, size * 0.08, size * 0.12, size * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSquirrel(ctx: CanvasRenderingContext2D, x: number, y: number, facingRight: boolean, isDark: boolean, mood: Mood, frame: number) {
  ctx.save();
  ctx.translate(x, y);
  if (!facingRight) ctx.scale(-1, 1);
  const fur = isDark ? '#A0764A' : '#8B5E3C';
  const belly = isDark ? '#D4B896' : '#C4A882';

  // Tail — changes shape based on mood
  ctx.fillStyle = fur;
  if (mood === 'happy') {
    // Wagging tail: smooth swinging motion
    const wag = Math.sin(frame * 0.4) * 8;
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.bezierCurveTo(-24 + wag, -22, -28 + wag, -34, -16 + wag, -36);
    ctx.bezierCurveTo(-6 + wag * 0.5, -38, -6, -22, -10, -10);
    ctx.fill();
  } else if (mood === 'annoyed') {
    // Fuzzy puffed-up tail: wider, jagged edges
    ctx.beginPath();
    ctx.moveTo(-14, -2);
    ctx.lineTo(-18, -10);
    ctx.lineTo(-26, -14);
    ctx.lineTo(-22, -20);
    ctx.lineTo(-30, -24);
    ctx.lineTo(-24, -28);
    ctx.lineTo(-28, -34);
    ctx.lineTo(-18, -32);
    ctx.lineTo(-14, -38);
    ctx.lineTo(-10, -30);
    ctx.lineTo(-4, -34);
    ctx.lineTo(-6, -26);
    ctx.lineTo(-2, -20);
    ctx.lineTo(-8, -16);
    ctx.lineTo(-6, -10);
    ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.fill();
  } else {
    // Neutral tail
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.bezierCurveTo(-24, -20, -30, -30, -18, -34);
    ctx.bezierCurveTo(-8, -36, -6, -22, -10, -10);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belly
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(2, 3, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.arc(12, -8, 8, 0, Math.PI * 2);
  ctx.fill();
  // Ears — flatten when annoyed
  if (mood === 'annoyed') {
    ctx.beginPath();
    ctx.ellipse(9, -15, 4, 2.5, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -15, 4, 2.5, 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(9, -17, 3, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -17, 3, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Snout
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(18, -6, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nose
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(22, -7, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Eye — changes with mood
  if (mood === 'happy') {
    // Happy squint: curved lines
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(15, -10, 2, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  } else if (mood === 'annoyed') {
    // Angry eye: angled brow
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(15, -10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(15.5, -10.5, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Angry brow
    ctx.strokeStyle = fur;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, -14);
    ctx.lineTo(17, -13);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(15, -10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(15.5, -10.5, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mouth — happy = smile
  if (mood === 'happy') {
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(19, -4, 2.5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  // Arms
  ctx.strokeStyle = fur;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  if (mood === 'annoyed') {
    // Arms crossed / fists up
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(14, -4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 4);
    ctx.lineTo(16, 0);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(20, 4);
    ctx.stroke();
  }
  // Legs
  ctx.beginPath();
  ctx.moveTo(-4, 10);
  ctx.lineTo(-6, 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, 10);
  ctx.lineTo(6, 18);
  ctx.stroke();
  ctx.restore();
}

function SquirrelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = useComputedColorScheme('light') === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let animationId: number;
    let acorns: Acorn[] = [];
    let frame = 0;
    const squirrel: Squirrel = { x: 0, y: 0, targetAcorn: -1, vx: 0, vy: 0, mood: 'neutral', moodTimer: 0 };

    function spawnAcorn(): Acorn {
      return {
        x: Math.random() * canvas.width,
        y: -20,
        speed: 0.5 + Math.random() * 1,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.02,
        size: 8 + Math.random() * 6,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
      };
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      squirrel.x = canvas.width / 2;
      squirrel.y = canvas.height - 85; // just above the footer
      acorns = Array.from({ length: 12 }, spawnAcorn);
      // Spread initial acorns across the screen
      for (const a of acorns) {
        a.y = Math.random() * canvas.height;
      }
    }

    let lastTime = 0;
    function draw(time: number) {
      animationId = requestAnimationFrame(draw);
      if (time - lastTime < 25) return; // ~40fps
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update & draw acorns
      for (let i = 0; i < acorns.length; i++) {
        const a = acorns[i];
        a.y += a.speed;
        a.wobble += a.wobbleSpeed;
        a.rotation += a.rotSpeed;
        const wx = Math.sin(a.wobble) * 20;

        drawAcorn(ctx, a.x + wx, a.y, a.size, a.rotation, isDark);

        // Acorn missed — fell past the squirrel
        if (a.y > canvas.height + 30) {
          // Only get annoyed if this was the one being chased
          if (i === squirrel.targetAcorn) {
            squirrel.mood = 'annoyed';
            squirrel.moodTimer = 60;
          }
          acorns[i] = spawnAcorn();
        }
      }

      // Mood timer countdown
      if (squirrel.moodTimer > 0) {
        squirrel.moodTimer--;
        if (squirrel.moodTimer === 0) squirrel.mood = 'neutral';
      }
      frame++;

      // Squirrel AI: chase nearest acorn on the ground level
      let nearest = -1;
      let nearDist = Infinity;
      for (let i = 0; i < acorns.length; i++) {
        const a = acorns[i];
        // Only chase acorns in the lower portion
        if (a.y > canvas.height * 0.5) {
          const dx = (a.x + Math.sin(a.wobble) * 20) - squirrel.x;
          const dy = a.y - squirrel.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearDist) {
            nearDist = dist;
            nearest = i;
          }
        }
      }

      if (nearest >= 0) {
        squirrel.targetAcorn = nearest;
        const a = acorns[nearest];
        const tx = a.x + Math.sin(a.wobble) * 20;
        const dx = tx - squirrel.x;
        squirrel.vx += dx * 0.005;
        squirrel.vx *= 0.92;
        squirrel.x += squirrel.vx;

        // "Catch" — squirrel reaches the acorn
        if (nearDist < 25 && a.y > canvas.height - 100) {
          squirrel.mood = 'happy';
          squirrel.moodTimer = 80;
          acorns[nearest] = spawnAcorn();
        }
      }

      // Keep squirrel on screen
      squirrel.x = Math.max(25, Math.min(canvas.width - 25, squirrel.x));

      drawSquirrel(ctx, squirrel.x, squirrel.y, squirrel.vx >= 0, isDark, squirrel.mood, frame);
    }

    resize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [isDark]);

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

export function BackgroundEffect() {
  const { backgroundEffect, matrixSpeed } = useThemeSettings();

  if (backgroundEffect === 'matrix') return <MatrixCanvas speed={matrixSpeed} />;
  if (backgroundEffect === 'gradient') return <GradientBackground />;
  if (backgroundEffect === 'squirrel') return <SquirrelCanvas />;
  return null;
}
