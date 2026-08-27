/**
 * The Ciccio scene, drawn.
 *
 * Nothing here may mutate the scene: this file is handed a state and paints it,
 * and every question about what happens next is answered in `scene.ts`. Where a
 * figure is placed, how high a seat is and which way he faces are all read from
 * there rather than worked out again here — two owners of one fact is how the
 * cello's pizza came to leave the peel from a point the paddle was not at.
 *
 * The single `ctx.scale` for the whole scene is applied here and nowhere else.
 * The canvas has already been fitted to the screen's device pixels by
 * `fitCanvas`, so this composes on top of that and the file works in scene
 * units throughout.
 */

import type { Scene, Squirrel } from './scene';
import { OVEN_WIDTH, BED_WIDTH, SOFA_WIDTH, TV_WIDTH, SEAT_HEIGHT } from './scene';

const LIGHT = {
  floor: '#c9b8a4',
  floorLine: '#b3a08a',
  rug: '#d8b7a6',
  rugTrim: '#c29a86',

  ovenBody: '#d9d2c8',
  ovenTrim: '#a89f92',
  ovenGlass: '#4c4038',
  ovenGlow: '#e8a13c',
  hood: '#bdb4a7',

  bedFrame: '#a87f5c',
  mattress: '#f2ece2',
  blanket: '#8fae9b',
  blanketDark: '#7b9a87',
  pillow: '#ffffff',

  sofa: '#7d90ad',
  sofaDark: '#6a7d99',
  sofaLight: '#93a5bf',

  tvStand: '#8a7c6d',
  tvBody: '#3a3a3e',
  tvScreenOff: '#54545a',

  quillDark: '#7d6c58',
  quillLight: '#a8977f',
  fur: '#efe3d2',
  furShade: '#dccdb7',
  nose: '#4f4f52',
  eye: '#2b2b2b',

  squirrel: '#c8763a',
  squirrelDark: '#ab5f2b',
  squirrelBelly: '#f4ead9',
  squirrelTail: '#d98a4a',
};

type Palette = typeof LIGHT;

const DARK: Palette = {
  floor: '#3b3229',
  floorLine: '#2e2721',
  rug: '#5c4038',
  rugTrim: '#6e4d42',

  ovenBody: '#4a453e',
  ovenTrim: '#332f2a',
  ovenGlass: '#211c18',
  ovenGlow: '#d2841f',
  hood: '#3d3831',

  bedFrame: '#5a4432',
  mattress: '#4e4740',
  blanket: '#4a6355',
  blanketDark: '#3c5245',
  pillow: '#6b645b',

  sofa: '#44506a',
  sofaDark: '#36405a',
  sofaLight: '#525f7c',

  tvStand: '#4a4239',
  tvBody: '#1e1e21',
  tvScreenOff: '#2c2c31',

  quillDark: '#4f453a',
  quillLight: '#6f6252',
  fur: '#c4b6a2',
  furShade: '#a99a86',
  nose: '#2a2a2c',
  eye: '#141414',

  squirrel: '#a55f2d',
  squirrelDark: '#83491f',
  squirrelBelly: '#cbbda6',
  squirrelTail: '#b4713a',
};

// -- the room ----------------------------------------------------------------

function drawFloor(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  // Down to the bottom of the stage, never below the ground line and up: the
  // band the app reserves starts at the ground, and anything painted under it
  // is painted over the navigation bar.
  ctx.fillStyle = p.floor;
  ctx.fillRect(0, scene.ground, scene.width, scene.height - scene.ground);
  ctx.strokeStyle = p.floorLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, scene.ground);
  ctx.lineTo(scene.width, scene.ground);
  ctx.stroke();
}

