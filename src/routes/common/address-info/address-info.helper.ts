import { Inject, Injectable } from '@nestjs/common';
import { ContractsRepository } from '../../../domain/contracts/contracts.repository';
import { IContractsRepository } from '../../../domain/contracts/contracts.repository.interface';
import { TokenRepository } from '../../../domain/tokens/token.repository';
import { ITokenRepository } from '../../../domain/tokens/token.repository.interface';
import { AddressInfo } from '../entities/address-info.entity';

export type Source = 'CONTRACT' | 'TOKEN';

@Injectable()
export class AddressInfoHelper {
  constructor(
    @Inject(IContractsRepository)
    private readonly contractsRepository: ContractsRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: TokenRepository,
  ) {}

  /**
   * Returns a promise for {@link AddressInfo} which contains the source
   * information for {@link address}
   *
   * The promise can be rejected if the address info cannot be retrieved for
   * the specified {@link source}
   *
   * @param chainId - the chain id where the source exists
   * @param address - the address of the source to which we want to retrieve its metadata
   * @param source - the {@link Source} to which we want to retrieve its metadata
   */
  get(
    chainId: string,
    address: string,
    source: Source = 'CONTRACT',
  ): Promise<AddressInfo> {
    return this._getFromSource(chainId, address, source);
  }

  /**
   * Similar to {@see get} but should never fail.
   *
   * If a source address cannot be retrieved, a {@link AddressInfo} is returned
   * containing just the source address
   *
   * @param chainId - the chain id where the source exists
   * @param address - the address of the source to which we want to retrieve its metadata
   * @param source - the {@link Source} to which we want to retrieve its metadata
   */
  getOrDefault(
    chainId: string,
    address: string,
    source: Source = 'CONTRACT',
  ): Promise<AddressInfo> {
    return this.get(chainId, address, source).catch(
      () => new AddressInfo(address),
    );
  }

  /**
   * Similar to {@see getOrDefault} but works with a collection of source addresses
   *
   * @param chainId - the chain id where the source exists
   * @param addresses - the collection of addresses to which we want to retrieve the respective metadata
   * @param source - the {@link Source} to which we want to retrieve its metadata
   */
  getCollection(
    chainId: string,
    addresses: string[],
    source: Source = 'CONTRACT',
  ): Promise<Array<AddressInfo>> {
    return Promise.allSettled(
      addresses.map((address) => this.getOrDefault(chainId, address, source)),
    ).then((results) =>
      results.map((result) => {
        if (result.status == 'fulfilled') return result.value;
        else throw new Error('Error processing address collection');
      }),
    );
  }

  private _getFromSource(
    chainId: string,
    address: string,
    source: Source,
  ): Promise<AddressInfo> {
    switch (source) {
      case 'CONTRACT':
        return this.contractsRepository
          .getContract(chainId, address)
          .then((c) => new AddressInfo(c.address, c.displayName, c.logoUri));
      case 'TOKEN':
        return this.tokenRepository
          .getToken(chainId, address)
          .then((t) => new AddressInfo(t.address, t.name, t.logoUri));
      default:
        return Promise.reject('Unknown source');
    }
  }
}
