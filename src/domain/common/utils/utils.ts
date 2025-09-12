import { createHash } from 'crypto';
import type { BinaryLike } from 'crypto';
import type { Address } from 'viem';

// We use the maximum value in order to preserve all decimals
// @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#maximumfractiondigits
const MAX_MAXIMUM_FRACTION_DIGITS = 20;

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
 * @param {Address} address to truncate
 * @param {number} [length] of the prefix and suffix, minus hex prefix
 * @returns {Address} truncated address
 */
export function truncateAddress(address: Address, length: number = 4): Address {
  return `${address.slice(0, length + 2)}...${address.slice(-length)}` as Address;
}

export function hashSha1(value: BinaryLike): string {
  return createHash('sha1').update(value).digest('hex');
}
