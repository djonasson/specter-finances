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
import { mockFetchQueue, mockFetchQueue as mockFetchStatuses, urls, bodyOf } from '../test-fetch';
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
  fetchSpreadsheetTitle,
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
  columnLetter,
} from './sheets';
import type { RecurringRow } from '../types/recurring';
import type { PendingExpense } from './recurring';
import { pendingRecurring } from './recurring';

const SPREADSHEET_ID = 'test-sheet-id';

// The fake `fetch` itself lives in test-fetch.ts, shared with the other suites
// that talk to Google — what `ok` and `status` mean there decides whether the
// app keeps the user's grant, and that judgement belongs in one place.
//
// These two adapt it to how this file has always been written: most tests here
// care only about the body, and only a handful about the status.

/** Queue of response bodies, one per fetch call, in order. */
function mockFetch(responses: unknown[]) {
  return mockFetchQueue(responses.map((body) => ({ body })));
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
    expect(decodeURIComponent(calls[0].url)).toContain('Sheet1!A1:J');
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
      notCountedA: '',
      notCountedB: '',
      item: 'Bread',
      category: 'Food',
      notes: '',
    });
    const body = bodyOf(calls[0]) as { data: { range: string }[] };
    expect(body.data.map((d) => d.range)).toEqual(['Sheet1!A5:F5', 'Sheet1!I5:J5']);
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
  it('numbers recurring rows from sheet row 2 and reads through column L', async () => {
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
    expect(urls(calls)[0]).toContain('Recurring!A2:L');
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
      { status: 400, body: { error: { message: 'Unable to parse range: Recurring!A2:L' } } },
      { body: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] } },
    ]);

    await expect(fetchRecurring()).resolves.toEqual({ rules: [], tabMissing: true });
    expect(urls(calls)[1]).toContain('fields=sheets.properties');
  });

  it('stops re-asking whether the tab exists on every load', async () => {
    // Every navigation reloads every domain. Without this, a sheet that has not
    // opted in pays a doomed read AND a metadata lookup, on every single one.
    const first = mockFetchStatuses([
      { status: 400, body: { error: { message: 'Unable to parse range: Recurring!A2:L' } } },
      { body: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] } },
    ]);
    await expect(fetchRecurring()).resolves.toEqual({ rules: [], tabMissing: true });
    expect(first).toHaveLength(2);

    const second = mockFetchStatuses([
      { status: 400, body: { error: { message: 'Unable to parse range: Recurring!A2:L' } } },
    ]);
    await expect(fetchRecurring()).resolves.toEqual({ rules: [], tabMissing: true });
    expect(second).toHaveLength(1); // the classification is not re-derived
  });

  it('does not carry what it learned about one spreadsheet over to another', async () => {
    // A dropped grant sends the user back to the picker without the module ever
    // unloading, and the sheet they pick next owes the first one nothing.
    mockFetchStatuses([
      { status: 400, body: { error: { message: 'Unable to parse range: Recurring!A2:L' } } },
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
    expect(urls(calls)[2]).toContain('Recurring!A1:L1');
    expect(bodyOf(calls[2]).values).toEqual([
      [
        'Start',
        'Amount (A)',
        'Amount (B)',
        'Item',
        'Category',
        'Notes',
        'Day',
        'Id',
        'Not counted (A)',
        'Not counted (B)',
        'Every (months)',
        'Amount varies',
      ],
    ]);
  });

  it('creates nothing when the tab already exists', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      {
        body: {
          values: [['Not counted (A)', 'Not counted (B)', 'Every (months)', 'Amount varies']],
        },
      },
      { body: { values: [['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)']] } },
    ]);

    await ensureRecurringSetup();

    // The tab lookup and the two label checks, and no writes of any kind.
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => (c.options.method ?? 'GET') === 'GET')).toBe(true);
  });

  // A tab created before the not-counted columns existed keeps an eight-cell
  // header while the app writes ten, leaving two columns of money unlabelled.
  it('labels the recurring columns added after the tab was created', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      { body: {} }, // I1:J1 blank
      { body: {} },
      { body: { values: [['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)']] } },
    ]);

    await ensureRecurringSetup();

    const data = (bodyOf(calls[2]) as { data: { range: string; values: string[][] }[] }).data;
    expect(data.map((d) => d.range)).toEqual([
      'Recurring!I1:I1',
      'Recurring!J1:J1',
      'Recurring!K1:K1',
      'Recurring!L1:L1',
    ]);
    expect(data.map((d) => d.values[0][0])).toEqual([
      'Not counted (A)',
      'Not counted (B)',
      'Every (months)',
      'Amount varies',
    ]);
  });

  it('labels the expense columns even when the tab is already there', async () => {
    // The labelling used to sit behind the early return, so the only sheets that
    // ever got a heading over column H were the ones set up from scratch — while
    // every added expense writes that column regardless.
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      {
        body: {
          values: [['Not counted (A)', 'Not counted (B)', 'Every (months)', 'Amount varies']],
        },
      },
      { body: {} }, // expense labels blank
      { body: {} },
    ]);

    await ensureRecurringSetup();

    // The Recurring labels are already in place, so its read makes no write.
    expect(urls(calls)[2]).toContain('Sheet1!G2:J2');
    const written = (bodyOf(calls[3]) as { data: { range: string }[] }).data;
    expect(written).toHaveLength(4);
  });

  it('asks the spreadsheet only once per session whether the tab exists', async () => {
    const first = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      {
        body: {
          values: [['Not counted (A)', 'Not counted (B)', 'Every (months)', 'Amount varies']],
        },
      },
      { body: { values: [['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)']] } },
    ]);
    await ensureRecurringSetup();
    expect(first).toHaveLength(3);

    const second = mockFetchStatuses([
      {
        body: {
          values: [['Not counted (A)', 'Not counted (B)', 'Every (months)', 'Amount varies']],
        },
      },
      { body: { values: [['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)']] } },
    ]);
    await ensureRecurringSetup();
    // Only the label checks — the tab lookup is not repeated.
    expect(second).toHaveLength(2);
    expect(urls(second)[1]).toContain('Sheet1!G2:J2');
  });
});

