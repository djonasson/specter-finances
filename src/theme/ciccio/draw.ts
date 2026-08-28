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

import type { Scene, Squirrel, SquirrelKind } from './scene';
import {
  OVEN_WIDTH,
  OVEN_HEIGHT,
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
  ciccioAngle,
  ciccioFacing,
  ciccioNoseInFront,
  watchingTelevision,
  showingZebra,
  dashingForFood,
  scoldSwing,
  ovenBaking,
  squirrelAsleep,
  ciccioBob,
  ciccioY,
  squirrelY,
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
  floor: '#e0cdb2',
  floorBack: '#cdb695',
  floorLine: '#b49a78',
  floorSeam: '#c9b191',
  floorGrain: '#d3bd9f',
  shadow: 'rgba(60, 40, 24, 0.16)',

  ovenBody: '#d9d2c8',
  ovenBodyTop: '#e8e3db',
  ovenEdge: '#b3aa9d',
  ovenTrim: '#a89f92',
  ovenTrimTop: '#bfb7ab',
  ovenDial: '#8d8479',
  ovenGlass: '#4c4038',
  ovenGlow: '#e8a13c',

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
  tvScreenOn: '#0b0b0d',
  tvMark: '#e50914',
  zebra: '#f4f4f2',
  zebraDark: '#141414',
  zebraEye: '#2a2a2a',
  tvGlow: 'rgba(255, 236, 200, 0.30)',
  tvGlowFade: 'rgba(255, 236, 200, 0)',
  tvSheen: 'rgba(255,255,255,0.07)',
  picture: '#b9a68d',
  pictureArt: '#8fa8a0',

  quillDark: '#7d6c58',
  quillLight: '#a8977f',
  fur: '#efe3d2',
  furShade: '#dccdb7',
  nose: '#4f4f52',
  eye: '#2b2b2b',

  squirrelDark: '#ab5f2b',
  squirrelBelly: '#f4ead9',

  dish: '#e4e0d8',
  gratin: '#e8c98a',
  gratinTop: '#c98a3f',
  ovenDish: '#7d604a',
  scent: '#c9a06a',
  squirrelHe: '#a85c26',
  squirrelHeTail: '#bd7038',
  squirrelHeTailLight: '#d68f57',
  squirrelShe: '#e0a06a',
  squirrelSheTail: '#eab98c',
  squirrelSheTailLight: '#f6d3ad',
  steam: '#ffffff',

  cat: '#7fa8d8',
  catDark: '#5c85b4',
  catInner: '#e8b7c4',
  catChest: '#eef4fb',
  catNose: '#d98a9e',
  heart: '#e2607e',

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
  floor: '#584838',
  floorBack: '#463a2d',
  floorLine: '#332a21',
  floorSeam: '#4a3c2e',
  floorGrain: '#61503e',
  shadow: 'rgba(0, 0, 0, 0.3)',

  ovenBody: '#4a453e',
  ovenBodyTop: '#57514a',
  ovenEdge: '#2c2823',
  ovenTrim: '#332f2a',
  ovenTrimTop: '#403b35',
  ovenDial: '#6d665d',
  ovenGlass: '#211c18',
  ovenGlow: '#d2841f',

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
  tvScreenOn: '#0b0b0d',
  tvMark: '#e50914',
  zebra: '#e6e6e2',
  zebraDark: '#0d0d0d',
  zebraEye: '#1e1e1e',
  tvGlow: 'rgba(255, 232, 190, 0.22)',
  tvGlowFade: 'rgba(255, 232, 190, 0)',
  tvSheen: 'rgba(255,255,255,0.05)',
  picture: '#5a4d3e',
  pictureArt: '#4a5f58',

  quillDark: '#4f453a',
  quillLight: '#6f6252',
  fur: '#c4b6a2',
  furShade: '#a99a86',
  nose: '#2a2a2c',
  eye: '#141414',

  squirrelDark: '#83491f',
  squirrelBelly: '#cbbda6',

  dish: '#5a544b',
  gratin: '#b89a63',
  gratinTop: '#a06e30',
  ovenDish: '#5d4636',
  scent: '#9c7c52',
  squirrelHe: '#8a4c1e',
  squirrelHeTail: '#9c5e2c',
  squirrelHeTailLight: '#b0763f',
  squirrelShe: '#bd854e',
  squirrelSheTail: '#c99a6c',
  squirrelSheTailLight: '#dcb389',
  steam: '#cfc8bd',

  cat: '#5b7ea8',
  catDark: '#42607f',
  catInner: '#a8798a',
  catChest: '#c3ced9',
  catNose: '#a9647a',
  heart: '#b84a63',

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
  const topY = ground - h;
  const dx = DEPTH * 0.75;
  const dy = -DEPTH * 0.5;
  // The room is drawn small — at a phone's scale a cream sofa on a cream wall
  // is one shape. A hairline in the piece's own darker tone is what keeps the
  // furniture legible without outlining it like a cartoon.
  const outline = () => {
    if (!edge) return;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // The right-hand side, which is what was missing: a top face on its own reads
  // as a flap stuck to a flat card, because the solid it belongs to has no
  // thickness anywhere else. With the side in, the same two lines describe a box.
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(left + w, topY);
  ctx.lineTo(left + w + dx, topY + dy);
  ctx.lineTo(left + w + dx, ground + dy);
  ctx.lineTo(left + w, ground);
  ctx.closePath();
  ctx.fill();
  outline();

  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(left, topY);
  ctx.lineTo(left + dx, topY + dy);
  ctx.lineTo(left + w + dx, topY + dy);
  ctx.lineTo(left + w, topY);
  ctx.closePath();
  ctx.fill();
  outline();

  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.roundRect(left, topY, w, h, radius);
  ctx.fill();
  outline();
}

/**
 * Where a foot is in its stride, for somebody standing at this x.
 *
 * Taken from **how far they have walked**, not from the frame count. Off a
 * clock, feet paddle away under an animal standing still and the whole thing
 * reads as a treadmill; off the position, a stride is a stride whatever the
 * pace, and anybody who has stopped has stopped — including all three of them
 * on the sofa, without a single case written for it.
 */
const STRIDE = 11;
/**
 * A shorter one for running.
 *
 * Twice the speed over the same stride is twice the step *rate*, and it turned
 * out that is not enough to read as running — they still looked like they were
 * walking briskly behind him. A running animal takes shorter, quicker steps as
 * well as covering more ground, so the stride shortens too and the legs go
 * about four times as fast as at a stroll.
 */
const RUN_STRIDE = 5.5;

/**
 * How far towards the viewer the three of them stand.
 *
 * The furniture is against the back wall and they walk the strip in front of
 * it, but drawn on the very same line they simply overlapped it — passing the
 * cooker read as standing inside it. A few units nearer, into the floor, and
 * the same drawing order reads as in front. Presentation only: `ground` is
 * still the line the scene measures everything from.
 */
const FRONT_OF_ROOM = 7;

/**
 * Half way up a squirrel as it is drawn — feet at nothing, the top of the tail
 * at about −64. The pivot the head-down turn goes about.
 */
const SQUIRREL_MIDDLE = -32;

/**
 * Turns what follows about a point on the figure's own centre line.
 *
 * Rotating at the translate turns about the feet, which drops or throws the
 * whole animal sideways by however far the pivot is off centre.
 */
function turnAbout(ctx: CanvasRenderingContext2D, pivot: number, angle: number): void {
  if (angle === 0) return;
  ctx.translate(0, pivot);
  ctx.rotate(angle);
  ctx.translate(0, -pivot);
}
const gait = (x: number, foot: number, running = false) =>
  Math.sin((x / (running ? RUN_STRIDE : STRIDE)) * Math.PI + foot * Math.PI);

/**
 * A squirrel's tail, worked out once.
 *
 * As one crescent it read as a moon stuck on behind; as a row of overlapping
 * lobes it read as a chain of balls. What it actually is, is fur: a dense plume
 * taller than the animal, nearly upright and fat the whole way, every strand
 * radiating from a curved spine.
 *
 * None of it depends on the scene — `facing`, `headDown` and the scolding
 * rotation are all in the enclosing transform — and none of it is random: every
 * strand comes off a fixed hash of its own index, because a coat that
 * reshuffles each frame does not shimmer prettily, it boils. Being neither, it
 * is built at module load rather than a hundred and seventy times a frame, per
 * squirrel, for the life of the tab.
 */
const TAIL_SPINE = [
  { x: -5, y: -4, r: 8 },
  { x: -8, y: -16, r: 12 },
  { x: -10, y: -29, r: 14 },
  { x: -11, y: -42, r: 13.5 },
  { x: -11, y: -53, r: 10.5 },
];

/** A point along the spine, and which way is out from it. */
function alongTail(t: number) {
  const at = t * (TAIL_SPINE.length - 1);
  const i = Math.min(TAIL_SPINE.length - 2, Math.floor(at));
  const f = at - i;
  const a = TAIL_SPINE[i];
  const b = TAIL_SPINE[i + 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: a.x + dx * f,
    y: a.y + dy * f,
    r: a.r + (b.r - a.r) * f,
    // Perpendicular to the spine, pointing away from the body.
    nx: -dy / len,
    ny: dx / len,
  };
}

/** The soft middle, so no gap shows through the plume. */
const TAIL_CORE = Array.from({ length: 41 }, (_, i) => {
  const at = alongTail(i / 40);
  return { x: at.x, y: at.y, r: at.r * 0.88 };
});

/**
 * And the hairs standing out of it: short and many, or it reads as a thistle.
 *
 * Grouped by colour and by width rounded to a quarter of a unit, so the hundred
 * and thirty of them are drawn in eight `stroke()` calls instead of a hundred
 * and thirty — each of which was also setting `strokeStyle` and `lineWidth`.
 * The rounding is invisible at the size a squirrel is drawn and the grouping
 * changes nothing about where any hair goes.
 */
const TAIL_HAIRS = Array.from({ length: 130 }, (_, i) => {
  const h1 = ((i * 2654435761) % 1000) / 1000;
  const h2 = ((i * 40503) % 997) / 997;
  const at = alongTail((i % 44) / 43);
  // Fanned either side of straight out, so the plume has a soft edge rather
  // than a bristle line.
  const spread = (h1 - 0.5) * 1.5;
  const ax = at.nx * Math.cos(spread) - at.ny * Math.sin(spread);
  const ay = at.nx * Math.sin(spread) + at.ny * Math.cos(spread);
  const reach = at.r * (0.92 + h2 * 0.22);
  return {
    x0: at.x + ax * at.r * 0.35,
    y0: at.y + ay * at.r * 0.35,
    x1: at.x + ax * reach,
    y1: at.y + ay * reach,
    width: Math.round((3.2 - h2 * 1.1) * 4) / 4,
    light: i % 3 === 0,
  };
});

/** The same hairs, gathered into the fewest strokes that draw them. */
const TAIL_TUFTS = [
  ...new Map(TAIL_HAIRS.map((hair) => [`${hair.light}:${hair.width}`, hair])).values(),
].map((sample) => ({
  light: sample.light,
  width: sample.width,
  hairs: TAIL_HAIRS.filter((h) => h.light === sample.light && h.width === sample.width),
}));

/**
 * The same tail seen end-on, for a squirrel with its back to the room.
 *
 * An uneven edge rather than a circle with evenly spaced spokes, which is a
 * sunflower. Fixed geometry again, so it is built once and grouped into strokes
 * the same way the side view is.
 */
const rearLump = (a: number) => 1 + Math.sin(a * 3 + 0.7) * 0.07 + Math.sin(a * 5 + 2.1) * 0.05;

const REAR_EDGE = Array.from({ length: 41 }, (_, i) => {
  const a = (i / 40) * Math.PI * 2;
  const r = rearLump(a);
  return { x: Math.cos(a) * 13 * r, y: -17 + Math.sin(a) * 16.5 * r };
});

const REAR_HAIRS = Array.from({ length: 66 }, (_, i) => {
  const h1 = ((i * 2654435761) % 1000) / 1000;
  const h2 = ((i * 40503) % 997) / 997;
  // Jittered off the even spacing, or the hairs comb themselves into spokes.
  const a = ((i + h1 * 0.8) / 66) * Math.PI * 2;
  const r = rearLump(a);
  const out = 0.94 + h2 * 0.16;
  return {
    x0: Math.cos(a) * 13 * r * 0.62,
    y0: -17 + Math.sin(a) * 16.5 * r * 0.62,
    x1: Math.cos(a) * 13 * r * out,
    y1: -17 + Math.sin(a) * 16.5 * r * out,
    width: Math.round((3.4 - h1 * 1.2) * 4) / 4,
    light: i % 3 === 0,
  };
});

const REAR_TUFTS = [
  ...new Map(REAR_HAIRS.map((hair) => [`${hair.light}:${hair.width}`, hair])).values(),
].map((sample) => ({
  light: sample.light,
  width: sample.width,
  hairs: REAR_HAIRS.filter((h) => h.light === sample.light && h.width === sample.width),
}));

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

  // The floor: pale oak boards running the length of the room. The far strip
  // is darker, so the two together read as a corner rather than as a line.
  ctx.fillStyle = p.floorBack;
  ctx.fillRect(0, g - 1, scene.width, DEPTH * 0.5 + 1);
  ctx.fillStyle = p.floor;
  ctx.fillRect(0, g + DEPTH * 0.5, scene.width, scene.height - g);

  // Boards, and the joins between their ends, staggered the way a floor is
  // actually laid. All of it off a fixed hash of the position, so the grain
  // belongs to the floor rather than swimming about under everybody's feet.
  //
  // Batched into **two** paths rather than one per line. Every coordinate here
  // is a function of the room's size and that hash — none of it changes from
  // frame to frame — and stroked individually it was some four hundred and
  // thirty `stroke()` calls a frame, forever, on an app whose whole point is
  // being left open. Two calls draw the same floor.
  const top = g + DEPTH * 0.5;
  const rows = Math.max(1, Math.ceil((scene.height - top) / 9));
  const BOARD = 86;

  ctx.strokeStyle = p.floorSeam;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    const y = top + row * 9;
    ctx.moveTo(0, y);
    ctx.lineTo(scene.width, y);
    for (let x = ((row % 2) * BOARD) / 2; x < scene.width; x += BOARD) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 9);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = p.floorGrain;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    const y = top + row * 9;
    for (let i = 0; i < Math.ceil(scene.width / 34); i++) {
      const seed = (i * 7919 + row * 104729) % 1000;
      const gx = i * 34 + (seed % 17);
      const gy = y + 2.5 + (seed % 4);
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 16 + (seed % 11), gy + (seed % 3 === 0 ? 0.7 : -0.6));
    }
  }
  ctx.stroke();
}

