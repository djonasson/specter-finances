import { getAccessToken, refreshToken } from './auth';
import { getGrantedSheetId, clearGrantedSheetId, SheetAccessError } from './sheetAccess';
import { normalizeDate, normalizeAmount, formatAmount, parseAmount } from './parsing';
import type { Expense, ExpenseFormData, ExpenseRow } from '../types/expense';
import { toCategory } from '../types/expense';
import type { Transfer, TransferFormData, TransferRow } from '../types/transfer';
import type { Gift, GiftFormData, GiftRow } from '../types/gift';
import { toGiftKind } from '../types/gift';
import type { RecurringRule, RecurringRow, RecurringFormData } from '../types/recurring';
import type { PendingExpense } from './recurring';
import { toEveryMonths } from './recurring';
import { today } from './utils';
import { DEFAULT_NAMES } from '../types/person';
import type { PersonNames } from '../types/person';

export { parseAmount };

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * A Sheets API failure that is neither an auth problem nor a lost grant.
 *
 * Carries the HTTP status alongside the API's own wording so callers can tell
 * one 4xx from another. Reading a tab that does not exist answers 400, and that
 * is an ordinary state for this app — a sheet with no Recurring tab yet — not a
 * failure worth a red banner. Everything else stays a failure.
 *
 * `message` is left exactly as before so the error surfaced to the user is
 * unchanged.
 */
export class SheetsApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'SheetsApiError';
    this.status = status;
  }
}

function getConfig() {
  // The granted sheet wins: with the drive.file scope the token only authorises
  // files the user picked, so a build-time id we were never granted is useless.
  // VITE_SPREADSHEET_ID remains as a hint for the picker screen.
  const spreadsheetId = getGrantedSheetId();
  const sheetName = import.meta.env.VITE_SHEET_NAME || 'Sheet1';
  if (!spreadsheetId) throw new SheetAccessError('No spreadsheet selected');
  return { spreadsheetId, sheetName };
}

interface GoogleCall {
  /** Names the API in a failure Google sent no message of its own for. */
  label?: string;
  /**
   * The 403 reasons that mean something other than "the grant is gone", named
   * by the caller that knows them. Anything unrecognised still drops the grant:
   * holding on to one that really was revoked leaves the app failing every
   * request forever, so letting go is the safe default.
   */
  keepGrantOn?: readonly string[];
}

/**
 * A call to a Google API carrying this app's session.
 *
 * Everything a request from here has to do apart from reading the answer: carry
 * the token, survive it expiring mid-session, and recognise a grant that is
 * gone. It sits apart from `sheetsRequest` because not every call to Google
 * answers with JSON — a spreadsheet export answers with a file — and a caller
 * reaching for a bare `fetch` to get at those bytes would quietly lose the
 * refresh and the grant handling along with the parsing it did not want.
 *
 * The Response comes back unread, so the caller picks `json()` or `blob()`.
 *
 * No Content-Type is set here: a GET with no body must not claim one. Callers
 * that send a body pass their own, which is what keeps every Sheets request
 * identical to what it was before this was split out.
 */
async function authorizedFetch(
  url: string,
  options: RequestInit = {},
  { label = 'Sheets API', keepGrantOn = [] }: GoogleCall = {},
): Promise<Response> {
  let token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  // Captured up front: all three domains load in parallel, so by the time a
  // later response fails the first one may already have dropped the grant.
  const targetSheet = getGrantedSheetId() ?? 'unknown';

  // Reads `token` when called, not when defined, so the retry below sends the
  // refreshed one.
  const send = () =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

  let res = await send();

  if (res.status === 401) {
    token = await refreshToken();
    res = await send();
  }

  if (res.status === 403 || res.status === 404) {
    // The grant is gone (sheet deleted, unshared, or access revoked). Drop it so
    // the app asks for the sheet again instead of failing on every request —
    // carrying the API's own wording, which is the only clue to *why*.
    const body = await res.json().catch(() => ({}));
    const detail = body.error?.message || `HTTP ${res.status}`;

    // Not every 403 is a lost grant, and only the caller knows which of its own
    // are not. Sending someone back to the picker over one of those asks them to
    // re-grant a sheet they already hold, and changes nothing.
    const reason = String(body.error?.errors?.[0]?.reason ?? '');
    if (reason && keepGrantOn.includes(reason)) {
      throw new SheetsApiError(res.status, detail);
    }

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
    throw new SheetsApiError(res.status, err.error?.message || `${label} error: ${res.status}`);
  }

  return res;
}