describe('writing recurring rules', () => {
  it('gives a new rule an id, so what it generates can be traced back', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      {
        body: {
          values: [['Not counted (A)', 'Not counted (B)', 'Every (months)', 'Amount varies']],
        },
      },
      { body: { values: [['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)']] } }, // labels already in place
      { body: {} },
    ]);

    await addRecurring({
      start: '2026-01-10',
      amountA: '12.99',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      item: 'Phone',
      category: 'Various',
      notes: '',
      day: 10,
      everyMonths: 1,
      amountVaries: false,
    });

    const row = (bodyOf(calls[3]).values as string[][])[0];
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
        notCountedA: '',
        notCountedB: '',
        item: 'Phone',
        category: 'Various',
        notes: '',
        day: 10,
        everyMonths: 1,
        amountVaries: false,
      },
      'r1',
    );

    expect(calls).toHaveLength(1);
    expect(urls(calls)[0]).toContain('Recurring!A4:L4');
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
      amountVaries: false,
      date: '2026-02-10',
      amountA: '€12.99',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      item: 'Phone',
      category: 'Various',
      notes: '',
    },
    {
      ruleId: 'r1',
      month: '2026-03',
      marker: 'rec:r1:2026-03',
      amountVaries: false,
      date: '2026-03-10',
      amountA: '€12.99',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
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

  it('editing an expense skips over the columns it does not own', async () => {
    // Two ranges in one request, deliberately: G holds the recurring provenance
    // and H the day the row was added, and a PUT spanning them would blank both
    // — the month would read as never generated and be written a second time.
    const calls = mockFetchStatuses([{ body: {} }]);

    await updateExpense(5 as ExpenseRow, {
      date: '2026-02-10',
      amountA: '14.00',
      amountB: '',
      notCountedA: '4.00',
      notCountedB: '',
      item: 'Phone',
      category: 'Various',
      notes: 'price went up',
    });

    expect(calls).toHaveLength(1);
    const body = bodyOf(calls[0]) as { data: { range: string; values: string[][] }[] };
    expect(body.data.map((d) => d.range)).toEqual(['Sheet1!A5:F5', 'Sheet1!I5:J5']);
    expect(body.data[0].values[0]).toHaveLength(6);
    expect(body.data[1].values[0]).toEqual(['€4.00', '']);
    // Neither G nor H appears in any range it writes.
    expect(body.data.some((d) => /G|H/.test(d.range.split('!')[1]))).toBe(false);
  });

  it('adding an expense by hand leaves the marker column empty', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await addExpense({
      date: '2026-02-10',
      amountA: '14.00',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
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
  it('reads the expenses through column J', async () => {
    const calls = mockFetchStatuses([{ body: { values: [] } }]);
    await fetchExpenses();
    expect(urls(calls)[0]).toContain('Sheet1!A1:J');
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
        notCountedA: '',
        notCountedB: '',
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
      notCountedA: '',
      notCountedB: '',
      item: 'Bread',
      category: 'Food',
      notes: '',
    });

    expect(urls(calls)[0]).toContain('Sheet1!A:J');
    const row = (bodyOf(calls[0]).values as string[][])[0];
    expect(row).toHaveLength(10);
    expect(row[6]).toBe(''); // hand-entered: no recurring marker
    expect(row[7]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row[7]).not.toBe(row[0]); // when it was typed, not when it was spent
    expect(row.slice(8)).toEqual(['', '']); // nothing set aside
  });

  it('stamps every caught-up recurring expense too, which is where it matters most', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await appendGeneratedExpenses([
      {
        ruleId: 'r1',
        month: '2026-02',
        marker: 'rec:r1:2026-02',
        amountVaries: false,
        date: '2026-02-10',
        amountA: '€12.99',
        amountB: '',
        notCountedA: '',
        notCountedB: '',
        item: 'Phone',
        category: 'Various',
        notes: '',
      },
    ]);

    expect(urls(calls)[0]).toContain('Sheet1!A:J');
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
      notCountedA: '',
      notCountedB: '',
      item: 'Phone',
      category: 'Various',
      notes: 'corrected',
    });

    const body = bodyOf(calls[0]) as { data: { range: string }[] };
    expect(body.data.map((d) => d.range)).toEqual(['Sheet1!A5:F5', 'Sheet1!I5:J5']);
  });

  it('labels every app-written column when they are blank', async () => {
    const calls = mockFetchStatuses([{ body: {} }, { body: {} }]);

    await ensureExpenseColumnLabels();

    expect(urls(calls)[0]).toContain('Sheet1!G2:J2');
    const data = (bodyOf(calls[1]) as { data: { range: string; values: string[][] }[] }).data;
    expect(data.map((d) => d.range)).toEqual([
      'Sheet1!G2:G2',
      'Sheet1!H2:H2',
      'Sheet1!I2:I2',
      'Sheet1!J2:J2',
    ]);
    expect(data.map((d) => d.values[0][0])).toEqual([
      'Recurring',
      'Added',
      'Not counted (A)',
      'Not counted (B)',
    ]);
  });

  // One entry per blank cell rather than one span: a span from the first blank
  // to the last would write over anything filled in between, which is the one
  // thing this must never do.
  it('leaves a label the user chose alone, even between two blanks', async () => {
    const calls = mockFetchStatuses([{ body: { values: [['', 'Mine', '', '']] } }, { body: {} }]);

    await ensureExpenseColumnLabels();

    const data = (bodyOf(calls[1]) as { data: { range: string }[] }).data;
    expect(data.map((d) => d.range)).toEqual(['Sheet1!G2:G2', 'Sheet1!I2:I2', 'Sheet1!J2:J2']);
    expect(data.some((d) => d.range.includes('H2'))).toBe(false);
  });

  it('writes nothing at all when every label is already there', async () => {
    const calls = mockFetchStatuses([
      { body: { values: [['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)']] } },
    ]);
    await ensureExpenseColumnLabels();
    expect(calls).toHaveLength(1);
  });
});