function drawBed(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { bedX } = scene.layout;
  const g = scene.ground;
  const w = BED_WIDTH;
  const left = bedX - w / 2;
  const mattress = SEAT_HEIGHT.bed;

  contactShadow(ctx, bedX, g, w + 6, p);

  // Cream leather, like the sofa: one room, one suite. The headboard stands
  // well clear of the mattress and there is no footboard at all — a bed with a
  // board at both ends reads as a cot, and this one is meant to be got into.
  ctx.fillStyle = p.sofa;
  ctx.beginPath();
  ctx.roundRect(left - 3, g - BED_HEAD, 13, BED_HEAD, 5);
  ctx.fill();
  ctx.strokeStyle = p.sofaEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Buttoning down the headboard, which is what says leather rather than paint.
  ctx.fillStyle = p.sofaSeam;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(left + 3.5, g - BED_HEAD + 12 + i * 13, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  box(ctx, bedX, g, w, 13, p.sofaDark, p.sofaLight, 3, p.sofaEdge);
  box(ctx, bedX, g - 13, w - 4, mattress + 2, p.mattress, p.mattressTop, 3, p.sofaEdge);

  // The cover, drawn back towards the foot as the bed is turned down — which is
  // the whole of the answer to a tap on it. `turned` eases, so the click has
  // something to show for itself on the very next frame.
  const turned = scene.bed.turned;
  const coverFrom = left + w * (0.4 + turned * 0.22);
  const coverWidth = w - 4 - (coverFrom - left);
  ctx.fillStyle = p.blanketTop;
  ctx.beginPath();
  ctx.moveTo(coverFrom, g - mattress - 8);
  ctx.lineTo(coverFrom + DEPTH * 0.75, g - mattress - 8 - DEPTH * 0.5);
  ctx.lineTo(left + w - 4 + DEPTH * 0.75, g - mattress - 8 - DEPTH * 0.5);
  ctx.lineTo(left + w - 4, g - mattress - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.blanket;
  ctx.beginPath();
  ctx.roundRect(coverFrom, g - mattress - 8, coverWidth, 12 + turned * 3, 3);
  ctx.fill();
  // The turned-back fold, which grows as the cover is pulled down.
  ctx.fillStyle = p.blanketDark;
  ctx.beginPath();
  ctx.roundRect(
    coverFrom - turned * 4,
    g - mattress - 9 - turned * 2,
    4 + turned * 5,
    13 + turned * 4,
    2,
  );
  ctx.fill();

  // Pillow, propped against the headboard, plumped as the bed is made ready.
  ctx.fillStyle = p.pillow;
  ctx.beginPath();
  ctx.roundRect(
    left + 10 - turned * 2,
    g - mattress - 13 - turned * 4,
    30 + turned * 5,
    11 + turned * 4,
    6,
  );
  ctx.fill();
  ctx.strokeStyle = p.sofaEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
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

  // The door. What is behind it is *derived* from there being something in the
  // oven — light and dish together, so a lit oven with an empty shelf, or a
  // gratin cooking in the dark, are not states this can draw.
  ctx.fillStyle = p.ovenGlass;
  ctx.beginPath();
  ctx.roundRect(left + 8, g - 44, w - 16, 32, 3);
  ctx.fill();

  if (ovenBaking(scene)) {
    ctx.fillStyle = p.ovenGlow;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(ovenX, g - 26, w / 2 - 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // The dish on the shelf, in silhouette against the light.
    const shelf = g - 22;
    ctx.fillStyle = p.ovenDish;
    ctx.beginPath();
    ctx.roundRect(ovenX - 13, shelf - 7, 26, 8, 2);
    ctx.fill();
    // And what is in it, domed over the rim.
    ctx.fillStyle = p.gratinTop;
    ctx.beginPath();
    ctx.ellipse(ovenX, shelf - 7, 11, 4, 0, Math.PI, 0);
    ctx.fill();
  }

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

/**
 * A zebra, standing side-on, which is what the screen turns to for the last few
 * seconds of whatever they are watching.
 *
 * A **whole animal**, not a head. The head alone was drawn first and at the size
 * a television on the far wall actually is — about thirty pixels — it read as a
 * striped blob: nothing in a head is recognisable once the stripes are a pixel
 * apart. A standing zebra is recognisable from its outline alone, which is the
 * only thing that survives at that size.
 *
 * Built as one silhouette and then **clipped**, so the stripes are contained by
 * the body rather than laid over it. Drawing them as separate shapes means
 * matching every edge by hand and getting it wrong on the belly and the legs.
 *
 * `size` is the height from hoof to ear; everything else is a share of it.
 */
function drawZebra(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  p: Palette,
): void {
  const u = size / 60;

  ctx.save();
  ctx.translate(cx, cy + size * 0.46);
  ctx.scale(u, u);

  /**
   * The whole animal as one outline.
   *
   * Overlapping solids in a single path rather than an outline traced by hand —
   * filled, they union, so the legs meet the barrel and the neck meets both
   * without any of the joins having to be got right. Traced as one contour the
   * legs hung a clear gap below the body.
   */
  function silhouette() {
    ctx.beginPath();
    // Legs, run well up into the barrel so they join it.
    for (const lx of [-16, -9, 7, 14]) ctx.rect(lx, -30, 4.4, 30);
    // Barrel.
    ctx.moveTo(19, -30);
    ctx.ellipse(-1, -32, 20, 11, 0, 0, Math.PI * 2);
    // Neck, from the shoulder up to the poll.
    ctx.moveTo(6, -36);
    ctx.lineTo(15, -33);
    ctx.lineTo(28, -49);
    ctx.lineTo(19, -53);
    ctx.closePath();
    // Head: down and forward off the poll, to a muzzle.
    ctx.moveTo(19, -54);
    ctx.lineTo(30, -52);
    ctx.lineTo(36, -45);
    ctx.quadraticCurveTo(33, -42, 28, -43);
    ctx.lineTo(20, -48);
    ctx.closePath();
    // Ears.
    ctx.moveTo(20, -54);
    ctx.lineTo(20.5, -60);
    ctx.lineTo(24.5, -54);
    ctx.closePath();
    ctx.moveTo(25, -54);
    ctx.lineTo(27, -60);
    ctx.lineTo(29.5, -53);
    ctx.closePath();
    // Tail.
    ctx.moveTo(-20, -40);
    ctx.quadraticCurveTo(-26, -32, -25, -20);
    ctx.lineTo(-22, -20);
    ctx.quadraticCurveTo(-23, -31, -18, -38);
    ctx.closePath();
  }

  ctx.fillStyle = p.zebra;
  silhouette();
  ctx.fill();

  // Stripes, held inside the outline.
  ctx.save();
  silhouette();
  ctx.clip();
  ctx.strokeStyle = p.zebraDark;
  ctx.lineCap = 'butt';

  // Over the barrel: upright, and bent to follow it.
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 9; i++) {
    const x = -18 + i * 4.6;
    ctx.beginPath();
    ctx.moveTo(x, -45);
    ctx.quadraticCurveTo(x + 2, -32, x, -19);
    ctx.stroke();
  }
  // Up the neck, leaning with it.
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    ctx.beginPath();
    ctx.moveTo(4 + t * 15, -34 - t * 15);
    ctx.lineTo(12 + t * 16, -40 - t * 15);
    ctx.stroke();
  }
  // A few across the face.
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(22 + i * 4, -53);
    ctx.lineTo(26 + i * 4, -45);
    ctx.stroke();
  }
  // And round the legs — thin, or a leg five units wide reads as a ladder
  // rather than as a striped leg.
  ctx.lineWidth = 1.3;
  for (const lx of [-16, -9, 7, 14]) {
    for (let i = 0; i < 6; i++) {
      const y = -22 + i * 4.4;
      ctx.beginPath();
      ctx.moveTo(lx - 1, y);
      ctx.lineTo(lx + 5.6, y);
      ctx.stroke();
    }
  }
  ctx.restore();

  // The mane along the crest of the neck, a dark muzzle, and a tail tuft.
  ctx.fillStyle = p.zebraDark;
  ctx.beginPath();
  ctx.moveTo(7, -37);
  ctx.quadraticCurveTo(13, -48, 19, -54);
  ctx.lineTo(22, -52);
  ctx.quadraticCurveTo(16, -46, 11, -35);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(34, -45, 2.8, 2.4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-24, -19, 2.6, 3.6, 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Eye, last, so no stripe lands on it.
  ctx.fillStyle = p.zebraEye;
  ctx.beginPath();
  ctx.ellipse(26, -49, 1.6, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * The television: wide, thin, and hung on the wall over the sofa.
 *
 * Switched on it is a black screen with a red letter on it, and the glow it
 * throws is *derived* from `tv.on` rather than stored beside it — a lit room
 * with a dark set is not a state the scene can reach. `tv.on` itself has to be
 * stored, because "on while he is still walking over" is real; everything
 * downstream of it does not.
 */
function drawTv(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const { loungeX } = scene.layout;
  const g = scene.ground;
  const top = g - TV_HANGS_AT - TV_PANEL;
  const left = loungeX - TV_WIDTH / 2;
  const on = scene.tv.on;

  // A bare panel: the bezel is a hairline, which is what makes it read as a
  // set somebody bought recently rather than a box.
  ctx.fillStyle = p.tvBody;
  ctx.beginPath();
  ctx.roundRect(left, top, TV_WIDTH, TV_PANEL, 3);
  ctx.fill();

  ctx.fillStyle = on ? p.tvScreenOn : p.tvScreenOff;
  ctx.beginPath();
  ctx.roundRect(left + 1.6, top + 1.6, TV_WIDTH - 3.2, TV_PANEL - 5, 1.5);
  ctx.fill();

  if (on) {
    if (showingZebra(scene)) {
      drawZebra(ctx, loungeX, top + TV_PANEL / 2, TV_PANEL - 12, p);
    } else {
      // The letter, drawn as three strokes rather than as text: a font that is
      // not on the machine would silently substitute something else, and the
      // whole point of it is the shape.
      const h = TV_PANEL - 18;
      const w = h * 0.62;
      const x = loungeX - w / 2;
      const y = top + 8;
      const bar = w * 0.3;
      ctx.fillStyle = p.tvMark;
      ctx.fillRect(x, y, bar, h);
      ctx.fillRect(x + w - bar, y, bar, h);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + bar, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - bar, y + h);
      ctx.closePath();
      ctx.fill();
    }

    // The light it throws on the room below it.
    const glow = ctx.createRadialGradient(loungeX, top + TV_PANEL, 2, loungeX, top + TV_PANEL, 90);
    glow.addColorStop(0, p.tvGlow);
    glow.addColorStop(1, p.tvGlowFade);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(loungeX, top + TV_PANEL + 26, 84, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // A sheen across the dark glass, so an unlit set reads as a screen rather
  // than as a hole in the wall.
  ctx.fillStyle = p.tvSheen;
  ctx.beginPath();
  ctx.moveTo(left + 4, top + TV_PANEL - 6);
  ctx.lineTo(left + 22, top + 2);
  ctx.lineTo(left + 36, top + 2);
  ctx.lineTo(left + 18, top + TV_PANEL - 6);
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
  // Off the scene, so a climb on or off is drawn part way up rather than at
  // whichever end of it `at` currently names.
  const y = ciccioY(scene) + FRONT_OF_ROOM;
  const asleep = ciccio.phase === 'sleeping';

  const LONG = 23; // half his length, nose excluded
  const TALL = 15; // how high the dome stands

  const angle = ciccioAngle(scene);
  const turn = Math.cos(angle);
  const noseInFront = ciccioNoseInFront(scene);

  ctx.save();
  // The bob comes off the scene: it is what `spin` means, and a drawing that
  // worked it out again would be a second copy free to disagree.
  ctx.translate(ciccio.x, y - ciccioBob(scene));

  /**
   * Everything from the shoulders forward — muzzle, ear, nose, eye — drawn at
   * an offset along the body and squashed by how far round he has turned.
   *
   * Called either before or after the dome depending on which half of the turn
   * he is in, which is where the depth comes from: on the near half his face is
   * in front of his own back, on the far half it is hidden behind it. Scaling
   * the whole figure at once, as this used to, can never do that — which is
   * exactly why it read as a card.
   */
  function drawFace() {
    ctx.save();
    // Shortens towards nothing as he comes end-on, but never to nothing — which
    // is exactly what `ciccioFacing` means, so it is asked rather than worked
    // out again here. Computed in the drawing it was a second copy of the one
    // fact, free to drift, and the only reason `CICCIO_NARROWEST` was exported.
    ctx.scale(ciccioFacing(scene), 1);

    ctx.fillStyle = p.fur;
    ctx.beginPath();
    ctx.moveTo(4, -20);
    ctx.quadraticCurveTo(24, -19, 33, -8);
    ctx.quadraticCurveTo(28, -1.5, 14, -1.5);
    ctx.quadraticCurveTo(5, -2, 4, -20);
    ctx.fill();

    ctx.fillStyle = p.fur;
    ctx.beginPath();
    ctx.ellipse(1, -22.5, 4.6, 5, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.furShade;
    ctx.beginPath();
    ctx.ellipse(1.4, -22, 2.3, 2.7, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.nose;
    ctx.beginPath();
    ctx.ellipse(32.5, -8, 3.4, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();

    if (asleep) {
      // A closed eye is a line, not a dot.
      ctx.strokeStyle = p.eye;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(16.6, -13);
      ctx.lineTo(21.4, -13);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.eye;
      ctx.beginPath();
      ctx.arc(19, -13, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.fur;
      ctx.beginPath();
      ctx.arc(19.7, -13.8, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The bristled back: wide side-on, round end-on, never flat. */
  function drawDome() {
    ctx.save();
    // Seen end-on he is not a sliver but a round dome, so the body keeps a
    // width of its own however far round he is.
    const half = LONG * Math.max(Math.abs(turn), 0.62);

    ctx.fillStyle = p.furShade;
    [-11, 8].forEach((fx, foot) => {
      const swing = gait(ciccio.x, foot, dashingForFood(scene));
      ctx.beginPath();
      ctx.ellipse(
        fx * turn + swing * 3.2,
        -2.5 - Math.max(0, swing) * 1.8,
        5,
        3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });

    ctx.fillStyle = p.quillLight;
    ctx.beginPath();
    ctx.ellipse(-2 * turn, -2, half, TALL, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-2 * turn - half, -3, half * 2, 3);
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      const a = Math.PI + t * Math.PI;
      ctx.beginPath();
      ctx.arc(-2 * turn + Math.cos(a) * half, -2 + Math.sin(a) * TALL, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // The coat, and — when there is a cat about — the spines it turns into.
    // `bristle` eases, so they go up as it comes over and down again the moment
    // it says something kind to him.
    const up = ciccio.bristle;
    ctx.strokeStyle = p.quillDark;
    ctx.lineWidth = 1.6 + up * 0.5;
    ctx.lineCap = up > 0.5 ? 'butt' : 'round';
    for (let i = 0; i < 26; i++) {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = 0.42 + ((i * 7) % 11) / 22;
      const fx = -2 * turn + Math.cos(a) * half * r;
      const fy = -3 - Math.abs(Math.sin(a)) * TALL * r;
      if (fy > -4) continue;
      // Lying flat they are flecks in the coat; standing up they point away
      // from the middle of him, which is what makes them read as thorns.
      const outX = Math.cos(a) * (2.2 + up * 9);
      const outY = -Math.abs(Math.sin(a)) * (2.6 + up * 9) - up * 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + outX, fy + outY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The order *is* the depth.
  if (noseInFront) {
    drawDome();
    drawFace();
  } else {
    drawFace();
    drawDome();
  }

  ctx.restore();

  if (asleep) sleepingZs(ctx, scene, p, ciccio.x + 16, y - 26);
}

/**
 * The "z"s over somebody asleep — his, and both squirrels'.
 *
 * One function because it is one thing three animals do: written out per
 * sleeper it drifted, and the squirrels simply did not have any while sharing a
 * bed with a hedgehog who did. Off the frame count so they rise rather than
 * sitting still, and drawn outside anybody's flip, or they would be mirrored
 * along with the sleeper.
 */
function sleepingZs(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  p: Palette,
  x: number,
  top: number,
): void {
  ctx.fillStyle = p.eye;
  ctx.font = '600 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 2; i++) {
    const t = (scene.frame / 70 + i * 0.5) % 1;
    ctx.globalAlpha = 0.55 * (1 - t);
    ctx.fillText('z', x + t * 9, top - t * 20);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}

/**
 * The smell of it, drifting out of the oven and off across the room to him.
 *
 * Wisps rather than the plate's round puffs — a cartoon scent is a ribbon that
 * goes somewhere, and where it goes is `drift`, which the scene aims at him
 * when each one is born.
 */
function drawScent(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const baking = scene.baking;
  if (!baking) return;

  ctx.strokeStyle = p.scent;
  ctx.lineCap = 'round';
  for (const puff of baking.scent) {
    const fade = Math.min(1, puff.life / 60);
    ctx.globalAlpha = 0.5 * fade;
    ctx.lineWidth = puff.size * 0.5;
    const x = puff.x;
    const y = scene.ground + puff.y;
    // A short curl, leaning the way it is travelling.
    ctx.beginPath();
    ctx.moveTo(x - puff.size, y + puff.size);
    ctx.quadraticCurveTo(x + puff.size * puff.drift * 2, y, x + puff.size, y - puff.size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Which of the two coats a squirrel wears.
 *
 * Read off `kind`, the same field that decides which of them goes up the wall,
 * so the darker one is always the one being told off. Chosen any other way —
 * by index, by side, by a roll — the pair would swap coats the first time
 * anything reordered them, and the scolding would stop matching the animal.
 */
interface Coat {
  body: string;
  tail: string;
  tailLight: string;
}

const coatFor = (kind: SquirrelKind, p: Palette): Coat =>
  kind === 'he'
    ? { body: p.squirrelHe, tail: p.squirrelHeTail, tailLight: p.squirrelHeTailLight }
    : { body: p.squirrelShe, tail: p.squirrelSheTail, tailLight: p.squirrelSheTailLight };

/** A squirrel: upright, cream-bellied, mostly tail. */
function drawSquirrel(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  squirrel: Squirrel,
  p: Palette,
): void {
  const y = squirrelY(scene, squirrel) + FRONT_OF_ROOM;

  const swing = scoldSwing(scene, squirrel);
  const coat = coatFor(squirrel.kind, p);

  if (watchingTelevision(scene) && squirrel.climb === 0) {
    drawSquirrelFromBehind(ctx, squirrel.x, y, p, coat, swing);
    return;
  }

  ctx.save();
  ctx.translate(squirrel.x, y);
  // The telling-off: a tail swung round at whoever needed fetching down.
  //
  // About the middle of the figure and *before* the mirror, which are two
  // separate bugs it had. Applied at the translate it turned the whole animal
  // about its own feet — 9.4 units of lateral travel at the top of a 34-unit
  // squirrel, which reads as tipping over rather than as a tail swung round.
  // And applied after `ctx.scale(facing)` it was mirrored with the body, so a
  // left-facing squirrel swung the other way and a scold that began from behind
  // and finished side-on reversed direction half way through.
  turnAbout(ctx, SQUIRREL_MIDDLE, swing);
  // Head down is how a squirrel actually comes down a wall, and it is also the
  // moment it works out that it cannot.
  //
  // Turned about the middle of the *figure*, so it occupies the same band of
  // wall afterwards: turned about anything else it drops by however far the
  // pivot is off centre, which is exactly what it looked like — a squirrel that
  // reached the top and then slid down half its own height to think about it.
  if (squirrel.headDown) turnAbout(ctx, SQUIRREL_MIDDLE, Math.PI);
  ctx.scale(squirrel.facing || 0.001, 1);

  // The tail first, so it sits behind the body — a great question mark curling
  // up and over.
  // The tail is the biggest thing about a squirrel and the hardest to fake.
  // See `TAIL_CORE` and `TAIL_HAIRS`, which is where it is worked out.
  ctx.fillStyle = coat.tail;
  for (const lobe of TAIL_CORE) {
    ctx.beginPath();
    ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round';
  for (const tuft of TAIL_TUFTS) {
    ctx.strokeStyle = tuft.light ? coat.tailLight : coat.tail;
    ctx.lineWidth = tuft.width;
    ctx.beginPath();
    for (const hair of tuft.hairs) {
      ctx.moveTo(hair.x0, hair.y0);
      ctx.lineTo(hair.x1, hair.y1);
    }
    ctx.stroke();
  }

  // Body.
  ctx.fillStyle = coat.body;
  ctx.beginPath();
  ctx.ellipse(0, -14, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly.
  ctx.fillStyle = p.squirrelBelly;
  ctx.beginPath();
  ctx.ellipse(3, -11, 6.2, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head.
  ctx.fillStyle = coat.body;
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

  // Feet, taking turns. Two of them rather than one, or there is nothing for a
  // stride to alternate between.
  ctx.fillStyle = p.squirrelDark;
  [0, 1].forEach((foot) => {
    const swing = gait(squirrel.x, foot, dashingForFood(scene));
    ctx.beginPath();
    ctx.ellipse(1.5 + swing * 3, -1.8 - Math.max(0, swing) * 1.6, 4.4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();

  // They are in the bed too, so they get the same "z"s he does — over the
  // outside shoulder, away from him, or all three sets pile up in the middle.
  if (squirrelAsleep(scene, squirrel)) {
    sleepingZs(ctx, scene, p, squirrel.x + squirrel.side * 13, y - 22);
  }
}

/**
 * A squirrel with its back to the room, which is what watching a television on
 * the far wall looks like.
 *
 * Not the side view mirrored: from behind, the tail is between us and the
 * animal and there is nothing to face left or right. Turning the side view
 * round cannot express that, which is why "they still are not facing the
 * television" was true however the facing was set.
 *
 * And it is *only* the tail. A head drawn peeping over the top is a head that
 * would in fact be behind the thing drawn in front of it — the tail stands
 * taller than the animal does, which is the whole reason `SQUIRREL_TAIL_RISE`
 * is what sets their reach.
 */
function drawSquirrelFromBehind(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: Palette,
  coat: Coat,
  swing: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  // The telling-off. It used to be drawn only in the side-on pose, which a
  // scolding never reaches: entering it puts both squirrels back on the sofa,
  // and the sofa is exactly what routes them through here — so the slap that
  // the "Pfff!" is paired with was never once seen. About the middle, as in the
  // other pose — see there.
  turnAbout(ctx, SQUIRREL_MIDDLE, swing);

  // Feet either side, just showing past the tail.
  ctx.fillStyle = p.squirrelDark;
  for (const fx of [-6, 6]) {
    ctx.beginPath();
    ctx.ellipse(fx, -1.8, 4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The tail first, filling most of the view — it is between us and the animal.
  // See `REAR_EDGE` and `REAR_TUFTS`, which is where its shape is worked out.
  ctx.fillStyle = coat.tail;
  ctx.beginPath();
  REAR_EDGE.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.closePath();
  ctx.fill();

  ctx.lineCap = 'round';
  for (const tuft of REAR_TUFTS) {
    ctx.strokeStyle = tuft.light ? coat.tailLight : coat.tail;
    ctx.lineWidth = tuft.width;
    ctx.beginPath();
    for (const hair of tuft.hairs) {
      ctx.moveTo(hair.x0, hair.y0);
      ctx.lineTo(hair.x1, hair.y1);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * The little blue cat, who calls now and then.
 *
 * Drawn side-on and always facing him, which is the one direction it is ever
 * going: it comes in from an edge, walks to him, and goes back the way it came.
 */
function drawCat(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  const cat = scene.cat;
  if (!cat) return;
  const g = scene.ground;
  contactShadow(ctx, cat.x, g + FRONT_OF_ROOM, 26, p);

  ctx.save();
  ctx.translate(cat.x, g + FRONT_OF_ROOM);
  ctx.scale(cat.facing, 1);

  // Tail, up and curled at the tip the way a pleased cat carries it.
  ctx.strokeStyle = p.cat;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-11, -12);
  ctx.quadraticCurveTo(-22, -18, -19, -31);
  ctx.stroke();

  // Legs, walking. Same stride as everybody else, off the ground it has covered.
  ctx.strokeStyle = p.catDark;
  ctx.lineWidth = 3.2;
  [0, 1].forEach((leg) => {
    const swing = gait(cat.x, leg) * 3;
    for (const lx of [-7, 6]) {
      ctx.beginPath();
      ctx.moveTo(lx, -11);
      ctx.lineTo(lx + swing * (lx < 0 ? 1 : -1), -1);
      ctx.stroke();
    }
  });

  // Body and head.
  ctx.fillStyle = p.cat;
  ctx.beginPath();
  ctx.ellipse(-2, -16, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(10, -23, 8.5, 0, Math.PI * 2);
  ctx.fill();

  // Ears.
  ctx.fillStyle = p.cat;
  for (const ex of [5, 14]) {
    ctx.beginPath();
    ctx.moveTo(ex - 3.5, -29);
    ctx.lineTo(ex, -37);
    ctx.lineTo(ex + 3.5, -29);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = p.catInner;
  for (const ex of [5, 14]) {
    ctx.beginPath();
    ctx.moveTo(ex - 1.8, -29.5);
    ctx.lineTo(ex, -34.5);
    ctx.lineTo(ex + 1.8, -29.5);
    ctx.closePath();
    ctx.fill();
  }

  // A cream chest, and a face.
  ctx.fillStyle = p.catChest;
  ctx.beginPath();
  ctx.ellipse(6, -14, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.eye;
  ctx.beginPath();
  ctx.arc(9, -25, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(15, -25, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.catNose;
  ctx.beginPath();
  ctx.ellipse(13, -20.5, 1.6, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Whiskers.
  ctx.strokeStyle = p.catChest;
  ctx.lineWidth = 0.8;
  for (const wy of [-21.5, -19.5]) {
    ctx.beginPath();
    ctx.moveTo(14, wy);
    ctx.lineTo(23, wy - 1.5);
    ctx.stroke();
  }

  ctx.restore();
}

/** The hearts a kiss leaves behind, rising over the pair of them. */
function drawHearts(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette): void {
  ctx.fillStyle = p.heart;
  for (const heart of scene.hearts) {
    const size = 4 + (1 - heart.life / 90) * 2;
    ctx.globalAlpha = Math.min(0.85, heart.life / 45);
    const x = heart.x;
    const y = scene.ground + heart.y;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.8);
    ctx.bezierCurveTo(
      x - size * 1.4,
      y - size * 0.4,
      x - size * 0.5,
      y - size * 1.3,
      x,
      y - size * 0.4,
    );
    ctx.bezierCurveTo(
      x + size * 0.5,
      y - size * 1.3,
      x + size * 1.4,
      y - size * 0.4,
      x,
      y + size * 0.8,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
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

  contactShadow(ctx, gratin.x, g + FRONT_OF_ROOM, 22, p);

  // The dish, standing on the same strip of floor they walk.
  ctx.save();
  ctx.translate(0, FRONT_OF_ROOM);
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

  ctx.restore();

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
  // Saved rather than put back by hand: the reset re-spelled the canvas defaults
  // as literals, and covered three of the four things this sets — `font` was
  // left behind, and happened not to matter only because everything else that
  // draws text sets its own.
  ctx.save();
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
  ctx.restore();
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
  drawBed(ctx, scene, p);
  drawKitchen(ctx, scene, p);
  drawTv(ctx, scene, p);
  drawSofa(ctx, scene, p);

  drawScent(ctx, scene, p);
  drawGratin(ctx, scene, p);
  for (const squirrel of scene.squirrels) drawSquirrel(ctx, scene, squirrel, p);
  drawCiccio(ctx, scene, p);
  drawCat(ctx, scene, p);
  drawHearts(ctx, scene, p);

  // Bubbles last, over everything, so one is never half behind a sofa — the
  // cat's included. The scene built, ticked and typed `cat.say` all along while
  // nothing here drew it, so the meow this code calls "the point of the visit"
  // was silent for the whole of every visit.
  for (const squirrel of scene.squirrels) {
    if (squirrel.say) {
      drawSaying(ctx, squirrel.say, squirrel.x, squirrelY(scene, squirrel) + FRONT_OF_ROOM - 46, p);
    }
  }
  // Off `ciccioY`, the same way a squirrel's is off `squirrelY`: the seat alone
  // ignores how far onto it he has got, so the bubble jumped a whole cushion on
  // the frame `at` changed while he was still half way up.
  if (scene.ciccio.say) {
    drawSaying(ctx, scene.ciccio.say, scene.ciccio.x, ciccioY(scene) + FRONT_OF_ROOM - 34, p);
  }
  // Clear of its ears, which are the tallest part of it at −37.
  if (scene.cat?.say) {
    drawSaying(ctx, scene.cat.say, scene.cat.x, scene.ground + FRONT_OF_ROOM - 46, p);
  }

  ctx.restore();
}