async function sheetsRequest(path: string, options: RequestInit = {}) {
  const res = await authorizedFetch(`${SHEETS_API}${path}`, {
    ...options,
    // Ahead of the caller's own headers, exactly as before: the spread order is
    // what decides which one wins.
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  return res.json();
}

/** Title and numeric id of every tab in the granted spreadsheet. */
async function listSheets(): Promise<{ title: string; sheetId: number }[]> {
  const { spreadsheetId } = getConfig();
  const spreadsheet = await sheetsRequest(`/${spreadsheetId}?fields=sheets.properties`);
  return (spreadsheet.sheets ?? []).map(
    (s: { properties: { title: string; sheetId: number } }) => s.properties,
  );
}

/**
 * Did this failure mean "that tab does not exist"?
 *
 * Sheets answers a read against a missing tab with 400 "Unable to parse range",
 * but that prose is the API's and could change or be localised, and an
 * unrelated 400 must never be swallowed as "nothing configured yet". So the
 * status only decides whether the question is worth asking: the answer comes
 * from the spreadsheet's own tab list.
 */
async function isMissingTab(e: unknown, title: string): Promise<boolean> {
  if (!(e instanceof SheetsApiError) || e.status !== 400) return false;
  try {
    return !(await listSheets()).some((s) => s.title === title);
  } catch {
    // The metadata call failing tells us nothing about the tab; treat the
    // original error as real rather than inventing an empty state.
    return false;
  }
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

/** What Google converts a native spreadsheet into: a real Excel workbook. */
const SPREADSHEET_EXPORT_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Drive refuses to export a file over 10 MB with a 403, which is otherwise the
 * shape of a grant that is gone. Re-granting would not make the sheet smaller,
 * so this one must not cost the user their pick.
 */
const EXPORT_TOO_BIG = 'exportSizeLimitExceeded';

/**
 * The whole spreadsheet as one .xlsx file — every tab, as Google holds it.
 *
 * Drive's *export* endpoint, not `alt=media`: a Google-native spreadsheet has no
 * bytes of its own to download, so asking for the file itself fails and only a
 * conversion answers. `drive.file` already covers it, since it is the same file
 * the picker granted.
 */
export async function exportSpreadsheet(): Promise<Blob> {
  const { spreadsheetId } = getConfig();
  const res = await authorizedFetch(
    `${DRIVE_API}/${encodeURIComponent(spreadsheetId)}/export` +
      `?mimeType=${encodeURIComponent(SPREADSHEET_EXPORT_MIME)}`,
    {},
    { label: 'Drive export', keepGrantOn: [EXPORT_TOO_BIG] },
  );
  return res.blob();
}

/** The spreadsheet's own name, as Sheets holds it. Empty when it has none. */
export async function fetchSpreadsheetTitle(): Promise<string> {
  const { spreadsheetId } = getConfig();
  const data = await sheetsRequest(`/${spreadsheetId}?fields=properties.title`);
  return String(data.properties?.title ?? '').trim();
}

/**
 * Who the two amount columns belong to, taken from the sheet's two header rows.
 *
 * The names live in the spreadsheet, never in this codebase — so the app
 * carries nobody's identity and anyone pointing it at their own sheet sees
 * their own names.
 *
 * The SUB-header (row 2) is tried first. Row 1 commonly carries a merged group
 * label spanning both amount columns — "Amount", say — which is not a name, and
 * a merged cell reports its value only in the first column, leaving the second
 * blank. Reading row 1 first therefore produced "Amount" beside "Partner B".
 *
 * A row only qualifies if BOTH cells are filled and differ, so the two labels
 * always come from the same place: a half-answer next to a placeholder is worse
 * than two honest placeholders.
 */
export function readPersonNames(rows: unknown[][]): PersonNames {
  const cell = (row: unknown[] | undefined, i: number) => String(row?.[i] ?? '').trim();

  for (const row of [rows[1], rows[0]]) {
    const a = cell(row, 1);
    const b = cell(row, 2);
    if (a && b && a !== b) return { a, b };
  }

  return DEFAULT_NAMES;
}

/** Sub-header labels for the two columns the app writes to the expenses tab. */
export const EXPENSE_COLUMN_LABELS = ['Recurring', 'Added', 'Not counted (A)', 'Not counted (B)'];

export interface ExpensesResult {
  expenses: Expense[];
  names: PersonNames;
  /**
   * Do the columns the app writes still have no heading?
   *
   * Answered from the header rows this fetch already read, so asking costs
   * nothing — and it has to be asked here, because the labels used to be
   * written only while setting up recurring payments. Somebody who never opens
   * that tab still gets G to J written on every expense they add, and would
   * have been left with four unexplained columns forever.
   */
  columnsUnlabelled: boolean;
}

/**
 * Fetch the expense rows and the two names in one request.
 *
 * The range starts at A1 rather than A3 so both header rows come back with the
 * data: rows 1 and 2 are the header and sub-header, and data still starts at
 * sheet row 3.
 *
 * It reads through J: G and H are the two columns the app maintains itself (the
 * recurring marker, see services/recurring.ts, and the date the row was added),
 * and I and J are the part of each amount that was only for that person. Sheets
 * trims trailing blanks, so a row written before any of them existed comes back
 * six cells long and reads as having none.
 */
export async function fetchExpenses(): Promise<ExpensesResult> {
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A1:J`);
  const data = await sheetsRequest(
    `/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
  );

  const rows: unknown[][] = data.values || [];

  return {
    names: readPersonNames(rows),
    columnsUnlabelled: EXPENSE_COLUMN_LABELS.some((_, i) => !String(rows[1]?.[6 + i] ?? '').trim()),
    expenses: rows.slice(2).map((row, i) => ({
      rowIndex: (i + 3) as ExpenseRow,
      date: normalizeDate(row[0]),
      amountA: normalizeAmount(row[1]),
      amountB: normalizeAmount(row[2]),
      item: String(row[3] || ''),
      category: toCategory(String(row[4] || '')),
      notes: String(row[5] || ''),
      recurringMarker: String(row[6] || ''),
      // Guarded rather than passed straight to normalizeDate: an empty cell is
      // every row written before this column existed, and warning about each
      // one would bury the warnings that mean something.
      addedOn: row[7] ? normalizeDate(row[7]) : '',
      notCountedA: normalizeAmount(row[8]),
      notCountedB: normalizeAmount(row[9]),
    })),
  };
}

/**
 * One expense row in sheet column order.
 *
 * Stated once: the two paths that append a row — a hand-entered expense and a
 * generated one — write the same ten columns, and a layout spelled out twice is
 * the drift `recurringRow` exists to prevent on the other tab. Cells arrive
 * already formatted, because the two callers format at different moments.
 */
function expenseRow(cells: {
  date: string;
  amountA: string;
  amountB: string;
  item: string;
  category: string;
  notes: string;
  marker: string;
  addedOn: string;
  notCountedA: string;
  notCountedB: string;
}): string[] {
  return [
    cells.date,
    cells.amountA,
    cells.amountB,
    cells.item,
    cells.category,
    cells.notes,
    cells.marker,
    cells.addedOn,
    cells.notCountedA,
    cells.notCountedB,
  ];
}

/**
 * Append a new expense row, stamped with today's date.
 *
 * Appending writes the full A:H because the row is new: there is no marker to
 * protect in G (a hand-entered expense has none), and H records that this row
 * was added now, which is what lets the list point out a purchase entered today
 * but dated weeks ago.
 */
export async function addExpense(form: ExpenseFormData): Promise<void> {
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A:J`);
  const row = expenseRow({
    date: form.date,
    amountA: formatAmount(form.amountA),
    amountB: formatAmount(form.amountB),
    item: form.item,
    category: form.category,
    notes: form.notes,
    marker: '', // hand-entered: nothing produced it
    addedOn: today(),
    notCountedA: formatAmount(form.notCountedA),
    notCountedB: formatAmount(form.notCountedB),
  });

  await sheetsRequest(`/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    body: JSON.stringify({ values: [row] }),
  });
}

