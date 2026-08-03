// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMovements } from './useMovements';

// Added retroactively: this hook is the load/mutate/reload engine behind
// transfers and gifts, and it had no tests. Its contract is load-bearing in two
// directions — mutations must reload rather than patch, because a delete
// renumbers every row beneath it, and mutations must reject to the caller so the
// form that submitted can show what went wrong.

interface Row {
  rowIndex: number;
  note: string;
}

function makeCrud(overrides: Partial<Parameters<typeof useMovements<Row, number, Row>>[0]> = {}) {
  return {
    fetchAll: vi.fn(async () => [{ rowIndex: 2, note: 'one' }]),
    add: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    ...overrides,
  };
}

const render = (crud: ReturnType<typeof makeCrud>) =>
  renderHook(() => useMovements<Row, number, Row>(crud, 'things'));

describe('useMovements', () => {
  it('starts empty and idle, before anything has been asked of the sheet', () => {
    const { result } = render(makeCrud());
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('holds what the sheet returned', async () => {
    const crud = makeCrud();
    const { result } = render(crud);
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.items).toEqual([{ rowIndex: 2, note: 'one' }]);
  });

  it('reports a failure in the sheet API’s own words', async () => {
    const crud = makeCrud({
      fetchAll: vi.fn(async () => {
        throw new Error('Backend error');
      }),
    });
    const { result } = render(crud);
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBe('Backend error');
  });

  it('falls back to naming the collection when the failure has no message', async () => {
    const crud = makeCrud({
      fetchAll: vi.fn(async () => {
        throw 'nope';
      }),
    });
    const { result } = render(crud);
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBe('Failed to load things');
  });

  it('stops loading whether the read succeeded or not', async () => {
    const crud = makeCrud({
      fetchAll: vi.fn(async () => {
        throw new Error('Backend error');
      }),
    });
    const { result } = render(crud);
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('clears a previous failure when a later read succeeds', async () => {
    let fail = true;
    const crud = makeCrud({
      fetchAll: vi.fn(async () => {
        if (fail) throw new Error('Backend error');
        return [{ rowIndex: 2, note: 'one' }];
      }),
    });
    const { result } = render(crud);
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBe('Backend error');

    fail = false;
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.error).toBeNull();
  });

  // Reload rather than patch: a delete renumbers every row below it, so local
  // state goes stale the instant a mutation lands.
  it.each([
    [
      'adding',
      (r: { current: ReturnType<typeof useMovements<Row, number, Row>> }) =>
        r.current.add({ rowIndex: 0, note: 'new' }),
    ],
    [
      'updating',
      (r: { current: ReturnType<typeof useMovements<Row, number, Row>> }) =>
        r.current.update(2, { rowIndex: 2, note: 'edited' }),
    ],
    [
      'removing',
      (r: { current: ReturnType<typeof useMovements<Row, number, Row>> }) => r.current.remove(2),
    ],
  ])('re-reads the sheet after %s', async (_label, mutate) => {
    const crud = makeCrud();
    const { result } = render(crud);
    await act(async () => {
      await mutate(result);
    });
    expect(crud.fetchAll).toHaveBeenCalledTimes(1);
  });

  // The form that submitted is what shows the failure, so a rejected mutation
  // must reach it rather than being parked in this hook's error state.
  it.each([
    [
      'add',
      (c: ReturnType<typeof makeCrud>) =>
        (c.add = vi.fn(async () => {
          throw new Error('Write failed');
        })),
    ],
    [
      'update',
      (c: ReturnType<typeof makeCrud>) =>
        (c.update = vi.fn(async () => {
          throw new Error('Write failed');
        })),
    ],
    [
      'remove',
      (c: ReturnType<typeof makeCrud>) =>
        (c.remove = vi.fn(async () => {
          throw new Error('Write failed');
        })),
    ],
  ])('lets a failed %s reject to the caller instead of swallowing it', async (name, breakIt) => {
    const crud = makeCrud();
    breakIt(crud);
    const { result } = render(crud);

    await expect(
      act(async () => {
        if (name === 'add') await result.current.add({ rowIndex: 0, note: 'x' });
        else if (name === 'update') await result.current.update(2, { rowIndex: 2, note: 'x' });
        else await result.current.remove(2);
      }),
    ).rejects.toThrow('Write failed');

    expect(result.current.error).toBeNull();
    expect(crud.fetchAll).not.toHaveBeenCalled();
  });

  it('keeps its callbacks stable, because an effect elsewhere is keyed on them', () => {
    const { result, rerender } = render(makeCrud());
    const first = result.current.load;
    rerender();
    // App refetches on every navigation with load() in the dependency array; a
    // fresh identity per render would refetch forever.
    expect(result.current.load).toBe(first);
  });
});