// ── The not-counted columns ──
//
// Columns I and J hold the part of each amount that was only for the person who
// paid it. They are the user's to edit, unlike G and H, so the update path has
// to reach them without reaching the two beside them.

describe('the not-counted columns', () => {
  it('reads a row written before the columns existed as nothing set aside', async () => {
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

    // The whole record: proof that widening the range to J changed nothing
    // about how an existing row reads.
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
        notCountedA: '',
        notCountedB: '',
      },
    ]);
  });

  it('reads what was set aside', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [
            [
              'Date',
              'Ada',
              'Bo',
              'Item',
              'Category',
              'Notes',
              'Recurring',
              'Added',
              'NC A',
              'NC B',
            ],
            ['', 'Ada', 'Bo', '', '', '', '', '', '', ''],
            ['2026-01-01', 100, '', 'Shop', 'Food', '', '', '2026-01-01', 10, ''],
          ],
        },
      },
    ]);
    const { expenses } = await fetchExpenses();
    expect(expenses[0]).toMatchObject({
      amountA: '€100.00',
      notCountedA: '€10.00',
      notCountedB: '',
    });
  });

  it('writes what was set aside on a new expense', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await addExpense({
      date: '2026-01-05',
      amountA: '100',
      amountB: '',
      notCountedA: '10',
      notCountedB: '',
      item: 'Shop',
      category: 'Food',
      notes: '',
    });

    const row = (bodyOf(calls[0]).values as string[][])[0];
    expect(row.slice(8)).toEqual(['€10.00', '']);
  });

  it('carries a rule’s share through to every expense it creates', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await appendGeneratedExpenses([
      {
        ruleId: 'r1',
        month: '2026-02',
        marker: 'rec:r1:2026-02',
        amountVaries: false,
        date: '2026-02-10',
        amountA: '€30.00',
        amountB: '',
        notCountedA: '€12.00',
        notCountedB: '',
        item: 'Phone',
        category: 'Various',
        notes: '',
      },
    ]);

    const row = (bodyOf(calls[0]).values as string[][])[0];
    expect(row).toHaveLength(10);
    expect(row.slice(8)).toEqual(['€12.00', '']);
  });

  it('keeps a rule’s share on the Recurring tab', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      {
        body: {
          values: [['Not counted (A)', 'Not counted (B)', 'Every (months)', 'Amount varies']],
        },
      },
      { body: { values: [['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)']] } },
      { body: {} },
    ]);

    await addRecurring({
      start: '2026-01-10',
      amountA: '30',
      amountB: '',
      notCountedA: '12',
      notCountedB: '',
      item: 'Phone',
      category: 'Various',
      notes: '',
      day: 10,
      everyMonths: 1,
      amountVaries: false,
    });

    const row = (bodyOf(calls[3]).values as string[][])[0];
    expect(row.slice(8, 10)).toEqual(['€12.00', '']);
  });

  it('reads a rule’s share back off the Recurring tab', async () => {
    mockFetchStatuses([
      {
        body: { values: [['2026-01-10', 30, '', 'Phone', 'Various', '', 10, 'r1', 12, '']] },
      },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0]).toMatchObject({ notCountedA: '€12.00', notCountedB: '' });
  });

  it('reads a rule written before the columns existed as nothing set aside', async () => {
    mockFetchStatuses([
      { body: { values: [['2026-01-10', 30, '', 'Phone', 'Various', '', 10, 'r1']] } },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0]).toMatchObject({ notCountedA: '', notCountedB: '' });
  });
});