/**
 * Update an existing expense row.
 *
 * Two ranges, deliberately, rather than one spanning A to J: a PUT rewrites
 * every cell in its range, and G and H are not the user's to change. Blanking G
 * would strip a generated expense of its provenance, the month would read as
 * never generated, and the next check would write the payment a second time.
 * Blanking H would forget when the row was added, which correcting an amount
 * plainly does not change.
 *
 * Skipping over them makes both unerasable by construction rather than by
 * remembering to carry them through the form — which is why `ExpenseFormData`
 * has neither field. One batchUpdate keeps it to a single request.
 */
export async function updateExpense(rowIndex: ExpenseRow, form: ExpenseFormData): Promise<void> {
  const { spreadsheetId, sheetName } = getConfig();

  const entered = [
    form.date,
    formatAmount(form.amountA),
    formatAmount(form.amountB),
    form.item,
    form.category,
    form.notes,
  ];
  const setAside = [formatAmount(form.notCountedA), formatAmount(form.notCountedB)];

  await sheetsRequest(`/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${sheetName}!A${rowIndex}:F${rowIndex}`, values: [entered] },
        { range: `${sheetName}!I${rowIndex}:J${rowIndex}`, values: [setAside] },
      ],
    }),
  });
}

/** Delete a row via batchUpdate deleteDimension */
async function deleteRow(sheetName: string, rowIndex: number): Promise<void> {
  const { spreadsheetId } = getConfig();

  const sheet = (await listSheets()).find((s) => s.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheet.sheetId;

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

// ── Recurring payments ──────────────────────────────────────
//
// Standing monthly payments: metadata, not money. Columns B–F are deliberately
// the same five as the expenses tab, so generating an expense copies them
// across untouched and a human reading the spreadsheet sees the same shape in
// both places. The id sits last, out of the way, for the same reason.
//
// makeMovementCrud is not reused here: it is built around the
// date/amountA/amountB/notes shape and the "which column is empty" direction
// encoding, neither of which a recurring rule has.

const RECURRING_SHEET = 'Recurring';

const RECURRING_HEADER = [
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
];

/**
 * Zero-based index of the first Recurring column added after the tab shipped: I.
 *
 * A tab created before them keeps a shorter header while the app writes the
 * full width, so these are the ones topped up.
 */
const RECURRING_FIRST_LATE_COLUMN = 8;

/** What column L holds when a payment's amount is different every time. */
const VARIES = 'yes';

/**
 * Does this rule's amount change every time?
 *
 * Anything but the word itself reads as a fixed amount, so a blank cell — every
 * rule written before the column existed — and a stray note both keep the
 * behaviour they already had. Same shape as `toGiftKind`.
 */
function toAmountVaries(raw: unknown): boolean {
  return (
    String(raw ?? '')
      .trim()
      .toLowerCase() === VARIES
  );
}

/**
 * A short, stable, opaque id for a rule.
 *
 * Short on purpose: it is repeated inside every marker cell in expenses column
 * G, and a 36-character UUID there would make that column unreadable to anyone
 * looking at the spreadsheet directly.
 */
let ruleIdCounter = 0;

export function newRuleId(): string {
  // Three parts, each covering the others' blind spot: the clock separates
  // sessions, the counter guarantees uniqueness within one (Date.now() repeats
  // freely inside a millisecond), and the random tail keeps two devices adding
  // a rule at the same moment apart.
  const random = Math.random().toString(36).slice(2, 5);
  return `r${Date.now().toString(36)}${(ruleIdCounter++).toString(36)}${random}`;
}

/** Form values in sheet column order. */
function recurringRow(form: RecurringFormData, id: string): string[] {
  return [
    form.start,
    formatAmount(form.amountA),
    formatAmount(form.amountB),
    form.item,
    form.category,
    form.notes,
    String(form.day),
    id,
    formatAmount(form.notCountedA),
    formatAmount(form.notCountedB),
    String(toEveryMonths(form.everyMonths)),
    form.amountVaries ? VARIES : '',
  ];
}

export interface RecurringResult {
  rules: RecurringRule[];
  /** The tab has not been created yet — an empty state, not a failure. */
  tabMissing: boolean;
}

export async function fetchRecurring(): Promise<RecurringResult> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${RECURRING_SHEET}!A2:L`);

  let data;
  try {
    data = await sheetsRequest(
      `/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    rememberTabPresence(spreadsheetId, true);
  } catch (e) {
    // Once this session has seen the tab missing, a repeat 400 needs no second
    // opinion: the metadata lookup that classifies it would otherwise run on
    // every navigation, for every user who has not opted in.
    if (
      knownTabPresence(spreadsheetId) === false &&
      e instanceof SheetsApiError &&
      e.status === 400
    ) {
      return { rules: [], tabMissing: true };
    }
    if (await isMissingTab(e, RECURRING_SHEET)) {
      rememberTabPresence(spreadsheetId, false);
      return { rules: [], tabMissing: true };
    }
    throw e;
  }

  const rows: unknown[][] = data.values || [];
  const rules = rows
    .map((row, i) => {
      const start = normalizeDate(row[0]);
      // A day of its own overrides the start date's, because a rule that falls
      // on the 31st cannot say so through a start date in a 30-day month. With
      // the cell blank — as a hand-added rule would leave it — the start date's
      // day is the honest reading.
      const day = Number(row[6]) || Number(start.slice(8, 10)) || 1;
      // Settled here rather than at each screen that reads a rule: a payment
      // whose amount varies holds none, so nothing downstream can show a figure
      // beside the badge saying nobody knows it. A hand-edited sheet can hold
      // both, and the form is not the only way in.
      const amountVaries = toAmountVaries(row[11]);
      const money = (cell: unknown) => (amountVaries ? '' : normalizeAmount(cell));
      return {
        rowIndex: (i + 2) as RecurringRow,
        start,
        amountA: money(row[1]),
        amountB: money(row[2]),
        item: String(row[3] || ''),
        category: toCategory(String(row[4] || '')),
        notes: String(row[5] || ''),
        day,
        id: String(row[7] || '').trim(),
        notCountedA: money(row[8]),
        notCountedB: money(row[9]),
        // Blank reads as monthly and as a fixed amount, so every rule written
        // before these columns existed keeps behaving exactly as it did.
        everyMonths: toEveryMonths(row[10]),
        amountVaries,
      };
    })
    // Filtered after mapping so rowIndex still matches the physical sheet row.
    // amountVaries counts as data in its own right: a varying rule has its
    // amounts blanked above, so without it a hand-added row with no start date
    // and no item would disappear from the app while still sitting on the sheet
    // — invisible, and so impossible to fix or delete from here.
    .filter((r) => r.start || r.amountA || r.amountB || r.item || r.amountVaries);

  return { rules, tabMissing: false };
}

