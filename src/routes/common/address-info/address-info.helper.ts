import { Inject, Injectable } from '@nestjs/common';
import { ContractsRepository } from '../../../domain/contracts/contracts.repository';
import { IContractsRepository } from '../../../domain/contracts/contracts.repository.interface';
import { AddressInfo } from '../entities/address-info.entity';

@Injectable()
export class AddressInfoHelper {
  constructor(
    @Inject(IContractsRepository)
    private readonly repository: ContractsRepository,
  ) {}

  /**
   * Returns a promise for {@link AddressInfo} which contains the contract
   * information for {@link address}
   *
   * If the {@link address} is 0x0000000000000000000000000000000000000000,
   * null is returned
   *
   * The promise can result in rejection if the contract information
   * is not found or cannot be retrieved
   *
   * @param chainId - the chain id where the contract exists
   * @param address - the address of the contract to which we want to retrieve its metadata
   */
  get(chainId: string, address: string): Promise<AddressInfo | null> {
    if (address == '0x0000000000000000000000000000000000000000')
      return Promise.resolve(null);
    return this.repository
      .getContract(chainId, address)
      .then(
        (contract) =>
          new AddressInfo(
            contract.address,
            contract.displayName,
            contract.logoUri,
          ),
      );
  }

  /**
   * Similar to {@see get} but should never fail.
   *
   * If a contract address cannot be retrieved, a {@link AddressInfo} is returned
   * containing just the contract address
   *
   * @param chainId - the chain id where the contract exists
   * @param address - the address of the contract to which we want to retrieve its metadata
   */
  getOrDefault(chainId: string, address: string): Promise<AddressInfo> {
    return this.get(chainId, address)
      .then((addressInfo) => addressInfo ?? new AddressInfo(address))
      .catch(() => new AddressInfo(address));
  }

  /**
   * Similar to {@see getOrDefault} but works with a collection
   *
   * @param chainId - the chain id where the contract exists
   * @param addresses - the collection of addresses to which we want to retrieve the respective metadata
   */
  getCollection(
    chainId: string,
    addresses: string[],
  ): Promise<Array<AddressInfo | null>> {
    return Promise.allSettled(
      addresses.map((address) => this.getOrDefault(chainId, address)),
    ).then((results) =>
      results.map((result) => {
        if (result.status == 'fulfilled') return result.value;
        else throw new Error('Error processing address collection');
      }),
    );
  }
}
