// SPDX-License-Identifier: FSL-1.1-MIT

export function isSameFeatureSet(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  return setA.size === setB.size && [...setA].every((f) => setB.has(f));
}
