import { getAccessToken, refreshToken } from './auth';
import { normalizeDate, normalizeAmount, formatAmount, parseAmount } from './parsing';
import type { Expense, ExpenseFormData } from '../types/expense';
import type { Transfer, TransferFormData } from '../types/transfer';
import type { Gift, GiftFormData } from '../types/gift';

export { parseAmount };

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function getConfig() {
  const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID;
  const sheetName = import.meta.env.VITE_SHEET_NAME || 'Sheet1';
  if (!spreadsheetId) throw new Error('VITE_SPREADSHEET_ID not set');
  return { spreadsheetId, sheetName };
}

async function sheetsRequest(path: string, options: RequestInit = {}) {
  let token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets API error: ${res.status}`);
  }

  return res.json();
}

/** Fetch all expense rows from the spreadsheet */
export async function fetchExpenses(): Promise<Expense[]> {
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A3:F`);
  const data = await sheetsRequest(
    `/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`
  );

  const rows: unknown[][] = data.values || [];

  // Debug: log raw date values that don't parse as YYYY-MM-DD
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i][0];
    const normalized = normalizeDate(raw);
    if (normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      console.warn(`Row ${i + 3}: raw date = ${JSON.stringify(raw)}, normalized = ${JSON.stringify(normalized)}`);
    }
  }

  return rows.map((row, i) => ({
    rowIndex: i + 3,
    date: normalizeDate(row[0]),
    amountDaniel: normalizeAmount(row[1]),
    amountManuela: normalizeAmount(row[2]),
    item: String(row[3] || ''),
    category: String(row[4] || '') as Expense['category'],
    notes: String(row[5] || ''),
  }));
}

/** Append a new expense row */
export async function addExpense(form: ExpenseFormData): Promise<void> {
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A:F`);
  const row = [
    form.date,
    formatAmount(form.amountDaniel),
    formatAmount(form.amountManuela),
    form.item,
    form.category,
    form.notes,
  ];

  await sheetsRequest(
    `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [row] }),
    }
  );
}

/** Update an existing expense row */
export async function updateExpense(
  rowIndex: number,
  form: ExpenseFormData
): Promise<void> {
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A${rowIndex}:F${rowIndex}`);
  const row = [
    form.date,
    formatAmount(form.amountDaniel),
    formatAmount(form.amountManuela),
    form.item,
    form.category,
    form.notes,
  ];

  await sheetsRequest(
    `/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [row] }),
    }
  );
}

/** Delete a row via batchUpdate deleteDimension */
async function deleteRow(sheetName: string, rowIndex: number): Promise<void> {
  const { spreadsheetId } = getConfig();

  const spreadsheet = await sheetsRequest(`/${spreadsheetId}?fields=sheets.properties`);
  const sheet = spreadsheet.sheets.find(
    (s: { properties: { title: string } }) => s.properties.title === sheetName
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
export async function deleteExpense(rowIndex: number): Promise<void> {
  const { sheetName } = getConfig();
  await deleteRow(sheetName, rowIndex);
}

// ── Transfers ──────────────────────────────────────────────

const TRANSFERS_SHEET = 'Transfers';

function transferRow(form: TransferFormData): string[] {
  const danielAmt = form.from === 'Daniel' ? formatAmount(form.amount) : '';
  const manuelaAmt = form.from === 'Manuela' ? formatAmount(form.amount) : '';
  return [form.date, danielAmt, manuelaAmt, form.notes];
}

/** Fetch all transfer rows from the Transfers sheet */
export async function fetchTransfers(): Promise<Transfer[]> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${TRANSFERS_SHEET}!A2:D`);
  const data = await sheetsRequest(
    `/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`
  );

  const rows: unknown[][] = data.values || [];
  return rows.map((row, i) => ({
    rowIndex: i + 2,
    date: normalizeDate(row[0]),
    amountDaniel: normalizeAmount(row[1]),
    amountManuela: normalizeAmount(row[2]),
    notes: String(row[3] || ''),
  }));
}

/** Append a new transfer row */
export async function addTransfer(form: TransferFormData): Promise<void> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${TRANSFERS_SHEET}!A:D`);

  await sheetsRequest(
    `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [transferRow(form)] }),
    }
  );
}

/** Update an existing transfer row */
export async function updateTransfer(
  rowIndex: number,
  form: TransferFormData
): Promise<void> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${TRANSFERS_SHEET}!A${rowIndex}:D${rowIndex}`);

  await sheetsRequest(
    `/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [transferRow(form)] }),
    }
  );
}

/** Delete a transfer row */
export async function deleteTransfer(rowIndex: number): Promise<void> {
  await deleteRow(TRANSFERS_SHEET, rowIndex);
}

// ── Gifts ───────────────────────────────────────────────���─

const GIFTS_SHEET = 'Gifts';

function giftRow(form: GiftFormData): string[] {
  const danielAmt = form.from === 'Daniel' ? formatAmount(form.amount) : '';
  const manuelaAmt = form.from === 'Manuela' ? formatAmount(form.amount) : '';
  return [form.date, danielAmt, manuelaAmt, form.notes];
}

/** Fetch all gift rows from the Gifts sheet */
export async function fetchGifts(): Promise<Gift[]> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${GIFTS_SHEET}!A2:D`);
  const data = await sheetsRequest(
    `/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`
  );

  const rows: unknown[][] = data.values || [];
  return rows.map((row, i) => ({
    rowIndex: i + 2,
    date: normalizeDate(row[0]),
    amountDaniel: normalizeAmount(row[1]),
    amountManuela: normalizeAmount(row[2]),
    notes: String(row[3] || ''),
  }));
}

/** Append a new gift row */
export async function addGift(form: GiftFormData): Promise<void> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${GIFTS_SHEET}!A:D`);

  await sheetsRequest(
    `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [giftRow(form)] }),
    }
  );
}

/** Update an existing gift row */
export async function updateGift(
  rowIndex: number,
  form: GiftFormData
): Promise<void> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${GIFTS_SHEET}!A${rowIndex}:D${rowIndex}`);

  await sheetsRequest(
    `/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [giftRow(form)] }),
    }
  );
}

/** Delete a gift row */
export async function deleteGift(rowIndex: number): Promise<void> {
  await deleteRow(GIFTS_SHEET, rowIndex);
}
