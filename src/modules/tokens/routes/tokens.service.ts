// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { asError } from '@/logging/utils';
import type { Token } from '@/modules/tokens/domain/entities/token.entity';
import { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';

const isNotFound = (error: unknown): boolean =>
  error instanceof DataSourceError && error.code === HttpStatus.NOT_FOUND;

/** Case-insensitive de-duplication that keeps each address at its first position. */
const uniqueAddresses = (addresses: Array<Address>): Array<Address> => {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const key = address.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

@Injectable()
export class TokensService {
  constructor(
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
  ) {}

  getToken(args: { chainId: string; address: Address }): Promise<Token> {
    return this.tokenRepository.getToken(args);
  }

  /**
   * Metadata for several tokens of one chain, in request order.
   * An address the Transaction Service does not know (404) is left out; any other
   * failure is propagated so the client sees an error rather than a silently short list.
   */
  async getTokens(args: {
    chainId: string;
    addresses: Array<Address>;
  }): Promise<Array<Token>> {
    const settled = await Promise.allSettled(
      uniqueAddresses(args.addresses).map((address) =>
        this.tokenRepository.getToken({ chainId: args.chainId, address }),
      ),
    );

    const tokens: Array<Token> = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        tokens.push(result.value);
      } else if (!isNotFound(result.reason)) {
        throw asError(result.reason);
      }
    }
    return tokens;
  }
}
