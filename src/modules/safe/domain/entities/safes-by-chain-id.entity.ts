/**
 * Represents a mapping of chain IDs to Safe addresses.
 * Each chain ID maps to either an array of Safe addresses or null if the fetch failed.
 */
export type SafesByChainId = {
  [chainId: string]: Array<string> | null;
};