// ── How often, and whether the amount is knowable ──
//
// Columns K and L. Blank in either reads as the behaviour rules had before they
// existed — monthly, with a fixed amount — so adding them moves nothing.

describe('the interval and varying-amount columns', () => {
  it('reads a rule written before the columns existed as a fixed monthly one', async () => {
    mockFetchStatuses([
      { body: { values: [['2026-01-10', 30, '', 'Phone', 'Various', '', 10, 'r1']] } },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0]).toMatchObject({ everyMonths: 1, amountVaries: false });
  });

  it('reads an interval and a varying amount back', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [['2026-01-10', '', '', 'Water', 'Home', '', 10, 'r1', '', '', 2, 'yes']],
        },
      },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0]).toMatchObject({ everyMonths: 2, amountVaries: true, item: 'Water' });
  });

  it('holds a hand-typed interval inside what the app can honour', async () => {
    mockFetchStatuses([
      { body: { values: [['2026-01-10', 30, '', 'Phone', 'Various', '', 10, 'r1', '', '', 99]] } },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0].everyMonths).toBe(12);
  });

  it('reads anything but yes as a fixed amount, so a stray note cannot blank a rule', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [['2026-01-10', 30, '', 'Phone', 'Various', '', 10, 'r1', '', '', 1, 'maybe']],
        },
      },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0].amountVaries).toBe(false);
  });

  // The form clears the fields when the box is ticked, but the form is not the
  // only way in: a hand-edited sheet can hold "yes" beside a leftover figure,
  // and the list would then show an amount next to the badge saying nobody
  // knows it. Settled once, here, so every screen agrees.
  it('reads a varying rule as holding no amount, whatever the cells say', async () => {
    mockFetchStatuses([
      {
        body: {
          values: [['2026-01-10', 30, 5, 'Water', 'Home', '', 10, 'r1', 3, 1, 2, 'yes']],
        },
      },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0]).toMatchObject({
      amountVaries: true,
      amountA: '',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      item: 'Water',
    });
  });

  it('leaves a fixed rule’s amounts exactly as the sheet holds them', async () => {
    mockFetchStatuses([
      {
        body: { values: [['2026-01-10', 30, 5, 'Phone', 'Various', '', 10, 'r1', 3, 1, 1, '']] },
      },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules[0]).toMatchObject({
      amountVaries: false,
      amountA: '€30.00',
      amountB: '€5.00',
      notCountedA: '€3.00',
      notCountedB: '€1.00',
    });
  });

  it('keeps a varying rule that carries nothing else, so it stays fixable', async () => {
    // Its amounts are blanked on the way in, so without counting the varying
    // flag as data the row would vanish from the app while still sitting on the
    // sheet — invisible, and so impossible to correct or delete from here.
    mockFetchStatuses([
      { body: { values: [['', 30, '', '', '', '', '', 'r1', '', '', 2, 'yes']] } },
    ]);
    const { rules } = await fetchRecurring();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ amountVaries: true, amountA: '', rowIndex: 2 });
  });

  it('still drops a row with nothing on it at all', async () => {
    mockFetchStatuses([{ body: { values: [[], ['2026-01-10', 30, '', 'Phone']] } }]);
    const { rules } = await fetchRecurring();
    expect(rules.map((r) => r.rowIndex)).toEqual([3]);
  });

  it('writes both columns when a rule is added', async () => {
    const calls = mockFetchStatuses([
      { body: { sheets: [{ properties: { title: 'Recurring', sheetId: 7 } }] } },
      {
        body: {
          values: [['Not counted (A)', 'Not counted (B)', 'Every (months)', 'Amount varies']],
        },
      },
      { body: { values: [['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)']] } },
      { body: {} },
    ]);

    await addRecurring({
      start: '2026-01-10',
      amountA: '',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      item: 'Water',
      category: 'Home',
      notes: '',
      day: 10,
      everyMonths: 2,
      amountVaries: true,
    });

    const row = (bodyOf(calls[3]).values as string[][])[0];
    expect(row).toHaveLength(12);
    expect(row.slice(10)).toEqual(['2', 'yes']);
  });

  it('leaves column L empty for a payment whose amount is fixed', async () => {
    const calls = mockFetchStatuses([{ body: {} }]);

    await updateRecurring(
      4 as RecurringRow,
      {
        start: '2026-01-10',
        amountA: '30',
        amountB: '',
        notCountedA: '',
        notCountedB: '',
        item: 'Phone',
        category: 'Various',
        notes: '',
        day: 10,
        everyMonths: 1,
        amountVaries: false,
      },
      'r1',
    );

    const row = (bodyOf(calls[0]).values as string[][])[0];
    expect(row.slice(10)).toEqual(['1', '']);
    expect(urls(calls)[0]).toContain('Recurring!A4:L4');
  });
});

