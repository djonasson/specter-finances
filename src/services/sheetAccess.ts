const GRANTED_KEY = 'sf_granted_sheet';

let listener: ((sheetId: string | null, reason?: string) => void) | null = null;

/**
 * Which spreadsheet this app has been granted access to.
 *
 * With the `drive.file` scope the token authorises individual files rather than
 * the whole account, and the grant is created when the user picks the file. So
 * the picked id is the app's target sheet — remembered here rather than baked
 * into the build.
 */
export function getGrantedSheetId(): string | null {
  return localStorage.getItem(GRANTED_KEY);
}

export function setGrantedSheetId(sheetId: string) {
  localStorage.setItem(GRANTED_KEY, sheetId);
  listener?.(sheetId);
}

/**
 * Called when the API says we can no longer reach the sheet, so we re-prompt.
 * The reason travels with it — bouncing back to the picker with no explanation
 * leaves the user re-picking the same sheet forever.
 */
export function clearGrantedSheetId(reason?: string) {
  localStorage.removeItem(GRANTED_KEY);
  listener?.(null, reason);
}

export function setSheetAccessListener(
  cb: ((sheetId: string | null, reason?: string) => void) | null,
) {
  listener = cb;
}

export class SheetAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetAccessError';
  }
}
