import { exportSpreadsheet, fetchSpreadsheetTitle } from './sheets';

/**
 * Turning the spreadsheet into a file the user keeps.
 *
 * The sheet is the only record of who owes whom — there is no backend behind it
 * and no undo — so a copy that lives somewhere else is the only way back from a
 * bad edit, a revoked grant or a deleted file. What is downloaded is the whole
 * workbook, every tab, in a format Drive will take back: re-uploading it
 * restores the sheet rather than merely describing it.
 */

/** Used when the spreadsheet's own name is unreadable or unusable. */
const FALLBACK_NAME = 'spreadsheet';

/** Long enough for any real sheet name, short enough that no file system balks. */
const MAX_TITLE_LENGTH = 80;

/**
 * What to call the downloaded file.
 *
 * Named after the spreadsheet, so a folder of backups says which sheet each one
 * came from, and dated, so today's does not overwrite last month's — having more
 * than one is the whole point of keeping them.
 *
 * The title is text a person typed into Google Sheets, and it is about to become
 * a file name: it is sanitised, never trusted. A slash makes a path, a colon
 * breaks Windows, a control character breaks the download outright, and a
 * leading dot hides the file from the person who just asked for it. Separators
 * go first so that a title like `../../etc` collapses to `etc` instead of
 * surviving as `..`.
 */
export function backupFileName(spreadsheetTitle: string, todayIso: string): string {
  const sanitised = spreadsheetTitle
    .normalize('NFC')
    // Separators and control characters together, and before the leading strip
    // below, so that `../../etc` collapses to `etc` rather than surviving as `..`.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '');

  const cleaned = [...sanitised]
    // Spread first: `slice` on the string counts UTF-16 units and would halve an
    // emoji, leaving a lone surrogate in the file name.
    .slice(0, MAX_TITLE_LENGTH)
    .join('')
    // After the cut, so that a title trimmed mid-word cannot end in the dot or
    // space the cut exposed.
    .replace(/[.\s]+$/, '');

  return `${cleaned || FALLBACK_NAME}-${todayIso}.xlsx`;
}

/**
 * Hand a blob to the browser as a download.
 *
 * The URL is revoked, because an object URL keeps its blob alive for as long as
 * the document lives, this one is an entire workbook, and the document in
 * question is a PWA that stays open for days.
 *
 * But revoked on a *later* task, not in the click's own. Chromium starts the
 * download during `click()`, so revoking straight after it returns is safe
 * there; Firefox and WebKit have both torn the blob down before the download
 * read it, saving nothing while the button reported success. That silent
 * half-failure is the exact thing this button exists to avoid, so it waits.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    // Both on the way out, however it goes. The link only ever went into the
    // page to be clicked, and a click that throws — an extension, a policy, a
    // browser that refuses a synthetic one — used to leave it there: one stray
    // anchor per press of the backup button, accumulating for the life of the
    // tab. The revoke is deferred a task because Chromium starts the download
    // during `click()` and Firefox and WebKit have both torn the blob down
    // first when it was revoked in the same one.
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Download the whole spreadsheet as a dated .xlsx file, and say what it was called. */
export async function backupSpreadsheet(todayIso: string): Promise<string> {
  // The bytes first, the name second. A failure to export is the one worth
  // reporting; asking for the title first would report the naming problem
  // instead of the one that actually stopped the download.
  const blob = await exportSpreadsheet();
  const filename = backupFileName(await titleOrNothing(), todayIso);
  downloadBlob(blob, filename);
  return filename;
}

/**
 * The spreadsheet's name, or nothing at all.
 *
 * The bytes are already in hand by the time this runs, and a backup that worked
 * must not be thrown away because the name could not be read — a worse filename
 * is not a failed backup.
 */
async function titleOrNothing(): Promise<string> {
  try {
    return await fetchSpreadsheetTitle();
  } catch {
    return '';
  }
}
