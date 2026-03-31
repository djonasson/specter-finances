import { describe, it, expect } from 'vitest';
import { serialToDate, normalizeDate, normalizeAmount, formatAmount, parseAmount } from './parsing';

describe('serialToDate', () => {
  it('converts known date serials', () => {
    expect(serialToDate(36526)).toBe('2000-01-01');
    expect(serialToDate(41062)).toBe('2012-06-02');
    expect(serialToDate(46108)).toBe('2026-03-27');
  });

  it('handles serial 1 (Jan 1, 1900)', () => {
    expect(serialToDate(1)).toBe('1900-01-01');
  });
});

describe('normalizeDate', () => {
  it('passes through YYYY-MM-DD unchanged', () => {
    expect(normalizeDate('2025-03-27')).toBe('2025-03-27');
    expect(normalizeDate('2012-06-02')).toBe('2012-06-02');
  });

  it('converts serial numbers', () => {
    expect(normalizeDate(46108)).toBe('2026-03-27');
  });

  it('converts DD/MM/YYYY', () => {
    expect(normalizeDate('27/03/2025')).toBe('2025-03-27');
    expect(normalizeDate('2/6/2012')).toBe('2012-06-02');
    expect(normalizeDate('15/03/2013')).toBe('2013-03-15');
  });

  it('converts DD-MM-YYYY', () => {
    expect(normalizeDate('27-03-2025')).toBe('2025-03-27');
  });

  it('converts DD.MM.YYYY', () => {
    expect(normalizeDate('27.03.2025')).toBe('2025-03-27');
  });

  it('converts DD/MM/YY with 2-digit year', () => {
    expect(normalizeDate('15/03/13')).toBe('2013-03-15');
    expect(normalizeDate('28/03/13')).toBe('2013-03-28');
  });

  it('converts DD.MM.YY with 2-digit year', () => {
    expect(normalizeDate('15.03.13')).toBe('2013-03-15');
  });

  it('treats 2-digit years >= 50 as 19xx', () => {
    expect(normalizeDate('01/01/99')).toBe('1999-01-01');
    expect(normalizeDate('01/01/50')).toBe('1950-01-01');
  });

  it('treats 2-digit years < 50 as 20xx', () => {
    expect(normalizeDate('01/01/00')).toBe('2000-01-01');
    expect(normalizeDate('01/01/49')).toBe('2049-01-01');
  });

  it('handles empty/null/undefined', () => {
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate(null)).toBe('');
    expect(normalizeDate(undefined)).toBe('');
  });

  it('warns on ambiguous dash-separated 2-digit dates (not parsed)', () => {
    // These are ambiguous (DD-MM-YY vs YY-MM-DD) and should pass through with a warning
    const result = normalizeDate('21-03-05');
    expect(result).toBe('21-03-05');
  });
});

describe('normalizeAmount', () => {
  it('formats numbers', () => {
    expect(normalizeAmount(123.45)).toBe('€123.45');
    expect(normalizeAmount(1234.5)).toBe('€1,234.50');
  });

  it('returns empty for zero', () => {
    expect(normalizeAmount(0)).toBe('');
  });

  it('returns empty for empty/null/undefined', () => {
    expect(normalizeAmount('')).toBe('');
    expect(normalizeAmount(null)).toBe('');
    expect(normalizeAmount(undefined)).toBe('');
  });

  it('passes through euro-formatted strings', () => {
    expect(normalizeAmount('€123.45')).toBe('€123.45');
    expect(normalizeAmount('€1,234.56')).toBe('€1,234.56');
  });

  it('formats raw number strings', () => {
    expect(normalizeAmount('123.45')).toBe('€123.45');
    expect(normalizeAmount('1234.56')).toBe('€1,234.56');
  });
});

describe('formatAmount', () => {
  it('formats number strings with euro sign', () => {
    expect(formatAmount('123.45')).toBe('€123.45');
    expect(formatAmount('1234.56')).toBe('€1,234.56');
  });

  it('returns empty for empty input', () => {
    expect(formatAmount('')).toBe('');
    expect(formatAmount('  ')).toBe('');
  });

  it('returns empty for non-numeric input', () => {
    expect(formatAmount('abc')).toBe('');
  });
});

describe('parseAmount', () => {
  it('parses euro-formatted strings to raw numbers', () => {
    expect(parseAmount('€123.45')).toBe('123.45');
    expect(parseAmount('€1,234.56')).toBe('1234.56');
    expect(parseAmount('€4,820.00')).toBe('4820.00');
  });

  it('returns empty for empty input', () => {
    expect(parseAmount('')).toBe('');
    expect(parseAmount('  ')).toBe('');
  });
});
