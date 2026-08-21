// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { backupFileName, downloadBlob, backupSpreadsheet } from './backup';
import { setGrantedSheetId, clearGrantedSheetId, getGrantedSheetId } from './sheetAccess';
import { mockFetchQueue as mockFetch, urls } from '../test-fetch';

vi.mock('./auth', () => ({
  getAccessToken: () => 'test-token',
  refreshToken: async () => 'refreshed-token',
}));

const SPREADSHEET_ID = 'picked-sheet-id';

/** The export is the first request; the title lookup follows it. */
const exportOk = (blob: Blob) => ({ blob });
const titleOf = (title: string) => ({ body: { properties: { title } } });

let clicked: HTMLAnchorElement[] = [];

beforeEach(() => {
  setGrantedSheetId(SPREADSHEET_ID);
  clicked = [];
  // jsdom implements Blob but neither of these, so there is nothing to spy on —
  // they have to be assigned.
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
  // Stops jsdom logging "navigation not implemented" on every download, and
  // captures the anchor so what it carried can be asserted.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
});

afterEach(() => {
  clearGrantedSheetId();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The sheet is the couple's only record of who owes whom and nothing else holds
// a copy, so a backup that silently downloads the wrong thing — one tab, a
// parsed summary, an empty file — is worse than no backup button at all: it
// looks like the record is safe when it is not.

describe('naming the backup', () => {
  it('names the backup after the spreadsheet and the day it was taken', () => {
    expect(backupFileName('Household 2026', '2026-08-18')).toBe('Household 2026-2026-08-18.xlsx');
  });

  it('strips the characters a file system will refuse from the sheet title', () => {
    expect(backupFileName('Home: money *2026*', '2026-08-18')).toBe(
      'Home money 2026-2026-08-18.xlsx',
    );
  });

  it('does not let a title containing slashes name a file outside the download folder', () => {
    expect(backupFileName('../../etc/passwd', '2026-08-18')).toBe('etc passwd-2026-08-18.xlsx');
  });

  it('does not turn a title starting with a dot into a hidden file', () => {
    expect(backupFileName('.hidden', '2026-08-18')).toBe('hidden-2026-08-18.xlsx');
  });

  it('drops control characters rather than writing them into a file name', () => {
    expect(backupFileName('Home\u0007 money', '2026-08-18')).toBe('Home money-2026-08-18.xlsx');
  });

  it('falls back to a readable name when the spreadsheet has no title', () => {
    expect(backupFileName('', '2026-08-18')).toBe('spreadsheet-2026-08-18.xlsx');
  });

  it('falls back to a readable name when the title is only characters it had to strip', () => {
    expect(backupFileName('///...', '2026-08-18')).toBe('spreadsheet-2026-08-18.xlsx');
  });

  it('shortens a very long title rather than producing a name the file system refuses', () => {
    const name = backupFileName('x'.repeat(300), '2026-08-18');
    expect(name.length).toBeLessThan(120);
    expect(name.endsWith('-2026-08-18.xlsx')).toBe(true);
  });

  it('cuts a long title between characters, never through one', () => {
    // `slice` counts UTF-16 units. The leading 'x' makes 80 of those land in the
    // middle of an emoji rather than neatly between two, leaving a lone
    // surrogate at the end of the file name.
    const name = backupFileName(`x${'\u{1F355}'.repeat(60)}`, '2026-08-18');
    expect(name).toBe(name.normalize('NFC'));
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(name)).toBe(false);
    expect(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(name)).toBe(false);
  });

  it('never ends the shortened title in the dot or space the cut exposed', () => {
    expect(backupFileName(`${'x'.repeat(79)}. tail`, '2026-08-18')).toBe(
      `${'x'.repeat(79)}-2026-08-18.xlsx`,
    );
  });
});

describe('exporting the spreadsheet', () => {
  it('asks Drive to convert the whole workbook rather than reading one tab', async () => {
    const calls = mockFetch([exportOk(new Blob(['xlsx'])), titleOf('Household')]);

    await backupSpreadsheet('2026-08-18');

    const url = urls(calls)[0];
    expect(url).toContain(`drive/v3/files/${SPREADSHEET_ID}/export`);
    expect(url).toContain(
      'mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    // A range or a gid would mean one tab, which is not a backup of the sheet.
    expect(url).not.toContain('gid=');
    expect(url).not.toContain('!A');
  });

  it('sends the token in the header and never in the URL', async () => {
    const calls = mockFetch([exportOk(new Blob(['xlsx'])), titleOf('Household')]);

    await backupSpreadsheet('2026-08-18');

    expect(calls[0].options.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    expect(calls[0].url).not.toContain('access_token');
  });

  it('does not claim a JSON body on a request that answers with a file', async () => {
    const calls = mockFetch([exportOk(new Blob(['xlsx'])), titleOf('Household')]);

    await backupSpreadsheet('2026-08-18');

    expect(calls[0].options.headers).not.toHaveProperty('Content-Type');
  });

  it('names the download after the spreadsheet rather than after its id', async () => {
    mockFetch([exportOk(new Blob(['xlsx'])), titleOf('Household 2026')]);

    const filename = await backupSpreadsheet('2026-08-18');

    expect(filename).toBe('Household 2026-2026-08-18.xlsx');
  });

  it('still downloads the backup when the spreadsheet title cannot be read', async () => {
    mockFetch([exportOk(new Blob(['xlsx'])), { status: 500, body: {} }]);

    // The bytes are the backup; a name that had to fall back is not a failure.
    expect(await backupSpreadsheet('2026-08-18')).toBe('spreadsheet-2026-08-18.xlsx');
    expect(clicked).toHaveLength(1);
  });

  it('hands over the bytes Drive sent rather than a parsed body', async () => {
    const sent = new Blob(['PK workbook']);
    mockFetch([exportOk(sent), titleOf('Household')]);

    await backupSpreadsheet('2026-08-18');

    expect(URL.createObjectURL).toHaveBeenCalledWith(sent);
  });

  it('refreshes an expired token instead of failing the backup', async () => {
    const calls = mockFetch([{ status: 401 }, exportOk(new Blob(['xlsx'])), titleOf('Household')]);

    await backupSpreadsheet('2026-08-18');

    expect(calls[0].options.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    expect(calls[1].options.headers).toMatchObject({ Authorization: 'Bearer refreshed-token' });
    expect(clicked).toHaveLength(1);
  });

  it('reports what Google said when the export fails', async () => {
    mockFetch([{ status: 500, body: { error: { message: 'Backend error' } } }]);

    await expect(backupSpreadsheet('2026-08-18')).rejects.toThrow('Backend error');
    expect(clicked).toHaveLength(0);
  });

  it('does not blame the Sheets API for a failure that came from Drive', async () => {
    mockFetch([{ status: 500, body: {} }]);

    await expect(backupSpreadsheet('2026-08-18')).rejects.toThrow('Drive export error: 500');
  });

  it('does not send the user back to the picker for a sheet that is only too big', async () => {
    // Drive refuses an over-size export with a 403, which otherwise reads as a
    // grant that is gone — and re-granting would not make the sheet smaller.
    mockFetch([
      {
        status: 403,
        body: {
          error: {
            message: 'This file is too large to be exported.',
            errors: [{ reason: 'exportSizeLimitExceeded' }],
          },
        },
      },
    ]);

    await expect(backupSpreadsheet('2026-08-18')).rejects.toThrow('too large to be exported');
    expect(getGrantedSheetId()).toBe(SPREADSHEET_ID);
  });

  it('does send the user back to the picker when access really has gone', async () => {
    mockFetch([{ status: 403, body: { error: { message: 'Permission denied' } } }, {}]);

    await expect(backupSpreadsheet('2026-08-18')).rejects.toThrow();
    expect(getGrantedSheetId()).toBeNull();
  });

  it('refuses to export before a spreadsheet has been picked', async () => {
    clearGrantedSheetId();
    const calls = mockFetch([]);

    await expect(backupSpreadsheet('2026-08-18')).rejects.toThrow('No spreadsheet selected');
    expect(calls).toHaveLength(0);
  });
});

describe('handing the file to the browser', () => {
  it('gives the download the name it was asked for', () => {
    downloadBlob(new Blob(['x']), 'Household-2026-08-18.xlsx');

    expect(clicked[0].download).toBe('Household-2026-08-18.xlsx');
  });

  it('points the download at the blob rather than at the spreadsheet online', () => {
    downloadBlob(new Blob(['x']), 'Household-2026-08-18.xlsx');

    expect(clicked[0].getAttribute('href')).toBe('blob:mock-url');
  });

  it('takes the link back out of the page once the download has started', () => {
    downloadBlob(new Blob(['x']), 'Household-2026-08-18.xlsx');

    expect(document.querySelector('a[download]')).toBeNull();
  });

  /** Lets the task the revoke was deferred to actually run. */
  const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('releases the object URL so the workbook is not held for the life of the tab', async () => {
    downloadBlob(new Blob(['x']), 'Household-2026-08-18.xlsx');
    await nextTask();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  // Chromium starts the download during click(); Firefox and WebKit have both
  // torn the blob down first when the URL was revoked in the same task, saving
  // nothing while the button reported success.
  it('does not pull the blob away in the same task the click ran in', () => {
    downloadBlob(new Blob(['x']), 'Household-2026-08-18.xlsx');

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('releases the object URL even when the click throws', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => downloadBlob(new Blob(['x']), 'x.xlsx')).toThrow('blocked');
    await nextTask();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

// The id is read back from localStorage, where it has outlived the pick that
// wrote it. Neither request should be able to build a path out of one.

describe('the spreadsheet id in the request path', () => {
  it('keeps a stored id inside its own path segment', async () => {
    clearGrantedSheetId();
    setGrantedSheetId('a/b?c#d');
    const calls = mockFetch([exportOk(new Blob(['xlsx'])), titleOf('')]);

    await backupSpreadsheet('2026-08-18');

    // The Drive export only: the Sheets side is pinned over every operation in
    // sheets.test.ts, and one owner per rule is enough.
    expect(calls[0].url).toContain('/files/a%2Fb%3Fc%23d/export');
  });
});
