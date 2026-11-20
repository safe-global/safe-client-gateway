// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  tokenApprovalBuilder,
  tokenApprovalsBuilder,
} from '#/modules/token-approvals/domain/entities/__tests__/token-approval.builder';
import type { ITokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository.interface';
import { TokenApprovalsService } from '#/modules/token-approvals/routes/token-approvals.service';

const tokenApprovalsRepository = {
  getTokenApprovals: vi.fn(),
} as MockedObject<ITokenApprovalsRepository>;

describe('TokenApprovalsService', () => {
  const target = new TokenApprovalsService(tokenApprovalsRepository);

  it('returns the approvals with their allowance as a string', async () => {
    const args = {
      chainId: faker.string.numeric(),
      safeAddress: getAddress(faker.finance.ethereumAddress()),
    };
    const approval = tokenApprovalBuilder().build();
    const tokenApprovals = tokenApprovalsBuilder()
      .with('approvals', [approval])
      .build();
    tokenApprovalsRepository.getTokenApprovals.mockResolvedValue(
      tokenApprovals,
    );

    const actual = await target.getTokenApprovals(args);

    expect(actual).toStrictEqual({
      approvals: [
        {
          tokenAddress: approval.tokenAddress,
          spender: approval.spender,
          allowance: approval.allowance.toString(),
        },
      ],
      isHistoryComplete: tokenApprovals.isHistoryComplete,
    });
    expect(tokenApprovalsRepository.getTokenApprovals).toHaveBeenCalledWith(
      args,
    );
  });
});
