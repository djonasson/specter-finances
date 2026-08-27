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
import {
  OVEN_WIDTH,
  OVEN_HEIGHT,
  OVEN_HOOD_TOP,
  BED_WIDTH,
  BED_HEAD,
  SOFA_WIDTH,
  SOFA_BACK,
  TV_WIDTH,
  TV_PANEL,
  TV_HANGS_AT,
  GRATIN_BITES,
  WALL_HEIGHT,
  DEPTH,
  SEAT_HEIGHT,
  ciccioFacing,
  ciccioBob,
} from './scene';
import type { Say } from './scene';

const LIGHT = {
  wall: '#e7ded2',
  wallShade: '#ddd2c3',
  // The same colour at zero alpha, deliberately. Fading from `rgba(0,0,0,0)`
  // interpolates through transparent *black*, which paints a dirty band across
  // the top of the room where the fade should be invisible.
  wallFade: 'rgba(221, 210, 195, 0)',
  skirting: '#f3ece2',
  floor: '#c49f7d',
  floorBack: '#b28c6b',
  floorLine: '#a37f5f',
  shadow: 'rgba(60, 40, 24, 0.16)',
  rug: '#c98d78',
  rugInner: '#dba894',
  rugTrim: '#b0725e',

  ovenBody: '#d9d2c8',
  ovenBodyTop: '#e8e3db',
  ovenEdge: '#b3aa9d',
  ovenTrim: '#a89f92',
  ovenTrimTop: '#bfb7ab',
  ovenDial: '#8d8479',
  ovenGlass: '#4c4038',
  ovenGlow: '#e8a13c',
  hood: '#bdb4a7',
  hoodTop: '#d2cabe',

  bedFrame: '#a87f5c',
  bedFrameTop: '#c0966f',
  bedEdge: '#8a6544',
  mattress: '#f2ece2',
  mattressTop: '#fbf7f0',
  blanket: '#8fae9b',
  blanketTop: '#a3c0ad',
  blanketDark: '#7b9a87',
  pillow: '#ffffff',

  sofa: '#efe6d6',
  sofaEdge: '#c2b49b',
  sofaDark: '#dcd0bb',
  sofaLight: '#f8f2e7',
  sofaSeam: '#cbbda3',

  tvStand: '#6f6154',
  tvStandTop: '#8a7a6a',
  tvBody: '#26262a',
  tvScreenOff: '#3a3a41',
  tvSheen: 'rgba(255,255,255,0.07)',
  picture: '#b9a68d',
  pictureArt: '#8fa8a0',

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
  squirrelTailLight: '#eaa66a',

  dish: '#e4e0d8',
  gratin: '#e8c98a',
  gratinTop: '#c98a3f',
  steam: '#ffffff',

  bubble: '#ffffff',
  bubbleEdge: '#c8bda9',
  bubbleText: '#3d332a',
};

type Palette = typeof LIGHT;

const DARK: Palette = {
  wall: '#332c26',
  wallShade: '#2b241f',
  wallFade: 'rgba(43, 36, 31, 0)',
  skirting: '#3d352d',
  floor: '#4a3c2f',
  floorBack: '#3a2f26',
  floorLine: '#2b231c',
  shadow: 'rgba(0, 0, 0, 0.3)',
  rug: '#6b4438',
  rugInner: '#7d5344',
  rugTrim: '#8a5e4d',

  ovenBody: '#4a453e',
  ovenBodyTop: '#57514a',
  ovenEdge: '#2c2823',
  ovenTrim: '#332f2a',
  ovenTrimTop: '#403b35',
  ovenDial: '#6d665d',
  ovenGlass: '#211c18',
  ovenGlow: '#d2841f',
  hood: '#3d3831',
  hoodTop: '#4a443c',

  bedFrame: '#5a4432',
  bedFrameTop: '#6d5440',
  bedEdge: '#3f2f22',
  mattress: '#4e4740',
  mattressTop: '#5d554c',
  blanket: '#4a6355',
  blanketTop: '#587465',
  blanketDark: '#3c5245',
  pillow: '#6b645b',

  sofa: '#8d8375',
  sofaEdge: '#5a534a',
  sofaDark: '#746b5f',
  sofaLight: '#9d9384',
  sofaSeam: '#5f584e',

  tvStand: '#403830',
  tvStandTop: '#4e453b',
  tvBody: '#141416',
  tvScreenOff: '#212125',
  tvSheen: 'rgba(255,255,255,0.05)',
  picture: '#5a4d3e',
  pictureArt: '#4a5f58',

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
  squirrelTailLight: '#c98a52',

  dish: '#5a544b',
  gratin: '#b89a63',
  gratinTop: '#a06e30',
  steam: '#cfc8bd',

  bubble: '#e8e2d8',
  bubbleEdge: '#7a7167',
  bubbleText: '#2a241e',
};

