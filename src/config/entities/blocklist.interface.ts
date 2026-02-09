import type { Address } from 'viem';

export const IBlocklistService = Symbol('IBlocklistService');

export interface IBlocklistService {
  getBlocklist(): Array<Address>;
  clearCache(): void;
}