// ── The varying-amount invariant, end to end ──
//
// "A payment whose amount varies holds none" is established in fetchRecurring
// and relied on by pendingRecurring, and nothing tested the two halves
// together. That gap is exactly wide enough for one of them to stop holding up
// its end without a single test going red.

describe('a varying rule from the sheet through to a pending expense', () => {
  it('reaches the confirmation with no amount, even when the sheet holds one', async () => {
    mockFetchStatuses([
      {
        body: {
          // Hand-edited: "yes" in L beside a leftover figure in B.
          values: [['2026-01-10', 30, '', 'Water', 'Home', '', 10, 'r1', 4, '', 2, 'yes']],
        },
      },
    ]);

    const { rules } = await fetchRecurring();
    const pending = pendingRecurring(rules, [], '2026-01-31');

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      item: 'Water',
      date: '2026-01-10',
      amountA: '',
      amountB: '',
      notCountedA: '',
      notCountedB: '',
      amountVaries: true,
    });
  });

  it('carries a fixed rule’s amount all the way through, unchanged', async () => {
    mockFetchStatuses([
      {
        body: { values: [['2026-01-10', 30, '', 'Phone', 'Various', '', 10, 'r1', 4, '', 1, '']] },
      },
    ]);

    const { rules } = await fetchRecurring();
    const pending = pendingRecurring(rules, [], '2026-01-31');

    expect(pending[0]).toMatchObject({
      amountA: '€30.00',
      notCountedA: '€4.00',
      amountVaries: false,
    });
  });
});

