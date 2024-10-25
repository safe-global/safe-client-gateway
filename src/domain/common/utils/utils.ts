export function getNumberString(value: number): string {
  // Prevent scientific notation
  return value.toLocaleString('en-US', {
    notation: 'standard',
    useGrouping: false,
  });
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
