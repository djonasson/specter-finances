import { getAccessToken, refreshToken } from './auth';
import { normalizeDate, normalizeAmount, formatAmount, parseAmount } from './parsing';
import type { Expense, ExpenseFormData } from '../types/expense';

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

/** Delete an expense row by clearing it and then removing it via batchUpdate */
export async function deleteExpense(rowIndex: number): Promise<void> {
  const { spreadsheetId, sheetName } = getConfig();

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
