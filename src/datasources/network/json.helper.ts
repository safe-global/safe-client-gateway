// SPDX-License-Identifier: FSL-1.1-MIT

const BIGINT_SIGIL = '__BIGINT_SIGIL__';
const BIGINT_PATTERN = new RegExp(
  `"${BIGINT_SIGIL}(-?\\d+)${BIGINT_SIGIL}"`,
  'g',
);

/**
 * `JSON.stringify` rejects BigInt and `Number(...)` truncates above 2^53.
 * This emits BigInt as a raw JSON integer literal (no quotes, no precision
 * loss), so wire formats that require `integer` for arbitrarily-large values
 * (e.g. wei amounts) round-trip cleanly.
 *
 * Implementation: wrap each BigInt in a sigil string during stringification,
 * then strip the surrounding quotes via regex.
 */
export function stringifyWithBigInt(value: unknown): string {
  const json = JSON.stringify(value, (_, v) =>
    typeof v === 'bigint' ? `${BIGINT_SIGIL}${v.toString()}${BIGINT_SIGIL}` : v,
  );
  return json.replace(BIGINT_PATTERN, '$1');
}
