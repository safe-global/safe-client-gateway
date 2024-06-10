import { PublicClient } from 'viem';

export const IBlockchainApi = Symbol('IBlockchainApi');

export interface IBlockchainApi {
  getClient(): PublicClient;

  destroyClient(chainId: string): void;
}