/**
 * Spreadsheet column name for a zero-based index: 0 is A, 25 is Z, 26 is AA.
 *
 * Base-26 rather than one character, because the point of deriving the letters
 * is that a label list can grow without anything being kept in step by hand —
 * and `String.fromCharCode(65 + 26)` is `'['`, which would build a range the
 * API rejects and take adding a recurring payment down with it.
 */
export function columnLetter(index: number): string {
  let name = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    name = String.fromCharCode(65 + (n % 26)) + name;
  }
  return name;
}

/**
 * Fill in blank heading cells, leaving anything already there.
 *
 * Only blank cells are written, and the write is narrowed to exactly those: a
 * label someone chose themselves outranks ours, and writing a cell back even
 * with the value just read would replace a formula there with whatever it
 * currently renders to.
 *
 * Labels start at `firstColumn` (zero-based) and the letters are derived from
 * there: a parallel array of letters has to be kept in step by hand, and one
 * label too many would have produced the range `Recurring!undefined1`.
 */
async function ensureLabels(sheet: string, row: number, firstColumn: number, labels: string[]) {
  const { spreadsheetId } = getConfig();
  const span =
    `${sheet}!${columnLetter(firstColumn)}${row}` +
    `:${columnLetter(firstColumn + labels.length - 1)}${row}`;
  const existing = await sheetsRequest(`/${spreadsheetId}/values/${encodeURIComponent(span)}`);
  const current = (existing.values?.[0] ?? []) as unknown[];

  // One entry per blank cell rather than one span across them: a span from the
  // first blank to the last would write over anything filled in between, which
  // is the single thing this function promises not to do. Still one request.
  const data = labels
    .map((label, i) => ({
      label,
      column: columnLetter(firstColumn + i),
      filled: String(current[i] ?? '').trim(),
    }))
    .filter((cell) => !cell.filled)
    .map((cell) => ({
      range: `${sheet}!${cell.column}${row}:${cell.column}${row}`,
      values: [[cell.label]],
    }));

  if (data.length === 0) return;

  await sheetsRequest(`/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  });
}

/** Zero-based index of the first expenses column the app writes: G. */
const EXPENSE_FIRST_APP_COLUMN = 6;

/**
 * Put a heading over the columns the app maintains on the expenses tab.
 *
 * Kept apart from the Recurring tab, and not behind its early return, because
 * only column G is recurring's business: column H is stamped on *every* added
 * expense, so a user who never opens the Recurring tab would otherwise
 * accumulate an unexplained column of dates — which is worse than no feature at
 * all, and was exactly what the previous arrangement did.
 */
export async function ensureExpenseColumnLabels(): Promise<void> {
  const { sheetName } = getConfig();
  await ensureLabels(sheetName, 2, EXPENSE_FIRST_APP_COLUMN, EXPENSE_COLUMN_LABELS);
}

/**
 * Whether this session has already established that the Recurring tab exists.
 *
 * Every navigation reloads every domain, so without this the tab-existence
 * question is re-asked over and over: a sheet with no Recurring tab paid a
 * doomed read *plus* a metadata lookup on each one, and adding a rule paid
 * another lookup to confirm what the last load had just proved.
 */
let recurringTabPresent: boolean | null = null;
/** Which spreadsheet the answer above is about. */
let recurringTabCachedFor: string | null = null;

/** Forget what we know about the tab. */
export function resetRecurringTabCache(): void {
  recurringTabPresent = null;
  recurringTabCachedFor = null;
}

/**
 * The cached answer, but only if it is about the sheet being asked about.
 *
 * A grant can be dropped and a different spreadsheet picked without the module
 * ever unloading, and the second sheet is under no obligation to have the same
 * tabs as the first.
 */
function knownTabPresence(spreadsheetId: string): boolean | null {
  return recurringTabCachedFor === spreadsheetId ? recurringTabPresent : null;
}

function rememberTabPresence(spreadsheetId: string, present: boolean): void {
  recurringTabCachedFor = spreadsheetId;
  recurringTabPresent = present;
}

/**
 * Create the Recurring tab, if it is not there.
 *
 * Idempotent, and never called on load — writing to someone's spreadsheet
 * because they opened the app is the kind of surprise this app avoids, and with
 * every domain loading in parallel on every navigation a create-on-load would
 * race itself into a duplicate tab. It runs when a rule is added, or when the
 * empty state's button is pressed.
 */
export async function ensureRecurringSetup(): Promise<void> {
  const { spreadsheetId } = getConfig();

  if (knownTabPresence(spreadsheetId) !== true) {
    const sheets = await listSheets();
    if (!sheets.some((s) => s.title === RECURRING_SHEET)) {
      await sheetsRequest(`/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: RECURRING_SHEET } } }],
        }),
      });

      await sheetsRequest(
        `/${spreadsheetId}/values/${encodeURIComponent(
          `${RECURRING_SHEET}!A1:L1`,
        )}?valueInputOption=USER_ENTERED`,
        { method: 'PUT', body: JSON.stringify({ values: [RECURRING_HEADER] }) },
      );
    }
    rememberTabPresence(spreadsheetId, true);
  }

  // A tab created before the not-counted columns existed has an eight-cell
  // header while the app writes ten. Reads and writes are positional so no
  // value is wrong, but two unlabelled columns of money in someone's own
  // spreadsheet is the thing this whole labelling exists to avoid.
  await ensureLabels(
    RECURRING_SHEET,
    1,
    RECURRING_FIRST_LATE_COLUMN,
    RECURRING_HEADER.slice(RECURRING_FIRST_LATE_COLUMN),
  );
  await ensureExpenseColumnLabels();
}

