// SPDX-License-Identifier: FSL-1.1-MIT

export function unionStrip<T extends string>(
  addresses: ReadonlyArray<T>,
  strippedLowercased: ReadonlySet<string>,
): Array<T> {
  if (strippedLowercased.size === 0) return [...addresses];
  return addresses.filter(
    (address) => !strippedLowercased.has(address.toLowerCase()),
  );
}
