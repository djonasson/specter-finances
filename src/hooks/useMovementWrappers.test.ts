// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TransferRow } from '../types/transfer';
import type { GiftRow } from '../types/gift';

// Hoisted with the mock factory, which vitest lifts above every other statement
// in the file.
const { calls, record } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    record: (name: string, value: unknown) => async () => {
      calls.push(name);
      return value;
    },
  };
});

vi.mock('../services/sheets', () => ({
  fetchTransfers: record('fetchTransfers', []),
  addTransfer: record('addTransfer', undefined),
  updateTransfer: record('updateTransfer', undefined),
  deleteTransfer: record('deleteTransfer', undefined),
  fetchGifts: record('fetchGifts', []),
  addGift: record('addGift', undefined),
  updateGift: record('updateGift', undefined),
  deleteGift: record('deleteGift', undefined),
}));

import { useTransfers } from './useTransfers';
import { useGifts } from './useGifts';

const transferForm = { date: '2026-01-10', from: 'A' as const, amount: '50', notes: '' };
const giftForm = { ...transferForm, giftKind: 'present' as const };

beforeEach(() => {
  calls.length = 0;
});

// Added retroactively. These two wrappers do nothing but choose which set of
// sheet functions the shared engine drives — which is exactly the kind of code a
// copy-paste gets wrong quietly, sending a gift to the Transfers tab where it
// would be read back with the opposite sign in the balance.

describe('useTransfers', () => {
  it('drives the transfer end of the sheet, and only that', async () => {
    const { result } = renderHook(() => useTransfers());

    await act(async () => {
      await result.current.load();
    });
    await act(async () => {
      await result.current.add(transferForm);
    });
    await act(async () => {
      await result.current.update(2 as TransferRow, transferForm);
    });
    await act(async () => {
      await result.current.remove(2 as TransferRow);
    });

    expect(calls.filter((c) => c.includes('Gift'))).toEqual([]);
    expect(new Set(calls)).toEqual(
      new Set(['fetchTransfers', 'addTransfer', 'updateTransfer', 'deleteTransfer']),
    );
  });
});

describe('useGifts', () => {
  it('drives the gift end of the sheet, and only that', async () => {
    const { result } = renderHook(() => useGifts());

    await act(async () => {
      await result.current.load();
    });
    await act(async () => {
      await result.current.add(giftForm);
    });
    await act(async () => {
      await result.current.update(2 as GiftRow, giftForm);
    });
    await act(async () => {
      await result.current.remove(2 as GiftRow);
    });

    expect(calls.filter((c) => c.includes('Transfer'))).toEqual([]);
    expect(new Set(calls)).toEqual(new Set(['fetchGifts', 'addGift', 'updateGift', 'deleteGift']));
  });

  it('names its collection in a failure message, so the banner says which one', async () => {
    // Both wrappers share one engine; the label is all that tells them apart
    // when a read fails with nothing to report.
    const { result } = renderHook(() => useGifts());
    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual([]);
  });
});
