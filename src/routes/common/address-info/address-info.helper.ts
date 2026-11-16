// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Address } from 'viem';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import type { ContractsRepository } from '#/modules/contracts/domain/contracts.repository';
import { IContractsRepository } from '#/modules/contracts/domain/contracts.repository.interface';
import type { TokenRepository } from '#/modules/tokens/domain/token.repository';
import { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

export type Source = 'CONTRACT' | 'TOKEN';

type AddressInfoLookups = Map<string, Promise<AddressInfo>>;

// Key of the lookups a request has started, in its CLS store
const REQUEST_LOOKUPS = Symbol('AddressInfoHelper.requestLookups');

// A page of transactions names far fewer addresses. The cap keeps the lookups
// bounded should a CLS context ever outlive a request.
export const MAX_REQUEST_LOOKUPS = 1_000;

@Injectable()
export class AddressInfoHelper {
  constructor(
    @Inject(IContractsRepository)
    private readonly contractsRepository: ContractsRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: TokenRepository,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly cls: ClsService,
  ) {}

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
   * Within a request, an address is looked up once for the same sources, and
   * a lookup that failed is not tried again: a page of transactions names the
   * same few addresses in most of its items.
   *
   * @param chainId - the chain id where the source exists
   * @param address - the address of the source to which we want to retrieve its metadata
   * @param sources - a collection of {@link Source} to which we want to retrieve its metadata
   */
  async get(
    chainId: string,
    address: Address,
    sources: Array<Source>,
  ): Promise<AddressInfo> {
    const lookups = this._getRequestLookups();
    if (!lookups) {
      return await this._getFromSources(chainId, address, sources);
    }

    const key = `${chainId}_${address}_${sources.join('_')}`;
    let lookup = lookups.get(key);
    if (!lookup) {
      lookup = this._getFromSources(chainId, address, sources);
      if (lookups.size < MAX_REQUEST_LOOKUPS) {
        lookups.set(key, lookup);
      }
    }
    return await lookup;
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
    return this.get(chainId, address, sources).catch(
      () => new AddressInfo(address),
    );
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
    return Promise.allSettled(
      addresses.map((address) => this.getOrDefault(chainId, address, sources)),
    ).then((results) =>
      results.map((result) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        throw new Error('Error processing address collection');
      }),
    );
  }

  /**
   * Returns the lookups the current request has started, or `undefined`
   * outside of a request (jobs, crons, events).
   */
  private _getRequestLookups(): AddressInfoLookups | undefined {
    if (!this.cls.isActive()) {
      return undefined;
    }

    let lookups = this.cls.get<AddressInfoLookups | undefined>(REQUEST_LOOKUPS);
    if (!lookups) {
      lookups = new Map();
      this.cls.set(REQUEST_LOOKUPS, lookups);
    }
    return lookups;
  }

  private async _getFromSources(
    chainId: string,
    address: Address,
    sources: Array<Source>,
  ): Promise<AddressInfo> {
    for (const source of sources) {
      try {
        return await this._getFromSource(chainId, address, source);
      } catch {
        this.loggingService.debug(
          `Could not get address info with source=${source} for ${address}`,
        );
      }
    }
    return Promise.reject(
      `Could not get address info from provided sources=${sources} for ${address}`,
    );
  }

  private _getFromSource(
    chainId: string,
    address: Address,
    source: Source,
  ): Promise<AddressInfo> {
    switch (source) {
      case 'CONTRACT':
        return this.contractsRepository
          .getContract({ chainId, contractAddress: address })
          .then((c) => {
            const name = c.displayName || c.name;
            return new AddressInfo(c.address, name, c.logoUrl);
          });
      case 'TOKEN':
        return this.tokenRepository
          .getToken({ chainId, address })
          .then((t) => new AddressInfo(t.address, t.name, t.logoUri));
      default:
        return Promise.reject('Unknown source');
    }
  }
}
