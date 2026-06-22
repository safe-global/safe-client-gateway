// SPDX-License-Identifier: FSL-1.1-MIT

// CSV formula-injection triggers (OWASP): ASCII = + - @, plus leading whitespace
// (space, TAB, CR, LF) which some spreadsheet importers strip before evaluating
// a formula, plus the full-width variants ＝ ＋ － ＠ which spreadsheet importers
// fold to the ASCII forms (NFKC) even though our NFC pipeline leaves them intact.
const FORMULA_TRIGGERS = [
  '=',
  '+',
  '-',
  '@',
  ' ',
  '\t',
  '\r',
  '\n',
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
