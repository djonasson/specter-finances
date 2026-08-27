/**
 * Break each load-bearing thing on purpose, and check the suite notices.
 *
 * A green suite says the tests pass. It does not say they would fail if the
 * code were wrong, and on this app that is the question that matters: the sheet
 * is the only record of who owes whom, and a moved sign is silent. Everything
 * in `mutations.mjs` is expected to turn the suite red. One that does not is
 * reported as a survivor — a test that cannot fail.
 *
 * Two rules it holds to, both learned the hard way:
 *
 * - It refuses to start on a dirty tree. It edits files in place and puts them
 *   back, so anything uncommitted would be at the mercy of a crash.
 * - A mutation whose text is not found, or found more than once, is an error
 *   rather than a pass. A find-and-replace that quietly matches nothing tests
 *   nothing, and reports success while doing it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { MUTATIONS } from './mutations.mjs';

const only = process.argv[2];
const chosen = only
  ? MUTATIONS.filter((m) => m.name.includes(only) || m.file.includes(only))
  : MUTATIONS;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

if (git('status', '--porcelain').trim()) {
  console.error('The working tree has changes. Commit or stash them first —');
  console.error('this edits files in place and would put a crash between you and them.');
  process.exit(2);
}

if (chosen.length === 0) {
  console.error(only ? `No mutation matches "${only}".` : 'No mutations defined.');
  process.exit(2);
}

/** Runs the suite and says only whether it went red. */
function suiteFails(tests) {
  try {
    execFileSync('npx', ['vitest', 'run', ...(tests ?? [])], { stdio: 'pipe' });
    return false;
  } catch {
    return true;
  }
}

const survivors = [];
let restore = null;

const putBack = () => {
  if (restore) writeFileSync(restore.file, restore.was);
  restore = null;
};
process.on('SIGINT', () => {
  putBack();
  process.exit(130);
});

console.log(`Checking ${chosen.length} mutation${chosen.length === 1 ? '' : 's'}.\n`);

for (const [at, mutation] of chosen.entries()) {
  const was = readFileSync(mutation.file, 'utf8');
  const hits = was.split(mutation.find).length - 1;
  if (hits !== 1) {
    putBack();
    console.error(`\n"${mutation.name}"`);
    console.error(`  its text appears ${hits} times in ${mutation.file}, expected once.`);
    console.error('  The code moved under it — fix the mutation, or it is testing nothing.');
    process.exit(2);
  }

  restore = { file: mutation.file, was };
  try {
    writeFileSync(mutation.file, was.replace(mutation.find, mutation.replace));
    const noticed = suiteFails(mutation.tests);
    console.log(
      `${String(at + 1).padStart(2)}/${chosen.length}  ${noticed ? 'caught  ' : 'SURVIVED'}  ${mutation.name}`,
    );
    if (!noticed) survivors.push(mutation);
  } finally {
    putBack();
  }
}

if (survivors.length === 0) {
  console.log('\nEvery one was caught.');
  process.exit(0);
}

console.error(`\n${survivors.length} survived — these can be broken with the suite still green:`);
for (const survivor of survivors) console.error(`  ${survivor.file}: ${survivor.name}`);
process.exit(1);
