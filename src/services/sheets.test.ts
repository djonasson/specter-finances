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
  addExpense,
  fetchRecurring,
  addRecurring,
  updateRecurring,
  deleteRecurring,
  assignRecurringId,
  ensureRecurringSetup,
  ensureExpenseColumnLabels,
  resetRecurringTabCache,
  appendGeneratedExpenses,
  newRuleId,
  SheetsApiError,
} from './sheets';
import type { RecurringRow } from '../types/recurring';
import type { PendingExpense } from './recurring';

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

/**
 * Like mockFetch, but each queued entry may set its own status — needed for the
 * paths that turn on one 4xx meaning something different from another.
 */
function mockFetchStatuses(responses: { status?: number; body?: unknown }[]) {
  const calls: { url: string; options: RequestInit }[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string, options: RequestInit = {}) => {
    calls.push({ url, options });
    const r = responses[i++] ?? {};
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => r.body ?? {},
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

/** Every request URL, decoded, so ranges can be matched as written. */
function urls(calls: { url: string }[]): string[] {
  return calls.map((c) => decodeURIComponent(c.url));
}

beforeEach(() => {
  // The tab-presence answer is cached for the session, so each test starts by
  // forgetting it — otherwise one test's sheet decides the next test's.
  resetRecurringTabCache();
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
  const merged = ['Date', 'Amount', '', 'Item', 'Category', 'Notes'];
  const subHeader = ['', 'Ada', 'Bo', '', '', ''];
  const data = ['2026-01-01', 10, '', 'Bread', 'Food', ''];

  it('reads them from the sub-header under a merged group header', () => {
    // The real layout: row 1 merges B and C under one "Amount" label, so only
    // B1 carries it and C1 comes back blank. Reading row 1 first put "Amount"
    // next to a "Partner B" placeholder.
    mockFetch([{ values: [merged, subHeader, data] }]);
    return fetchExpenses().then(({ names }) => {
      expect(names).toEqual({ a: 'Ada', b: 'Bo' });
    });
  });

  it('reads them from row 1 when that is where they are', async () => {
    mockFetch([{ values: [['Date', 'Ada', 'Bo', 'Item'], [], data] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Ada', b: 'Bo' });
  });

  it('prefers the sub-header when both rows are filled', async () => {
    mockFetch([{ values: [['Date', 'Paid', 'Paid too'], subHeader, data] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Ada', b: 'Bo' });
  });

  it('asks for both header rows in the same request as the data', async () => {
    const calls = mockFetch([{ values: [] }]);
    await fetchExpenses();
    expect(decodeURIComponent(calls[0].url)).toContain('Sheet1!A1:H');
    expect(calls).toHaveLength(1);
  });

  it('trims surrounding whitespace', async () => {
    mockFetch([{ values: [merged, ['', '  Ada ', ' Bo  ']] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Ada', b: 'Bo' });
  });

  // Both labels have to come from one row. One real name beside a placeholder
  // reads as though the sheet is misconfigured for only one of the two.
  it('takes both names or neither, never one of each', async () => {
    mockFetch([{ values: [merged, ['', 'Ada', '']] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Partner A', b: 'Partner B' });
  });

  it('ignores a row whose two cells are identical', async () => {
    // A group label repeated across both columns names nobody.
    mockFetch([{ values: [['Date', 'Amount', 'Amount'], []] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Partner A', b: 'Partner B' });
  });

  it('falls back when neither header row has both', async () => {
    mockFetch([{ values: [['Date'], ['', '', '   ']] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Partner A', b: 'Partner B' });
  });

  it('falls back on a completely empty sheet', async () => {
    mockFetch([{}]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Partner A', b: 'Partner B' });
  });

  it('accepts header cells the sheet returned as numbers', async () => {
    // valueRenderOption=UNFORMATTED_VALUE hands back numbers unquoted.
    mockFetch([{ values: [['Date', 1, 2]] }]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: '1', b: '2' });
  });

  it('keeps the data rows starting at sheet row 3 regardless', async () => {
    mockFetch([{ values: [merged, subHeader, data] }]);
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

// ── Errors that are not failures ──
//
// Reading a tab that does not exist answers 400. For the Recurring tab that is
// an ordinary state — a sheet nobody has set up yet — not something to put in a
// red banner. Telling that apart from a real 400 has to be exact: swallow the
// wrong one and a genuine failure is reported as "nothing configured".

describe('SheetsApiError', () => {
  it('still surfaces the API wording, so the message the user sees is unchanged', async () => {
    mockFetchStatuses([{ status: 500, body: { error: { message: 'Backend error' } } }]);
    await expect(fetchExpenses()).rejects.toThrow('Backend error');
  });

  it('carries the status, so a caller can tell one failure from another', async () => {
    mockFetchStatuses([{ status: 400, body: { error: { message: 'Unable to parse range' } } }]);
    await expect(fetchExpenses()).rejects.toMatchObject({ status: 400 });
    expect(new SheetsApiError(400, 'x')).toBeInstanceOf(Error);
  });
});

// ── Recurring payments ──

describe('recurring rules', () => {
  it('numbers recurring rows from sheet row 2 and reads through column H', async () => {
    const calls = mockFetchStatuses([
      {
        body: {
          values: [
            ['2026-01-10', 12.99, '', 'Phone', 'Various', '', 10, 'r1'],
            ['2026-02-05', '', 30, 'Gym', 'Health', 'joint', 5, 'r2'],
          ],
        },
      },
    ]);

    const { rules, tabMissing } = await fetchRecurring();

    expect(tabMissing).toBe(false);
    expect(urls(calls)[0]).toContain('Recurring!A2:H');
    expect(rules.map((r) => r.rowIndex)).toEqual([2, 3]);
  });

  it('reads amounts in the same display form an expense uses', async () => {
    mockFetchStatuses([
      { body: { values: [['2026-01-10', 1234.5, '', 'Phone', 'Various', '', 10, 'r1']] } },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0]).toMatchObject({ amountA: '€1,234.50', amountB: '', id: 'r1', day: 10 });
  });

  it('reads a category the sheet cannot match as blank rather than inventing one', async () => {
    mockFetchStatuses([
      { body: { values: [['2026-01-10', 10, '', 'Phone', 'Groceries', '', 10, 'r1']] } },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0].category).toBe('');
  });

  it('falls back to the start date when a hand-added rule leaves the day blank', async () => {
    mockFetchStatuses([{ body: { values: [['2026-01-23', 10, '', 'Phone', 'Various', '']] } }]);
    const { rules } = await fetchRecurring();
    expect(rules[0].day).toBe(23);
    expect(rules[0].id).toBe('');
  });

  it('drops a blank rule row but keeps the rows below it aligned', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [
            ['2026-01-10', 10, '', 'Phone', 'Various', '', 10, 'r1'],
            [],
            ['2026-01-12', 20, '', 'Gym', 'Health', '', 12, 'r2'],
          ],
        },
      },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules.map((r) => r.rowIndex)).toEqual([2, 4]);
  });

  it('reports a tab that does not exist as an empty state, not a failure', async () => {
    const calls = mockFetchStatuses([
      { status: 400, body: { error: { message: 'Unable to parse range: Recurring!A2:H' } } },
      { body: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] } },
    ]);

    await expect(fetchRecurring()).resolves.toEqual({ rules: [], tabMissing: true });
    expect(urls(calls)[1]).toContain('fields=sheets.properties');
  });

  it('stops re-asking whether the tab exists on every load', async () => {
    // Every navigation reloads every domain. Without this, a sheet that has not
    // opted in pays a doomed read AND a metadata lookup, on every single one.
    const first = mockFetchStatuses([
      { status: 400, body: { error: { message: 'Unable to parse range: Recurring!A2:H' } } },
      { body: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] } },
    ]);
    await expect(fetchRecurring()).resolves.toEqual({ rules: [], tabMissing: true });
    expect(first).toHaveLength(2);

    const second = mockFetchStatuses([
      { status: 400, body: { error: { message: 'Unable to parse range: Recurring!A2:H' } } },
    ]);
    await expect(fetchRecurring()).resolves.toEqual({ rules: [], tabMissing: true });
    expect(second).toHaveLength(1); // the classification is not re-derived
  });

  it('does not carry what it learned about one spreadsheet over to another', async () => {
    // A dropped grant sends the user back to the picker without the module ever
    // unloading, and the sheet they pick next owes the first one nothing.
    mockFetchStatuses([
      { status: 400, body: { error: { message: 'Unable to parse range: Recurring!A2:H' } } },
      { body: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] } },
    ]);
    await expect(fetchRecurring()).resolves.toEqual({ rules: [], tabMissing: true });

    setGrantedSheetId('a-different-sheet');
    const calls = mockFetchStatuses([
      { body: { values: [['2026-01-10', 12.99, '', 'Phone', 'Various', '', 10, 'r1']] } },
    ]);
    const { rules, tabMissing } = await fetchRecurring();

    expect(tabMissing).toBe(false);
    expect(rules).toHaveLength(1);
    expect(urls(calls)[0]).toContain('a-different-sheet');
  });

  it('lets a genuine 400 through rather than reporting no rules', async () => {
    // The tab is there, so whatever the 400 was, it was real.
    mockFetchStatuses([
      { status: 400, body: { error: { message: 'Invalid query parameter' } } },
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
    ]);
    await expect(fetchRecurring()).rejects.toThrow('Invalid query parameter');
  });

  it('does not mistake a server error for a missing tab', async () => {
    mockFetchStatuses([{ status: 500, body: { error: { message: 'Backend error' } } }]);
    await expect(fetchRecurring()).rejects.toThrow('Backend error');
  });
});

describe('setting up the Recurring tab', () => {
  it('creates the tab and writes its header', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] } }, // no Recurring yet
      { body: {} }, // addSheet
      { body: {} }, // header PUT
      { body: {} }, // read the expense column labels
      { body: {} }, // write them
    ]);

    await ensureRecurringSetup();

    expect(bodyOf(calls[1])).toEqual({
      requests: [{ addSheet: { properties: { title: 'Recurring' } } }],
    });
    expect(urls(calls)[2]).toContain('Recurring!A1:H1');
    expect(bodyOf(calls[2]).values).toEqual([
      ['Start', 'Amount (A)', 'Amount (B)', 'Item', 'Category', 'Notes', 'Day', 'Id'],
    ]);
  });

  it('creates nothing when the tab already exists', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      { body: { values: [['Recurring', 'Added']] } }, // labels already in place
    ]);

    await ensureRecurringSetup();

    // The tab lookup and the label check, and no writes of any kind.
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => (c.options.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('labels the expense columns even when the tab is already there', async () => {
    // The labelling used to sit behind the early return, so the only sheets that
    // ever got a heading over column H were the ones set up from scratch — while
    // every added expense writes that column regardless.
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      { body: {} }, // G2:H2 blank
      { body: {} },
    ]);

    await ensureRecurringSetup();

    expect(urls(calls)[2]).toContain('Sheet1!G2:H2');
    expect(bodyOf(calls[2]).values).toEqual([['Recurring', 'Added']]);
  });

  it('asks the spreadsheet only once per session whether the tab exists', async () => {
    const first = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      { body: { values: [['Recurring', 'Added']] } },
    ]);
    await ensureRecurringSetup();
    expect(first).toHaveLength(2);

    const second = mockFetchStatuses([{ body: { values: [['Recurring', 'Added']] } }]);
    await ensureRecurringSetup();
    // Only the label check — the tab lookup is not repeated.
    expect(second).toHaveLength(1);
    expect(urls(second)[0]).toContain('Sheet1!G2:H2');
  });
});

describe('writing recurring rules', () => {
  it('gives a new rule an id, so what it generates can be traced back', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      { body: { values: [['Recurring', 'Added']] } }, // labels already in place
      { body: {} },
    ]);

    await addRecurring({
      start: '2026-01-10',
      amountA: '12.99',
      amountB: '',
      item: 'Phone',
      category: 'Various',
      notes: '',
      day: 10,
    });

    const row = (bodyOf(calls[2]).values as string[][])[0];
    expect(row.slice(0, 7)).toEqual(['2026-01-10', '€12.99', '', 'Phone', 'Various', '', '10']);
    expect(row[7]).toMatch(/^r[a-z0-9]+$/);
  });

  it('generates a distinct id every time', () => {
    const ids = new Set(Array.from({ length: 500 }, newRuleId));
    expect(ids.size).toBe(500);
  });

  it('writes only to the Recurring tab when a rule changes, never to the expenses tab', async () => {
    // The invariant: a subscription getting dearer must not rewrite what was
    // already paid. Nothing may reach across from a rule to an expense row.
    const calls = mockFetchStatuses([{ body: {} }]);

    await updateRecurring(
      4 as RecurringRow,
      {
        start: '2026-01-10',
        amountA: '15.00',
        amountB: '',
        item: 'Phone',
        category: 'Various',
        notes: '',
        day: 10,
      },
      'r1',
    );

    expect(calls).toHaveLength(1);
    expect(urls(calls)[0]).toContain('Recurring!A4:H4');
    expect(urls(calls).some((u) => u.includes('Sheet1'))).toBe(false);
    // The id is carried through, not regenerated — otherwise every edit would
    // orphan the rule's own history.
    expect((bodyOf(calls[0]).values as string[][])[0][7]).toBe('r1');
  });

  it('deletes a rule without touching the expenses tab, so its history survives', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      { body: {} },
    ]);

    await deleteRecurring(5 as RecurringRow);

    expect(urls(calls).some((u) => u.includes('Sheet1'))).toBe(false);
    expect(bodyOf(calls[1])).toEqual({
      requests: [
        {
          deleteDimension: { range: { sheetId: 7, dimension: 'ROWS', startIndex: 4, endIndex: 5 } },
        },
      ],
    });
  });

  it('assigns an id to a hand-added rule by writing that one cell', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);
    await assignRecurringId(3 as RecurringRow);
    expect(urls(calls)[0]).toContain('Recurring!H3');
    expect((bodyOf(calls[0]).values as string[][])[0][0]).toMatch(/^r[a-z0-9]+$/);
  });
});

