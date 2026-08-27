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
    tests: ['src/theme/cello/CelloBackground.test.tsx'],
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
    name: 'a banana grows taller than the park and the band does not follow',
    file: 'src/theme/cello/scene.ts',
    find: 'export const BANANA_TRUNK = 62;',
    replace: 'export const BANANA_TRUNK = 200;',
    tests: ['src/theme/cello/scene.test.ts'],
  },
];
