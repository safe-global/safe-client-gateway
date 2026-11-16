// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import type { ContractsRepository } from '#/modules/contracts/domain/contracts.repository';
import { IContractsRepository } from '#/modules/contracts/domain/contracts.repository.interface';
import type { TokenRepository } from '#/modules/tokens/domain/token.repository';
import { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import {
  AddressLookups,
  type Source,
} from '#/routes/common/address-info/address-lookups';
import type { AddressInfo } from '#/routes/common/entities/address-info.entity';

@Injectable()
export class AddressInfoHelper {
  constructor(
    @Inject(IContractsRepository)
    private readonly contractsRepository: ContractsRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: TokenRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Returns new {@link AddressLookups} for {@link chainId}. Create one for each
   * response that names several addresses, so that each is looked up once.
   *
   * @param chainId - the chain id where the addresses exist
   */
  createLookups(chainId: string): AddressLookups {
    return new AddressLookups(
      chainId,
      this.tokenRepository,
      this.contractsRepository,
      this.loggingService,
    );
  }

  /**
   * Returns a promise for {@link AddressInfo} which contains the source
   * information for {@link address}
   *
   * The promise can be rejected if the address info cannot be retrieved for
   * any specified {@link source}
   *
   * The function will try to get the address info from the provided sources
   * in the order they are provided. If the address info cannot be retrieved
   * from a source, the next source will be tried.
   *
   * @param chainId - the chain id where the source exists
   * @param address - the address of the source to which we want to retrieve its metadata
   * @param sources - a collection of {@link Source} to which we want to retrieve its metadata
   */
  get(
    chainId: string,
    address: Address,
    sources: Array<Source>,
  ): Promise<AddressInfo> {
    return this.createLookups(chainId).get(address, sources);
  }

  /**
   * Similar to {@see get} but should never fail.
   *
   * If a source address cannot be retrieved, a {@link AddressInfo} is returned
   * containing just the source address
   *
   * @param chainId - the chain id where the source exists
   * @param address - the address of the source to which we want to retrieve its metadata
   * @param sources - a collection of {@link Source} to which we want to retrieve its metadata
   */
  getOrDefault(
    chainId: string,
    address: Address,
    sources: Array<Source>,
  ): Promise<AddressInfo> {
    return this.createLookups(chainId).getOrDefault(address, sources);
  }

  /**
   * Similar to {@see getOrDefault} but works with a collection of source addresses
   *
   * @param chainId - the chain id where the source exists
   * @param addresses - the collection of addresses to which we want to retrieve the respective metadata
   * @param sources - a collection of {@link Source} to which we want to retrieve its metadata
   */
  getCollection(
    chainId: string,
    addresses: Array<Address>,
    sources: Array<Source>,
  ): Promise<Array<AddressInfo>> {
    return this.createLookups(chainId).getCollection(addresses, sources);
  }
}
