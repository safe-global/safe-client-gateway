// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import { tokenBuilder } from '@/modules/tokens/domain/__tests__/token.builder';
import type { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';

const mockTokenRepository = {
  getToken: vi.fn(),
  getTokens: vi.fn(),
} as MockedObject<ITokenRepository>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

describe('PolicyTokenService', () => {
  let service: PolicyTokenService;
  const chainId = faker.string.numeric({ length: 3 });

  beforeEach(() => {
    vi.resetAllMocks();
    service = new PolicyTokenService(mockTokenRepository, mockLoggingService);
  });

  it('should return the token metadata', async () => {
    const token = tokenBuilder().build();
    mockTokenRepository.getToken.mockResolvedValue(token);

    const result = await service.getTokenInfo({
      chainId,
      address: token.address,
    });

    expect(result).toStrictEqual({
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      logoUri: token.logoUri,
    });
    expect(mockTokenRepository.getToken).toHaveBeenCalledWith({
      chainId,
      address: token.address,
    });
  });

  it('should fall back to an address-only token when it is unknown', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    mockTokenRepository.getToken.mockRejectedValue(new Error('Not found'));

    const result = await service.getTokenInfo({ chainId, address });

    expect(result).toStrictEqual({
      address,
      symbol: null,
      decimals: null,
      logoUri: null,
    });
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Policy token metadata not found',
        address,
      }),
    );
  });
});
