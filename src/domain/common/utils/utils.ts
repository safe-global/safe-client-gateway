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

/**
 * Sorts an object by its keys and recursively sorts its values.
 * Useful for ensuring order of keys in an object is consistent,
 * which can be important for caching or comparison purposes.
 * @param value {unknown} object to sort
 * @returns {unknown} sorted object
 */
export function sortObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sortObject) as T;
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const keySortedEntries = Object.entries(value).sort(([a], [b]) => {
    return a.localeCompare(b);
  });
  const valueSortedEntries = keySortedEntries.map(([key, val]) => {
    return [key, sortObject(val)];
  });
  return Object.fromEntries(valueSortedEntries);
}
