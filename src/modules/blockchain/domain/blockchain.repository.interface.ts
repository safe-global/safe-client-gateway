export const IBlockchainRepository = Symbol('IBlockchainRepository');

export interface IBlockchainRepository {
  clearApi(chainId: string): void;
}
