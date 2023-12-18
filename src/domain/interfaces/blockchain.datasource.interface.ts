import { PublicClient } from 'viem';

export const IBlockchainDataSource = Symbol('IBlockchainDataSource');

export interface IBlockchainDataSource {
  getPublicClient(chainId: string): Promise<PublicClient>;
}
