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
  girlOut,
  schoolLit,
  treeSway,
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
  // Trunks and the school door, which were two names for one brown.
  wood: '#7a563a',
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
  const windowY = eaves + 20;
  ctx.fillStyle = schoolLit(scene) ? p.windowLit : p.glass;
  ctx.strokeStyle = p.stone;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const wx of [x - 27, x + 27]) ctx.rect(wx - 11, windowY, 22, 20);
  ctx.fill();
  ctx.stroke();

  // Her at the near window, and actually her: the same body `drawGirl` puts on
  // the terrace, in one colour and clipped to the frame. Gated on the phase that
  // lit the window, so the light and the shadow cannot disagree.
  if (schoolLit(scene)) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 38, windowY, 22, 20);
    ctx.clip();

    ctx.globalAlpha = 0.42;
    // Facing into the room, the way she came in — not mirrored, which turned her
    // to face out through the wall. Standing still, so no stride, and set back
    // far enough that the frame cuts her at the chest rather than the chin:
    // closer in, her hair alone filled the pane and she read as a blot.
    ctx.translate(x - 27, windowY + 20 + GIRL_HEIGHT * SHADOW_SCALE - 17);
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

/**
 * The car, in fractions of its own length and height, nose at the left. Drawn
 * before the girl, so she walks in front of it rather than round it.
 *
 * Measured off a side elevation rather than shaped by hand, because by hand it
 * came out a Beetle, then a coupe, then an egg. Three things decide whether it
 * reads as a 500: the wheels are nearly a quarter of the length and sit right at
 * the corners, the roof is a single gentle arc peaking at the middle, and the
 * tail is *round* — a steep straight hatch is a Panda. Curves where it curves
 * and straight where it is straight: running the whole outline through a
 * smoother is what produced the egg.
 */
function drawCar(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette, x: number) {
  const base = scene.ground;
  const half = CAR_WIDTH / 2;
  const px = (f: number) => x - half + f * CAR_WIDTH;
  const py = (f: number) => base - f * CAR_ROOF_HEIGHT;

  // A touch under the elevation's 0.111: at this size the measured figure
  // read as too big for the body.
  const wheelR = CAR_WIDTH * 0.1;
  const wheelY = base - wheelR;
  const wheels = [px(0.188), px(0.857)];

  ctx.fillStyle = p.beige;
  ctx.beginPath();
  ctx.moveTo(px(0.03), py(0.14));
  ctx.quadraticCurveTo(px(0.0), py(0.3), px(0.027), py(0.457));
  ctx.quadraticCurveTo(px(0.05), py(0.53), px(0.1), py(0.555));
  ctx.lineTo(px(0.2), py(0.59));
  // Windscreen: one straight rake, and a long one
  ctx.lineTo(px(0.384), py(0.913));
  ctx.quadraticCurveTo(px(0.43), py(0.965), px(0.509), py(0.97));
  // Roof: a single gentle arc over the middle of the car
  ctx.quadraticCurveTo(px(0.63), py(0.968), px(0.723), py(0.935));
  // and a round tail, not a hatch
  ctx.quadraticCurveTo(px(0.82), py(0.875), px(0.866), py(0.739));
  ctx.quadraticCurveTo(px(0.945), py(0.62), px(0.955), py(0.5));
  ctx.quadraticCurveTo(px(1.0), py(0.32), px(0.975), py(0.16));
  ctx.closePath();
  ctx.fill();

  // Arches: big circular cutouts, which is half of the car's stance
  ctx.strokeStyle = p.beigeShade;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const wx of wheels) {
    ctx.moveTo(wx - wheelR - 2.2, wheelY);
    ctx.arc(wx, wheelY, wheelR + 2.2, Math.PI, Math.PI * 2);
  }
  ctx.stroke();

  // Glass: a long door window, then a small quarter light behind the pillar
  ctx.fillStyle = p.glass;
  ctx.beginPath();
  ctx.moveTo(px(0.26), py(0.6));
  ctx.lineTo(px(0.4), py(0.875));
  ctx.lineTo(px(0.565), py(0.885));
  ctx.lineTo(px(0.565), py(0.6));
  ctx.closePath();
  ctx.moveTo(px(0.605), py(0.885));
  ctx.lineTo(px(0.715), py(0.862));
  ctx.quadraticCurveTo(px(0.785), py(0.76), px(0.745), py(0.6));
  ctx.lineTo(px(0.605), py(0.6));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = p.chrome;
  // Door handle, high on the door the way a 500's is, and the rubbing strip
  ctx.fillRect(px(0.47), py(0.586) - 1, 6, 1.5);
  ctx.fillRect(px(0.1), base - 10, CAR_WIDTH * 0.8, 1.3);

  // Wheels: a thin black sidewall around a wide alloy. One pass per colour over
  // both of them — and no spokes: at a wheel radius of eight pixels they were
  // 2px lines nobody could resolve, checked at 1:1 on screen.
  ctx.fillStyle = p.ink;
  ctx.beginPath();
  for (const wx of wheels) {
    ctx.moveTo(wx + wheelR, wheelY);
    ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = p.chrome;
  ctx.beginPath();
  for (const wx of wheels) {
    ctx.moveTo(wx + wheelR * 0.72, wheelY);
    ctx.arc(wx, wheelY, wheelR * 0.72, 0, Math.PI * 2);
  }
  // The headlamp shares this pass: large, round, high in the wing.
  ctx.moveTo(px(0.085) + 2.6, py(0.56));
  ctx.arc(px(0.085), py(0.56), 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.beigeShade;
  ctx.beginPath();
  for (const wx of wheels) {
    ctx.moveTo(wx + wheelR * 0.24, wheelY);
    ctx.arc(wx, wheelY, wheelR * 0.24, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = p.glass;
  ctx.beginPath();
  ctx.arc(px(0.085), py(0.56), 1.5, 0, Math.PI * 2);
  ctx.fill();
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
  for (const puff of [...scene.oven.smoke, ...scene.schoolSmoke]) {
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
  if (girl.dir === -1) ctx.scale(-1, 1);
  girlBody(ctx, p, Math.sin(girl.step * 0.16) * 8);
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
  // The left of the scene first, and all of it behind the people: she walks in
  // front of the car and the school rather than round them.
  drawPark(ctx, scene, p);
  drawSchool(ctx, scene, p);
  if (scene.layout.carX !== null) drawCar(ctx, scene, p, scene.layout.carX);
  drawOven(ctx, scene, p);
  drawSmoke(ctx, scene, p);
  drawPizzaiolo(ctx, scene, p);
  if (girlOut(scene)) drawGirl(ctx, scene, p);
  drawBird(ctx, scene, p);
  if (scene.pizza) drawPizza(ctx, scene.pizza, p);
  drawHearts(ctx, scene, p);
}
