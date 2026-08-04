/**
 * Drawing for the Cello scene: canvas primitives and colours, no decisions.
 *
 * Everything here reads the state `scene.ts` produced and paints it. Nothing in
 * this file may change that state — if it did, the scene's guarantees would stop
 * being testable, which is the whole reason the two are separate files.
 */
import {
  CHIMNEY_CAP,
  CHIMNEY_HEIGHT,
  DRIFT_LIFE,
  FULL_LIFT,
  FULL_SCALE,
  GIRL_HEIGHT,
  OVEN_BASE_HEIGHT,
  OVEN_HEIGHT,
  OVEN_WIDTH,
  PIZZAIOLO_HEIGHT,
  RING_LIFE,
  TOSS_FRAMES,
} from './scene';
import type { Pizza, Scene } from './scene';

/**
 * Dark mode is not the same scene dimmed — the ground and stone drop right back
 * so the app's own text stays the brightest thing on the screen, while the fire
 * and the bird keep their colour, since they are what the theme is for.
 *
 * Both are built once at module load rather than per frame, and `satisfies`
 * makes a colour named in one and forgotten in the other a compile error.
 */
const LIGHT = {
  groundNear: '#d9c9b4',
  groundFar: '#c8b79f',
  stone: '#c3b09b',
  stoneDark: '#54463c',
  mortar: '#a8957f',
  brick: '#b35c3f',
  fire: '#ff8c1a',
  fireCore: '#ffd166',
  smoke: 'rgba(120,120,130,0.22)',
  skin: '#eab68e',
  hair: '#2a2119',
  dress: '#c2456b',
  apron: '#f4efe6',
  trousers: '#4a4a55',
  crust: '#e0a95c',
  cheese: '#f6d98a',
  topping: '#cf4b32',
  bird: '#3b82f6',
  birdDark: '#2563eb',
  belly: '#cfe3fb',
  beak: '#f59e0b',
  ink: '#221c16',
  heart: '#e14f74',
};

type Palette = Record<keyof typeof LIGHT, string>;

const DARK = {
  groundNear: '#3a332c',
  groundFar: '#2b2620',
  stone: '#5a4f45',
  stoneDark: '#2e2721',
  mortar: '#6b6058',
  brick: '#7a4436',
  fire: '#e2761b',
  fireCore: '#ffc247',
  smoke: 'rgba(190,190,200,0.16)',
  skin: '#c9906a',
  hair: '#1d1712',
  dress: '#a33a5b',
  apron: '#d9d2c6',
  trousers: '#3b3b46',
  crust: '#c98f45',
  cheese: '#e8c169',
  topping: '#b8452f',
  bird: '#3f7fd6',
  birdDark: '#2c5fa6',
  belly: '#9cc4f0',
  beak: '#e2921b',
  ink: '#15120f',
  heart: '#e0567a',
} satisfies Palette;

/** Where the pepperoni sits, as a fraction of the radius. */
const TOPPINGS = [
  [0.35, 0.1],
  [-0.3, 0.32],
  [0.05, -0.42],
  [-0.4, -0.2],
];

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.4);
  ctx.bezierCurveTo(
    x - size * 1.1,
    y - size * 0.4,
    x - size * 0.45,
    y - size * 1.05,
    x,
    y - size * 0.3,
  );
  ctx.bezierCurveTo(
    x + size * 0.45,
    y - size * 1.05,
    x + size * 1.1,
    y - size * 0.4,
    x,
    y + size * 0.4,
  );
  ctx.closePath();
}

function drawGround(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const { ground, width, height } = scene;

  ctx.fillStyle = p.groundFar;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, ground + 4);
  for (let x = 0; x <= width; x += 24) {
    ctx.lineTo(x, ground + 4 + Math.sin(x * 0.04) * 2);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.groundNear;
  ctx.fillRect(0, ground + 12, width, height - ground);

  // Paving joints, so the ground reads as a terrace rather than a bar of colour.
  // One path for all of them: they are identical every frame, and a stroke per
  // joint was a dozen draw calls forty times a second to no effect.
  ctx.strokeStyle = p.groundFar;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -20; x < width + 40; x += 46) {
    ctx.moveTo(x, ground + 12);
    ctx.lineTo(x - 14, ground + 40);
  }
  ctx.stroke();
}

/**
 * A dome sitting on a stone plinth, the way one is actually built: the wood goes
 * in the arch underneath and the fire is up in the dome, level with the hands of
 * whoever is working it.
 */
