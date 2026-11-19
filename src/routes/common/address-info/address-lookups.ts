// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { ILoggingService } from '#/logging/logging.interface';
import type { IContractsRepository } from '#/modules/contracts/domain/contracts.repository.interface';
import type { Token } from '#/modules/tokens/domain/entities/token.entity';
import type { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

export type Source = 'CONTRACT' | 'TOKEN';

/**
 * The token and contract lookups of the addresses that one response names.
 *
 * Each address is looked up at most once as a token and once as a contract,
 * however many items of a page name it, and a lookup that is still pending is
 * shared. Whoever maps a response creates one and passes it to the mappers;
 * it is dropped with the response.
 */
export class AddressLookups {
  private readonly tokens = new Map<Address, Promise<Token>>();
  private readonly contracts = new Map<Address, Promise<AddressInfo>>();

  constructor(
    private readonly chainId: string,
    private readonly tokenRepository: ITokenRepository,
    private readonly contractsRepository: IContractsRepository,
    private readonly loggingService: ILoggingService,
  ) {}

  getToken(address: Address): Promise<Token> {
    let token = this.tokens.get(address);
    if (!token) {
      token = this.tokenRepository.getToken({ chainId: this.chainId, address });
      this.tokens.set(address, token);
    }
    return token;
  }

  /**
   * Returns the {@link AddressInfo} of {@link address} from the first of
   * {@link sources} that knows it, or rejects if none does.
   */
  async get(address: Address, sources: Array<Source>): Promise<AddressInfo> {
    for (const source of sources) {
      try {
        return await this.getFromSource(address, source);
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

  /**
   * Similar to {@link get}, but returns an {@link AddressInfo} holding only
   * {@link address} if no source knows it.
   */
  getOrDefault(address: Address, sources: Array<Source>): Promise<AddressInfo> {
    return this.get(address, sources).catch(() => new AddressInfo(address));
  }

  /**
   * Similar to {@link getOrDefault}, for each of {@link addresses}.
   */
  getCollection(
    addresses: Array<Address>,
    sources: Array<Source>,
  ): Promise<Array<AddressInfo>> {
    return Promise.all(
      addresses.map((address) => this.getOrDefault(address, sources)),
    );
  }

  private async getContractInfo(address: Address): Promise<AddressInfo> {
    let info = this.contracts.get(address);
    if (!info) {
      info = this.contractsRepository
        .getContract({ chainId: this.chainId, contractAddress: address })
        .then(
          (contract) =>
            new AddressInfo(
              contract.address,
              contract.displayName || contract.name,
              contract.logoUrl,
            ),
        );
      this.contracts.set(address, info);
    }
    const { value, name, logoUri } = await info;
    return new AddressInfo(value, name, logoUri);
  }

  private async getFromSource(
    address: Address,
    source: Source,
  ): Promise<AddressInfo> {
    switch (source) {
      case 'CONTRACT':
        return this.getContractInfo(address);
      case 'TOKEN': {
        const token = await this.getToken(address);
        return new AddressInfo(token.address, token.name, token.logoUri);
      }
      default:
        return Promise.reject('Unknown source');
    }
  }
}