describe('writing generated expenses', () => {
  const pending: PendingExpense[] = [
    {
      ruleId: 'r1',
      month: '2026-02',
      marker: 'rec:r1:2026-02',
      date: '2026-02-10',
      amountA: '€12.99',
      amountB: '',
      item: 'Phone',
      category: 'Various',
      notes: '',
    },
    {
      ruleId: 'r1',
      month: '2026-03',
      marker: 'rec:r1:2026-03',
      date: '2026-03-10',
      amountA: '€12.99',
      amountB: '',
      item: 'Phone',
      category: 'Various',
      notes: '',
    },
  ];

  it('writes every due month in a single request, so it cannot half-succeed', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);
    await appendGeneratedExpenses(pending);
    expect(calls).toHaveLength(1);
    expect(bodyOf(calls[0]).values).toHaveLength(2);
  });

  it('puts the marker in the seventh cell, where the reader looks for it', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);
    await appendGeneratedExpenses(pending);
    const rows = bodyOf(calls[0]).values as string[][];
    expect(rows[0].slice(0, 7)).toEqual([
      '2026-02-10',
      '€12.99',
      '',
      'Phone',
      'Various',
      '',
      'rec:r1:2026-02',
    ]);
    expect(rows[1][6]).toBe('rec:r1:2026-03');
  });

  it('asks Sheets to insert rows rather than overwrite whatever is below the table', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);
    await appendGeneratedExpenses(pending);
    expect(calls[0].url).toContain('insertDataOption=INSERT_ROWS');
  });

  it('issues no request at all when nothing is due', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);
    await appendGeneratedExpenses([]);
    expect(calls).toHaveLength(0);
  });
});

