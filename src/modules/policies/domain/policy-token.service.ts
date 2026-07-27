// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { PolicyTokenInfo } from '@/modules/policies/domain/entities/active-policy.entity';
import { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';

/**
 * Token metadata for the addresses a policy references.
 *
 * A policy is a restriction the user must be able to see, so an unknown token
 * degrades to an address-only {@link PolicyTokenInfo} instead of dropping the
 * policy from the response.
 */
@Injectable()
export class PolicyTokenService {
  constructor(
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async getTokenInfo(args: {
    chainId: string;
    address: Address;
  }): Promise<PolicyTokenInfo> {
    try {
      const token = await this.tokenRepository.getToken(args);

      return {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        logoUri: token.logoUri,
      };
    } catch (error) {
      this.loggingService.debug({
        message: 'Policy token metadata not found',
        chainId: args.chainId,
        address: args.address,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        address: args.address,
        symbol: null,
        decimals: null,
        logoUri: null,
      };
    }
  }
}