function drawOven(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const x = scene.layout.ovenX;
  const base = scene.ground;
  const half = OVEN_WIDTH / 2;
  const ledge = base - OVEN_BASE_HEIGHT;
  const domeTop = base - OVEN_HEIGHT;

  // Plinth
  ctx.fillStyle = p.stone;
  ctx.fillRect(x - half, ledge, OVEN_WIDTH, OVEN_BASE_HEIGHT);

  // Courses of stone, all in one path for the same reason as the paving above
  ctx.strokeStyle = p.mortar;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = ledge + 9; y < base; y += 9) {
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y);
  }
  ctx.stroke();

  // The wood store, arched, under the cooking floor
  const storeW = 40;
  ctx.fillStyle = p.stoneDark;
  ctx.beginPath();
  ctx.moveTo(x - storeW / 2, base);
  ctx.lineTo(x - storeW / 2, ledge + 22);
  ctx.quadraticCurveTo(x, ledge + 2, x + storeW / 2, ledge + 22);
  ctx.lineTo(x + storeW / 2, base);
  ctx.closePath();
  ctx.fill();

  // Brick ledge the dome stands on, overhanging the plinth
  ctx.fillStyle = p.brick;
  ctx.fillRect(x - half - 5, ledge - 7, OVEN_WIDTH + 10, 7);

  // Dome
  ctx.fillStyle = p.stone;
  ctx.beginPath();
  ctx.moveTo(x - half + 2, ledge - 7);
  ctx.quadraticCurveTo(x - half + 2, domeTop, x, domeTop);
  ctx.quadraticCurveTo(x + half - 2, domeTop, x + half - 2, ledge - 7);
  ctx.closePath();
  ctx.fill();

  // Mouth, arched, with the fire burning behind it
  const mouthW = 40;
  const mouthH = 28;
  const mouthBase = ledge - 7;
  ctx.fillStyle = p.brick;
  ctx.beginPath();
  ctx.moveTo(x - mouthW / 2 - 3, mouthBase);
  ctx.lineTo(x - mouthW / 2 - 3, mouthBase - mouthH * 0.5);
  ctx.quadraticCurveTo(x, mouthBase - mouthH - 6, x + mouthW / 2 + 3, mouthBase - mouthH * 0.5);
  ctx.lineTo(x + mouthW / 2 + 3, mouthBase);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.stoneDark;
  ctx.beginPath();
  ctx.moveTo(x - mouthW / 2, mouthBase);
  ctx.lineTo(x - mouthW / 2, mouthBase - mouthH * 0.5);
  ctx.quadraticCurveTo(x, mouthBase - mouthH, x + mouthW / 2, mouthBase - mouthH * 0.5);
  ctx.lineTo(x + mouthW / 2, mouthBase);
  ctx.closePath();
  ctx.fill();

  const flicker = 1 + Math.sin(scene.frame * 0.3) * 0.12;
  ctx.fillStyle = p.fire;
  ctx.beginPath();
  ctx.ellipse(x, mouthBase - 7, 14 * flicker, 9 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.fireCore;
  ctx.beginPath();
  ctx.ellipse(x, mouthBase - 6, 7 * flicker, 5 * flicker, 0, 0, Math.PI * 2);
  ctx.fill();

  // Chimney, on the crown of the dome. The cap's top is the highest thing that
  // stands on the ground, and SCENE_REACH is measured to exactly here.
  ctx.fillStyle = p.stone;
  ctx.fillRect(x - 9, domeTop - CHIMNEY_HEIGHT, 18, CHIMNEY_HEIGHT + 6);
  ctx.fillStyle = p.stoneDark;
  ctx.fillRect(x - 12, domeTop - CHIMNEY_HEIGHT - CHIMNEY_CAP, 24, CHIMNEY_CAP);
}