// ── The marker column ──
//
// Column G was added to a sheet that has been in use for years. Every row
// written before it must read exactly as it did, and no ordinary edit may erase
// it: a generated row that loses its marker reads as never generated, and the
// next check writes the payment a second time.

describe('the recurring marker column', () => {
  it('reads a generated row as carrying its provenance', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [
            ['Date', 'Ada', 'Bo', 'Item', 'Category', 'Notes', 'Recurring'],
            ['', 'Ada', 'Bo', '', '', '', ''],
            ['2026-02-10', 12.99, '', 'Phone', 'Various', '', 'rec:r1:2026-02'],
          ],
        },
      },
    ]);
    const { expenses } = await fetchExpenses();
    expect(expenses[0].recurringMarker).toBe('rec:r1:2026-02');
  });

  it('still reads both names now that the header row is seven cells wide', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [
            ['Date', 'Amount', '', 'Item', 'Category', 'Notes', 'Recurring'],
            ['', 'Ada', 'Bo', '', '', '', ''],
          ],
        },
      },
    ]);
    const { names } = await fetchExpenses();
    expect(names).toEqual({ a: 'Ada', b: 'Bo' });
  });

  it('editing an expense writes only A to F, so a generated row keeps its provenance', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await updateExpense(5 as ExpenseRow, {
      date: '2026-02-10',
      amountA: '14.00',
      amountB: '',
      item: 'Phone',
      category: 'Various',
      notes: 'price went up',
    });

    expect(urls(calls)[0]).toContain('Sheet1!A5:F5');
    expect((bodyOf(calls[0]).values as string[][])[0]).toHaveLength(6);
  });

  it('adding an expense by hand leaves the marker column empty', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await addExpense({
      date: '2026-02-10',
      amountA: '14.00',
      amountB: '',
      item: 'Bread',
      category: 'Food',
      notes: '',
    });

    expect((bodyOf(calls[0]).values as string[][])[0][6]).toBe('');
  });
});