export async function addRecurring(form: RecurringFormData): Promise<void> {
  await ensureRecurringSetup();
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${RECURRING_SHEET}!A:L`);
  await sheetsRequest(`/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    body: JSON.stringify({ values: [recurringRow(form, newRuleId())] }),
  });
}

/**
 * Update a rule.
 *
 * Touches the Recurring tab and nothing else. A rule carries no history: the
 * expenses it has already produced record what was actually paid those months,
 * and raising a subscription's price must not rewrite them.
 */
export async function updateRecurring(
  rowIndex: RecurringRow,
  form: RecurringFormData,
  id: string,
): Promise<void> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${RECURRING_SHEET}!A${rowIndex}:L${rowIndex}`);
  await sheetsRequest(`/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [recurringRow(form, id)] }),
  });
}

/** Give a hand-added rule an id, so what it generates can be traced back. */
export async function assignRecurringId(rowIndex: RecurringRow): Promise<void> {
  const { spreadsheetId } = getConfig();
  const range = encodeURIComponent(`${RECURRING_SHEET}!H${rowIndex}`);
  await sheetsRequest(`/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[newRuleId()]] }),
  });
}

/** Delete a rule. The expenses it already produced are left alone. */
export async function deleteRecurring(rowIndex: RecurringRow): Promise<void> {
  await deleteRow(RECURRING_SHEET, rowIndex);
}

/**
 * Write the generated expenses, all in one request.
 *
 * One request rather than N because it is all-or-nothing: separate appends
 * could leave some months on the sheet and some not, with nothing to say which.
 *
 * insertDataOption matters. The default, OVERWRITE, writes into blank rows
 * below the table — so anything a person keeps further down the sheet would be
 * silently replaced. INSERT_ROWS pushes rows in instead.
 */
export async function appendGeneratedExpenses(pending: PendingExpense[]): Promise<void> {
  if (pending.length === 0) return;
  const { spreadsheetId, sheetName } = getConfig();
  const range = encodeURIComponent(`${sheetName}!A:J`);
  const addedOn = today();
  const values = pending.map((p) =>
    expenseRow({
      ...p,
      category: p.category,
      // Stamped like any other new row. It matters most here: a payment caught
      // up for two months ago is dated two months ago, so it lands far down a
      // list ordered by date and would otherwise be invisible.
      addedOn,
    }),
  );

  await sheetsRequest(
    `/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values }) },
  );
}