function drawSmoke(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  ctx.fillStyle = p.smoke;
  for (const puff of scene.oven.smoke) {
    ctx.globalAlpha = Math.min(1, puff.life / puff.maxLife);
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPizza(ctx: CanvasRenderingContext2D, pizza: Pizza, p: Palette) {
  ctx.save();
  ctx.translate(pizza.x, pizza.y);
  ctx.rotate(pizza.rotation);
  drawPizzaFace(ctx, 15, p);
  ctx.restore();
}

/** The pizza itself, centred on the origin — on the peel or in the air. */
function drawPizzaFace(ctx: CanvasRenderingContext2D, radius: number, p: Palette) {
  ctx.fillStyle = p.crust;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.cheese;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.topping;
  for (const [tx, ty] of TOPPINGS) {
    ctx.beginPath();
    ctx.arc(tx * radius, ty * radius, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPizzaiolo(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const x = scene.layout.pizzaioloX;
  const feet = scene.ground;

  // Measured down from the top of his hat, so the figure is exactly as tall as
  // the scene says he is — that height is what a click on him is tested against.
  const h = PIZZAIOLO_HEIGHT;

  ctx.save();
  ctx.translate(x, feet);

  // Legs
  ctx.fillStyle = p.trousers;
  ctx.fillRect(-9, -30, 7, 30);
  ctx.fillRect(3, -30, 7, 30);

  // Apron over the body
  ctx.fillStyle = p.apron;
  ctx.beginPath();
  ctx.moveTo(-13, -30);
  ctx.lineTo(13, -30);
  ctx.lineTo(11, -50);
  ctx.lineTo(-11, -50);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(0, -h + 24, 9, 0, Math.PI * 2);
  ctx.fill();

  // Moustache, because of course
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  ctx.ellipse(1, -h + 27, 5, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Toque, its puff reaching exactly to the top of him
  ctx.fillStyle = p.apron;
  ctx.fillRect(-9, -h + 12, 18, 7);
  ctx.beginPath();
  ctx.ellipse(0, -h + 7, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // The peel: level while he waits, swung up and over as he tosses.
  const tossing = scene.oven.tossing;
  const swing = tossing > 0 ? 1 - tossing / TOSS_FRAMES : 0;
  // At rest it reaches up into the mouth of the dome; the toss swings it over.
  const angle = -0.28 - swing * 1.1;
  ctx.save();
  ctx.translate(6, -44);
  ctx.rotate(angle);
  ctx.strokeStyle = p.crust;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(52, 0);
  ctx.stroke();
  ctx.fillStyle = p.stone;
  ctx.fillRect(52, -9, 18, 18);
  // The pizza rides the paddle right up to the moment it leaves.
  if (tossing > 0) {
    ctx.save();
    ctx.translate(61, -12);
    ctx.rotate(-angle);
    drawPizzaFace(ctx, 12, p);
    ctx.restore();
  }
  ctx.restore();

  ctx.restore();
}

function drawGirl(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const { girl, ground } = scene;
  const swing = Math.sin(girl.step * 0.16) * 8;

  ctx.save();
  ctx.translate(girl.x, ground);
  if (girl.dir === -1) ctx.scale(-1, 1);

  // Legs, stepping with the distance covered
  ctx.strokeStyle = p.skin;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(swing * 0.6, 0);
  ctx.moveTo(0, -26);
  ctx.lineTo(-swing * 0.6, 0);
  ctx.stroke();

  // Dress
  ctx.fillStyle = p.dress;
  ctx.beginPath();
  ctx.moveTo(-11, -26);
  ctx.lineTo(11, -26);
  ctx.lineTo(7, -GIRL_HEIGHT + 16);
  ctx.lineTo(-7, -GIRL_HEIGHT + 16);
  ctx.closePath();
  ctx.fill();

  // Arm
  ctx.strokeStyle = p.skin;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(4, -GIRL_HEIGHT + 22);
  ctx.lineTo(4 + swing * 0.4, -34);
  ctx.stroke();

  // Long dark hair behind the head, then the head over it
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.ellipse(-2, -GIRL_HEIGHT + 22, 10, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(1, -GIRL_HEIGHT + 8, 8.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(1, -GIRL_HEIGHT + 8, 8.5, Math.PI * 1.05, Math.PI * 2.1);
  ctx.fill();

  ctx.restore();
}

function drawBird(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const { bird } = scene;
  const full = bird.phase === 'full';
  const eating = bird.phase === 'eating';
  const grounded = full || eating;
  const size = full ? FULL_SCALE : 1;

  ctx.save();
  ctx.translate(bird.x, bird.y - (full ? FULL_LIFT : 0));
  if (!bird.facingRight) ctx.scale(-1, 1);
  ctx.scale(size, size);

  // Tail
  ctx.fillStyle = p.birdDark;
  ctx.beginPath();
  ctx.moveTo(-9, -2);
  ctx.lineTo(-20, -7);
  ctx.lineTo(-18, 2);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = p.bird;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.belly;
  ctx.beginPath();
  ctx.ellipse(1, 3, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing — folded while he is on the ground, beating while he is not
  ctx.fillStyle = p.birdDark;
  ctx.save();
  ctx.translate(-1, -2);
  ctx.rotate(grounded ? 0.15 : Math.sin(bird.flap) * 0.85);
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Head
  ctx.fillStyle = p.bird;
  ctx.beginPath();
  ctx.arc(9, -8, 7, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = p.beak;
  ctx.beginPath();
  ctx.moveTo(15, -8);
  ctx.lineTo(23, -6);
  ctx.lineTo(15, -4);
  ctx.closePath();
  ctx.fill();

  // Eye: shut while he sleeps it off
  ctx.strokeStyle = p.ink;
  ctx.fillStyle = p.ink;
  if (full) {
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9, -10);
    ctx.lineTo(13, -10);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(11.5, -10, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Feet, only when there is something to stand on
  if (grounded) {
    ctx.strokeStyle = p.beak;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-2, 9);
    ctx.lineTo(-2, 13);
    ctx.moveTo(5, 9);
    ctx.lineTo(5, 13);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHearts(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  ctx.fillStyle = p.heart;
  for (const heart of scene.hearts) {
    // Where each one is was decided in the scene; the only thing left here is
    // how big it is and how far through its life it has faded.
    const life = heart.kind === 'ring' ? RING_LIFE : DRIFT_LIFE;
    ctx.globalAlpha = Math.min(1, heart.life / (life * 0.5));
    heartPath(ctx, heart.x, heart.y, heart.kind === 'ring' ? 5 : 4);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, isDark: boolean) {
  const p: Palette = isDark ? DARK : LIGHT;
  drawGround(ctx, scene, p);
  drawOven(ctx, scene, p);
  drawSmoke(ctx, scene, p);
  drawPizzaiolo(ctx, scene, p);
  drawGirl(ctx, scene, p);
  drawBird(ctx, scene, p);
  if (scene.pizza) drawPizza(ctx, scene.pizza, p);
  drawHearts(ctx, scene, p);
}
