import { describe, it, expect } from 'vitest';
import { DEFAULT_EXCLUDED, excludedFor, pickBackground, poolFrom, toExcluded } from './random';
import { BACKGROUNDS } from './registry';

// The roll is a parameter rather than a call to Math.random inside, for the same
// reason Cello's scene takes its randomness as one: a shuffle nobody can hold
// still is a shuffle nobody can test.

const byRegistryOrder = (a: string, b: string) => {
  const order = BACKGROUNDS.map((background) => background.value) as readonly string[];
  return order.indexOf(a) - order.indexOf(b);
};

describe('picking a background out of the pool', () => {
  const POOL = ['matrix', 'gradient', 'squirrel', 'cello'] as const;

  it('lands on the entry the roll points at', () => {
    expect(pickBackground(POOL, 0)).toBe('matrix');
    expect(pickBackground(POOL, 0.3)).toBe('gradient');
    expect(pickBackground(POOL, 0.5)).toBe('squirrel');
    expect(pickBackground(POOL, 0.99)).toBe('cello');
  });

  it('does not fall off the end of the pool on a roll of exactly 1', () => {
    expect(pickBackground(POOL, 1)).toBe('cello');
  });

  it('still names a background in the pool when the roll is not between 0 and 1', () => {
    expect(POOL).toContain(pickBackground(POOL, -1));
    expect(POOL).toContain(pickBackground(POOL, 2));
    expect(POOL).toContain(pickBackground(POOL, Number.NaN));
  });

  it('takes the only entry of a one-background pool whatever the roll', () => {
    expect(pickBackground(['cello'], 0)).toBe('cello');
    expect(pickBackground(['cello'], 0.99)).toBe('cello');
  });

  it('shows the plain background when the pool leaves nothing to pick from', () => {
    // Unticking every box is a decision. Picking one of them anyway would be the
    // app overruling it; picking nothing is what was asked for.
    expect(pickBackground([], 0)).toBe('none');
  });
});

// Stored as what the user turned *off*, not what they left on. A background
// added to the registry later then joins every existing user's shuffle the day
// it ships — stored inclusions would freeze the shuffle to the list of
// backgrounds that happened to exist when someone last opened the drawer.
describe('the pool a stored set of exclusions leaves', () => {
  const ALL = BACKGROUNDS.map((background) => background.value);

  it('shuffles between everything nobody turned off', () => {
    expect(poolFrom([])).toEqual(ALL);
  });

  it('leaves out what was turned off, in the order the picker shows the rest', () => {
    expect(poolFrom(['none', 'matrix'])).toEqual(
      ALL.filter((value) => value !== 'none' && value !== 'matrix'),
    );
  });

  it('leaves nothing to shuffle when every background was turned off', () => {
    expect(poolFrom(ALL)).toEqual([]);
  });
});

describe('turning a list of backgrounds to shuffle between into what to store', () => {
  it('stores everything the list left out', () => {
    expect(excludedFor(['matrix', 'cello'])).toEqual(['none', 'gradient', 'squirrel', 'ciccio']);
  });

  it('stores every background when the list is empty, so nothing is shuffled', () => {
    expect(excludedFor([])).toEqual(BACKGROUNDS.map((background) => background.value));
  });

  it('ignores a name no background answers to rather than storing it as excluded', () => {
    expect(excludedFor(['cello', 'pinball'])).not.toContain('pinball');
  });

  it('round-trips a pool through storage unchanged', () => {
    for (const pool of [['cello'], ['matrix', 'cello'], [], ['none', 'gradient']]) {
      expect(poolFrom(excludedFor(pool))).toEqual(pool.slice().sort(byRegistryOrder));
    }
  });
});

describe('reading a stored set of exclusions', () => {
  it('keeps the names that still answer to a background', () => {
    expect(toExcluded(['cello', 'pinball', 'matrix'])).toEqual(['cello', 'matrix']);
  });

  it('turns nothing off twice over, however storage came to hold it', () => {
    expect(toExcluded(['cello', 'cello'])).toEqual(['cello']);
  });

  it('keeps an empty list empty: nothing turned off means everything shuffles', () => {
    expect(toExcluded([])).toEqual([]);
  });

  it('starts from the plain background alone when storage holds no list at all', () => {
    // Storage outlives releases and any page on this origin can write it.
    expect(toExcluded(undefined)).toEqual([...DEFAULT_EXCLUDED]);
    expect(toExcluded('cello')).toEqual([...DEFAULT_EXCLUDED]);
    expect(toExcluded({ 0: 'cello' })).toEqual([...DEFAULT_EXCLUDED]);
  });

  // The failure this direction rules out: a stored list of names a later build
  // does not know must not read as "the user turned everything off". Dropping an
  // unknown *exclusion* puts a background back into the shuffle, which is the
  // safe direction — dropping an unknown *inclusion* used to empty the pool and
  // leave a blank screen the user never asked for.
  it('shuffles everything again when none of the stored names are recognised', () => {
    expect(toExcluded(['squirrelX', 'celloX'])).toEqual([]);
    expect(poolFrom(toExcluded(['squirrelX']))).toEqual(BACKGROUNDS.map((b) => b.value));
  });
});

describe('what a first-time shuffle leaves out', () => {
  it('leaves out the plain background alone, so a first shuffle draws something', () => {
    expect([...DEFAULT_EXCLUDED]).toEqual(['none']);
  });
});
