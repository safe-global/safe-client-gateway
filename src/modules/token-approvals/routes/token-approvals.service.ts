// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ITokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository.interface';
import type { TokenApprovals } from '#/modules/token-approvals/routes/entities/token-approvals.entity';

@Injectable()
export class TokenApprovalsService {
  constructor(
    @Inject(ITokenApprovalsRepository)
    private readonly tokenApprovalsRepository: ITokenApprovalsRepository,
  ) {}

  async getTokenApprovals(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<TokenApprovals> {
    const { approvals, isHistoryComplete } =
      await this.tokenApprovalsRepository.getTokenApprovals(args);

    return {
      approvals: approvals.map((approval) => ({
        ...approval,
        allowance: approval.allowance.toString(),
      })),
      isHistoryComplete,
    };
  }
}
