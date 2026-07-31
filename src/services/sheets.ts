import { getAccessToken, refreshToken } from './auth';
import { getGrantedSheetId, clearGrantedSheetId, SheetAccessError } from './sheetAccess';
import { normalizeDate, normalizeAmount, formatAmount, parseAmount } from './parsing';
import type { Expense, ExpenseFormData, ExpenseRow } from '../types/expense';
import { toCategory } from '../types/expense';
import type { Transfer, TransferFormData, TransferRow } from '../types/transfer';
import type { Gift, GiftFormData, GiftRow } from '../types/gift';
import { toGiftKind } from '../types/gift';
import { DEFAULT_NAMES } from '../types/person';
import type { PersonNames } from '../types/person';

export { parseAmount };

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function getConfig() {
  // The granted sheet wins: with the drive.file scope the token only authorises
  // files the user picked, so a build-time id we were never granted is useless.
  // VITE_SPREADSHEET_ID remains as a hint for the picker screen.
  const spreadsheetId = getGrantedSheetId();
  const sheetName = import.meta.env.VITE_SHEET_NAME || 'Sheet1';
  if (!spreadsheetId) throw new SheetAccessError('No spreadsheet selected');
  return { spreadsheetId, sheetName };
}

async function sheetsRequest(path: string, options: RequestInit = {}) {
  let token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  // Captured up front: all three domains load in parallel, so by the time a
  // later response fails the first one may already have dropped the grant.
  const targetSheet = getGrantedSheetId() ?? 'unknown';

  let res = await fetch(`${SHEETS_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    token = await refreshToken();
    res = await fetch(`${SHEETS_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  if (res.status === 403 || res.status === 404) {
    // The grant is gone (sheet deleted, unshared, or access revoked). Drop it so
    // the app asks for the sheet again instead of failing on every request —
    // carrying the API's own wording, which is the only clue to *why*.
    const body = await res.json().catch(() => ({}));
    const detail = body.error?.message || `HTTP ${res.status}`;
    // Name the id, and ask Drive about the same file: "not found" alone cannot
    // distinguish a wrong file, a missing grant, or a grant Sheets refuses.
    const diagnosis = token
      ? await describeSheetAccess(targetSheet, token)
      : 'No token available for a Drive check.';
    const message = `Cannot reach spreadsheet ${targetSheet} (${detail}). ${diagnosis} Please choose it again.`;
    clearGrantedSheetId(message);
    throw new SheetAccessError(message);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets API error: ${res.status}`);
  }

  return res.json();
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

/**
 * Ask Drive about the file we just failed to read from Sheets.
 *
 * A Sheets 404 is ambiguous: no per-file grant, wrong file type, or a grant
 * that Sheets refuses anyway. Drive answers all three, and the distinction is
 * the difference between a config fix and an unusable approach.
 */
async function describeSheetAccess(sheetId: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `${DRIVE_API}/${sheetId}?fields=id,name,mimeType,shortcutDetails,capabilities/canReadRevisions`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (res.status === 404) {
      return 'Drive cannot see it either — no per-file grant was created by the picker.';
    }
    if (!res.ok) {
      return `Drive check returned HTTP ${res.status}.`;
    }

    const file = await res.json();
    if (file.mimeType === 'application/vnd.google-apps.shortcut') {
      return `That is a shortcut, not the sheet. Real file id: ${
        file.shortcutDetails?.targetId ?? 'unknown'
      }.`;
    }
    if (file.mimeType !== 'application/vnd.google-apps.spreadsheet') {
      return `That file is a ${file.mimeType}, not a spreadsheet.`;
    }
    return `Drive CAN see "${file.name}" with this token, so the grant exists but Sheets refused it.`;
  } catch {
    return 'Drive check could not be completed.';
  }
}

/**
 * Who the two amount columns belong to, taken from the header row.
 *
 * The names live in the spreadsheet, never in this codebase — so the app
 * carries nobody's identity and anyone pointing it at their own sheet sees
 * their own names. A blank header cell falls back to a generic label rather
 * than inventing one.
 */
export function readPersonNames(header: unknown[] | undefined): PersonNames {
  const cell = (i: number) => String(header?.[i] ?? '').trim();
  return {
    a: cell(1) || DEFAULT_NAMES.a,
    b: cell(2) || DEFAULT_NAMES.b,
  };
}

export interface ExpensesResult {
  expenses: Expense[];
  names: PersonNames;
}

/**
 * Fetch the expense rows and the two names in one request.
 *
 * The range starts at A1 rather than A3 so the header comes back with the
 * data: rows 1 and 2 are the header and sub-header, and data still starts at
 * sheet row 3.
 */
export async function fetchExpenses(): Promise<ExpensesResult> {
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A1:F`);
  const data = await sheetsRequest(
    `/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
  );

  const rows: unknown[][] = data.values || [];

  return {
    names: readPersonNames(rows[0]),
    expenses: rows.slice(2).map((row, i) => ({
      rowIndex: (i + 3) as ExpenseRow,
      date: normalizeDate(row[0]),
      amountA: normalizeAmount(row[1]),
      amountB: normalizeAmount(row[2]),
      item: String(row[3] || ''),
      category: toCategory(String(row[4] || '')),
      notes: String(row[5] || ''),
    })),
  };
}

/** Append a new expense row */
export async function addExpense(form: ExpenseFormData): Promise<void> {
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A:F`);
  const row = [
    form.date,
    formatAmount(form.amountA),
    formatAmount(form.amountB),
    form.item,
    form.category,
    form.notes,
  ];

  await sheetsRequest(`/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    body: JSON.stringify({ values: [row] }),
  });
}

/** Update an existing expense row */
export async function updateExpense(rowIndex: ExpenseRow, form: ExpenseFormData): Promise<void> {
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A${rowIndex}:F${rowIndex}`);
  const row = [
    form.date,
    formatAmount(form.amountA),
    formatAmount(form.amountB),
    form.item,
    form.category,
    form.notes,
  ];

  await sheetsRequest(`/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [row] }),
  });
}

/** Delete a row via batchUpdate deleteDimension */
async function deleteRow(sheetName: string, rowIndex: number): Promise<void> {
  const { spreadsheetId } = getConfig();

  const spreadsheet = await sheetsRequest(`/${spreadsheetId}?fields=sheets.properties`);
  const sheet = spreadsheet.sheets.find(
    (s: { properties: { title: string } }) => s.properties.title === sheetName,
  );
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheet.properties.sheetId;

  await sheetsRequest(`/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });
}

/** Delete an expense row */
export async function deleteExpense(rowIndex: ExpenseRow): Promise<void> {
  const { sheetName } = getConfig();
  await deleteRow(sheetName, rowIndex);
}

// ── Transfers & Gifts ──────────────────────────────────────
//
// The two are the same record shape stored in different tabs; only their sign
// in calculateBalance differs, and that lives in utils.ts. Everything below is
// therefore written once and instantiated twice — previously these were two
// copy-pasted blocks, and they had already drifted apart.

const TRANSFERS_SHEET = 'Transfers';
const GIFTS_SHEET = 'Gifts';

/** Direction is encoded by which amount column is left empty. */
function movementRow(form: TransferFormData | GiftFormData, extra: string[]): string[] {
  const amountA = form.from === 'A' ? formatAmount(form.amount) : '';
  const amountB = form.from === 'B' ? formatAmount(form.amount) : '';
  return [form.date, amountA, amountB, form.notes, ...extra];
}

/**
 * Drop rows that carry no data at all.
 *
 * Sheets only trims *trailing* blanks, so a row cleared in the middle of the
 * table still comes back as an empty array. Mapped naively, that becomes a
 * record with no amount in either column — which reads as a real
 * "B -> A" transfer, since direction is inferred from whichever
 * column is empty. Filter after mapping so rowIndex still matches the sheet.
 */
function isBlankRow(m: { date: string; amountA: string; amountB: string; notes: string }) {
  return !m.date && !m.amountA && !m.amountB && !m.notes;
}

/**
 * Columns past D, which only the Gifts tab has (E = kind).
 *
 * Parameterised rather than forked: the two tabs were one shared implementation
 * precisely because copies of this drift, and a gift-shaped clone would have to
 * repeat the range, blank-row and rowIndex handling to add a single column.
 */
interface MovementColumns<TRecord, TForm> {
  /** Last column of the tab's range, e.g. 'D' or 'E'. */
  lastCol: string;
  /** Fields read from the cells past D. */
  readExtra?: (row: unknown[]) => Partial<TRecord>;
  /** Cell values written past D, in column order. */
  writeExtra?: (form: TForm) => string[];
}

/** Build the CRUD set for one money-movement tab (data starts at row 2). */
function makeMovementCrud<
  TRecord,
  TRow extends number,
  TForm extends TransferFormData | GiftFormData,
>(sheetName: string, columns: MovementColumns<TRecord, TForm> = { lastCol: 'D' }) {
  const { lastCol, readExtra, writeExtra } = columns;

  return {
    async fetchAll(): Promise<TRecord[]> {
      const { spreadsheetId } = getConfig();
      const range = encodeURIComponent(`${sheetName}!A2:${lastCol}`);
      const data = await sheetsRequest(
        `/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
      );

      const rows: unknown[][] = data.values || [];
      return rows
        .map((row, i) => ({
          rowIndex: (i + 2) as TRow,
          date: normalizeDate(row[0]),
          amountA: normalizeAmount(row[1]),
          amountB: normalizeAmount(row[2]),
          notes: String(row[3] || ''),
          ...readExtra?.(row),
        }))
        .filter((m) => !isBlankRow(m)) as TRecord[];
    },

    async add(form: TForm): Promise<void> {
      const { spreadsheetId } = getConfig();
      const range = encodeURIComponent(`${sheetName}!A:${lastCol}`);
      await sheetsRequest(
        `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          body: JSON.stringify({ values: [movementRow(form, writeExtra?.(form) ?? [])] }),
        },
      );
    },

    async update(rowIndex: TRow, form: TForm): Promise<void> {
      const { spreadsheetId } = getConfig();
      const range = encodeURIComponent(`${sheetName}!A${rowIndex}:${lastCol}${rowIndex}`);
      await sheetsRequest(`/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({ values: [movementRow(form, writeExtra?.(form) ?? [])] }),
      });
    },

    async remove(rowIndex: TRow): Promise<void> {
      await deleteRow(sheetName, rowIndex);
    },
  };
}

const transfersCrud = makeMovementCrud<Transfer, TransferRow, TransferFormData>(TRANSFERS_SHEET);
const giftsCrud = makeMovementCrud<Gift, GiftRow, GiftFormData>(GIFTS_SHEET, {
  lastCol: 'E',
  readExtra: (row) => ({ giftKind: toGiftKind(String(row[4] ?? '')) }),
  writeExtra: (form) => [form.giftKind],
});

export const fetchTransfers = transfersCrud.fetchAll;
export const addTransfer = transfersCrud.add;
export const updateTransfer = transfersCrud.update;
export const deleteTransfer = transfersCrud.remove;

export const fetchGifts = giftsCrud.fetchAll;
export const addGift = giftsCrud.add;
export const updateGift = giftsCrud.update;
export const deleteGift = giftsCrud.remove;