// ── Column names ──
//
// The letters are derived so a label list can grow without a parallel array
// being kept in step by hand — which only holds if the derivation itself keeps
// going past Z.

describe('columnLetter', () => {
  it('names the columns the app actually uses', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(6)).toBe('G');
    expect(columnLetter(11)).toBe('L');
  });

  it('carries past Z instead of running off the alphabet', () => {
    // String.fromCharCode(65 + 26) is '[', which would build a range the API
    // rejects — and label writing happens while adding a recurring payment.
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(27)).toBe('AB');
    expect(columnLetter(51)).toBe('AZ');
    expect(columnLetter(52)).toBe('BA');
    expect(columnLetter(701)).toBe('ZZ');
    expect(columnLetter(702)).toBe('AAA');
  });

  it('never produces anything but letters', () => {
    for (let i = 0; i < 800; i++) expect(columnLetter(i)).toMatch(/^[A-Z]+$/);
  });
});

// ── The requests the auth handling was lifted out of ──

// `authorizedFetch` was extracted from `sheetsRequest` so a binary Drive export
// could inherit the token refresh and the grant handling. Everything above is
// the bulk of the proof that it moved nothing; these pin the two things the
// extraction could have dropped without any of it going red — the JSON content
// type, which the shared helper deliberately no longer adds, and the API the
// requests are aimed at.

