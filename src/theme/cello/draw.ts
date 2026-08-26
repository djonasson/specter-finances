/**
 * Drawing for the Cello scene: canvas primitives and colours, no decisions.
 *
 * Everything here reads the state `scene.ts` produced and paints it. Nothing in
 * this file may change that state — if it did, the scene's guarantees would stop
 * being testable, which is the whole reason the two are separate files.
 */
import {
  atTheWheel,
  birdAtRest,
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
  bananaLean,
  bananaLeaves,
  BANANA_STEM_FOOT,
  BANANA_STEM_TOP,
  BANANA_TRUNKS,
  carryingPizza,
  leafSway,
  girlOnFoot,
  inPark,
  lounging,
  LOUNGER_BACK_HEIGHT,
  LOUNGER_LENGTH,
  squirrelBehind,
  squirrelFacing,
  squirrelX,
  squirrelY,
  PEEL_BLADE_ALONG,
  PEEL_BLADE_DEPTH,
  PEEL_CARRY_ABOVE,
  PEEL_CARRY_ALONG,
  PEEL_GRIP,
  PEEL_PIVOT,
  peelAngle,
  peelSwing,
  CAR_OUTLINE,
  WHEEL_RUN,
  CAR_ROOF_HEIGHT,
  CAR_WIDTH,
  SCHOOL_DOOR_HEIGHT,
  SCHOOL_DOOR_WIDTH,
  SCHOOL_CHIMNEY_CAP,
  SCHOOL_CHIMNEY_WIDTH,
  SCHOOL_ROOF_HEIGHT,
  SCHOOL_WALL_HEIGHT,
  schoolChimney,
  schoolRoofY,
  SCHOOL_WIDTH,
  TREE_CROWN_RADIUS,
  TREE_HEIGHT,
  doorOpen,
  schoolLit,
  treeSway,
} from './scene';
import type { Car, LeafShape, Pizza, Scene } from './scene';

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
  // Trunks and the school door, which were two names for one brown.
  wood: '#7a563a',
  squirrel: '#b06a3b',
  squirrelBelly: '#e8c9a8',
  canvas: '#4f86b8',
  canvasStripe: '#eaf1f7',
  stem: '#8fae5e',
  stemShade: '#6f8f49',
  stemDry: '#b9ad6a',
  foliage: '#6f9b52',
  foliageDark: '#527a3c',
  /** The school's walls and the car's body, which are the same light beige. */
  beige: '#efe3cd',
  beigeShade: '#cdc5b4',
  schoolRoof: '#9c5a44',
  windowLit: '#ffd47a',
  /** Unlit glass, in a window or a headlamp. */
  glass: '#b7cfe0',
  chrome: '#d7d3cb',
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
  squirrel: '#8a5330',
  canvas: '#33628c',
  canvasStripe: '#c3d4e2',
  stem: '#5f7a41',
  stemShade: '#4a6134',
  stemDry: '#7d7448',
  squirrelBelly: '#c8a887',
  wood: '#4a3626',
  foliage: '#3f5c33',
  foliageDark: '#2f4626',
  beige: '#6b5f4d',
  // Darker than the beige, not lighter: sharing the school's colour made the
  // car's old shade a highlight, and its arches read as chrome.
  beigeShade: '#544a3b',
  schoolRoof: '#5e372a',
  windowLit: '#f2c463',
  glass: '#5d7286',
  chrome: '#8d8a84',
} satisfies Palette;

/** Where the pepperoni sits, as a fraction of the radius. */
/** How big she is at the window, against her full height on the terrace. */
const SHADOW_SCALE = 0.36;
/**
 * The school's windows: how far below the eaves they hang, and how big they are.
 *
 * Balanced between the eaves and the ground rather than set near the top — hung
 * 20px down at 20 tall, they left twice as much wall below them as above and the
 * building read as though its windows had floated up. Named because four things
 * depend on the height, the silhouette at the pane among them.
 */
const WINDOW_BELOW_EAVES = 24;
/**
 * Tall enough that the sill lines up with the middle of the door — derived from
 * the door rather than picked, so the two stay level if either moves.
 */