// ── The added-on column ──
//
// The sheet records when money was spent, never when the row was typed. Column
// H is the app's own record of the latter, so a purchase entered today but
// dated last month can be pointed out in a list ordered by date.

describe('the added-on column', () => {
  it('reads the expenses through column H', async () => {
    const calls = mockFetchStatuses([{ body: { values: [] } }]);
    await fetchExpenses();
    expect(urls(calls)[0]).toContain('Sheet1!A1:H');
  });

  it('reads a row written before the column existed as not knowing', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [
            ['Date', 'Ada', 'Bo', 'Item', 'Category', 'Notes'],
            ['', 'Ada', 'Bo', '', '', ''],
            ['2026-01-01', 10, '', 'Bread', 'Food', 'sourdough'],
          ],
        },
      },
    ]);

    const { expenses } = await fetchExpenses();

    // The whole record, so this doubles as proof that widening the range to H
    // changed nothing else about how an existing row reads.
    expect(expenses).toEqual([
      {
        rowIndex: 3,
        date: '2026-01-01',
        amountA: '€10.00',
        amountB: '',
        item: 'Bread',
        category: 'Food',
        notes: 'sourdough',
        recurringMarker: '',
        addedOn: '',
      },
    ]);
  });

  it('reads a stamped row, normalising the date like any other', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [
            ['Date', 'Ada', 'Bo', 'Item', 'Category', 'Notes', 'Recurring', 'Added'],
            ['', 'Ada', 'Bo', '', '', '', '', ''],
            ['2026-01-01', 10, '', 'Bread', 'Food', '', '', '20/03/2026'],
          ],
        },
      },
    ]);
    const { expenses } = await fetchExpenses();
    expect(expenses[0].addedOn).toBe('2026-03-20');
  });

  it('stamps a new expense with today, alongside an empty marker cell', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await addExpense({
      date: '2026-01-05', // deliberately back-dated
      amountA: '14.00',
      amountB: '',
      item: 'Bread',
      category: 'Food',
      notes: '',
    });

    expect(urls(calls)[0]).toContain('Sheet1!A:H');
    const row = (bodyOf(calls[0]).values as string[][])[0];
    expect(row).toHaveLength(8);
    expect(row[6]).toBe(''); // hand-entered: no recurring marker
    expect(row[7]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row[7]).not.toBe(row[0]); // when it was typed, not when it was spent
  });

  it('stamps every caught-up recurring expense too, which is where it matters most', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await appendGeneratedExpenses([
      {
        ruleId: 'r1',
        month: '2026-02',
        marker: 'rec:r1:2026-02',
        date: '2026-02-10',
        amountA: '€12.99',
        amountB: '',
        item: 'Phone',
        category: 'Various',
        notes: '',
      },
    ]);

    expect(urls(calls)[0]).toContain('Sheet1!A:H');
    const row = (bodyOf(calls[0]).values as string[][])[0];
    expect(row[6]).toBe('rec:r1:2026-02');
    expect(row[7]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Editing an amount does not change the day the row was added, and the marker
  // must survive too — both follow from the PUT range stopping at F.
  it('leaves the stamp alone when an expense is edited', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await updateExpense(5 as ExpenseRow, {
      date: '2026-02-10',
      amountA: '14.00',
      amountB: '',
      item: 'Phone',
      category: 'Various',
      notes: 'corrected',
    });

    expect(urls(calls)[0]).toContain('Sheet1!A5:F5');
    expect((bodyOf(calls[0]).values as string[][])[0]).toHaveLength(6);
  });

  it('labels both app-written columns when they are blank', async () => {
    const calls = mockFetchStatuses([{ body: {} }, { body: {} }]);

    await ensureExpenseColumnLabels();

    expect(urls(calls)[0]).toContain('Sheet1!G2:H2');
    expect(bodyOf(calls[1]).values).toEqual([['Recurring', 'Added']]);
  });

  it('writes only the missing label, leaving the occupied cell untouched', async () => {
    // Not merely "writes the same value back": these are cells in someone's own
    // spreadsheet, and re-writing one that holds a formula would replace it with
    // whatever it happened to render to at the time.
    const calls = mockFetchStatuses([{ body: { values: [['Repeats']] } }, { body: {} }]);

    await ensureExpenseColumnLabels();

    expect(urls(calls)[1]).toContain('Sheet1!H2:H2');
    expect(bodyOf(calls[1]).values).toEqual([['Added']]);
  });

  it('writes only the first label when the second is the one already taken', async () => {
    const calls = mockFetchStatuses([{ body: { values: [['', 'Entered']] } }, { body: {} }]);

    await ensureExpenseColumnLabels();

    expect(urls(calls)[1]).toContain('Sheet1!G2:G2');
    expect(bodyOf(calls[1]).values).toEqual([['Recurring']]);
  });

  it('writes nothing at all when both are already there', async () => {
    const calls = mockFetchStatuses([{ body: { values: [['Recurring', 'Added']] } }]);
    await ensureExpenseColumnLabels();
    expect(calls).toHaveLength(1);
  });
});
