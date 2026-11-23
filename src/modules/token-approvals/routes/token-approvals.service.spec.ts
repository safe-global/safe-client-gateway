// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '#/logging/logging.interface';
import {
  tokenApprovalBuilder,
  tokenApprovalsBuilder,
} from '#/modules/token-approvals/domain/entities/__tests__/token-approval.builder';
import type { ITokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository.interface';
import { TokenApprovalsService } from '#/modules/token-approvals/routes/token-approvals.service';
import {
  erc20TokenBuilder,
  erc721TokenBuilder,
} from '#/modules/tokens/domain/__tests__/token.builder';
import type { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';

const tokenApprovalsRepository = {
  getTokenApprovals: vi.fn(),
} as MockedObject<ITokenApprovalsRepository>;

const tokenRepository = {
  getToken: vi.fn(),
  getTokens: vi.fn(),
} as MockedObject<ITokenRepository>;

const loggingService = {
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

describe('Token approvals with metadata', () => {
  const chainId = faker.string.numeric();
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  let target: TokenApprovalsService;

  beforeEach(() => {
    vi.resetAllMocks();
    const configurationService = new FakeConfigurationService();
    configurationService.set(
      'tokenApprovals.batchSize',
      faker.number.int({ min: 1, max: 10 }),
    );
    target = new TokenApprovalsService(
      tokenApprovalsRepository,
      tokenRepository,
      configurationService,
      loggingService,
    );
  });

  it('should, when approvals are found, return each with its ERC-20 metadata and its allowance as a decimal string', async () => {
    const token = erc20TokenBuilder().build();
    const approval = tokenApprovalBuilder()
      .with('tokenAddress', token.address)
      .build();
    const approvals = tokenApprovalsBuilder()
      .with('approvals', [approval])
      .build();
    tokenApprovalsRepository.getTokenApprovals.mockResolvedValue(approvals);
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual).toStrictEqual({
      approvals: [
        {
          tokenAddress: approval.tokenAddress,
          tokenMetadata: token,
          spender: approval.spender,
          allowance: approval.allowance.toString(),
        },
      ],
      isComplete: approvals.isComplete,
    });
    expect(tokenApprovalsRepository.getTokenApprovals).toHaveBeenCalledWith({
      chainId,
      safeAddress,
    });
    expect(tokenRepository.getToken).toHaveBeenCalledWith({
      chainId,
      address: token.address,
    });
  });

  it('should, when a token cannot be read, return its metadata as null', async () => {
    const approval = tokenApprovalBuilder().build();
    tokenApprovalsRepository.getTokenApprovals.mockResolvedValue(
      tokenApprovalsBuilder().with('approvals', [approval]).build(),
    );
    tokenRepository.getToken.mockRejectedValue(new Error('Not found'));

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([
      {
        tokenAddress: approval.tokenAddress,
        tokenMetadata: null,
        spender: approval.spender,
        allowance: approval.allowance.toString(),
      },
    ]);
  });

  it('should, when a token is not an ERC-20, return its metadata as null', async () => {
    const token = erc721TokenBuilder().build();
    const approval = tokenApprovalBuilder()
      .with('tokenAddress', token.address)
      .build();
    tokenApprovalsRepository.getTokenApprovals.mockResolvedValue(
      tokenApprovalsBuilder().with('approvals', [approval]).build(),
    );
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals).toStrictEqual([
      {
        tokenAddress: approval.tokenAddress,
        tokenMetadata: null,
        spender: approval.spender,
        allowance: approval.allowance.toString(),
      },
    ]);
  });

  it('should, when approvals share a token, read its metadata once', async () => {
    const token = erc20TokenBuilder().build();
    tokenApprovalsRepository.getTokenApprovals.mockResolvedValue(
      tokenApprovalsBuilder()
        .with('approvals', [
          tokenApprovalBuilder().with('tokenAddress', token.address).build(),
          tokenApprovalBuilder().with('tokenAddress', token.address).build(),
        ])
        .build(),
    );
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await target.getTokenApprovals({ chainId, safeAddress });

    expect(actual.approvals.map(({ tokenMetadata }) => tokenMetadata)).toEqual([
      token,
      token,
    ]);
    expect(tokenRepository.getToken).toHaveBeenCalledExactlyOnceWith({
      chainId,
      address: token.address,
    });
  });
});
