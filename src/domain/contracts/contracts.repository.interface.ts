import { Contract } from './entities/contract.entity';

export const IContractsRepository = Symbol('IContractsRepository');

export interface IContractsRepository {
  /**
   * Gets the {@link Contract} associated with the {@link chainId} and the {@link contractAddress}.
   *
   * @param chainId
   * @param contractAddress
   */
  getContract(chainId: string, contractAddress: string): Promise<Contract>;
}