const WINDOW_HEIGHT = SCHOOL_WALL_HEIGHT - WINDOW_BELOW_EAVES - SCHOOL_DOOR_HEIGHT / 2;
const WINDOW_WIDTH = 22;
/**
 * How far below the top of the pane her head sits, so the frame cuts her at the
 * chest whatever the window's height — closer in, her hair alone fills it.
 */
const SHADOW_HEAD_BELOW_TOP = 9;
/** Her at the wheel: smaller again, since a door window is not a school window. */
const DRIVER_SCALE = 0.26;

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
 * The colony in one stand of trees, on one side of them.
 *
 * Small enough that they read as movement first and as squirrels second, which
 * at this size is the best a squirrel can hope for.
 *
 * Which stand matters: a squirrel spirals round its trunk, so each colony has
 * to be drawn either side of its *own* trees. Both passes run against the park
 * alone and the bananas came later, so a banana squirrel was painted before its
 * plant either way — behind it for half the spiral and blinking out from behind
 * the stem for the other half, which is the one thing that makes it read as an
 * animal rather than a lift.
 */
function drawSquirrels(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  p: Palette,
  behind: boolean,
  park: boolean,
) {
  for (const squirrel of scene.squirrels) {
    if (squirrelBehind(squirrel) !== behind) continue;
    if (inPark(scene, squirrel.tree) !== park) continue;
    const x = squirrelX(scene, squirrel);
    const y = squirrelY(scene, squirrel);
    const facing = squirrelFacing(scene, squirrel);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    // Tail: the half of him that carries at this size, curled up over his back.
    ctx.strokeStyle = p.squirrel;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.quadraticCurveTo(-7, -2, -6, -7);
    ctx.stroke();

    ctx.fillStyle = p.squirrel;
    ctx.beginPath();
    ctx.ellipse(0, -2, 3.4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(3, -4, 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Ear and belly, which is all the detail there is room for.
    ctx.beginPath();
    ctx.moveTo(2.4, -5.6);
    ctx.lineTo(3.2, -7.4);
    ctx.lineTo(4.1, -5.7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = p.squirrelBelly;
    ctx.beginPath();
    ctx.ellipse(1, -1.4, 1.8, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  ctx.lineCap = 'butt';
}

/**
 * The points a leaf is drawn from, worked out once and kept.
 *
 * The shape of a leaf never changes — `bananaLeaves` hashes it out of the
 * leaf's own indices — and only its nodding does, which is a `rotate` around the
 * crown. Sampling the ribbon every frame meant nineteen leaves × thirteen points
 * of trigonometry and four arrays each, forty times a second, to arrive at the
 * same numbers as the frame before.
 */
interface LeafPath {
  /** The blade outline, as flat x, y pairs. */
  blade: number[];
  /** Where the stalk ends and the blade starts. */
  from: { x: number; y: number };
  /** The midrib, down the middle of the blade. */
  midrib: number[];
}

const leafPaths = new Map<string, LeafPath>();

/** Where the stalk ends and the blade begins, along the leaf's spine. */
const BLADE_FROM = 0.3;
const BLADE_SAMPLES = 12;

function leafPath(plant: number, index: number, leaf: LeafShape): LeafPath {
  const key = `${plant}:${index}`;
  const known = leafPaths.get(key);
  if (known) return known;

  const { control, tip, half } = leaf;
  // The spine, with the leaf's own origin at the crown.
  const at = (t: number) => ({
    x: 2 * (1 - t) * t * control.x + t * t * tip.x,
    y: 2 * (1 - t) * t * control.y + t * t * tip.y,
  });
  const slope = (t: number) => ({
    x: 2 * (1 - t) * control.x + 2 * t * (tip.x - control.x),
    y: 2 * (1 - t) * control.y + 2 * t * (tip.y - control.y),
  });
  const width = (t: number) =>
    half * Math.sin(Math.PI * ((t - BLADE_FROM) / (1 - BLADE_FROM))) ** 0.55;

  const near: number[] = [];
  const far: number[] = [];
  const midrib: number[] = [];
  for (let i = 0; i <= BLADE_SAMPLES; i++) {
    const t = BLADE_FROM + ((1 - BLADE_FROM) * i) / BLADE_SAMPLES;
    const point = at(t);
    const along = slope(t);
    const length = Math.hypot(along.x, along.y) || 1;
    const acrossX = -along.y / length;
    const acrossY = along.x / length;
    const w = width(t);
    near.push(point.x + acrossX * w, point.y + acrossY * w);
    far.unshift(point.x - acrossX * w, point.y - acrossY * w);
    midrib.push(point.x, point.y);
  }
  // `far` was built tip-first, so the outline closes without reversing anything.
  const path: LeafPath = { blade: [...near, ...far], from: at(BLADE_FROM), midrib };
  leafPaths.set(key, path);
  return path;
}

/** A leaf, at the crown's origin: stalk, blade, midrib. */
function drawLeaf(ctx: CanvasRenderingContext2D, path: LeafPath, p: Palette, dark: boolean) {
  ctx.strokeStyle = p.stem;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(path.from.x, path.from.y);
  ctx.stroke();

  ctx.fillStyle = dark ? p.foliageDark : p.foliage;
  ctx.beginPath();
  ctx.moveTo(path.blade[0], path.blade[1]);
  for (let i = 2; i < path.blade.length; i += 2) ctx.lineTo(path.blade[i], path.blade[i + 1]);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = p.stem;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(path.midrib[0], path.midrib[1]);
  for (let i = 2; i < path.midrib.length; i += 2) ctx.lineTo(path.midrib[i], path.midrib[i + 1]);
  ctx.stroke();
}

/** One plant: a fat green pseudostem, and its leaves nodding out of the top. */
function drawBananaPlant(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  p: Palette,
  plant: number,
  x: number,
) {
  const base = scene.ground;
  const lean = bananaLean(scene, plant);
  const trunk = BANANA_TRUNKS[plant % BANANA_TRUNKS.length];
  const top = base - trunk;
  const crownX = x + lean;

  // A banana's stem is a fat green pseudostem, not a woody trunk: wide at the
  // foot, barely tapering, with a papery dried sheath low down, and every leaf
  // stalk leaving from the very top of it.
  // In `scene.ts`, because the squirrels' orbit is derived from them.
  const footHalf = BANANA_STEM_FOOT;
  const topHalf = BANANA_STEM_TOP;
  ctx.fillStyle = p.stem;
  ctx.beginPath();
  ctx.moveTo(x - footHalf, base);
  ctx.quadraticCurveTo(x - footHalf + lean * 0.4, base - trunk * 0.55, crownX - topHalf, top);
  ctx.lineTo(crownX + topHalf, top);
  ctx.quadraticCurveTo(x + footHalf + lean * 0.4, base - trunk * 0.55, x + footHalf, base);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.stemShade;
  ctx.beginPath();
  ctx.moveTo(x + footHalf * 0.35, base);
  ctx.quadraticCurveTo(x + footHalf * 0.4 + lean * 0.4, base - trunk * 0.55, crownX + 1.4, top);
  ctx.lineTo(crownX + topHalf, top);
  ctx.quadraticCurveTo(x + footHalf + lean * 0.4, base - trunk * 0.55, x + footHalf, base);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.stemDry;
  ctx.beginPath();
  ctx.moveTo(x - footHalf + 1, base);
  ctx.quadraticCurveTo(x - 1, base - trunk * 0.3, x + 2.5, base - trunk * 0.42);
  ctx.lineTo(x + 3.5, base);
  ctx.closePath();
  ctx.fill();

  // Leaves: up out of the crown, arching over, the outer ones hanging below it —
  // which is the whole difference between a banana and a palm.
  bananaLeaves(plant).forEach((leaf, index) => {
    ctx.save();
    ctx.translate(crownX, top + 1);
    ctx.rotate(leafSway(scene, plant, index));
    drawLeaf(ctx, leafPath(plant, index, leaf), p, leaf.dark);
    ctx.restore();
  });
  ctx.lineCap = 'butt';
}

/**
 * The home end: two banana trees and a lounger under them, and her on it when
 * she is having an afternoon.
 *
 * Shorter than the park's trees on purpose — the band the app reserves is
 * measured from the bird in a park tree, and anything taller here would be drawn
 * over the user's own list without anything saying so.
 */
function drawHomeCorner(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const base = scene.ground;

  drawSquirrels(ctx, scene, p, true, false);
  for (const [plant, x] of scene.layout.bananaXs.entries()) {
    drawBananaPlant(ctx, scene, p, plant, x);
  }
  drawSquirrels(ctx, scene, p, false, false);

  // The lounger: a raked back, a flat seat, and two legs, in striped canvas.
  //
  // Its own colour, not the dress's: drawn in `p.dress` she lay on a lounger
  // exactly the colour of her clothes, and a whole afternoon of it read as an
  // empty chair.
  const x = scene.layout.loungerX;
  const half = LOUNGER_LENGTH / 2;
  const seat = base - LOUNGER_BACK_HEIGHT * 0.42;

  ctx.strokeStyle = p.chrome;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - half, base);
  ctx.lineTo(x - half + 4, seat);
  ctx.moveTo(x + half - 6, base);
  ctx.lineTo(x + half - 8, seat);
  ctx.stroke();

  ctx.fillStyle = p.canvas;
  ctx.beginPath();
  ctx.moveTo(x - half, seat + 2);
  ctx.lineTo(x + half - 6, seat + 2);
  ctx.lineTo(x + half - 8, seat - 3);
  ctx.lineTo(x - half - 2, seat - 3);
  ctx.closePath();
  ctx.fill();

  // The raked back, at the head end.
  ctx.beginPath();
  ctx.moveTo(x - half - 2, seat - 3);
  ctx.lineTo(x - half - 8, base - LOUNGER_BACK_HEIGHT);
  ctx.lineTo(x - half - 2, base - LOUNGER_BACK_HEIGHT + 2);
  ctx.lineTo(x - half + 4, seat - 3);
  ctx.closePath();
  ctx.fill();

  // Stripes across the canvas, which is what makes it read as a beach lounger
  // rather than a bench.
  ctx.strokeStyle = p.canvasStripe;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let stripe = 1; stripe <= 3; stripe++) {
    const at = x - half + 6 + stripe * 8;
    ctx.moveTo(at, seat + 2);
    ctx.lineTo(at - 1, seat - 3);
  }
  ctx.stroke();

  if (!lounging(scene)) return;

  // Her on it, stretched out with her head at the raked end.
  //
  // Everything sits *on* the canvas rather than over it: drawn as a body the
  // width of the seat she covered the stripes and most of the blue, and the
  // lounger read as having turned the colour of her dress.
  const top = seat - 3;

  ctx.lineCap = 'round';
  ctx.strokeStyle = p.skin;
  ctx.lineWidth = 2.4;
  // Legs, crossed at the ankle the way anybody lies on one of these.
  ctx.beginPath();
  ctx.moveTo(x + 2, top - 1.5);
  ctx.lineTo(x + half - 7, top - 0.5);
  ctx.moveTo(x + 2, top - 1.5);
  ctx.lineTo(x + half - 8, top - 3.5);
  ctx.stroke();

  // The dress, from her shoulders to her knees — half the seat, no more.
  ctx.fillStyle = p.dress;
  ctx.beginPath();
  ctx.ellipse(x - 4, top - 2.6, 8, 2.9, -0.05, 0, Math.PI * 2);
  ctx.fill();

  // An arm along her side.
  ctx.strokeStyle = p.skin;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x - 9, top - 3);
  ctx.lineTo(x - 2, top - 1.6);
  ctx.stroke();

  // Head and hair, propped up on the raked back.
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(x - half + 2, top - 5, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.arc(x - half, top - 5.8, 4.2, Math.PI * 0.5, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'butt';
}

/**
 * The park: a few round-crowned trees leaning in the wind.
 *
 * The lean comes from `treeSway` in `scene.ts`, so how far a tree may lean is
 * something a test can hold.
 *
 * All three trunks in one path and all three crowns in two more, which is this
 * file's existing habit (see `drawGround`'s paving and `drawOven`'s courses): a
 * stroke per tree is draw calls forty times a second to no visible effect.
 */

function drawPark(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const base = scene.ground;
  const crownY = base - TREE_HEIGHT + TREE_CROWN_RADIUS;
  const leans = scene.layout.treeXs.map((x, i) => x + treeSway(scene, i));

  ctx.save();
  ctx.strokeStyle = p.wood;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  scene.layout.treeXs.forEach((x, i) => {
    // Curving with the crown it carries, rather than standing straight while the
    // top of the tree moves without it.
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + (leans[i] - x) * 0.3, base - TREE_HEIGHT * 0.4, leans[i], crownY);
  });
  ctx.stroke();
  ctx.restore();

  // Crowns: three overlapping blobs each, so they read as leaves not lollipops.
  ctx.fillStyle = p.foliageDark;
  ctx.beginPath();
  for (const lean of leans) {
    ctx.moveTo(lean - 11, crownY + 6);
    ctx.arc(lean - 11, crownY + 6, TREE_CROWN_RADIUS * 0.72, 0, Math.PI * 2);
    ctx.moveTo(lean + 12, crownY + 4);
    ctx.arc(lean + 12, crownY + 4, TREE_CROWN_RADIUS * 0.68, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = p.foliage;
  ctx.beginPath();
  for (const lean of leans) {
    ctx.moveTo(lean, crownY - 2);
    ctx.arc(lean, crownY - 2, TREE_CROWN_RADIUS * 0.86, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * The school she lets herself into: one storey, a pitched roof, a lit window and
 * a door that swings while she is going through it.
 *
 * The light and the door both come from her own phase in `scene.ts`, so a lit
 * window with nobody in it is not a state this can get into.
 */
function drawSchool(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const x = scene.layout.schoolX;
  const base = scene.ground;
  const half = SCHOOL_WIDTH / 2;
  const eaves = base - SCHOOL_WALL_HEIGHT;

  ctx.fillStyle = p.beige;
  ctx.fillRect(x - half, eaves, SCHOOL_WIDTH, SCHOOL_WALL_HEIGHT);

  // Roof, overhanging the walls a little the way a real one does
  ctx.fillStyle = p.schoolRoof;
  ctx.beginPath();
  ctx.moveTo(x - half - 7, eaves);
  ctx.lineTo(x, eaves - SCHOOL_ROOF_HEIGHT);
  ctx.lineTo(x + half + 7, eaves);
  ctx.closePath();
  ctx.fill();

  // A chimney on the slope, with its foot cut to the pitch. Drawn square it had
  // one corner buried in the roof and the other hanging over thin air, because
  // the roof falls away underneath it.
  const stack = schoolChimney(scene);
  ctx.fillStyle = p.stone;
  ctx.beginPath();
  ctx.moveTo(stack.left, stack.top);
  ctx.lineTo(stack.right, stack.top);
  ctx.lineTo(stack.right, schoolRoofY(scene, stack.right));
  ctx.lineTo(stack.left, schoolRoofY(scene, stack.left));
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(
    stack.left - 2,
    stack.top - SCHOOL_CHIMNEY_CAP,
    SCHOOL_CHIMNEY_WIDTH + 4,
    SCHOOL_CHIMNEY_CAP,
  );

  // And a sign, because a small building with a pitched roof and two windows is
  // a house until it is labelled.
  ctx.fillRect(x - half + 6, eaves + 3, SCHOOL_WIDTH - 12, 11);
  ctx.fillStyle = p.beige;
  ctx.fillRect(x - half + 7, eaves + 4, SCHOOL_WIDTH - 14, 9);

  ctx.save();
  ctx.fillStyle = p.ink;
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCHOOL', x, eaves + 9);
  ctx.restore();

  // Both windows in one path per style, as the trunks and the paving are
  const windowY = eaves + WINDOW_BELOW_EAVES;
  ctx.fillStyle = schoolLit(scene) ? p.windowLit : p.glass;
  ctx.strokeStyle = p.stone;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const wx of [x - 27, x + 27]) {
    ctx.rect(wx - WINDOW_WIDTH / 2, windowY, WINDOW_WIDTH, WINDOW_HEIGHT);
  }
  ctx.fill();
  ctx.stroke();

  // Her at the near window, and actually her: the same body `drawGirl` puts on
  // the terrace, in one colour and clipped to the frame. Gated on the phase that
  // lit the window, so the light and the shadow cannot disagree.
  if (schoolLit(scene)) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 27 - WINDOW_WIDTH / 2, windowY, WINDOW_WIDTH, WINDOW_HEIGHT);
    ctx.clip();

    ctx.globalAlpha = 0.42;
    // Facing into the room, the way she came in — not mirrored, which turned her
    // to face out through the wall. Standing still, so no stride, and set back
    // far enough that the frame cuts her at the chest rather than the chin:
    // closer in, her hair alone filled the pane and she read as a blot.
    ctx.translate(x - 27, windowY + SHADOW_HEAD_BELOW_TOP + GIRL_HEIGHT * SHADOW_SCALE);
    ctx.scale(SHADOW_SCALE, SHADOW_SCALE);
    girlBody(ctx, p, 0, p.ink);
    ctx.restore();
  }

  // Doorway, then the door itself swung back into it by however far it is open
  const doorTop = base - SCHOOL_DOOR_HEIGHT;
  ctx.fillStyle = p.stoneDark;
  ctx.fillRect(
    scene.layout.doorX - SCHOOL_DOOR_WIDTH / 2,
    doorTop,
    SCHOOL_DOOR_WIDTH,
    SCHOOL_DOOR_HEIGHT,
  );
  ctx.fillStyle = p.wood;
  ctx.fillRect(
    scene.layout.doorX - SCHOOL_DOOR_WIDTH / 2,
    doorTop,
    SCHOOL_DOOR_WIDTH * (1 - doorOpen(scene)),
    SCHOOL_DOOR_HEIGHT,
  );
}

/** Where the traced wells put the wheels, and how big they are inside them. */
// Off the outline's own contact patches, derived in `scene.ts` where a test can
// hold it to two: a re-traced car that moved a well would otherwise leave the
// tyre drawn beside the notch cut for it, and this file is exempt from the
// testing rule, so nothing here would catch it.
const CAR_WHEEL_AT = WHEEL_RUN;
const CAR_WHEEL_R = 0.085;

function drawCar(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette, car: Car) {
  const base = scene.ground;
  // Drawn nose-left in its own coordinates, and mirrored to drive the other way
  // — the same way the girl and the bird are turned round.
  ctx.save();
  ctx.translate(car.x, 0);
  if (car.dir === 1) ctx.scale(-1, 1);
  const half = CAR_WIDTH / 2;
  const px = (f: number) => -half + f * CAR_WIDTH;
  const py = (f: number) => base - f * CAR_ROOF_HEIGHT;

  // High in the wing and set into the bonnet's own slope — a lamp placed by the
  // old body's numbers sat off the front of this one, in the air.
  const LAMP_X = px(0.105);
  const LAMP_Y = py(0.5);
  const wheelR = CAR_WIDTH * CAR_WHEEL_R;
  const wheelY = base - wheelR;
  const wheels = CAR_WHEEL_AT.map(px);

  // The body, straight off the traced outline. The wells in it are the real
  // car's, so the wheels sit in them rather than under hoops drawn over them.
  ctx.fillStyle = p.beige;
  ctx.beginPath();
  CAR_OUTLINE.forEach(([fx, fy], at) => {
    if (at === 0) ctx.moveTo(px(fx), py(fy));
    else ctx.lineTo(px(fx), py(fy));
  });
  ctx.closePath();
  ctx.fill();

  // Glass: a long door window and a small quarter light behind the pillar, both
  // on one belt line the length of the car — and both cut to sit *inside* the
  // traced roof. The forward pane is screen *and* door in one: cut to the door
  // alone it stopped short of the A-pillar, and the whole raked windscreen —
  // a third of the car — was left blank bodywork with the bonnet.
  /** The door glass, which she is also seen through. One shape, not two. */
  const doorWindow = () => {
    ctx.moveTo(px(0.245), py(0.655));
    ctx.lineTo(px(0.425), py(0.895));
    ctx.lineTo(px(0.63), py(0.95));
    ctx.lineTo(px(0.63), py(0.655));
    ctx.closePath();
  };

  ctx.fillStyle = p.glass;
  ctx.beginPath();
  doorWindow();
  ctx.moveTo(px(0.665), py(0.655));
  ctx.lineTo(px(0.665), py(0.945));
  ctx.quadraticCurveTo(px(0.775), py(0.9), px(0.805), py(0.655));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.chrome;
  // Door handle, high on the door the way a 500's is, and the rubbing strip
  // along the belt line.
  ctx.fillRect(px(0.55), py(0.63) - 1, 5.5, 1.5);
  ctx.fillRect(px(0.08), py(0.31), CAR_WIDTH * 0.84, 1.2);

  // Her at the wheel, seen through the door window, and only while it is
  // actually going somewhere: a head in a parked car is a person sitting in a
  // car park.
  if (atTheWheel(scene)) {
    ctx.save();
    // Clipped to the door glass, so she is a person in a car rather than a
    // person drawn over one — the same outline that glass is drawn from, since a
    // second copy of it had already drifted from the first.
    ctx.beginPath();
    doorWindow();
    ctx.clip();
    // Her, at the size the window allows, sat down: the same body the school
    // window takes its shadow from, so there is one of her in this file. Placed
    // mid-door — against the old glass's numbers she sat in the A-pillar corner,
    // which the clip turned into a dark wedge at the base of the screen.
    ctx.translate(px(0.47), py(0.58) + GIRL_HEIGHT * DRIVER_SCALE * 0.42);
    ctx.scale(-DRIVER_SCALE, DRIVER_SCALE);
    girlBody(ctx, p, 0);
    ctx.restore();
  }

  // Wheels: a thin black sidewall around a wide alloy. One pass per colour over
  // both of them — and no spokes: at a wheel radius of six pixels they were
  // sub-pixel lines nobody could resolve, checked at 1:1 on screen.
  /** Both wheels in one pass, at whatever radius this layer of them wants. */
  const discs = (radius: number) => {
    ctx.beginPath();
    for (const wx of wheels) {
      ctx.moveTo(wx + radius, wheelY);
      ctx.arc(wx, wheelY, radius, 0, Math.PI * 2);
    }
  };

  ctx.fillStyle = p.ink;
  discs(wheelR);
  ctx.fill();

  ctx.fillStyle = p.chrome;
  discs(wheelR * 0.52);
  // The headlamp shares this pass: large, round, high in the wing.
  ctx.moveTo(LAMP_X + 2.2, LAMP_Y);
  ctx.arc(LAMP_X, LAMP_Y, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.beigeShade;
  discs(wheelR * 0.2);
  ctx.fill();

  ctx.fillStyle = p.glass;
  ctx.beginPath();
  ctx.arc(LAMP_X, LAMP_Y, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
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
  // Two columns, two loops: joining them with a spread built a fresh array of
  // every puff in the scene on every frame of the loop.
  for (const column of [scene.oven.smoke, scene.schoolSmoke]) {
    for (const puff of column) {
      ctx.globalAlpha = Math.min(1, puff.life / puff.maxLife);
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
      ctx.fill();
    }
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

  // The peel: level while he waits, swung up and over as he tosses. Both the
  // swing and the angle come from the scene, because the throw is computed from
  // the same numbers — a second copy here is what let the pizza leave from
  // somewhere the paddle had never been.
  const angle = peelAngle(peelSwing(scene));
  // He is still carrying it right up to the moment he lets go, and the scene is
  // asked rather than told: the throw turns on the same answer.
  const carrying = carryingPizza(scene);

  // Arms, holding the peel a little way along the handle so they swing with it.
  const hand = {
    x: PEEL_PIVOT.x + Math.cos(angle) * PEEL_GRIP,
    y: PEEL_PIVOT.y + Math.sin(angle) * PEEL_GRIP,
  };
  ctx.strokeStyle = p.skin;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, -48);
  ctx.lineTo(hand.x, hand.y);
  ctx.moveTo(7, -48);
  ctx.lineTo(hand.x + Math.cos(angle) * 9, hand.y + Math.sin(angle) * 9);
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.save();
  ctx.translate(PEEL_PIVOT.x, PEEL_PIVOT.y);
  ctx.rotate(angle);
  ctx.strokeStyle = p.crust;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(PEEL_BLADE_ALONG, 0);
  ctx.stroke();
  ctx.fillStyle = p.stone;
  ctx.fillRect(PEEL_BLADE_ALONG, -PEEL_BLADE_DEPTH / 2, PEEL_BLADE_DEPTH, PEEL_BLADE_DEPTH);
  // The pizza rides the paddle right up to the moment it leaves.
  if (carrying) {
    ctx.save();
    ctx.translate(PEEL_CARRY_ALONG, PEEL_CARRY_ABOVE);
    ctx.rotate(-angle);
    drawPizzaFace(ctx, 12, p);
    ctx.restore();
  }
  ctx.restore();

  ctx.restore();
}

/**
 * The girl herself, from her feet at the origin, facing right.
 *
 * Split out so the shadow at the school window can be *her* rather than a head
 * and a pair of shoulders that happen to be about the right size. `flat` paints
 * every part in one colour, which is the only difference between her and her
 * silhouette.
 */
function girlBody(ctx: CanvasRenderingContext2D, p: Palette, swing: number, flat?: string) {
  const skin = flat ?? p.skin;
  const dress = flat ?? p.dress;
  const hair = flat ?? p.hair;

  // Legs, stepping with the distance covered
  ctx.strokeStyle = skin;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(swing * 0.6, 0);
  ctx.moveTo(0, -26);
  ctx.lineTo(-swing * 0.6, 0);
  ctx.stroke();

  // Dress
  ctx.fillStyle = dress;
  ctx.beginPath();
  ctx.moveTo(-11, -26);
  ctx.lineTo(11, -26);
  ctx.lineTo(7, -GIRL_HEIGHT + 16);
  ctx.lineTo(-7, -GIRL_HEIGHT + 16);
  ctx.closePath();
  ctx.fill();

  // Arm
  ctx.strokeStyle = skin;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(4, -GIRL_HEIGHT + 22);
  ctx.lineTo(4 + swing * 0.4, -34);
  ctx.stroke();

  // Long dark hair behind the head, then the head over it
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(-2, -GIRL_HEIGHT + 22, 10, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(1, -GIRL_HEIGHT + 8, 8.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(1, -GIRL_HEIGHT + 8, 8.5, Math.PI * 1.05, Math.PI * 2.1);
  ctx.fill();
}

function drawGirl(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const { girl, ground } = scene;

  ctx.save();
  ctx.translate(girl.x, ground);
  // Turned by `facing`, not by `dir`: `dir` snaps and `facing` eases, and the
  // shoulder the bird sits on follows `facing`. Drawn off `dir` she is already
  // round while his perch is still crossing her, so he rides on the front of her
  // for the half-second the turn takes.
  if (girl.facing < 0) ctx.scale(-1, 1);
  girlBody(ctx, p, Math.sin(girl.step * 0.16) * 8);
  ctx.restore();
}

function drawBird(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const { bird } = scene;
  const full = bird.phase === 'full';
  // Wings folded whenever he is sitting on something, in the air or not.
  const settled = birdAtRest(scene);
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

  // Wing — folded while he is sitting, beating while he is not
  ctx.fillStyle = p.birdDark;
  ctx.save();
  ctx.translate(-1, -2);
  ctx.rotate(settled ? 0.15 : Math.sin(bird.flap) * 0.85);
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
  if (settled) {
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
    // A kiss is a deliberate thing somebody did, so it is drawn bigger than the
    // ones he lets go of by himself.
    const size = heart.kind === 'ring' ? 5 : heart.kind === 'kiss' ? 7 : 4;
    heartPath(ctx, heart.x, heart.y, size);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  isDark: boolean,
  scale: number,
) {
  const p: Palette = isDark ? DARK : LIGHT;
  // Everything below is drawn in the scene's own units; this is the one place
  // the window's size enters. A narrow window gets a wider stage with smaller
  // scenery on it, rather than the same scenery crammed against itself.
  ctx.save();
  ctx.scale(scale, scale);
  drawGround(ctx, scene, p);
  // The left of the scene first, and all of it behind the people: she walks in
  // front of the car and the school rather than round them.
  drawSquirrels(ctx, scene, p, true, true);
  drawPark(ctx, scene, p);
  drawSquirrels(ctx, scene, p, false, true);
  drawSchool(ctx, scene, p);
  if (scene.car) drawCar(ctx, scene, p, scene.car);
  drawHomeCorner(ctx, scene, p);
  drawOven(ctx, scene, p);
  drawSmoke(ctx, scene, p);
  drawPizzaiolo(ctx, scene, p);
  if (girlOnFoot(scene)) drawGirl(ctx, scene, p);
  drawBird(ctx, scene, p);
  if (scene.pizza) drawPizza(ctx, scene.pizza, p);
  drawHearts(ctx, scene, p);
  ctx.restore();
}