describe('what a Sheets request still sends after the auth handling moved out of it', () => {
  it('still declares a JSON body, on the calls that read as well as those that write', async () => {
    // The shared helper deliberately adds no Content-Type — a request answering
    // with a file must not claim one — so `sheetsRequest` passing it is now the
    // only thing keeping these identical to what they were.
    const reads = mockFetch([{ values: [] }]);
    await fetchExpenses();

    const writes = mockFetch([{}]);
    await addTransfer({ date: '2026-08-18', amount: '10', from: 'A', notes: '' });

    for (const call of [reads[0], writes[0]]) {
      expect(call.options.headers).toMatchObject({
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      });
    }
  });

  it('still aims at the Sheets API and not at the Drive one', async () => {
    const calls = mockFetch([{ values: [] }]);

    await fetchExpenses();

    expect(calls[0].url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/')).toBe(true);
  });

  it('repeats the whole request, body and method included, when it retries after a refresh', async () => {
    // The retry used to be a second copy of the same fetch call written out
    // longhand. Now one closure serves both, so a write that lost its body on
    // the way through would silently append an empty row.
    const calls = mockFetchStatuses([{ status: 401 }, {}]);

    await addTransfer({ date: '2026-08-18', amount: '10', from: 'A', notes: '' });

    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe(calls[0].url);
    expect(calls[1].options.method).toBe(calls[0].options.method);
    expect(calls[1].options.body).toBe(calls[0].options.body);
  });
});

// ── The spreadsheet id in the request path ──

// The id is not a literal in this codebase: it is picked once and read back out
// of localStorage on every later launch, so by the time a request is built it is
// stored text. Interpolated raw, a stored `a/b` addresses spreadsheet `a` with
// `b` grafted onto the front of the path — a different sheet, or a different
// operation, than the one the caller asked for. `sheetsRequest` owns that
// segment so no caller can get it wrong; this pins that it stays that way.

describe('addressing the granted spreadsheet', () => {
  const HOSTILE = 'a/b';
  const ENCODED = 'a%2Fb';

  const expense = {
    date: '2026-02-01',
    amountA: '10',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Bread',
    category: 'Food' as const,
    notes: '',
  };

  const rule = {
    start: '2026-01-10',
    amountA: '12.99',
    amountB: '',
    notCountedA: '',
    notCountedB: '',
    item: 'Phone',
    category: 'Various' as const,
    notes: '',
    day: 10,
    everyMonths: 1,
    amountVaries: false,
  };

  const movement = { date: '2026-02-01', from: 'A' as const, amount: '50', notes: '' };

  // One entry per shape of path this module builds — a plain read, an append, a
  // range update, both flavours of batchUpdate, and the two metadata reads.
  const operations: [string, () => Promise<unknown>][] = [
    ['fetchExpenses', () => fetchExpenses()],
    ['fetchTransfers', () => fetchTransfers()],
    ['fetchGifts', () => fetchGifts()],
    ['fetchRecurring', () => fetchRecurring()],
    ['fetchSpreadsheetTitle', () => fetchSpreadsheetTitle()],
    ['addExpense', () => addExpense(expense)],
    ['updateExpense', () => updateExpense(5 as ExpenseRow, expense)],
    ['deleteExpense', () => deleteExpense(5 as ExpenseRow)],
    ['addTransfer', () => addTransfer(movement)],
    ['updateTransfer', () => updateTransfer(9 as TransferRow, movement)],
    ['deleteTransfer', () => deleteTransfer(9 as TransferRow)],
    ['addGift', () => addGift({ ...movement, giftKind: 'present' })],
    ['updateGift', () => updateGift(9 as GiftRow, { ...movement, giftKind: 'present' })],
    ['addRecurring', () => addRecurring(rule)],
    ['updateRecurring', () => updateRecurring(4 as RecurringRow, rule, 'r1')],
    ['assignRecurringId', () => assignRecurringId(3 as RecurringRow)],
    ['deleteRecurring', () => deleteRecurring(3 as RecurringRow)],
    ['ensureRecurringSetup', () => ensureRecurringSetup()],
    ['ensureExpenseColumnLabels', () => ensureExpenseColumnLabels()],
    [
      'appendGeneratedExpenses',
      () =>
        appendGeneratedExpenses([
          { ...expense, recurringMarker: 'rec:r1:2026-02' } as unknown as PendingExpense,
        ]),
    ],
  ];

  it.each(operations)('keeps a stored id inside its own path segment: %s', async (_name, run) => {
    clearGrantedSheetId();
    setGrantedSheetId(HOSTILE);
    // Enough queued answers for the multi-request operations, shaped so none of
    // them takes an early return before reaching the network.
    const calls = mockFetchStatuses(
      Array.from({ length: 8 }, () => ({
        body: { values: [[]], sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] },
      })),
    );

    await run().catch(() => {});

    expect(calls.length).toBeGreaterThan(0);
    for (const { url } of calls) {
      expect(url).toContain(`/spreadsheets/${ENCODED}`);
      // The raw form would mean a path built out of the stored value.
      expect(url).not.toContain(`/spreadsheets/${HOSTILE}`);
    }
  });

  // The Drive diagnostic runs inside the 403/404 branch and so never goes
  // through sheetsRequest — the one call left addressing the file itself, and
  // the one no other test here reaches.
  it('keeps a stored id inside its own path segment when asking Drive what went wrong', async () => {
    clearGrantedSheetId();
    setGrantedSheetId(HOSTILE);
    const calls = mockFetchStatuses([
      { status: 404, body: { error: { message: 'Not found' } } },
      { body: { mimeType: 'application/vnd.google-apps.spreadsheet', name: 'A sheet' } },
    ]);

    await expect(fetchExpenses()).rejects.toThrow();

    const drive = calls.find((c) => c.url.includes('/drive/v3/files/'));
    expect(drive).toBeDefined();
    expect(drive!.url).toContain(`/drive/v3/files/${ENCODED}?`);
    expect(drive!.url).not.toContain(`/drive/v3/files/${HOSTILE}`);
  });
});
