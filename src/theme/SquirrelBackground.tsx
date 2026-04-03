import { useEffect, useRef } from 'react';
import { useComputedColorScheme } from '@mantine/core';


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

interface IceBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  meltTimer: number; // frames until fully melted
  maxMelt: number;
  falling: boolean;
  fallSpeed: number;
  vx: number; // horizontal velocity
}

interface IceShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  rotation: number;
  rotSpeed: number;
}

type Mood = 'neutral' | 'happy' | 'annoyed' | 'anxious' | 'flattened';

interface Squirrel {
  x: number;
  y: number;
  targetAcorn: number;
  vx: number;
  vy: number;
  mood: Mood;
  moodTimer: number; // frames remaining for current mood
  invincible: number; // frames of invincibility after un-flattening
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
  if (mood === 'flattened') {
    // Draw a completely different flattened state
    const fur = isDark ? '#A0764A' : '#8B5E3C';
    const furDark = isDark ? '#7A5630' : '#6B4428';
    const belly = isDark ? '#D4B896' : '#C4A882';

    // Tail sticking straight up
    const p = new Path2D();
    p.moveTo(-4, 14);
    p.bezierCurveTo(-6, -10, -8, -30, -2, -42);
    p.bezierCurveTo(2, -48, 6, -30, 4, -10);
    p.lineTo(2, 14);
    p.closePath();
    ctx.fillStyle = fur;
    ctx.fill(p);
    // Tail stripes
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = furDark;
    for (let si = 0; si < 4; si++) {
      const ty = 10 - si * 12;
      ctx.fillRect(-10, ty, 20, 5);
    }
    ctx.restore();

    // Flat pancake body on ground
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, 18, 22, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly showing
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(2, 18, 14, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dazed X eyes poking out
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 14);
    ctx.lineTo(20, 18);
    ctx.moveTo(20, 14);
    ctx.lineTo(16, 18);
    ctx.stroke();

    // Snout poking out flat
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(24, 17, 8, 2, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(31, 16, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Stars circling above (dazed effect)
    for (let si = 0; si < 3; si++) {
      const angle = frame * 0.08 + si * Math.PI * 2 / 3;
      const sx = Math.cos(angle) * 12;
      const sy = Math.sin(angle) * 5 - 48;
      ctx.fillStyle = '#ffdd44';
      ctx.font = '6px sans-serif';
      ctx.fillText('★', sx - 3, sy);
    }

    // Speech bubble
    ctx.restore();
    return;
  }
  const fur = isDark ? '#A0764A' : '#8B5E3C';
  const furDark = isDark ? '#7A5630' : '#6B4428';
  const belly = isDark ? '#D4B896' : '#C4A882';

  // Tail — striped, changes shape based on mood
  function drawStripedTail(path: Path2D) {
    // Base fur color
    ctx.fillStyle = fur;
    ctx.fill(path);
    // Clip to tail shape for stripes perpendicular to the tail curve
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = furDark;
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const t1 = (i * 2 + 1) / (steps * 2 + 1);
      const t2 = (i * 2 + 2) / (steps * 2 + 1);
      const cy1 = -4 + t1 * -42;
      const cy2 = -4 + t2 * -42;
      const cx = -10 + ((t1 + t2) / 2) * -6 + Math.sin(((t1 + t2) / 2) * Math.PI) * -6;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy1);
      ctx.lineTo(cx + 12, cy1);
      ctx.lineTo(cx + 12, cy2);
      ctx.lineTo(cx - 12, cy2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Outline
    ctx.strokeStyle = furDark;
    ctx.lineWidth = 0.5;
    ctx.stroke(path);
  }

  if (mood === 'happy') {
    const wag = Math.sin(frame * 0.4) * 8;
    const p = new Path2D();
    p.moveTo(-12, -4);
    p.bezierCurveTo(-20 + wag, -24, -24 + wag, -40, -14 + wag, -46);
    p.bezierCurveTo(-8 + wag * 0.5, -48, -6, -28, -10, -10);
    p.closePath();
    drawStripedTail(p);
  } else if (mood === 'annoyed') {
    const p = new Path2D();
    p.moveTo(-12, -2);
    p.lineTo(-16, -12);
    p.lineTo(-24, -16);
    p.lineTo(-20, -22);
    p.lineTo(-26, -28);
    p.lineTo(-20, -32);
    p.lineTo(-24, -38);
    p.lineTo(-16, -36);
    p.lineTo(-14, -46);
    p.lineTo(-10, -38);
    p.lineTo(-4, -40);
    p.lineTo(-6, -32);
    p.lineTo(-2, -24);
    p.lineTo(-6, -18);
    p.lineTo(-4, -12);
    p.lineTo(-8, -8);
    p.closePath();
    drawStripedTail(p);
  } else if (mood === 'anxious') {
    // Stiff, bristled tail — trembles slightly
    const t = Math.sin(frame * 0.6) * 2;
    const p = new Path2D();
    p.moveTo(-12, -4);
    p.bezierCurveTo(-22 + t, -24, -28 + t, -40, -16 + t, -48);
    p.bezierCurveTo(-8 + t, -50, -5, -30, -9, -10);
    p.closePath();
    drawStripedTail(p);
  } else {
    const p = new Path2D();
    p.moveTo(-12, -4);
    p.bezierCurveTo(-20, -24, -26, -38, -14, -46);
    p.bezierCurveTo(-6, -48, -4, -28, -8, -10);
    p.closePath();
    drawStripedTail(p);
  }

  // Body
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belly
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(2, 3, 6, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.arc(12, -12, 8, 0, Math.PI * 2);
  ctx.fill();
  // Ears — flatten when annoyed/anxious/flattened
  if (mood === 'annoyed' || mood === 'anxious') {
    ctx.beginPath();
    ctx.ellipse(9, -19, 4, 2.5, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -19, 4, 2.5, 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(9, -21, 3, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -21, 3, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Long snout (rounder tip)
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(16, -8);
  ctx.bezierCurveTo(22, -8, 30, -10, 33, -11);
  ctx.bezierCurveTo(35, -12, 35, -14, 33, -15);
  ctx.bezierCurveTo(30, -16, 22, -16, 16, -14);
  ctx.closePath();
  ctx.fill();
  // Nose at tip
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(34, -13, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // Two saber teeth hanging from upper snout
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(28, -11);
  ctx.lineTo(29.5, -11);
  ctx.lineTo(28.8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(31, -11.5);
  ctx.lineTo(32.5, -11.5);
  ctx.lineTo(31.8, -4.5);
  ctx.closePath();
  ctx.fill();
  // Eye — changes with mood
  if (mood === 'happy') {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(15, -14, 2, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
  } else if (mood === 'annoyed') {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(15, -14, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(15.5, -14.5, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Angry brow
    ctx.strokeStyle = fur;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, -18);
    ctx.lineTo(17, -17);
    ctx.stroke();
  } else if (mood === 'anxious') {
    // Wide trembling eye
    const tremble = Math.sin(frame * 0.8) * 0.5;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(15 + tremble, -14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(15.5 + tremble, -14.5, 1, 0, Math.PI * 2);
    ctx.fill();
    // Worry lines above eye
    ctx.strokeStyle = fur;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(13, -18);
    ctx.lineTo(17, -18.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(13, -19.5);
    ctx.lineTo(17, -20);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(15, -14, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(15.5, -14.5, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mouth — happy = smile
  if (mood === 'happy') {
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(19, -8, 2.5, 0.2, Math.PI - 0.2);
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
  } else if (mood === 'anxious') {
    // Hands up in panic, trembling
    const t = Math.sin(frame * 1.2) * 1;
    ctx.beginPath();
    ctx.moveTo(6, -2);
    ctx.lineTo(14 + t, -8 + t);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(16 + t, -4 + t);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(20, 4);
    ctx.stroke();
  }
  // Legs
  ctx.beginPath();
  ctx.moveTo(-4, 14);
  ctx.lineTo(-6, 22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, 14);
  ctx.lineTo(6, 22);
  ctx.stroke();
  // Long thin feet (pointing forward)
  ctx.strokeStyle = belly;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, 22);
  ctx.lineTo(0, 24);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, 22);
  ctx.lineTo(12, 24);
  ctx.stroke();
  // Toes
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.lineTo(2, 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.lineTo(1, 27);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 24);
  ctx.lineTo(14, 26);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 24);
  ctx.lineTo(13, 27);
  ctx.stroke();
  ctx.restore();
}

function drawSpeechBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, progress: number, isDark: boolean) {
  // progress: 1 = just appeared, 0 = about to disappear
  const alpha = Math.min(1, progress * 2); // fade out in the last half
  const rise = (1 - progress) * 15; // float upward over time
  const bx = x + 20;
  const by = y - 40 - rise;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 11px system-ui, sans-serif';
  const metrics = ctx.measureText(text);
  const pw = metrics.width + 14;
  const ph = 22;

  // Bubble background
  ctx.fillStyle = isDark ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx - pw / 2, by - ph / 2, pw, ph, 8);
  ctx.fill();
  ctx.stroke();

  // Tail pointer
  ctx.fillStyle = isDark ? 'rgba(50,50,50,0.9)' : 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(bx - 4, by + ph / 2);
  ctx.lineTo(bx - 8, by + ph / 2 + 6);
  ctx.lineTo(bx + 2, by + ph / 2);
  ctx.fill();

  // Text
  ctx.fillStyle = isDark ? '#e0e0e0' : '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx, by);
  ctx.restore();
}

function drawIceBlock(ctx: CanvasRenderingContext2D, ice: IceBlock, isDark: boolean) {
  const meltProgress = 1 - ice.meltTimer / ice.maxMelt;
  const shrink = meltProgress * 0.6;
  const w = ice.width * (1 - shrink);
  const h = ice.height * (1 - shrink);
  const cx = ice.x;
  const by = ice.y; // bottom of ice

  ctx.save();
  ctx.globalAlpha = 0.4 + 0.6 * (1 - meltProgress);

  // Irregular ice shape (jagged polygon)
  ctx.fillStyle = isDark ? 'rgba(140,210,240,0.7)' : 'rgba(180,230,250,0.8)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, by);
  ctx.lineTo(cx - w * 0.5, by - h * 0.3);
  ctx.lineTo(cx - w * 0.35, by - h * 0.7);
  ctx.lineTo(cx - w * 0.15, by - h * 0.95);
  ctx.lineTo(cx + w * 0.1, by - h);
  ctx.lineTo(cx + w * 0.35, by - h * 0.85);
  ctx.lineTo(cx + w * 0.5, by - h * 0.5);
  ctx.lineTo(cx + w * 0.45, by - h * 0.15);
  ctx.lineTo(cx + w * 0.4, by);
  ctx.closePath();
  ctx.fill();

  // Inner facets (lighter shards)
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, by - h * 0.2);
  ctx.lineTo(cx - w * 0.15, by - h * 0.7);
  ctx.lineTo(cx + w * 0.05, by - h * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.1, by - h * 0.3);
  ctx.lineTo(cx + w * 0.3, by - h * 0.7);
  ctx.lineTo(cx + w * 0.35, by - h * 0.4);
  ctx.closePath();
  ctx.fill();

  // Glossy highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.15, by - h * 0.6, w * 0.08, h * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Edge outline
  ctx.strokeStyle = isDark ? 'rgba(100,190,220,0.5)' : 'rgba(130,200,230,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, by);
  ctx.lineTo(cx - w * 0.5, by - h * 0.3);
  ctx.lineTo(cx - w * 0.35, by - h * 0.7);
  ctx.lineTo(cx - w * 0.15, by - h * 0.95);
  ctx.lineTo(cx + w * 0.1, by - h);
  ctx.lineTo(cx + w * 0.35, by - h * 0.85);
  ctx.lineTo(cx + w * 0.5, by - h * 0.5);
  ctx.lineTo(cx + w * 0.45, by - h * 0.15);
  ctx.lineTo(cx + w * 0.4, by);
  ctx.closePath();
  ctx.stroke();

  // Drips when melting
  if (meltProgress > 0.2) {
    ctx.fillStyle = isDark ? 'rgba(140,210,240,0.4)' : 'rgba(180,230,250,0.5)';
    const dripCount = Math.floor(meltProgress * 4);
    for (let i = 0; i < dripCount; i++) {
      const dx = cx + (i - dripCount / 2) * w * 0.2;
      const dy = by + meltProgress * 5 * (i + 1);
      ctx.beginPath();
      ctx.ellipse(dx, dy, 1.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function SquirrelBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = useComputedColorScheme('light') === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let animationId: number;
    let acorns: Acorn[] = [];
    let iceBlocks: IceBlock[] = [];
    let iceShards: IceShard[] = [];
    let iceSpawnTimer = 300; // frames until next ice block
    let megaIceTimer = 800 + Math.random() * 600; // first mega in 20-35 seconds

    function spawnFlyingChunks(x: number, y: number, parentSize: number) {
      // More chunks for bigger blocks
      const sizeFactor = parentSize / 40; // ~1 for medium, ~2 for mega
      const count = Math.floor((2 + Math.random() * 3) * sizeFactor);
      for (let i = 0; i < count; i++) {
        // Cap chunk size below the shatter threshold so they don't chain-react
        const w = 6 + Math.random() * Math.min(parentSize * 0.4, 28);
        const melt = 80 + Math.random() * 200;
        const speed = (2 + Math.random() * 5) * Math.min(sizeFactor, 1.5);
        const launchAngle = -Math.PI * (0.1 + Math.random() * 0.7);
        const dir = Math.random() > 0.5 ? 1 : -1;
        iceBlocks.push({
          x: x + (Math.random() - 0.5) * parentSize * 0.5,
          y: y - Math.random() * 15,
          width: w,
          height: w * (0.4 + Math.random() * 0.8),
          meltTimer: melt,
          maxMelt: melt,
          falling: true,
          fallSpeed: Math.sin(launchAngle) * speed * (1 + Math.random()),
          vx: Math.cos(launchAngle) * speed * dir * (1 + Math.random() * 2),
        });
      }
      // Shards scale with size
      const shardBursts = Math.ceil(sizeFactor * 2);
      for (let i = 0; i < shardBursts; i++) {
        spawnShards(x + (Math.random() - 0.5) * parentSize * 0.5, y, parentSize);
      }
    }

    function spawnShards(x: number, y: number, size: number) {
      const count = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI * 0.1 - Math.random() * Math.PI * 0.8; // upward spread
        const speed = 2 + Math.random() * 3;
        iceShards.push({
          x,
          y,
          vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
          vy: Math.sin(angle) * speed,
          size: 1.5 + Math.random() * (size * 0.1),
          life: 20 + Math.floor(Math.random() * 20),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
        });
      }
    }
    let frame = 0;
    const squirrel: Squirrel = { x: 0, y: 0, targetAcorn: -1, vx: 0, vy: 0, mood: 'neutral', moodTimer: 0, invincible: 0 };

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

        // Acorn missed — fell past the squirrel's feet
        if (a.y > squirrel.y + 20) {
          if (i === squirrel.targetAcorn && squirrel.mood !== 'flattened') {
            squirrel.mood = 'annoyed';
            squirrel.moodTimer = 60;
            squirrel.targetAcorn = -1;
          }
          acorns[i] = spawnAcorn();
        }
      }

      // Mood timer countdown
      if (squirrel.moodTimer > 0) {
        squirrel.moodTimer--;
        if (squirrel.moodTimer === 0) {
          if (squirrel.mood === 'flattened') squirrel.invincible = 80;
          squirrel.mood = 'neutral';
        }
      }
      if (squirrel.invincible > 0) squirrel.invincible--;
      frame++;

      // Ice block spawning
      iceSpawnTimer--;
      if (iceSpawnTimer <= 0) {
        const w = 10 + Math.random() * 50;
        const melt = 200 + Math.random() * 200;
        // 50% chance to target near the squirrel
        const targetX = Math.random() < 0.5
          ? squirrel.x + (Math.random() - 0.5) * 60
          : 80 + Math.random() * (canvas.width - 160);
        iceBlocks.push({
          x: Math.max(40, Math.min(canvas.width - 40, targetX)),
          y: -40,
          width: w,
          height: w * (0.6 + Math.random() * 0.6),
          meltTimer: melt,
          maxMelt: melt,
          falling: true,
          fallSpeed: 6 + Math.random() * 4,
          vx: 0,
        });
        iceSpawnTimer = 200 + Math.random() * 250; // next one in 5-11 seconds
      }

      // Mega ice block spawning
      megaIceTimer--;
      if (megaIceTimer <= 0) {
        const melt = 150; // melts fast since it shatters on impact anyway
        iceBlocks.push({
          x: 80 + Math.random() * (canvas.width - 160),
          y: -80,
          width: 60 + Math.random() * 30,
          height: 50 + Math.random() * 25,
          meltTimer: melt,
          maxMelt: melt,
          falling: true,
          fallSpeed: 8 + Math.random() * 3,
          vx: 0,
        });
        megaIceTimer = 800 + Math.random() * 800; // next mega in 20-40 seconds
      }

      // Update & draw ice blocks
      for (let i = iceBlocks.length - 1; i >= 0; i--) {
        const ice = iceBlocks[i];
        if (ice.falling) {
          ice.fallSpeed += 0.2; // gravity
          ice.y += ice.fallSpeed;
          ice.x += ice.vx;
          ice.vx *= 0.99; // air friction
          const groundY = squirrel.y + 20;
          const hitSquirrel = squirrel.invincible <= 0
            && Math.abs(ice.x - squirrel.x) < ice.width / 2 + 12
            && ice.y >= squirrel.y - 30 && ice.y <= groundY;
          const landed = ice.y >= groundY;
          // Size tiers: tiny (<18), small (18-30), medium (30-45), large (45-60), mega (60+)
          const shatters = ice.width >= 35; // medium+ blocks shatter into chunks

          // Check squirrel hit FIRST (before ground landing)
          if (hitSquirrel) {
            ice.y = groundY;

            if (shatters) {
              spawnFlyingChunks(ice.x, groundY, ice.width);
              iceBlocks.splice(i, 1);
              if (squirrel.mood !== 'flattened') {
                squirrel.mood = 'flattened';
                squirrel.moodTimer = Math.min(250, 100 + ice.width * 2);
                squirrel.vx = 0;
              }
              continue;
            }

            ice.falling = false;
            spawnShards(ice.x, groundY, ice.width);
            if (ice.width > 22 && squirrel.mood !== 'flattened') {
              squirrel.mood = 'flattened';
              squirrel.moodTimer = 150;
              squirrel.vx = 0;
            } else if (squirrel.mood !== 'flattened') {
              squirrel.mood = 'annoyed';
              squirrel.moodTimer = 40;
              squirrel.vx += (squirrel.x < ice.x ? -2 : 2);
            }
          } else if (landed) {
            ice.y = groundY;

            if (shatters) {
              spawnFlyingChunks(ice.x, groundY, ice.width);
              iceBlocks.splice(i, 1);
              continue;
            }

            ice.falling = false;
            spawnShards(ice.x, groundY, ice.width);
          }
        } else {
          ice.meltTimer--;
          if (ice.meltTimer <= 0) {
            iceBlocks.splice(i, 1);
            continue;
          }
        }
        drawIceBlock(ctx, ice, isDark);
      }

      // Update & draw ice shards
      for (let i = iceShards.length - 1; i >= 0; i--) {
        const s = iceShards[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.15; // gravity
        s.rotation += s.rotSpeed;
        s.life--;
        if (s.life <= 0) {
          iceShards.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rotation);
        ctx.globalAlpha = s.life / 30;
        ctx.fillStyle = isDark ? 'rgba(160,220,240,0.8)' : 'rgba(200,240,255,0.9)';
        // Small irregular shard shape
        ctx.beginPath();
        ctx.moveTo(0, -s.size);
        ctx.lineTo(s.size * 0.7, s.size * 0.3);
        ctx.lineTo(-s.size * 0.5, s.size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Check if squirrel is blocked by ice (skip if flattened — he's not moving)
      let blocked = false;
      if (squirrel.mood === 'flattened') blocked = false;
      for (const ice of iceBlocks) {
        if (ice.falling || squirrel.mood === 'flattened') continue;
        const iceLeft = ice.x - ice.width / 2;
        const iceRight = ice.x + ice.width / 2;
        // Check if ice is between squirrel and target direction
        if (squirrel.x < iceRight + 15 && squirrel.x > iceLeft - 15 &&
            Math.abs(squirrel.y - ice.y + ice.height / 2) < ice.height) {
          blocked = true;
          // Push squirrel away from ice
          if (squirrel.x < ice.x) {
            squirrel.x = iceLeft - 15;
          } else {
            squirrel.x = iceRight + 15;
          }
          squirrel.vx *= 0.3;
          break;
        }
      }

      if (blocked && squirrel.mood !== 'happy' && squirrel.mood !== 'annoyed' && squirrel.mood !== 'flattened') {
        squirrel.mood = 'anxious';
        squirrel.moodTimer = 20;
      }

      // Squirrel AI: chase the lowest acorn (highest y = closest to ground)
      let nearest = -1;
      let lowestY = -Infinity;
      for (let i = 0; i < acorns.length; i++) {
        if (acorns[i].y > lowestY) {
          lowestY = acorns[i].y;
          nearest = i;
        }
      }

      if (nearest >= 0) {
        squirrel.targetAcorn = nearest;
        const a = acorns[nearest];
        const tx = a.x + Math.sin(a.wobble) * 20;
        const dx = tx - squirrel.x;
        if (squirrel.mood !== 'flattened') {
          squirrel.vx += dx * 0.003;
          squirrel.vx *= 0.94;
          squirrel.x += squirrel.vx;
        }

        // "Catch" — squirrel reaches the acorn
        const catchDx = tx - squirrel.x;
        const catchDist = Math.abs(catchDx);
        if (catchDist < 20 && a.y > squirrel.y - 15 && squirrel.mood !== 'flattened') {
          squirrel.mood = 'happy';
          squirrel.moodTimer = 80;
          acorns[nearest] = spawnAcorn();
        }
      }

      // Keep squirrel on screen
      squirrel.x = Math.max(25, Math.min(canvas.width - 25, squirrel.x));

      drawSquirrel(ctx, squirrel.x, squirrel.y, squirrel.vx >= 0, isDark, squirrel.mood, frame);

      // Speech bubble
      if (squirrel.mood !== 'neutral' && squirrel.moodTimer > 0) {
        const maxTimer = squirrel.mood === 'happy' ? 80 : squirrel.mood === 'flattened' ? 250 : squirrel.mood === 'anxious' ? 20 : 60;
        const progress = squirrel.moodTimer / maxTimer;
        const text = squirrel.mood === 'happy' ? 'Tszi!' : squirrel.mood === 'flattened' ? '...' : squirrel.mood === 'anxious' ? '!!!' : 'Nontszifacoszi!';
        drawSpeechBubble(ctx, squirrel.x, squirrel.y, text, progress, isDark);
      }
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
