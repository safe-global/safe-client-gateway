export const IBlockchainRepository = Symbol('IBlockchainRepository');

export interface IBlockchainRepository {
  clearClient(chainId: string): void;
}
