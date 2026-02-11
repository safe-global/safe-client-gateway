import type { SafeV2 } from '@/modules/safe/domain/entities/safe.entity';
import type { Address } from 'viem';

/**
 * Represents a mapping of chain IDs to Safe objects (v3).
 * Each chain ID maps to either a map of Safe addresses to SafeV2 objects or null if the fetch failed.
 */
export type SafesByChainIdV3 = {
  [chainId: string]: Record<Address, SafeV2> | null;
};
