/**
 * The changes that must not go unnoticed.
 *
 * Each entry breaks something on purpose. The suite is expected to go red for
 * every one of them; a mutation that survives is a test that cannot fail, which
 * on this app is how a wrong number reaches the sheet with everything green.
 *
 * This is a curated list rather than every mutation a tool could generate. What
 * belongs here is what CLAUDE.md already calls load-bearing: the settlement
 * signs and coefficients, the guards that decide whether work is skipped, and
 * the constants other constants are derived from. Adding one costs two lines
 * and buys a permanent answer to "would we notice?".
 *
 * `tests` narrows what has to run, purely for speed. Leave it off to run
 * everything.
 */
export const MUTATIONS = [
  // --- The money. A wrong sign here moves real money silently, and there is no
  // backend and no audit trail behind the sheet to catch it later.
  {
    name: 'a transfer widens the gap instead of closing it',
    file: 'src/services/utils.ts',
    find: '+ 2 * (transferA - transferB)',
    replace: '- 2 * (transferA - transferB)',
    tests: ['src/services/utils.test.ts'],
  },
  {
    name: 'forgiveness closes the gap instead of opening it',
    file: 'src/services/utils.ts',
    find: '- 2 * (forgivenA - forgivenB)',
    replace: '+ 2 * (forgivenA - forgivenB)',
    tests: ['src/services/utils.test.ts'],
  },
  {
    name: 'a transfer moves one side rather than both',
    file: 'src/services/utils.ts',
    find: '+ 2 * (transferA - transferB)',
    replace: '+ (transferA - transferB)',
    tests: ['src/services/utils.test.ts'],
  },
  {
    name: 'forgiveness moves one side rather than both',
    file: 'src/services/utils.ts',
    find: '- 2 * (forgivenA - forgivenB)',
    replace: '- (forgivenA - forgivenB)',
    tests: ['src/services/utils.test.ts'],
  },
  {
    name: 'the gap is reported as the debt, doubling every settlement',
    file: 'src/services/utils.ts',
    find: 'const owedToA = gapA / 2;',
    replace: 'const owedToA = gapA;',
    tests: ['src/services/utils.test.ts'],
  },
  {
    name: 'spending for one person alone still counts as shared',
    file: 'src/services/utils.ts',
    find: 'const sharedA = totalA - notCountedA;',
    replace: 'const sharedA = totalA;',
    tests: ['src/services/utils.test.ts'],
  },
  {
    name: 'a present moves the balance',
    file: 'src/services/utils.ts',
    find: '      presentA += d;\n      presentB += m;',
    replace:
      '      presentA += d;\n      presentB += m;\n      forgivenA += d;\n      forgivenB += m;',
    tests: ['src/services/utils.test.ts'],
  },
  {
    name: 'not counted is taken at face value, above the amount it slices',
    file: 'src/services/utils.ts',
    find: 'Math.max(0, Math.min(toNumber(notCounted), toNumber(amount)));',
    replace: 'toNumber(notCounted);',
    tests: ['src/services/utils.test.ts'],
  },
  {
    name: 'a negative not-counted is accepted by the form',
    file: 'src/services/utils.ts',
    find: 'if (aside < 0) return `Not counted cannot be negative`;',
    replace: '',
    tests: ['src/services/utils.test.ts'],
  },

  // --- Writing to the sheet. The ranges are asymmetric on purpose: a PUT
  // rewrites its whole range, so one that covers G and H erases the recurring
  // marker and the added date.
  {
    name: 'an edit rewrites the columns the app maintains, erasing the marker',
    file: 'src/services/sheets.ts',
    find: '{ range: `${sheetName}!A${rowIndex}:F${rowIndex}`, values: [entered] },',
    replace: '{ range: `${sheetName}!A${rowIndex}:J${rowIndex}`, values: [entered] },',
    tests: ['src/services/sheets.test.ts'],
  },

  {
    name: 'a blocked download leaves its link in the page',
    file: 'src/services/backup.ts',
    find: '    link.remove();\n    setTimeout(() => URL.revokeObjectURL(url), 0);',
    replace: '    setTimeout(() => URL.revokeObjectURL(url), 0);',
    tests: ['src/services/backup.test.ts'],
  },

  // --- Recurring. A generated expense is a snapshot; nothing may read a marker
  // and write back into the row it names.
  {
    name: 'catching up has no bound, so a fresh install writes every month ever',
    file: 'src/services/recurring.ts',
    find: 'export const MAX_CATCH_UP_OCCURRENCES = 24;',
    replace: 'export const MAX_CATCH_UP_OCCURRENCES = 100000;',
    tests: ['src/services/recurring.test.ts'],
  },
  {
    name: 'a month falls due a day late, so today never counts',
    file: 'src/services/recurring.ts',
    find: 'if (date > todayIso) break;',
    replace: 'if (date >= todayIso) break;',
    tests: ['src/services/recurring.test.ts'],
  },

  {
    name: 'a month the user deleted is written again',
    file: 'src/services/recurring.ts',
    find: 'const resumeFrom = last ? monthIndex(last) + 1 : anchor;',
    replace: 'const resumeFrom = anchor;',
    tests: ['src/services/recurring.test.ts'],
  },

  // --- How big the window is. Three shipped bugs came from one of these being
  // read in two different ways; the lint rule stops new ones, these say the
  // readings themselves still matter.
  {
    name: 'the canvas is sized in CSS pixels again',
    file: 'src/theme/chrome.ts',
    find: '  canvas.width = Math.round(width * ratio);',
    replace: '  canvas.width = Math.round(width);',
    tests: ['src/theme/chrome.test.ts'],
  },
  {
    name: 'the viewport height comes from the layout viewport',
    file: 'src/theme/chrome.ts',
    find: '    height: window.innerHeight,',
    replace: '    height: document.documentElement.clientHeight || window.innerHeight,',
    tests: ['src/theme/sceneCanvas.test.tsx'],
  },
  {
    name: 'the pixel ratio follows the device with no cap',
    file: 'src/theme/chrome.ts',
    find: 'Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)',
    replace: 'window.devicePixelRatio || 1',
    tests: ['src/theme/chrome.test.ts'],
  },
  {
    name: 'the ratio watch refuses a query that does not match itself',
    file: 'src/theme/chrome.ts',
    find: "    query = typeof next?.addEventListener === 'function' ? next : null;",
    replace:
      "    query = typeof next?.addEventListener === 'function' && next.matches ? next : null;",
    tests: ['src/theme/chrome.test.ts'],
  },

  // --- The scene. Scenery, but the band it stands in is reserved over the
  // user's own list, and a jerk is the difference between an animal and a lift.
  {
    name: 'squirrels leave the stand they were born in',
    file: 'src/theme/cello/scene.ts',
    find: '    if (at !== tree && inPark(scene, at) === stand) near.push(at);',
    replace: '    if (at !== tree) near.push(at);',
    tests: ['src/theme/cello/scene.test.ts'],
  },
  {
    name: 'a crossing drops its height on the arrival frame',
    file: 'src/theme/cello/scene.ts',
    find: '        squirrel.side += turn;',
    replace: '',
    tests: ['src/theme/cello/scene.test.ts'],
  },
  {
    name: 'the kiss is turned round the trunk rather than towards the front',
    file: 'src/theme/cello/scene.ts',
    find: '  one.side = Math.PI / 2 - tilt - climbed;',
    replace: '  one.side = Math.PI / 2 + tilt - climbed;',
    tests: ['src/theme/cello/scene.test.ts'],
  },
  // Not "read `PERCH_HEIGHT.tree` instead of the maximum": with today's heights
  // the park tree *is* the maximum, so that mutation changes no behaviour at
  // all and would sit here for ever as an unkillable survivor. What is worth
  // asking is whether the band still follows a banana that outgrows the park —
  // the case the derivation exists for and the one nothing covered before.
  {
    name: 'a colony is seeded as a copy of an earlier one',
    file: 'src/theme/cello/scene.ts',
    find: '        side: inPair * SQUIRREL_SIDE + (at * SQUIRREL_SIDE) / colonies.length,',
    replace: '        side: (at * 2 + inPair) * SQUIRREL_SIDE,',
    tests: ['src/theme/cello/scene.test.ts'],
  },
  {
    name: 'a pair is seeded across two stands, so it can never meet',
    file: 'src/theme/cello/scene.ts',
    find: '      const tree = stand.from + (inPair % stand.count);',
    replace: '      const tree = inPair % (layout.treeXs.length + layout.bananaXs.length);',
    tests: ['src/theme/cello/scene.test.ts'],
  },
  {
    name: 'the kiss tilt comes off the stand rather than the colony',
    file: 'src/theme/cello/scene.ts',
    find: '  const tilt = one.colony * KISS_TILT;',
    replace: '  const tilt = inPark(scene, one.tree) ? 0 : KISS_TILT;',
    tests: ['src/theme/cello/scene.test.ts'],
  },
  // Deliberately not here: pairing by adjacency instead of by colony. Seeding
  // emits each colony's two together, so the two orders agree and the mutation
  // changes nothing — an unkillable survivor rather than a finding. The code
  // still groups by colony, because that is what it means and it survives a
  // reordering; the mutation would only ever be noise.
  {
    name: 'a banana grows taller than the park and the band does not follow',
    file: 'src/theme/cello/scene.ts',
    find: 'export const BANANA_TRUNK = 62;',
    replace: 'export const BANANA_TRUNK = 200;',
    tests: ['src/theme/cello/scene.test.ts'],
  },
  // -- how a window becomes a stage (src/theme/stage.ts) ---------------------
  // Every scene reads its band from here, so a wrong number here covers a strip
  // of the user's list in every theme at once, and nothing renders an error.
  {
    name: 'the band is rounded to nearest rather than up',
    file: 'src/theme/stage.ts',
    find: '  return (width) => Math.ceil(GROUND_ABOVE_FOOTER + reach * sceneScale(width));',
    replace: '  return (width) => Math.round(GROUND_ABOVE_FOOTER + reach * sceneScale(width));',
    tests: ['src/theme/stage.test.ts'],
  },
  {
    name: 'a scene is stood straight on the footer, with no clearance',
    file: 'src/theme/stage.ts',
    find: 'export const GROUND_ABOVE_FOOTER = 34;',
    replace: 'export const GROUND_ABOVE_FOOTER = 0;',
    tests: ['src/theme/stage.test.ts', 'src/theme/cello/scene.test.ts'],
  },
  {
    name: 'the footer is assumed rather than measured',
    file: 'src/theme/stage.ts',
    find: '  const ground = seen.height - footerHeight() - GROUND_ABOVE_FOOTER;',
    // The fallback's own value, spelled out: `FOOTER_HEIGHT` is not imported
    // here, and a ReferenceError would be a kill for the wrong reason.
    replace: '  const ground = seen.height - 60 - GROUND_ABOVE_FOOTER;',
    tests: ['src/theme/stage.test.ts'],
  },
  {
    name: 'the resize guard is gone, so every event reallocates the buffer',
    file: 'src/theme/sceneCanvas.ts',
    find: '      if (sameStage && nextRatio === ratio) return;',
    replace: '',
    tests: ['src/theme/sceneCanvas.test.tsx'],
  },
  {
    name: 'the buffer is refitted only for a change of ratio, never a resize',
    file: 'src/theme/sceneCanvas.ts',
    find: '      if (sameStage && nextRatio === ratio) return;',
    replace: '      if (nextRatio === ratio) return;',
    tests: ['src/theme/sceneCanvas.test.tsx'],
  },
  {
    name: 'a resize builds a second scene rather than moving the one there is',
    file: 'src/theme/sceneCanvas.ts',
    find: '      resizeScene(scene, next);',
    replace: '      createScene(next, Math.random);',
    tests: ['src/theme/sceneCanvas.test.tsx'],
  },
  {
    name: 'the screen is followed past twice, at four times the paint',
    file: 'src/theme/chrome.ts',
    find: 'export const MAX_PIXEL_RATIO = 2;',
    replace: 'export const MAX_PIXEL_RATIO = 4;',
    tests: ['src/theme/sceneCanvas.test.tsx'],
  },
  {
    name: 'a click is divided by the device ratio as well as the scene scale',
    file: 'src/theme/sceneCanvas.ts',
    find: '      clickScene?.(scene, event.clientX / size.scale, event.clientY / size.scale);',
    replace:
      '      clickScene?.(scene, event.clientX / (size.scale * ratio), event.clientY / size.scale);',
    tests: ['src/theme/sceneCanvas.test.tsx'],
  },
  {
    name: 'the stage is measured on a resize but never re-held',
    file: 'src/theme/sceneCanvas.ts',
    find: '      size = next;',
    replace: '',
    tests: ['src/theme/sceneCanvas.test.tsx'],
  },
  {
    name: 'the resize guard ignores the ground, so a moved footer is not noticed',
    file: 'src/theme/sceneCanvas.ts',
    find: ' && next.ground === size.ground',
    replace: '',
    tests: ['src/theme/sceneCanvas.test.tsx'],
  },
  // Deliberately not here: the bound on a banana leaf's `across`. Measured over
  // forty plants it never once binds, so removing it changes nothing — an
  // unkillable survivor rather than a finding. `scene.test.ts` pins the property
  // it protects instead.
  // -- Ciccio's room (src/theme/ciccio/scene.ts) -----------------------------
  // The scene draws over the user's own list, and several of these decide how
  // much of it gets covered. The rest are the guards that keep the three of
  // them from teleporting.
  {
    name: 'a squirrel may climb higher than the room is tall',
    file: 'src/theme/ciccio/scene.ts',
    find: 'export const CLIMB_MAX = WALL_HEIGHT - SEAT_HEIGHT.sofa - SQUIRREL_REACH;',
    // Not 48, which is what the expression already comes to — an equivalent
    // mutation is a pass that tests nothing.
    replace: 'export const CLIMB_MAX = 70;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the band is measured off the furniture rather than the room',
    file: 'src/theme/ciccio/scene.ts',
    find: '  WALL_HEIGHT,\n  OVEN_TOP,',
    replace: '  OVEN_TOP,',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a sofa cushion is at floor level, so nobody is lifted onto it',
    file: 'src/theme/ciccio/scene.ts',
    find: '  sofa: SOFA_SEAT,',
    replace: '  sofa: 0,',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the oven puts a second gratin out on top of the first',
    file: 'src/theme/ciccio/scene.ts',
    find: '  if (foodInPlay(scene)) return;\n  scene.baking = { left: BAKE_FRAMES };',
    replace: '  scene.baking = { left: BAKE_FRAMES };',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'he steps over the gratin instead of stopping on it',
    file: 'src/theme/ciccio/scene.ts',
    find: '      ciccio.x = goal.x;',
    replace: '',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'his walk runs to the wall, leaving a squirrel nowhere to stand',
    file: 'src/theme/ciccio/scene.ts',
    find: '  const wanderLeft = EDGE + FLANK_GAP;',
    replace: '  const wanderLeft = EDGE;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'they keep up with him on a dash, so the gap never opens',
    file: 'src/theme/ciccio/scene.ts',
    find: 'export const DASH_FOLLOW_SPEED = 1.7;',
    replace: 'export const DASH_FOLLOW_SPEED = 2.4;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the bed is turned down whether or not anybody is coming',
    file: 'src/theme/ciccio/scene.ts',
    find: '  const target = bedExpectsHim(scene) ? 1 : 0;',
    replace: '  const target = 1;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'an abandoned climb only unwinds while they are not watching',
    file: 'src/theme/ciccio/scene.ts',
    find: '  if (!watching) scene.rescue = null;',
    replace: '  if (!watching) scene.rescue = null;\n  if (watching && !scene.rescue) return;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a climb may start while one of them is still settling onto the sofa',
    file: 'src/theme/ciccio/scene.ts',
    find: '        (squirrel) => squirrel.climb === 0 && (squirrel.lift <= 0 || squirrel.lift >= 1),',
    replace: '        () => true,',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the room answers a tap meant for a squirrel sitting on it',
    file: 'src/theme/ciccio/scene.ts',
    find: "  if (tappedSquirrel((squirrel) => squirrel.climb > 0 || squirrel.at !== 'floor')) return;",
    replace: '  if (tappedSquirrel((squirrel) => squirrel.climb > 0)) return;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: "the cat's interval runs down through his meals rather than counting his free time",
    file: 'src/theme/ciccio/scene.ts',
    find: '    if (!catMayCall(scene) || --scene.catNextIn > 0) return;',
    replace: '    if (--scene.catNextIn > 0 || !catMayCall(scene)) return;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a seat is settled after the wall rather than before it',
    file: 'src/theme/ciccio/scene.ts',
    find: '  settleSquirrelSeats(scene);\n  runOven(scene, rng);\n  runCat(scene, rng);\n  runRescue(scene, rng);',
    replace:
      '  runOven(scene, rng);\n  runCat(scene, rng);\n  runRescue(scene, rng);\n  settleSquirrelSeats(scene);',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the cat lets itself in on the frame a programme starts',
    file: 'src/theme/ciccio/scene.ts',
    find: '  // that had already gone off.\n  !scene.tv.on;',
    replace: '  // that had already gone off.\n  true;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a wall climb happens in front of a set that has gone off',
    file: 'src/theme/ciccio/scene.ts',
    find: "scene.ciccio.phase === 'sitting' && scene.tv.on;",
    replace: "scene.ciccio.phase === 'sitting';",
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the room answers a tap meant for him while he is on the furniture',
    file: 'src/theme/ciccio/scene.ts',
    find: "  if (scene.ciccio.at !== 'floor' && hitsCiccio(scene, x, y)) {",
    replace: '  if (false && hitsCiccio(scene, x, y)) {',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the set stays on after he has stopped watching, so a programme never ends',
    file: 'src/theme/ciccio/scene.ts',
    find: '  if (!watching) switchTvOff(scene);',
    replace: '',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: "the cat's interval is the rota's own period, so the two run in lockstep",
    file: 'src/theme/ciccio/scene.ts',
    find: 'const CAT_INTERVAL = 1700;',
    replace: 'const CAT_INTERVAL = 1500;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'an interrupt keeps the errand it interrupts when he is already dancing',
    file: 'src/theme/ciccio/scene.ts',
    find: "  ciccio.goal = null;\n  if (ciccio.phase === 'wobbling') return;",
    replace: "  if (ciccio.phase === 'wobbling') return;\n  ciccio.goal = null;",
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a tap on the cooker drops a finished gratin on the floor',
    file: 'src/theme/ciccio/scene.ts',
    find: '  scene.baking = { left: BAKE_FRAMES };',
    replace: '  scene.gratin = { x: gratinSpot(scene), bites: GRATIN_BITES, steam: [] };',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'he waits for the gratin to be out rather than following the scent',
    file: 'src/theme/ciccio/scene.ts',
    find: '      return scene.gratin?.x ?? (scene.baking ? gratinSpot(scene) : undefined);',
    replace: '      return scene.gratin?.x;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the scent drifts the same way whichever side of the oven he is on',
    file: 'src/theme/ciccio/scene.ts',
    find: '    const towards = scene.ciccio.x >= scene.layout.ovenX ? 1 : -1;',
    replace: '    const towards = 1;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'food walks him off the sofa instead of bringing the programme to its end',
    file: 'src/theme/ciccio/scene.ts',
    find: '    if (!scene.tv.on && (ciccio.timer <= 0 || foodInPlay(scene))) {',
    replace: '    if (foodInPlay(scene) || (!scene.tv.on && ciccio.timer <= 0)) {',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the closing zebra plays whether or not anybody is on the sofa',
    file: 'src/theme/ciccio/scene.ts',
    find: '  if (ending && !allWatching(scene)) return;',
    replace: '',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a bake does not bring the programme forward to its ending',
    file: 'src/theme/ciccio/scene.ts',
    find: '  if (foodInPlay(scene) && scene.tv.on && scene.tv.showLeft > ZEBRA_FRAMES) {',
    replace: '  if (false) {',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the clumsy one is rolled each time rather than being the same squirrel',
    file: 'src/theme/ciccio/scene.ts',
    find: "      scene.rescue = { climber: THE_CLUMSY_ONE, phase: 'climbing', timer: 0 };",
    replace: "      scene.rescue = { climber: rng() < 0.5 ? 0 : 1, phase: 'climbing', timer: 0 };",
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'they stay frozen until the cat is off the screen, not when it turns to go',
    file: 'src/theme/ciccio/scene.ts',
    find: "  if (scene.ciccio.phase === 'bristling') scene.ciccio.phase = 'wandering';",
    replace: '',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the squirrels lie awake in the bed he is asleep in',
    file: 'src/theme/ciccio/scene.ts',
    find: "  scene.ciccio.phase === 'sleeping' && settledOn(squirrel, 'bed');",
    replace: '  false;',
    tests: ['src/theme/ciccio/draw.test.ts', 'src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the rota and the cat ignore a gratin that is still in the oven',
    file: 'src/theme/ciccio/scene.ts',
    find: 'export const foodInPlay = (scene: Scene) => scene.gratin !== null || scene.baking !== null;',
    replace: 'export const foodInPlay = (scene: Scene) => scene.gratin !== null;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the rota turns the set on and leaves the errand to nobody',
    file: 'src/theme/ciccio/scene.ts',
    find: "    summon(scene, 'sit', false);\n  } else {",
    replace: '  } else {',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a dance counts as having stopped watching, so a tap cancels the programme',
    file: 'src/theme/ciccio/scene.ts',
    find: "    (ciccio.phase === 'wobbling' && !waitingForTheOven(scene));",
    replace: '    false;',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a tap on the cooker is inert while a programme is on',
    file: 'src/theme/ciccio/scene.ts',
    find: '    if (scene.tv.on) bringProgrammeForward(scene);',
    replace: '    if (false) bringProgrammeForward(scene);',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'a resize leaves him dancing at the oven that used to be there',
    file: 'src/theme/ciccio/scene.ts',
    find: '  if (waitingForTheOven(scene)) {',
    replace: '  if (false) {',
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
  {
    name: 'the set stays lit while he climbs off the sofa, un-playing the zebra',
    file: 'src/theme/ciccio/scene.ts',
    find: "    (ciccio.at === 'sofa' && ciccio.phase !== 'dismounting') ||",
    replace: "    ciccio.at === 'sofa' ||",
    tests: ['src/theme/ciccio/scene.test.ts'],
  },
];
