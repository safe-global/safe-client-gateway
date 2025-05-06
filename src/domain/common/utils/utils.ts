import { createHash } from 'crypto';
import type { BinaryLike } from 'crypto';

// We use the maximum value in order to preserve all decimals
// @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#maximumfractiondigits
const MAX_MAXIMUM_FRACTION_DIGITS = 100;

const formatter = new Intl.NumberFormat('en-US', {
  // Prevent scientific notation
  notation: 'standard',
  useGrouping: false,
  maximumFractionDigits: MAX_MAXIMUM_FRACTION_DIGITS,
});

export function getNumberString(value: number): string {
  return formatter.format(value);
}

/**
 * Truncates an address with a specific lengthed prefix and suffix
 * @param {`0x${string}`} address to truncate
 * @param {number} [length] of the prefix and suffix, minus hex prefix
 * @returns {`0x${string}`} truncated address
 */
export function truncateAddress(
  address: `0x${string}`,
  length: number = 4,
): `0x${string}` {
  return `${address.slice(0, length + 2)}...${address.slice(-length)}` as `0x${string}`;
}

export function hashSha1(value: BinaryLike): string {
  return createHash('sha1').update(value).digest('hex');
}
