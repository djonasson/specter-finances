// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExpenseRow } from '../types/expense';
import type { TransferRow } from '../types/transfer';
import type { GiftRow } from '../types/gift';

// The token is irrelevant to what we assert — we only need sheetsRequest to get
// past its auth check so we can inspect the request it builds.
vi.mock('./auth', () => ({
  getAccessToken: () => 'test-token',
  refreshToken: async () => 'refreshed-token',
}));

import { setGrantedSheetId, getGrantedSheetId, clearGrantedSheetId } from './sheetAccess';
import {
  fetchExpenses,
  fetchTransfers,
  fetchGifts,
  addTransfer,
  updateTransfer,
  deleteTransfer,
  addGift,
  updateGift,
  deleteExpense,
  updateExpense,
} from './sheets';

const SPREADSHEET_ID = 'test-sheet-id';

/** Queue of responses, one per fetch call, in order. */
function mockFetch(responses: unknown[]) {
  const calls: { url: string; options: RequestInit }[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string, options: RequestInit = {}) => {
    calls.push({ url, options });
    const body = responses[i++] ?? {};
    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

/** Parse the JSON body a mutation sent. */
function bodyOf(call: { options: RequestInit }): Record<string, unknown> {
  return JSON.parse(call.options.body as string);
}

beforeEach(() => {
  vi.stubEnv('VITE_SHEET_NAME', 'Sheet1');
  // With the drive.file scope the target sheet is the one the user picked, not
  // a build-time env var.
  setGrantedSheetId(SPREADSHEET_ID);
});

afterEach(() => {
  clearGrantedSheetId();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Row index offsets ──
// These encode the sheet layout: expenses have a header AND a sub-header so
// data starts at row 3; transfers and gifts have one header so data starts at
// row 2. An off-by-one here makes every edit and delete hit the neighbouring
// record, and because the UI reloads from the sheet afterwards there is no
// error to notice — just the wrong row changed.

describe('row index offsets', () => {
  it('numbers expense rows from sheet row 3', async () => {
    mockFetch([
      {
        values: [
          ['Date', 'Ada', 'Bo', 'Item', 'Category', 'Notes'],
          ['', '', '', '', '', ''],
          ['2026-01-01', 10, '', 'Bread', 'Food', ''],
          ['2026-01-02', 20, '', 'Milk', 'Food', ''],
        ],
      },
    ]);
    const { expenses } = await fetchExpenses();
    expect(expenses.map((e) => e.rowIndex)).toEqual([3, 4]);
  });

  it('numbers transfer rows from sheet row 2', async () => {
    mockFetch([
      {
        values: [
          ['2026-01-01', 50, '', ''],
          ['2026-01-02', '', 25, ''],
        ],
      },
    ]);
    const transfers = await fetchTransfers();
    expect(transfers.map((t) => t.rowIndex)).toEqual([2, 3]);
  });

  it('numbers gift rows from sheet row 2', async () => {
    mockFetch([{ values: [['2026-01-01', 50, '', '']] }]);
    const gifts = await fetchGifts();
    expect(gifts.map((g) => g.rowIndex)).toEqual([2]);
  });

  it('keeps row numbers aligned with the sheet when a blank row is skipped', async () => {
    // Row 3 is blank; the row after it is still sheet row 4.
    mockFetch([{ values: [['2026-01-01', 50, '', ''], [], ['2026-01-03', 75, '', '']] }]);
    const transfers = await fetchTransfers();
    expect(transfers.map((t) => t.rowIndex)).toEqual([2, 4]);
  });

  it('returns nothing when the sheet is empty', async () => {
    mockFetch([{}]);
    const { expenses } = await fetchExpenses();
    expect(expenses).toEqual([]);
  });
});

// ── Person names ──
// The two names live in the sheet, never in this codebase. Getting this wrong
// mislabels every column, and swapping a and b would attribute each person's
// spending to the other.

describe('person names', () => {
  const header = ['Date', 'Ada', 'Bo', 'Item', 'Category', 'Notes'];

  it('takes them from the two amount columns of the header row', async () => {
    mockFetch([{ values: [header, [], ['2026-01-01', 10, '', 'Bread', 'Food', '']] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Ada', b: 'Bo' });
  });

  it('asks for the header row in the same request as the data', async () => {
    const calls = mockFetch([{ values: [] }]);
    await fetchExpenses();
    expect(decodeURIComponent(calls[0].url)).toContain('Sheet1!A1:F');
    expect(calls).toHaveLength(1);
  });

  it('trims surrounding whitespace', async () => {
    mockFetch([{ values: [['Date', '  Ada ', ' Bo  ']] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Ada', b: 'Bo' });
  });

  it('falls back to generic labels for blank header cells', async () => {
    mockFetch([{ values: [['Date', '', '   ', 'Item']] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Partner A', b: 'Partner B' });
  });

  it('falls back when the header row is short', async () => {
    mockFetch([{ values: [['Date']] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Partner A', b: 'Partner B' });
  });

  it('falls back on a completely empty sheet', async () => {
    mockFetch([{}]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Partner A', b: 'Partner B' });
  });

  it('accepts a header cell the sheet returned as a number', async () => {
    // valueRenderOption=UNFORMATTED_VALUE hands back numbers unquoted.
    mockFetch([{ values: [['Date', 1, 2]] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: '1', b: '2' });
  });

  it('keeps the data rows starting at sheet row 3 regardless', async () => {
    mockFetch([{ values: [header, ['', 'paid', 'paid'], ['2026-01-01', 10, '', 'Bread']] }]);
    const { expenses } = await fetchExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].rowIndex).toBe(3);
    expect(expenses[0].item).toBe('Bread');
  });
});

// ── deleteRow ──

describe('deleteRow', () => {
  const sheetsMeta = {
    sheets: [
      { properties: { title: 'Sheet1', sheetId: 0 } },
      { properties: { title: 'Transfers', sheetId: 111 } },
      { properties: { title: 'Gifts', sheetId: 222 } },
    ],
  };

  it('deletes exactly the requested row, in the requested tab', async () => {
    const calls = mockFetch([sheetsMeta, {}]);
    await deleteTransfer(7 as TransferRow);

    const range = bodyOf(calls[1]).requests as [{ deleteDimension: { range: unknown } }];
    expect(range[0].deleteDimension.range).toEqual({
      sheetId: 111,
      dimension: 'ROWS',
      // 0-based, end-exclusive: sheet row 7 is index 6, and only that row.
      startIndex: 6,
      endIndex: 7,
    });
  });

  it('resolves the sheet id by tab title, not by position', async () => {
    const calls = mockFetch([sheetsMeta, {}]);
    await deleteExpense(3 as ExpenseRow);
    const requests = bodyOf(calls[1]).requests as [
      { deleteDimension: { range: { sheetId: number } } },
    ];
    expect(requests[0].deleteDimension.range.sheetId).toBe(0);
  });

  it('throws instead of guessing when the tab is missing', async () => {
    mockFetch([{ sheets: [{ properties: { title: 'SomethingElse', sheetId: 5 } }] }, {}]);
    await expect(deleteTransfer(2 as TransferRow)).rejects.toThrow('not found');
  });
});

// ── Direction encoding on write ──

describe('transfer writes encode direction by blanking one column', () => {
  it('puts the amount in A’s column and blanks B’s', async () => {
    const calls = mockFetch([{}]);
    await addTransfer({ date: '2026-02-01', from: 'A', amount: '50', notes: 'n' });
    expect(bodyOf(calls[0]).values).toEqual([['2026-02-01', '€50.00', '', 'n']]);
  });

  it('puts the amount in B’s column and blanks A’s', async () => {
    const calls = mockFetch([{}]);
    await addTransfer({ date: '2026-02-01', from: 'B', amount: '50', notes: '' });
    expect(bodyOf(calls[0]).values).toEqual([['2026-02-01', '', '€50.00', '']]);
  });

  it('targets the row being edited on update', async () => {
    const calls = mockFetch([{}]);
    await updateTransfer(9 as TransferRow, {
      date: '2026-02-01',
      from: 'A',
      amount: '12.5',
      notes: '',
    });
    expect(decodeURIComponent(calls[0].url)).toContain('Transfers!A9:D9');
  });
});

// ── Gift kind column ──
// Column E decides whether a row moves the balance. Reading it wrong re-prices
// history; writing it wrong loses the distinction on the next reload.

describe('gift kind column', () => {
  it('reads an explicit present', async () => {
    mockFetch([{ values: [['2026-01-01', 50, '', '', 'present']] }]);
    const [gift] = await fetchGifts();
    expect(gift.giftKind).toBe('present');
  });

  it('reads an explicit forgiven', async () => {
    mockFetch([{ values: [['2026-01-01', 50, '', '', 'forgiven']] }]);
    const [gift] = await fetchGifts();
    expect(gift.giftKind).toBe('forgiven');
  });

  it('reads a row written before the column existed as forgiven', async () => {
    // Sheets trims trailing blanks, so a legacy row arrives four cells long.
    mockFetch([{ values: [['2026-01-01', 50, '', '']] }]);
    const [gift] = await fetchGifts();
    expect(gift.giftKind).toBe('forgiven');
  });

  it('reads an unrecognised cell as forgiven rather than re-pricing the row', async () => {
    mockFetch([{ values: [['2026-01-01', 50, '', '', 'birthday']] }]);
    const [gift] = await fetchGifts();
    expect(gift.giftKind).toBe('forgiven');
  });

  it('still drops a wholly blank gift row', async () => {
    mockFetch([{ values: [['2026-01-01', 50, '', '', 'present'], []] }]);
    expect(await fetchGifts()).toHaveLength(1);
  });

  it('asks for column E on gifts', async () => {
    const calls = mockFetch([{ values: [] }]);
    await fetchGifts();
    expect(decodeURIComponent(calls[0].url)).toContain('Gifts!A2:E');
  });

  it('leaves transfers at column D', async () => {
    const calls = mockFetch([{ values: [] }]);
    await fetchTransfers();
    expect(decodeURIComponent(calls[0].url)).toContain('Transfers!A2:D');
  });

  it('writes the kind as a fifth cell on add', async () => {
    const calls = mockFetch([{}]);
    await addGift({
      date: '2026-02-01',
      from: 'A',
      amount: '50',
      notes: 'n',
      giftKind: 'forgiven',
    });
    expect(bodyOf(calls[0]).values).toEqual([['2026-02-01', '€50.00', '', 'n', 'forgiven']]);
  });

  it('keeps the direction encoding alongside it', async () => {
    const calls = mockFetch([{}]);
    await addGift({
      date: '2026-02-01',
      from: 'B',
      amount: '50',
      notes: '',
      giftKind: 'present',
    });
    expect(bodyOf(calls[0]).values).toEqual([['2026-02-01', '', '€50.00', '', 'present']]);
  });

  it('rewrites the kind on update, over the same columns', async () => {
    const calls = mockFetch([{}]);
    await updateGift(9 as GiftRow, {
      date: '2026-02-01',
      from: 'A',
      amount: '12.5',
      notes: '',
      giftKind: 'present',
    });
    expect(decodeURIComponent(calls[0].url)).toContain('Gifts!A9:E9');
    expect(bodyOf(calls[0]).values).toEqual([['2026-02-01', '€12.50', '', '', 'present']]);
  });

  it('does not write a fifth cell on a transfer', async () => {
    const calls = mockFetch([{}]);
    await addTransfer({ date: '2026-02-01', from: 'A', amount: '50', notes: '' });
    expect((bodyOf(calls[0]).values as string[][])[0]).toHaveLength(4);
  });
});

describe('expense writes', () => {
  it('targets the row being edited', async () => {
    const calls = mockFetch([{}]);
    await updateExpense(5 as ExpenseRow, {
      date: '2026-02-01',
      amountA: '10',
      amountB: '',
      item: 'Bread',
      category: 'Food',
      notes: '',
    });
    expect(decodeURIComponent(calls[0].url)).toContain('Sheet1!A5:F5');
  });
});

// ── Auth retry ──

describe('401 handling', () => {
  it('refreshes the token and retries once', async () => {
    const calls: { url: string; options: RequestInit }[] = [];
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit = {}) => {
        calls.push({ url, options });
        n++;
        if (n === 1) {
          return { ok: false, status: 401, json: async () => ({}) } as unknown as Response;
        }
        return { ok: true, status: 200, json: async () => ({ values: [] }) } as unknown as Response;
      }),
    );

    await fetchExpenses();

    expect(calls).toHaveLength(2);
    expect(calls[0].options.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    expect(calls[1].options.headers).toMatchObject({ Authorization: 'Bearer refreshed-token' });
  });

  it('surfaces the API error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Backend error' } }),
      })) as unknown as typeof fetch,
    );
    await expect(fetchExpenses()).rejects.toThrow('Backend error');
  });
});

// ── Config ──

describe('sheet access', () => {
  it('refuses to build a request before a sheet has been picked', async () => {
    clearGrantedSheetId();
    mockFetch([{}]);
    await expect(fetchExpenses()).rejects.toThrow('No spreadsheet selected');
  });

  it('targets whichever sheet was picked', async () => {
    setGrantedSheetId('picked-sheet-id');
    const calls = mockFetch([{ values: [] }]);
    await fetchExpenses();
    expect(calls[0].url).toContain('/picked-sheet-id/values/');
  });

  // The grant can disappear underneath us — sheet deleted, unshared, access
  // revoked. Holding on to it would fail every subsequent request with no way
  // back, so it is dropped and the app returns to the picker.
  it('drops the grant when the sheet is no longer reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
      })) as unknown as typeof fetch,
    );

    await expect(fetchExpenses()).rejects.toThrow('Please choose it again');
    expect(getGrantedSheetId()).toBeNull();
  });

  it('drops the grant on a permission error too', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({}),
      })) as unknown as typeof fetch,
    );

    await expect(fetchExpenses()).rejects.toThrow('Please choose it again');
    expect(getGrantedSheetId()).toBeNull();
  });

  it('carries the API reason so the picker can explain itself', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'The caller does not have permission' } }),
      })) as unknown as typeof fetch,
    );

    await expect(fetchExpenses()).rejects.toThrow('The caller does not have permission');
  });

  // The Drive probe is what distinguishes the failure modes; these pin its two
  // decisive answers.
  it('reports when Drive cannot see the file either (no grant)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: false,
        status: 404,
        json: async () => (url.includes('drive/v3') ? {} : { error: { message: 'Not found' } }),
      })) as unknown as typeof fetch,
    );

    await expect(fetchExpenses()).rejects.toThrow('no per-file grant was created');
  });

  it('reports when Drive CAN see the file but Sheets refused it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('drive/v3')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'x',
              name: 'Finances',
              mimeType: 'application/vnd.google-apps.spreadsheet',
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({ error: { message: 'Not found' } }) };
      }) as unknown as typeof fetch,
    );

    await expect(fetchExpenses()).rejects.toThrow('the grant exists but Sheets refused it');
  });

  it('spots a shortcut standing in for the sheet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('drive/v3')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              mimeType: 'application/vnd.google-apps.shortcut',
              shortcutDetails: { targetId: 'real-id' },
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }) as unknown as typeof fetch,
    );

    await expect(fetchExpenses()).rejects.toThrow('Real file id: real-id');
  });

  it('keeps the grant on an unrelated server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Backend error' } }),
      })) as unknown as typeof fetch,
    );

    await expect(fetchExpenses()).rejects.toThrow('Backend error');
    expect(getGrantedSheetId()).toBe(SPREADSHEET_ID);
  });
});
