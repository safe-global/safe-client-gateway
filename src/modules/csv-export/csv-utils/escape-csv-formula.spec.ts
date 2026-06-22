// SPDX-License-Identifier: FSL-1.1-MIT
import { escapeCsvFormula } from '@/modules/csv-export/csv-utils/escape-csv-formula';

describe('escapeCsvFormula', () => {
  it.each([
    '=HYPERLINK("http://x")',
    '+1+1',
    '-1',
    '@SUM(A1)',
  ])('prefixes formula trigger %s with a single quote', (value) => {
    expect(escapeCsvFormula(value)).toBe(`'${value}`);
  });

  it('prefixes a value starting with TAB (0x09)', () => {
    expect(escapeCsvFormula('\t=1')).toBe("'\t=1");
  });

  it('prefixes a value starting with CR (0x0D)', () => {
    expect(escapeCsvFormula('\r=1')).toBe("'\r=1");
  });

  it('prefixes full-width formula triggers', () => {
    expect(escapeCsvFormula('＝1')).toBe("'＝1");
    expect(escapeCsvFormula('＋1')).toBe("'＋1");
    expect(escapeCsvFormula('－1')).toBe("'－1");
    expect(escapeCsvFormula('＠1')).toBe("'＠1");
  });

  it('leaves a benign value untouched', () => {
    expect(escapeCsvFormula('José')).toBe('José');
    expect(escapeCsvFormula('0x1234')).toBe('0x1234');
  });

  it('handles nullish/non-string values', () => {
    expect(escapeCsvFormula(null)).toBe('');
    expect(escapeCsvFormula(undefined)).toBe('');
    expect(escapeCsvFormula(42)).toBe('42');
  });

  it('returns empty string for an empty string input', () => {
    expect(escapeCsvFormula('')).toBe('');
  });
});
