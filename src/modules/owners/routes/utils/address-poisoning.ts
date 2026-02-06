/**
 * Number of hex characters to compare at the start and end of an address.
 */
const MATCHING_HEX_LENGTH = 4;

const PREFIX_START = 2; // skip '0x'
const PREFIX_END = PREFIX_START + MATCHING_HEX_LENGTH;

/**
 * Returns the grouping key (prefix + suffix) for an address, used to
 * bucket addresses that share the same first/last hex characters.
 */
function similarityKey(address: string): string {
  const lower = address.toLowerCase();
  return (
    lower.slice(PREFIX_START, PREFIX_END) + lower.slice(-MATCHING_HEX_LENGTH)
  );
}

/**
 * Two addresses are "similar" if they are different addresses that share
 * the same first and last {@link MATCHING_HEX_LENGTH} hex characters (after 0x).
 */
export function areSimilarAddresses(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return false;
  return similarityKey(a) === similarityKey(b);
}

/**
 * Returns index pairs [i, j] where i < j and addresses[i] and addresses[j]
 * are similar (same first and last hex chars but different addresses).
 *
 * Groups addresses by their prefix+suffix key (O(n)), then generates pairs
 * within each group (O(k²) per group, where k is typically very small).
 */
export function findSimilarAddressPairs(
  addresses: Array<string>,
): Array<[number, number]> {
  // Group indices by similarity key
  const groups = new Map<string, Array<number>>();
  for (let i = 0; i < addresses.length; i++) {
    const key = similarityKey(addresses[i]);
    const group = groups.get(key);
    if (group) {
      group.push(i);
    } else {
      groups.set(key, [i]);
    }
  }

  // Generate pairs within each group
  const pairs: Array<[number, number]> = [];
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        // Skip identical addresses (same key doesn't guarantee different address)
        if (
          addresses[indices[a]].toLowerCase() !==
          addresses[indices[b]].toLowerCase()
        ) {
          pairs.push([indices[a], indices[b]]);
        }
      }
    }
  }

  return pairs;
}
