/**
 * Convert a Google Sheets date serial number to YYYY-MM-DD.
 * Sheets epoch: Dec 30, 1899 (includes the Lotus 1-2-3 leap year bug).
 */
export function serialToDate(serial: number): string {
  // Google Sheets: serial 1 = Jan 1, 1900.
  // Lotus 1-2-3 bug: serial 60 = Feb 29, 1900 (doesn't exist).
  // Serials > 59 need an extra day subtracted to compensate.
  const base = new Date(Date.UTC(1900, 0, 1));
  const offset = serial > 59 ? serial - 2 : serial - 1;
  const date = new Date(base.getTime() + offset * 86400000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalize a raw date value from the Sheets API.
 * Could be a serial number (if stored as a date) or a string (if stored as text).
 */
export function normalizeDate(raw: unknown): string {
  if (typeof raw === 'number') {
    return serialToDate(raw);
  }
  const str = String(raw || '').trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  // DD/MM/YY or DD.MM.YY (with / or . separators only — dashes are ambiguous)
  const dmy2 = str.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2})$/);
  if (dmy2) {
    const year = Number(dmy2[3]) < 50 ? `20${dmy2[3]}` : `19${dmy2[3]}`;
    return `${year}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;
  }
  if (str) {
    console.warn('Unparseable date:', JSON.stringify(raw));
  }
  return str;
}

/**
 * Normalize a raw amount value from the Sheets API.
 * Could be a number (if stored as currency/number) or a string like "€1,234.56".
 * Returns a display string like "€1,234.56" or "".
 */
export function normalizeAmount(raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number') {
    if (raw === 0) return '';
    return `€${raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const str = String(raw).trim();
  if (!str) return '';
  if (str.startsWith('€')) return str;
  const num = parseFloat(str.replace(/,/g, ''));
  if (!isNaN(num) && num !== 0) {
    return `€${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return '';
}

/** Format a number string like "123.45" into "€123.45" for writing to the sheet */
export function formatAmount(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  const num = parseFloat(raw);
  if (isNaN(num)) return '';
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `€${formatted}`;
}

/** Parse "€1,234.56" back to a raw number string "1234.56" */
export function parseAmount(formatted: string): string {
  if (!formatted || formatted.trim() === '') return '';
  const cleaned = formatted.replace(/[€,]/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return '';
  return num.toFixed(2);
}