// -- the room ---------------------------------------------------------------

/**
 * A box seen slightly from above and to the left: a front face, the top of it,
 * and nothing else.
 *
 * One helper for every piece of furniture, so the room agrees with itself about
 * where the light is and how deep it is. Drawn as flat rectangles the whole
 * scene read as cardboard standing on a shelf; a single visible top face is
 * most of the difference between that and a room.
 */
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  h: number,
  front: string,
  top: string,
  radius = 3,
  edge?: string,
): void {
  const left = x - w / 2;
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(left, ground - h);
  ctx.lineTo(left + DEPTH * 0.75, ground - h - DEPTH * 0.5);
  ctx.lineTo(left + w + DEPTH * 0.75, ground - h - DEPTH * 0.5);
  ctx.lineTo(left + w, ground - h);
  ctx.closePath();
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.roundRect(left, ground - h, w, h, radius);
  ctx.fill();
  // The room is drawn small — at a phone's scale a cream sofa on a cream wall
  // is one shape. A hairline in the piece's own darker tone is what keeps the
  // furniture legible without outlining it like a cartoon.
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** What sits under a thing standing on the floor, so it is standing on it. */
function contactShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  ground: number,
  w: number,
  p: Palette,
): void {
  ctx.fillStyle = p.shadow;
  ctx.beginPath();
  ctx.ellipse(x, ground + 1, w / 2, Math.max(2.5, w * 0.055), 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The room itself: a wall to the height the app reserved, and a floor.
 *
 * The band is opaque down to the footer, so the strip above the ground line is
 * the scene's own to paint — and painting it is what stops the furniture
 * reading as cut-outs floating on a page. The wall fades out over its last
 * stretch rather than ending on a hard line, so the room meets the user's list
 * without a seam, in either colour scheme.
 */
function drawRoom(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const g = scene.ground;

  const wall = ctx.createLinearGradient(0, g - WALL_HEIGHT, 0, g);
  wall.addColorStop(0, p.wallFade);
  wall.addColorStop(0.35, p.wallShade);
  wall.addColorStop(1, p.wall);
  ctx.fillStyle = wall;
  ctx.fillRect(0, g - WALL_HEIGHT, scene.width, WALL_HEIGHT);

  // The floor, with the far strip darker: the two together read as a corner
  // rather than as a line.
  ctx.fillStyle = p.floorBack;
  ctx.fillRect(0, g - 1, scene.width, DEPTH * 0.5 + 1);
  ctx.fillStyle = p.floor;
  ctx.fillRect(0, g + DEPTH * 0.5, scene.width, scene.height - g);

  // Skirting, along the join.
  ctx.fillStyle = p.skirting;
  ctx.fillRect(0, g - 7, scene.width, 7);
  ctx.fillStyle = p.floorLine;
  ctx.fillRect(0, g - 1, scene.width, 1.2);
}

function drawRug(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { rugX, rugWidth } = scene.layout;
  ctx.fillStyle = p.rug;
  ctx.beginPath();
  ctx.ellipse(rugX, scene.ground + 8, rugWidth / 2, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.rugInner;
  ctx.beginPath();
  ctx.ellipse(rugX, scene.ground + 8, rugWidth / 2 - 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.rugTrim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(rugX, scene.ground + 8, rugWidth / 2 - 3.5, 6.6, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBed(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { bedX } = scene.layout;
  const g = scene.ground;
  const w = BED_WIDTH;
  const left = bedX - w / 2;
  const mattress = SEAT_HEIGHT.bed;

  contactShadow(ctx, bedX, g, w + 6, p);

  // Headboard at the left, tall enough to read as the head of the bed.
  ctx.fillStyle = p.bedFrame;
  ctx.beginPath();
  ctx.roundRect(left - 3, g - BED_HEAD, 12, BED_HEAD, 3);
  ctx.fill();
  ctx.strokeStyle = p.bedEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  // A footboard, lower than the head, so the bed reads as a bed from either end.
  ctx.fillStyle = p.bedFrame;
  ctx.beginPath();
  ctx.roundRect(left + w - 9, g - 26, 11, 26, 3);
  ctx.fill();
  ctx.stroke();

  // Base, then the mattress on top of it with its own visible surface.
  box(ctx, bedX, g, w, 13, p.bedFrame, p.bedFrameTop, 2, p.bedEdge);
  box(ctx, bedX, g - 13, w - 4, mattress + 2, p.mattress, p.mattressTop, 3, p.bedEdge);

  // Duvet over the foot end, with a fold turned back.
  ctx.fillStyle = p.blanketTop;
  ctx.beginPath();
  ctx.moveTo(left + w * 0.4, g - mattress - 8);
  ctx.lineTo(left + w * 0.4 + DEPTH * 0.75, g - mattress - 8 - DEPTH * 0.5);
  ctx.lineTo(left + w - 4 + DEPTH * 0.75, g - mattress - 8 - DEPTH * 0.5);
  ctx.lineTo(left + w - 4, g - mattress - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.blanket;
  ctx.beginPath();
  ctx.roundRect(left + w * 0.4, g - mattress - 8, w * 0.6 - 4, 12, 3);
  ctx.fill();
  ctx.fillStyle = p.blanketDark;
  ctx.fillRect(left + w * 0.4, g - mattress - 8, 3.5, 12);

  // Pillow, propped against the headboard.
  ctx.fillStyle = p.pillow;
  ctx.beginPath();
  ctx.roundRect(left + 7, g - mattress - 12, 30, 10, 5);
  ctx.fill();
}

function drawKitchen(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { ovenX } = scene.layout;
  const g = scene.ground;
  const w = OVEN_WIDTH;
  const left = ovenX - w / 2;

  contactShadow(ctx, ovenX, g, w + 4, p);

  // The unit, and a worktop with its own surface running over it.
  box(ctx, ovenX, g, w, OVEN_HEIGHT, p.ovenBody, p.ovenBodyTop, 3, p.ovenEdge);
  box(ctx, ovenX, g - OVEN_HEIGHT, w + 6, 5, p.ovenTrim, p.ovenTrimTop, 1.5, p.ovenEdge);

  // Door, and the glow of something cooking behind it.
  ctx.fillStyle = p.ovenGlass;
  ctx.beginPath();
  ctx.roundRect(left + 8, g - 44, w - 16, 32, 3);
  ctx.fill();
  ctx.fillStyle = p.ovenGlow;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(ovenX, g - 26, w / 2 - 15, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Handle and dials.
  ctx.fillStyle = p.ovenTrim;
  ctx.beginPath();
  ctx.roundRect(left + 7, g - 51, w - 14, 3.5, 1.5);
  ctx.fill();
  ctx.fillStyle = p.ovenDial;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(left + 15 + i * 12, g - 58, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Extractor hood over it, hung off the wall.
  const hoodBottom = g - OVEN_HOOD_TOP + 22;
  ctx.fillStyle = p.hoodTop;
  ctx.beginPath();
  ctx.moveTo(left - 4, g - OVEN_HOOD_TOP);
  ctx.lineTo(left - 4 + DEPTH * 0.75, g - OVEN_HOOD_TOP - DEPTH * 0.5);
  ctx.lineTo(left + w + 4 + DEPTH * 0.75, g - OVEN_HOOD_TOP - DEPTH * 0.5);
  ctx.lineTo(left + w + 4, g - OVEN_HOOD_TOP);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.hood;
  ctx.beginPath();
  ctx.moveTo(left - 4, g - OVEN_HOOD_TOP);
  ctx.lineTo(left + w + 4, g - OVEN_HOOD_TOP);
  ctx.lineTo(left + w - 10, hoodBottom);
  ctx.lineTo(left + 10, hoodBottom);
  ctx.closePath();
  ctx.fill();
}

/**
 * A three-seat sofa in cream leather: rolled arms, a low back, and two seams
 * where the cushions meet.
 */
function drawSofa(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { loungeX } = scene.layout;
  const g = scene.ground;
  const w = SOFA_WIDTH;
  const left = loungeX - w / 2;
  const seat = SEAT_HEIGHT.sofa;

  contactShadow(ctx, loungeX, g, w + 6, p);

  // Back, standing behind the seat.
  box(ctx, loungeX, g, w - 14, SOFA_BACK, p.sofaDark, p.sofaLight, 7, p.sofaEdge);

  // The seat itself, and its cushions: three of them, so it is a three-seater
  // at a glance rather than on being counted.
  box(ctx, loungeX, g, w, seat + 9, p.sofa, p.sofaLight, 5, p.sofaEdge);
  ctx.strokeStyle = p.sofaSeam;
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 3; i++) {
    const sx = left + 9 + ((w - 18) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(sx, g - seat - 8);
    ctx.lineTo(sx, g - 3);
    ctx.stroke();
  }

  // Rolled arms, one either end, drawn over the seat.
  for (const ax of [left + 5, left + w - 5]) {
    ctx.fillStyle = p.sofaLight;
    ctx.beginPath();
    ctx.roundRect(ax - 7, g - seat - 19, 14, seat + 19, 7);
    ctx.fill();
    ctx.strokeStyle = p.sofaEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = p.sofa;
    ctx.beginPath();
    ctx.ellipse(ax, g - seat - 13, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The television: wide, thin, and hung on the wall over the sofa. */
function drawTv(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { loungeX } = scene.layout;
  const g = scene.ground;
  const top = g - TV_HANGS_AT - TV_PANEL;

  // A bare panel: the bezel is a hairline, which is what makes it read as a
  // set somebody bought recently rather than a box.
  ctx.fillStyle = p.tvBody;
  ctx.beginPath();
  ctx.roundRect(loungeX - TV_WIDTH / 2, top, TV_WIDTH, TV_PANEL, 3);
  ctx.fill();

  ctx.fillStyle = p.tvScreenOff;
  ctx.beginPath();
  ctx.roundRect(loungeX - TV_WIDTH / 2 + 1.6, top + 1.6, TV_WIDTH - 3.2, TV_PANEL - 5, 1.5);
  ctx.fill();

  // A sheen across the dark glass, so it reads as a screen that is off rather
  // than as a hole in the wall.
  ctx.fillStyle = p.tvSheen;
  ctx.beginPath();
  ctx.moveTo(loungeX - TV_WIDTH / 2 + 4, top + TV_PANEL - 6);
  ctx.lineTo(loungeX - TV_WIDTH / 2 + 22, top + 2);
  ctx.lineTo(loungeX - TV_WIDTH / 2 + 36, top + 2);
  ctx.lineTo(loungeX - TV_WIDTH / 2 + 18, top + TV_PANEL - 6);
  ctx.closePath();
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
  // Both come off the scene: the dance's turn and its bob are what `spin`
  // means, and working them out again here would be a second copy of it.
  ctx.translate(ciccio.x, y - ciccioBob(scene));
  ctx.scale(ciccioFacing(scene) || 0.001, 1);

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
  // Built out of overlapping lobes along a curve rather than as one crescent:
  // a smooth outline read as a moon stuck behind the squirrel, and the whole
  // point of these two is that they are fluffy.
  const TAIL = [
    { x: -6, y: -5, r: 6.5 },
    { x: -12, y: -12, r: 7.5 },
    { x: -16, y: -21, r: 8 },
    { x: -16, y: -30, r: 8 },
    { x: -12, y: -38, r: 7.5 },
    { x: -5, y: -42, r: 6.5 },
    { x: 1, y: -40, r: 5 },
  ];
  ctx.fillStyle = p.squirrelTail;
  for (const lobe of TAIL) {
    ctx.beginPath();
    ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A lighter core down the middle, the way the toy's tail is two-toned.
  ctx.fillStyle = p.squirrelTailLight;
  for (const lobe of TAIL.slice(1, 6)) {
    ctx.beginPath();
    ctx.arc(lobe.x + 2.4, lobe.y + 1, lobe.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

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
 * A dish of potato gratin, and the steam coming off it.
 *
 * The steam is thrown, so it goes above the reserved band on purpose — the band
 * covers what the room *stands* in, the same rule that lets the cello's pizza
 * sail over the app.
 */
function drawGratin(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const gratin = scene.gratin;
  if (!gratin) return;
  const g = scene.ground;

  // How much is left, so it goes down as he eats it.
  const left = Math.max(0.25, gratin.bites / GRATIN_BITES);

  contactShadow(ctx, gratin.x, g, 22, p);

  // The dish.
  ctx.fillStyle = p.dish;
  ctx.beginPath();
  ctx.ellipse(gratin.x, g - 3, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(gratin.x - 12, g - 8, 24, 6, 2);
  ctx.fill();

  // The gratin itself, browned on top.
  ctx.fillStyle = p.gratin;
  ctx.beginPath();
  ctx.ellipse(gratin.x, g - 9, 10 * left, 4 * left, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.gratinTop;
  ctx.beginPath();
  ctx.ellipse(gratin.x - 1, g - 10.5, 7.5 * left, 2.6 * left, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.steam;
  for (const puff of gratin.steam) {
    ctx.globalAlpha = Math.min(0.5, puff.life / 110);
    ctx.beginPath();
    ctx.arc(puff.x, g + puff.y, puff.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * What somebody is saying, in a bubble over their head.
 *
 * The scene owns the words and how long they stay up; the width is worked out
 * here, because measuring text needs a canvas and `scene.ts` has none. It is
 * drawn above the reserved band on purpose — a bubble is thrown, like the
 * steam off a gratin, and the band covers what the room *stands* in.
 */
function drawSaying(
  ctx: CanvasRenderingContext2D,
  saying: Say,
  x: number,
  top: number,
  p: Palette,
): void {
  ctx.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const width = ctx.measureText(saying.line).width + 14;
  const height = 17;
  const bottom = top - 7;

  // Fades out over its last stretch rather than vanishing mid-sentence.
  ctx.globalAlpha = Math.min(1, saying.left / 18);

  ctx.fillStyle = p.bubble;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, bottom - height, width, height, 7);
  ctx.fill();
  ctx.strokeStyle = p.bubbleEdge;
  ctx.lineWidth = 1;
  ctx.stroke();

  // The tail, pointing down at whoever said it.
  ctx.fillStyle = p.bubble;
  ctx.beginPath();
  ctx.moveTo(x - 4, bottom - 1);
  ctx.lineTo(x + 1, bottom + 5);
  ctx.lineTo(x + 4, bottom - 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.bubbleText;
  ctx.fillText(saying.line, x, bottom - height / 2);
  ctx.globalAlpha = 1;
}

/**
 * The whole room, back to front.
 *
 * Everything stands against the back wall and the three of them walk the strip
 * in front of all of it, which is both the draw order and the reason the room
 * has no nullable furniture: no piece ever competes with his floor. The
 * television goes on before the sofa, because it is hung on the wall behind it.
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

  drawRoom(ctx, scene, p);
  drawRug(ctx, scene, p);
  drawBed(ctx, scene, p);
  drawKitchen(ctx, scene, p);
  drawTv(ctx, scene, p);
  drawSofa(ctx, scene, p);

  drawGratin(ctx, scene, p);
  for (const squirrel of scene.squirrels) drawSquirrel(ctx, scene, squirrel, p);
  drawCiccio(ctx, scene, p);

  // Bubbles last, over everything, so one is never half behind a sofa.
  for (const squirrel of scene.squirrels) {
    if (squirrel.say) {
      drawSaying(ctx, squirrel.say, squirrel.x, scene.ground - SEAT_HEIGHT[squirrel.at] - 46, p);
    }
  }
  if (scene.ciccio.say) {
    drawSaying(
      ctx,
      scene.ciccio.say,
      scene.ciccio.x,
      scene.ground - SEAT_HEIGHT[scene.ciccio.at] - 34,
      p,
    );
  }

  ctx.restore();
}
