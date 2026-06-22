// SPDX-License-Identifier: FSL-1.1-MIT

// CSV formula-injection triggers (OWASP): ASCII = + - @, plus TAB and CR which
// some spreadsheet apps treat as leading whitespace before a formula, plus the
// full-width variants ＝ ＋ － ＠ that normalize to the ASCII forms.
const FORMULA_TRIGGERS = [
  '=',
  '+',
  '-',
  '@',
  '\t',
  '\r',
  '＝',
  '＋',
  '－',
  '＠',
];

export function escapeCsvFormula(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.length > 0 && FORMULA_TRIGGERS.includes(str[0])) {
    return `'${str}`;
  }
  return str;
}