function drawRug(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { rugX, rugWidth } = scene.layout;
  ctx.fillStyle = p.rug;
  ctx.beginPath();
  ctx.ellipse(rugX, scene.ground + 3, rugWidth / 2, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.rugTrim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(rugX, scene.ground + 3, rugWidth / 2 - 5, 4.5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawOven(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { ovenX } = scene.layout;
  const g = scene.ground;
  const w = OVEN_WIDTH;
  const left = ovenX - w / 2;

  // The unit.
  ctx.fillStyle = p.ovenBody;
  ctx.beginPath();
  ctx.roundRect(left, g - 66, w, 66, 4);
  ctx.fill();

  // Worktop.
  ctx.fillStyle = p.ovenTrim;
  ctx.fillRect(left - 3, g - 70, w + 6, 5);

  // The door, and the glow behind it.
  ctx.fillStyle = p.ovenGlass;
  ctx.beginPath();
  ctx.roundRect(left + 8, g - 44, w - 16, 32, 3);
  ctx.fill();
  ctx.fillStyle = p.ovenGlow;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(ovenX, g - 26, w / 2 - 14, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Handle and dials.
  ctx.fillStyle = p.ovenTrim;
  ctx.fillRect(left + 6, g - 52, w - 12, 3);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(left + 14 + i * 12, g - 58, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // The hood above it, which is what makes the oven the tallest thing here.
  ctx.fillStyle = p.hood;
  ctx.beginPath();
  ctx.moveTo(left - 2, g - 110);
  ctx.lineTo(left + w + 2, g - 110);
  ctx.lineTo(left + w - 8, g - 88);
  ctx.lineTo(left + 8, g - 88);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(ovenX - 8, g - 88, 16, 6);
}

function drawBed(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { bedX } = scene.layout;
  const g = scene.ground;
  const w = BED_WIDTH;
  const left = bedX - w / 2;
  const mattress = SEAT_HEIGHT.bed;

  // Headboard, at the left so the bed reads as being made up towards the room.
  ctx.fillStyle = p.bedFrame;
  ctx.beginPath();
  ctx.roundRect(left - 4, g - 44, 10, 44, 3);
  ctx.fill();
  ctx.fillRect(left + w - 4, g - 22, 8, 22);

  // Base and mattress.
  ctx.fillStyle = p.bedFrame;
  ctx.fillRect(left, g - 10, w, 10);
  ctx.fillStyle = p.mattress;
  ctx.beginPath();
  ctx.roundRect(left, g - mattress - 6, w, 12, 3);
  ctx.fill();

  // Blanket over the foot end, folded back.
  ctx.fillStyle = p.blanket;
  ctx.beginPath();
  ctx.roundRect(left + w * 0.42, g - mattress - 6, w * 0.58, 12, 3);
  ctx.fill();
  ctx.fillStyle = p.blanketDark;
  ctx.fillRect(left + w * 0.42, g - mattress - 6, 4, 12);

  // Pillow.
  ctx.fillStyle = p.pillow;
  ctx.beginPath();
  ctx.roundRect(left + 6, g - mattress - 13, 26, 9, 4);
  ctx.fill();
}

function drawSofa(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { sofaX } = scene.layout;
  const g = scene.ground;
  const w = SOFA_WIDTH;
  const left = sofaX - w / 2;
  const seat = SEAT_HEIGHT.sofa;

  // Back.
  ctx.fillStyle = p.sofaDark;
  ctx.beginPath();
  ctx.roundRect(left + 4, g - 50, w - 8, 50, 6);
  ctx.fill();

  // Seat.
  ctx.fillStyle = p.sofa;
  ctx.beginPath();
  ctx.roundRect(left, g - seat - 8, w, seat + 8, 5);
  ctx.fill();

  // Two cushions, so the three of them have somewhere to sit.
  ctx.fillStyle = p.sofaLight;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.roundRect(left + 8 + (i * (w - 16)) / 2, g - seat - 7, (w - 16) / 2 - 3, 7, 3);
    ctx.fill();
  }

  // Arms.
  ctx.fillStyle = p.sofaDark;
  ctx.beginPath();
  ctx.roundRect(left - 2, g - seat - 14, 9, seat + 14, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(left + w - 7, g - seat - 14, 9, seat + 14, 4);
  ctx.fill();
}

function drawTv(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { tvX } = scene.layout;
  const g = scene.ground;
  const w = TV_WIDTH;

  // Stand.
  ctx.fillStyle = p.tvStand;
  ctx.beginPath();
  ctx.roundRect(tvX - w / 2 + 4, g - 24, w - 8, 24, 3);
  ctx.fill();

  // Set.
  ctx.fillStyle = p.tvBody;
  ctx.beginPath();
  ctx.roundRect(tvX - w / 2, g - 70, w, 46, 4);
  ctx.fill();

  // Screen, dark and off. A television that is on is a later change, and the
  // scene does not yet have a fact for it to read.
  ctx.fillStyle = p.tvScreenOff;
  ctx.beginPath();
  ctx.roundRect(tvX - w / 2 + 4, g - 66, w - 8, 38, 2);
  ctx.fill();
}

// -- the cast ----------------------------------------------------------------

/**
 * Ciccio: a low round hedgehog, a soft bristled dome over the back and cream
 * from the shoulders forward, with a dark nose at the point of him.
 *
 * The coat is **mottled, not spiked**. Drawn as tufts standing off the top he
 * read as a stegosaurus; the toy is a dense soft pile, so the silhouette gets a
 * row of small bumps to fuzz its edge and the body gets flecks *inside* it. All
 * of it comes off a fixed pattern rather than a random one — a coat that
 * reshuffles every frame shimmers.
 *
 * `facing` runs −1 to 1 and is eased, so the whole figure is drawn about a
 * horizontal scale rather than mirrored: mid-turn he is genuinely narrow, which
 * is what a turning hedgehog looks like from the side.
 */
function drawCiccio(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { ciccio } = scene;
  const y = scene.ground - SEAT_HEIGHT[ciccio.at];

  const LONG = 23; // half his length, nose excluded
  const TALL = 15; // how high the dome stands

  ctx.save();
  ctx.translate(ciccio.x, y);
  ctx.scale(ciccio.facing || 0.001, 1);

  // Feet, tucked well under: he is a cushion on legs.
  ctx.fillStyle = p.furShade;
  for (const fx of [-11, 8]) {
    ctx.beginPath();
    ctx.ellipse(fx, -2.5, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The dome, and a fuzzed edge over the top of it.
  ctx.fillStyle = p.quillLight;
  ctx.beginPath();
  ctx.ellipse(-2, -2, LONG, TALL, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-2 - LONG, -3, LONG * 2, 3);
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const angle = Math.PI + t * Math.PI;
    const bx = -2 + Math.cos(angle) * LONG;
    const by = -2 + Math.sin(angle) * TALL;
    ctx.beginPath();
    ctx.arc(bx, by, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flecks: short strokes lying along the coat, darker towards the back.
  ctx.strokeStyle = p.quillDark;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    // A cheap fixed hash, so the same fleck is in the same place every frame.
    const a = (i * 2.399) % (Math.PI * 2);
    const r = 0.42 + ((i * 7) % 11) / 22;
    const fx = -2 + Math.cos(a) * LONG * r;
    const fy = -3 - Math.abs(Math.sin(a)) * TALL * r;
    if (fy > -4) continue;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + 2.2, fy - 2.6);
    ctx.stroke();
  }

  // The face: a cream muzzle running out from under the dome to the nose, with
  // the join hidden beneath the bristles rather than butted against them.
  ctx.fillStyle = p.fur;
  ctx.beginPath();
  ctx.moveTo(4, -20);
  ctx.quadraticCurveTo(24, -19, 33, -8);
  ctx.quadraticCurveTo(28, -1.5, 14, -1.5);
  ctx.quadraticCurveTo(5, -2, 4, -20);
  ctx.fill();

  // Ear: small and round, set back *into* the bristles rather than beside the
  // muzzle, which is where the toy's is and which stops it reading as a disc
  // stuck on the side of his head.
  ctx.fillStyle = p.fur;
  ctx.beginPath();
  ctx.ellipse(1, -22.5, 4.6, 5, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.furShade;
  ctx.beginPath();
  ctx.ellipse(1.4, -22, 2.3, 2.7, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Nose and eye.
  ctx.fillStyle = p.nose;
  ctx.beginPath();
  ctx.ellipse(32.5, -8, 3.4, 3.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.eye;
  ctx.beginPath();
  ctx.arc(19, -13, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.fur;
  ctx.beginPath();
  ctx.arc(19.7, -13.8, 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** A squirrel: upright, cream-bellied, mostly tail. */
function drawSquirrel(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  squirrel: Squirrel,
  p: Palette,
): void {
  const y = scene.ground - SEAT_HEIGHT[squirrel.at];

  ctx.save();
  ctx.translate(squirrel.x, y);
  ctx.scale(squirrel.facing || 0.001, 1);

  // The tail first, so it sits behind the body — a great question mark curling
  // up and over.
  ctx.fillStyle = p.squirrelTail;
  ctx.beginPath();
  ctx.moveTo(-5, -2);
  ctx.quadraticCurveTo(-23, -7, -20, -27);
  ctx.quadraticCurveTo(-18, -45, -4, -43);
  ctx.quadraticCurveTo(-11, -35, -11, -25);
  ctx.quadraticCurveTo(-11, -12, -2.5, -7);
  ctx.closePath();
  ctx.fill();

  // Body.
  ctx.fillStyle = p.squirrel;
  ctx.beginPath();
  ctx.ellipse(0, -14, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly.
  ctx.fillStyle = p.squirrelBelly;
  ctx.beginPath();
  ctx.ellipse(3, -11, 6.2, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  ctx.fillStyle = p.squirrel;
  ctx.beginPath();
  ctx.arc(4, -28, 8, 0, Math.PI * 2);
  ctx.fill();

  // Ear.
  ctx.fillStyle = p.squirrelDark;
  ctx.beginPath();
  ctx.ellipse(1.5, -35, 2.8, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Cheek, eye, and the two paws held together at the chest.
  ctx.fillStyle = p.squirrelBelly;
  ctx.beginPath();
  ctx.ellipse(9, -25.5, 4, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.eye;
  ctx.beginPath();
  ctx.arc(7.5, -30, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.squirrelDark;
  ctx.beginPath();
  ctx.ellipse(7.5, -15, 3.2, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet.
  ctx.fillStyle = p.squirrelDark;
  ctx.beginPath();
  ctx.ellipse(2.5, -1.8, 5, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * The whole room, back to front.
 *
 * The bed is painted before the animals because it stands against the back and
 * he walks in front of it — which is the same fact that lets the room have no
 * nullable furniture: the bed never competes with his floor.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  isDark: boolean,
  scale: number,
): void {
  const p = isDark ? DARK : LIGHT;

  ctx.save();
  ctx.scale(scale, scale);

  drawFloor(ctx, scene, p);
  drawRug(ctx, scene, p);
  drawBed(ctx, scene, p);
  drawOven(ctx, scene, p);
  drawSofa(ctx, scene, p);
  drawTv(ctx, scene, p);

  for (const squirrel of scene.squirrels) drawSquirrel(ctx, scene, squirrel, p);
  drawCiccio(ctx, scene, p);

  ctx.restore();
}
