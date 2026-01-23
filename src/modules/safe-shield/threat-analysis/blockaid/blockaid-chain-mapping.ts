/**
 * Maps chain IDs to Blockaid API chain names.
 * Using chain ID (not name) for stability - chain names may change in Config Service.
 */
export const CHAIN_ID_TO_BLOCKAID_CHAIN: Record<string, string> = {
  '1': 'ethereum',
  '11155111': 'ethereum-sepolia',
  '10': 'optimism',
  '56': 'bsc',
  '100': 'gnosis',
  '137': 'polygon',
  '324': 'zksync',
  '8453': 'base',
  '42161': 'arbitrum',
  '43114': 'avalanche',
  '59144': 'linea',
  '81457': 'blast',
  '534352': 'scroll',
};

/**
 * Maps a chain ID to the corresponding Blockaid chain name.
 * @param chainId - The chain ID to map
 * @returns The Blockaid chain name or null if not supported
 */
export function getBlockaidChainName(chainId: string): string | null {
  return CHAIN_ID_TO_BLOCKAID_CHAIN[chainId] ?? null;
}
