// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { batched } from '#/domain/common/utils/batch';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { ITokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository.interface';
import type { TokenApprovalsResponse } from '#/modules/token-approvals/routes/entities/token-approvals.dto.entity';
import type { Erc20Token } from '#/modules/tokens/domain/entities/token.entity';
import { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';

@Injectable()
export class TokenApprovalsService {
  private readonly batchSize: number;

  constructor(
    @Inject(ITokenApprovalsRepository)
    private readonly tokenApprovalsRepository: ITokenApprovalsRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.batchSize = this.configurationService.getOrThrow<number>(
      'tokenApprovals.batchSize',
    );
  }

  async getTokenApprovals(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<TokenApprovalsResponse> {
    const { approvals, isComplete } =
      await this.tokenApprovalsRepository.getTokenApprovals(args);
    const tokens = await this.getErc20Tokens({
      chainId: args.chainId,
      addresses: [
        ...new Set(approvals.map(({ tokenAddress }) => tokenAddress)),
      ],
    });

    return {
      approvals: approvals.map((approval) => ({
        tokenAddress: approval.tokenAddress,
        tokenMetadata: tokens.get(approval.tokenAddress) ?? null,
        spender: approval.spender,
        allowance: approval.allowance.toString(),
      })),
      isComplete,
    };
  }

  /** The metadata of each token in {@link args.addresses} that is an ERC-20. */
  private async getErc20Tokens(args: {
    chainId: string;
    addresses: Array<Address>;
  }): Promise<Map<Address, Erc20Token>> {
    const tokens = new Map<Address, Erc20Token>();

    const results = await batched(args.addresses, this.batchSize, (address) =>
      this.tokenRepository.getToken({ chainId: args.chainId, address }),
    );
    results.forEach((result, index) => {
      const address = args.addresses[index];
      if (result.status !== 'fulfilled') {
        this.loggingService.debug({
          message: 'Could not read a token',
          chainId: args.chainId,
          address,
          error: asError(result.reason).message,
        });
        return;
      }
      if (result.value.type !== 'ERC20') {
        this.loggingService.debug({
          message: "An approval's token is not an ERC-20 token",
          chainId: args.chainId,
          address,
        });
        return;
      }
      tokens.set(address, result.value);
    });

    return tokens;
  }
}
